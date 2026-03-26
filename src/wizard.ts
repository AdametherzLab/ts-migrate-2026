import * as fs from 'fs';
import * as path from 'path';
import type { Config, ScanResult, CodemodAction } from './types';
import { Migrator } from './migrator';
import { askYesNo, askMultipleChoice, askText } from './prompts';
import { generateDiff } from './utils';

/**
 * Represents a step in the migration wizard process.
 */
export interface WizardStep {
  name: string;
  description: string;
  execute(): Promise<boolean>;
}

/**
 * Interactive Migration Wizard that guides users through the TypeScript migration
 * process step-by-step with clear prompts and explanations.
 */
export class MigrationWizard {
  private config: Config;
  private scanResult?: ScanResult;
  private actions: CodemodAction[] = [];
  private projectRoot: string;

  constructor(config: Config) {
    this.config = config;
    this.projectRoot = process.cwd();
  }

  /**
   * Runs the complete wizard flow from start to finish.
   * @returns Exit code (0 for success, 1 for error)
   */
  async run(): Promise<number> {
    console.log('\n🧙 Welcome to the TypeScript Migration Wizard\n');
    console.log('This tool will guide you through upgrading your TypeScript codebase step-by-step.\n');

    const proceed = await askYesNo(
      'Ready to start the migration scan',
      true,
      'The wizard will scan your codebase for deprecated patterns and breaking changes.'
    );
    
    if (!proceed) {
      console.log('\n👋 Migration cancelled. No changes were made.');
      return 0;
    }

    console.log('\n🔍 Scanning your codebase...');
    try {
      const migrator = new Migrator(this.config);
      this.scanResult = migrator.scan();
      
      console.log(`\n✅ Scan complete! Found ${this.scanResult.issues.length} issues in ${this.scanResult.filesScanned} files.`);
      
      if (this.scanResult.issues.length === 0) {
        console.log('\n🎉 No migration issues found! Your codebase is ready.');
        return 0;
      }
    } catch (error) {
      console.error('\n❌ Scan failed:', error);
      return 1;
    }

    const reviewChoice = await askMultipleChoice(
      'How would you like to review the findings?',
      [
        { value: 'summary', label: 'Summary only', description: 'Show count of issues by severity' },
        { value: 'details', label: 'Detailed list', description: 'Show each issue with file path and line number' },
        { value: 'skip', label: 'Skip review', description: 'Proceed directly to fixing' }
      ],
      'summary'
    );

    if (reviewChoice === 'details') {
      this.showDetailedIssues();
    } else if (reviewChoice === 'summary') {
      this.showSummary();
    }

    const generateFixes = await askYesNo(
      'Generate automated fixes for these issues',
      true,
      'The wizard can automatically fix many common migration issues.'
    );

    if (!generateFixes) {
      console.log('\n👋 No fixes generated. Review the issues manually and run again.');
      return 0;
    }

    try {
      const migrator = new Migrator(this.config);
      this.actions = migrator.applyCodemods(this.scanResult.issues);
      console.log(`\n✨ Generated ${this.actions.length} automated fixes.`);
    } catch (error) {
      console.error('\n❌ Failed to generate fixes:', error);
      return 1;
    }

    if (this.actions.length === 0) {
      console.log('\n⚠️  No automated fixes available for the detected issues.');
      console.log('   You may need to manually address these changes.');
      return 0;
    }

    const strategy = await askMultipleChoice(
      'How would you like to apply these changes?',
      [
        { value: 'review', label: 'Review each change', description: 'Interactive approval for each file' },
        { value: 'apply', label: 'Apply all changes', description: 'Automatically apply all fixes' },
        { value: 'patch', label: 'Generate patch file', description: 'Create a .patch file for manual review' }
      ],
      'review'
    );

    switch (strategy) {
      case 'review':
        return await this.reviewEachChange();
      case 'apply':
        return await this.applyAllChanges();
      case 'patch':
        return await this.generatePatchFile();
      default:
        return 0;
    }
  }

  private showSummary(): void {
    if (!this.scanResult) return;
    
    const errors = this.scanResult.issues.filter(i => i.severity === 'error');
    const warnings = this.scanResult.issues.filter(i => i.severity === 'warning');
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Errors:   ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);
    console.log(`   Total:    ${this.scanResult.issues.length}`);
  }

  private showDetailedIssues(): void {
    if (!this.scanResult) return;
    
    console.log('\n📋 Detailed Issues:');
    this.scanResult.issues.forEach((issue, index) => {
      const icon = issue.severity === 'error' ? '🔴' : '🟡';
      console.log(`\n${icon} Issue #${index + 1} [${issue.code}]`);
      console.log(`   File: ${issue.filePath}:${issue.line}:${issue.column}`);
      console.log(`   ${issue.message}`);
    });
  }

  private async reviewEachChange(): Promise<number> {
    let applied = 0;
    let skipped = 0;

    for (const action of this.actions) {
      console.log(`\n📝 Change in ${action.filePath}:`);
      console.log(`   ${action.description}`);
      
      if (this.config.dryRun) {
        console.log('\n   Diff preview:');
        const diff = generateDiff(action.oldContent, action.newContent);
        console.log(diff.split('\n').slice(0, 10).join('\n'));
        if (diff.split('\n').length > 10) {
          console.log('   ... (truncated)');
        }
      }

      const apply = await askYesNo('Apply this change', true);
      
      if (apply && !this.config.dryRun) {
        try {
          fs.writeFileSync(action.filePath, action.newContent);
          applied++;
          console.log('   ✅ Applied');
        } catch (error) {
          console.error('   ❌ Failed to apply:', error);
        }
      } else if (apply && this.config.dryRun) {
        console.log('   ✅ Would apply (dry run)');
        applied++;
      } else {
        skipped++;
        console.log('   ⏭️  Skipped');
      }
    }

    console.log(`\n✅ Migration complete! Applied: ${applied}, Skipped: ${skipped}`);
    return 0;
  }

  private async applyAllChanges(): Promise<number> {
    if (this.config.dryRun) {
      console.log('\n🔍 Dry run mode - no files modified. Would apply:');
      this.actions.forEach(action => {
        console.log(`   - ${action.filePath}: ${action.description}`);
      });
      return 0;
    }

    const confirm = await askYesNo(
      `Apply all ${this.actions.length} changes to your codebase`,
      false,
      'This will modify your files. Make sure you have backups or version control.'
    );

    if (!confirm) {
      console.log('\n👋 Changes not applied.');
      return 0;
    }

    let applied = 0;
    for (const action of this.actions) {
      try {
        fs.writeFileSync(action.filePath, action.newContent);
        applied++;
      } catch (error) {
        console.error(`❌ Failed to apply change to ${action.filePath}:`, error);
      }
    }

    console.log(`\n✅ Applied ${applied}/${this.actions.length} changes successfully.`);
    return 0;
  }

  private async generatePatchFile(): Promise<number> {
    const defaultName = `ts-migrate-${new Date().toISOString().split('T')[0]}.patch`;
    const fileName = await askText(
      'Patch file name',
      defaultName,
      'The patch file will be saved in your current directory.'
    );

    const patchPath = path.join(this.projectRoot, fileName);
    
    try {
      let patchContent = '';
      
      for (const action of this.actions) {
        const diff = generateDiff(action.oldContent, action.newContent);
        patchContent += `--- a/${action.filePath}\n`;
        patchContent += `+++ b/${action.filePath}\n`;
        patchContent += diff + '\n\n';
      }

      fs.writeFileSync(patchPath, patchContent);
      console.log(`\n✅ Patch file created: ${patchPath}`);
      console.log('   Apply with: git apply ' + fileName);
      return 0;
    } catch (error) {
      console.error('\n❌ Failed to create patch file:', error);
      return 1;
    }
  }
}

/**
 * Runs the guided migration wizard with the provided configuration.
 * @param config - Migration configuration
 * @returns Exit code (0 for success, 1 for error)
 */
export async function runGuidedMigration(config: Config): Promise<number> {
  const wizard = new MigrationWizard(config);
  return wizard.run();
}
