/**
 * Production-grade xAPI Learning Record Store using Azure Table Storage
 * Designed for 15,000+ employees
 */

import {
  getTableClient,
  getStatementPartitionKey,
  getStatePartitionKey,
  getActivityProfilePartitionKey,
  getAgentProfilePartitionKey,
  retryOperation,
  TABLES
} from './azure-tables.js';

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
  const rowKey = statement.id.split('/').pop() || statement.id; // Use last part of ID as row key

  // Store statement as entity
  const entity = {
    partitionKey,
    rowKey,
    statementId: statement.id,
    statement: JSON.stringify(statement), // Store full statement as JSON
    actor: JSON.stringify(statement.actor),
    verb: statement.verb?.id || '',
    object: statement.object?.id || '',
    timestamp: statement.timestamp,
    stored: statement.stored,
    registration: statement.context?.registration || null
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));

  console.log(`[xAPI Azure] Statement saved: ${statement.id.substring(0, 50)}...`);
  
  return { status: 200, data: [statement.id] };
}

/**
 * Query statements from Azure Table Storage
 */
export async function queryStatements(query) {
  const client = getTableClient('STATEMENTS');

  // Build OData filter
  let filter = '';

  // Filter by agent (partition key)
  if (query.agent) {
    const agent = typeof query.agent === 'string' ? JSON.parse(query.agent) : query.agent;
    const partitionKey = getStatementPartitionKey(agent);
    filter = `PartitionKey eq '${partitionKey}'`;
  }

  // Filter by activity
  if (query.activity) {
    const activityId = typeof query.activity === 'string' ? query.activity : query.activity.id;
    if (filter) filter += ' and ';
    filter += `object eq '${activityId}'`;
  }

  // Filter by registration
  if (query.registration) {
    if (filter) filter += ' and ';
    filter += `registration eq '${query.registration}'`;
  }

  // Filter by verb
  if (query.verb) {
    const verbId = typeof query.verb === 'string' ? query.verb : query.verb.id;
    if (filter) filter += ' and ';
    filter += `verb eq '${verbId}'`;
  }

  try {
    const entities = [];
    const limit = parseInt(query.limit) || 10;
    const offset = parseInt(query.offset) || 0;

    // Query entities
    const listEntities = client.listEntities({
      queryOptions: {
        filter: filter || undefined
      }
    });

    let count = 0;
    for await (const entity of listEntities) {
      if (count >= offset + limit) break;
      if (count >= offset) {
        entities.push(JSON.parse(entity.statement));
      }
      count++;
    }

    return {
      status: 200,
      data: {
        statements: entities,
        more: count > offset + limit ? `${offset + limit}` : ''
      }
    };
  } catch (error) {
    console.error('[xAPI Azure] Query error:', error);
    throw error;
  }
}

/**
 * Get specific statement by ID
 */
export async function getStatement(statementId) {
  const client = getTableClient('STATEMENTS');

  // Try to find statement by scanning partitions (for production, consider secondary index)
  // For better performance, you might want to store statementId -> partitionKey mapping
  try {
    const rowKey = statementId.split('/').pop() || statementId;
    
    // Query across partitions (this is slower, but works)
    // In production, consider adding a lookup table or using Cosmos DB
    const listEntities = client.listEntities({
      queryOptions: {
        filter: `rowKey eq '${rowKey}'`
      }
    });

    for await (const entity of listEntities) {
      if (entity.statementId === statementId) {
        return {
          status: 200,
          data: JSON.parse(entity.statement)
        };
      }
    }

    return { status: 404, data: null };
  } catch (error) {
    console.error('[xAPI Azure] Get statement error:', error);
    return { status: 404, data: null };
  }
}

/**
 * Save activity state
 */
export async function saveState(activityId, agent, stateId, state, registration = null) {
  const client = getTableClient('STATE');
  
  const partitionKey = getStatePartitionKey(activityId, agent);
  const rowKey = `${stateId}${registration ? `|${registration}` : ''}`;

  const entity = {
    partitionKey,
    rowKey,
    activityId,
    agent: JSON.stringify(agent),
    stateId,
    state: JSON.stringify(state),
    registration: registration || null,
    updated: new Date().toISOString()
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));

  return { status: 204, data: null };
}

/**
 * Get activity state
 */
export async function getState(activityId, agent, stateId, registration = null) {
  const client = getTableClient('STATE');
  
  const partitionKey = getStatePartitionKey(activityId, agent);
  const rowKey = `${stateId}${registration ? `|${registration}` : ''}`;

  try {
    const entity = await client.getEntity(partitionKey, rowKey);
    if (!entity || !entity.state) {
      return { status: 404, data: null };
    }
    return {
      status: 200,
      data: JSON.parse(entity.state)
    };
  } catch (error) {
    // Azure Tables returns 404 for missing entities
    if (error.statusCode === 404 || error.code === 'ResourceNotFound') {
      return { status: 404, data: null };
    }
    console.error('[xAPI Azure] Get state error:', error);
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
      return { status: 204, data: null }; // Already deleted
    }
    throw error;
  }
}

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
    return {
      status: 200,
      data: JSON.parse(entity.profile)
    };
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
    return {
      status: 200,
      data: JSON.parse(entity.profile)
    };
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

