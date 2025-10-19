import Handlebars from "handlebars";
import { readFile } from "fs/promises";
import { join } from "path";

// Cache environment variables
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";
const TEMPLATE_CACHE_ENABLED = process.env.TEMPLATE_CACHE_ENABLED === "true";

// Cache for compiled templates
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

/**
 * Interface for template data that gets passed to Handlebars
 */
export interface TemplateData {
  title?: string;
  meta?: {
    description?: string;
    keywords?: string;
    author?: string;
  };
  [key: string]: any;
}

/**
 * Render a Handlebars template with the provided data
 * @param templateName - Name of the template file (without .hbs extension)
 * @param data - Data to pass to the template
 * @param layout - Optional layout template (defaults to 'main')
 * @returns Rendered HTML string
 */
export async function renderTemplate(
  templateName: string,
  data: TemplateData = {},
  layout: string = "main"
): Promise<string> {
  try {
    // Get the layout template
    const layoutTemplate = await getTemplate(`layouts/${layout}`);

    // Get the page template
    const pageTemplate = await getTemplate(templateName);

    // Render the page content first
    const pageContent = pageTemplate(data);

    // Then render the layout with the page content
    const layoutData = {
      ...data,
      body: pageContent,
      title: data.title || "EVE Kill v4"
    };

    return layoutTemplate(layoutData);
  } catch (error) {
    console.error(`Error rendering template ${templateName}:`, error);
    throw new Error(`Template rendering failed: ${error}`);
  }
}

/**
 * Get a compiled template from cache or compile it if not cached
 * @param templatePath - Path to the template relative to templates directory
 * @returns Compiled Handlebars template
 */
async function getTemplate(templatePath: string): Promise<HandlebarsTemplateDelegate> {
  const fullPath = `templates/${templatePath}.hbs`;

  // In development, clear cache to pick up template changes
  if (IS_DEVELOPMENT && !TEMPLATE_CACHE_ENABLED) {
    templateCache.delete(fullPath);
  }

  // Check cache first
  if (templateCache.has(fullPath)) {
    return templateCache.get(fullPath)!;
  }

  try {
    // Read and compile template
    const templateSource = await readFile(join(process.cwd(), fullPath), "utf-8");
    const compiledTemplate = Handlebars.compile(templateSource);

    // Cache it for future use
    templateCache.set(fullPath, compiledTemplate);

    return compiledTemplate;
  } catch (error) {
    throw new Error(`Failed to load template ${fullPath}: ${error}`);
  }
}

/**
 * Register Handlebars helpers for common functionality
 */
export function registerHelpers() {
  // Format large numbers (e.g., ISK values)
  Handlebars.registerHelper("formatNumber", function(value: number) {
    if (typeof value !== "number") return value;
    return value.toLocaleString();
  });

  // Format ISK values with appropriate suffix
  Handlebars.registerHelper("formatISK", function(value: number) {
    if (typeof value !== "number") return value;

    if (value >= 1e12) {
      return `${(value / 1e12).toFixed(1)}T ISK`;
    } else if (value >= 1e9) {
      return `${(value / 1e9).toFixed(1)}B ISK`;
    } else if (value >= 1e6) {
      return `${(value / 1e6).toFixed(1)}M ISK`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(1)}K ISK`;
    }
    return `${value.toLocaleString()} ISK`;
  });

  // Format dates nicely
  Handlebars.registerHelper("formatDate", function(date: string | Date) {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  });

  // Time ago helper
  Handlebars.registerHelper("timeAgo", function(date: string | Date) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return "Just now";
  });

  // Conditional helper
  Handlebars.registerHelper("ifEquals", function(this: any, arg1: any, arg2: any, options: any) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
  });

  // Math helpers
  Handlebars.registerHelper("add", function(a: number, b: number) {
    return a + b;
  });

  Handlebars.registerHelper("multiply", function(a: number, b: number) {
    return a * b;
  });
}

/**
 * Clear the template cache (useful for development)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
  console.log("🗑️  Template cache cleared");
}
