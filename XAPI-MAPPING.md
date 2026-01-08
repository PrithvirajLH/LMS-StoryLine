# xAPI Statement Mapping Documentation

This document describes how xAPI statements are mapped and processed in the LMS system.

## Table of Contents
1. [xAPI Statement Structure → Azure Table Storage](#1-xapi-statement-structure--azure-table-storage)
2. [xAPI Verbs → Completion Status Mapping](#2-xapi-verbs--completion-status-mapping)
3. [xAPI Statements → Progress Calculation](#3-xapi-statements--progress-calculation)
4. [xAPI Activity ID Mapping](#4-xapi-activity-id-mapping)
5. [User Identification Mapping](#5-user-identification-mapping)
6. [Complete Flow Diagram](#6-complete-flow-diagram)
7. [Key Files & Functions](#7-key-files--functions)
8. [Query Patterns](#8-query-patterns)
9. [Special Cases](#9-special-cases)
10. [Azure Table Schema](#10-azure-table-schema)
11. [API Endpoints](#11-api-endpoints)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. xAPI Statement Structure → Azure Table Storage

### Statement JSON Structure
```json
{
  "actor": {
    "objectType": "Agent",
    "mbox": "mailto:user@example.com"
  },
  "verb": {
    "id": "http://adlnet.gov/expapi/verbs/completed",
    "display": { "en-US": "completed" }
  },
  "object": {
    "objectType": "Activity",
    "id": "urn:articulate:storyline:5Ujw93Dh98n/6BnvowJ1urM",
    "definition": { "name": { "en-US": "Course Name" } }
  },
  "result": {
    "score": {
      "raw": 85,
      "max": 100,
      "min": 0,
      "scaled": 0.85
    },
    "success": true,
    "completion": true
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "stored": "2024-01-15T10:30:05Z",
  "id": "http://lms.example.com/statements/uuid-here"
}
```

### Storage Mapping
**Table**: `STATEMENTS` (Azure Table Storage)

| xAPI Field | Azure Table Column | Extraction Logic |
|------------|-------------------|------------------|
| `actor.mbox` | `PartitionKey` | Extract email from `mailto:email@example.com` |
| `id` | `RowKey` | Use statement UUID (last part of ID) |
| Full statement | `statement` | JSON.stringify(entire statement) |
| `verb.id` | `verb` | Used for filtering queries |
| `object.id` | `object` | Used for filtering queries |
| `context.registration` | `registration` | Registration UUID if present |

**Storage Entity Example:**
```
PartitionKey: "user@example.com"
RowKey: "a97ef3be-1554-4517-a350-2a77ecb25b70"
statement: '{"actor":{...},"verb":{...},"object":{...}}'
verb: "http://adlnet.gov/expapi/verbs/completed"
object: "urn:articulate:storyline:5Ujw93Dh98n/6BnvowJ1urM"
registration: "550e8400-e29b-41d4-a716-446655440000"
```

---

## 2. xAPI Verbs → Completion Status Mapping

| xAPI Verb ID | Mapped To | Description | Sets startedAt | Sets completedAt |
|-------------|-----------|-------------|----------------|------------------|
| `http://adlnet.gov/expapi/verbs/initialized` | `completionStatus: 'in_progress'` | Course started | ✅ Yes | ❌ No |
| `http://adlnet.gov/expapi/verbs/launched` | `completionStatus: 'in_progress'` | Course launched | ✅ Yes | ❌ No |
| `http://adlnet.gov/expapi/verbs/completed` | `completionStatus: 'completed'` | Course completed | ✅ Yes (if not set) | ✅ Yes |
| `http://adlnet.gov/expapi/verbs/passed` | `completionStatus: 'passed'` | Course passed with score | ✅ Yes (if not set) | ✅ Yes |
| Any verb containing `"completed"` | `completionStatus: 'completed'` | Generic completion | ✅ Yes (if not set) | ✅ Yes |
| Any verb containing `"passed"` | `completionStatus: 'passed'` | Generic pass | ✅ Yes (if not set) | ✅ Yes |

**Default Status**: `'not_started'` (if no statements found)

---

## 3. xAPI Statements → Progress Calculation

### Location
`backend/progress-storage.js` → `calculateProgressFromStatements()`

### A. Completion Status Detection

```javascript
// Step 1: Find initial statement (course started)
const initialStatement = statements.find(s => 
  s.verb?.id === 'http://adlnet.gov/expapi/verbs/initialized' ||
  s.verb?.id === 'http://adlnet.gov/expapi/verbs/launched'
);
if (initialStatement) {
  completionStatus = 'in_progress';
  startedAt = initialStatement.timestamp || initialStatement.stored;
}

// Step 2: Find completion statement
const completedStatement = statements.find(s => {
  const verbId = s.verb?.id || '';
  return verbId === 'http://adlnet.gov/expapi/verbs/completed' ||
         verbId === 'http://adlnet.gov/expapi/verbs/passed' ||
         verbId.includes('completed') ||
         verbId.includes('passed');
});
if (completedStatement) {
  completionStatus = verbId.includes('passed') ? 'passed' : 'completed';
  completedAt = completedStatement.timestamp || completedStatement.stored;
}
```

### B. Score Extraction

**Priority Order:**
1. **Scaled Score** (0-1): `result.score.scaled` → Multiply by 100
2. **Raw/Max Calculation**: `result.score.raw / result.score.max` → Calculate percentage
3. **Raw Score**: `result.score.raw` → Assume already percentage if max not provided

```javascript
if (completedStatement.result?.score) {
  const rawScore = completedStatement.result.score.raw;
  const scaledScore = completedStatement.result.score.scaled;
  const maxScore = completedStatement.result.score.max;
  
  if (scaledScore !== undefined && scaledScore !== null) {
    score = Math.round(scaledScore * 100);  // 0.85 → 85%
  } else if (rawScore !== undefined && maxScore !== undefined) {
    score = Math.round((rawScore / maxScore) * 100);  // 85/100 → 85%
  } else if (rawScore !== undefined) {
    score = rawScore;  // Assume already percentage
  }
}
```

### C. Time Spent Calculation

**Algorithm:**
1. Sort all statements by timestamp (ascending)
2. Calculate time gaps between consecutive statements
3. Sum gaps ≤ 300 seconds (5 minutes) = active engagement time
4. Exclude gaps > 300 seconds (user likely left and returned)

```javascript
const sortedStatements = statements.sort((a, b) => {
  const timeA = new Date(a.timestamp || a.stored).getTime();
  const timeB = new Date(b.timestamp || b.stored).getTime();
  return timeA - timeB;
});

const MAX_GAP_SECONDS = 300; // 5 minutes
let totalActiveTime = 0;

for (let i = 0; i < sortedStatements.length - 1; i++) {
  const currentTime = new Date(sortedStatements[i].timestamp).getTime();
  const nextTime = new Date(sortedStatements[i + 1].timestamp).getTime();
  const gapSeconds = Math.floor((nextTime - currentTime) / 1000);
  
  if (gapSeconds > 0 && gapSeconds <= MAX_GAP_SECONDS) {
    totalActiveTime += gapSeconds;
  }
  // Gaps > 300s are excluded (user left and came back)
}

timeSpent = totalActiveTime; // in seconds
```

**Edge Cases:**
- **Single statement**: `timeSpent = 1` second (minimum)
- **No active time calculated**: Estimate from statement count (1 second per statement)

### D. Progress Percentage Calculation

```javascript
let progressPercent = 0;

if (completionStatus === 'completed' || completionStatus === 'passed') {
  progressPercent = 100;
} else if (completionStatus === 'in_progress') {
  // Estimate based on statement count
  // Assumes course has ~50-100 statements for completion
  const statementCount = statements.length;
  progressPercent = Math.min(95, Math.round((statementCount / 80) * 100));
}
```

**Example:**
- 10 statements → ~12% progress
- 40 statements → ~50% progress
- 80+ statements → 95% progress (max until completion)

---

## 4. xAPI Activity ID Mapping

### Problem
Storyline courses send extended activity IDs in statements:
- **Statement Object ID**: `urn:articulate:storyline:5Ujw93Dh98n/6BnvowJ1urM`
- **Course Activity ID**: `urn:articulate:storyline:5Ujw93Dh98n`

The `/6BnvowJ1urM` suffix represents a specific slide/module within the course.

### Solution
**Function**: `extractBaseActivityId()` in `backend/server.js`

```javascript
function extractBaseActivityId(activityId) {
  if (!activityId) return null;
  const slashIndex = activityId.indexOf('/');
  return slashIndex > 0 
    ? activityId.substring(0, slashIndex)  // Base ID
    : activityId;                          // Already base ID
}
```

**Course Matching Logic** (in `findCourseByActivityId()`):
1. **Exact match**: Direct match with course.activityId
2. **Base match**: Match extracted base activity ID
3. **Prefix match**: Statement ID starts with course activity ID + '/'

**Example:**
```javascript
Statement: "urn:articulate:storyline:5Ujw93Dh98n/6BnvowJ1urM"
  ↓ extractBaseActivityId()
Base ID: "urn:articulate:storyline:5Ujw93Dh98n"
  ↓ findCourseByActivityId()
Course Found: { courseId: "sharepoint-101", activityId: "urn:articulate:storyline:5Ujw93Dh98n" }
```

---

## 5. User Identification Mapping

### Actor → User Email Mapping

```
xAPI Statement
  └── actor.mbox: "mailto:user@example.com"
      ↓
Extract Email: "user@example.com"
      ↓
Use as userId in USER_PROGRESS table (PartitionKey)
```

### Normalization Logic

```javascript
// From statement
const actor = statement.actor;
const userEmail = actor.mbox 
  ? actor.mbox.replace('mailto:', '')  // Extract email
  : null;

// For querying (normalize format)
const normalizedEmail = userId.includes('@') 
  ? userId                                    // Already email
  : `${userId}@example.com`;                  // Fallback for old data
```

**Query Format:**
```javascript
xapiLRS.queryStatements({
  agent: {
    objectType: 'Agent',
    mbox: `mailto:${userEmail}`  // Must include "mailto:" prefix
  },
  activity: activityId,
  limit: 1000
});
```

---

## 6. Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Storyline Course Sends xAPI Statement                       │
│    POST /xapi/statements                                       │
│    { actor: {...}, verb: {...}, object: {...}, result: {...} } │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. server.js: /xapi/statements Endpoint                        │
│    - Extract actor.mbox → userEmail                            │
│    - Extract object.id → activityId                            │
│    - Find course using findCourseByActivityId()                │
│    - Handle extended activity IDs                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. xapiLRS.saveStatement()                                     │
│    - Validate statement structure                              │
│    - Generate ID if missing                                    │
│    - Add timestamps (stored, timestamp)                        │
│    - Extract PartitionKey from actor.mbox                      │
│    - Create RowKey from statement.id                           │
│    - Store in Azure Table: STATEMENTS                          │
│      * PartitionKey: userEmail                                 │
│      * RowKey: statement UUID                                  │
│      * statement: Full JSON string                             │
│      * verb: Verb ID (for filtering)                           │
│      * object: Activity ID (for filtering)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Auto-Sync Progress (Background - Non-Blocking)              │
│    progressStorage.syncProgressFromStatements()                │
│    - Triggered automatically after statement save              │
│    - Runs asynchronously (doesn't block response)              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. calculateProgressFromStatements()                           │
│    a) Query all statements for user + course                   │
│       xapiLRS.queryStatements({ agent, activity })             │
│    b) Analyze statements:                                      │
│       - Find initialized/launched → startedAt                  │
│       - Find completed/passed → completedAt, score             │
│       - Calculate timeSpent from timestamps                    │
│       - Calculate progressPercent                              │
│    c) Return calculated progress object                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Update USER_PROGRESS Table                                  │
│    progressStorage.updateProgress()                            │
│    - completionStatus: 'not_started' | 'in_progress' |         │
│                        'completed' | 'passed'                  │
│    - score: 0-100 (percentage)                                 │
│    - timeSpent: seconds                                        │
│    - progressPercent: 0-100                                    │
│    - startedAt: ISO timestamp                                  │
│    - completedAt: ISO timestamp (if completed)                 │
│    - lastAccessedAt: Updated on each sync                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Return Success Response to Course                           │
│    HTTP 200: { status: 200, data: [statement.id] }             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Key Files & Functions

### Backend Files

| File | Key Functions | Purpose |
|------|---------------|---------|
| `backend/xapi-lrs-azure.js` | `saveStatement()` | Store xAPI statement in Azure Tables |
| `backend/xapi-lrs-azure.js` | `queryStatements()` | Query statements by user/activity/verb/registration |
| `backend/xapi-lrs-azure.js` | `getStatement()` | Get specific statement by ID |
| `backend/progress-storage.js` | `calculateProgressFromStatements()` | Map xAPI statements → progress data |
| `backend/progress-storage.js` | `syncProgressFromStatements()` | Sync calculated progress to USER_PROGRESS table |
| `backend/progress-storage.js` | `updateProgress()` | Update progress record with calculated values |
| `backend/server.js` | `extractBaseActivityId()` | Extract base activity ID from extended ID |
| `backend/server.js` | `findCourseByActivityId()` | Match statement activity ID to course record |
| `backend/server.js` | `POST /xapi/statements` | Receive and process xAPI statements |

### Function Signatures

```javascript
// Save statement
async function saveStatement(statement)
  → Returns: { status: 200, data: [statement.id] }

// Query statements
async function queryStatements({
  agent: { objectType: 'Agent', mbox: 'mailto:...' },
  activity: 'activity-id',
  verb: 'verb-id',  // optional
  registration: 'uuid',  // optional
  limit: 1000,
  offset: 0
})
  → Returns: { status: 200, data: { statements: [...], more: '...' } }

// Calculate progress from statements
async function calculateProgressFromStatements(userId, courseId, activityId)
  → Returns: {
      completionStatus: 'in_progress' | 'completed' | 'passed',
      score: 0-100 | null,
      timeSpent: number (seconds),
      progressPercent: 0-100,
      startedAt: ISO timestamp | null,
      completedAt: ISO timestamp | null
    }

// Sync progress
async function syncProgressFromStatements(userId, courseId, activityId)
  → Calls calculateProgressFromStatements()
  → Updates USER_PROGRESS table
  → Returns: Progress object or null
```

---

## 8. Query Patterns

### Query Statements for User + Course
```javascript
const result = await xapiLRS.queryStatements({
  agent: {
    objectType: 'Agent',
    mbox: 'mailto:user@example.com'
  },
  activity: 'urn:articulate:storyline:5Ujw93Dh98n',
  limit: 1000
});

// Result structure:
{
  status: 200,
  data: {
    statements: [
      {
        id: 'http://...',
        actor: { mbox: 'mailto:user@example.com' },
        verb: { id: 'http://adlnet.gov/expapi/verbs/completed' },
        object: { id: 'urn:articulate:storyline:...' },
        result: { score: { scaled: 0.85 } },
        timestamp: '2024-01-15T10:30:00Z'
      },
      // ... more statements
    ],
    more: '' // Pagination token if more results exist
  }
}
```

### Query by Verb
```javascript
// Find all completion statements
const result = await xapiLRS.queryStatements({
  agent: { objectType: 'Agent', mbox: 'mailto:user@example.com' },
  verb: 'http://adlnet.gov/expapi/verbs/completed',
  limit: 100
});
```

### Query by Registration
```javascript
// Find statements for specific launch session
const result = await xapiLRS.queryStatements({
  agent: { objectType: 'Agent', mbox: 'mailto:user@example.com' },
  activity: 'urn:articulate:storyline:5Ujw93Dh98n',
  registration: '550e8400-e29b-41d4-a716-446655440000',
  limit: 1000
});
```

---

## 9. Special Cases

### 9.1 Extended Activity IDs
**Problem**: Storyline sends extended IDs like `baseId/subId`  
**Solution**: Extract base ID before matching to course

### 9.2 Missing startedAt
**Problem**: Old progress records may not have `startedAt`  
**Solution**: Infer from `enrolledAt` if progress exists but `startedAt` is null

```javascript
// In updateProgress()
if (!updated.startedAt) {
  const hasProgress = (updated.progressPercent > 0) || 
                     (updated.timeSpent > 0) ||
                     (updated.completionStatus !== 'not_started');
  if (hasProgress) {
    updated.startedAt = updated.enrolledAt || new Date().toISOString();
  }
}
```

### 9.3 Large Time Gaps
**Problem**: User leaves course and returns later  
**Solution**: Exclude gaps > 5 minutes from timeSpent calculation

```javascript
const MAX_GAP_SECONDS = 300; // 5 minutes
if (gapSeconds > MAX_GAP_SECONDS) {
  // Don't count this gap - user left and came back
}
```

### 9.4 Score Format Variations
**Problem**: Different xAPI implementations use different score formats  
**Solution**: Handle multiple formats with priority order

```javascript
// Priority: scaled > raw/max > raw
if (scaledScore !== undefined) {
  score = scaledScore * 100;
} else if (rawScore && maxScore) {
  score = (rawScore / maxScore) * 100;
} else if (rawScore) {
  score = rawScore; // Assume percentage
}
```

### 9.5 Single Statement
**Problem**: Only one statement exists (course just started)  
**Solution**: Set minimum timeSpent = 1 second

```javascript
if (sortedStatements.length === 1) {
  timeSpent = 1; // Minimum 1 second
}
```

### 9.6 Empty Statements Result
**Problem**: No statements found for user/course  
**Solution**: Return `null` (no progress to sync)

```javascript
if (statements.length === 0) {
  return null; // No progress data
}
```

---

## 10. Azure Table Schema

### STATEMENTS Table
**Purpose**: Store all xAPI statements

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `PartitionKey` | String | User email | `user@example.com` |
| `RowKey` | String | Statement UUID | `a97ef3be-1554-4517-a350-2a77ecb25b70` |
| `statement` | String | Full statement JSON | `{"actor":{...},"verb":{...}}` |
| `verb` | String | Verb ID (for filtering) | `http://adlnet.gov/expapi/verbs/completed` |
| `object` | String | Activity ID (for filtering) | `urn:articulate:storyline:5Ujw93Dh98n` |
| `registration` | String | Registration UUID (nullable) | `550e8400-e29b-41d4-a716-446655440000` |

**Query Efficiency:**
- ✅ Fast: By PartitionKey (user email)
- ⚠️ Slower: By object/verb/registration (requires table scan)

### USER_PROGRESS Table
**Purpose**: Store calculated progress from statements

| Column | Type | Description |
|--------|------|-------------|
| `PartitionKey` | String | User ID (email) |
| `RowKey` | String | Course ID |
| `completionStatus` | String | `'not_started'`, `'in_progress'`, `'completed'`, `'passed'` |
| `score` | Number | 0-100 (percentage) |
| `progressPercent` | Number | 0-100 (estimated completion) |
| `timeSpent` | Number | Seconds spent in course |
| `startedAt` | DateTime | When course was first started |
| `completedAt` | DateTime | When course was completed |
| `enrolledAt` | DateTime | When user enrolled |
| `lastAccessedAt` | DateTime | Last time progress was updated |

---

## 11. API Endpoints

### POST /xapi/statements
**Purpose**: Store xAPI statement(s)

**Request:**
```json
{
  "actor": { "mbox": "mailto:user@example.com" },
  "verb": { "id": "http://adlnet.gov/expapi/verbs/completed" },
  "object": { "id": "urn:articulate:storyline:5Ujw93Dh98n" },
  "result": { "score": { "scaled": 0.85 } },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "status": 200,
  "data": ["http://lms.example.com/statements/uuid-here"]
}
```

**Side Effects:**
- Statement saved to `STATEMENTS` table
- Progress automatically synced (background)
- `USER_PROGRESS` table updated

### GET /xapi/statements
**Purpose**: Query statements

**Query Parameters:**
- `agent`: JSON string of agent object
- `activity`: Activity ID
- `verb`: Verb ID
- `registration`: Registration UUID
- `limit`: Maximum results (default: 10)
- `offset`: Pagination offset

**Response:**
```json
{
  "status": 200,
  "data": {
    "statements": [ /* array of statement objects */ ],
    "more": "" // Pagination token if more results
  }
}
```

---

## 12. Troubleshooting

### Issue: Started dates missing
**Cause**: `startedAt` not set in USER_PROGRESS  
**Solution**: Logic now infers from `enrolledAt` if missing

### Issue: Progress not updating
**Cause**: Course not found by activity ID  
**Solution**: Check `findCourseByActivityId()` handles extended IDs

### Issue: Time spent seems incorrect
**Cause**: Large gaps included in calculation  
**Solution**: Gaps > 5 minutes are now excluded

### Issue: Score not appearing
**Cause**: Score format not recognized  
**Solution**: Check `result.score.scaled` or `result.score.raw/max`

### Issue: Statements not saving
**Cause**: Invalid statement structure  
**Solution**: Check logs for validation errors

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2024-01-15 | 1.0 | Initial documentation |
| 2024-01-16 | 1.1 | Added startedAt inference logic |
| 2024-01-17 | 1.2 | Added troubleshooting section |

---

**Document Version**: 1.2  
**Last Updated**: 2024-01-17  
**Author**: LMS Development Team

