import { BaseCommand } from "../../../src/commands/base-command";
import { db } from "../../../src/db";
import { categories } from "../../../db/schema";
import { readFileSync } from "fs";
import { join } from "path";

export default class ImportCategoriesCommand extends BaseCommand {
  override name = "init:import-categories";
  override description = "Import categories from SDE";
  override usage = "init:import-categories";

  async execute(_args: string[]): Promise<void> {
    this.info("Importing categories from SDE...");

    const sdeFilePath = join(process.cwd(), "data", "sde", "categories.jsonl");

    try {
      const fileContent = readFileSync(sdeFilePath, "utf-8");
      const lines = fileContent.trim().split("\n");

      let imported = 0;
      let skipped = 0;

      for (const line of lines) {
        try {
          const category = JSON.parse(line);

          // Extract English name
          const name =
            typeof category.name === "string"
              ? category.name
              : category.name?.en || "Unknown";

          await db
            .insert(categories)
            .values({
              categoryId: category._key,
              name,
              published: category.published || false,
              iconId: category.iconID || null,
            })
            .onConflictDoUpdate({
              target: categories.categoryId,
              set: {
                name,
                published: category.published || false,
                iconId: category.iconID || null,
                updatedAt: new Date(),
              },
            });

          imported++;
        } catch (err) {
          this.error(`Failed to import category: ${err}`);
          skipped++;
        }
      }

      this.success(
        `✅ Imported ${imported} categories (${skipped} skipped)`
      );
    } catch (error) {
      this.error(`Failed to read SDE file: ${error}`);
      throw error;
    }
  }
}
