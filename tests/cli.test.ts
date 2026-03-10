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
          return { issues: [{ code: 'TS1234', message: 'Deprecated API' }], filesScanned: 1, timestamp: '2024-01-01' };
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
          return { issues: [{ code: 'TS1234', message: 'Deprecated API' }], filesScanned: 1, timestamp: '2024-01-01' };
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
          return { issues: [{ code: 'TS1234', message: 'Deprecated API' }], filesScanned: 1, timestamp: '2024-01-01' };
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
});
