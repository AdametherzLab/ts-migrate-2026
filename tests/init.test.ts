import { describe, it, expect, mock, afterEach } from 'bun:test';
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
  }) as unknown as readline.Interface;

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
    const restore = mockReadline(['', '', '', '', '', 'yes']);
    
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

  it('should handle partial inputs with invalid values', async () => {
    const restore = mockReadline(['invalid', '/bad/path', 'maybe', 'verbose', '*.ts', 'yes']);
    
    await handleInit();
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.targetTsVersion).toBe('6.0');
    expect(config.dataDir).toBe(getDefaultDataDir());
    expect(config.dryRun).toBe(true);
    expect(config.logLevel).toBe('info');
    expect(config.files).toEqual(['*.ts']);
    restore();
  });

  it('should handle complex file glob patterns', async () => {
    const restore = mockReadline(['7.0', '', 'no', 'debug', 'src/**/*.ts, test/, .github/**/*.yml', 'yes']);
    
    await handleInit();
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.files).toEqual([
      'src/**/*.ts',
      'test/',
      '.github/**/*.yml'
    ]);
    expect(config.targetTsVersion).toBe('7.0');
    expect(config.dryRun).toBe(false);
    restore();
  });

  it('should cancel configuration when user rejects summary', async () => {
    const restore = mockReadline(['6.0', '', 'yes', 'info', '', 'no']);
    
    await handleInit();
    
    expect(fs.existsSync(configPath)).toBeFalse();
    restore();
  });

  it('should handle special path characters in data directory', async () => {
    const restore = mockReadline(['5.5', '~/custom-data-dir', '', '', '', 'yes']);
    
    await handleInit();
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.dataDir).toMatch(/custom-data-dir$/);
    restore();
  });
});
