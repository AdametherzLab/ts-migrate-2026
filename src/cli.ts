import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { createIssue, getDefaultDataDir, MigrationError } from './types';
import type { Config, LogLevel, ScanResult, CodemodAction } from './types';
import { Migrator } from './migrator';
import { handleInit } from './init';

interface ParseResult {
  config: Partial<Config>;
  help: boolean;
}

/**
 * Parses command-line arguments into a partial Config object and a help flag.
 * @param argv The array of command-line arguments (e.g., process.argv).
 * @returns An object containing a partial Config and a boolean indicating if help was requested.
 */
export function parseArgs(argv: string[]): ParseResult {
  const args = argv.slice(2);
  const config: Partial<Config> = {};
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--apply') {
      config.dryRun = false;
    } else if (arg === '--log-level') {
      const level = args[++i] as LogLevel;
      if (level && ['info', 'warn', 'error', 'debug'].includes(level)) {
        config.logLevel = level;
      }
    } else if (arg === '--target') {
      const target = args[++i];
      if (target === '6.0' || target === '7.0') { // Extend with more versions as needed
        config.targetTsVersion = target as '6.0' | '7.0';
      }
    } else if (arg === '--data-dir') {
      config.dataDir = args[++i];
    } else if (arg === '--help') {
      help = true;
    } else if (arg === '--files') {
      const filesStr = args[++i];
      if (filesStr) {
        config.files = filesStr.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
  }

  return { config, help };
}

/**
 * Validates and normalizes a partial Config object, applying default values where necessary.
 * @param input A partial Config object, potentially nested under a 'config' key.
 * @returns A complete and validated Config object.
 */
export function validateConfig(input: Partial<Config> & { config?: Partial<Config> }): Config {
  const config = input.config ? input.config : input;
  return {
    dataDir: config.dataDir || getDefaultDataDir(),
    dryRun: config.dryRun ?? true, // Default to true if not explicitly set
    logLevel: config.logLevel || 'info',
    targetTsVersion: config.targetTsVersion || '6.0', // Default target version
    files: config.files, // Keep files as is, can be undefined
  };
}

/**
 * Prints the help message to the console.
 */
export function printHelp(): void {
  console.log(`
ts-migrate-2026 - CLI to automatically fix TypeScript breaking changes for TS 6.0/7.0 migrations

Usage:
  ts-migrate-2026 [options]
  ts-migrate-2026 init

Options:
  --dry-run        Show what changes would be made without applying them (default: true)
  --apply          Apply changes directly to files (overrides --dry-run)
  --log-level      Set log level: info, warn, error, debug (default: info)
  --target         Target TypeScript version: 6.0 or 7.0 (default: 6.0)
  --data-dir       Directory to store migration data (default: ~/.ts-migrate-2026)
  --files          Comma-separated list of files or directories to process
  --help           Show this help message

Commands:
  init             Generate configuration file interactively
`);
}

/**
 * Runs the main CLI logic.
 * @param argv The array of command-line arguments (defaults to process.argv).
 * @returns A Promise that resolves to the exit code (0 for success, 1 for failure).
 */
export async function runCli(argv: string[] = process.argv): Promise<number> {
  if (argv[2] === 'init') {
    try {
      await handleInit();
      return 0;
    } catch (err) {
      console.error('Failed to initialize configuration:', err);
      return 1;
    }
  }

  const { config: args, help } = parseArgs(argv);
  if (help || argv.includes('--help')) {
    printHelp();
    return 0;
  }

  // Attempt to load config from file first, then merge with CLI args
  let fileConfig: Partial<Config> = {};
  const configPath = path.join(process.cwd(), 'ts-migrate.json');
  if (fs.existsSync(configPath)) {
    try {
      const rawConfig = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(rawConfig);
      console.log(`Loaded configuration from ${configPath}`);
    } catch (error) {
      console.warn(`Warning: Could not read or parse ts-migrate.json: ${error instanceof Error ? error.message : String(error)}. Using CLI arguments and defaults.`);
    }
  }

  // Merge file config with CLI args, CLI args take precedence
  const mergedConfig = { ...fileConfig, ...args };
  const config = validateConfig(mergedConfig);
  const dataDir = config.dataDir;

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log(`Using data directory: ${dataDir}`);
    console.log(`Target TypeScript version: ${config.targetTsVersion}`);
    console.log(`Dry run: ${config.dryRun ? 'Enabled' : 'Disabled (applying changes)'}`);
    if (config.files && config.files.length > 0) {
      console.log(`Processing specific files/directories: ${config.files.join(', ')}`);
    } else {
      console.log('Processing all project files.');
    }

    console.log('Scanning project for migration issues...');
    const migrator = new Migrator(config);
    const scanResult = migrator.scan();

    console.log('Migration scan complete.');
    console.log(`Issues found: ${scanResult.issues.length}`);
    console.log(`Files scanned: ${scanResult.filesScanned}`);

    if (scanResult.issues.length > 0) {
      console.log('Applying codemods...');
      const actions = migrator.applyCodemods(scanResult.issues);

      if (actions.length > 0) {
        console.log(`Generated ${actions.length} codemod actions.`);
        for (const action of actions) {
          console.log(`
--- Diff for ${action.filePath} (${action.description}) ---`);
          console.log(action.oldContent);
          console.log('--------------------------------------------------');
          console.log(action.newContent);
          console.log('--------------------------------------------------');

          if (!config.dryRun) {
            fs.writeFileSync(action.filePath, action.newContent, 'utf-8');
            console.log(`Applied changes to ${action.filePath}`);
          } else {
            console.log(`(Dry run) Changes for ${action.filePath} not applied.`);
          }
        }
      } else {
        console.log('No codemod actions generated for the found issues.');
      }
    } else {
      console.log('No migration issues found. Your project seems compatible!');
    }

    return 0;
  } catch (err) {
    if (err instanceof MigrationError) {
      console.error(`
Migration failed: ${err.message}`);
      if (err.cause) {
        console.error(`Caused by: ${err.cause instanceof Error ? err.cause.message : String(err.cause)}`);
      }
    } else if (err instanceof Error) {
      console.error(`
An unexpected error occurred: ${err.message}`);
      console.error(err.stack);
    } else {
      console.error(`
An unknown error occurred: ${String(err)}`);
    }
    return 1;
  }
}

if (import.meta.main) {
  runCli().catch((err) => {
    console.error('Migration process exited with an unhandled error:', err);
    process.exit(1);
  });
}
