import { WebController } from "../../../src/controllers/web-controller";
import { generateItemDetail } from "../../generators/item";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 120,                    // Fresh for 2 minutes
    staleWhileRevalidate: 300,   // Serve stale for 5 more minutes while refreshing
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const itemId = this.getParam("id");

    if (!itemId) {
      return this.notFound("Item not found");
    }

    const itemDetail = await generateItemDetail(parseInt(itemId, 10));

    if (!itemDetail) {
      return this.notFound(`Item #${itemId} not found`);
    }

    const data = {
      ...itemDetail,
      entityName: itemDetail.item.name,
      imageUrl: `https://images.eve-kill.com/types/${itemDetail.item.id}/icon?size=256`,
      currentTab: 'dashboard',
      baseUrl: `/item/${itemId}`,
    };

    return await this.renderPage(
      "pages/item-detail",
      `${itemDetail.item.name}`,
      `Item profile for ${itemDetail.item.name}`,
      data
    );
  }
}
