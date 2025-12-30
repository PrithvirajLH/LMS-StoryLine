# How to Get Activity ID When Creating a Course

## Overview

The Activity ID is a unique identifier for your course in xAPI format. It's found in the `tincan.xml` file of your Articulate Storyline course.

## Method 1: Auto-Extract from Admin Panel (Recommended)

1. **Upload course files to blob storage** first:
   ```bash
   cd backend
   node upload-course-files.js [course-folder-name]
   ```
   Example: `node upload-course-files.js advanced-excel-training`

2. **Go to Admin Panel**: `http://localhost:5173/admin`

3. **Click "+ Create Course"**

4. **Fill in the form**:
   - **Title**: Enter course title
   - **Course Folder Path**: Enter the folder name where files are stored (e.g., `advanced-excel-training`)
   - **Click "Auto-fill" button** next to Course Folder Path
   - The Activity ID will be automatically extracted from `tincan.xml` and filled in!

## Method 2: Manual Extraction

### Option A: From tincan.xml File

1. Open `tincan.xml` in your course folder
2. Look for the `<activity>` tag with `type="http://adlnet.gov/expapi/activities/course"`
3. Copy the `id` attribute value

Example:
```xml
<activity id="urn:articulate:storyline:5Ujw93Dh98n" type="http://adlnet.gov/expapi/activities/course">
```

The Activity ID is: `urn:articulate:storyline:5Ujw93Dh98n`

### Option B: Use API Endpoint

```bash
# Get admin token first by logging in
curl -X GET "http://localhost:3000/api/admin/extract-activity-id?coursePath=sharepoint-navigation-101-custom" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Response:
```json
{
  "activityId": "urn:articulate:storyline:5Ujw93Dh98n",
  "coursePath": "sharepoint-navigation-101-custom",
  "tincanPath": "sharepoint-navigation-101-custom/tincan.xml"
}
```

## Method 3: From Blob Storage

If files are already in blob storage:

1. Go to Azure Portal → Storage Account → Containers → `lms-content`
2. Navigate to your course folder (e.g., `sharepoint-navigation-101-custom`)
3. Download `tincan.xml`
4. Open it and find the activity ID as shown in Method 2, Option A

## Common Activity ID Formats

- **Articulate Storyline**: `urn:articulate:storyline:5Ujw93Dh98n`
- **Custom IRI**: `http://example.com/activity/course-name`
- **UUID**: `urn:uuid:550e8400-e29b-41d4-a716-446655440000`

## Troubleshooting

### "tincan.xml not found" Error

- Make sure course files are uploaded to blob storage
- Verify the course folder path is correct
- Check that `tincan.xml` exists in the folder

### Activity ID Not Extracted

- Ensure `tincan.xml` is valid XML
- Check that the file contains an `<activity>` element with an `id` attribute
- Verify the course activity has `type="http://adlnet.gov/expapi/activities/course"`

## Quick Reference

**Activity ID Location in tincan.xml:**
```xml
<tincan>
  <activities>
    <activity id="YOUR_ACTIVITY_ID_HERE" type="http://adlnet.gov/expapi/activities/course">
      <name>Course Name</name>
      <launch>index_lms.html</launch>
    </activity>
  </activities>
</tincan>
```

The `id` attribute value is your Activity ID!

