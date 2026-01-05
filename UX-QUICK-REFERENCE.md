# LMS UX Quick Reference Guide

**For:** Engineering Team, QA Team, Product Managers  
**Purpose:** Quick lookup for design system tokens, patterns, and common questions

---

## 📚 Documentation Index

1. **UX-ARCHITECTURE.md** - Complete UX architecture, design system foundations, information architecture
2. **UX-FLOW-SPECS.md** - Detailed flow specifications for all user journeys
3. **UX-COMPONENT-SPECS.md** - Component specification sheets
4. **DESIGN-QA-CHECKLIST.md** - Pre-release QA checklist
5. **UX-QUICK-REFERENCE.md** - This document (quick lookup)

---

## 🎨 Design Tokens (Quick Reference)

### Spacing Scale (8px base)

```
space-1  = 4px   (0.25rem)  - Tight spacing
space-2  = 8px   (0.5rem)   - XS spacing
space-3  = 12px  (0.75rem)  - Small spacing
space-4  = 16px  (1rem)     - Base spacing
space-6  = 24px  (1.5rem)   - Card padding
space-8  = 32px  (2rem)     - Section gaps
space-12 = 48px  (3rem)     - Major sections
```

### Typography Scale

```
H1       = 2.5rem (40px)  - Page titles
H2       = 2rem   (32px)  - Section headers
H3       = 1.5rem (24px)  - Card titles
Body     = 1rem   (16px)  - Default text
Body Sm  = 0.875rem (14px) - Secondary text
Caption  = 0.75rem (12px) - Labels, metadata
```

### Colors (Semantic Tokens)

**Primary Actions:**
- `bg-primary` / `text-primary-foreground` - Buttons, links, active states

**Accent/Highlights:**
- `bg-accent` / `text-accent-foreground` - Achievements, completion

**Status:**
- `bg-success` - Completed, success messages
- `bg-destructive` - Errors, delete actions
- `bg-warning` - Warnings
- `bg-muted` / `text-muted-foreground` - Secondary text, inactive

**Never hardcode colors!** Always use semantic tokens.

---

## 🧩 Common Patterns

### Card Layout
```tsx
<div className="bg-card rounded-2xl border border-border/50 shadow-md hover:shadow-xl p-6">
  {/* Card content */}
</div>
```

### Button Variants
- `default` - Primary actions (Enroll, Submit)
- `outline` - Secondary actions (Cancel, Clear)
- `ghost` - Tertiary actions (Sign Out)
- `destructive` - Delete, destructive actions
- `accent` - Highlights, achievements

### Form Input
```tsx
<div>
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    value={value}
    onChange={(e) => setValue(e.target.value)}
    aria-describedby={error ? "email-error" : undefined}
    aria-invalid={error ? "true" : undefined}
  />
  {error && (
    <p id="email-error" className="text-destructive text-sm mt-1">
      {error}
    </p>
  )}
</div>
```

### Loading State
```tsx
{loading ? (
  <div className="flex items-center justify-center py-8">
    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    <span className="ml-2 text-muted-foreground">Loading...</span>
  </div>
) : (
  // Content
)}
```

### Empty State
```tsx
<div className="text-center py-16">
  <p className="text-muted-foreground text-lg mb-4">
    No courses found
  </p>
  <Button onClick={handleAction}>Take Action</Button>
</div>
```

### Error State
```tsx
<div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">
  Error message here
  <Button variant="outline" onClick={handleRetry}>Retry</Button>
</div>
```

---

## 📐 Layout Patterns

### Container
```tsx
<div className="container mx-auto px-4 lg:px-8 max-w-7xl">
  {/* Content */}
</div>
```

### Grid (Responsive)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
  {/* Cards */}
</div>
```

### Sidebar Layout
- Sidebar: `w-64` (256px), fixed on desktop
- Main content: `flex-1`, `ml-64` on desktop
- Mobile: Sidebar in drawer/sheet

---

## ♿ Accessibility Quick Checks

### ✅ DO:
- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Provide labels for all inputs (`<label>` or `aria-label`)
- Associate errors with fields (`aria-describedby`)
- Use `role="alert"` for error messages
- Keyboard accessible (Tab, Enter, Space, Esc)
- Focus indicators visible (2px ring)

### ❌ DON'T:
- Use `<div>` with onClick for buttons
- Rely on color alone (use icons/text + color)
- Hide focus indicators
- Use placeholder as label
- Create icon-only buttons without `aria-label`

---

## 🔄 Common Flows

### Course Enrollment Flow
1. User browses `/courses`
2. Clicks course card or "Enroll Now" button
3. Enrollment API call (show loading)
4. Success toast: "Enrolled successfully!"
5. Navigate to `/player/:courseId` OR stay on catalog (UI updates)

### Error Handling Pattern
```tsx
try {
  setLoading(true);
  await api.call();
  toast.success("Success!");
} catch (error) {
  toast.error(error.response?.data?.error || "Something went wrong");
} finally {
  setLoading(false);
}
```

---

## 📱 Breakpoints

```css
/* Mobile first approach */
Mobile:    < 768px   (default, no prefix)
Tablet:    ≥ 768px   (md:)
Desktop:   ≥ 1024px  (lg:)
Large:     ≥ 1400px  (xl:)
```

**Usage:**
```tsx
<div className="text-base md:text-lg lg:text-xl">
  Responsive text
</div>
```

---

## 🎯 Component Usage Guidelines

### CourseCard
- Use in grid layouts (responsive columns)
- Show enrollment status and progress
- Handle click (navigate) and enroll button (with stopPropagation)
- Always show loading/error states

### Button
- Use `default` for primary actions
- Show loading state for async operations
- Disable during loading to prevent double-submission
- Use descriptive labels ("Enroll Now" not "Submit")

### Form Input
- Always provide label (visible or aria-label)
- Show error messages below field
- Associate errors with fields (aria-describedby)
- Use appropriate input types (email, password, etc.)

---

## 🐛 Common Issues & Solutions

### Issue: Button doesn't show loading state
**Solution:** Add `loading` prop, disable button, show spinner

### Issue: Form errors not accessible
**Solution:** Use `aria-describedby` linking to error message ID, set `aria-invalid="true"`

### Issue: Colors not matching design system
**Solution:** Use semantic tokens (`bg-primary`, not `bg-[#123456]`)

### Issue: Layout breaks on mobile
**Solution:** Use responsive classes (`md:`, `lg:`), test mobile-first

### Issue: Focus indicators missing
**Solution:** Ensure `focus-visible:ring-2 focus-visible:ring-ring` classes present

---

## 📞 Questions?

**Design System Questions:** See UX-ARCHITECTURE.md  
**Flow Questions:** See UX-FLOW-SPECS.md  
**Component Questions:** See UX-COMPONENT-SPECS.md  
**QA Questions:** See DESIGN-QA-CHECKLIST.md

---

**Last Updated:** 2024

