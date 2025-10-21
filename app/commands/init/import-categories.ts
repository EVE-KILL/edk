import { BaseCommand } from "../../../src/commands/base-command";

export default class ImportCategoriesCommand extends BaseCommand {
  override name = "init:import-categories";
  override description = "Import categories from SDE (placeholder)";
  override usage = "init:import-categories";

  async execute(_args: string[]): Promise<void> {
    this.info("Categories import not yet implemented");
    this.info("Categories are not currently stored in the database");
    this.success("✅ Skipped");
  }
}
