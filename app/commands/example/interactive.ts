import { BaseCommand } from "../../../src/commands/base-command";

/**
 * Interactive example command
 * Demonstrates all BaseCommand features: prompts, confirmations, selections, flags, options
 */
export default class InteractiveExampleCommand extends BaseCommand {
  name = "example:interactive";
  description = "Interactive demo of CLI features";
  usage = "example:interactive [options]";
  examples = [
    "bun cli example:interactive              # Run interactively",
    "bun cli example:interactive --skip       # Skip interactive mode",
    "bun cli example:interactive --name=Bob   # Provide name via flag",
  ];

  override async execute(args: string[]): Promise<void> {
    const { flags, options, positional } = this.parseArgs(args);

    this.info("Welcome to the interactive CLI demo!");
    this.log("");

    // 1. Text prompt
    let name: string;
    if (options.name) {
      name = options.name;
      this.info(`Using provided name: ${name}`);
    } else if (!flags.skip) {
      name = await this.prompt("What's your name?");
    } else {
      name = "Anonymous";
    }

    // 2. Selection
    let color: string;
    if (!flags.skip) {
      color = await this.select(
        "Pick your favorite color:",
        ["Red", "Green", "Blue", "Yellow"]
      );
    } else {
      color = "Blue";
    }

    // 3. Confirmation
    let confirmed = true;
    if (!flags.force && !flags.skip) {
      confirmed = await this.confirm(
        "Do you want to proceed with these choices?",
        true
      );
    }

    if (!confirmed) {
      this.warn("Operation cancelled by user");
      return;
    }

    // 4. Show results
    this.log("");
    this.info("=== Your Choices ===");
    this.log(`Name: ${name}`);
    this.log(`Color: ${color}`);
    this.log(`Positional args: ${positional.join(", ") || "none"}`);
    this.log(`Flags: ${Object.keys(flags).join(", ") || "none"}`);
    this.log(`Options: ${Object.entries(options).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}`);
    this.log("");

    // 5. Success message
    this.success("Demo completed successfully!");
  }
}
