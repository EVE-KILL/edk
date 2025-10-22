import { BaseController } from "./base-controller";
import { getDefaultApiHeaders } from "../utils/headers";

/**
 * API Controller for JSON endpoints
 */
export abstract class ApiController extends BaseController {
  constructor(request: Request) {
    super(request);
    this.setupApiHeaders();
    this.setHeaderOptions(getDefaultApiHeaders());
  }

  protected setupApiHeaders(): void {
    this.setHeader("Access-Control-Allow-Origin", "*");
    this.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    this.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    this.setHeader("Access-Control-Max-Age", "86400");
  }

  async get?(): Promise<Response>;
  async post?(): Promise<Response>;
  async put?(): Promise<Response>;
  async delete?(): Promise<Response>;
  async patch?(): Promise<Response>;

  async handle(): Promise<Response> {
    const method = this.getMethod().toLowerCase() as "get" | "post" | "put" | "delete" | "patch";
    const handler = this[method];
    if (typeof handler === 'function') {
      return await handler.call(this);
    }
    return this.error("Method not allowed", 405);
  }

  protected json(data: any, status: number = 200): Response {
    this.setStatus(status);
    return this.jsonResponse(data, status);
  }

  protected success(data: any = null, message: string = "Success"): Response {
    return this.json({
      success: true,
      message,
      data
    });
  }

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
