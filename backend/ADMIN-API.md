# Admin API Documentation

## Overview

Admin endpoints for managing courses in the LMS. All endpoints require admin authentication.

## Authentication

All admin endpoints require:
- Valid JWT token in `Authorization: Bearer <token>` header
- User must have `role: 'admin'`

## Endpoints

### GET /api/admin/courses

Get all courses with admin details.

**Request:**
```bash
GET /api/admin/courses
Authorization: Bearer <admin-token>
```

**Response:**
```json
[
  {
    "courseId": "sharepoint-navigation-101",
    "title": "SharePoint Navigation 101 - Custom",
    "description": "Learn how to navigate SharePoint effectively",
    "thumbnailUrl": "/course/mobile/poster.jpg",
    "activityId": "urn:articulate:storyline:5Ujw93Dh98n",
    "launchFile": "index_lms.html",
    "coursePath": "xapi",
    "modules": [...],
    "enrollmentCount": 0,
    "attemptCount": 0,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

### POST /api/admin/courses

Create a new course.

**Request:**
```bash
POST /api/admin/courses
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "title": "New Course Title",
  "description": "Course description",
  "thumbnailUrl": "/course/thumbnail.jpg",
  "activityId": "urn:articulate:storyline:ABC123",
  "launchFile": "index_lms.html",
  "coursePath": "courses/new-course"
}
```

**Required Fields:**
- `title` - Course title
- `activityId` - xAPI activity ID (from tincan.xml)
- `launchFile` - Launch file name (usually `index_lms.html`)

**Optional Fields:**
- `description` - Course description
- `thumbnailUrl` - Thumbnail image URL
- `coursePath` - Path to course files (defaults to `courses/{courseId}`)

**Response:**
```json
{
  "courseId": "new-course-title",
  "title": "New Course Title",
  "description": "Course description",
  ...
}
```

**Note:** `courseId` is auto-generated from the title (lowercase, hyphens, max 50 chars).

### PUT /api/admin/courses/:courseId

Update an existing course.

**Request:**
```bash
PUT /api/admin/courses/sharepoint-navigation-101
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "courseId": "sharepoint-navigation-101",
  "title": "Updated Title",
  ...
}
```

### DELETE /api/admin/courses/:courseId

Delete a course.

**Request:**
```bash
DELETE /api/admin/courses/sharepoint-navigation-101
Authorization: Bearer <admin-token>
```

**Response:**
- Status: `204 No Content`

### GET /api/admin/progress

Get learner progress (admin view).

**Request:**
```bash
GET /api/admin/progress
Authorization: Bearer <admin-token>
```

**Response:**
```json
[]
```

**Note:** Currently returns empty array. TODO: Query xAPI statements to get progress.

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Admin access required"
}
```

### 404 Not Found
```json
{
  "error": "Course not found"
}
```

### 400 Bad Request
```json
{
  "error": "Title, activityId, and launchFile are required"
}
```

## Example Usage

### Create Course
```bash
curl -X POST http://localhost:3000/api/admin/courses \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Advanced SharePoint Training",
    "description": "Learn advanced SharePoint features",
    "activityId": "urn:articulate:storyline:XYZ789",
    "launchFile": "index_lms.html",
    "coursePath": "courses/advanced-sharepoint"
  }'
```

### Update Course
```bash
curl -X PUT http://localhost:3000/api/admin/courses/advanced-sharepoint \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description"
  }'
```

### Delete Course
```bash
curl -X DELETE http://localhost:3000/api/admin/courses/advanced-sharepoint \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Storage

Courses are stored in Azure Table Storage:
- **Table**: `Courses`
- **PartitionKey**: `courses` (single partition)
- **RowKey**: `courseId`

This provides:
- ✅ Persistent storage
- ✅ Scalable for 15K+ employees
- ✅ Fast lookups by courseId
- ✅ Production-ready

