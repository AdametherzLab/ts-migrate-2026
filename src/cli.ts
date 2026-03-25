import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import readline from 'readline';
import { createIssue, getDefaultDataDir, MigrationError } from './types';
import type { Config, LogLevel, ScanResult, CodemodAction } from './types';
import { Migrator } from './migrator';
import { handleInit } from './init';

interface ParseResult {
  config: Partial<Config>;
  help: boolean;
}

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
      if (target === '6.0' || target === '7.0') {
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
    } else if (arg === '--interactive') {
      config.interactive = true;
    } else if (arg === '--guided') {
      config.guided = true;
    }
  }

  return { config, help };
}

export function validateConfig(input: Partial<Config> & { config?: Partial<Config> }): Config {
  const config = input.config ? input.config : input;
  return {
    dataDir: config.dataDir || getDefaultDataDir(),
    dryRun: config.dryRun ?? true,
    logLevel: config.logLevel || 'info',
    targetTsVersion: config.targetTsVersion || '6.0',
    files: config.files,
    interactive: config.interactive ?? false,
    guided: config.guided ?? false,
  };
}

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
  --interactive    Prompt to confirm each individual change
  --guided         Step-by-step guided migration with explanations and choices
  --help           Show this help message

Commands:
  init             Generate configuration file interactively`);
}

async function askYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + ' (y/n) ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function askMultipleChoice<T>(
  question: string,
  choices: { label: string; value: T; description?: string }[],
  defaultValue?: T
): Promise<T> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n${question}`);
  choices.forEach((choice, index) => {
    const defaultIndicator = defaultValue === choice.value ? ' (default)' : '';
    console.log(`  ${index + 1}. ${choice.label}${defaultIndicator}`);
    if (choice.description) {
      console.log(`     ${choice.description}`);
    }
  });

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(`\nEnter choice [1-${choices.length}]: `, (answer) => {
        const num = parseInt(answer.trim());
        if (!isNaN(num) && num >= 1 && num <= choices.length) {
          rl.close();
          resolve(choices[num - 1].value);
        } else if (answer.trim() === '' && defaultValue !== undefined) {
          rl.close();
          resolve(defaultValue);
        } else {
          console.log(`Please enter a number between 1 and ${choices.length}.`);
          ask();
        }
      });
    };
    ask();
  });
}

async function runGuidedMigration(config: Config): Promise<number> {
  console.log('\n🚀 Starting Guided Migration 🚀');
  console.log('This interactive guide will walk you through the migration step-by-step.');
  console.log('You can pause or cancel at any time.\n');

  // Step 1: Project analysis
  console.log('📊 Step 1: Project Analysis');
  console.log('First, let\'s scan your project to understand the current state...');
  
  const proceed = await askYesNo('Proceed with scanning?');
  if (!proceed) {
    console.log('\n❌ Migration cancelled.');
    return 0;
  }

  console.log('\nScanning project for migration issues...');
  const migrator = new Migrator(config);
  const scanResult = migrator.scan();

  console.log(`\n✅ Scan complete:`);
  console.log(`   • Files scanned: ${scanResult.filesScanned}`);
  console.log(`   • Issues found: ${scanResult.issues.length}`);

  if (scanResult.issues.length === 0) {
    console.log('\n🎉 No migration issues found! Your project is already compatible.');
    return 0;
  }

  // Step 2: Issue review
  console.log('\n🔍 Step 2: Issue Review');
  console.log(`Found ${scanResult.issues.length} issue(s) that need attention.`);
  
  const reviewChoice = await askMultipleChoice(
    'How would you like to review the issues?',
    [
      {
        label: 'Show summary only',
        value: 'summary',
        description: 'See counts by severity and file type'
      },
      {
        label: 'Show all issues',
        value: 'all',
        description: 'List every issue with details'
      },
      {
        label: 'Show only critical issues',
        value: 'critical',
        description: 'Focus on errors that must be fixed'
      }
    ],
    'summary'
  );

  if (reviewChoice === 'all') {
    console.log('\n📋 All Issues:');
    scanResult.issues.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${issue.filePath}:${issue.line}:${issue.column}`);
      console.log(`   [${issue.code}] ${issue.message}`);
      console.log(`   Severity: ${issue.severity}`);
    });
  } else if (reviewChoice === 'critical') {
    const critical = scanResult.issues.filter(i => i.severity === 'error');
    console.log(`\n⚠️  Critical Issues (${critical.length}):`);
    critical.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${issue.filePath}:${issue.line}:${issue.column}`);
      console.log(`   [${issue.code}] ${issue.message}`);
    });
  } else {
    const errors = scanResult.issues.filter(i => i.severity === 'error').length;
    const warnings = scanResult.issues.filter(i => i.severity === 'warning').length;
    const files = [...new Set(scanResult.issues.map(i => i.filePath))].length;
    console.log(`\n📊 Summary:`);
    console.log(`   • Files affected: ${files}`);
    console.log(`   • Critical issues: ${errors}`);
    console.log(`   • Warnings: ${warnings}`);
  }

  // Step 3: Fix strategy
  console.log('\n🔧 Step 3: Fix Strategy');
  const strategy = await askMultipleChoice(
    'How would you like to apply fixes?',
    [
      {
        label: 'Apply all fixes automatically',
        value: 'auto',
        description: 'Apply all safe fixes without confirmation'
      },
      {
        label: 'Review each fix individually',
        value: 'review',
        description: 'See and approve each change before applying'
      },
      {
        label: 'Generate patch file only',
        value: 'patch',
        description: 'Create a .patch file for manual review'
      }
    ],
    'review'
  );

  console.log('\n🔄 Generating fixes...');
  const actions = migrator.applyCodemods(scanResult.issues);

  if (actions.length === 0) {
    console.log('\nℹ️  No automatic fixes available for the detected issues.');
    console.log('You may need to fix them manually.');
    return 0;
  }

  console.log(`\n✅ Generated ${actions.length} fix(es).`);

  if (strategy === 'patch') {
    const patchPath = path.join(process.cwd(), 'ts-migrate.patch');
    const patchContent = actions.map(action => 
      `--- a/${action.filePath}\n+++ b/${action.filePath}\n@@ -1 +1 @@\n-${action.oldContent}\n+${action.newContent}`
    ).join('\n\n');
    
    fs.writeFileSync(patchPath, patchContent);
    console.log(`\n📄 Patch file saved to: ${patchPath}`);
    console.log('Apply it with: git apply ts-migrate.patch');
    return 0;
  }

  // Step 4: Apply fixes
  console.log('\n⚡ Step 4: Apply Fixes');
  
  let applied = 0;
  let skipped = 0;
  
  for (const action of actions) {
    console.log(`\n📝 ${action.description}`);
    console.log(`   File: ${action.filePath}`);
    
    if (strategy === 'review') {
      console.log('\n--- Before ---');
      console.log(action.oldContent);
      console.log('\n--- After ---');
      console.log(action.newContent);
      console.log('---');
      
      const apply = await askYesNo('Apply this change?');
      if (!apply) {
        console.log('⏭️  Skipped');
        skipped++;
        continue;
      }
    }
    
    if (!config.dryRun) {
      fs.writeFileSync(action.filePath, action.newContent, 'utf-8');
      console.log('✅ Applied');
      applied++;
    } else {
      console.log('✅ Would apply (dry-run mode)');
      applied++;
    }
  }

  // Step 5: Summary
  console.log('\n📋 Step 5: Summary');
  console.log(`\nMigration completed:`);
  console.log(`   • Fixes applied: ${applied}`);
  console.log(`   • Fixes skipped: ${skipped}`);
  console.log(`   • Dry run: ${config.dryRun ? 'Yes' : 'No'}`);
  
  if (config.dryRun) {
    console.log('\n💡 To apply these changes, run with --apply flag');
  }
  
  console.log('\n🎉 Guided migration complete!');
  return 0;
}

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

  const mergedConfig = { ...fileConfig, ...args };
  const config = validateConfig(mergedConfig);
  
  if (config.guided) {
    return await runGuidedMigration(config);
  }

  // Original non-guided flow
  const dataDir = config.dataDir;

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log(`Using data directory: ${dataDir}`);
    console.log(`Target TypeScript version: ${config.targetTsVersion}`);
    console.log(`Dry run: ${config.dryRun ? 'Enabled' : 'Disabled (applying changes)'}`);
    console.log(`Interactive mode: ${config.interactive ? 'Enabled' : 'Disabled'}`);
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
          console.log(`\n--- Diff for ${action.filePath} (${action.description}) ---`);
          console.log(action.oldContent);
          console.log('--------------------------------------------------');
          console.log(action.newContent);
          console.log('--------------------------------------------------');

          let shouldApply = !config.dryRun;
          if (config.interactive) {
            shouldApply = await askYesNo(`Apply changes to ${action.filePath}?`);
          }

          if (shouldApply && !config.dryRun) {
            fs.writeFileSync(action.filePath, action.newContent, 'utf-8');
            console.log(`✅ Applied changes to ${action.filePath}`);
          } else {
            console.log(`⏩ Skipped changes to ${action.filePath}`);
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
      console.error(`\nMigration failed: ${err.message}`);
      if (err.cause) {
        console.error(`Caused by: ${err.cause instanceof Error ? err.cause.message : String(err.cause)}`);
      }
    } else if (err instanceof Error) {
      console.error(`\nAn unexpected error occurred: ${err.message}`);
      console.error(err.stack);
    } else {
      console.error(`\nAn unknown error occurred: ${String(err)}`);
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
