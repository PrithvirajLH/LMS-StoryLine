# Azure Blob Storage Setup for Course Files

## Overview

Course files are now served from **Azure Blob Storage** container `lms-content` instead of local filesystem. This provides:

- ✅ **Scalability**: Handles 15,000+ concurrent users
- ✅ **CDN Ready**: Can integrate with Azure CDN
- ✅ **Cost Effective**: Pay only for storage and bandwidth
- ✅ **Reliable**: 99.9% availability SLA

## Configuration

Add to `backend/.env`:

```env
AZURE_STORAGE_ACCOUNT_NAME=your-storage-account-name
AZURE_STORAGE_ACCOUNT_KEY=your-storage-account-key
AZURE_STORAGE_CONTAINER_NAME=lms-content
```

## Upload Course Files

### Option 1: Upload Existing Course Files

If you have course files in the `xapi` folder:

```bash
cd backend
node upload-course-files.js
```

This will:
- Upload all files from `xapi/` folder to blob storage
- Preserve directory structure
- Skip files that already exist
- Set proper content types

### Option 2: Upload via Azure Portal

1. Go to Azure Portal → Storage Account → Containers
2. Open `lms-content` container
3. Upload files manually or use Azure Storage Explorer

### Option 3: Upload via Azure CLI

```bash
az storage blob upload-batch \
  --account-name YOUR_ACCOUNT \
  --account-key YOUR_KEY \
  --destination lms-content \
  --source ./xapi
```

## File Structure in Blob Storage

Files are stored with the same structure as the `xapi` folder:

```
lms-content/
  ├── index_lms.html
  ├── story.html
  ├── tincan.xml
  ├── html5/
  │   ├── data/
  │   └── lib/
  ├── lms/
  ├── story_content/
  └── mobile/
```

## Testing

### Test Blob Storage

```bash
node test-blob.js
```

### Test File Serving

```bash
curl http://localhost:3000/course/index_lms.html
```

## Course File Paths

When creating courses via admin API, the `coursePath` field should match the blob path:

- If files are at root: `coursePath: ""` or `coursePath: "xapi"`
- If files are in subfolder: `coursePath: "courses/course-id"`

The launch URL will be: `/course/{coursePath}/{launchFile}`

## Benefits

1. **Scalability**: Blob storage handles millions of requests
2. **CDN Integration**: Can add Azure CDN for global distribution
3. **Cost**: ~$0.02 per GB/month storage + $0.05 per GB egress
4. **Performance**: Fast downloads with proper caching headers

## Migration from Local Files

If you were using local files:

1. **Upload files**: Run `node upload-course-files.js`
2. **Update course paths**: Ensure `coursePath` in database matches blob structure
3. **Test**: Verify course launches correctly

## Troubleshooting

### Files not found (404)
- Check files are uploaded to blob storage
- Verify `coursePath` in course record matches blob path
- Check container name matches `AZURE_STORAGE_CONTAINER_NAME`

### Upload fails
- Verify Azure credentials in `.env`
- Check container exists and has write permissions
- Ensure storage account allows blob operations

### Slow file serving
- Consider enabling Azure CDN
- Check blob storage tier (Hot/Cool/Archive)
- Verify caching headers are set

