import axios from 'axios';

const LRS_ENDPOINT = process.env.LRS_ENDPOINT;
const LRS_KEY = process.env.LRS_KEY;
const LRS_SECRET = process.env.LRS_SECRET;

if (!LRS_ENDPOINT || !LRS_KEY || !LRS_SECRET) {
  console.warn('LRS configuration incomplete. Progress queries will fail.');
}

const LRS_AUTH = LRS_KEY && LRS_SECRET
  ? Buffer.from(`${LRS_KEY}:${LRS_SECRET}`).toString('base64')
  : null;

export async function getLearnerProgress(userId, activityId) {
  if (!LRS_ENDPOINT || !LRS_AUTH) {
    return {
      completionStatus: 'unknown',
      score: null,
      timeSpent: null,
      statements: [],
    };
  }

  try {
    // Query LRS for statements related to this learner and activity
    const agent = {
      mbox: `mailto:${userId}@lms.local`, // Using userId as email identifier
      objectType: 'Agent',
    };

    const params = {
      agent: JSON.stringify(agent),
      activity: activityId,
      related_activities: true,
      limit: 100,
    };

    const response = await axios.get(`${LRS_ENDPOINT}/statements`, {
      params,
      headers: {
        Authorization: `Basic ${LRS_AUTH}`,
        'X-Experience-API-Version': '1.0.3',
      },
    });

    const statements = response.data.statements || [];

    // Process statements to extract progress information
    const completionStatus = determineCompletionStatus(statements);
    const score = extractScore(statements);
    const timeSpent = calculateTimeSpent(statements);

    return {
      completionStatus,
      score,
      timeSpent,
      statements,
    };
  } catch (error) {
    console.error('LRS query error:', error.message);
    return {
      completionStatus: 'unknown',
      score: null,
      timeSpent: null,
      statements: [],
      error: error.message,
    };
  }
}

function determineCompletionStatus(statements) {
  // Check for completed verb
  const completed = statements.some(
    (s) => s.verb?.id === 'http://adlnet.gov/expapi/verbs/completed'
  );

  // Check for passed/failed
  const passed = statements.some(
    (s) => s.verb?.id === 'http://adlnet.gov/expapi/verbs/passed'
  );
  const failed = statements.some(
    (s) => s.verb?.id === 'http://adlnet.gov/expapi/verbs/failed'
  );

  // Check for attempted (any interaction)
  const attempted = statements.length > 0;

  if (completed) {
    if (passed) return 'passed';
    if (failed) return 'failed';
    return 'completed';
  }

  if (attempted) return 'in_progress';

  return 'not_started';
}

function extractScore(statements) {
  // Look for statements with result.score
  for (const statement of statements) {
    if (statement.result?.score) {
      const raw = statement.result.score.raw;
      const max = statement.result.score.max;
      if (raw !== undefined && max !== undefined) {
        return Math.round((raw / max) * 100);
      }
      if (raw !== undefined) {
        return raw;
      }
    }
  }
  return null;
}

function calculateTimeSpent(statements) {
  if (statements.length === 0) return 0;

  // Sort by timestamp
  const sorted = [...statements].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  const first = new Date(sorted[0].timestamp);
  const last = new Date(sorted[sorted.length - 1].timestamp);

  // Calculate duration in seconds
  const durationSeconds = Math.floor((last - first) / 1000);

  // Format as HH:MM:SS
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}


