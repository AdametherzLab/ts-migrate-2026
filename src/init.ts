import * as fs from 'fs';
import * as path from 'path';
import { Config, LogLevel, TargetTsVersion, getDefaultDataDir } from './types';
import { askYesNo, askText, askMultipleChoice } from './prompts';

const VALID_TARGET_VERSIONS: TargetTsVersion[] = ['5.0', '5.1', '5.2', '5.3', '5.4', '5.5', '6.0', '7.0'];
const VALID_LOG_LEVELS: LogLevel[] = ['info', 'warn', 'error', 'debug'];

/**
 * Guides the user through creating a migration configuration file interactively.
 * The generated config file `ts-migrate.json` will be saved in the current working directory.
 */
export async function handleInit(): Promise<void> {
  console.log('\n🚀 Welcome to ts-migrate-2026 Setup Wizard 🚀');
  console.log('This interactive guide will help you create a migration configuration.');
  console.log('Press Enter to accept default values shown in brackets.');

  // ─── Project Settings ─────────────────────────────────────
  console.log('\n🛠️  Project Settings');
  
  const targetVersion = await askMultipleChoice(
    'Select target TypeScript version',
    VALID_TARGET_VERSIONS.map(v => ({
      value: v,
      label: `TypeScript ${v}`,
      description: v === '6.0' ? 'Stable release with new type checking' : 
                   v === '7.0' ? 'Latest features (experimental support)' : 
                   `TypeScript ${v} compatibility`
    })),
    '6.0',
    'Choose the TypeScript version you want to migrate to.\n' +
    '• 6.0: Recommended for most projects\n' +
    '• 7.0: Latest features (check compatibility)\n' +
    '• 5.x: Legacy version support'
  );

  const defaultDataDir = getDefaultDataDir();
  const dataDir = await askText(
    'Storage directory for logs and reports',
    defaultDataDir,
    'Where should we store migration logs, analysis reports, and backup files?\n' +
    `Default: ${defaultDataDir}`
  );

  // ─── Migration Behavior ───────────────────────────────────
  console.log('\n⚙️  Migration Behavior');
  
  const dryRun = await askYesNo(
    'Enable safe mode (dry run) to preview changes without modifying files?',
    true,
    '\x1b[33mSafe mode is recommended for first runs.\x1b[0m\n' +
    '• Yes: Preview changes only (no file modifications)\n' +
    '• No: Apply changes immediately'
  );

  const logLevel = await askMultipleChoice(
    'Select log verbosity level',
    [
      { value: 'info', label: 'Info', description: 'Progress updates and important messages' },
      { value: 'warn', label: 'Warnings', description: 'Only warnings and errors' },
      { value: 'error', label: 'Errors', description: 'Only error messages' },
      { value: 'debug', label: 'Debug', description: 'Full technical details for troubleshooting' }
    ],
    'info',
    'Control the detail level of migration logs:\n' +
    '• Info: Recommended for most users\n' +
    '• Debug: Useful for troubleshooting complex issues'
  );

  // ─── File Selection ───────────────────────────────────────
  console.log('\n📁 File Selection');
  
  const filesInput = await askText(
    'Specific files/directories to process (comma-separated globs, leave empty for all)',
    '',
    'Examples:\n' +
    '• src/**/*.ts  - All TypeScript files in src directory\n' +
    '• test, lib    - Specific directories\n' +
    '• *.ts         - All TypeScript files in current directory\n' +
    'Leave empty to scan entire project.'
  );
  
  const files = filesInput.split(',').map(s => s.trim()).filter(Boolean);

  // ─── Advanced Options ─────────────────────────────────────
  console.log('\n🔧 Advanced Options');
  
  const interactive = await askYesNo(
    'Enable interactive mode (prompt for each change)?',
    false,
    'Interactive mode lets you review and approve each change individually.\n' +
    '• Yes: Review every modification\n' +
    '• No: Apply changes automatically (recommended for bulk migrations)'
  );

  // ─── Config Summary ───────────────────────────────────────
  const config: Config = {
    targetTsVersion: targetVersion as TargetTsVersion,
    dataDir: dataDir.trim() || defaultDataDir,
    dryRun,
    logLevel: logLevel as LogLevel,
    files: files.length > 0 ? files : undefined,
    interactive
  };

  console.log('\n✅ \x1b[1mConfiguration Summary:\x1b[0m');
  console.log(`│ Target Version: \x1b[36m${config.targetTsVersion}\x1b[0m`);
  console.log(`│ Data Directory: \x1b[36m${config.dataDir}\x1b[0m`);
  console.log(`│ Safe Mode:      \x1b[36m${config.dryRun ? 'Enabled (dry run)' : 'Disabled (apply changes)'}\x1b[0m`);
  console.log(`│ Log Level:      \x1b[36m${config.logLevel}\x1b[0m`);
  console.log(`│ Interactive:    \x1b[36m${config.interactive ? 'Yes' : 'No'}\x1b[0m`);
  console.log(`│ Files:          \x1b[36m${config.files?.join(', ') || 'All project files'}\x1b[0m`);

  const confirm = await askYesNo('\nCreate configuration file with these settings?', true);
  if (!confirm) {
    console.log('\n\x1b[33mConfiguration cancelled. No files were created.\x1b[0m');
    return;
  }

  const configPath = path.join(process.cwd(), 'ts-migrate.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n🎉 \x1b[32mConfiguration saved to ${path.relative(process.cwd(), configPath)}\x1b[0m`);
  console.log('\nNext steps:');
  console.log('1. Review the configuration file if needed');
  console.log('2. Run \x1b[1mts-migrate-2026 --dry-run\x1b[0m to preview changes');
  console.log('3. Run \x1b[1mts-migrate-2026 --apply\x1b[0m to apply changes');
  console.log('4. Run \x1b[1mts-migrate-2026 --guided\x1b[0m for interactive wizard');
}
