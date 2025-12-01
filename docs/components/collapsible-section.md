# Collapsible Section Component

## Location

`templates/default/components/collapsible-section.hbs`

## Description

A reusable component that provides a collapsible section with localStorage persistence. The collapsed/expanded state is automatically saved and restored across page reloads.

## Features

- **Collapsible content**: Click the chevron icon to collapse/expand
- **LocalStorage persistence**: Browser remembers user's preference
- **Customizable header**: Support for title and optional right-side content
- **Smooth animations**: Chevron rotates smoothly between states
- **Unique IDs**: Each instance has its own localStorage key

## Parameters

| Parameter          | Type        | Required | Default | Description                                         |
| ------------------ | ----------- | -------- | ------- | --------------------------------------------------- |
| `id`               | string      | Yes      | -       | Unique identifier for this collapsible section      |
| `title`            | string      | Yes      | -       | The title text to display in the header             |
| `defaultCollapsed` | boolean     | No       | false   | Whether to start collapsed if no saved state exists |
| `headerRight`      | string/HTML | No       | -       | Content to display on the right side of header      |

## Usage Examples

### Basic Usage

```handlebars
{{#> components/collapsible-section id="my-section" title="My Section Title"}}
    <div style="padding: 16px;">
        <!-- Your content here -->
        <p>This content will be collapsible</p>
    </div>
{{/components/collapsible-section}}
```

### With Right Header Content (Inline)

```handlebars
{{#> components/collapsible-section id="stats-section" title="Statistics"}}
    {{#*inline "headerRight"}}
        <div style="display: flex; gap: 4px;">
            <button onclick="refreshStats()">Refresh</button>
            <button onclick="exportStats()">Export</button>
        </div>
    {{/inline}}

    <div style="padding: 16px;">
        <!-- Stats content -->
    </div>
{{/components/collapsible-section}}
```

### Default Collapsed

```handlebars
{{#> components/collapsible-section id="advanced-options" title="Advanced Options" defaultCollapsed=true}}
    <div style="padding: 16px;">
        <!-- This will be collapsed by default unless user previously expanded it -->
    </div>
{{/components/collapsible-section}}
```

### With Tabs (Like Most Valuable Kills)

```handlebars
{{#> components/collapsible-section id="most-valuable" title="Most Valuable Kills (Last 7 Days)"}}
    {{#*inline "headerRight"}}
        <div style="display: flex; gap: 4px;">
            <button onclick="switchTab('all')" id="tab-all">All</button>
            <button onclick="switchTab('ships')" id="tab-ships">Ships</button>
            <button onclick="switchTab('structures')" id="tab-structures">Structures</button>
        </div>
    {{/inline}}

    <!-- Tab content -->
    <div id="content-all">All kills content</div>
    <div id="content-ships" style="display: none;">Ships content</div>
    <div id="content-structures" style="display: none;">Structures content</div>
{{/components/collapsible-section}}
```

### Dynamic Title with Helpers

```handlebars
{{#> components/collapsible-section
    id="entity-stats"
    title=(concat "Statistics for " entityName " (" timeRange ")")}}
    <!-- Content -->
{{/components/collapsible-section}}
```

## Technical Details

### LocalStorage Keys

Each collapsible section stores its state using the key pattern: `collapsible_{id}`

For example:

- `id="most-valuable"` → localStorage key: `collapsible_most-valuable`
- `id="my-section"` → localStorage key: `collapsible_my-section`

### JavaScript API

The component creates a global function `toggleCollapsible(id)` that can be called programmatically:

```javascript
// Programmatically toggle a section
toggleCollapsible('most-valuable');
```

### State Persistence Logic

1. On page load, checks localStorage for saved state
2. If no saved state exists, uses `defaultCollapsed` parameter
3. On toggle, saves new state to localStorage
4. State is restored on subsequent page loads

## Styling

The component uses CSS variables for theming:

- `--color-bg-tertiary`: Background color
- `--color-border-dark`: Border color
- `--color-text-white`: Title text color
- `--color-text-secondary`: Icon color
- `--radius-sm`: Border radius

## Browser Compatibility

Requires browser support for:

- localStorage API
- CSS transitions
- SVG
- ES6 JavaScript

All modern browsers are supported.
