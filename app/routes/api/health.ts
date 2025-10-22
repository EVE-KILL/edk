import { ApiController } from "../../../src/controllers/api-controller";

export class Controller extends ApiController {
  static cacheConfig = {
    ttl: 5,
    staleWhileRevalidate: 10,
  };

  override async get(): Promise<Response> {
    const healthData = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "4.0.0",
      method: this.getMethod()
    };

    return this.json(healthData);
  }
}
