import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { MigrationWizard, runGuidedMigration } from '../src/wizard';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Config } from '../src/types';

const mockAskYesNo = mock();
const mockAskMultipleChoice = mock();
const mockAskText = mock();

mock.module('../src/prompts', () => ({
  askYesNo: mockAskYesNo,
  askMultipleChoice: mockAskMultipleChoice,
  askText: mockAskText,
}));

mock.module('../src/migrator', () => ({
  Migrator: class {
    scan() {
      return {
        issues: [
          { code: 'TS6001', message: 'baseUrl is deprecated', filePath: 'tsconfig.json', line: 1, column: 1, severity: 'warning' },
          { code: 'TS6002', message: 'ES5 target is deprecated', filePath: 'tsconfig.json', line: 2, column: 1, severity: 'warning' }
        ],
        filesScanned: 5,
        timestamp: new Date().toISOString()
      };
    }
    
    applyCodemods(issues: any[]) {
      return [
        {
          filePath: 'tsconfig.json',
          description: 'Remove baseUrl and update target',
          oldContent: '{"compilerOptions": {"target": "ES5", "baseUrl": "./src"}}',
          newContent: '{"compilerOptions": {"target": "ES2020"}}'
        }
      ];
    }
  }
}));

describe('MigrationWizard', () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-test-'));
  const originalCwd = process.cwd();
  
  beforeEach(() => {
    process.chdir(testDir);
    mockAskYesNo.mockClear();
    mockAskMultipleChoice.mockClear();
    mockAskText.mockClear();
  });
  
  afterEach(() => {
    process.chdir(originalCwd);
    const files = fs.readdirSync(testDir);
    for (const file of files) {
      fs.rmSync(path.join(testDir, file), { recursive: true, force: true });
    }
  });

  it('should complete full wizard flow with review strategy', async () => {
    const config: Config = {
      targetTsVersion: '6.0',
      dataDir: testDir,
      dryRun: false,
      logLevel: 'info'
    };

    mockAskYesNo
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    mockAskMultipleChoice
      .mockResolvedValueOnce('details')
      .mockResolvedValueOnce('review');

    const wizard = new MigrationWizard(config);
    const result = await wizard.run();
    
    expect(result).toBe(0);
    expect(mockAskYesNo).toHaveBeenCalledTimes(3);
    expect(mockAskMultipleChoice).toHaveBeenCalledTimes(2);
  });

  it('should handle cancellation at start', async () => {
    const config: Config = {
      targetTsVersion: '6.0',
      dataDir: testDir,
      dryRun: false,
      logLevel: 'info'
    };

    mockAskYesNo.mockResolvedValueOnce(false);

    const wizard = new MigrationWizard(config);
    const result = await wizard.run();
    
    expect(result).toBe(0);
    expect(mockAskYesNo).toHaveBeenCalledTimes(1);
  });

  it('should generate patch file when patch strategy selected', async () => {
    const config: Config = {
      targetTsVersion: '6.0',
      dataDir: testDir,
      dryRun: false,
      logLevel: 'info'
    };

    mockAskYesNo
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    mockAskMultipleChoice
      .mockResolvedValueOnce('summary')
      .mockResolvedValueOnce('patch');

    mockAskText.mockResolvedValueOnce('test-migration.patch');

    const wizard = new MigrationWizard(config);
    const result = await wizard.run();
    
    expect(result).toBe(0);
    expect(fs.existsSync(path.join(testDir, 'test-migration.patch'))).toBe(true);
    
    const content = fs.readFileSync(path.join(testDir, 'test-migration.patch'), 'utf-8');
    expect(content).toContain('--- a/tsconfig.json');
    expect(content).toContain('+++ b/tsconfig.json');
  });

  it('should handle apply all strategy', async () => {
    const config: Config = {
      targetTsVersion: '6.0',
      dataDir: testDir,
      dryRun: false,
      logLevel: 'info'
    };

    mockAskYesNo
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    mockAskMultipleChoice
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('apply');

    const wizard = new MigrationWizard(config);
    const result = await wizard.run();
    
    expect(result).toBe(0);
    expect(mockAskYesNo).toHaveBeenCalledTimes(3);
  });

  it('should handle empty scan results gracefully', async () => {
    mock.module('../src/migrator', () => ({
      Migrator: class {
        scan() {
          return {
            issues: [],
            filesScanned: 5,
            timestamp: new Date().toISOString()
          };
        }
      }
    }));

    const config: Config = {
      targetTsVersion: '6.0',
      dataDir: testDir,
      dryRun: false,
      logLevel: 'info'
    };

    mockAskYesNo.mockResolvedValueOnce(true);

    const wizard = new MigrationWizard(config);
    const result = await wizard.run();
    
    expect(result).toBe(0);
  });

  it('should run via runGuidedMigration helper', async () => {
    const config: Config = {
      targetTsVersion: '6.0',
      dataDir: testDir,
      dryRun: true,
      logLevel: 'info'
    };

    mockAskYesNo
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    mockAskMultipleChoice.mockResolvedValueOnce('summary');

    const result = await runGuidedMigration(config);
    expect(result).toBe(0);
  });
});
