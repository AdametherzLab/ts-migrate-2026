import { describe, it, expect, mock } from 'bun:test';
import { handleInit } from '../src/init';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { getDefaultDataDir } from '../src/types';

const mockReadline = (inputs: string[]) => {
  let index = 0;
  const originalCreateInterface = readline.createInterface;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  // Mock console.log and console.warn to prevent output during tests
  console.log = mock(() => {});
  console.warn = mock(() => {});
  
  // @ts-ignore - Mocking readline
  readline.createInterface = () => ({
    question: (prompt: string, callback: (answer: string) => void) => {
      // console.log(`Mocked question: ${prompt}`); // For debugging mock inputs
      callback(inputs[index++]);
    },
    close: () => {},
  });

  return () => {
    readline.createInterface = originalCreateInterface;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  };
};

describe('Interactive CLI Config Generation', () => {
  const configFileName = 'ts-migrate.json';
  const configPath = path.join(process.cwd(), configFileName);

  // Clean up config file after each test if it exists
  afterEach(() => {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  });

  it('should create config with default values when user provides no input', async () => {
    const restore = mockReadline(['', '', '', '', '']); // All empty inputs
    
    await handleInit();
    
    expect(fs.existsSync(configPath)).toBeTrue();
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config).toEqual({
      targetTsVersion: '6.0',
      dataDir: getDefaultDataDir(),
      dryRun: true,
      logLevel: 'info',
    });
    
    restore();
  });

  it('should create config with custom values when user provides input', async () => {
    const restore = mockReadline(['7.0', '/custom/path', 'no', 'debug', 'src,test']);
    
    await handleInit();
    
    expect(fs.existsSync(configPath)).toBeTrue();
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config).toEqual({
      targetTsVersion: '7.0',
      dataDir: '/custom/path',
      dryRun: false,
      logLevel: 'debug',
      files: ['src', 'test']
    });
    
    restore();
  });

  it('should handle invalid inputs and use defaults or corrected values', async () => {
    // Inputs: invalid target, empty dataDir (uses default), invalid dryRun (uses default), invalid logLevel (uses default), empty files
    const restore = mockReadline(['invalid-version', '', 'maybe', 'verbose', '']);
    
    await handleInit();
    
    expect(fs.existsSync(configPath)).toBeTrue();
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // Expect defaults for invalid inputs
    expect(config.targetTsVersion).toBe('6.0'); // Invalid 'invalid-version' defaults to '6.0'
    expect(config.dataDir).toBe(getDefaultDataDir()); // Empty input defaults to getDefaultDataDir()
    expect(config.dryRun).toBe(true); // Invalid 'maybe' defaults to true
    expect(config.logLevel).toBe('info'); // Invalid 'verbose' defaults to 'info'
    expect(config.files).toBeUndefined(); // Empty input for files
    
    restore();
  });

  it('should correctly handle different dry run inputs', async () => {
    // Test 'yes'
    let restore = mockReadline(['', '', 'yes', '', '']);
    await handleInit();
    let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.dryRun).toBe(true);
    fs.unlinkSync(configPath);
    restore();

    // Test 'no'
    restore = mockReadline(['', '', 'no', '', '']);
    await handleInit();
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.dryRun).toBe(false);
    fs.unlinkSync(configPath);
    restore();

    // Test empty input (default true)
    restore = mockReadline(['', '', '', '', '']);
    await handleInit();
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.dryRun).toBe(true);
    fs.unlinkSync(configPath);
    restore();

    // Test invalid input (default true)
    restore = mockReadline(['', '', 'yessir', '', '']);
    await handleInit();
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.dryRun).toBe(true);
    fs.unlinkSync(configPath);
    restore();
  });

  it('should handle target version 5.4', async () => {
    const restore = mockReadline(['5.4', '', 'yes', '', '']);
    await handleInit();
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.targetTsVersion).toBe('5.4');
    restore();
  });

  it('should handle files input with spaces and extra commas', async () => {
    const restore = mockReadline(['', '', '', '', ' src/  ,  dist/, , test ']);
    await handleInit();
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.files).toEqual(['src', 'dist', 'test']);
    restore();
  });
});
