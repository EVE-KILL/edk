import { BaseCommand } from "../../../src/commands/base-command";

export default class ImportTypesCommand extends BaseCommand {
  override name = "init:import-types";
  override description = "Import types from SDE (use EverRef instead)";
  override usage = "init:import-types";

  async execute(_args: string[]): Promise<void> {
    this.info("Types import from SDE skipped");
    this.info("Types will be imported from EverRef which includes category_id");
    this.success("✅ Skipped (will use EverRef data)");
  }
}
