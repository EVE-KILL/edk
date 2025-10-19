import { renderTemplate, TemplateData } from "./templates";
import type {} from "../types/request.d"; // Import Request type extensions
import { cache } from "./cache";
import { db } from "../db";
import * as Models from "../models";

/**
 * Base Controller class that all route controllers should extend
 * Provides common functionality and helper methods similar to PHP MVC frameworks
 */
export abstract class BaseController {
  // Controllers can define which HTTP methods they support
  public static methods: string[] = ["GET"]; // Default to GET only

  protected request: Request;
  protected url: URL;
  protected params: Record<string, string> = {};
  protected headers: Record<string, string> = {};
  protected statusCode: number = 200;

  /**
   * Database access
   * Direct access to Drizzle ORM instance
   */
  protected db = db;

  /**
   * Models - Easy access to all models
   */
  protected models = Models;

  /**
   * Cache helpers for application-level caching
   */
  protected cache = {
    /**
     * Get a value from the cache
     */
    get: <T>(key: string) => cache.get<T>(key),

    /**
     * Set a value in the cache
     */
    set: <T>(key: string, value: T, ttl?: number) => cache.set(key, value, ttl),

    /**
     * Check if a key exists in the cache
     */
    has: (key: string) => cache.has(key),

    /**
     * Delete a key from the cache
     */
    delete: (key: string) => cache.delete(key),

    /**
     * Remember pattern: get from cache or execute and store
     */
    remember: async <T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> => {
      const cached = await cache.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const fresh = await fetchFn();
      await cache.set(key, fresh, ttl);
      return fresh;
    },
  };

  constructor(request: Request) {
    this.request = request;
    this.url = request.parsedUrl || new URL(request.url); // Use pre-parsed URL if available
    this.params = request.params || {};
    this.setupCommonHeaders();
  }

  /**
   * Set up common security and CORS headers
   */
  protected setupCommonHeaders(): void {
    this.setHeader("X-Powered-By", "EVE Kill v4");
    this.setHeader("X-Content-Type-Options", "nosniff");
    this.setHeader("X-Frame-Options", "DENY");
    this.setHeader("X-XSS-Protection", "1; mode=block");
    this.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  }

  /**
   * Get a route parameter by name
   */
  protected getParam(name: string): string | undefined {
    return this.params[name];
  }

  /**
   * Get a query parameter by name
   */
  protected getQuery(name: string): string | undefined {
    return this.url.searchParams.get(name) || undefined;
  }

  /**
   * Get all query parameters as an object
   */
  protected getQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    this.url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  /**
   * Get request body as JSON
   */
  protected async getJsonBody<T = any>(): Promise<T> {
    try {
      return await this.request.json();
    } catch (error) {
      throw new Error("Invalid JSON body");
    }
  }

  /**
   * Get request body as form data
   */
  protected async getFormData(): Promise<FormData> {
    return await this.request.formData();
  }

  /**
   * Set a response header
   */
  protected setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  /**
   * Set multiple headers at once
   */
  protected setHeaders(headers: Record<string, string>): void {
    Object.assign(this.headers, headers);
  }

  /**
   * Set the response status code
   */
  protected setStatus(code: number): void {
    this.statusCode = code;
  }

  /**
   * Check if the request accepts HTML (browser request)
   */
  protected acceptsHtml(): boolean {
    return this.request.headers.get("accept")?.includes("text/html") ?? false;
  }

  /**
   * Check if the request accepts JSON (API request)
   */
  protected acceptsJson(): boolean {
    return this.request.headers.get("accept")?.includes("application/json") ?? false;
  }

  /**
   * Get the request method
   */
  protected getMethod(): string {
    return this.request.method;
  }

  /**
   * Check if request is GET
   */
  protected isGet(): boolean {
    return this.getMethod() === "GET";
  }

  /**
   * Check if request is POST
   */
  protected isPost(): boolean {
    return this.getMethod() === "POST";
  }

  /**
   * Get common template data that should be available on all pages
   */
  protected async getCommonTemplateData(): Promise<TemplateData> {
    return {
      // Current URL for navigation highlighting
      currentUrl: this.url.pathname,

      // Request info
      method: this.getMethod(),

      // Common meta defaults
      meta: {
        author: "EVE Kill",
        keywords: "EVE Online, killmails, killboard, EVE Kill, space combat",
      },

      // Navigation state
      navigation: {
        home: this.url.pathname === "/",
        killmails: this.url.pathname.startsWith("/killmails"),
        api: this.url.pathname.startsWith("/api"),
        leaderboard: this.url.pathname.startsWith("/leaderboard"),
      },

      // User session (would come from auth system)
      user: null, // TODO: Implement authentication

      // Environment info
      isDevelopment: process.env.NODE_ENV !== "production",
    };
  }

  /**
   * Create a JSON response
   */
  protected jsonResponse(data: any, status: number = 200): Response {
    this.setStatus(status);
    this.setHeader("Content-Type", "application/json");

    return new Response(JSON.stringify(data), {
      status: this.statusCode,
      headers: this.headers,
    });
  }

  /**
   * Create an HTML response using templates
   */
  protected async htmlResponse(
    template: string,
    data: TemplateData = {},
    layout: string = "main"
  ): Promise<Response> {
    try {
      // Merge common template data with specific data
      const commonData = await this.getCommonTemplateData();
      const mergedData = { ...commonData, ...data };

      const html = await renderTemplate(template, mergedData, layout);

      this.setHeader("Content-Type", "text/html");

      return new Response(html, {
        status: this.statusCode,
        headers: this.headers,
      });
    } catch (error) {
      console.error("Template rendering error:", error);
      return this.errorResponse("Template rendering failed", 500);
    }
  }

  /**
   * Create a redirect response
   */
  protected redirect(url: string, status: number = 302): Response {
    this.setStatus(status);
    this.setHeader("Location", url);

    return new Response(null, {
      status: this.statusCode,
      headers: this.headers,
    });
  }

  /**
   * Create an error response (JSON or HTML based on request)
   */
  protected errorResponse(message: string, status: number = 400): Response {
    this.setStatus(status);

    if (this.acceptsJson() || !this.acceptsHtml()) {
      // Return JSON error for API requests
      return this.jsonResponse({ error: message, status }, status);
    } else {
      // Return HTML error page for browser requests
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Error ${status}</title></head>
          <body>
            <h1>Error ${status}</h1>
            <p>${message}</p>
            <a href="/">← Back to Home</a>
          </body>
        </html>
      `;

      this.setHeader("Content-Type", "text/html");

      return new Response(html, {
        status: this.statusCode,
        headers: this.headers,
      });
    }
  }

  /**
   * Validate required parameters
   */
  protected validateRequired(params: string[]): void {
    const missing = params.filter(param => !this.getParam(param) && !this.getQuery(param));

    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(", ")}`);
    }
  }

  /**
   * Get pagination parameters with defaults
   */
  protected getPagination(defaultLimit: number = 10, maxLimit: number = 100): { limit: number; offset: number } {
    const limit = Math.min(
      parseInt(this.getQuery("limit") || defaultLimit.toString()),
      maxLimit
    );
    const offset = parseInt(this.getQuery("offset") || "0");

    return { limit: Math.max(1, limit), offset: Math.max(0, offset) };
  }

  /**
   * Abstract method that must be implemented by child controllers
   * This is called by the router to handle the request
   */
  abstract handle(): Promise<Response>;
}
