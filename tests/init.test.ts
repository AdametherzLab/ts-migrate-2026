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

  console.log = mock(() => {});
  console.warn = mock(() => {});
  
  readline.createInterface = () => ({
    question: (prompt: string, callback: (answer: string) => void) => {
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

  afterEach(() => {
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  });

  it('should create config with defaults on empty inputs', async () => {
    const restore = mockReadline(['', '', '', '', '']);
    
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

  it('should handle cancellation during confirmation', async () => {
    const restore = mockReadline(['7.0', '', 'yes', 'debug', '', 'no']);
    
    await handleInit();
    
    expect(fs.existsSync(configPath)).toBeFalse();
    restore();
  });

  it('should create config with custom values', async () => {
    const restore = mockReadline(['7.0', '/custom/path', 'no', 'debug', 'src,test', 'yes']);
    
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

  it('should handle invalid inputs with warnings', async () => {
    const restore = mockReadline(['invalid', '', 'maybe', 'verbose', '', 'yes']);
    
    await handleInit();
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.targetTsVersion).toBe('6.0');
    expect(config.logLevel).toBe('info');
    restore();
  });

  it('should handle file glob patterns', async () => {
    const restore = mockReadline(['', '', '', '', 'src/**/*.ts, test', 'yes']);
    
    await handleInit();
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.files).toEqual(['src/**/*.ts', 'test']);
    restore();
  });
});
