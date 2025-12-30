# Storyline LMS Backend

A simple, focused backend for launching and tracking Storyline xAPI courses.

## Features

- ✅ Serves Storyline course files directly
- ✅ Built-in xAPI Learning Record Store (LRS)
- ✅ Simple authentication for employees
- ✅ Automatic xAPI configuration via URL parameters
- ✅ No external dependencies required

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-random-secret-key-here
BASE_URL=http://localhost:3000
```

### 3. Start Server

```bash
npm run dev
```

Or for production:

```bash
npm start
```

## Usage

### 1. Register/Login

First, create an account or login:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123", "name": "John Doe"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

Both return a JWT token.

### 2. Launch Course

Open in browser:
```
http://localhost:3000/launch?token=YOUR_JWT_TOKEN
```

This automatically:
- Verifies your token
- Creates xAPI actor from your user info
- Generates registration ID
- Redirects to course with xAPI parameters

### 3. Course Files

Course files are served from `/course/*`:
- `/course/index_lms.html` - Main course file
- `/course/html5/*` - Course assets
- `/course/lms/*` - LMS integration files
- `/course/story_content/*` - Story content

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get token
- `GET /api/auth/me?token=...` - Get current user

### Course Launch
- `GET /launch?token=...` - Launch course with xAPI config

### xAPI LRS
- `POST /xapi/statements` - Store xAPI statements
- `GET /xapi/statements` - Query statements
- `GET /xapi/statements/:id` - Get specific statement
- `GET /xapi/activities/state` - Get activity state
- `PUT /xapi/activities/state` - Save activity state
- `DELETE /xapi/activities/state` - Delete state
- `GET/PUT/DELETE /xapi/activities/profile` - Activity profiles
- `GET/PUT/DELETE /xapi/agents/profile` - Agent profiles

## How It Works

1. **User authenticates** → Gets JWT token
2. **User visits `/launch?token=...`** → Server verifies token
3. **Server creates xAPI config**:
   - Endpoint: `http://localhost:3000/xapi`
   - Auth: Basic auth with email:token
   - Actor: User info from token
   - Registration: Unique ID for this attempt
4. **Redirects to course** with xAPI parameters in URL
5. **Storyline's scormdriver.js** reads parameters and connects to LRS
6. **Course sends statements** → Stored in built-in LRS

## Course Information

From `xapi/tincan.xml`:
- **Activity ID**: `urn:articulate:storyline:5Ujw93Dh98n`
- **Course Name**: "SharePoint Navigation 101 - Custom"
- **Launch File**: `index_lms.html`

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

## File Structure

```
backend/
  ├── server.js              # Main server file
  ├── xapi-lrs-azure.js      # xAPI LRS using Azure Table Storage
  ├── auth.js                # Authentication (uses Azure Tables)
  ├── users-storage.js       # User management (Azure Tables)
  ├── courses-storage.js     # Course catalog (Azure Tables)
  ├── progress-storage.js    # Progress tracking (Azure Tables)
  ├── blob-storage.js        # Course files (Azure Blob Storage)
  ├── azure-tables.js        # Azure Table Storage configuration
  ├── package.json           # Dependencies
  ├── .env.example           # Environment template
  └── README.md              # This file
```

## Storage Architecture

- **Azure Table Storage**: All structured data (users, courses, xAPI statements, progress)
- **Azure Blob Storage**: All course files (HTML, JS, CSS, assets)
- **No In-Memory Storage**: Everything persists to Azure
- **Production-Ready**: Scalable for 15,000+ employees

## Notes

- **Azure Storage Required**: All data is stored in Azure Table Storage and Blob Storage
- **Authentication**: Default admin user: `admin@example.com` / `admin123` (change in production)
- **CORS**: Enabled for all origins to allow course content
- **Port**: Default is 3000, change in `.env` if needed

## Troubleshooting

### Port already in use
Change `PORT` in `.env` or kill the process using port 3000.

### Course doesn't load
- Check that `xapi` folder exists at project root
- Verify token is valid
- Check browser console for errors

### xAPI statements not saving
- Check server logs
- Verify `/xapi/statements` endpoint is accessible
- Check CORS headers in browser network tab

## Production

For production:
1. Set strong `JWT_SECRET`
2. ✅ **Already using Azure Table Storage** (production-grade)
3. ✅ **Already using Azure Blob Storage** (scalable file storage)
4. Add proper logging
5. Set up HTTPS
6. Configure proper CORS origins
7. Add rate limiting
8. Change default admin password

