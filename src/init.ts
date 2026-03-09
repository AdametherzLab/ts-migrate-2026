import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Config, LogLevel, TargetTsVersion, getDefaultDataDir } from './types';

/**
 * Guides the user through creating a migration configuration file interactively.
 * The generated config file `ts-migrate.json` will be saved in the current working directory.
 */
export async function handleInit(): Promise<void> {
  console.log('\n--- ts-migrate-2026 Configuration Setup ---');
  console.log('This will guide you through creating a `ts-migrate.json` file.');
  console.log('Press Enter to accept the default value shown in brackets.');

  const targetVersion = await askQuestion(
    'Target TypeScript version (e.g., 6.0, 7.0) [default: 6.0]: ',
    '6.0',
    validateTargetVersion
  );

  const defaultDataDir = getDefaultDataDir();
  const dataDir = await askQuestion(
    `Data directory (for logs, reports, etc.) [default: ${defaultDataDir}]: `,
    defaultDataDir,
    validateDataDir
  );

  const dryRun = await askYesNo('Enable dry run (simulate changes without applying them)?', true);

  const logLevel = await askQuestion(
    'Log level (info, warn, error, debug) [default: info]: ',
    'info',
    validateLogLevel
  );

  const files = await askQuestion(
    'Enter specific files or directories to process (comma-separated, optional) [default: all project files]: ',
    '',
    validateFiles
  ).then(f => f.split(',').map(s => s.trim()).filter(Boolean));

  const config: Config = {
    targetTsVersion: targetVersion as TargetTsVersion,
    dataDir,
    dryRun,
    logLevel: logLevel as LogLevel,
    files: files.length > 0 ? files : undefined
  };

  const configPath = path.join(process.cwd(), 'ts-migrate.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\nConfiguration file successfully saved to ${configPath}`);
  console.log('You can now run `ts-migrate-2026` to start the migration process.');
}

/**
 * Prompts the user with a question and returns their answer, or a default value.
 * Input is passed through a validator function.
 * @param question The question to ask the user.
 * @param defaultValue The default value to use if the user provides no input.
 * @param validator A function to validate and potentially normalize the user's input.
 * @returns The validated user input or default value.
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
 * Prompts the user with a yes/no question.
 * @param question The yes/no question to ask.
 * @param defaultValue The default boolean value if no input is provided.
 * @returns True for 'yes', false for 'no'.
 */
async function askYesNo(question: string, defaultValue: boolean): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const defaultStr = defaultValue ? 'yes' : 'no';
  return new Promise((resolve) => {
    rl.question(`${question} (yes/no) [default: ${defaultStr}]: `, (answer) => {
      rl.close();
      const input = answer.trim().toLowerCase();
      if (input === 'y' || input === 'yes') {
        resolve(true);
      } else if (input === 'n' || input === 'no') {
        resolve(false);
      } else if (input === '') {
        resolve(defaultValue);
      } else {
        console.log(`  Invalid input. Using default: ${defaultStr}.`);
        resolve(defaultValue);
      }
    });
  });
}

/**
 * Validates the target TypeScript version input.
 * @param input The user's input for target version.
 * @returns A valid target version string, or '6.0' if invalid.
 */
function validateTargetVersion(input: string): string {
  const validVersions: TargetTsVersion[] = ['5.0', '5.1', '5.2', '5.3', '5.4', '5.5', '6.0', '7.0'];
  if (validVersions.includes(input as TargetTsVersion)) {
    return input;
  }
  console.log(`  Invalid target version '${input}'. Supported: ${validVersions.join(', ')}. Defaulting to 6.0.`);
  return '6.0';
}

/**
 * Validates the log level input.
 * @param input The user's input for log level.
 * @returns A valid log level string, or 'info' if invalid.
 */
function validateLogLevel(input: string): string {
  const validLevels: LogLevel[] = ['info', 'warn', 'error', 'debug'];
  if (validLevels.includes(input as LogLevel)) {
    return input;
  }
  console.log(`  Invalid log level '${input}'. Supported: ${validLevels.join(', ')}. Defaulting to info.`);
  return 'info';
}

/**
 * Validates the data directory input. Currently just trims whitespace.
 * @param input The user's input for data directory.
 * @returns The trimmed input, or the default data directory if input is empty.
 */
function validateDataDir(input: string): string {
  return input.trim() || getDefaultDataDir();
}

/**
 * Validates the files/directories input. Currently just returns the input.
 * @param input The user's input for files/directories.
 * @returns The input string.
 */
function validateFiles(input: string): string {
  return input;
}
