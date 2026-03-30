import type { Config, LogLevel, TargetTsVersion } from './types';
import { getDefaultDataDir } from './types';
import { runGuidedMigration } from './wizard';
import { handleInit } from './init';

/**
 * Parses command line arguments into a config object.
 * @param argv - Process arguments array
 * @returns Partial config object with parsed values
 */
export function parseArgs(argv: string[]): Partial<Config> & { help?: boolean; command?: string } {
  const args = argv.slice(2);
  const config: Partial<Config> & { help?: boolean; command?: string } = {};
  
  if (args.length > 0 && !args[0].startsWith('--')) {
    config.command = args[0];
    args.shift(); // Remove command from args
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--apply':
        config.dryRun = false;
        break;
      case '--log-level':
        config.logLevel = args[++i] as LogLevel;
        break;
      case '--target':
        config.targetTsVersion = args[++i] as TargetTsVersion;
        break;
      case '--data-dir':
        config.dataDir = args[++i];
        break;
      case '--help':
      case '-h':
        config.help = true;
        break;
      case '--interactive':
        config.interactive = true;
        break;
      case '--guided':
        config.guided = true;
        break;
    }
  }
  
  return config;
}

/**
 * Validates and normalizes the parsed configuration with defaults.
 * @param parsed - Partial config from parseArgs
 * @returns Complete validated Config object
 */
export function validateConfig(parsed: Partial<Config> & { help?: boolean; config?: Partial<Config> }): Config {
  const input = parsed.config || parsed;
  
  return {
    dataDir: input.dataDir ?? getDefaultDataDir(),
    dryRun: input.dryRun ?? true,
    logLevel: (input.logLevel as LogLevel) ?? 'info',
    targetTsVersion: (input.targetTsVersion as TargetTsVersion) ?? '6.0',
    files: input.files,
    interactive: input.interactive,
    guided: input.guided,
  };
}

/**
 * Prints the help text for the CLI.
 */
export function printHelp(): void {
  console.log(`
ts-migrate-2026: Painless TypeScript 6.0/7.0 Upgrades

Usage: ts-migrate-2026 [command] [options]

Commands:
  init              Create configuration file interactively

Options:
  --apply           Apply changes (default: dry-run)
  --dry-run         Preview changes without modifying files
  --log-level       Set log level (debug, info, warn, error)
  --target          Target TypeScript version (5.0-7.0)
  --data-dir        Directory for logs and reports
  --interactive     Prompt for each change
  --guided          Run interactive migration wizard
  --help, -h        Show this help message
`);
}

/**
 * Main CLI entry point. Parses arguments and runs the appropriate mode.
 * @param argv - Process arguments (defaults to process.argv)
 * @returns Promise resolving to exit code
 */
export async function runCli(argv: string[] = process.argv): Promise<number> {
  const parsed = parseArgs(argv);
  
  if (parsed.help) {
    printHelp();
    return 0;
  }

  if (parsed.command === 'init') {
    await handleInit();
    return 0;
  }
  
  const config = validateConfig(parsed);
  
  if (config.guided) {
    return await runGuidedMigration(config);
  }
  
  console.log('Use --guided flag for interactive wizard mode, or --apply to run migration directly');
  console.log('Use `ts-migrate-2026 init` to create a configuration file interactively.');
  return 0;
}
