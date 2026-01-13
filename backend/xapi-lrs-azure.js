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
import * as verbTracker from './xapi-verb-tracker.js';

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
  // Only store columns that are used for filtering/queries
  // Removed: statementId (use rowKey), actor (in statement JSON), timestamp (in statement JSON), stored (in statement JSON)
  const entity = {
    partitionKey,
    rowKey,
    statement: JSON.stringify(statement), // Store full statement as JSON (contains all data)
    verb: statement.verb?.id || '', // Used for filtering
    object: statement.object?.id || '', // Used for filtering
    registration: statement.context?.registration || null // Used for filtering
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));

  // Track verb usage for statistics
  const actor = statement.actor;
  const activityId = statement.object?.id || '';
  const userEmail = actor.mbox ? actor.mbox.replace('mailto:', '') : 'unknown';
  const verbId = statement.verb?.id || '';
  
  if (verbId) {
    // Track verb usage (async, persists to Azure - don't await to avoid blocking)
    verbTracker.trackVerbUsage(verbId, userEmail, activityId).catch(err => {
      console.error(`[xAPI] Error tracking verb usage:`, err);
    });
    
    // Process custom verb handlers
    await verbTracker.processCustomVerb(statement, {
      userEmail,
      activityId,
      timestamp: statement.timestamp
    });
    
    // Log custom/unknown verbs for monitoring
    const verbConfig = verbTracker.getVerbConfig(verbId);
    if (verbConfig.isCustom || verbConfig.isUnknown) {
      console.log(`[xAPI Verb Tracker] Custom/Unknown verb: ${verbId}`);
      console.log(`[xAPI Verb Tracker] Category: ${verbConfig.category}, Action: ${verbConfig.action}`);
    }
  }

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
      // rowKey should match the statement ID (last part of UUID)
      // Also check the statement JSON to be sure
      const statement = JSON.parse(entity.statement);
      if (statement.id === statementId || entity.rowKey === rowKey) {
        return {
          status: 200,
          data: statement
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
 * For resume state, saves both with and without registration for cross-session resume
 */
export async function saveState(activityId, agent, stateId, state, registration = null) {
  const client = getTableClient('STATE');
  
  // Normalize agent to ensure consistent partition key
  const normalizedAgent = typeof agent === 'string' ? JSON.parse(agent) : agent;
  const partitionKey = getStatePartitionKey(activityId, normalizedAgent);
  
  console.log(`[xAPI Azure] Saving state - partitionKey: ${partitionKey}, stateId: ${stateId}, registration: ${registration || 'none'}, stateType: ${typeof state}`);
  
  // Storyline sends state as a string (proprietary encoded format), not JSON
  // Save it as-is - don't try to JSON.stringify it
  const stateString = typeof state === 'string' ? state : JSON.stringify(state);
  
  // For resume/bookmark state, save without registration for persistent resume
  // This allows resuming across different launch sessions (different registration IDs)
  if (stateId === 'resume' || stateId === 'bookmark') {
    // Save without registration (persistent resume)
    // Only store state data - other fields are in partitionKey/rowKey
    const entityWithoutReg = {
      partitionKey,
      rowKey: stateId, // Just the stateId, no registration
      state: stateString // Save as string (Storyline's format)
      // Removed: activityId (in partitionKey), agent (in partitionKey), 
      //          stateId (in rowKey), registration (not needed), updated (not used)
    };
    
    await retryOperation(() => client.upsertEntity(entityWithoutReg, 'Replace'));
    console.log(`[xAPI Azure] Saved resume state without registration for persistent resume`);
    
    // Also save with registration if provided (for session-specific state)
    if (registration) {
      const entityWithReg = {
        partitionKey,
        rowKey: `${stateId}|${registration}`,
        state: stateString // Save as string (Storyline's format)
        // Removed: activityId (in partitionKey), agent (in partitionKey), 
        //          stateId (in rowKey), registration (in rowKey), updated (not used)
      };
      
      await retryOperation(() => client.upsertEntity(entityWithReg, 'Replace'));
      console.log(`[xAPI Azure] Saved resume state with registration ${registration}`);
    }
    
    return { status: 204, data: null };
  }
  
  // For other state types, use registration if provided
  const rowKey = `${stateId}${registration ? `|${registration}` : ''}`;

  const entity = {
    partitionKey,
    rowKey,
    state: stateString // Save as string (Storyline's format)
    // Removed: activityId (in partitionKey), agent (in partitionKey), 
    //          stateId (in rowKey), registration (in rowKey), updated (not used)
  };

  await retryOperation(() => client.upsertEntity(entity, 'Replace'));

  return { status: 204, data: null };
}

/**
 * Get activity state
 * For resume state, tries without registration first (since registration changes per launch)
 */
export async function getState(activityId, agent, stateId, registration = null) {
  const client = getTableClient('STATE');
  
  // Normalize agent to ensure consistent partition key
  const normalizedAgent = typeof agent === 'string' ? JSON.parse(agent) : agent;
  const partitionKey = getStatePartitionKey(activityId, normalizedAgent);
  
  console.log(`[xAPI Azure] Getting state - partitionKey: ${partitionKey}, stateId: ${stateId}, registration: ${registration || 'none'}`);
  
  // For resume state, try without registration first (registration changes per launch)
  // This allows resuming across different launch sessions
  if (stateId === 'resume' || stateId === 'bookmark') {
    // First try: without registration (persistent resume state)
    try {
      const rowKeyWithoutReg = stateId;
      const entity = await client.getEntity(partitionKey, rowKeyWithoutReg);
      if (entity && entity.state) {
        // Storyline state is stored as a string (proprietary format), return as-is
        // Don't try to parse as JSON - it's not JSON
        console.log(`[xAPI Azure] Found resume state without registration (${entity.state.length} chars)`);
        return {
          status: 200,
          data: entity.state // Return as string, not parsed
        };
      }
    } catch (error) {
      // Not found without registration, continue to try with registration
      if (error.statusCode !== 404 && error.code !== 'ResourceNotFound') {
        console.error('[xAPI Azure] Error getting state without registration:', error);
      }
    }
    
    // Second try: with registration (session-specific state)
    if (registration) {
      try {
        const rowKeyWithReg = `${stateId}|${registration}`;
        const entity = await client.getEntity(partitionKey, rowKeyWithReg);
        if (entity && entity.state) {
          console.log(`[xAPI Azure] Found resume state with registration ${registration} (${entity.state.length} chars)`);
          return {
            status: 200,
            data: entity.state // Return as string, not parsed
          };
        }
      } catch (error) {
        if (error.statusCode !== 404 && error.code !== 'ResourceNotFound') {
          console.error('[xAPI Azure] Error getting state with registration:', error);
        }
      }
    }
    
    // Not found
    return { status: 404, data: null };
  }
  
  // For other state types, use registration if provided
  const rowKey = `${stateId}${registration ? `|${registration}` : ''}`;

  try {
    const entity = await client.getEntity(partitionKey, rowKey);
    if (!entity || !entity.state) {
      return { status: 404, data: null };
    }
    // Return state as string (Storyline's format), not parsed as JSON
    return {
      status: 200,
      data: entity.state
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

