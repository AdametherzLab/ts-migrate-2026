import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Config, LogLevel, TargetTsVersion, getDefaultDataDir } from './types';

const VALID_TARGET_VERSIONS: TargetTsVersion[] = ['5.0', '5.1', '5.2', '5.3', '5.4', '5.5', '6.0', '7.0'];
const VALID_LOG_LEVELS: LogLevel[] = ['info', 'warn', 'error', 'debug'];

/**
 * Guides the user through creating a migration configuration file interactively.
 * The generated config file `ts-migrate.json` will be saved in the current working directory.
 */
export async function handleInit(): Promise<void> {
  console.log('\n🚀 Welcome to ts-migrate-2026 Setup Wizard 🚀');
  console.log('This interactive guide will help you create a migration configuration.');
  console.log('Press Enter to accept default values shown in brackets.\n');

  // ─── Project Settings ─────────────────────────────────────
  console.log('🛠️  Project Settings');
  const targetVersion = await askQuestion(
    `Target TypeScript version (${VALID_TARGET_VERSIONS.join(', ')}) [6.0]: `,
    '6.0',
    validateTargetVersion,
    'Select the TypeScript version you want to migrate to.\n  - 6.0: Stable release with new type checking\n  - 7.0: Latest features (experimental support)'
  );

  const defaultDataDir = getDefaultDataDir();
  const dataDir = await askQuestion(
    `Storage directory for logs/reports [${defaultDataDir}]: `,
    defaultDataDir,
    validateDataDir,
    'Where should we store migration logs and analysis reports?'
  );

  // ─── Migration Behavior ───────────────────────────────────
  console.log('\n⚙️  Migration Behavior');
  const dryRun = await askYesNo(
    'Enable safe mode (dry run) to preview changes without modifying files?',
    true,
    '\x1b[33mSafe mode is recommended for first runs. No files will be modified.\x1b[0m'
  );

  const logLevel = await askQuestion(
    `Log verbosity level (${VALID_LOG_LEVELS.join(', ')}) [info]: `,
    'info',
    validateLogLevel,
    'Control the detail level of migration logs:\n  - debug: Full technical details\n  - info: Progress updates\n  - warn: Only warnings/errors'
  );

  // ─── File Selection ───────────────────────────────────────
  console.log('\n📁 File Selection');
  const files = await askQuestion(
    'Specific files/directories to process (comma-separated globs) [all files]: ',
    '',
    validateFiles,
    'Examples:\n  - src/**/*.ts  All TypeScript files in src\n  - test, lib     Specific directories'
  ).then(f => f.split(',').map(s => s.trim()).filter(Boolean));

  // ─── Config Summary ───────────────────────────────────────
  const config: Config = {
    targetTsVersion: targetVersion as TargetTsVersion,
    dataDir,
    dryRun,
    logLevel: logLevel as LogLevel,
    files: files.length > 0 ? files : undefined
  };

  console.log('\n✅ \x1b[1mConfiguration Summary:\x1b[0m');
  console.log(`│ Target Version: \x1b[36m${config.targetTsVersion}\x1b[0m`);
  console.log(`│ Data Directory: \x1b[36m${config.dataDir}\x1b[0m`);
  console.log(`│ Dry Run:        \x1b[36m${config.dryRun ? 'Enabled' : 'Disabled'}\x1b[0m`);
  console.log(`│ Log Level:      \x1b[36m${config.logLevel}\x1b[0m`);
  console.log(`│ Files:          \x1b[36m${config.files?.join(', ') || 'All project files'}\x1b[0m`);

  const confirm = await askYesNo('\nCreate configuration file with these settings?', true);
  if (!confirm) {
    console.log('\n\x1b[33mConfiguration cancelled. No files were created.\x1b[0m');
    return;
  }

  const configPath = path.join(process.cwd(), 'ts-migrate.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n🎉 \x1b[32mConfiguration saved to ${path.relative(process.cwd(), configPath)}\x1b[0m`);
  console.log('Run \x1b[1mts-migrate-2026\x1b[0m to start your migration!');
}

/**
 * Asks a question to the user with optional explanation
 */
async function askQuestion(
  question: string,
  defaultValue: string,
  validator: (input: string) => string,
  explanation?: string
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (explanation) {
    console.log('\n' + explanation);
  }

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const input = answer.trim();
      const valueToValidate = input === '' ? defaultValue : input;
      const validated = validator(valueToValidate);
      resolve(validated);
    });
  });
}

/**
 * Enhanced yes/no prompt with explanation
 */
async function askYesNo(
  question: string,
  defaultValue: boolean,
  explanation?: string
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (explanation) {
    console.log('\n' + explanation);
  }

  const defaultStr = defaultValue ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`\x1b[1m${question}\x1b[0m (${defaultStr})? `, (answer) => {
      rl.close();
      const input = answer.trim().toLowerCase();
      if (input === 'y' || input === 'yes') resolve(true);
      else if (input === 'n' || input === 'no') resolve(false);
      else resolve(defaultValue);
    });
  });
}

function validateTargetVersion(input: string): string {
  if (VALID_TARGET_VERSIONS.includes(input as TargetTsVersion)) return input;
  console.log(`\x1b[33m⚠️  Invalid version. Using default: 6.0. Valid options: ${VALID_TARGET_VERSIONS.join(', ')}\x1b[0m`);
  return '6.0';
}

function validateLogLevel(input: string): string {
  if (VALID_LOG_LEVELS.includes(input as LogLevel)) return input;
  console.log(`\x1b[33m⚠️  Invalid level. Using default: info. Valid options: ${VALID_LOG_LEVELS.join(', ')}\x1b[0m`);
  return 'info';
}

function validateDataDir(input: string): string {
  return input.trim() || getDefaultDataDir();
}

function validateFiles(input: string): string {
  return input;
}
