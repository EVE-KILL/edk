import Handlebars from "handlebars";
import { readFile, readdir } from "fs/promises";
import { join } from "path";

// Cache environment variables
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";
const TEMPLATE_CACHE_ENABLED = process.env.TEMPLATE_CACHE_ENABLED === "true";
const THEME = process.env.THEME || "default";

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
      title: data.title || "EDK"
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
  const fullPath = `templates/${THEME}/${templatePath}.hbs`;

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
 * Register all partials from the templates/partials directory
 */
export async function registerPartials() {
  try {
    // Register partials from partials directory
    const partialsDir = join(process.cwd(), `templates/${THEME}/partials`);
    const files = await readdir(partialsDir, { recursive: true });

    for (const file of files) {
      if (file.endsWith(".hbs")) {
        const partialName = file.replace(".hbs", "").replace(/\\/g, "/");
        const partialPath = join(partialsDir, file);
        const partialSource = await readFile(partialPath, "utf-8");
        Handlebars.registerPartial(`partials/${partialName}`, partialSource);
      }
    }

    // Register components from components directory
    const componentsDir = join(process.cwd(), `templates/${THEME}/components`);
    const componentFiles = await readdir(componentsDir, { recursive: true });

    for (const file of componentFiles) {
      if (file.endsWith(".hbs")) {
        const componentName = file.replace(".hbs", "").replace(/\\/g, "/");
        const componentPath = join(componentsDir, file);
        const componentSource = await readFile(componentPath, "utf-8");
        Handlebars.registerPartial(`components/${componentName}`, componentSource);
      }
    }
  } catch (error) {
    console.error("Error registering partials:", error);
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
  Handlebars.registerHelper("formatISK", function(value: number | string) {
    // Convert string to number if needed
    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (typeof numValue !== "number" || isNaN(numValue)) {
      return "0 ISK";
    }

    if (numValue >= 1e12) {
      return `${(numValue / 1e12).toFixed(1)}T ISK`;
    } else if (numValue >= 1e9) {
      return `${(numValue / 1e9).toFixed(1)}B ISK`;
    } else if (numValue >= 1e6) {
      return `${(numValue / 1e6).toFixed(1)}M ISK`;
    } else if (numValue >= 1e3) {
      return `${(numValue / 1e3).toFixed(1)}K ISK`;
    }
    return `${numValue.toLocaleString()} ISK`;
  });

  // Abbreviate ISK to closest common denominator (B, M, K)
  Handlebars.registerHelper("abbreviateISK", function(value: number) {
    if (typeof value !== "number") return value;

    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(1)}B`;
    } else if (value >= 1e6) {
      return `${(value / 1e6).toFixed(1)}M`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(1)}K`;
    }
    return value.toLocaleString();
  });

  // Format dates nicely
  Handlebars.registerHelper("formatDate", function(date: string | Date) {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
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

  // Equality check helper
  Handlebars.registerHelper("eq", function(a: any, b: any) {
    return a === b;
  });

  // Logical OR helper - returns true if any argument is truthy
  Handlebars.registerHelper("or", function(...args: any[]) {
    // Remove the options object (last argument)
    const values = args.slice(0, -1);
    return values.some(val => !!val);
  });

  // Format number with commas
  Handlebars.registerHelper("formatNumber", function(num: number) {
    if (!num && num !== 0) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  });

  // Calculate damage percentage
  Handlebars.registerHelper("damagePercent", function(damage: number, totalDamage: number) {
    if (!damage || !totalDamage || totalDamage === 0) return "0.0";
    return ((damage / totalDamage) * 100).toFixed(1);
  });

  // Comparison helpers
  Handlebars.registerHelper("gte", function(a: number, b: number) {
    return a >= b;
  });

  Handlebars.registerHelper("gt", function(a: number, b: number) {
    return a > b;
  });

  Handlebars.registerHelper("lt", function(a: number, b: number) {
    return a < b;
  });

  Handlebars.registerHelper("lte", function(a: number, b: number) {
    return a <= b;
  });

  // Math helpers
  Handlebars.registerHelper("add", function(a: number, b: number) {
    return a + b;
  });

  Handlebars.registerHelper("multiply", function(a: number, b: number) {
    return a * b;
  });

  // Divide helper
  Handlebars.registerHelper("div", function(a: number, b: number) {
    return b !== 0 ? a / b : 0;
  });

  // Ceiling helper
  Handlebars.registerHelper("ceil", function(a: number) {
    return Math.ceil(a);
  });

  // Alias for multiply
  Handlebars.registerHelper("mult", function(a: number, b: number) {
    return a * b;
  });

  // Logical AND helper
  Handlebars.registerHelper("and", function(...args: any[]) {
    // Remove the Handlebars options object from the end
    const values = args.slice(0, -1);
    return values.every(v => v);
  });

  // Logical OR helper
  Handlebars.registerHelper("or", function(...args: any[]) {
    // Remove the Handlebars options object from the end
    const values = args.slice(0, -1);
    return values.some(v => v);
  });

  // Check if number is even
  Handlebars.registerHelper("isEven", function(num: number) {
    return num % 2 === 0;
  });

  // Modulo helper for alternating rows
  Handlebars.registerHelper("mod", function(a: number, b: number) {
    return a % b;
  });

  // Default value helper - returns first truthy value or the default
  Handlebars.registerHelper("default", function(value: any, defaultValue: any) {
    return value !== undefined && value !== null ? value : defaultValue;
  });

  // Helper to prepare items for looping - converts slot-based structure to array of sections
  Handlebars.registerHelper("prepareItemSections", function(items: any) {
    const sections = [
      { key: "highSlots", title: "High Slots" },
      { key: "medSlots", title: "Med Slots" },
      { key: "lowSlots", title: "Low Slots" },
      { key: "rigSlots", title: "Rig Slots" },
      { key: "subSlots", title: "Subsystem Slots" },
      { key: "droneBay", title: "Drones" },
      { key: "cargo", title: "Cargo" }
    ];

    const result: any[] = [];

    sections.forEach(section => {
      const destroyed = items.destroyed[section.key] || [];
      const dropped = items.dropped[section.key] || [];

      if (destroyed.length > 0 || dropped.length > 0) {
        result.push({
          title: section.title,
          items: [
            ...destroyed.map((item: any) => ({ ...item, isDestroyed: true })),
            ...dropped.map((item: any) => ({ ...item, isDestroyed: false }))
          ]
        });
      }
    });

    return result;
  });

  // Round up to nearest valid EVE image size
  // Valid sizes: 32 (types only), 64, 128, 256, 512 (render only)
  Handlebars.registerHelper("roundImageSize", function(requestedSize: number, type: string) {
    const validSizes = type === 'type' || type === 'item' || type === 'ship'
      ? [32, 64, 128, 256, 512]  // types can use 32
      : [64, 128, 256, 512]; // others start at 64

    // Find the smallest valid size that is >= requested size
    for (const size of validSizes) {
      if (size >= requestedSize) {
        return size;
      }
    }
    // If requested size is larger than all valid sizes, return the largest
    return validSizes[validSizes.length - 1];
  });

  // EDK-style date formatting (YYYY-MM-DD HH:MM)
  Handlebars.registerHelper("formatDateEDK", function(date: string | Date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  });

  // EDK-style short date for tables
  Handlebars.registerHelper("formatDateShort", function(date: string | Date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  });

  // Security status formatting
  Handlebars.registerHelper("formatSecStatus", function(sec: number) {
    if (sec >= 0.5) return `<span style="color: #2fef2f;">${sec.toFixed(1)}</span>`;
    if (sec >= 0.1) return `<span style="color: #efef2f;">${sec.toFixed(1)}</span>`;
    return `<span style="color: #ef2f2f;">${sec.toFixed(1)}</span>`;
  });

  // Format security status (plain text)
  Handlebars.registerHelper("formatSecurity", function(sec: number | string | undefined) {
    if (sec === undefined || sec === null) return "?";
    const numSec = typeof sec === "string" ? parseFloat(sec) : sec;
    if (isNaN(numSec)) return "?";
    return numSec.toFixed(1);
  });

  // Format time ago (e.g., "2 hours ago")
  Handlebars.registerHelper("formatTimeAgo", function(date: string | Date) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
    if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return "Just now";
  });

  // Length helper to get array length
  Handlebars.registerHelper("length", function(array: any[]) {
    return Array.isArray(array) ? array.length : 0;
  });

  // Array helper - creates arrays for component props
  Handlebars.registerHelper("array", function(...args: any[]) {
    // Remove the Handlebars options object from the end
    return args.slice(0, -1);
  });

  // Object helper - creates objects for component props
  Handlebars.registerHelper("obj", function(this: any, ...args: any[]) {
    const options = args[args.length - 1];
    return options.hash;
  });

  // JSON helper - converts value to JSON string
  Handlebars.registerHelper("json", function(value: any) {
    return JSON.stringify(value);
  });

  // Concat helper - concatenates strings
  Handlebars.registerHelper("concat", function(...args: any[]) {
    // Remove the Handlebars options object from the end
    return args.slice(0, -1).join("");
  });

  // Check if killmail is a loss for followed entities
  Handlebars.registerHelper("isFollowedLoss", function(victim: any, followedEntities: any) {
    if (!followedEntities || !victim) return false;

    const { characterIds = [], corporationIds = [], allianceIds = [] } = followedEntities;

    // Check if victim matches any followed entity
    if (characterIds.length > 0 && victim.character?.id && characterIds.includes(victim.character.id)) {
      return true;
    }
    if (corporationIds.length > 0 && victim.corporation?.id && corporationIds.includes(victim.corporation.id)) {
      return true;
    }
    if (allianceIds.length > 0 && victim.alliance?.id && allianceIds.includes(victim.alliance.id)) {
      return true;
    }

    return false;
  });

  // Check if killmail is a loss for a specific entity (single ID check)
  Handlebars.registerHelper("isEntityLoss", function(victim: any, entityType: string, entityId: number) {
    if (!victim || !entityType || !entityId) return false;

    // Check based on entity type
    if (entityType === 'character' && victim.character?.id === entityId) {
      return true;
    }
    if (entityType === 'corporation' && victim.corporation?.id === entityId) {
      return true;
    }
    if (entityType === 'alliance' && victim.alliance?.id === entityId) {
      return true;
    }

    return false;
  });
}

/**
 * Clear the template cache (useful for development)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
  console.log("🗑️  Template cache cleared");
}
