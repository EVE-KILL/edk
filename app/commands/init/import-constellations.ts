import { BaseCommand } from "../../../src/commands/base-command";

export default class ImportConstellationsCommand extends BaseCommand {
  override name = "init:import-constellations";
  override description = "Import constellations from SDE (placeholder)";
  override usage = "init:import-constellations";

  async execute(_args: string[]): Promise<void> {
    this.info("Constellations import not yet implemented");
    this.info("Constellations are not currently stored in the database");
    this.success("✅ Skipped");
  }
}
