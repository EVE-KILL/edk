/**
 * Type definitions for extending global interfaces
 */

declare global {
  /**
   * Extend the Request interface to include route params and parsed URL
   */
  interface Request {
    params?: Record<string, string>;
    parsedUrl?: URL;
  }
}

/**
 * HTTP method types
 */
export type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "options" | "head";

/**
 * Controller method handler type
 */
export type MethodHandler = () => Promise<Response>;

/**
 * Controller with method handlers
 */
export interface ControllerWithMethods {
  get?(): Promise<Response>;
  post?(): Promise<Response>;
  put?(): Promise<Response>;
  delete?(): Promise<Response>;
  patch?(): Promise<Response>;
  options?(): Promise<Response>;
  head?(): Promise<Response>;
}

// Required for global augmentation
export {};
