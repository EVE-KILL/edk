#!/usr/bin/env bun

/**
 * CLI Entry Point
 * Auto-discovers and executes commands from /app/commands/
 * Supports subdirectories with colon notation (e.g., db/migrate.ts → db:migrate)
 */

import { join, basename, relative } from "path";
import type { CliCommand } from "./src/commands/types";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const COMMANDS_DIR = join(__dirname, "app/commands");

/**
 * Recursively discover all command files
 */
async function discoverCommands(): Promise<Map<string, any>> {
  const commands = new Map<string, any>();
  const { Glob } = await import("bun");

  const glob = new Glob("**/*.ts");
  const files = Array.from(glob.scanSync(COMMANDS_DIR));

  for (const file of files) {
    const filePath = join(COMMANDS_DIR, file);
    const module = await import(filePath);

    // Convert file path to command name
    // e.g., "cache/clear.ts" → "cache:clear"
    //       "test.ts" → "test"
    const relativePath = file.replace(/\.ts$/, "");
    const commandName = relativePath.replace(/\//g, ":");

    if (module.default) {
      commands.set(commandName, module.default);
    }
  }

  return commands;
}

/**
 * Show help text with all available commands
 */
function showHelp(commands: Map<string, any>): void {
  console.log("\x1b[1m\nEVE-Kill CLI\x1b[0m");
  console.log("\nUsage: bun cli <command> [options] [args]");
  console.log("\n\x1b[1mAvailable Commands:\x1b[0m");

  // Group commands by category
  const grouped = new Map<string, Array<{ name: string; desc: string }>>();

  for (const [name, CommandClass] of commands) {
    const instance = new CommandClass();
    const category = name.includes(":") ? name.split(":")[0] : "general";

    if (!grouped.has(category)) {
      grouped.set(category, []);
    }

    grouped.get(category)!.push({
      name: instance.name,
      desc: instance.description,
    });
  }

  // Display grouped commands
  for (const [category, cmds] of Array.from(grouped).sort()) {
    console.log(`\n  \x1b[33m${category}\x1b[0m`);
    for (const cmd of cmds.sort((a, b) => a.name.localeCompare(b.name))) {
      const padding = " ".repeat(Math.max(20 - cmd.name.length, 1));
      console.log(`    ${cmd.name}${padding}${cmd.desc}`);
    }
  }

  console.log("\nUse \x1b[36mbun cli <command> --help\x1b[0m for command-specific help");
  console.log();
}

/**
 * Main CLI execution
 */
async function main() {
  const [commandName, ...args] = process.argv.slice(2);

  // Discover all commands
  const commands = await discoverCommands();

  // Show help if no command or --help flag
  if (!commandName || commandName === "--help" || commandName === "-h") {
    showHelp(commands);
    process.exit(0);
  }

  // Get the command class
  const CommandClass = commands.get(commandName);

  if (!CommandClass) {
    console.error(`\x1b[31m✗ Unknown command: ${commandName}\x1b[0m\n`);
    console.log("Run \x1b[36mbun cli --help\x1b[0m to see available commands");
    process.exit(1);
  }

  // Instantiate and execute command
  try {
    const command: CliCommand = new CommandClass();

    // Show command-specific help if requested
    if (args.includes("--help") || args.includes("-h")) {
      command.showHelp();
      process.exit(0);
    }

    await command.execute(args);
  } catch (error) {
    console.error("\x1b[31m✗ Command failed:\x1b[0m", error);
    process.exit(1);
  }
}

// Run CLI
main();
