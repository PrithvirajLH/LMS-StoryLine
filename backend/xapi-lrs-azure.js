/**
 * Production-grade xAPI Learning Record Store using Azure Table Storage
 * Designed for 15,000+ employees
 */

import {
  getTableClient,
  getStatementPartitionKey,
  getStatementPartitionKeys,
  getStatePartitionKey,
  getActivityProfilePartitionKey,
  getAgentProfilePartitionKey,
  retryOperation,
  sanitizeODataValue,
  buildODataFilter,
  TABLES
} from './azure-tables.js';
import * as verbTracker from './xapi-verb-tracker.js';
import { xapiLogger as logger } from './logger.js';

// ============================================================================
// Statement Operations
// ============================================================================

/**
 * Save xAPI statement(s) to Azure Table Storage
 */
export async function saveStatement(statement) {
  // Handle array of statements
  if (Array.isArray(statement)) {
    const results = await Promise.all(statement.map(stmt => saveStatement(stmt)));
    return { status: 200, data: results.map(r => r.data[0]) };
  }

  const client = getTableClient('STATEMENTS');

  // Generate ID if missing
  if (!statement.id) {
    statement.id = `http://lms.example.com/statements/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add timestamps
  if (!statement.stored) {
    statement.stored = new Date().toISOString();
  }
  if (!statement.timestamp) {
    statement.timestamp = new Date().toISOString();
  }

  // Extract partition key from actor
  const partitionKey = getStatementPartitionKey(statement.actor);
  const rowKey = statement.id.split('/').pop() || statement.id;

  // Store statement as entity
  const entity = {
    partitionKey,
    rowKey,
    statement: JSON.stringify(statement),
    verb: statement.verb?.id || '',
    object: statement.object?.id || '',
    registration: statement.context?.registration || null
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));

  // Track verb usage for statistics
  const actor = statement.actor;
  const activityId = statement.object?.id || '';
  const userEmail = actor.mbox ? actor.mbox.replace('mailto:', '') : 'unknown';
  const verbId = statement.verb?.id || '';
  
  if (verbId) {
    // Track verb usage (async, don't await)
    verbTracker.trackVerbUsage(verbId, userEmail, activityId).catch(err => {
      logger.error({ verbId, error: err.message }, 'Error tracking verb usage');
    });
    
    // Process custom verb handlers
    await verbTracker.processCustomVerb(statement, {
      userEmail,
      activityId,
      timestamp: statement.timestamp
    });
    
    // Log custom/unknown verbs
    const verbConfig = verbTracker.getVerbConfig(verbId);
    if (verbConfig.isCustom || verbConfig.isUnknown) {
      logger.info({ verbId, category: verbConfig.category, action: verbConfig.action }, 'Custom/Unknown verb detected');
    }
  }

  logger.debug({ statementId: statement.id.substring(0, 50) }, 'Statement saved');
  
  return { status: 200, data: [statement.id] };
}

/**
 * Query statements from Azure Table Storage
 */
export async function queryStatements(query) {
  const client = getTableClient('STATEMENTS');
  const limit = Math.min(parseInt(query.limit, 10) || 10, 1000);
  const offset = parseInt(query.offset, 10) || 0;

  function encodeContinuationToken(token) {
    if (!token) return '';
    const json = JSON.stringify(token);
    return Buffer.from(json, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  function decodeContinuationToken(token) {
    if (!token) return null;
    try {
      let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    } catch (error) {
      return null;
    }
  }

  try {
    const entities = [];
    const cursorToken = decodeContinuationToken(query.cursor || query.more);

    let agent = null;
    if (query.agent) {
      if (typeof query.agent === 'string') {
        try {
          agent = JSON.parse(decodeURIComponent(query.agent));
        } catch (error) {
          agent = JSON.parse(query.agent);
        }
      } else {
        agent = query.agent;
      }
    }

    const partitionKeys = agent ? getStatementPartitionKeys(agent) : [null];
    let partitionIndex = cursorToken?.partitionIndex || 0;
    let continuationToken = cursorToken?.continuationToken || null;
    let remaining = limit;
    let skipped = offset;
    let more = '';

    for (let i = partitionIndex; i < partitionKeys.length && remaining > 0; i++) {
      const partitionKey = partitionKeys[i];

      // Build OData filter with sanitization
      const conditions = [];
      
      if (partitionKey) {
        conditions.push({ field: 'PartitionKey', value: partitionKey });
      }

      if (query.activity) {
        const activityId = typeof query.activity === 'string' ? query.activity : query.activity.id;
        conditions.push({ field: 'object', value: activityId });
      }

      if (query.registration) {
        conditions.push({ field: 'registration', value: query.registration });
      }

      if (query.verb) {
        const verbId = typeof query.verb === 'string' ? query.verb : query.verb.id;
        conditions.push({ field: 'verb', value: verbId });
      }

      const filter = buildODataFilter(conditions, 'and') || undefined;

      const listEntities = client.listEntities({
        queryOptions: { filter }
      });

      const pageIterator = listEntities.byPage({
        maxPageSize: Math.max(remaining + skipped, remaining),
        continuationToken: i === partitionIndex ? continuationToken : undefined
      });

      const page = await pageIterator.next();
      if (page.done) {
        continuationToken = null;
        continue;
      }

      for (const entity of page.value) {
        if (skipped > 0) {
          skipped--;
          continue;
        }
        entities.push(JSON.parse(entity.statement));
        remaining--;
        if (remaining <= 0) break;
      }

      const nextToken = page.value.continuationToken || page.continuationToken || null;
      if (nextToken) {
        more = encodeContinuationToken({ partitionIndex: i, continuationToken: nextToken });
        break;
      }

      if (remaining <= 0 && i < partitionKeys.length - 1) {
        more = encodeContinuationToken({ partitionIndex: i + 1, continuationToken: null });
        break;
      }
    }

    return {
      status: 200,
      data: {
        statements: entities,
        more
      }
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Query statements error');
    throw error;
  }
}

/**
 * Query statements by activity prefix (admin/coach inspection)
 */
export async function queryStatementsByActivityPrefix(activityId, limit = 50, registration = null) {
  const client = getTableClient('STATEMENTS');
  const statements = [];

  try {
    let count = 0;
    for await (const entity of client.listEntities()) {
      if (!entity.statement) continue;
      const statement = JSON.parse(entity.statement);
      const objectId = statement.object?.id || '';
      if (!objectId || !objectId.startsWith(activityId)) continue;
      if (registration && statement.context?.registration !== registration) continue;
      statements.push(statement);
      count++;
      if (count >= limit) break;
    }
    return { status: 200, data: { statements } };
  } catch (error) {
    logger.error({ activityId, error: error.message }, 'Query by activity prefix error');
    throw error;
  }
}

/**
 * Get specific statement by ID
 */
export async function getStatement(statementId) {
  const client = getTableClient('STATEMENTS');

  try {
    const rowKey = statementId.split('/').pop() || statementId;
    
    // Use sanitized filter
    const filter = `RowKey eq '${sanitizeODataValue(rowKey)}'`;
    
    const listEntities = client.listEntities({
      queryOptions: { filter }
    });

    for await (const entity of listEntities) {
      const statement = JSON.parse(entity.statement);
      if (statement.id === statementId || entity.rowKey === rowKey) {
        return { status: 200, data: statement };
      }
    }

    return { status: 404, data: null };
  } catch (error) {
    logger.error({ statementId, error: error.message }, 'Get statement error');
    return { status: 404, data: null };
  }
}

// ============================================================================
// State Operations
// ============================================================================

/**
 * Save activity state
 */
export async function saveState(activityId, agent, stateId, state, registration = null) {
  const client = getTableClient('STATE');
  
  const normalizedAgent = typeof agent === 'string' ? JSON.parse(agent) : agent;
  const partitionKey = getStatePartitionKey(activityId, normalizedAgent);
  
  logger.debug({ partitionKey, stateId, registration }, 'Saving state');
  
  const stateString = typeof state === 'string' ? state : JSON.stringify(state);
  
  // For resume/bookmark state, save without registration for persistent resume
  if (stateId === 'resume' || stateId === 'bookmark') {
    const entityWithoutReg = {
      partitionKey,
      rowKey: stateId,
      state: stateString
    };
    
    await retryOperation(() => client.upsertEntity(entityWithoutReg, 'Replace'));
    logger.debug({ stateId }, 'Resume state saved without registration');
    
    if (registration) {
      const entityWithReg = {
        partitionKey,
        rowKey: `${stateId}|${registration}`,
        state: stateString
      };
      
      await retryOperation(() => client.upsertEntity(entityWithReg, 'Replace'));
      logger.debug({ stateId, registration }, 'Resume state saved with registration');
    }
    
    return { status: 204, data: null };
  }
  
  const rowKey = `${stateId}${registration ? `|${registration}` : ''}`;

  const entity = {
    partitionKey,
    rowKey,
    state: stateString
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));

  return { status: 204, data: null };
}

/**
 * Get activity state
 */
export async function getState(activityId, agent, stateId, registration = null) {
  const client = getTableClient('STATE');
  
  const normalizedAgent = typeof agent === 'string' ? JSON.parse(agent) : agent;
  const partitionKey = getStatePartitionKey(activityId, normalizedAgent);
  
  logger.debug({ partitionKey, stateId, registration }, 'Getting state');
  
  // For resume state, try without registration first
  if (stateId === 'resume' || stateId === 'bookmark') {
    try {
      const rowKeyWithoutReg = stateId;
      const entity = await client.getEntity(partitionKey, rowKeyWithoutReg);
      if (entity && entity.state) {
        logger.debug({ stateId, length: entity.state.length }, 'Found state without registration');
        return { status: 200, data: entity.state };
      }
    } catch (error) {
      if (error.statusCode !== 404 && error.code !== 'ResourceNotFound') {
        logger.error({ stateId, error: error.message }, 'Error getting state without registration');
      }
    }
    
    if (registration) {
      try {
        const rowKeyWithReg = `${stateId}|${registration}`;
        const entity = await client.getEntity(partitionKey, rowKeyWithReg);
        if (entity && entity.state) {
          logger.debug({ stateId, registration, length: entity.state.length }, 'Found state with registration');
          return { status: 200, data: entity.state };
        }
      } catch (error) {
        if (error.statusCode !== 404 && error.code !== 'ResourceNotFound') {
          logger.error({ stateId, registration, error: error.message }, 'Error getting state with registration');
        }
      }
    }
    
    return { status: 404, data: null };
  }
  
  const rowKey = `${stateId}${registration ? `|${registration}` : ''}`;

  try {
    const entity = await client.getEntity(partitionKey, rowKey);
    if (!entity || !entity.state) {
      return { status: 404, data: null };
    }
    return { status: 200, data: entity.state };
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return { status: 404, data: null };
    }
    logger.error({ stateId, error: error.message }, 'Get state error');
    throw error;
  }
}

/**
 * Delete activity state
 */
export async function deleteState(activityId, agent, stateId, registration = null) {
  const client = getTableClient('STATE');
  
  const partitionKey = getStatePartitionKey(activityId, agent);
  const rowKey = `${stateId}${registration ? `|${registration}` : ''}`;

  try {
    await client.deleteEntity(partitionKey, rowKey);
    return { status: 204, data: null };
  } catch (error) {
    if (error.statusCode === 404) {
      return { status: 204, data: null };
    }
    throw error;
  }
}

// ============================================================================
// Activity Profile Operations
// ============================================================================

/**
 * Save activity profile
 */
export async function saveActivityProfile(activityId, profileId, profile) {
  const client = getTableClient('ACTIVITY_PROFILES');
  
  const partitionKey = getActivityProfilePartitionKey(activityId);
  const rowKey = profileId;

  const entity = {
    partitionKey,
    rowKey,
    activityId,
    profileId,
    profile: JSON.stringify(profile),
    updated: new Date().toISOString()
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));

  return { status: 204, data: null };
}

/**
 * Get activity profile
 */
export async function getActivityProfile(activityId, profileId) {
  const client = getTableClient('ACTIVITY_PROFILES');
  
  const partitionKey = getActivityProfilePartitionKey(activityId);
  const rowKey = profileId;

  try {
    const entity = await client.getEntity(partitionKey, rowKey);
    return { status: 200, data: JSON.parse(entity.profile) };
  } catch (error) {
    if (error.statusCode === 404) {
      return { status: 404, data: null };
    }
    throw error;
  }
}

/**
 * Delete activity profile
 */
export async function deleteActivityProfile(activityId, profileId) {
  const client = getTableClient('ACTIVITY_PROFILES');
  
  const partitionKey = getActivityProfilePartitionKey(activityId);
  const rowKey = profileId;

  try {
    await client.deleteEntity(partitionKey, rowKey);
    return { status: 204, data: null };
  } catch (error) {
    if (error.statusCode === 404) {
      return { status: 204, data: null };
    }
    throw error;
  }
}

// ============================================================================
// Agent Profile Operations
// ============================================================================

/**
 * Save agent profile
 */
export async function saveAgentProfile(agent, profileId, profile) {
  const client = getTableClient('AGENT_PROFILES');
  
  const partitionKey = getAgentProfilePartitionKey(agent);
  const rowKey = profileId;

  const entity = {
    partitionKey,
    rowKey,
    agent: JSON.stringify(agent),
    profileId,
    profile: JSON.stringify(profile),
    updated: new Date().toISOString()
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));

  return { status: 204, data: null };
}

/**
 * Get agent profile
 */
export async function getAgentProfile(agent, profileId) {
  const client = getTableClient('AGENT_PROFILES');
  
  const partitionKey = getAgentProfilePartitionKey(agent);
  const rowKey = profileId;

  try {
    const entity = await client.getEntity(partitionKey, rowKey);
    return { status: 200, data: JSON.parse(entity.profile) };
  } catch (error) {
    if (error.statusCode === 404) {
      return { status: 404, data: null };
    }
    throw error;
  }
}

/**
 * Delete agent profile
 */
export async function deleteAgentProfile(agent, profileId) {
  const client = getTableClient('AGENT_PROFILES');
  
  const partitionKey = getAgentProfilePartitionKey(agent);
  const rowKey = profileId;

  try {
    await client.deleteEntity(partitionKey, rowKey);
    return { status: 204, data: null };
  } catch (error) {
    if (error.statusCode === 404) {
      return { status: 204, data: null };
    }
    throw error;
  }
}
