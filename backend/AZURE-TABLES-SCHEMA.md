# Azure Table Storage Schema Documentation

This document explains all tables and their structure in the Azure Storage Account.

## Overview

The LMS uses **Azure Table Storage** for scalable, production-grade data storage. Tables are organized with **Partition Keys** and **Row Keys** for efficient querying.

**Total Tables: 7**

---

## Table 1: `Users`

**Purpose**: Stores user accounts, authentication data, and user profiles.

### Structure

| Column | Type | Description |
|--------|------|-------------|
| `PartitionKey` | String | Always "user" (single partition for all users) |
| `RowKey` | String | User email (normalized to lowercase) - used as unique identifier |
| `userId` | String | User ID (can be email or numeric ID) |
| `email` | String | User email address (unique) |
| `name` | String | User's full name |
| `password` | String | Hashed password (bcrypt) |
| `role` | String | User role: "admin" or "learner" |
| `createdAt` | DateTime | When user account was created |
| `updatedAt` | DateTime | Last update timestamp |

### Example Data

```
PartitionKey: "user"
RowKey: "admin@example.com"
userId: "1" (or email)
email: "admin@example.com"
name: "Admin User"
password: "$2b$10$..." (bcrypt hash)
role: "admin"
createdAt: 2024-01-10T08:00:00Z
updatedAt: 2024-01-15T12:00:00Z
```

### Query Patterns
- **By Email**: Get entity by RowKey (email)
- **By User ID**: Query by userId field (requires table scan or index)
- **All Users**: List all entities (single partition)

### Notes
- **Default Admin**: Automatically created on first startup
  - Email: `admin@example.com`
  - Password: `admin123`
  - Role: `admin`
- **Password Security**: Passwords are hashed using bcrypt (10 rounds)
- **Email Normalization**: All emails are stored in lowercase

---

## Table 2: `xapiStatements`

**Purpose**: Stores all xAPI (TinCan) statements from course interactions.

### Structure

| Column | Type | Description |
|--------|------|-------------|
| `PartitionKey` | String | User email (extracted from actor.mbox) - enables efficient querying by learner |
| `RowKey` | String | Statement ID (UUID) - unique identifier for each statement |
| `statement` | String | Full xAPI statement as JSON string |
| `timestamp` | DateTime | When the statement was created/stored |
| `verb` | String | xAPI verb ID (e.g., "http://adlnet.gov/expapi/verbs/completed") |
| `activityId` | String | Course activity ID (e.g., "urn:articulate:storyline:5Ujw93Dh98n") |

### Example Data

```
PartitionKey: "admin@example.com"
RowKey: "a97ef3be-1554-4517-a350-2a77ecb25b70"
statement: '{"actor":{"mbox":"mailto:admin@example.com",...},"verb":{...},"object":{...}}'
timestamp: 2024-01-15T10:30:00Z
verb: "http://adlnet.gov/expapi/verbs/initialized"
activityId: "urn:articulate:storyline:5Ujw93Dh98n"
```

### Query Patterns
- **By User**: Query by PartitionKey (user email)
- **By Course**: Query by activityId (requires scanning or secondary index)
- **By Verb**: Query by verb field (e.g., find all "completed" statements)

---

## Table 3: `xapiState`

**Purpose**: Stores resume/bookmark data for courses (allows users to resume where they left off).

### Structure

| Column | Type | Description |
|--------|------|-------------|
| `PartitionKey` | String | Combination of activityId and user email hash - groups state by course and user |
| `RowKey` | String | State ID (e.g., "resume", "bookmark", custom state name) |
| `state` | String | State data as JSON string |
| `contentType` | String | MIME type of state data (usually "application/json") |
| `etag` | String | Entity tag for optimistic concurrency |

### Example Data

```
PartitionKey: "urn:articulate:storyline:5Ujw93Dh98n|admin@example.com"
RowKey: "resume"
state: '{"slideIndex":5,"progress":0.45,"lastSlide":"slide-5"}'
contentType: "application/json"
```

### Query Patterns
- **Get Resume State**: Query by PartitionKey and RowKey="resume"
- **All States for User/Course**: Query by PartitionKey

---

## Table 4: `xapiActivityProfiles`

**Purpose**: Stores activity-specific profile data (course-level settings/preferences).

### Structure

| Column | Type | Description |
|--------|------|-------------|
| `PartitionKey` | String | Activity ID (course identifier) |
| `RowKey` | String | Profile ID (profile name/key) |
| `profile` | String | Profile data as JSON string |
| `contentType` | String | MIME type (usually "application/json") |

### Example Data

```
PartitionKey: "urn:articulate:storyline:5Ujw93Dh98n"
RowKey: "preferences"
profile: '{"theme":"dark","autoplay":true}'
contentType: "application/json"
```

---

## Table 5: `xapiAgentProfiles`

**Purpose**: Stores user-specific profile data (learner preferences/settings).

### Structure

| Column | Type | Description |
|--------|------|-------------|
| `PartitionKey` | String | User email (from agent.mbox) |
| `RowKey` | String | Profile ID (profile name/key) |
| `profile` | String | Profile data as JSON string |
| `contentType` | String | MIME type (usually "application/json") |

### Example Data

```
PartitionKey: "admin@example.com"
RowKey: "preferences"
profile: '{"language":"en","notifications":true}'
contentType: "application/json"
```

---

## Table 6: `Courses`

**Purpose**: Stores course catalog information (course metadata, configuration).

### Structure

| Column | Type | Description |
|--------|------|-------------|
| `PartitionKey` | String | Always "courses" (single partition for all courses) |
| `RowKey` | String | Course ID (slugified course title, e.g., "sharepoint-navigation-101") |
| `courseId` | String | Same as RowKey (for convenience) |
| `title` | String | Course title |
| `description` | String | Course description |
| `thumbnailUrl` | String | URL/path to course thumbnail image |
| `activityId` | String | xAPI activity ID (from tincan.xml) |
| `launchFile` | String | Main HTML file to launch (usually "index_lms.html") |
| `coursePath` | String | Folder path in blob storage (e.g., "sharepoint-navigation-101-custom") |
| `modules` | String | JSON array of course modules (stored as string) |
| `createdAt` | DateTime | When course was created |
| `updatedAt` | DateTime | Last update timestamp |

### Example Data

```
PartitionKey: "courses"
RowKey: "sharepoint-navigation-101"
courseId: "sharepoint-navigation-101"
title: "SharePoint Navigation 101 - Custom"
description: "Learn how to navigate SharePoint"
thumbnailUrl: "/course/sharepoint-navigation-101-custom/mobile/poster.jpg"
activityId: "urn:articulate:storyline:5Ujw93Dh98n"
launchFile: "index_lms.html"
coursePath: "sharepoint-navigation-101-custom"
modules: '[{"id":"module1","title":"Introduction"}]'
createdAt: 2024-01-10T08:00:00Z
updatedAt: 2024-01-15T12:00:00Z
```

### Query Patterns
- **All Courses**: Query all entities (single partition)
- **By Course ID**: Get entity by RowKey

---

## Table 7: `UserProgress`

**Purpose**: Tracks user enrollment, completion status, scores, and time spent for each course.

### Structure

| Column | Type | Description |
|--------|------|-------------|
| `PartitionKey` | String | User ID (from JWT token: userId) - enables efficient querying by learner |
| `RowKey` | String | Course ID - identifies which course this progress is for |
| `userId` | String | Same as PartitionKey (for convenience) |
| `courseId` | String | Same as RowKey (for convenience) |
| `enrollmentStatus` | String | Status: "not_enrolled", "enrolled", "in_progress" |
| `completionStatus` | String | Status: "not_started", "in_progress", "completed", "passed", "failed" |
| `score` | Number | Final score (0-100 or scaled 0-1) - null if not available |
| `timeSpent` | Number | Time spent in seconds - calculated from statement timestamps |
| `enrolledAt` | DateTime | When user enrolled in the course |
| `startedAt` | DateTime | When user first started the course |
| `completedAt` | DateTime | When user completed the course (null if not completed) |
| `lastAccessedAt` | DateTime | Last time user accessed the course |
| `updatedAt` | DateTime | Last update timestamp |

### Example Data

```
PartitionKey: "1"  (or "admin@example.com" if using email as userId)
RowKey: "sharepoint-navigation-101"
userId: "1"
courseId: "sharepoint-navigation-101"
enrollmentStatus: "enrolled"
completionStatus: "in_progress"
score: null
timeSpent: 1800  (30 minutes in seconds)
enrolledAt: 2024-01-15T09:00:00Z
startedAt: 2024-01-15T09:05:00Z
completedAt: null
lastAccessedAt: 2024-01-15T10:30:00Z
updatedAt: 2024-01-15T10:30:00Z
```

### Query Patterns
- **User's All Progress**: Query by PartitionKey (userId) - gets all courses for a user
- **Course Progress**: Query by RowKey (courseId) - gets all users for a course
- **Specific User/Course**: Get entity by PartitionKey + RowKey

### Why "2" and "2@example.com"?

The `PartitionKey` in `UserProgress` is the `userId` from the JWT token. If a user's ID is "2", the PartitionKey will be "2". The email "2@example.com" is a fallback generated when the userId doesn't contain an "@" symbol.

**To fix this**, ensure users have proper email addresses in their JWT tokens, or update the progress storage to use email as PartitionKey consistently.

---

## Partition Key Strategy

### Why Partition Keys Matter

Partition Keys determine how data is distributed and queried:

1. **Users**: Single partition **"user"** - all users together (small dataset, typically < 15K users)
2. **xapiStatements**: Partitioned by **user email** - all statements for a user are in one partition
3. **xapiState**: Partitioned by **activityId + user** - groups state by course and user
4. **xapiActivityProfiles**: Partitioned by **activityId** - all profiles for a course together
5. **xapiAgentProfiles**: Partitioned by **user email** - all profiles for a user together
6. **Courses**: Single partition **"courses"** - all courses together (small dataset)
7. **UserProgress**: Partitioned by **user email** (after migration) - all progress for a user in one partition

### Benefits

- **Efficient Queries**: Querying by PartitionKey is fast (single partition scan)
- **Scalability**: Data is distributed across partitions
- **Performance**: Azure optimizes queries within a partition

---

## Row Key Strategy

Row Keys are unique identifiers within a partition:

- **Users**: Email address (normalized to lowercase)
- **xapiStatements**: UUID (statement ID)
- **xapiState**: State name (e.g., "resume")
- **xapiActivityProfiles**: Profile key (e.g., "preferences")
- **xapiAgentProfiles**: Profile key (e.g., "preferences")
- **Courses**: Course ID (slugified title)
- **UserProgress**: Course ID

---

## Data Types

Azure Table Storage supports:
- **String**: Text data
- **Number**: Integer or floating-point
- **Boolean**: true/false
- **DateTime**: ISO 8601 date-time strings
- **Binary**: Not used in this system

**Note**: Complex objects (like arrays, nested objects) are stored as **JSON strings** and parsed when retrieved.

---

## Storage Limits

- **Entity Size**: Max 1 MB per entity
- **Table Size**: Unlimited (scales automatically)
- **Partition Count**: Unlimited
- **Throughput**: Up to 20,000 entities/second per partition

---

## Best Practices

1. **Partition Key Design**: Choose keys that enable efficient queries (by user, by course)
2. **Row Key Uniqueness**: Ensure RowKey is unique within a partition
3. **JSON Storage**: Store complex data as JSON strings, parse on retrieval
4. **Indexing**: PartitionKey + RowKey create a composite index (very fast lookups)
5. **Query Patterns**: Design queries to use PartitionKey for best performance

---

## Common Queries

### Get all courses for a user
```javascript
// Query UserProgress by PartitionKey (userId)
filter: "PartitionKey eq '1'"
```

### Get all users for a course
```javascript
// Query UserProgress by RowKey (courseId)
filter: "RowKey eq 'sharepoint-navigation-101'"
```

### Get all statements for a user
```javascript
// Query xapiStatements by PartitionKey (user email)
filter: "PartitionKey eq 'admin@example.com'"
```

### Get resume state for user/course
```javascript
// Get entity by PartitionKey + RowKey
getEntity(partitionKey, "resume")
```

---

## Troubleshooting

### Issue: Seeing "2" and "2@example.com" in progress

**Cause**: The `userId` in JWT token is "2", which becomes the PartitionKey. The email is generated as fallback.

**Solution**: ✅ **FIXED** - The system now uses email addresses as PartitionKey instead of numeric userIds. New progress entries will use email (e.g., "admin@example.com"). Old entries with numeric IDs will still work but will show fallback emails until migrated.

**Migration Note**: Existing progress entries with numeric userIds will continue to work. To migrate old data, you can:
1. Query all progress entries
2. For entries with numeric userId, look up the user's email
3. Update the PartitionKey to use email instead

The system now automatically uses email for all new progress entries.

### Issue: Slow queries

**Cause**: Querying without PartitionKey (table scan).

**Solution**: Always include PartitionKey in queries for best performance.

### Issue: Entity too large

**Cause**: Storing too much data in a single entity (>1MB).

**Solution**: Split data across multiple entities or use blob storage for large content.

