import { ApiController } from "../../../utils/api-controller";

export class Controller extends ApiController {
  async get(): Promise<Response> {
    const { limit, offset } = this.getPagination();

    // Mock users data
    const users = Array.from({ length: limit }, (_, i) => ({
      id: offset + i + 1,
      name: `User ${offset + i + 1}`,
      corporation: `Corporation ${Math.floor(Math.random() * 100)}`,
      killmails: Math.floor(Math.random() * 1000),
      losses: Math.floor(Math.random() * 500)
    }));

    return this.paginated(users, 10000, limit, offset);
  }

  async post(): Promise<Response> {
    try {
      const body = await this.getJsonBody();

      // Basic validation
      if (!body.name) {
        return this.validationError({
          name: ["Name is required"]
        });
      }

      // Mock user creation
      const newUser = {
        id: Math.floor(Math.random() * 10000),
        ...body,
        createdAt: new Date().toISOString(),
        killmails: 0,
        losses: 0
      };

      return this.created(newUser, "User created successfully");
    } catch (error) {
      return this.error("Invalid JSON body", 400);
    }
  }
}
