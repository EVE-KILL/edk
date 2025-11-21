import type { CliCommand, CommandArgs } from "./types";
import { Command } from "commander";
import { logger } from "../../src/utils/logger";
import { stdin as input, stdout as output } from "process";
import * as readline from "readline";

/**
 * Base class for all CLI commands
 * Provides common functionality like logging, argument parsing, and user prompts
 */
export abstract class BaseCommand implements CliCommand {
  abstract name: string;
  abstract description: string;
  abstract usage: string;
  examples?: string[];

  /**
   * Parse command line arguments into structured format
   * @param args Raw command line arguments
   * @returns Parsed arguments with flags, options, and positional args
   *
   * @example
   * parseArgs(['--force', '--env=prod', 'arg1', 'arg2'])
   * // Returns: { flags: { force: true }, options: { env: 'prod' }, positional: ['arg1', 'arg2'] }
   */
  protected parseArgs(args: string[]): CommandArgs {
    const flags: Record<string, boolean> = {};
    const options: Record<string, string> = {};
    const positional: string[] = [];

    for (const arg of args) {
      if (arg.startsWith("--")) {
        const withoutDashes = arg.slice(2);
        const equalsIndex = withoutDashes.indexOf("=");

        if (equalsIndex > -1) {
          // Option with value: --key=value
          const key = withoutDashes.slice(0, equalsIndex);
          const value = withoutDashes.slice(equalsIndex + 1);
          options[key] = value;
        } else {
          // Boolean flag: --flag
          flags[withoutDashes] = true;
        }
      } else if (arg.startsWith("-")) {
        // Short flag: -f
        flags[arg.slice(1)] = true;
      } else {
        // Positional argument
        positional.push(arg);
      }
    }

    return { flags, options, positional };
  }

  /**
   * Prompt user for input
   * @param question Question to ask the user
   * @returns User's input as a string
   */
  protected async prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input, output });

    return new Promise((resolve) => {
      rl.question(`${question} `, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Prompt user for confirmation (yes/no)
   * @param question Question to ask the user
   * @param defaultValue Default value if user just presses enter
   * @returns true if user confirmed, false otherwise
   */
  protected async confirm(
    question: string,
    defaultValue: boolean = false
  ): Promise<boolean> {
    const defaultText = defaultValue ? "Y/n" : "y/N";
    const answer = await this.prompt(`${question} [${defaultText}]`);

    if (!answer) {
      return defaultValue;
    }

    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
  }

  /**
   * Prompt user to select from a list of choices
   * @param question Question to ask the user
   * @param choices Array of choices
   * @returns Selected choice
   */
  protected async select(question: string, choices: string[]): Promise<string> {
    this.info(question);
    choices.forEach((choice, index) => {
      console.log(`  ${index + 1}. ${choice}`);
    });

    const answer = await this.prompt("Enter number:");
    const index = parseInt(answer) - 1;

    if (index < 0 || index >= choices.length) {
      this.error("Invalid selection");
      return this.select(question, choices);
    }

    return choices[index]!;
  }

  // Logging helpers
  protected info(msg: string): void {
    logger.info(msg);
  }

  protected error(msg: string): void {
    logger.error(msg);
  }

  protected warn(msg: string): void {
    logger.warn(msg);
  }

  protected success(msg: string): void {
    console.log(`\x1b[32m✓\x1b[0m ${msg}`);
  }

  protected log(msg: string): void {
    console.log(msg);
  }

  /**
   * Show help text for this command
   */
  showHelp(): void {
    console.log(`\n\x1b[1mUsage:\x1b[0m ${this.usage}`);
    console.log(`\n\x1b[1mDescription:\x1b[0m\n  ${this.description}`);

    if (this.examples && this.examples.length > 0) {
      console.log(`\n\x1b[1mExamples:\x1b[0m`);
      this.examples.forEach((example) => {
        console.log(`  ${example}`);
      });
    }
    console.log();
  }

  abstract execute(args: string[]): Promise<void>;
}
