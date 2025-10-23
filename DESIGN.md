# EDK Design Language

## Overview

EDK uses a modern, soft aesthetic design language that prioritizes readability, visual hierarchy, and a cohesive user experience. The design system replaces traditional table-based layouts with flexbox-based components, utilizing a sophisticated color system with transparency and soft containers.

## Core Design Principles

1. **Soft Containers** - Subtle borders and backgrounds create clear content separation without harsh visual boundaries
2. **Transparency & Depth** - RGBA colors and layering create visual hierarchy
3. **Consistent Spacing** - Uniform padding and gaps maintain visual rhythm
4. **Uppercase Labels** - Section headers use uppercase text with letter-spacing for emphasis
5. **Flexbox Layouts** - Modern, responsive layouts replace traditional table designs
6. **Icon-Text Pairing** - Images/icons consistently paired with text information

## Color System

All colors use CSS custom properties (variables) for consistency and maintainability.

### Primary Colors

| Variable | Purpose | Example Value |
|----------|---------|---|
| `--color-bg-tertiary` | Soft container backgrounds | `rgba(74, 158, 255, 0.08)` |
| `--color-border-dark` | Container borders | `rgba(107, 114, 128, 0.2)` |
| `--color-text-white` | Primary text | `#ffffff` |
| `--color-text-secondary` | Secondary/label text | `rgba(107, 114, 128, 0.8)` |
| `--color-accent-blue-light` | Links and interactive elements | `#4a9eff` |
| `--color-kill-green` | Success/positive values (ISK) | `#4ade80` |

### Usage Guidelines

- **Backgrounds**: Use `var(--color-bg-tertiary)` for all soft containers
- **Borders**: Use `var(--color-border-dark)` with `1px solid` for container edges
- **Text Labels**: Use `var(--color-text-secondary)` for section headers and descriptions
- **Primary Text**: Use `var(--color-text-white)` for main content
- **Links**: Use `var(--color-accent-blue-light)` for clickable elements
- **Values**: Use `#4ade80` (green) for ISK amounts and positive indicators

## Container Structure

### Standard Soft Container Pattern

All major content sections follow this structure:

```handlebars
<div style="background: var(--color-bg-tertiary); border: 1px solid var(--color-border-dark); border-radius: 4px; margin-bottom: 20px; overflow: visible; position: relative;">
    <!-- Header Section -->
    <div style="padding: 12px 16px; border-bottom: 1px solid var(--color-border-dark);">
        <div style="color: var(--color-text-white); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            Section Title
        </div>
    </div>

    <!-- Content Section -->
    <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 12px;">
        [Content goes here]
    </div>
</div>
```

### Key Properties

| Property | Value | Purpose |
|----------|-------|---------|
| `background` | `var(--color-bg-tertiary)` | Soft, semi-transparent container background |
| `border` | `1px solid var(--color-border-dark)` | Subtle container outline |
| `border-radius` | `4px` | Slight rounding for modern look |
| `padding` | `12px 16px` | Consistent internal spacing |
| `gap` | `12px` | Space between flex items |
| `overflow` | `visible` | Allows dropdowns/overlays |
| `position` | `relative` | Positioning context for children |

## Typography

### Headers/Labels

```css
font-weight: 600;
font-size: 12px;
text-transform: uppercase;
letter-spacing: 0.5px;
color: var(--color-text-secondary);
```

### Primary Text

```css
font-weight: 400;
font-size: 11px;
color: var(--color-text-white);
```

### Secondary Text

```css
font-weight: 400;
font-size: 9px;
color: var(--color-text-secondary);
```

### Values (ISK amounts)

```css
font-weight: bold;
font-size: 10px;
color: #4ade80;
```

## Layout Patterns

### Flex Row with Image + Text

Used for character/corporation/alliance information:

```handlebars
<div style="display: flex; gap: 12px; align-items: flex-start;">
    <div style="flex-shrink: 0;">
        {{> partials/eve-image type="character" id=characterId size=32 alt=name}}
    </div>
    <div style="flex: 1; min-width: 0;">
        <div style="margin-bottom: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <b style="font-size: 11px; color: var(--color-text-white);">Name</b>
        </div>
        <div style="color: var(--color-text-secondary); font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            Secondary Info
        </div>
    </div>
</div>
```

### Flex Row with Border Separator

For lists of items (attackers, involved parties):

```handlebars
<div style="display: flex; gap: 12px; align-items: flex-start;{{#if @index}} border-top: 1px solid var(--color-border-dark); padding-top: 12px;{{/if}}">
    [Row content]
</div>
```

The `{{#if @index}}` conditional adds a top border and padding only to rows after the first one, creating visual separation without redundant borders.

### Two-Column Flex Layout

For side-by-side information:

```handlebars
<div style="display: flex; gap: 12px;">
    <div style="flex: 1; min-width: 0;">Left column content</div>
    <div style="flex-shrink: 0;">Right column content</div>
</div>
```

### Vertical Stack with Gap

```handlebars
<div style="display: flex; flex-direction: column; gap: 12px;">
    [Items stack vertically with 12px gap]
</div>
```

## Component Examples

### Killmail Navbar

- Soft container with horizontal scrolling section for related kills
- Dropdown menus with soft aesthetic styling
- Copy buttons and external links integrated seamlessly

### Victim Information Box

- Soft container with victim image and details
- Kill Details section (System, Time) with flex layout
- ISK Value section with rows for Destroyed/Dropped/Ship/Fitting/Total

### Final Blow

- Soft container with character info (image + name/corp/alliance)
- Ship info section with border separator
- Damage amount displayed in green

### Involved Parties

- Soft container with scrollable list
- Each attacker displayed as flex row with image and info
- Border separators between rows (except first)
- Damage amounts right-aligned in green

### Items Destroyed/Dropped

- Soft container wrapping table structure
- Soft header row with uppercase labels
- Transparent table background to blend with container
- Slot categories (High/Med/Low/Rig/Drone/Cargo) as header rows

## Spacing System

| Value | Usage |
|-------|-------|
| `4px` | Border radius, tight padding |
| `8px` | Small gaps, tight spacing |
| `12px` | Standard padding, standard gap |
| `16px` | Horizontal padding in containers |
| `20px` | Margin between sections |

## Migration Guide

When updating existing components to use this design language:

1. **Replace `kb-table` layouts** with flex containers where appropriate
2. **Update colors** to use CSS variables instead of hardcoded hex values
3. **Add soft container wrapper** around major sections
4. **Convert table rows** to flex rows with `display: flex; gap: 12px;`
5. **Apply header styling** with uppercase labels and letter-spacing
6. **Use `min-width: 0`** on flex items containing text to enable proper text overflow
7. **Add border separators** between items in lists using `border-top` conditionally

## Best Practices

### Text Overflow

Always include on text containers in flex layouts:

```css
min-width: 0;
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
```

### Image Sizing

- Character/Corporation images: `32px`
- Small overlays: `16px`
- Standard spacing around images: `12px`

### Flex Item Control

- Images: `flex-shrink: 0` to prevent squishing
- Text containers: `flex: 1; min-width: 0;` to fill space and enable overflow
- Right-aligned items: `flex-shrink: 0; text-align: right;`

### Border Consistency

- All container borders: `1px solid var(--color-border-dark)`
- Section separators: Same as container borders
- Border radius: `4px` consistently across all containers

## Accessibility

- Maintain sufficient color contrast (all text uses white/secondary on semi-transparent backgrounds)
- Use semantic HTML structure within flex containers
- Include `alt` attributes on all images
- Use uppercase labels with letter-spacing for visual hierarchy instead of relying solely on size

## Responsive Considerations

- Flexbox layouts adapt naturally to different screen sizes
- Use `flex-wrap` for multi-column layouts when needed
- Images use fixed sizes (32px, 16px) for consistency
- Text uses `overflow: hidden; text-overflow: ellipsis` for long content
- Containers use `overflow: visible` to allow overlays (dropdowns, tooltips)

## Implementation Checklist

When applying this design language to new components:

- [ ] Wrap content in soft container div with border and background
- [ ] Add header section with uppercase label
- [ ] Use flex layout for content (column for stacks, row for side-by-side)
- [ ] Apply consistent gap spacing (`12px`)
- [ ] Use CSS variables for all colors
- [ ] Add border separators between list items conditionally
- [ ] Apply proper text overflow handling
- [ ] Ensure images are properly sized and positioned
- [ ] Test responsive behavior at different breakpoints
- [ ] Verify color contrast meets accessibility standards
