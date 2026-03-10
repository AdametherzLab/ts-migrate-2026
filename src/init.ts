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
    validateTargetVersion
  );

  const defaultDataDir = getDefaultDataDir();
  const dataDir = await askQuestion(
    `Storage directory for logs/reports [${defaultDataDir}]: `,
    defaultDataDir,
    validateDataDir
  );

  // ─── Migration Behavior ───────────────────────────────────
  console.log('\n⚙️  Migration Behavior');
  const dryRun = await askYesNo(
    'Enable safe mode (dry run) to preview changes without modifying files?',
    true
  );

  const logLevel = await askQuestion(
    `Log verbosity level (${VALID_LOG_LEVELS.join(', ')}) [info]: `,
    'info',
    validateLogLevel
  );

  // ─── File Selection ───────────────────────────────────────
  console.log('\n📁 File Selection');
  const files = await askQuestion(
    'Specific files/directories to process (comma-separated, e.g. "src/, test/**/*.ts") [all files]: ',
    '',
    validateFiles
  ).then(f => f.split(',').map(s => s.trim()).filter(Boolean));

  // ─── Config Summary ───────────────────────────────────────
  const config: Config = {
    targetTsVersion: targetVersion as TargetTsVersion,
    dataDir,
    dryRun,
    logLevel: logLevel as LogLevel,
    files: files.length > 0 ? files : undefined
  };

  console.log('\n✅ Configuration Summary:');
  console.log(`• Target Version: ${config.targetTsVersion}`);
  console.log(`• Data Directory: ${config.dataDir}`);
  console.log(`• Dry Run: ${config.dryRun ? 'Enabled' : 'Disabled'}`);
  console.log(`• Log Level: ${config.logLevel}`);
  console.log(`• Files: ${config.files?.join(', ') || 'All project files'}`);

  const confirm = await askYesNo('\nCreate configuration file with these settings?', true);
  if (!confirm) {
    console.log('\nConfiguration cancelled. No files were created.');
    return;
  }

  const configPath = path.join(process.cwd(), 'ts-migrate.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n🎉 Configuration saved to ${path.relative(process.cwd(), configPath)}`);
  console.log('Run "ts-migrate-2026" to start your migration!');
}

/**
 * Asks a question to the user and returns their answer, applying a default if empty.
 * Includes a validator function to ensure the input is valid.
 * @param question The question to ask.
 * @param defaultValue The default value to use if the user enters nothing.
 * @param validator A function to validate the user's input. It should return the validated input.
 * @returns A promise that resolves with the validated answer.
 */
async function askQuestion(
  question: string,
  defaultValue: string,
  validator: (input: string) => string
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

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
 * Asks a yes/no question to the user.
 * @param question The yes/no question to ask.
 * @param defaultValue The default boolean value if the user enters nothing.
 * @returns A promise that resolves to `true` for yes, `false` for no.
 */
async function askYesNo(question: string, defaultValue: boolean): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const defaultStr = defaultValue ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`${question} (${defaultStr})? `, (answer) => {
      rl.close();
      const input = answer.trim().toLowerCase();
      if (input === 'y' || input === 'yes') resolve(true);
      else if (input === 'n' || input === 'no') resolve(false);
      else resolve(defaultValue);
    });
  });
}

/**
 * Validates the target TypeScript version input.
 * If invalid, logs a warning and returns the default '6.0'.
 * @param input The user's input for target version.
 * @returns The validated target version string.
 */
function validateTargetVersion(input: string): string {
  if (VALID_TARGET_VERSIONS.includes(input as TargetTsVersion)) return input;
  console.log(`⚠️  Invalid version. Using default: 6.0. Valid options: ${VALID_TARGET_VERSIONS.join(', ')}`);
  return '6.0';
}

/**
 * Validates the log level input.
 * If invalid, logs a warning and returns the default 'info'.
 * @param input The user's input for log level.
 * @returns The validated log level string.
 */
function validateLogLevel(input: string): string {
  if (VALID_LOG_LEVELS.includes(input as LogLevel)) return input;
  console.log(`⚠️  Invalid level. Using default: info. Valid options: ${VALID_LOG_LEVELS.join(', ')}`);
  return 'info';
}

/**
 * Validates the data directory path.
 * Returns the input trimmed, or the default data directory if input is empty.
 * @param input The user's input for data directory.
 * @returns The validated data directory path.
 */
function validateDataDir(input: string): string {
  return input.trim() || getDefaultDataDir();
}

/**
 * Validates the files/directories input. Currently performs no specific validation.
 * @param input The user's input for files/directories.
 * @returns The input string as is.
 */
function validateFiles(input: string): string {
  return input;
}
