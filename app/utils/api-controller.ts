import { BaseController } from "./base-controller";

/**
 * API Controller for JSON endpoints
 * All API controllers should extend this class and implement method-specific handlers
 * like get(), post(), put(), delete(), patch()
 */
export abstract class ApiController extends BaseController {
  constructor(request: Request) {
    super(request);
    this.setupApiHeaders();
  }

  /**
   * Set up CORS and API-specific headers
   */
  protected setupApiHeaders(): void {
    // CORS headers
    this.setHeader("Access-Control-Allow-Origin", "*");
    this.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    this.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    this.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
  }

  /**
   * Method-specific handlers - implement these in your controller
   */
  async get?(): Promise<Response>;
  async post?(): Promise<Response>;
  async put?(): Promise<Response>;
  async delete?(): Promise<Response>;
  async patch?(): Promise<Response>;

  /**
   * Main handler that routes to method-specific functions
   */
  async handle(): Promise<Response> {
    const method = this.getMethod().toLowerCase() as "get" | "post" | "put" | "delete" | "patch";

    // Try to call the method-specific handler with proper typing
    const handler = this[method];
    if (typeof handler === 'function') {
      return await handler.call(this);
    }

    return this.error("Method not allowed", 405);
  }
  /**
   * Return JSON data with optional status code
   */
  protected json(data: any, status: number = 200): Response {
    this.setStatus(status);
    return this.jsonResponse(data, status);
  }

  /**
   * Return success response with data
   */
  protected success(data: any = null, message: string = "Success"): Response {
    return this.json({
      success: true,
      message,
      data
    });
  }

  /**
   * Return error response
   */
  protected error(message: string, status: number = 400, errors: any = null): Response {
    const errorData: any = {
      success: false,
      error: message,
      status
    };

    if (errors) {
      errorData.errors = errors;
    }

    return this.json(errorData, status);
  }

  /**
   * Return validation error response
   */
  protected validationError(errors: Record<string, string[]>): Response {
    return this.error("Validation failed", 422, errors);
  }

  /**
   * Return not found error
   */
  protected notFound(message: string = "Resource not found"): Response {
    return this.error(message, 404);
  }

  /**
   * Return unauthorized error
   */
  protected unauthorized(message: string = "Unauthorized"): Response {
    return this.error(message, 401);
  }

  /**
   * Return forbidden error
   */
  protected forbidden(message: string = "Forbidden"): Response {
    return this.error(message, 403);
  }

  /**
   * Return server error
   */
  protected serverError(message: string = "Internal server error"): Response {
    return this.error(message, 500);
  }

  /**
   * Return paginated data
   */
  protected paginated(
    data: any[],
    total: number,
    limit: number,
    offset: number,
    meta: any = {}
  ): Response {
    return this.json({
      data,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
        hasNext: offset + limit < total,
        hasPrev: offset > 0
      },
      meta
    });
  }

  /**
   * Return created resource response
   */
  protected created(data: any, message: string = "Resource created"): Response {
    return this.json({
      success: true,
      message,
      data
    }, 201);
  }

  /**
   * Return updated resource response
   */
  protected updated(data: any, message: string = "Resource updated"): Response {
    return this.success(data, message);
  }

  /**
   * Return deleted resource response
   */
  protected deleted(message: string = "Resource deleted"): Response {
    return this.json({
      success: true,
      message
    });
  }
}
