import { BaseController } from "./base-controller";
import type { TemplateData } from "../server/templates";

/**
 * Web Controller for HTML pages that render templates
 * All web controllers should extend this class
 *
 * You can either:
 * 1. Implement a single handle() method for simple controllers
 * 2. Implement method-specific functions like get(), post(), etc.
 */
export abstract class WebController extends BaseController {
  /**
   * Optional method-specific handlers
   */
  async get?(): Promise<Response>;
  async post?(): Promise<Response>;
  async put?(): Promise<Response>;
  async delete?(): Promise<Response>;
  async patch?(): Promise<Response>;

  /**
   * Default handle method - can be overridden or will route to method-specific handlers
   */
  async handle(): Promise<Response> {
    const method = this.getMethod().toLowerCase() as "get" | "post" | "put" | "delete" | "patch";

    // Try to call the method-specific handler first with proper typing
    const handler = this[method];
    if (typeof handler === 'function') {
      return await handler.call(this);
    }

    // If no method-specific handler, show 404
    return this.notFound("Page not found");
  }
  /**
   * Render a template with data
   * @param template - Template name (e.g., "pages/home")
   * @param data - Data to pass to the template
   * @param layout - Layout template (defaults to "main")
   */
  protected async render(
    template: string,
    data: TemplateData = {},
    layout: string = "main"
  ): Promise<Response> {
    return await this.htmlResponse(template, data, layout);
  }

  /**
   * Render with a custom page title and meta description
   */
  protected async renderPage(
    template: string,
    title: string,
    description: string,
    data: TemplateData = {},
    layout: string = "main"
  ): Promise<Response> {
    const pageData = {
      ...data,
      title,
      meta: {
        ...data.meta,
        description
      }
    };

    return await this.render(template, pageData, layout);
  }

  /**
   * Redirect to another URL
   */
  protected redirectTo(url: string, status: number = 302): Response {
    return this.redirect(url, status);
  }

  /**
   * Show a 404 page
   */
  protected notFound(message: string = "Page not found"): Promise<Response> {
    this.setStatus(404);
    return this.render("pages/404", { message });
  }

  /**
   * Show an error page with custom status code
   */
  protected showError(
    statusCode: number,
    message: string,
    description?: string
  ): Promise<Response> {
    this.setStatus(statusCode);

    // Use specific template if available, otherwise use generic error template
    const templateMap: Record<number, string> = {
      401: "pages/401",
      403: "pages/403",
      404: "pages/404",
      500: "pages/500",
    };

    const template = templateMap[statusCode] || "pages/error";

    return this.render(template, {
      message,
      description,
      statusCode,
    });
  }

  /**
   * Show a 401 unauthorized page
   */
  protected unauthorized(message: string = "You need to be logged in"): Promise<Response> {
    return this.showError(401, message);
  }

  /**
   * Show a 403 forbidden page
   */
  protected forbidden(message: string = "Access denied"): Promise<Response> {
    return this.showError(403, message);
  }

  /**
   * Show a 500 error page
   */
  protected serverError(message: string = "Something went wrong"): Promise<Response> {
    return this.showError(500, message);
  }
}
