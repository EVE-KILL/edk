/**
 * Command argument parsing result
 */
export interface CommandArgs {
  /** Boolean flags like --force, --dry-run */
  flags: Record<string, boolean>;
  /** Key-value options like --env=prod, --limit=10 */
  options: Record<string, string>;
  /** Remaining positional arguments */
  positional: string[];
}

/**
 * Base interface for CLI commands
 */
export interface CliCommand {
  /** Command name (auto-derived from file path) */
  name: string;
  /** Short description shown in help text */
  description: string;
  /** Usage pattern: "command [options] [args]" */
  usage: string;
  /** Examples of command usage (optional) */
  examples?: string[];

  /**
   * Execute the command
   * @param args Raw command line arguments
   */
  execute(args: string[]): Promise<void>;

  /**
   * Show help text for this command
   */
  showHelp(): void;
}
