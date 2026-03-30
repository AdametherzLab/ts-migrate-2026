import { describe, it, expect, mock, afterEach, beforeEach } from 'bun:test';
import { handleInit } from '../src/init';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getDefaultDataDir } from '../src/types';

// Mock the prompts module
const mockAskYesNo = mock();
const mockAskText = mock();
const mockAskMultipleChoice = mock();

mock.module('../src/prompts', () => ({
  askYesNo: mockAskYesNo,
  askText: mockAskText,
  askMultipleChoice: mockAskMultipleChoice,
}));

describe('Interactive CLI Config Generation', () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-migrate-init-test-'));
  const originalCwd = process.cwd();
  const configFileName = 'ts-migrate.json';
  let configPath: string;

  beforeEach(() => {
    process.chdir(testDir);
    configPath = path.join(testDir, configFileName);
    mockAskYesNo.mockClear();
    mockAskText.mockClear();
    mockAskMultipleChoice.mockClear();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should create config with defaults on empty inputs', async () => {
    mockAskMultipleChoice
      .mockResolvedValueOnce('6.0') // Target version
      .mockResolvedValueOnce('info'); // Log level
    
    mockAskText
      .mockResolvedValueOnce('') // Data directory
      .mockResolvedValueOnce(''); // Files
    
    mockAskYesNo
      .mockResolvedValueOnce(true) // Dry run
      .mockResolvedValueOnce(false) // Interactive
      .mockResolvedValueOnce(true); // Confirm save

    await handleInit();

    expect(fs.existsSync(configPath)).toBeTrue();
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config).toEqual({
      targetTsVersion: '6.0',
      dataDir: getDefaultDataDir(),
      dryRun: true,
      logLevel: 'info',
      interactive: false,
    });
  });

  it('should handle custom valid inputs', async () => {
    mockAskMultipleChoice
      .mockResolvedValueOnce('7.0') // Target version
      .mockResolvedValueOnce('debug'); // Log level
    
    mockAskText
      .mockResolvedValueOnce('/custom/data') // Data directory
      .mockResolvedValueOnce('src/**/*.ts, tests/**/*.ts'); // Files
    
    mockAskYesNo
      .mockResolvedValueOnce(false) // Dry run
      .mockResolvedValueOnce(true) // Interactive
      .mockResolvedValueOnce(true); // Confirm save

    await handleInit();

    expect(fs.existsSync(configPath)).toBeTrue();
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config).toEqual({
      targetTsVersion: '7.0',
      dataDir: '/custom/data',
      dryRun: false,
      logLevel: 'debug',
      files: ['src/**/*.ts', 'tests/**/*.ts'],
      interactive: true,
    });
  });

  it('should handle multiple choice selection by number', async () => {
    mockAskMultipleChoice
      .mockResolvedValueOnce('5.4') // Target version (selected by number)
      .mockResolvedValueOnce('warn'); // Log level
    
    mockAskText
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('');
    
    mockAskYesNo
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await handleInit();

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.targetTsVersion).toBe('5.4');
    expect(config.logLevel).toBe('warn');
  });

  it('should cancel configuration when user rejects summary', async () => {
    mockAskMultipleChoice
      .mockResolvedValueOnce('6.0')
      .mockResolvedValueOnce('info');
    
    mockAskText
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('');
    
    mockAskYesNo
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false); // Reject save

    await handleInit();

    expect(fs.existsSync(configPath)).toBeFalse();
  });

  it('should handle special path characters in data directory', async () => {
    const customDataPath = path.join(os.homedir(), 'custom-ts-data');
    
    mockAskMultipleChoice
      .mockResolvedValueOnce('5.5')
      .mockResolvedValueOnce('info');
    
    mockAskText
      .mockResolvedValueOnce(customDataPath)
      .mockResolvedValueOnce('');
    
    mockAskYesNo
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await handleInit();

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.dataDir).toBe(customDataPath);
  });

  it('should handle no files specified (undefined files property)', async () => {
    mockAskMultipleChoice
      .mockResolvedValueOnce('6.0')
      .mockResolvedValueOnce('info');
    
    mockAskText
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce(''); // No files input
    
    mockAskYesNo
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await handleInit();

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.files).toBeUndefined();
  });
});
