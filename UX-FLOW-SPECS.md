# LMS Flow Specifications

**Document Version:** 1.0  
**Last Updated:** 2024  
**Owner:** UI/UX Architect

---

## FLOW 1: COURSE DISCOVERY & ENROLLMENT

### Entry Points
- User lands on `/courses` after login (default route)
- User clicks "Courses" in sidebar navigation
- User returns from course player
- User clicks "Browse Courses" from empty state

### User Goal
Find and enroll in a course quickly and efficiently.

### Step-by-Step Flow

#### Step 1: Course Catalog View (`/courses`)

**Screen State: Loading**
- **Visual:** Skeleton cards (3-6 cards showing placeholder structure)
- **Text:** "Loading courses..." (centered)
- **Behavior:** Show while fetching course data from API

**Screen State: Success (Courses Available)**
- **Layout:**
  - Hero section: Title "My Courses", subtitle, search bar
  - Sidebar filters: Categories with counts, "Clear Filters" button
  - Main content: Grid of course cards (responsive: 1 → 2 → 3 columns)
- **Content:**
  - Course count: "X courses available"
  - Each course card displays: thumbnail, title, description, status badge, progress (if enrolled), action button
- **Interactions:**
  - Search: Real-time filter as user types
  - Category filter: Click category to filter
  - Course card click: Navigate to `/player/:courseId`
  - Enroll button: Enroll user, update UI, show success toast
- **Accessibility:**
  - Search input has label (visually hidden or visible)
  - Category buttons have ARIA labels
  - Course cards are keyboard navigable (Enter/Space to activate)

**Screen State: Empty (No Courses)**
- **Visual:** Empty state illustration or icon (centered)
- **Message:** "No courses available at this time"
- **Action:** 
  - If admin: "Upload your first course" button → `/admin`
  - If learner: No action (informational only)
- **Accessibility:** Empty state message announced to screen readers

**Screen State: No Search Results**
- **Visual:** Search icon or empty state
- **Message:** "No courses found matching your criteria"
- **Action:** "Reset Filters" button (clears search + category filter)
- **Accessibility:** Message announced to screen readers

**Screen State: Error (API Failure)**
- **Visual:** Error alert banner (red/destructive styling)
- **Message:** "Failed to load courses. Please try again."
- **Action:** "Retry" button (reloads courses)
- **Accessibility:** Error message in `role="alert"` for screen readers

#### Step 2: Course Detail / Launch (`/player/:courseId`)

**Entry:** User clicks course card or "Continue Learning" button

**Screen State: Loading**
- **Visual:** Spinner centered in iframe container area
- **Text:** "Loading course content..."
- **Behavior:** Show while course iframe loads
- **Accessibility:** Loading state announced to screen readers

**Screen State: Success (Course Loaded)**
- **Layout:**
  - Breadcrumbs: "Courses > [Course Title]"
  - Course header: Title, description, status badges, back button
  - Course player: Full-width iframe container (16:9 aspect ratio)
  - Optional: Exit button (if needed)
- **Content:**
  - Course title and description (from API)
  - Enrollment status badge
  - Progress indicator (if in progress)
- **Interactions:**
  - Back button: Navigate to `/courses`
  - Iframe: Course content (Storyline) loads and runs
  - Progress tracking: xAPI statements sent to backend
- **Accessibility:**
  - Iframe has `title` attribute describing course
  - Focus management: Focus returns to page after iframe loads
  - Keyboard: Tab cycles through page controls (back button, exit if present)

**Screen State: Error (Course Load Failure)**
- **Visual:** Error message in player container area
- **Message:** "Failed to load course. Please try again."
- **Actions:**
  - "Retry" button (reloads course)
  - "Back to Courses" link
- **Accessibility:** Error message in `role="alert"`

**Screen State: Not Enrolled**
- **Behavior:** Auto-enroll user (if backend supports) OR show enrollment prompt
- **If prompt shown:**
  - Message: "You need to enroll in this course first"
  - Actions: "Enroll Now" button, "Back to Courses" link

#### Step 3: Course Completion / Exit

**Exit Points:**
- User closes course player (browser back, exit button)
- User completes course (xAPI completion statement received)
- Session timeout

**Completion Handling:**
- Backend receives xAPI completion statement
- Progress updated (100% completion)
- Toast notification: "Course completed! 🎉"
- User returns to `/courses` or `/dashboard`
- Course card updates: Shows "Completed" badge, progress bar at 100%

**Exit Handling:**
- Progress saved (xAPI state saved)
- User can resume from saved state next time
- Toast (optional): "Progress saved. You can continue later."

### Validation & Error Messages

**Enrollment Errors:**
- **Error:** "Failed to enroll in course"
- **Recovery:** Show error toast, allow retry
- **Prevention:** Disable enroll button during request, show loading state

**Course Load Errors:**
- **Error:** "Failed to load course content"
- **Recovery:** Show error message in player area, provide retry and back options
- **Prevention:** Validate course ID, check permissions before load

**Network Errors:**
- **Error:** "Unable to connect. Please check your internet connection."
- **Recovery:** Retry button, graceful degradation
- **Prevention:** Show loading state, handle timeouts

### Permissions / Roles

- **Learner:** Can view catalog, enroll, launch courses, view own progress
- **Admin:** All learner permissions + access to admin panel
- **Unauthenticated:** Redirected to `/login`

### Accessibility Notes

- **Keyboard Navigation:** All interactions keyboard accessible (Tab, Enter, Space, Esc)
- **Screen Readers:** Course cards have descriptive labels, status badges announced
- **Focus Management:** Focus moves logically through course grid, focus trap in modals (if any)
- **Loading States:** Announced to screen readers ("Loading courses", "Loading course content")
- **Error States:** Error messages in `role="alert"` for immediate announcement

---

## FLOW 2: AUTHENTICATION

### Entry Points
- User visits protected route while unauthenticated → redirect to `/login`
- User clicks "Sign In" link (if exists)
- User clicks "Sign Out" → redirect to `/login`

### User Goal
Sign in to access the LMS or create a new account.

### Step-by-Step Flow

#### Step 1: Login (`/login`)

**Screen State: Default**
- **Layout:**
  - Left panel (desktop only): Branding, feature list, gradient background
  - Right panel: Login form (centered)
- **Form Fields:**
  - Email: Text input, type="email", required
  - Password: Text input, type="password", required, show/hide toggle
  - Remember me: Checkbox (optional)
  - Submit button: "Sign In"
  - Link: "Don't have an account? Create account" → `/register`
- **Validation (Client-side):**
  - Email: Valid email format
  - Password: Not empty (minimum length if defined)
- **Accessibility:**
  - All fields have labels
  - Password show/hide button has ARIA label
  - Error messages associated with fields (`aria-describedby`)
  - Form has `aria-label="Sign in form"`

**Screen State: Loading (Submission)**
- **Visual:** Submit button shows spinner, disabled
- **Text:** Button text changes to "Signing in..." (optional)
- **Behavior:** Disable form inputs, prevent double submission
- **Accessibility:** Loading state announced ("Signing in...")

**Screen State: Success**
- **Behavior:** Redirect to `/courses` (or return URL if provided)
- **Feedback:** Toast notification: "Welcome back!" (success)
- **State Update:** Token stored, user data cached

**Screen State: Error (Invalid Credentials)**
- **Visual:** Error message below form or toast notification
- **Message:** "Invalid email or password. Please try again."
- **Recovery:** 
  - Focus returns to email field
  - Form remains filled (except password, cleared)
  - User can correct and retry
- **Accessibility:** Error message in `role="alert"`, associated with form

**Screen State: Error (Network/Server)**
- **Message:** "Unable to connect. Please check your connection and try again."
- **Recovery:** Retry button or allow user to retry form submission
- **Accessibility:** Error in `role="alert"`

#### Step 2: Registration (`/register`)

**Screen State: Default**
- **Layout:** Similar to login (left branding, right form)
- **Form Fields:**
  - Name (First Name): Text input, required
  - Last Name: Text input, required (if applicable)
  - Email: Text input, type="email", required
  - Password: Text input, type="password", required, show/hide toggle
  - Confirm Password: Text input, type="password", required, show/hide toggle
  - Terms checkbox: "I agree to terms and conditions" (if applicable)
  - Submit button: "Create Account"
  - Link: "Already have an account? Sign in" → `/login`
- **Validation (Client-side):**
  - Name: Not empty, min 2 characters
  - Email: Valid email format, not already registered (check on blur)
  - Password: Minimum length (8 characters), strength indicator (optional)
  - Confirm Password: Matches password
  - Terms: Required if present
- **Accessibility:**
  - All fields labeled
  - Password requirements announced (if present)
  - Field-level errors announced

**Screen State: Loading (Submission)**
- **Visual:** Submit button shows spinner, disabled
- **Text:** "Creating account..."
- **Behavior:** Disable form, prevent double submission

**Screen State: Success**
- **Behavior:** Redirect to `/courses` (or onboarding flow if applicable)
- **Feedback:** Toast: "Account created successfully! Welcome!"
- **State Update:** Token stored, user data cached

**Screen State: Error (Email Already Exists)**
- **Message:** "An account with this email already exists. Please sign in."
- **Recovery:** 
  - Link to `/login` provided
  - Email field focused
- **Accessibility:** Error in `role="alert"`, associated with email field

**Screen State: Error (Validation)**
- **Field-level Errors:**
  - Email: "Please enter a valid email address"
  - Password: "Password must be at least 8 characters"
  - Confirm Password: "Passwords do not match"
- **Visual:** Error message below field, field border turns red
- **Accessibility:** Error associated with field via `aria-describedby`

### Validation & Error Messages

**Login Errors:**
- **Invalid credentials:** "Invalid email or password. Please try again."
- **Account locked (if applicable):** "Account temporarily locked. Please try again in X minutes."
- **Network error:** "Unable to connect. Please check your connection and try again."

**Registration Errors:**
- **Email exists:** "An account with this email already exists. Please sign in."
- **Weak password:** "Password must be at least 8 characters and include [requirements]"
- **Password mismatch:** "Passwords do not match"
- **Invalid email:** "Please enter a valid email address"
- **Missing fields:** "Please fill in all required fields"

### Permissions / Roles

- **Public Access:** Login and registration pages accessible without authentication
- **Authenticated Users:** Redirected to `/courses` if accessing `/login` or `/register`

### Accessibility Notes

- **Keyboard Navigation:** Tab through fields, Enter submits form, Esc closes (if applicable)
- **Screen Readers:** All fields labeled, errors announced, success messages announced
- **Focus Management:** Focus moves to first error field on validation failure
- **Password Fields:** Show/hide toggle has clear label ("Show password" / "Hide password")
- **Form Submission:** Prevent double submission, show loading state

---

## FLOW 3: PROGRESS TRACKING

### Entry Points
- User clicks "Dashboard" in sidebar navigation
- User completes a course (redirect from course player)
- User views progress from course card

### User Goal
View learning progress, completed courses, and achievements.

### Step-by-Step Flow

#### Step 1: Progress Dashboard (`/dashboard`)

**Screen State: Loading**
- **Visual:** Skeleton cards for stats, skeleton list items for courses
- **Text:** "Loading your progress..."
- **Behavior:** Fetch user progress data from API

**Screen State: Success (Has Progress Data)**
- **Layout:**
  - Page header: Title "My Learning Progress", subtitle
  - Stats cards (3-column grid): Total Enrolled, In Progress, Completed
  - Course progress list: Expandable or scrollable list of courses
- **Content:**
  - **Stats:**
    - Total Enrolled: Count of enrolled courses
    - In Progress: Count of courses with progress > 0% and < 100%
    - Completed: Count of completed courses (100% progress or completion status)
  - **Course List:**
    - Each course: Title, progress bar, percentage, last accessed date, action button
    - Sorted by: Last accessed (most recent first) or progress (highest first)
- **Interactions:**
  - Course row click: Navigate to `/player/:courseId`
  - "Continue Learning" button: Navigate to course player
  - Filter/Sort (if applicable): Filter by status, sort by date/progress
- **Accessibility:**
  - Stats cards have descriptive labels
  - Course list uses semantic list structure (`<ul>`, `<li>`)
  - Progress bars have `aria-label` with percentage
  - Action buttons have descriptive labels

**Screen State: Empty (No Progress)**
- **Visual:** Empty state illustration or icon
- **Message:** "You haven't enrolled in any courses yet"
- **Action:** "Browse Courses" button → `/courses`
- **Accessibility:** Empty state message announced

**Screen State: Error (API Failure)**
- **Visual:** Error alert banner
- **Message:** "Failed to load progress data. Please try again."
- **Action:** "Retry" button
- **Accessibility:** Error in `role="alert"`

### Validation & Error Messages

**Data Load Errors:**
- **Error:** "Failed to load progress data"
- **Recovery:** Retry button, allow partial data display (if some data loads)
- **Prevention:** Show loading state, handle timeouts gracefully

**Progress Calculation Errors:**
- **Behavior:** Show "N/A" or "-" for unavailable data, don't break layout
- **Fallback:** Use enrollment status if progress unavailable

### Permissions / Roles

- **Learner:** Views own progress only
- **Admin:** Views own progress (admin panel shows all users' progress)

### Accessibility Notes

- **Data Tables/Lists:** Use semantic HTML, headers if table format
- **Progress Bars:** `aria-label="Course progress: X percent"`
- **Stats Cards:** Use `<dl>` (definition list) or cards with clear labels
- **Keyboard Navigation:** All interactive elements keyboard accessible
- **Screen Readers:** Progress percentages announced clearly

---

## FLOW 4: ADMIN COURSE MANAGEMENT

### Entry Points
- Admin clicks "Admin" in sidebar navigation (admin role only)
- Admin navigates to `/admin`

### User Goal
Manage courses: upload, edit, delete, view enrollment stats.

### Step-by-Step Flow

#### Step 1: Admin Panel (`/admin`)

**Screen State: Default (Courses Tab)**
- **Layout:**
  - Page header: Title "Admin Panel", subtitle
  - Tabs: Courses | Users | Settings (if applicable)
  - Action bar: "Upload Course" button, search input
  - Course table: Columns (Title, Activity ID, Enrolled, Actions)
- **Content:**
  - Course list: All courses in system
  - Each row: Course title, activity ID (xAPI), enrolled count, action buttons (Edit, Delete)
- **Interactions:**
  - Upload button: Opens upload modal/dialog
  - Search: Filters courses by title
  - Edit button: Opens edit modal/dialog (if implemented)
  - Delete button: Shows confirmation dialog, then deletes
- **Accessibility:**
  - Table has proper headers (`<th>`, scope="col")
  - Action buttons have ARIA labels ("Edit course X", "Delete course X")
  - Search input has label

**Screen State: Loading**
- **Visual:** Skeleton table rows
- **Text:** "Loading courses..."
- **Behavior:** Show while fetching admin data

**Screen State: Empty (No Courses)**
- **Visual:** Empty state
- **Message:** "No courses uploaded yet"
- **Action:** "Upload your first course" button
- **Accessibility:** Empty state announced

**Screen State: Error**
- **Message:** "Failed to load courses. Please try again."
- **Action:** Retry button
- **Accessibility:** Error in `role="alert"`

#### Step 2: Upload Course (Modal/Dialog)

**Trigger:** "Upload Course" button clicked

**Screen State: Default (Upload Form)**
- **Fields:**
  - Course Title: Text input, required
  - Description: Textarea, optional
  - Thumbnail URL: Text input, optional (or file upload)
  - Course Files: File input (directory/zip), required
  - Category: Select dropdown, optional
  - Generate Activity ID: Checkbox (if manual entry option)
  - Activity ID: Text input (if manual, otherwise auto-generated)
- **Actions:**
  - "Upload" button (primary)
  - "Cancel" button (secondary, closes modal)
- **Validation:**
  - Title: Required, not empty
  - Files: Required, valid format
  - Activity ID: Valid format (if manual)

**Screen State: Uploading**
- **Visual:** Progress indicator (if file upload progress available)
- **Text:** "Uploading course..." or "Processing..."
- **Behavior:** Disable form, show progress, prevent close during upload

**Screen State: Success**
- **Behavior:** Close modal, refresh course list, show success toast
- **Toast:** "Course uploaded successfully!"
- **Focus:** Returns to "Upload Course" button or first course in list

**Screen State: Error**
- **Message:** "Failed to upload course. [Specific error if available]"
- **Recovery:** Keep modal open, allow user to fix and retry
- **Accessibility:** Error in `role="alert"`, associated with form

#### Step 3: Delete Course (Confirmation Dialog)

**Trigger:** "Delete" button clicked on course row

**Screen State: Confirmation Dialog**
- **Title:** "Delete Course?"
- **Message:** "Are you sure you want to delete '[Course Title]'? This action cannot be undone."
- **Actions:**
  - "Delete" button (destructive styling)
  - "Cancel" button (secondary)
- **Accessibility:**
  - Dialog has `role="alertdialog"`
  - Focus trapped in dialog
  - Escape key closes dialog (cancels)

**Screen State: Deleting**
- **Visual:** Delete button shows spinner, disabled
- **Text:** "Deleting..."
- **Behavior:** Disable cancel button, prevent close

**Screen State: Success**
- **Behavior:** Close dialog, remove course from list, show success toast
- **Toast:** "Course deleted successfully"
- **Focus:** Returns to course list (or previous focus)

**Screen State: Error**
- **Message:** "Failed to delete course. Please try again."
- **Recovery:** Close dialog, show error toast, allow retry
- **Accessibility:** Error toast in `role="alert"`

### Validation & Error Messages

**Upload Errors:**
- **File too large:** "File size exceeds limit. Maximum size: X MB"
- **Invalid format:** "Invalid file format. Please upload a valid course package."
- **Title required:** "Course title is required"
- **Duplicate activity ID:** "Activity ID already exists. Please use a different ID."
- **Network error:** "Upload failed. Please check your connection and try again."

**Delete Errors:**
- **Course in use:** "Cannot delete course. There are enrolled learners. Please remove enrollments first."
- **Permission error:** "You don't have permission to delete courses"
- **Network error:** "Failed to delete course. Please try again."

### Permissions / Roles

- **Admin Only:** All admin panel routes require admin role
- **Non-Admin Access:** Redirected to `/courses` with toast "Access denied"

### Accessibility Notes

- **Tables:** Proper table structure with headers, keyboard navigation
- **Modals/Dialogs:** Focus trap, Escape to close, return focus on close
- **Forms:** All fields labeled, errors associated with fields
- **Actions:** Confirm destructive actions (delete), provide undo if possible
- **Loading States:** Announce upload/delete progress to screen readers

---

## FLOW 5: ERROR HANDLING (GLOBAL)

### 404 Not Found (`/not-found` or catch-all route)

**Screen State: 404**
- **Visual:** 404 illustration or icon (centered)
- **Title:** "Page Not Found" or "404"
- **Message:** "The page you're looking for doesn't exist."
- **Actions:**
  - "Go to Courses" button → `/courses`
  - "Go to Dashboard" button → `/dashboard`
  - "Go Home" button → `/` (redirects to `/courses`)
- **Accessibility:**
  - Page has proper heading structure
  - Links are keyboard accessible
  - Message announced to screen readers

### 401 Unauthorized / Session Expired

**Screen State: Session Expired**
- **Behavior:** Auto-redirect to `/login`
- **Toast/Message:** "Your session has expired. Please sign in again."
- **State:** Clear token, clear user data
- **Return URL:** Store current URL to redirect after login (if applicable)

### 403 Forbidden / Access Denied

**Screen State: Access Denied**
- **Behavior:** Redirect to `/courses` (or previous page)
- **Toast:** "Access denied. You don't have permission to view this page."
- **Audience:** Non-admin trying to access admin routes

### Network Errors (Global)

**Screen State: Offline / Network Error**
- **Detection:** API calls fail with network error
- **Toast:** "Unable to connect. Please check your internet connection."
- **Recovery:** Retry button (if applicable), graceful degradation
- **Behavior:** Don't break entire UI, show error for affected sections

### Server Errors (500, etc.)

**Screen State: Server Error**
- **Message:** "Something went wrong. Please try again later."
- **Recovery:** Retry button, contact support link (if applicable)
- **Logging:** Error logged to console (development) or error tracking service (production)

---

**END OF FLOW SPECIFICATIONS**

