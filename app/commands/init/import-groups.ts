import { BaseCommand } from "../../../src/commands/base-command";

export default class ImportGroupsCommand extends BaseCommand {
  override name = "init:import-groups";
  override description = "Import groups from SDE (placeholder)";
  override usage = "init:import-groups";

  async execute(_args: string[]): Promise<void> {
    this.info("Groups import not yet implemented");
    this.info("Groups are not currently stored in the database");
    this.success("✅ Skipped");
  }
}
