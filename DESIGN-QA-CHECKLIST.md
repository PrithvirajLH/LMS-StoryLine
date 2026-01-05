# Design QA Checklist

**Use this checklist before marking any feature as "Design Complete" or before release.**

---

## 📐 VISUAL CONSISTENCY

### Spacing & Alignment
- [ ] Spacing follows 8px grid system (use Tailwind spacing scale: space-1 through space-16)
- [ ] Cards have consistent padding (p-5 or p-6, typically 20-24px)
- [ ] Section margins consistent (mb-8 for major sections, mb-6 for subsections)
- [ ] Text alignment consistent (body text left-aligned, hero text center-aligned where appropriate)
- [ ] Grid gaps consistent (gap-6 for card grids, gap-4 for tighter layouts)

### Typography
- [ ] Heading hierarchy correct (H1 → H2 → H3, no skipping levels)
- [ ] Font weights used consistently:
  - 600 (semibold) for headings and card titles
  - 400 (regular) for body text
  - 700 (bold) only for page titles or strong emphasis
- [ ] Line heights appropriate:
  - 1.5 for body text
  - 1.2-1.3 for headings
- [ ] Text truncation applied where needed (`line-clamp-2`, `line-clamp-3`)
- [ ] Font sizes use design system scale (text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl, text-4xl)

### Colors
- [ ] Primary actions use `primary` color (buttons, links, active states)
- [ ] Accent color used only for achievements, highlights, completion states
- [ ] Semantic colors used appropriately:
  - `success` for completed states, success messages
  - `destructive` for errors, delete actions
  - `warning` for warnings (if applicable)
  - `info` for informational messages (if applicable)
- [ ] Muted colors (`muted`, `muted-foreground`) used for secondary text and inactive states
- [ ] No hardcoded colors (use semantic tokens: `bg-primary`, not `bg-[#123456]`)

### Layout
- [ ] Grid layouts responsive:
  - Mobile: 1 column
  - Tablet: 2 columns
  - Desktop: 3 columns (or 4 if appropriate)
- [ ] Container max-width 1280px (7xl), centered
- [ ] Sidebar width 256px (16rem) on desktop, hidden/collapsed on mobile
- [ ] Forms: Single column on mobile, 2 columns on desktop (where appropriate)
- [ ] No horizontal scroll on any screen size (up to 1920px width)

### Border Radius & Shadows
- [ ] Border radius consistent:
  - Cards, buttons, inputs: `rounded-lg` (12px)
  - Small elements (badges): `rounded-md` or `rounded-full`
  - Large elements (modals): `rounded-xl` (16px)
- [ ] Shadows used for elevation:
  - Cards: `shadow-md`
  - Hover states: `shadow-lg`
  - Modals/dialogs: `shadow-xl`
- [ ] No inconsistent border radius or shadow usage

---

## ♿ ACCESSIBILITY

### Color Contrast
- [ ] All text meets WCAG AA contrast ratio:
  - Normal text (16px): ≥ 4.5:1
  - Large text (18px+ or bold): ≥ 3:1
- [ ] Interactive elements (buttons, links) have sufficient contrast
- [ ] Error states use high-contrast colors
- [ ] Focus indicators have sufficient contrast
- **Tools:** Use browser DevTools (Lighthouse) or WAVE/axe DevTools to verify

### Keyboard Navigation
- [ ] All interactive elements accessible via keyboard (Tab, Enter, Space, Esc)
- [ ] Tab order logical (top → bottom, left → right)
- [ ] Focus indicators visible on all interactive elements:
  - 2px ring, 2px offset
  - Uses `ring-ring` color (or high-contrast alternative)
- [ ] Modal/dialog focus trap works correctly (Tab cycles within modal, Esc closes)
- [ ] Dropdown menus keyboard accessible (Arrow keys navigate, Enter/Space select)
- [ ] Skip links present (if applicable for complex layouts)

### Screen Reader Support
- [ ] Semantic HTML used:
  - `<button>` for buttons (not `<div>` with onClick)
  - `<nav>` for navigation
  - `<main>` for main content
  - `<header>`, `<footer>` where appropriate
- [ ] All icons have `aria-label` or are decorative (`aria-hidden="true"`)
- [ ] Form labels associated with inputs:
  - Visible `<label>` with `htmlFor` matching input `id`
  - OR `aria-label` on input
- [ ] Error messages associated with form fields:
  - Use `aria-describedby` linking to error message ID
  - Set `aria-invalid="true"` on field when error exists
- [ ] Dynamic content announced:
  - Toast notifications use `role="alert"` or `aria-live="polite"`
  - Loading states announced ("Loading courses...")
  - Progress updates announced (if applicable)
- [ ] Images have descriptive `alt` text:
  - Decorative images: `alt=""` or `aria-hidden="true"`
  - Informative images: Descriptive alt text
- [ ] Tables have proper structure:
  - `<thead>`, `<tbody>` where applicable
  - `<th>` with `scope="col"` or `scope="row"`
  - Caption or `aria-label` for table description

### Visual Accessibility
- [ ] No reliance on color alone to convey information:
  - Status indicators use icons, shapes, or text in addition to color
  - Error states use icons and text, not just red color
- [ ] Focus indicators don't rely on color alone (border/ring visible, not just color change)
- [ ] Text scales up to 200% (zoom) without horizontal scrolling
- [ ] Touch targets ≥ 44x44px on mobile (buttons, links, interactive elements)
- [ ] Motion preferences respected:
  - Animations disabled or reduced when `prefers-reduced-motion: reduce` is set
  - Use `@media (prefers-reduced-motion: reduce)` in CSS

---

## 📝 COPY CLARITY

### Microcopy
- [ ] Button labels are action-oriented and clear:
  - ✅ "Enroll Now" (not "Submit")
  - ✅ "Continue Learning" (not "Open")
  - ✅ "Delete Course" (not "Remove")
- [ ] Error messages explain what went wrong in plain language:
  - ✅ "Invalid email or password. Please try again."
  - ❌ "Error 401: Authentication failed"
- [ ] Empty states provide guidance:
  - ✅ "No courses found. Try adjusting your filters."
  - ❌ "No results"
- [ ] Loading states indicate what's happening:
  - ✅ "Loading courses..."
  - ✅ "Uploading course..."
  - ❌ "Loading..." (too generic)

### Error Messages
- [ ] Errors explain what went wrong clearly
- [ ] Errors suggest how to fix the problem:
  - ✅ "Password must be at least 8 characters"
  - ❌ "Invalid password"
- [ ] Field-level errors appear near the field (below input)
- [ ] Global errors appear prominently (alert banner, toast)
- [ ] Error messages are not technical/jargony (avoid stack traces, error codes in UI)

### Labels & Instructions
- [ ] Form fields have clear, descriptive labels
- [ ] Help text provided where needed (e.g., password requirements, format hints)
- [ ] Placeholder text is helpful but not required (labels should be visible, placeholders are hints)
- [ ] Required fields indicated (asterisk * or "required" text)
- [ ] Button purposes clear from label (no ambiguous "OK" or "Cancel" without context)

---

## 📱 RESPONSIVENESS

### Breakpoints
- [ ] Mobile (< 768px):
  - Single column layouts
  - Stacked elements (no side-by-side where inappropriate)
  - Drawer/sheet for sidebar navigation
  - Full-width buttons and inputs
- [ ] Tablet (768px - 1024px):
  - 2-column grids where appropriate
  - Sidebar visible (may be collapsible)
  - Forms may use 2 columns for related fields
- [ ] Desktop (> 1024px):
  - 3-column grids for card layouts
  - Full sidebar visible
  - Optimal spacing and layout
- [ ] Large Desktop (> 1400px):
  - 4-column grids (if applicable)
  - Content doesn't stretch too wide (use max-width containers)

### Touch Targets
- [ ] Buttons ≥ 44x44px on mobile (minimum touch target size)
- [ ] Links have adequate spacing (no accidental clicks)
- [ ] Form inputs have adequate padding for touch (minimum 12px padding)
- [ ] Interactive elements not too close together (minimum 8px gap)

### Content Adaptation
- [ ] Images scale appropriately:
  - Use `object-cover` for thumbnails
  - Maintain aspect ratios (`aspect-video`, `aspect-square`)
  - Responsive sizing (`w-full`, `max-w-full`)
- [ ] Text doesn't overflow containers:
  - Use `truncate` or `line-clamp` where needed
  - Long words break appropriately (`break-words`)
- [ ] Tables scroll horizontally on mobile (or stack into cards)
- [ ] Modals/dialogs fit viewport on mobile:
  - Full-width on mobile
  - Max-height with scroll if content is long
- [ ] Navigation adapts:
  - Desktop: Horizontal nav or sidebar
  - Mobile: Hamburger menu, drawer, or bottom nav

---

## 🔄 EDGE STATES

### Empty States
- [ ] All empty states have helpful messaging:
  - ✅ "You haven't enrolled in any courses yet"
  - ✅ "No courses found matching your criteria"
  - ❌ "No data"
- [ ] Empty states include call-to-action buttons where appropriate:
  - "Browse Courses" button
  - "Upload Course" button (admin)
  - "Reset Filters" button
- [ ] Empty states are visually distinct (icons, illustrations, or styling)

### Loading States
- [ ] Loading indicators shown for all async operations:
  - API calls (fetching courses, progress, etc.)
  - Form submissions
  - File uploads
- [ ] Skeletons match content layout:
  - Card skeletons match card structure
  - List skeletons match list item structure
- [ ] Loading text indicates what's loading:
  - "Loading courses..."
  - "Uploading course..."
  - "Saving changes..."
- [ ] Loading states don't block entire UI (show loading for affected section only)

### Error States
- [ ] Error states are clearly visible:
  - Error styling (red/destructive color, icons)
  - Prominent placement (not hidden)
- [ ] Error messages are user-friendly:
  - Plain language (no technical jargon)
  - Explain what went wrong
  - Suggest how to fix (if applicable)
- [ ] Recovery actions provided:
  - "Retry" button
  - "Go Back" link
  - "Contact Support" link (if applicable)
- [ ] Errors don't break entire page (graceful degradation)

### Success States
- [ ] Success feedback provided:
  - Toast notifications for actions (enrollment, upload, delete)
  - Confirmation messages where appropriate
- [ ] Success states indicate next steps (if applicable):
  - "Course enrolled! Start learning →"
  - "Course uploaded! View in catalog →"

---

## 🎯 FUNCTIONAL CONSISTENCY

### Interactions
- [ ] Button clicks provide immediate feedback (loading state, disabled state)
- [ ] Forms validate appropriately (client-side validation, clear error messages)
- [ ] Navigation is predictable (consistent patterns across pages)
- [ ] Modals/dialogs:
  - Open smoothly (animation)
  - Focus trap works
  - Close on Escape key
  - Close on backdrop click (if appropriate)
  - Return focus to trigger on close

### State Management
- [ ] Loading states prevent double-submission (disable buttons, show loading)
- [ ] Optimistic updates (if used) have proper error handling and rollback
- [ ] Form state persists appropriately (or clears intentionally)
- [ ] URL state matches page state (route reflects current view)

### Performance
- [ ] Images are optimized (appropriate formats, sizes, lazy loading)
- [ ] Animations are smooth (60fps, no jank)
- [ ] Large lists are virtualized or paginated (if applicable)
- [ ] API calls are debounced/throttled where appropriate (search inputs)

---

## 🧪 TESTING CHECKLIST

### Manual Testing
- [ ] Test on Chrome/Edge (latest)
- [ ] Test on Firefox (latest)
- [ ] Test on Safari (latest, macOS/iOS)
- [ ] Test on mobile browsers (iOS Safari, Chrome Android)
- [ ] Test keyboard navigation (Tab, Enter, Space, Esc, Arrow keys)
- [ ] Test with screen reader (NVDA/JAWS on Windows, VoiceOver on macOS/iOS)
- [ ] Test zoom up to 200%
- [ ] Test with reduced motion preference enabled

### Automated Testing (if applicable)
- [ ] Accessibility tests pass (axe-core, WAVE)
- [ ] Visual regression tests pass (if using)
- [ ] Unit tests for components pass
- [ ] Integration tests for flows pass

---

## 📋 DOCUMENTATION

### Code Documentation
- [ ] Components have clear prop interfaces (TypeScript types)
- [ ] Complex logic has comments explaining "why" (not just "what")
- [ ] README or component docs updated if component API changes

### Design Documentation
- [ ] Design specs updated if patterns change
- [ ] Component usage examples documented
- [ ] Edge cases documented

---

## ✅ SIGN-OFF

**Designer/Architect:** _________________ **Date:** _________

**Engineer:** _________________ **Date:** _________

**QA Tester:** _________________ **Date:** _________

**Notes:**
- List any known issues or exceptions
- Document any deviations from design system
- Note any follow-up tasks

---

**END OF DESIGN QA CHECKLIST**

