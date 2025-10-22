# Theme System

The EVE Kill v4 killboard supports a flexible theme system that allows you to create custom themes without modifying the core application code.

## Directory Structure

Themes are located in `/templates/{THEME_NAME}/` where each theme contains:

```
templates/
├── default/                    # Default theme
│   ├── components/            # Reusable Handlebars components
│   ├── layouts/               # Layout templates (e.g., main.hbs)
│   ├── pages/                 # Page templates
│   └── partials/              # Partial templates (included by pages)
├── custom-theme/              # Example custom theme
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   └── partials/
```

## Configuration

Set the theme to use via the `THEME` environment variable in `.env`:

```properties
THEME=default
```

The default theme is `default`. When you change this to a custom theme name (e.g., `custom-theme`), the application will load templates from that directory instead.

## Creating a Custom Theme

1. Create a new directory in `/templates/` with your theme name:
   ```bash
   mkdir -p templates/my-theme/{components,layouts,pages,partials}
   ```

2. Copy the files from the default theme as a starting point:
   ```bash
   cp -r templates/default/* templates/my-theme/
   ```

3. Customize the templates in your theme directory

4. Set the `THEME` environment variable to your theme name:
   ```properties
   THEME=my-theme
   ```

5. Restart the server

## Template Files

### Layouts (`/layouts/*.hbs`)
- **main.hbs** - Main page layout wrapper
  - Available variables: `body`, `title`, and page-specific data
  - Wraps all rendered pages

### Pages (`/pages/*.hbs`)
- Page-specific templates
- Examples: `killmail.hbs`, `index.hbs`, `character/[id].hbs`, etc.
- Rendered within a layout

### Partials (`/partials/*.hbs`)
- Reusable template fragments
- Included via `{{> partials/partial-name}}`
- Examples: `killmail-victim-info.hbs`, `killmail-list.hbs`, etc.

### Components (`/components/*.hbs`)
- Reusable UI components
- Included via `{{> components/component-name}}`
- Examples: `eve-image.hbs`, `top-10-stat.hbs`, etc.

## Available Handlebars Helpers

### Formatting
- `{{formatNumber value}}` - Format number with thousand separators
- `{{formatISK value}}` - Format ISK values with suffix (B, M, K)
- `{{abbreviateISK value}}` - Abbreviate ISK (B, M, K only)
- `{{formatDate date}}` - Format date nicely
- `{{timeAgo date}}` - Show "time ago" format

### Operators
- `{{#if condition}}...{{/if}}` - Conditional rendering
- `{{#each array}}...{{/each}}` - Loop through arrays
- `{{#with object}}...{{/with}}` - Scope change

### Custom Helpers
- `{{json value}}` - Serialize value to JSON (used for HTML attributes)
- `{{obj object}}` - Concatenate object properties
- `{{concat values}}` - Concatenate values

## Static Assets

Static assets (CSS, JavaScript, images) are served from `/static/`:
- `/static/edk.css` - Main stylesheet
- `/static/search.js` - Search functionality
- `/static/killlist-updates.js` - WebSocket kill list updates
- `/static/fitting-wheel.js` - Fitting wheel visualization
- `/static/post.js` - Post page functionality
- `/static/img/` - Images

## Theme Variables

When rendering templates, the following context variables are typically available:

### Page Context
- `title` - Page title
- `meta` - Metadata object (description, keywords, author)
- `[page-specific data]` - Data specific to each page

### Global Helpers
All Handlebars helpers are available in all templates

## Best Practices

1. **Start from Default** - Copy the default theme as a starting point to ensure all necessary templates exist

2. **Maintain File Structure** - Keep the same directory structure to avoid template loading issues

3. **Use Partials** - Break up large templates into reusable partials for easier maintenance

4. **CSS Classes** - The default theme uses EDK-compatible CSS classes. Maintain compatibility or update CSS accordingly

5. **Responsive Design** - Ensure your theme works on mobile and desktop

6. **Test All Pages** - Test all pages in your custom theme to ensure proper rendering

## Switching Themes at Runtime

To switch themes without restarting:

1. Update the `THEME` environment variable
2. Restart the application
3. Template cache will be cleared in development mode automatically

In production, you may want to set `TEMPLATE_CACHE_ENABLED=false` during theme development for instant updates.

## Default Theme

The default theme is a complete, production-ready killboard theme with:
- Responsive design
- EVE Online themed styling
- Interactive killlist updates via WebSocket
- Real-time statistics
- Entity detail pages (characters, corporations, alliances, systems, regions, items)
- Search functionality
- Kill statistics and filtering
