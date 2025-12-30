# Storyline xAPI Course - Fixes Applied

## Critical Fixes Implemented

### ✅ 1. Registration ID Now Passed to Course
**Problem**: Registration ID was generated but never passed to Storyline course.

**Fix Applied**:
- Registration ID is now retrieved from attempt when serving HTML files
- Registration ID is injected into `window.LRS_CONFIG.registration`
- Registration ID is set as `window.REGISTRATION_ID` for Storyline bootstrapper
- Registration ID is passed as `regId` query parameter in launch URL
- Registration ID is included in Player.config.lrs object

**Files Modified**:
- `backend/src/routes/content.js` - Gets attempt and injects registration ID
- `backend/src/routes/courses-table.js` - Adds `regId` to launch URL

### ✅ 2. xAPI Authentication Improved
**Problem**: Using Basic auth with email:token may not work with all LRS implementations.

**Fix Applied**:
- Now uses JWT Bearer token when available (more secure)
- Falls back to Basic auth if token not available
- Token is passed to Storyline bootstrapper in LRS config

**Files Modified**:
- `backend/src/routes/content.js` - Updated LRS auth header generation

### ✅ 3. CORS Headers Added
**Problem**: xAPI requests from course content may be blocked by CORS.

**Fix Applied**:
- Added CORS middleware to xAPI routes
- Allows all origins (course content may be from different domains)
- Handles preflight OPTIONS requests
- Allows required headers: `Content-Type`, `Authorization`, `X-Experience-API-Version`

**Files Modified**:
- `backend/src/routes/xapi.js` - Added CORS middleware
- `backend/src/server.js` - Enhanced CORS configuration

### ✅ 4. Registration ID in Launch URL
**Problem**: Launch URL didn't include registration ID as query parameter.

**Fix Applied**:
- Launch URL now includes `?regId=<registration-id>` parameter
- Storyline courses can read this from URL if needed

**Files Modified**:
- `backend/src/routes/courses-table.js` - Adds regId to launch URL

## What Storyline Course Needs

### Required Components (Now Provided):

1. ✅ **Registration ID** - Now passed in URL and injected into JavaScript
2. ✅ **xAPI Endpoint** - Configured as `/xapi` (proxied to LRS)
3. ✅ **Authentication** - JWT Bearer token or Basic auth
4. ✅ **CORS Support** - Headers allow cross-origin requests
5. ✅ **tincan.xml** - Should be accessible at `/xapi/tincan.xml`
6. ✅ **Launch File** - `index_lms.html` is used
7. ✅ **Resource Authentication** - All resources get token in query params

## Testing Checklist

After these fixes, test the following:

1. **Course Launch**:
   - [ ] Course HTML loads without errors
   - [ ] Check browser console for JavaScript errors
   - [ ] Verify registration ID is in launch URL (`?regId=...`)
   - [ ] Verify registration ID is in `window.REGISTRATION_ID`

2. **xAPI Configuration**:
   - [ ] Check `window.LRS_CONFIG` has endpoint and auth
   - [ ] Check `window.LRS_CONFIG.registration` has registration ID
   - [ ] Verify `window.Player.config.lrs` is configured

3. **xAPI Statements**:
   - [ ] Open browser Network tab
   - [ ] Filter for `/xapi/statements`
   - [ ] Verify POST requests are being sent
   - [ ] Check response status (should be 200 or 204)
   - [ ] Verify no CORS errors

4. **Course Content**:
   - [ ] All slides load correctly
   - [ ] Media (videos, images) load
   - [ ] Navigation works
   - [ ] Progress is tracked

## Expected Behavior

When course launches:
1. Launch URL includes `?regId=<uuid>&token=<jwt>`
2. HTML loads with injected scripts
3. `window.LRS_CONFIG` is set with endpoint, auth, and registration
4. `window.REGISTRATION_ID` is set
5. Storyline bootstrapper initializes with LRS config
6. Course content displays
7. xAPI statements are sent to `/xapi/statements` with registration ID

## If Course Still Doesn't Work

Check these in browser console:

1. **Registration ID**:
   ```javascript
   console.log(window.REGISTRATION_ID);
   console.log(window.LRS_CONFIG.registration);
   ```

2. **LRS Config**:
   ```javascript
   console.log(window.LRS_CONFIG);
   console.log(window.Player?.config?.lrs);
   ```

3. **xAPI Errors**:
   - Check Network tab for failed `/xapi/statements` requests
   - Look for CORS errors
   - Check authentication errors (401, 403)

4. **Course Errors**:
   - Check for JavaScript errors in console
   - Check if `data.js`, `paths.js` loaded
   - Check if bootstrapper initialized

## Next Steps

1. **Test the course** - Launch SharePoint 101 and check browser console
2. **Check Network tab** - Verify xAPI requests are being sent
3. **Verify LRS** - Ensure LRS endpoint is configured in `.env`
4. **Check logs** - Backend should show xAPI requests being proxied

If issues persist, share:
- Browser console errors
- Network tab showing failed requests
- Backend logs showing xAPI requests

