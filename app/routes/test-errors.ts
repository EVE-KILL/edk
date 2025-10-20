import { WebController } from "../../src/controllers/web-controller";

export class Controller extends WebController {
  async handle(): Promise<Response> {
    const type = this.getQuery("type") || "404";

    switch (type) {
      case "401":
        return this.unauthorized("You must be logged in to view this page");

      case "403":
        return this.forbidden("You don't have permission to access this resource");

      case "404":
        return this.notFound("This test page was intentionally not found");

      case "500":
        return this.serverError("This is a test 500 error");

      case "throw":
        // This will be caught by the router's error handler
        throw new Error("This is a test exception that was thrown");

      case "custom":
        return this.showError(
          418,
          "I'm a teapot",
          "This server refuses to brew coffee because it is, permanently, a teapot."
        );

      default:
        return this.render("pages/error", {
          statusCode: 200,
          message: "Error Testing Page",
          description: `
            Test different error pages by adding ?type= parameter:
            - ?type=401 - Unauthorized
            - ?type=403 - Forbidden
            - ?type=404 - Not Found
            - ?type=500 - Server Error
            - ?type=throw - Thrown exception
            - ?type=custom - Custom error (418)
          `
        });
    }
  }
}
