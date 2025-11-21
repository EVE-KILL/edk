import { Command } from 'commander'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import { logger } from './server/helpers/logger'
import { database } from './server/helpers/database'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

interface CommandInfo {
  name: string
  description: string
  category: string
  displayName: string
}

const loadedCommands: CommandInfo[] = []

async function loadCommands(program: Command): Promise<void> {
  const commandsDir = join(__dirname, 'commands')

  try {
    await loadCommandsRecursive(program, commandsDir, '')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      logger.warn('No commands directory found at:', { path: commandsDir })
    } else {
      throw error
    }
  }
}

async function loadCommandsRecursive(
  program: Command,
  dir: string,
  prefix: string
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const name = entry.name.replace(/\.(ts|js)$/, '')

    if (entry.isDirectory()) {
      // Recursively load commands from subdirectories
      const newPrefix = prefix ? `${prefix}:${name}` : name
      await loadCommandsRecursive(program, fullPath, newPrefix)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      // Load command file
      try {
        const commandModule = await import(`file://${fullPath}?t=${Date.now()}`)
        const commandExport = commandModule.default || commandModule

        // Build command name
        const commandName = prefix ? `${prefix}:${name}` : name

        // Handle different export types
        if (typeof commandExport === 'function') {
          // Function that returns a command config
          const commandConfig = commandExport()
          registerCommand(program, commandName, commandConfig)
        } else if (commandExport && typeof commandExport === 'object') {
          // Direct command config object
          registerCommand(program, commandName, commandExport)
        }
      } catch (error) {
        logger.error(`Failed to load command from ${fullPath}:`, { error: String(error) })
      }
    }
  }
}

interface CommandConfig {
  description?: string
  options?: Array<{ flags: string; description: string }>
  action: (options: any, ...args: any[]) => Promise<void> | void
}

function registerCommand(
  program: Command,
  name: string,
  config: CommandConfig
): void {
  let cmd = program.command(name)

  if (config.description) {
    cmd = cmd.description(config.description)
  }

  if (config.options && Array.isArray(config.options)) {
    for (const option of config.options) {
      cmd = cmd.option(option.flags, option.description)
    }
  }

  cmd.action(config.action)

  // Track command for help formatting
  const category = name.includes(':') ? name.split(':')[0] : 'core'
  const displayName = name.includes(':') ? name.split(':').slice(1).join(':') : name
  loadedCommands.push({
    name,
    description: config.description || '',
    category,
    displayName
  })
}

function formatCategorizedHelp(): string {
  let output = ''

  if (loadedCommands.length > 0) {
    // Group commands by category
    const grouped = new Map<string, CommandInfo[]>()
    for (const cmd of loadedCommands) {
      if (!grouped.has(cmd.category)) {
        grouped.set(cmd.category, [])
      }
      grouped.get(cmd.category)!.push(cmd)
    }

    // Sort categories with 'core' first
    const categories = Array.from(grouped.keys()).sort((a, b) => {
      if (a === 'core') return -1
      if (b === 'core') return 1
      return a.localeCompare(b)
    })

    output += `${chalk.bold('Commands')}:\n`
    for (const category of categories) {
      const cmds = grouped.get(category)!
      output += `  ${chalk.cyan(chalk.bold(category))}:\n`
      for (const cmd of cmds) {
        const cmdName = cmd.displayName.padEnd(24)
        output += `    ${chalk.green(cmdName)} ${chalk.dim(cmd.description)}\n`
      }
    }
  }

  return output
}

async function main(): Promise<void> {
  const program = new Command()

  program
    .name('bun cli')
    .description('CLI tool with path-based command routing')
    .version('1.0.0')

  await loadCommands(program)

  // Override the default help by patching helpInformation
  program.helpInformation = function () {
    let help = `${chalk.bold('Usage:')} ${chalk.blue(this.usage())}\n\n`

    if (this.description()) {
      help += `${this.description()}\n\n`
    }

    const options = this.options
    if (options.length > 0) {
      help += `${chalk.bold('Options')}:\n`
      for (const option of options) {
        const flags = option.flags
        const description = option.description || ''
        help += `  ${chalk.cyan(flags.padEnd(20))} ${chalk.dim(description)}\n`
      }
      help += '\n'
    }

    help += formatCategorizedHelp()

    return help
  }

  if (process.argv.length < 3) {
    program.outputHelp()
  } else {
    await program.parseAsync(process.argv)
  }
}

main()
  .catch((error) => {
    logger.error('CLI Error:', { error: String(error) })
    process.exit(1)
  })
  .finally(async () => {
    await database.close()
  })
