# LMS Component Specification Sheets

**Document Version:** 1.0  
**Last Updated:** 2024  
**Owner:** UI/UX Architect

---

## COMPONENT: CourseCard

### Purpose
Display course information in a card format, enabling users to quickly understand course details, enrollment status, and progress, then take action (enroll, continue, view).

### Variants

**1. Default (Not Enrolled)**
- Shows course thumbnail, title, description
- Displays "Enroll Now" button
- No progress indicators

**2. Enrolled (In Progress)**
- Shows enrolled badge
- Displays progress bar with percentage
- Shows "Continue Learning" button
- Displays progress percentage badge on thumbnail

**3. Completed**
- Shows "Completed" badge (accent color)
- Progress bar at 100% (accent color)
- May show completion date or score
- "Continue Learning" button or "View Certificate" (if applicable)

### States

| State | Visual | Behavior |
|-------|--------|----------|
| Default | Normal card, hover elevation | Hover: Card elevates, thumbnail scales, play icon overlay appears |
| Hover | Shadow-lg, translate-y-2, thumbnail scale-110 | Play icon overlay fades in |
| Active (Click) | Slight scale-down | Navigate to course player |
| Loading (Enrollment) | Button shows spinner, disabled | Prevent double-click, show loading state |
| Error | Error toast notification | Allow retry enrollment |

### Props (Inputs)

```typescript
interface CourseCardProps {
  courseId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  isEnrolled: boolean;
  enrollmentStatus?: string;
  completionStatus?: 'completed' | 'passed' | 'failed' | 'in-progress';
  progressPercent?: number; // 0-100
  score?: number;
  category?: string;
  onClick?: (courseId: string) => void;
  onEnroll?: (courseId: string, event: React.MouseEvent) => void;
}
```

### Layout & Structure

```
┌──────────────────────────┐
│ [Thumbnail Image]        │
│ [Status Badge: Enrolled] │ ← Top-right
│ [Progress: 45%]          │ ← Top-left (if in progress)
│                          │
│ [Play Icon Overlay]      │ ← On hover (centered)
└──────────────────────────┘
│ Course Title (h3)        │
│ Description text...      │
│                          │
│ [Progress Bar: 45%]      │ ← If enrolled
│ "45% remaining"          │
│                          │
│ [▶ Action Button]        │
└──────────────────────────┘
```

### Styling

- **Container:** `bg-card rounded-2xl border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2`
- **Thumbnail:** `aspect-video w-full object-cover`, gradient fallback if no image
- **Title:** `font-bold text-lg text-foreground line-clamp-2 min-h-[3.5rem]`
- **Description:** `text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]`
- **Badge:** `absolute top-3 right-3` (enrolled/completed badge)
- **Progress Badge:** `absolute top-3 left-3 bg-primary/90 backdrop-blur-sm`
- **Button:** Full width, primary variant, icon + text

### Responsive Behavior

- **Mobile (< 768px):** Full width, single column
- **Tablet (768px - 1024px):** 2 columns in grid
- **Desktop (> 1024px):** 3 columns in grid
- **Large Desktop (> 1400px):** 4 columns in grid (if grid container allows)

### Accessibility

- **Keyboard Navigation:** Card is focusable, Enter/Space activates
- **Screen Reader:** 
  - Card has `role="article"` or `role="button"`
  - Title announced as heading
  - Status badge announced ("Enrolled" or "Completed")
  - Progress announced ("Progress: X percent")
  - Button label is descriptive ("Enroll in [Course Title]" or "Continue [Course Title]")
- **Focus Indicator:** Visible ring on card when focused
- **Images:** Thumbnail has `alt` text (course title or decorative if generic)

### Usage Examples

**DO:**
- Use in grid layouts with consistent spacing
- Show clear enrollment status and progress
- Provide descriptive button labels
- Handle loading and error states

**DON'T:**
- Overwhelm with too much information
- Use generic placeholder images without fallback styling
- Hide progress information
- Make entire card clickable if it conflicts with button actions

### Anti-Patterns

❌ **Avoid:** Multiple nested clickable areas (card + button) without proper event handling  
✅ **Use:** Card click navigates, button click handles enrollment (with event.stopPropagation)

❌ **Avoid:** Progress bar without percentage text  
✅ **Use:** Progress bar + percentage text for clarity

❌ **Avoid:** Truncated titles/descriptions without indication  
✅ **Use:** `line-clamp-2` with hover tooltip or expand on click

---

## COMPONENT: Course Player

### Purpose
Embed and display course content (Storyline/SCORM) in an iframe, handling authentication, progress tracking, and error states.

### Variants

N/A (Single variant, different states)

### States

| State | Visual | Behavior |
|-------|--------|----------|
| Loading | Spinner centered in container, "Loading course content..." | Show while iframe loads |
| Success (Loaded) | Iframe with course content, full-width container | Course plays, xAPI statements sent |
| Error (Load Failed) | Error message, retry button, back link | Allow retry or return to catalog |
| Not Enrolled | Enrollment prompt or auto-enroll | Show enrollment action or auto-enroll |

### Props (Inputs)

```typescript
interface CoursePlayerProps {
  courseId: string;
  courseTitle?: string;
  courseDescription?: string;
  onExit?: () => void; // Optional exit handler
  onComplete?: () => void; // Called when course completes
  onProgressUpdate?: (progress: number) => void; // Progress callback
}
```

### Layout & Structure

```
┌────────────────────────────────────┐
│ Breadcrumbs: Courses > [Title]     │
├────────────────────────────────────┤
│ [← Back to Courses]                │
│                                    │
│ Course Title (h1)                  │
│ Description...                     │
│ Status: [Enrolled] | Progress: X%  │
├────────────────────────────────────┤
│                                    │
│ ┌──────────────────────────────┐  │
│ │                              │  │
│ │   [Loading Spinner]          │  │
│ │   OR                         │  │
│ │   [Course Iframe]            │  │
│ │                              │  │
│ └──────────────────────────────┘  │
│                                    │
│ [Exit Course] (optional)           │
└────────────────────────────────────┘
```

### Styling

- **Container:** `w-full`, aspect ratio maintained (16:9 or full height)
- **Iframe:** `w-full h-full border-0`, allow fullscreen if supported
- **Loading:** Centered spinner, text below
- **Error State:** Error alert styling, centered in container

### Responsive Behavior

- **Mobile:** Full width, may need scroll handling for iframe content
- **Desktop:** Full width, maintain aspect ratio, consider max-height for very tall content

### Accessibility

- **Iframe Title:** `title` attribute describing course ("Course: [Course Title]")
- **Loading State:** Announced to screen readers
- **Error State:** Error message in `role="alert"`
- **Keyboard:** Back button, exit button (if present) keyboard accessible
- **Focus Management:** Focus returns to page after iframe loads (iframe content may capture focus)

### Usage Examples

**DO:**
- Show loading state while course loads
- Provide clear error messages and recovery options
- Handle iframe security (sandbox attributes if needed)
- Track progress via xAPI and update UI accordingly

**DON'T:**
- Leave iframe blank without loading indicator
- Allow iframe to break layout on small screens
- Ignore error states (network failures, course not found)

### Anti-Patterns

❌ **Avoid:** Iframe without loading state  
✅ **Use:** Show spinner and "Loading..." text until iframe loads

❌ **Avoid:** Error state without recovery options  
✅ **Use:** Provide "Retry" and "Back to Courses" options

❌ **Avoid:** Blocking entire page on iframe load failure  
✅ **Use:** Show error in player container, allow navigation away

---

## COMPONENT: Progress Bar

### Purpose
Display course progress as a visual indicator (percentage bar) with optional text label.

### Variants

**1. Default (Standard Progress)**
- Standard height (h-2 or h-2.5)
- Primary color for progress fill
- Muted background

**2. Completed (100%)**
- Accent color for progress fill
- May show checkmark icon

**3. Indeterminate (Loading)**
- Animated shimmer or pulse
- No percentage value

### States

| State | Visual | Behavior |
|-------|--------|----------|
| 0% | Empty bar (background only) | Shows baseline |
| 1-49% | Primary color fill | Standard progress |
| 50-99% | Primary color fill (may be darker) | In-progress state |
| 100% | Accent color fill, may show icon | Completed state |
| Loading | Animated shimmer | Show while calculating |

### Props (Inputs)

```typescript
interface ProgressBarProps {
  value: number; // 0-100
  max?: number; // Default: 100
  showLabel?: boolean; // Show percentage text
  label?: string; // Custom label text
  className?: string; // Additional styling
  variant?: 'default' | 'completed' | 'indeterminate';
}
```

### Layout & Structure

```
┌─────────────────────────────┐
│ [Label: "Your Progress"]    │ ← Optional
│ ┌─────────────────────────┐ │
│ │████████░░░░░░░░░░░░░░░░│ │ ← Progress fill
│ └─────────────────────────┘ │
│ [Percentage: "45%"]         │ ← Optional, right-aligned
│ "45% remaining"             │ ← Optional, below bar
└─────────────────────────────┘
```

### Styling

- **Container:** `w-full`, `bg-secondary` or `bg-muted` for background
- **Fill:** 
  - Default: `bg-primary`, `h-2.5`, rounded
  - Completed: `bg-accent`, `h-2.5`, rounded
- **Label:** `text-xs text-muted-foreground font-medium`
- **Percentage:** `text-xs font-bold text-foreground`

### Responsive Behavior

- **Mobile:** Full width, maintain minimum height for touch
- **Desktop:** Full width, consistent height

### Accessibility

- **ARIA:** `role="progressbar"`, `aria-valuenow={value}`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="Course progress: X percent"`
- **Screen Reader:** Progress percentage announced
- **Visual:** Color alone not used (bar shape + color, or include percentage text)

### Usage Examples

**DO:**
- Use in course cards to show enrollment progress
- Include percentage text for clarity
- Use semantic colors (primary for in-progress, accent for completed)
- Provide ARIA labels

**DON'T:**
- Use without percentage indicator (unless in compact space)
- Use non-semantic colors
- Hide progress information from screen readers

### Anti-Patterns

❌ **Avoid:** Progress bar without text label  
✅ **Use:** Include percentage or descriptive label

❌ **Avoid:** Progress bar without ARIA attributes  
✅ **Use:** `role="progressbar"` with value attributes

❌ **Avoid:** Very thin progress bars (hard to see)  
✅ **Use:** Minimum height of 8px (h-2) for visibility

---

## COMPONENT: Search Input

### Purpose
Allow users to search and filter courses by title or description.

### Variants

**1. Default (Standard Search)**
- Icon on left, input field, clear button (when text entered)
- Full-width or constrained width

**2. Compact (Header/Navbar)**
- Smaller height, icon only on mobile
- Integrated into navigation

### States

| State | Visual | Behavior |
|-------|--------|----------|
| Empty | Placeholder text, search icon | Ready for input |
| Typing | Text visible, clear button (X) appears | Real-time filtering (debounced) |
| Focused | Ring indicator, placeholder may hide | Active input state |
| Disabled | Grayed out, not interactive | Prevent interaction |

### Props (Inputs)

```typescript
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string; // Default: "Search courses..."
  onClear?: () => void; // Called when clear button clicked
  disabled?: boolean;
  className?: string;
  debounceMs?: number; // Default: 300ms
}
```

### Layout & Structure

```
┌─────────────────────────────┐
│ [🔍] [Search courses...] [×]│ ← Icon, input, clear button
└─────────────────────────────┘
```

### Styling

- **Container:** `relative`, `w-full`
- **Icon:** `absolute left-4 top-1/2 -translate-y-1/2`, `text-muted-foreground`, `h-5 w-5`
- **Input:** `pl-12 pr-10` (space for icon and clear), `h-12`, `rounded-xl`, `border-border/50`
- **Clear Button:** `absolute right-4 top-1/2 -translate-y-1/2`, appears when `value.length > 0`

### Responsive Behavior

- **Mobile:** Full width, icon always visible
- **Desktop:** May be constrained width (e.g., max-w-xl), centered or left-aligned

### Accessibility

- **Label:** Visible label or `aria-label` ("Search courses")
- **Input:** `type="search"` or `type="text"` with `role="searchbox"`
- **Clear Button:** `aria-label="Clear search"`, keyboard accessible (Enter/Space)
- **Screen Reader:** Placeholder text announced, value changes announced

### Usage Examples

**DO:**
- Provide clear placeholder text
- Show clear button when text is entered
- Debounce input for performance (300ms default)
- Announce results count after filtering

**DON'T:**
- Use search without label
- Make clear button too small (minimum 44x44px touch target)
- Filter on every keystroke without debouncing

### Anti-Patterns

❌ **Avoid:** Search without clear button  
✅ **Use:** Show clear (X) button when text is entered

❌ **Avoid:** No feedback on search results  
✅ **Use:** Show result count or "No results" message

❌ **Avoid:** Search that clears on blur  
✅ **Use:** Persist search value, clear only via button or explicit action

---

## COMPONENT: Status Badge

### Purpose
Display course enrollment status, completion status, or other categorical information.

### Variants

**1. Enrolled**
- Success color (green)
- Text: "Enrolled"

**2. Completed**
- Accent color (amber)
- Text: "Completed" or "Passed"

**3. In Progress**
- Primary color (blue)
- Text: "In Progress" or progress percentage

**4. Not Started**
- Muted color (gray)
- Text: "Not Started" (if shown)

### States

| State | Visual | Behavior |
|-------|--------|----------|
| Default | Colored background, white or dark text | Static indicator |
| Hover | Slightly darker background (if interactive) | Show tooltip if applicable |

### Props (Inputs)

```typescript
interface StatusBadgeProps {
  status: 'enrolled' | 'completed' | 'in-progress' | 'not-started';
  label?: string; // Custom label (overrides default)
  variant?: 'default' | 'outline';
  className?: string;
}
```

### Layout & Structure

```
[Enrolled]  ← Rounded badge, colored background
```

### Styling

- **Container:** `inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold`
- **Enrolled:** `bg-success text-success-foreground`
- **Completed:** `bg-accent text-accent-foreground`
- **In Progress:** `bg-primary text-primary-foreground`
- **Not Started:** `bg-muted text-muted-foreground`

### Responsive Behavior

- **Mobile:** Maintain readable size, may truncate long labels
- **Desktop:** Standard size, full label visible

### Accessibility

- **Screen Reader:** Badge text announced (status)
- **Color:** Not used alone (text + color, or include icon)
- **Semantic HTML:** Use `<span>` or `<div>` with appropriate `role` if needed

### Usage Examples

**DO:**
- Use consistent colors for each status type
- Position badges prominently (top-right of cards, in lists)
- Use semantic color meanings (green = success, amber = achievement)

**DON'T:**
- Use status badges without clear color coding
- Overuse badges (clutter)
- Use non-semantic colors

### Anti-Patterns

❌ **Avoid:** Badge with color but no text  
✅ **Use:** Text label + color for clarity and accessibility

❌ **Avoid:** Too many badge variants  
✅ **Use:** Standardize on 3-4 key statuses

---

## COMPONENT: Button (Enhanced Spec)

### Purpose
Trigger actions (submit forms, navigate, perform operations). Based on shadcn/ui Button component.

### Variants

| Variant | Usage | Styling |
|---------|-------|---------|
| `default` | Primary actions (Enroll, Submit) | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `outline` | Secondary actions (Cancel, Clear) | `border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground` |
| `ghost` | Tertiary actions (Sign Out, subtle) | `hover:bg-accent/10 hover:text-accent-foreground` |
| `destructive` | Destructive actions (Delete) | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| `accent` | Highlights, achievements | `bg-accent text-accent-foreground` |
| `link` | Text links styled as buttons | `text-primary underline-offset-4 hover:underline` |

### States

| State | Visual | Behavior |
|-------|--------|----------|
| Default | Normal styling | Ready for interaction |
| Hover | Darker background or underline (link) | Cursor pointer |
| Active (Pressed) | Slightly darker, may scale down | Trigger action |
| Focus | Ring indicator (2px, offset 2px) | Keyboard navigation |
| Disabled | Reduced opacity (50%), cursor not-allowed | Non-interactive |
| Loading | Spinner icon, disabled state | Show while processing |

### Props (Inputs)

```typescript
interface ButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'accent' | 'link';
  size?: 'sm' | 'default' | 'lg' | 'xl' | 'icon';
  disabled?: boolean;
  loading?: boolean; // Shows spinner, disables button
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  'aria-label'?: string; // For icon-only buttons
}
```

### Sizes

| Size | Height | Padding | Usage |
|------|--------|---------|-------|
| `sm` | 36px (h-9) | px-4 | Compact spaces, secondary actions |
| `default` | 40px (h-10) | px-5 | Standard actions |
| `lg` | 48px (h-12) | px-8 | Prominent actions, hero sections |
| `xl` | 56px (h-14) | px-10 | Extra prominent (sparingly) |
| `icon` | 40px (h-10 w-10) | - | Icon-only buttons |

### Accessibility

- **Keyboard:** Enter/Space activates, Tab navigates
- **Focus:** Visible ring (2px, offset 2px)
- **Disabled:** `disabled` attribute, `aria-disabled` if needed
- **Loading:** `aria-busy="true"`, prevent interaction
- **Icon-Only:** Must have `aria-label` or accessible text

### Usage Examples

**DO:**
- Use primary variant for main actions
- Show loading state during async operations
- Provide clear, action-oriented labels ("Enroll Now" not "Submit")
- Use appropriate sizes (default for most, lg for hero)

**DON'T:**
- Use destructive variant for non-destructive actions
- Disable buttons without feedback (show loading state)
- Create icon-only buttons without aria-label

### Anti-Patterns

❌ **Avoid:** Button without loading state for async actions  
✅ **Use:** Show spinner, disable button, prevent double-submission

❌ **Avoid:** Generic button labels ("Click here", "Submit")  
✅ **Use:** Descriptive, action-oriented labels ("Enroll Now", "Save Changes")

❌ **Avoid:** Too many primary buttons on one screen  
✅ **Use:** One primary action per section, use secondary/outline for others

---

## COMPONENT: Form Input (Text Input)

### Purpose
Collect text input from users (email, password, search, etc.).

### Variants

**1. Default (Text)**
- Standard text input

**2. Email**
- `type="email"`, validation

**3. Password**
- `type="password"`, show/hide toggle

**4. Search**
- `type="search"` or text with search styling

### States

| State | Visual | Behavior |
|-------|--------|----------|
| Default | Normal border, placeholder | Ready for input |
| Focused | Ring indicator (2px, primary color) | Active input |
| Filled | Text visible, placeholder hidden | Value entered |
| Error | Red border, error message below | Validation failed |
| Disabled | Grayed out, cursor not-allowed | Non-interactive |
| Read-only | Muted background, normal border | Display value |

### Props (Inputs)

```typescript
interface InputProps {
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string; // Visible label
  error?: string; // Error message
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string; // If label not visible
  'aria-describedby'?: string; // Error message ID
  className?: string;
}
```

### Layout & Structure

```
Label (if provided)
┌─────────────────────────────┐
│ [Input field]               │
└─────────────────────────────┘
Error message (if error)       ← Red text, below input
```

### Styling

- **Container:** `w-full`
- **Input:** `h-10 px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- **Error State:** `border-destructive`, error message: `text-destructive text-sm mt-1`
- **Label:** `text-sm font-medium mb-2`

### Accessibility

- **Label:** Visible label (`<label>`) or `aria-label`
- **Error:** Error message associated via `aria-describedby`, error state via `aria-invalid="true"`
- **Required:** `required` attribute, visual indicator (asterisk)
- **Focus:** Visible ring indicator

### Usage Examples

**DO:**
- Always provide labels (visible or aria-label)
- Show error messages near the field
- Use appropriate input types (email, password, etc.)
- Associate errors with fields via aria-describedby

**DON'T:**
- Use placeholder as label (accessibility issue)
- Hide error messages
- Use generic input types when semantic types exist

### Anti-Patterns

❌ **Avoid:** Input without label  
✅ **Use:** Visible label or `aria-label`

❌ **Avoid:** Placeholder as primary label  
✅ **Use:** Label + placeholder for hints

❌ **Avoid:** Error messages not associated with field  
✅ **Use:** `aria-describedby` linking to error message ID

---

**END OF COMPONENT SPECIFICATIONS**

