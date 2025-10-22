import { BaseCommand } from "../../../src/commands/base-command";
import { db } from "../../../src/db";
import { groups } from "../../../db/schema";
import { readFileSync } from "fs";
import { join } from "path";

export default class ImportGroupsCommand extends BaseCommand {
  override name = "init:import-groups";
  override description = "Import groups from SDE";
  override usage = "init:import-groups";

  async execute(_args: string[]): Promise<void> {
    this.info("Importing groups from SDE...");

    const sdeFilePath = join(process.cwd(), "data", "sde", "groups.jsonl");

    try {
      const fileContent = readFileSync(sdeFilePath, "utf-8");
      const lines = fileContent.trim().split("\n");

      let imported = 0;
      let skipped = 0;

      for (const line of lines) {
        try {
          const group = JSON.parse(line);

          // Extract English name
          const name =
            typeof group.name === "string"
              ? group.name
              : group.name?.en || "Unknown";

          await db
            .insert(groups)
            .values({
              groupId: group._key,
              name,
              categoryId: group.categoryID,
              published: group.published || false,
              iconId: group.iconID || null,
              anchorable: group.anchorable || false,
              anchored: group.anchored || false,
              fittableNonSingleton: group.fittableNonSingleton || false,
              useBasePrice: group.useBasePrice || false,
            })
            .onConflictDoUpdate({
              target: groups.groupId,
              set: {
                name,
                categoryId: group.categoryID,
                published: group.published || false,
                iconId: group.iconID || null,
                anchorable: group.anchorable || false,
                anchored: group.anchored || false,
                fittableNonSingleton: group.fittableNonSingleton || false,
                useBasePrice: group.useBasePrice || false,
                updatedAt: new Date(),
              },
            });

          imported++;
        } catch (err) {
          this.error(`Failed to import group: ${err}`);
          skipped++;
        }
      }

      this.success(`✅ Imported ${imported} groups (${skipped} skipped)`);
    } catch (error) {
      this.error(`Failed to read SDE file: ${error}`);
      throw error;
    }
  }
}
