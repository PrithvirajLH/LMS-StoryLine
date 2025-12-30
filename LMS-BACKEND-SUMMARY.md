# LMS Backend - Complete Setup Summary

## What Was Created

I've created a **self-contained LMS backend** that works with your xAPI/Storyline course without requiring external dependencies. Here's what was built:

### 1. Built-in xAPI Learning Record Store (LRS)
- **File**: `backend/src/services/xapiLRS.js`
- Stores xAPI statements, state, and profiles in memory
- Handles all xAPI endpoints (statements, state, profiles)
- Can be extended to use a database for production

### 2. xAPI Routes
- **File**: `backend/src/routes/xapi.js`
- Updated to use the built-in LRS instead of external proxy
- All standard xAPI endpoints implemented:
  - `POST /xapi/statements` - Store statements
  - `GET /xapi/statements` - Query statements
  - `GET/PUT/DELETE /xapi/activities/state` - Activity state management
  - `GET/PUT/DELETE /xapi/activities/profile` - Activity profiles
  - `GET/PUT/DELETE /xapi/agents/profile` - Agent profiles

### 3. Course Launch Route
- **File**: `backend/src/routes/launch.js`
- Serves course files from the `xapi` folder
- Injects xAPI configuration into the course HTML
- Handles authentication via JWT tokens
- Properly configures endpoint, auth, actor, and registration

### 4. Setup Documentation
- **File**: `backend/README-SETUP.md`
- Complete setup instructions
- Configuration guide
- Troubleshooting tips

### 5. Test Launch Page
- **File**: `backend/test-launch.html`
- Simple HTML page to test course launching
- Can be opened in a browser to launch the course

## Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Create `.env` File
Create `backend/.env`:
```env
PORT=3000
NODE_ENV=development
API_BASE_URL=http://localhost:3000
JWT_SECRET=your-secret-key-change-this
FRONTEND_URL=http://localhost:5173
```

### 3. Start the Server
```bash
npm run dev
```

### 4. Test the Course Launch

#### Option A: Using the Test Page
1. Open `backend/test-launch.html` in your browser
2. Get a JWT token (register/login via `/api/auth`)
3. Enter token and click "Launch Course"

#### Option B: Direct URL
```
http://localhost:3000/launch/sharepoint-navigation-101?token=YOUR_JWT_TOKEN
```

## How It Works

### Course Launch Flow

1. **User authenticates** → Gets JWT token
2. **User requests course launch** → `/launch/{courseId}?token={token}`
3. **Server verifies token** → Extracts user info
4. **Server reads `index_lms.html`** → Injects xAPI configuration
5. **Course loads** → Connects to `/xapi` endpoint
6. **Course sends statements** → Stored in built-in LRS
7. **Progress tracked** → Available via xAPI queries

### xAPI Configuration

The launch route automatically injects:
- **Endpoint**: `http://localhost:3000/xapi`
- **Auth**: JWT Bearer token
- **Actor**: User info from token
- **Registration**: Unique ID for this attempt
- **Activity ID**: From `tincan.xml` (`urn:articulate:storyline:5Ujw93Dh98n`)

### File Serving

The launch route serves all course files from the `xapi` folder:
- HTML files (with xAPI config injection)
- JavaScript files
- CSS files
- Images, videos, audio
- All other assets

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get token
- `GET /api/auth/me` - Get current user info

### Course Launch
- `GET /launch/:courseId?token={token}` - Launch course
- `GET /launch/:courseId/*` - Serve course files

### xAPI (Learning Record Store)
- `POST /xapi/statements` - Store xAPI statements
- `GET /xapi/statements` - Query statements
- `GET /xapi/statements/:id` - Get specific statement
- `GET /xapi/activities/state` - Get activity state
- `PUT /xapi/activities/state` - Save activity state
- `DELETE /xapi/activities/state` - Delete state

## Course Information

From `xapi/tincan.xml`:
- **Activity ID**: `urn:articulate:storyline:5Ujw93Dh98n`
- **Course Name**: "SharePoint Navigation 101 - Custom"
- **Launch File**: `index_lms.html`
- **Modules**: 8 modules (Intro, Navigation, Menu, Homepage, etc.)

## Testing

### Test xAPI Endpoint
```bash
curl -X POST http://localhost:3000/xapi/statements \
  -H "Content-Type: application/json" \
  -d '{
    "actor": {
      "objectType": "Agent",
      "name": "Test User",
      "mbox": "mailto:test@example.com"
    },
    "verb": {
      "id": "http://adlnet.gov/expapi/verbs/experienced"
    },
    "object": {
      "id": "urn:articulate:storyline:5Ujw93Dh98n",
      "objectType": "Activity"
    }
  }'
```

### Test Health
```bash
curl http://localhost:3000/health
```

## Troubleshooting

### Course doesn't load
- ✅ Check `xapi` folder exists and contains `index_lms.html`
- ✅ Verify token is valid (not expired)
- ✅ Check browser console for errors
- ✅ Ensure server is running on correct port

### xAPI statements not saving
- ✅ Check server logs for errors
- ✅ Verify `/xapi/statements` endpoint is accessible
- ✅ Check CORS headers in browser network tab
- ✅ Ensure course is sending statements (check browser console)

### Authentication errors
- ✅ Verify `JWT_SECRET` is set in `.env`
- ✅ Check token expiration
- ✅ Ensure token is passed in query parameter or header

## Next Steps

1. **Test the course launch** using the test page or direct URL
2. **Verify xAPI tracking** by checking server logs when course sends statements
3. **Integrate with frontend** - Update your frontend to use the launch endpoint
4. **Add user management** - Create users, enrollments, etc.
5. **Add progress tracking** - Query xAPI statements to show learner progress
6. **Production deployment** - Move to database storage, add proper logging

## Files Modified/Created

### Created:
- `backend/src/services/xapiLRS.js` - Built-in LRS
- `backend/src/routes/launch.js` - Course launch route
- `backend/README-SETUP.md` - Setup documentation
- `backend/test-launch.html` - Test page
- `LMS-BACKEND-SUMMARY.md` - This file

### Modified:
- `backend/src/routes/xapi.js` - Updated to use built-in LRS
- `backend/src/server.js` - Added launch route

## Important Notes

1. **In-Memory Storage**: The LRS currently stores data in memory. For production, you should extend it to use a database.

2. **Authentication**: The system uses JWT tokens. Make sure to set a strong `JWT_SECRET` in production.

3. **CORS**: CORS is enabled for xAPI endpoints to allow the course to communicate with the backend.

4. **Course Files**: The course files must be in the `xapi` folder at the project root.

5. **Registration ID**: Each course launch gets a unique registration ID for tracking multiple attempts.

## Support

If you encounter issues:
1. Check server logs for errors
2. Check browser console for JavaScript errors
3. Verify all environment variables are set
4. Ensure the `xapi` folder structure is correct
5. Test xAPI endpoints directly with curl/Postman

The backend is now ready to launch your course and track xAPI statements!

