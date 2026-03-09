import { describe, it, expect, mock } from 'bun:test';
import { handleInit } from '../src/init';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { getDefaultDataDir } from '../src/types';

const mockReadline = (inputs: string[]) => {
  let index = 0;
  const originalCreateInterface = readline.createInterface;
  
  // @ts-ignore - Mocking readline
  readline.createInterface = () => ({
    question: (prompt: string, callback: (answer: string) => void) => {
      callback(inputs[index++]);
    },
    close: () => {},
  });

  return () => {
    readline.createInterface = originalCreateInterface;
  };
};

describe('Interactive CLI Config Generation', () => {
  it('should create config with default values when user provides no input', async () => {
    const restore = mockReadline(['', '', 'yes', '', '']);
    
    await handleInit();
    
    const configPath = path.join(process.cwd(), 'ts-migrate.json');
    expect(fs.existsSync(configPath)).toBeTrue();
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config).toEqual({
      targetTsVersion: '6.0',
      dataDir: getDefaultDataDir(),
      dryRun: true,
      logLevel: 'info',
    });
    
    fs.unlinkSync(configPath);
    restore();
  });

  it('should create config with custom values when user provides input', async () => {
    const restore = mockReadline(['7.0', '/custom/path', 'no', 'debug', 'src,test']);
    
    await handleInit();
    
    const configPath = path.join(process.cwd(), 'ts-migrate.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config).toEqual({
      targetTsVersion: '7.0',
      dataDir: '/custom/path',
      dryRun: false,
      logLevel: 'debug',
      files: ['src', 'test']
    });
    
    fs.unlinkSync(configPath);
    restore();
  });

  it('should handle invalid inputs and use defaults', async () => {
    const restore = mockReadline(['5.0', '', 'invalid', 'verbose', '']);
    
    await handleInit();
    
    const configPath = path.join(process.cwd(), 'ts-migrate.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.targetTsVersion).toBe('6.0');
    expect(config.dryRun).toBe(true);
    expect(config.logLevel).toBe('info');
    
    fs.unlinkSync(configPath);
    restore();
  });
});
