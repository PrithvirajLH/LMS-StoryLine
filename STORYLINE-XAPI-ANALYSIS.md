# Articulate Storyline 360 xAPI Course - Complete Analysis

## Course Details
- **Title**: SharePoint Navigation 101 - Custom
- **Type**: Articulate Storyline 360 (xAPI/Tin Can API)
- **Player Version**: 3.105.35604.0
- **Published**: December 2, 2025
- **Duration**: ~4 minutes
- **Slides**: 8 slides
- **xAPI Activity ID**: `urn:articulate:storyline:5Ujw93Dh98n`

## Critical Requirements for Storyline xAPI Courses

### 1. **Registration ID (CRITICAL - MISSING)**
- **Required**: Storyline courses MUST receive a registration UUID as a query parameter
- **Parameter Name**: Usually `regId` or `registration`
- **Current Status**: ❌ **NOT BEING PASSED**
- **Impact**: Course cannot track progress properly, xAPI statements may fail

### 2. **xAPI Endpoint Configuration**
- **Required**: Course must know where to send xAPI statements
- **Current Status**: ✅ Configured (but may need registration ID)
- **Endpoint**: `/xapi` (proxied to LRS)
- **Authentication**: Basic auth with email:token

### 3. **tincan.xml File**
- **Required**: Course metadata and activity definitions
- **Location**: Should be in course root (`/xapi/tincan.xml`)
- **Current Status**: ✅ Should be available (needs verification)

### 4. **Launch File**
- **Required**: `index_lms.html` (LMS version with xAPI enabled)
- **Current Status**: ✅ Using `index_lms.html`

### 5. **Authentication for Resources**
- **Required**: All course resources (JS, CSS, images, videos) must be authenticated
- **Current Status**: ✅ Implemented (token in query params and cookies)

### 6. **CORS Headers**
- **Required**: xAPI requests from course must be allowed
- **Current Status**: ⚠️ Needs verification

### 7. **JavaScript Execution**
- **Required**: `data.js`, `paths.js`, `frame.js` must execute properly
- **Current Status**: ✅ Implemented (globalProvideData injection)

## Issues Found

### ❌ CRITICAL: Registration ID Not Passed
**Problem**: The registration ID is generated and stored in the database, but it's NEVER passed to the Storyline course as a query parameter.

**Fix Required**:
1. Pass `registrationId` as `regId` query parameter in launch URL
2. Inject registration ID into LRS config in HTML
3. Ensure registration ID is available to Storyline bootstrapper

### ⚠️ POTENTIAL: xAPI Authentication
**Problem**: Using `btoa(userEmail + ':token')` may not match what the xAPI endpoint expects.

**Fix Required**:
1. Verify xAPI endpoint accepts Basic auth with email:token
2. Or use proper JWT token in Authorization header
3. Ensure CORS allows xAPI requests

### ⚠️ POTENTIAL: tincan.xml Not Being Read
**Problem**: Storyline bootstrapper may not be reading tincan.xml correctly.

**Fix Required**:
1. Ensure tincan.xml is accessible at `/xapi/tincan.xml`
2. Verify it's being served with correct content-type
3. Check if bootstrapper is reading it correctly

### ⚠️ POTENTIAL: CORS Issues
**Problem**: xAPI POST requests from course may be blocked by CORS.

**Fix Required**:
1. Add proper CORS headers to `/xapi` routes
2. Allow credentials in CORS
3. Handle preflight OPTIONS requests

## Implementation Checklist

### Backend Fixes Needed:
- [ ] Pass registration ID in launch URL query parameter
- [ ] Inject registration ID into HTML for Storyline bootstrapper
- [ ] Verify xAPI endpoint authentication
- [ ] Add CORS headers to xAPI routes
- [ ] Ensure tincan.xml is accessible

### Frontend Fixes Needed:
- [ ] Pass registration ID when constructing launch URL
- [ ] Ensure registration ID is included in iframe src

### Testing Required:
- [ ] Verify course loads without errors
- [ ] Check browser console for xAPI errors
- [ ] Verify xAPI statements are being sent
- [ ] Check network tab for failed requests
- [ ] Verify registration ID is in launch URL

## Expected Behavior

When course launches correctly:
1. Course HTML loads with all scripts
2. `data.js`, `paths.js`, `frame.js` execute successfully
3. Bootstrapper initializes with LRS config
4. Registration ID is available to bootstrapper
5. Course content displays
6. xAPI statements are sent to `/xapi/statements`
7. Progress is tracked in LRS

## Current Failure Points

Based on the course structure, likely failure points:
1. **Registration ID missing** - Course cannot initialize xAPI tracking
2. **xAPI endpoint not configured** - Statements fail to send
3. **CORS blocking** - xAPI requests fail
4. **Authentication failing** - Resources not loading
5. **tincan.xml not found** - Course metadata missing

