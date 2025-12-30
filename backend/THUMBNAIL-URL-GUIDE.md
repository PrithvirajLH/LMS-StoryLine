# Thumbnail URL Guide

## What is Thumbnail URL?

The **Thumbnail URL** is the path to the course thumbnail image that appears in:
- Course listing page (`/courses`)
- Progress dashboard (`/dashboard`)
- Course cards throughout the application

## Format Options

### Option 1: Relative Path (Recommended)

Use a path relative to the `/course` route, which serves files from Azure Blob Storage:

**Format:** `/course/[course-folder-path]/[image-file]`

**Examples:**
- `/course/sharepoint-navigation-101-custom/mobile/poster.jpg`
- `/course/sharepoint-navigation-101-custom/mobile/poster_5u6mxg7P20v_video_6DAx87pq9eS_5_48_828x248.jpg`
- `/course/my-course/thumbnail.png`

### Option 2: Full URL

You can also use a full URL to an external image:

**Examples:**
- `https://example.com/images/course-thumbnail.jpg`
- `https://your-cdn.com/thumbnails/course-1.jpg`

### Option 3: Default (Auto-generated)

If left empty, the system defaults to:
- `/course/mobile/poster.jpg`

However, this may not exist for all courses, so it's better to specify the full path.

## How to Find Thumbnail Images in Your Course

### For Articulate Storyline Courses

1. **Check the `mobile` folder** in your course files:
   - Look for files like `poster.jpg` or `poster_*.jpg`
   - These are typically the course thumbnails

2. **Common locations:**
   - `mobile/poster.jpg` - Main poster image
   - `mobile/poster_[id]_video_[id]_[dimensions].jpg` - Video poster images

3. **After uploading to blob storage:**
   - If your course folder is `sharepoint-navigation-101-custom`
   - And the image is at `mobile/poster.jpg`
   - Use: `/course/sharepoint-navigation-101-custom/mobile/poster.jpg`

## Setting Thumbnail URL in Admin Panel

1. **Go to Admin Panel**: `http://localhost:5173/admin`
2. **Click "+ Create Course"**
3. **In the "Thumbnail URL" field**, enter one of:
   - **Relative path**: `/course/[course-folder]/mobile/poster.jpg`
   - **Full URL**: `https://example.com/image.jpg`
   - **Leave empty**: Will use default `/course/mobile/poster.jpg`

## Example Workflow

1. **Upload course files:**
   ```bash
   cd backend
   node upload-course-files.js sharepoint-navigation-101-custom
   ```

2. **Check available images in blob storage:**
   - Go to Azure Portal → Storage Account → Containers → `lms-content`
   - Navigate to `sharepoint-navigation-101-custom/mobile/`
   - Find a suitable poster image (e.g., `poster.jpg`)

3. **Create course in Admin Panel:**
   - Title: "SharePoint Navigation 101"
   - Course Folder Path: `sharepoint-navigation-101-custom`
   - Thumbnail URL: `/course/sharepoint-navigation-101-custom/mobile/poster.jpg`
   - (Or leave empty for default)

## Image Requirements

- **Recommended size**: 16:9 aspect ratio (e.g., 1280x720, 1920x1080)
- **File formats**: JPG, PNG, WebP
- **File size**: Keep under 500KB for faster loading
- **Naming**: Use descriptive names like `thumbnail.jpg` or `poster.jpg`

## Troubleshooting

### Image Not Showing

1. **Check the path is correct:**
   - Verify the file exists in blob storage
   - Ensure the path matches the course folder structure

2. **Test the URL:**
   - Try accessing: `http://localhost:3000/course/[your-path]`
   - Should return the image file

3. **Check blob storage:**
   - Verify the image file was uploaded
   - Check file permissions

### Default Image Not Found

If you see a placeholder instead of the image:
- The default path `/course/mobile/poster.jpg` doesn't exist
- Upload a thumbnail image to blob storage
- Update the course with the correct thumbnail URL

## Quick Reference

**For course folder `my-course` with image at `mobile/poster.jpg`:**
```
Thumbnail URL: /course/my-course/mobile/poster.jpg
```

**For external image:**
```
Thumbnail URL: https://cdn.example.com/thumbnails/my-course.jpg
```

**For default (if image exists at root):**
```
Thumbnail URL: /course/mobile/poster.jpg
```

