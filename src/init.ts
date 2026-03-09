import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Config, LogLevel, TargetTsVersion, getDefaultDataDir } from './types';

export async function handleInit(): Promise<void> {
  const targetVersion = await askQuestion(
    'Target TypeScript version (6.0/7.0) [default: 6.0]: ',
    '6.0',
    validateTargetVersion
  );

  const defaultDataDir = getDefaultDataDir();
  const dataDir = await askQuestion(
    `Data directory [default: ${defaultDataDir}]: `,
    defaultDataDir,
    validateDataDir
  );

  const dryRun = await askYesNo('Enable dry run? [default: yes]: ', true);

  const logLevel = await askQuestion(
    'Log level (info, warn, error, debug) [default: info]: ',
    'info',
    validateLogLevel
  );

  const files = await askQuestion(
    'Enter files/directories to process (comma-separated, optional): ',
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
  console.log(`Configuration file saved to ${configPath}`);
}

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
      const input = answer.trim() || defaultValue;
      const validated = validator(input);
      resolve(validated);
    });
  });
}

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
        console.log(`Invalid input. Using default ${defaultStr}.`);
        resolve(defaultValue);
      }
    });
  });
}

function validateTargetVersion(input: string): string {
  if (input === '6.0' || input === '7.0') {
    return input;
  }
  console.log('Invalid target version. Defaulting to 6.0.');
  return '6.0';
}

function validateLogLevel(input: string): string {
  const validLevels: LogLevel[] = ['info', 'warn', 'error', 'debug'];
  if (validLevels.includes(input as LogLevel)) {
    return input;
  }
  console.log('Invalid log level. Defaulting to info.');
  return 'info';
}

function validateDataDir(input: string): string {
  return input.trim() || getDefaultDataDir();
}

function validateFiles(input: string): string {
  return input;
}
