# LMS UX Architecture & Design System

**Document Version:** 1.0  
**Last Updated:** 2024  
**Owner:** UI/UX Architect  
**Status:** Active

---

## 1. GOAL & USER CONTEXT

### Problem Statement
Create a scalable, consistent, and accessible learning management system that enables learners to discover, enroll in, and complete courses while providing administrators with tools to manage content and track learner progress.

### Primary Users & Jobs-to-Be-Done

#### **Learner (Primary User)**
- **Job 1:** Discover and enroll in relevant courses quickly
- **Job 2:** Resume learning from where they left off
- **Job 3:** Track personal progress and achievements
- **Job 4:** Complete courses and receive certifications/completions

#### **Administrator (Secondary User)**
- **Job 1:** Upload and manage course content
- **Job 2:** Monitor learner enrollment and progress
- **Job 3:** Generate activity IDs for xAPI tracking
- **Job 4:** Manage user accounts and permissions

### Success Metrics
- **Usability:** Users can enroll and launch a course in < 2 clicks
- **Completion:** 70%+ course completion rate for enrolled learners
- **Accessibility:** WCAG 2.1 AA compliance
- **Performance:** < 3s page load time, < 1s interaction response

---

## 2. INFORMATION ARCHITECTURE

### Navigation Structure

```
LMS Application
│
├── Public Routes
│   ├── /login → Login Page
│   └── /register → Registration Page
│
└── Authenticated Routes (ProtectedRoute)
    │
    ├── MainLayout
    │   ├── Sidebar (persistent navigation)
    │   │   ├── Courses (primary)
    │   │   ├── Dashboard (progress tracking)
    │   │   └── Admin (if admin role)
    │   │
    │   └── Main Content Area
    │       ├── /courses → Course Catalog
    │       ├── /player/:courseId → Course Player
    │       ├── /dashboard → Progress Dashboard
    │       └── /admin → Admin Panel (admin only)
    │
    └── / → Redirect to /courses
```

### Screen Inventory

| Route | Page Name | Primary Function | User Role |
|-------|-----------|------------------|-----------|
| `/login` | Login | Authentication | Public |
| `/register` | Register | Account creation | Public |
| `/courses` | Course Catalog | Browse/enroll in courses | Learner, Admin |
| `/player/:courseId` | Course Player | Launch & view course content | Learner, Admin |
| `/dashboard` | Progress Dashboard | View learning progress & stats | Learner, Admin |
| `/admin` | Admin Panel | Course/user management | Admin only |
| `*` | 404 Not Found | Error handling | All |

### Navigation Hierarchy (Mental Model)

**Primary Navigation (Sidebar)**
- **Courses** (Home/Learning Hub) - Always visible
- **Dashboard** (Progress/Stats) - Always visible
- **Admin** (Management) - Conditional (admin role only)

**Secondary Actions (Context-dependent)**
- Course cards → Launch/Continue/Enroll
- Header → User profile, Logout
- Breadcrumbs (where applicable) → Contextual navigation

---

## 3. DESIGN SYSTEM FOUNDATIONS

### Typography Scale

**Font Family:** Plus Jakarta Sans (system fallback: system-ui, sans-serif)

| Element | Size (rem) | Size (px) | Weight | Line Height | Usage |
|---------|-----------|-----------|--------|-------------|-------|
| H1 / Display | 2.5rem | 40px | 700 | 1.2 | Page titles, hero headings |
| H2 / Section | 2rem | 32px | 700 | 1.25 | Section headers |
| H3 / Card Title | 1.5rem | 24px | 600 | 1.3 | Card titles, subsection headers |
| H4 | 1.25rem | 20px | 600 | 1.4 | Subheadings |
| Body Large | 1.125rem | 18px | 400 | 1.6 | Prominent body text |
| Body / Base | 1rem | 16px | 400 | 1.5 | Default body text |
| Body Small | 0.875rem | 14px | 400 | 1.5 | Secondary text, captions |
| Caption | 0.75rem | 12px | 400 | 1.4 | Labels, metadata, timestamps |

**Semantic Font Weights:**
- **400 (Regular):** Body text, descriptions
- **500 (Medium):** Emphasis, labels
- **600 (Semibold):** Headings, card titles, buttons
- **700 (Bold):** Page titles, strong emphasis
- **800 (Extrabold):** Display text (sparingly)

### Spacing Scale

Based on **8px base unit** for consistency and alignment:

| Token | Value (px) | Value (rem) | Usage |
|-------|-----------|-------------|-------|
| Space 0 | 0px | 0 | No spacing |
| Space 1 | 4px | 0.25rem | Tight spacing (icons in buttons) |
| Space 2 | 8px | 0.5rem | XS spacing (compact lists) |
| Space 3 | 12px | 0.75rem | Small spacing (form fields) |
| Space 4 | 16px | 1rem | Base spacing (default padding) |
| Space 5 | 20px | 1.25rem | Medium spacing |
| Space 6 | 24px | 1.5rem | Card padding, section gaps |
| Space 8 | 32px | 2rem | Large spacing (section separation) |
| Space 10 | 40px | 2.5rem | XL spacing (page sections) |
| Space 12 | 48px | 3rem | XXL spacing (major sections) |
| Space 16 | 64px | 4rem | Hero spacing (sparingly) |

**Container Padding:**
- **Mobile:** 1rem (16px) horizontal
- **Desktop:** 2rem (32px) horizontal
- **Max-width containers:** 1280px (7xl breakpoint)

### Color System

**Primary Palette (Deep Indigo/Navy)**
- **Primary:** `hsl(224 71% 20%)` - Trust, education, primary actions
- **Primary Foreground:** `hsl(210 40% 98%)` - Text on primary backgrounds
- **Primary/90:** Hover state for primary buttons

**Secondary Palette (Slate)**
- **Secondary:** `hsl(220 14% 96%)` - Subtle backgrounds, inactive states
- **Secondary Foreground:** `hsl(222 47% 11%)` - Text on secondary backgrounds

**Accent (Amber/Warm)**
- **Accent:** `hsl(38 92% 50%)` - Achievements, highlights, progress indicators
- **Accent Foreground:** `hsl(222 47% 11%)` - Text on accent backgrounds

**Semantic Colors**
- **Success:** `hsl(142 71% 45%)` - Completed states, success messages
- **Warning:** `hsl(38 92% 50%)` - Warnings, attention needed
- **Info:** `hsl(199 89% 48%)` - Informational messages
- **Destructive:** `hsl(0 84% 60%)` - Errors, delete actions

**Neutral Palette**
- **Background:** `hsl(220 30% 98%)` - Main page background
- **Foreground:** `hsl(222 47% 11%)` - Primary text color
- **Muted:** `hsl(220 14% 96%)` - Subtle backgrounds
- **Muted Foreground:** `hsl(220 9% 46%)` - Secondary text, hints
- **Border:** `hsl(220 13% 91%)` - Borders, dividers
- **Card:** `hsl(0 0% 100%)` - Card backgrounds

### Layout Rules

**Grid System**
- **Container:** Max-width 1280px (7xl), centered, responsive padding
- **Breakpoints:**
  - Mobile: < 768px (single column, stacked)
  - Tablet: 768px - 1024px (2 columns where appropriate)
  - Desktop: > 1024px (3 columns for grids, full layout)
  - Large Desktop: > 1400px (4 columns for dense grids)

**Layout Patterns**
- **Sidebar:** Fixed 256px width (16rem) on desktop, hidden on mobile (drawer)
- **Main Content:** Flex-1, padding: 2rem (32px) on desktop, 1rem on mobile
- **Card Grids:** Responsive columns (1 → 2 → 3 → 4 based on breakpoint)
- **Form Layout:** Single column on mobile, 2 columns for related fields on desktop

**Border Radius**
- **Base Radius:** 0.75rem (12px) - Cards, buttons, inputs
- **Small:** 0.5rem (8px) - Badges, small elements
- **Large:** 1rem (16px) - Modals, hero sections

**Shadows (Elevation)**
- **sm:** Subtle elevation (inputs, borders)
- **md:** Card elevation (default cards)
- **lg:** Prominent elevation (hover states, modals)
- **xl:** High elevation (dropdowns, popovers)
- **glow:** Special effects (accent highlights)

### Accessibility Standards

**WCAG 2.1 AA Compliance Targets:**
- **Color Contrast:** Minimum 4.5:1 for normal text, 3:1 for large text
- **Focus Indicators:** Visible 2px ring, 2px offset (ring-ring, ring-offset-2)
- **Keyboard Navigation:** All interactive elements accessible via Tab/Enter/Space
- **Screen Readers:** Semantic HTML, ARIA labels where needed, alt text for images
- **Motion:** Respect `prefers-reduced-motion` (disable animations)

**Interaction Patterns:**
- **Focus Order:** Logical tab sequence (top → bottom, left → right)
- **Error States:** Clear, descriptive error messages with recovery actions
- **Loading States:** Skeleton screens or spinners with descriptive text
- **Empty States:** Helpful messaging with clear next actions

---

## 4. CORE WORKFLOW: TEXT WIREFRAMES

### Workflow 1: Course Discovery & Enrollment

**Screen 1: Course Catalog (`/courses`)**

```
┌─────────────────────────────────────────────────────────┐
│ HEADER: Logo | Courses | Dashboard | [User] [Sign Out] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ HERO SECTION (bg-primary/5)                            │
│ ┌─────────────────────────────────────────────────┐   │
│ │  My Courses                                     │   │
│ │  Click on any course to launch the Storyline   │   │
│ │  content                                        │   │
│ │                                                 │   │
│ │  [🔍 Search courses...]                        │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ CONTENT AREA                                            │
│ ┌──────────┬──────────────────────────────────────┐   │
│ │ SIDEBAR  │ MAIN CONTENT                         │   │
│ │          │                                      │   │
│ │ Filters: │ [X courses available]               │   │
│ │ Categories│                                      │   │
│ │ • All (X)│                                      │   │
│ │ • Dev (X)│ ┌─────┐ ┌─────┐ ┌─────┐           │   │
│ │ • Design │ │Card │ │Card │ │Card │           │   │
│ │          │ └─────┘ └─────┘ └─────┘           │   │
│ │ [Clear]  │                                      │   │
│ │          │                                      │   │
│ └──────────┴──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

Course Card Structure:
┌──────────────────────┐
│ [Thumbnail/Image]    │
│ [Badge: Enrolled]    │
│ [Progress: 45%]      │
├──────────────────────┤
│ Course Title         │
│ Description text...  │
│                      │
│ [Progress Bar: 45%]  │
│ 45% remaining        │
│                      │
│ [▶ Continue Learning]│
└──────────────────────┘
```

**Screen 2: Course Detail / Launch (`/player/:courseId`)**

```
┌─────────────────────────────────────────────────────────┐
│ HEADER: Logo | Courses | Dashboard | [User] [Sign Out] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ BREADCRUMBS: Courses > [Course Title]                  │
│                                                         │
│ COURSE HEADER                                          │
│ ┌─────────────────────────────────────────────────┐   │
│ │ [← Back to Courses]                             │   │
│ │                                                  │   │
│ │ Course Title                                    │   │
│ │ Description...                                  │   │
│ │                                                  │   │
│ │ Status: [Enrolled] | Progress: 45%             │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ COURSE PLAYER (iframe container)                       │
│ ┌─────────────────────────────────────────────────┐   │
│ │                                                  │   │
│ │  [Loading spinner...]                           │   │
│ │  OR                                              │   │
│ │  [Embedded Storyline course iframe]             │   │
│ │                                                  │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ [Exit Course] button (if applicable)                   │
└─────────────────────────────────────────────────────────┘
```

**Screen 3: Progress Dashboard (`/dashboard`)**

```
┌─────────────────────────────────────────────────────────┐
│ HEADER: Logo | Courses | Dashboard | [User] [Sign Out] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ PAGE HEADER                                             │
│ ┌─────────────────────────────────────────────────┐   │
│ │ My Learning Progress                            │   │
│ │ Track your course completions and achievements  │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ STATS CARDS (3-column grid)                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│ │ Total    │ │ In       │ │ Completed│            │   │
│ │ Enrolled │ │ Progress │ │          │            │   │
│ │   12     │ │    5     │ │    7     │            │   │
│ └──────────┘ └──────────┘ └──────────┘            │   │
│                                                         │
│ COURSE PROGRESS LIST                                    │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Course Title 1              [45%] [▶ Continue] │   │
│ │ Last accessed: 2 days ago                      │   │
│ ├─────────────────────────────────────────────────┤   │
│ │ Course Title 2              [100%] [✓ Complete]│   │
│ │ Completed: 1 week ago                          │   │
│ └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Workflow 2: Authentication

**Screen 4: Login (`/login`)**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────────┐  ┌─────────────────────┐           │
│  │ LEFT PANEL   │  │ RIGHT PANEL (FORM)  │           │
│  │ (Branding)   │  │                     │           │
│  │              │  │ Sign In             │           │
│  │ [Logo]       │  │                     │           │
│  │ Creative     │  │ Email               │           │
│  │ Learning     │  │ [_________________] │           │
│  │              │  │                     │           │
│  │ Welcome to   │  │ Password            │           │
│  │ Your Learning│  │ [_________________] [👁]       │
│  │ Journey      │  │                     │           │
│  │              │  │ [ ] Remember me     │           │
│  │ ✓ xAPI-      │  │                     │           │
│  │   powered    │  │ [Sign In]           │           │
│  │ ✓ Storyline  │  │                     │           │
│  │   support    │  │ Don't have account? │           │
│  │ ✓ Resume     │  │ [Create account]    │           │
│  │              │  │                     │           │
│  └──────────────┘  └─────────────────────┘           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Workflow 3: Admin Management

**Screen 5: Admin Panel (`/admin`)**

```
┌─────────────────────────────────────────────────────────┐
│ HEADER: Logo | Courses | Dashboard | Admin | [Sign Out]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ADMIN PANEL HEADER                                      │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Admin Panel                                     │   │
│ │ Manage courses, users, and system settings      │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ TABS: [Courses] [Users] [Settings]                     │
│                                                         │
│ COURSES TAB CONTENT                                     │
│ ┌─────────────────────────────────────────────────┐   │
│ │ [+ Upload Course]  [Search...]                  │   │
│ │                                                  │   │
│ │ Course List (Table)                             │   │
│ │ ┌──────┬──────────┬──────────┬──────────┐     │   │
│ │ │Title │ Activity │ Enrolled │ Actions  │     │   │
│ │ ├──────┼──────────┼──────────┼──────────┤     │   │
│ │ │Course│ xyz-123  │    12    │ [Edit]   │     │   │
│ │ │ 1    │          │          │ [Delete] │     │   │
│ │ └──────┴──────────┴──────────┴──────────┘     │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. COMPONENT INVENTORY (MVP)

### Layout Components

| Component | Purpose | Variants | Status |
|-----------|---------|----------|--------|
| `MainLayout` | Container for authenticated pages | Default | ✅ Exists |
| `Sidebar` | Primary navigation | Collapsed (mobile) | ✅ Exists |
| `Navbar` | Top navigation bar | Mobile menu | ✅ Exists |
| `Footer` | Page footer | Default | ✅ Exists |

### Navigation Components

| Component | Purpose | Variants | Status |
|-----------|---------|----------|--------|
| `Breadcrumbs` | Contextual navigation | Default | ✅ (UI library) |
| `NavigationMenu` | Dropdown navigation | Default | ✅ (UI library) |
| `Tabs` | Tab navigation | Default, vertical | ✅ (UI library) |

### Data Display Components

| Component | Purpose | Variants | Status |
|-----------|---------|----------|--------|
| `CourseCard` | Course display card | Default, enrolled, completed | ✅ Exists |
| `Card` | Generic card container | Default, hover | ✅ (UI library) |
| `Badge` | Status indicators | Default, success, warning | ✅ (UI library) |
| `Progress` | Progress bars | Default, indeterminate | ✅ (UI library) |
| `Table` | Data tables | Default, striped, hover | ✅ (UI library) |
| `Avatar` | User avatars | Default, sizes | ✅ (UI library) |

### Form Components

| Component | Purpose | Variants | Status |
|-----------|---------|----------|--------|
| `Input` | Text input fields | Default, error, disabled | ✅ (UI library) |
| `Label` | Form labels | Default | ✅ (UI library) |
| `Button` | Action buttons | default, outline, ghost, destructive, accent | ✅ (UI library) |
| `Checkbox` | Checkbox inputs | Default, checked, disabled | ✅ (UI library) |
| `Select` | Dropdown selects | Default, multi-select | ✅ (UI library) |
| `Textarea` | Multi-line text | Default, error | ✅ (UI library) |

### Feedback Components

| Component | Purpose | Variants | Status |
|-----------|---------|----------|--------|
| `Alert` | Informational alerts | Default, success, error, warning | ✅ (UI library) |
| `Toast` | Temporary notifications | Success, error, info | ✅ (UI library) |
| `Dialog` | Modal dialogs | Default, alert, confirm | ✅ (UI library) |
| `Skeleton` | Loading placeholders | Default, custom shapes | ✅ (UI library) |
| `ProgressIndicator` | Custom progress display | Default | ✅ Exists |

### Overlay Components

| Component | Purpose | Variants | Status |
|-----------|---------|----------|--------|
| `Tooltip` | Hover tooltips | Default | ✅ (UI library) |
| `Popover` | Contextual popovers | Default | ✅ (UI library) |
| `Sheet` | Side panels (mobile) | Left, right, bottom | ✅ (UI library) |
| `DropdownMenu` | Context menus | Default | ✅ (UI library) |

### Specialized Components

| Component | Purpose | Variants | Status |
|-----------|---------|----------|--------|
| `CoursePlayer` | Embedded course iframe | Default, loading, error | ✅ (Page component) |
| `ProtectedRoute` | Route guard | Default, requireAdmin | ✅ Exists |

---

## 6. EDGE CASES & ACCESSIBILITY NOTES

### Empty States

**No Courses Available:**
- **Message:** "No courses available at this time"
- **Action:** Admin-only: "Upload your first course" button
- **Visual:** Empty state illustration or icon

**No Search Results:**
- **Message:** "No courses found matching your criteria"
- **Action:** "Reset Filters" button
- **Visual:** Search icon or empty state

**No Progress Data:**
- **Message:** "You haven't enrolled in any courses yet"
- **Action:** "Browse Courses" button linking to `/courses`

### Error States

**Course Load Failure:**
- **Message:** "Failed to load course. Please try again."
- **Action:** "Retry" button
- **Fallback:** Link to course catalog

**Network Error:**
- **Message:** "Unable to connect. Please check your internet connection."
- **Action:** "Retry" button
- **Visual:** Error icon, non-blocking toast notification

**Authentication Error:**
- **Message:** "Your session has expired. Please sign in again."
- **Action:** Redirect to `/login` with return URL

### Loading States

**Course Catalog Loading:**
- **Visual:** Skeleton cards (3-6 cards)
- **Text:** "Loading courses..."

**Course Player Loading:**
- **Visual:** Spinner in center of iframe container
- **Text:** "Loading course content..."

**Form Submission Loading:**
- **Visual:** Button shows spinner, disabled state
- **Text:** Button text changes to "Loading..." or "Processing..."

### Permission Edge Cases

**Non-Admin Accessing Admin Routes:**
- **Behavior:** Redirect to `/courses` with toast: "Access denied"
- **Status Code:** 403 handling

**Unauthenticated Access:**
- **Behavior:** Redirect to `/login` with return URL parameter
- **Message:** "Please sign in to continue"

### Accessibility Considerations

**Keyboard Navigation:**
- **Tab Order:** Logical sequence (sidebar → main content → actions)
- **Skip Links:** "Skip to main content" link (if applicable)
- **Focus Management:** Focus trap in modals, return focus on close

**Screen Reader Support:**
- **ARIA Labels:** All icons, buttons, form fields have descriptive labels
- **Live Regions:** Toast notifications announced via `aria-live`
- **Landmarks:** Semantic HTML5 elements (`<nav>`, `<main>`, `<aside>`)

**Visual Accessibility:**
- **Color Contrast:** All text meets WCAG AA standards
- **Focus Indicators:** 2px ring, high contrast
- **Text Scaling:** Supports up to 200% zoom without horizontal scrolling

**Motion Preferences:**
- **Reduced Motion:** Respect `prefers-reduced-motion: reduce`
- **Animations:** Disable or reduce animations when preference set

---

## 7. HANDOFF NOTES FOR ENGINEERING + QA

### Implementation Priorities

**Phase 1: Core Functionality (MVP)**
1. Authentication flow (login/register)
2. Course catalog with search/filter
3. Course player integration
4. Basic progress tracking

**Phase 2: Enhanced Features**
1. Progress dashboard with analytics
2. Admin panel (course/user management)
3. Advanced filtering and sorting

**Phase 3: Polish & Optimization**
1. Performance optimization
2. Advanced accessibility features
3. Offline support (if needed)

### Technical Specifications

**Component Library:**
- Use existing shadcn/ui components from `/components/ui/`
- Follow existing patterns in `CourseCard`, `MainLayout`
- Use Tailwind CSS classes, prefer semantic tokens (e.g., `bg-primary` not `bg-[#123456]`)

**State Management:**
- React Query for server state (courses, progress)
- React Context/State for UI state (modals, filters)
- Local storage for user preferences (if applicable)

**API Integration:**
- Use `api` service from `/services/api.ts`
- Error handling: Display user-friendly messages via toast
- Loading states: Show skeletons or spinners

**Responsive Behavior:**
- Mobile-first approach
- Sidebar collapses to drawer on mobile (< 768px)
- Grid layouts: 1 col (mobile) → 2 col (tablet) → 3 col (desktop)

### Testing Checklist for QA

**Functional Testing:**
- [ ] All routes accessible with correct permissions
- [ ] Course enrollment/launch flow works end-to-end
- [ ] Progress tracking updates correctly
- [ ] Search and filter functionality
- [ ] Admin actions (upload, delete, manage users)

**Accessibility Testing:**
- [ ] Keyboard navigation (Tab, Enter, Space, Esc)
- [ ] Screen reader compatibility (NVDA/JAWS/VoiceOver)
- [ ] Color contrast ratios (use tools like WAVE, axe DevTools)
- [ ] Focus indicators visible on all interactive elements
- [ ] Forms have proper labels and error messages

**Cross-Browser Testing:**
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, macOS/iOS)
- [ ] Mobile browsers (iOS Safari, Chrome Android)

**Performance Testing:**
- [ ] Page load time < 3s on 3G connection
- [ ] Interaction response < 1s
- [ ] No layout shift (CLS < 0.1)
- [ ] Images optimized (lazy loading, appropriate sizes)

**Edge Case Testing:**
- [ ] Empty states (no courses, no results)
- [ ] Error states (network errors, API failures)
- [ ] Loading states (skeletons, spinners)
- [ ] Permission errors (403, 401)
- [ ] Very long course titles/descriptions (text truncation)

---

## 8. DESIGN QA CHECKLIST

### Visual Consistency

**Spacing & Alignment:**
- [ ] Consistent spacing using 8px grid (space-1 through space-16)
- [ ] Cards have consistent padding (p-5 or p-6)
- [ ] Sections have consistent margins (mb-8, mt-8)
- [ ] Text alignment consistent (left-aligned body, center-aligned hero text)

**Typography:**
- [ ] Heading hierarchy correct (H1 → H2 → H3)
- [ ] Font weights used consistently (600 for headings, 400 for body)
- [ ] Line heights appropriate (1.5 for body, 1.2-1.3 for headings)
- [ ] Text truncation applied where needed (line-clamp utilities)

**Colors:**
- [ ] Primary actions use `primary` color
- [ ] Accent used for achievements/highlights only
- [ ] Semantic colors used appropriately (success, error, warning)
- [ ] Muted colors for secondary text and inactive states

**Layout:**
- [ ] Grid layouts responsive (1 → 2 → 3 columns)
- [ ] Container max-width 1280px, centered
- [ ] Sidebar width 256px on desktop, hidden on mobile
- [ ] Forms single column on mobile, 2 columns on desktop (where appropriate)

### Accessibility

**Contrast:**
- [ ] Text contrast ratio ≥ 4.5:1 (normal text)
- [ ] Text contrast ratio ≥ 3:1 (large text, 18px+)
- [ ] Interactive elements have sufficient contrast
- [ ] Error states use high-contrast colors

**Keyboard Navigation:**
- [ ] All interactive elements accessible via keyboard
- [ ] Focus indicators visible (2px ring, offset 2px)
- [ ] Tab order logical (top → bottom, left → right)
- [ ] Modal/dialog focus trap works correctly
- [ ] Escape key closes modals/dropdowns

**Screen Readers:**
- [ ] Semantic HTML used (`<button>`, `<nav>`, `<main>`)
- [ ] ARIA labels on icons and icon-only buttons
- [ ] Form labels associated with inputs (`htmlFor` + `id`)
- [ ] Error messages associated with form fields (`aria-describedby`)
- [ ] Live regions for dynamic content (toasts)

**Visual Accessibility:**
- [ ] No reliance on color alone (icons, shapes, text used with color)
- [ ] Focus indicators don't rely on color alone (border/ring visible)
- [ ] Text scales up to 200% without horizontal scroll
- [ ] Touch targets ≥ 44x44px on mobile

### Copy Clarity

**Microcopy:**
- [ ] Button labels are action-oriented ("Enroll Now" not "Submit")
- [ ] Error messages are clear and actionable
- [ ] Empty states provide guidance ("No courses found" + action button)
- [ ] Loading states indicate what's happening ("Loading courses...")

**Error Messages:**
- [ ] Errors explain what went wrong in plain language
- [ ] Errors suggest how to fix the problem
- [ ] Field-level errors appear near the field
- [ ] Global errors appear prominently (alert/toast)

**Labels & Instructions:**
- [ ] Form fields have clear labels
- [ ] Help text provided where needed (e.g., password requirements)
- [ ] Placeholder text is helpful but not required (don't hide labels)

### Responsiveness

**Breakpoints:**
- [ ] Mobile (< 768px): Single column, stacked layout, drawer navigation
- [ ] Tablet (768px - 1024px): 2-column grids, sidebar visible
- [ ] Desktop (> 1024px): 3-column grids, full sidebar
- [ ] Large Desktop (> 1400px): 4-column grids (if applicable)

**Touch Targets:**
- [ ] Buttons ≥ 44x44px on mobile
- [ ] Links have adequate spacing (no accidental clicks)
- [ ] Form inputs have adequate padding for touch

**Content Adaptation:**
- [ ] Images scale appropriately (object-cover, aspect-ratio)
- [ ] Text doesn't overflow containers
- [ ] Tables scroll horizontally on mobile (or stack)
- [ ] Modals/dialogs fit viewport on mobile

### Edge States

**Empty States:**
- [ ] All empty states have helpful messaging
- [ ] Empty states include call-to-action buttons
- [ ] Empty states are visually distinct (icons, illustrations)

**Loading States:**
- [ ] Loading indicators shown for async operations
- [ ] Skeletons match content layout
- [ ] Loading text indicates what's loading

**Error States:**
- [ ] Error states are clearly visible
- [ ] Error messages are user-friendly
- [ ] Recovery actions provided (Retry, Go Back, Contact Support)

**Success States:**
- [ ] Success feedback provided (toast, confirmation message)
- [ ] Success states indicate next steps (if applicable)

---

## 9. DESIGN SYSTEM TOKENS (REFERENCE)

### CSS Custom Properties (Already Defined)

See `frontend/src/index.css` for full token definitions. Key tokens:

```css
/* Spacing (use Tailwind classes: p-4, m-6, gap-8, etc.) */
/* Colors (use semantic tokens: bg-primary, text-foreground, etc.) */
/* Typography (use Tailwind: text-2xl, font-semibold, etc.) */
/* Shadows (use Tailwind: shadow-md, shadow-lg, etc.) */
/* Border Radius (use Tailwind: rounded-lg, rounded-xl, etc.) */
```

### Usage Guidelines

**DO:**
- Use semantic color tokens (`bg-primary`, not `bg-[#123456]`)
- Use spacing scale tokens (`p-6`, not `p-[23px]`)
- Use typography utilities (`text-lg font-semibold`, not inline styles)
- Maintain consistency with existing patterns

**DON'T:**
- Hardcode colors, spacing, or font sizes
- Create new component variants without documenting them
- Break responsive patterns (always test mobile first)
- Skip accessibility considerations

---

**END OF UX ARCHITECTURE DOCUMENT**



