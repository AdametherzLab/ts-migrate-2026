import { describe, it, expect, mock, afterEach } from 'bun:test';
import { runCli } from '../src/cli';
import * as fs from 'fs';
import * as path from 'path';
import { Migrator } from '../src/migrator';

mock.module('../src/migrator', () => ({
  Migrator: class {
    scan() {
      return { issues: [], filesScanned: 0, timestamp: '2024-01-01' };
    }
    applyCodemods() {
      return [];
    }
  }
}));

describe('Interactive CLI Migration', () => {
  const testDir = path.join(process.cwd(), 'test-project');
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should prompt for each change in interactive mode', async () => {
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    
    const mockActions = [{
      filePath: 'test.ts',
      description: 'Update deprecated API',
      oldContent: 'const x: any = {};',
      newContent: 'const x: Record<string, unknown> = {};'
    }];

    mock.module('../src/migrator', () => ({
      Migrator: class {
        scan() {
          return { issues: [{ code: 'TS1234', message: 'Deprecated API', filePath: 'test.ts', line: 1, column: 1, severity: 'warning' }], filesScanned: 1, timestamp: '2024-01-01' };
        }
        applyCodemods() {
          return mockActions;
        }
      }
    }));

    const mockAsk = mock(async () => true);
    mock.module('../src/cli', () => ({
      askYesNo: mockAsk,
    }));

    const exitCode = await runCli(['node', 'script.ts', '--interactive']);
    expect(exitCode).toBe(0);
    expect(mockAsk).toHaveBeenCalledTimes(1);
  });

  it('should apply all changes without prompt in non-interactive mode', async () => {
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    const mockActions = [{
      filePath: 'test.ts',
      description: 'Update deprecated API',
      oldContent: 'const x: any = {};',
      newContent: 'const x: Record<string, unknown> = {};'
    }];

    mock.module('../src/migrator', () => ({
      Migrator: class {
        scan() {
          return { issues: [{ code: 'TS1234', message: 'Deprecated API', filePath: 'test.ts', line: 1, column: 1, severity: 'warning' }], filesScanned: 1, timestamp: '2024-01-01' };
        }
        applyCodemods() {
          return mockActions;
        }
      }
    }));

    const mockAsk = mock(async () => true);
    mock.module('../src/cli', () => ({
      askYesNo: mockAsk,
    }));

    const exitCode = await runCli(['node', 'script.ts', '--apply']);
    expect(exitCode).toBe(0);
    expect(mockAsk).toHaveBeenCalledTimes(0);
  });

  it('should skip change when user rejects in interactive mode', async () => {
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    const mockActions = [{
      filePath: 'test.ts',
      description: 'Update deprecated API',
      oldContent: 'const x: any = {};',
      newContent: 'const x: Record<string, unknown> = {};'
    }];

    mock.module('../src/migrator', () => ({
      Migrator: class {
        scan() {
          return { issues: [{ code: 'TS1234', message: 'Deprecated API', filePath: 'test.ts', line: 1, column: 1, severity: 'warning' }], filesScanned: 1, timestamp: '2024-01-01' };
        }
        applyCodemods() {
          return mockActions;
        }
      }
    }));

    const mockAsk = mock(async () => false);
    mock.module('../src/cli', () => ({
      askYesNo: mockAsk,
    }));

    const exitCode = await runCli(['node', 'script.ts', '--interactive']);
    expect(exitCode).toBe(0);
    expect(mockAsk).toHaveBeenCalledTimes(1);
  });

  it('should run guided migration with --guided flag', async () => {
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    const mockActions = [{
      filePath: 'test.ts',
      description: 'Update deprecated API',
      oldContent: 'const x: any = {};',
      newContent: 'const x: Record<string, unknown> = {};'
    }];

    let scanCalled = false;
    let applyCalled = false;

    mock.module('../src/migrator', () => ({
      Migrator: class {
        scan() {
          scanCalled = true;
          return { 
            issues: [{
              code: 'TS1234',
              message: 'Deprecated API',
              filePath: 'test.ts',
              line: 1,
              column: 1,
              severity: 'warning'
            }],
            filesScanned: 1,
            timestamp: '2024-01-01'
          };
        }
        applyCodemods() {
          applyCalled = true;
          return mockActions;
        }
      }
    }));

    // Mock the guided flow functions
    const mockAskYesNo = mock()
      .mockResolvedValueOnce(true)   // Proceed with scanning
      .mockResolvedValueOnce(false)  // Don't show details
      .mockResolvedValueOnce(true)   // Generate fixes
      .mockResolvedValueOnce(true);  // Apply change

    const mockAskMultipleChoice = mock()
      .mockResolvedValueOnce('summary')  // Review choice
      .mockResolvedValueOnce('review');  // Strategy choice

    mock.module('../src/cli', () => ({
      askYesNo: mockAskYesNo,
      askMultipleChoice: mockAskMultipleChoice,
    }));

    const exitCode = await runCli(['node', 'script.ts', '--guided', '--dry-run']);
    expect(exitCode).toBe(0);
    expect(scanCalled).toBe(true);
    expect(applyCalled).toBe(true);
    expect(mockAskYesNo).toHaveBeenCalledTimes(4);
    expect(mockAskMultipleChoice).toHaveBeenCalledTimes(2);
  });

  it('should cancel guided migration if user declines scanning', async () => {
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    const mockAskYesNo = mock(async () => false);
    mock.module('../src/cli', () => ({
      askYesNo: mockAskYesNo,
      askMultipleChoice: mock(async () => 'summary'),
    }));

    const exitCode = await runCli(['node', 'script.ts', '--guided']);
    expect(exitCode).toBe(0);
    expect(mockAskYesNo).toHaveBeenCalledTimes(1);
  });

  it('should generate patch file in guided mode when patch strategy selected', async () => {
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    const mockActions = [{
      filePath: 'test.ts',
      description: 'Update deprecated API',
      oldContent: 'const x: any = {};',
      newContent: 'const x: Record<string, unknown> = {};'
    }];

    mock.module('../src/migrator', () => ({
      Migrator: class {
        scan() {
          return { 
            issues: [{
              code: 'TS1234',
              message: 'Deprecated API',
              filePath: 'test.ts',
              line: 1,
              column: 1,
              severity: 'warning'
            }],
            filesScanned: 1,
            timestamp: '2024-01-01'
          };
        }
        applyCodemods() {
          return mockActions;
        }
      }
    }));

    const mockAskYesNo = mock()
      .mockResolvedValueOnce(true);  // Proceed with scanning

    const mockAskMultipleChoice = mock()
      .mockResolvedValueOnce('summary')  // Review choice
      .mockResolvedValueOnce('patch');   // Strategy choice

    mock.module('../src/cli', () => ({
      askYesNo: mockAskYesNo,
      askMultipleChoice: mockAskMultipleChoice,
    }));

    const exitCode = await runCli(['node', 'script.ts', '--guided']);
    expect(exitCode).toBe(0);
    
    const patchPath = path.join(testDir, 'ts-migrate.patch');
    expect(fs.existsSync(patchPath)).toBe(true);
    
    const patchContent = fs.readFileSync(patchPath, 'utf-8');
    expect(patchContent).toContain('--- a/test.ts');
    expect(patchContent).toContain('+++ b/test.ts');
    
    fs.unlinkSync(patchPath);
  });
});
