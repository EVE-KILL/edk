# Expand/Collapse Component Library

A reusable, framework-agnostic JavaScript library for creating expandable/collapsible sections throughout the site.

## Features

- ✅ **Simple HTML API** - Just add data attributes
- ✅ **Event-driven** - Emits custom events for extensibility
- ✅ **Auto-initialization** - Works as soon as the page loads
- ✅ **Multiple instances** - Each component works independently
- ✅ **Programmatic control** - JavaScript API for dynamic control
- ✅ **Accessibility** - Includes ARIA attributes
- ✅ **No dependencies** - Pure vanilla JavaScript

## Installation

The library is automatically loaded in the main layout:

```html
<script src="/static/js/expand-collapse.js"></script>
```

## Basic Usage

### HTML Structure

Add these data attributes to your HTML:

```html
<div data-expand-group>
  <button data-expand-trigger>Show More</button>
  <div data-expand-content style="display: none;">Hidden content goes here</div>
</div>
```

### Data Attributes

- **`data-expand-group`** - Optional container that groups a trigger with its content
- **`data-expand-trigger`** - The clickable element that toggles visibility
- **`data-expand-content`** - The content to show/hide

### Without a Group Container

If you don't wrap in a `data-expand-group`, the library will find the next sibling or nearest content within the parent:

```html
<button data-expand-trigger>Show More</button>
<div data-expand-content style="display: none;">Hidden content</div>
```

## Examples

### Basic Toggle

```html
<div data-expand-group>
  <div class="header" data-expand-trigger>Click to expand</div>
  <div data-expand-content style="display: none;">
    <p>This content is hidden by default</p>
  </div>
</div>
```

### Multiple Independent Sections

```html
<div data-expand-group>
  <button data-expand-trigger>Section 1</button>
  <div data-expand-content style="display: none;">Content 1</div>
</div>

<div data-expand-group>
  <button data-expand-trigger>Section 2</button>
  <div data-expand-content style="display: none;">Content 2</div>
</div>
```

### Complex Content

```html
<div data-expand-group>
  <div class="stats-header" data-expand-trigger>
    <span>Top 10 Items</span>
    <span class="count">+ 45 more</span>
  </div>
  <div data-expand-content style="display: none;">
    <ul>
      <li>Item 11</li>
      <li>Item 12</li>
      <!-- ... -->
    </ul>
  </div>
</div>
```

## JavaScript API

### Manual Control

```javascript
// Expand a specific trigger
ExpandCollapse.expandBySelector('#myTrigger');

// Collapse a specific trigger
ExpandCollapse.collapseBySelector('.my-trigger-class');

// Toggle programmatically
const trigger = document.querySelector('[data-expand-trigger]');
ExpandCollapse.toggle(trigger);
```

### Batch Operations

```javascript
// Expand all on the page
ExpandCollapse.expandAll();

// Collapse all on the page
ExpandCollapse.collapseAll();

// Expand all within a container
ExpandCollapse.expandAll('#myContainer');

// Collapse all within a container
ExpandCollapse.collapseAll('.my-section');
```

## Events

The library emits custom events you can listen to:

### Expanded Event

```javascript
document.addEventListener('expandcollapse:expanded', function (e) {
  console.log('Expanded:', e.detail.trigger, e.detail.content);
});
```

### Collapsed Event

```javascript
document.addEventListener('expandcollapse:collapsed', function (e) {
  console.log('Collapsed:', e.detail.trigger, e.detail.content);
});
```

### Event on Specific Trigger

```javascript
const trigger = document.querySelector('#myTrigger');
trigger.addEventListener('expandcollapse:expanded', function (e) {
  console.log('My trigger was expanded!');
});
```

## CSS Styling

The library adds/removes classes for styling:

```css
/* Style the trigger when expanded */
[data-expand-trigger].expanded {
  background-color: #e0e0e0;
}

/* Animate the content */
[data-expand-content] {
  transition: opacity 0.3s ease;
}

/* Style when visible */
[data-expand-content][style*='display: block'] {
  opacity: 1;
}
```

### Example Component Styles

```css
.expand-trigger {
  cursor: pointer;
  padding: 10px;
  background: rgba(0, 0, 0, 0.1);
  transition: background 0.2s;
}

.expand-trigger:hover {
  background: rgba(0, 0, 0, 0.2);
}

.expand-trigger.expanded {
  background: rgba(74, 158, 255, 0.1);
}

.expand-content {
  overflow: hidden;
}
```

## Accessibility

The library automatically manages ARIA attributes:

- `aria-expanded="false"` - When content is hidden
- `aria-expanded="true"` - When content is visible

Add additional ARIA labels for better accessibility:

```html
<button
  data-expand-trigger
  aria-controls="content-id"
  aria-label="Show more items"
>
  Show More
</button>
<div data-expand-content id="content-id" role="region" style="display: none;">
  Hidden content
</div>
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with polyfills for `closest` if needed)

## Used In

- War detail page ship class statistics
- (Add other uses as they're implemented)

## Future Enhancements

Potential features for future versions:

- Animation/transition support
- Accordion mode (one open at a time)
- Keyboard navigation
- Save state to localStorage
- Open/close icons
