# Styling: Border Radius Configuration

**Category:** Development  
**Last Updated:** November 23, 2024

## Overview

The EVE-KILL EDK template system uses centralized CSS variables to control border-radius (rounded corners) site-wide. This allows you to change the appearance of all UI elements from a single location.

## Location

All border-radius values are defined in:

```
templates/default/public/edk.css
```

Look for the "Border Radius" section near the top of the file (around lines 52-65).

## CSS Variables

The site uses four CSS variables to control rounded corners:

| Variable         | Purpose                                         | Default | Suggested Values                |
| ---------------- | ----------------------------------------------- | ------- | ------------------------------- |
| `--radius-sm`    | Small elements (buttons, cards, inputs, badges) | `0`     | `4px` (subtle), `8px` (heavy)   |
| `--radius-md`    | Medium elements (modals, large cards)           | `0`     | `8px` (subtle), `16px` (heavy)  |
| `--radius-lg`    | Large elements (hero sections, panels)          | `0`     | `12px` (subtle), `24px` (heavy) |
| `--radius-round` | Circular elements (avatars, portraits)          | `0`     | `50%` (perfect circles)         |

## Current Configuration

**No Rounded Corners (Current):**

```css
--radius-sm: 0;
--radius-md: 0;
--radius-lg: 0;
--radius-round: 0;
```

## Example Configurations

### Subtle Rounded Corners

For a modern, clean look with gentle curves:

```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-round: 50%;
```

### Heavy Rounded Corners

For a more pronounced, friendly appearance:

```css
--radius-sm: 8px;
--radius-md: 16px;
--radius-lg: 24px;
--radius-round: 50%;
```

### Sharp Edges (Current)

For a classic, angular look:

```css
--radius-sm: 0;
--radius-md: 0;
--radius-lg: 0;
--radius-round: 0;
```

## Where These Variables Are Used

All border-radius values throughout the codebase reference these CSS variables:

### In CSS Files

```css
/* Example button styling */
.killmail-nav__btn {
  border-radius: var(--radius-sm);
}

/* Example card styling */
.docs-page__header {
  border-radius: var(--radius-md);
}

/* Example avatar styling */
.portrait-char {
  border-radius: var(--radius-round);
}
```

### In Template Files

```html
<!-- Example inline style -->
<div style="border-radius: var(--radius-sm); padding: 16px;">Content here</div>
```

## Files That Use Border Radius

The border-radius variables are used in:

- **CSS File:** `templates/default/public/edk.css` (main stylesheet)
- **Template Files:** 22 Handlebars `.hbs` files throughout `templates/default/`

All references use CSS variables, so changing the 4 variables in one place updates the entire site instantly.

## How to Change

1. Open `templates/default/public/edk.css`
2. Find the "Border Radius" section (line ~52)
3. Update the variable values
4. Save the file
5. Refresh your browser (hard refresh: Cmd+Shift+R / Ctrl+Shift+F5)

**Example change:**

```css
/* Before (sharp edges) */
--radius-sm: 0;
--radius-md: 0;
--radius-lg: 0;
--radius-round: 0;

/* After (subtle rounding) */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-round: 50%;
```

## Design Considerations

### When to Use Sharp Edges (0)

- Classic, technical aesthetic
- Emphasis on information density
- Matches EVE Online's UI style
- Professional/corporate appearance

### When to Use Rounded Corners

- Modern, friendly appearance
- Better visual hierarchy
- Softer, more approachable design
- Mobile-first responsive design

### Circular Elements (`--radius-round: 50%`)

- Character portraits
- Corporation logos
- Alliance logos
- Badge indicators
- **Note:** Set to `0` for square avatars, `50%` for circles

## Browser Compatibility

CSS custom properties (variables) are supported in all modern browsers:

- Chrome 49+
- Firefox 31+
- Safari 9.1+
- Edge 15+

No fallback needed for this project's target browsers.

## Performance Notes

Using CSS variables has no performance impact. The browser resolves them at render time, and changing the values requires no compilation or build step.

## Testing Your Changes

After changing border-radius values:

1. **Visual inspection:** Check key pages
   - Homepage (`/`)
   - Killmail detail page
   - Character/Corporation pages
   - Navigation elements

2. **Responsive testing:** Check on different screen sizes
   - Desktop (1920px)
   - Tablet (768px)
   - Mobile (375px)

3. **Cross-browser testing:** Verify in major browsers
   - Chrome/Edge
   - Firefox
   - Safari

## Related Documentation

- [Code Style Guide](./code-style.md) - General styling conventions
- [Adding a Route](./adding-a-route.md) - Creating new pages that use these styles

## Questions?

If you need to add border-radius to a new element:

1. Use the appropriate CSS variable (`var(--radius-sm)`, `var(--radius-md)`, etc.)
2. Choose the variable based on element size and importance
3. Never hardcode pixel values directly

This ensures your new elements will automatically adapt when border-radius is changed site-wide.
