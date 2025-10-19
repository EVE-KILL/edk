import { ApiController } from "../../../utils/api-controller";

export class Controller extends ApiController {
  async get(): Promise<Response> {
    const userId = this.getParam('id');

    if (!userId) {
      return this.error("User ID is required", 400);
    }

    // Mock user data
    const user = {
      id: userId,
      name: `User ${userId}`,
      corporation: "Test Corporation",
      alliance: "Test Alliance",
      killmails: Math.floor(Math.random() * 1000),
      losses: Math.floor(Math.random() * 500)
    };

    return this.success(user);
  }

  async put(): Promise<Response> {
    const userId = this.getParam('id');

    if (!userId) {
      return this.error("User ID is required", 400);
    }

    try {
      const body = await this.getJsonBody();

      // Mock update operation
      const updatedUser = {
        id: userId,
        ...body,
        updatedAt: new Date().toISOString()
      };

      return this.updated(updatedUser, "User updated successfully");
    } catch (error) {
      return this.error("Invalid JSON body", 400);
    }
  }

  async delete(): Promise<Response> {
    const userId = this.getParam('id');

    if (!userId) {
      return this.error("User ID is required", 400);
    }

    return this.deleted(`User ${userId} deleted successfully`);
  }
}
