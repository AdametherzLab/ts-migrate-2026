import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { parseArgs, validateConfig, printHelp, runCli } from '../src/cli';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the init and wizard modules
const mockHandleInit = mock(() => Promise.resolve());
const mockRunGuidedMigration = mock(() => Promise.resolve(0));

mock.module('../src/init', () => ({
  handleInit: mockHandleInit,
}));

mock.module('../src/wizard', () => ({
  runGuidedMigration: mockRunGuidedMigration,
}));

describe('CLI Integration Tests', () => {
  beforeEach(() => {
    mockHandleInit.mockClear();
    mockRunGuidedMigration.mockClear();
  });

  it('should parse init command correctly', () => {
    const parsed = parseArgs(['node', 'script.js', 'init', '--dry-run']);
    expect(parsed.command).toBe('init');
    expect(parsed.dryRun).toBe(true);
  });

  it('should handle init command in runCli', async () => {
    const exitCode = await runCli(['node', 'script.js', 'init']);
    expect(exitCode).toBe(0);
    expect(mockHandleInit).toHaveBeenCalledTimes(1);
  });

  it('should handle guided flag in runCli', async () => {
    const exitCode = await runCli(['node', 'script.js', '--guided']);
    expect(exitCode).toBe(0);
    expect(mockRunGuidedMigration).toHaveBeenCalledTimes(1);
  });

  it('should handle help flag', async () => {
    const exitCode = await runCli(['node', 'script.js', '--help']);
    expect(exitCode).toBe(0);
  });

  it('should handle no arguments (default behavior)', async () => {
    const exitCode = await runCli(['node', 'script.js']);
    expect(exitCode).toBe(0);
  });

  it('should validate config with interactive flag', () => {
    const config = validateConfig({ interactive: true });
    expect(config.interactive).toBe(true);
    expect(config.dryRun).toBe(true); // Default
  });

  it('should validate config with guided flag', () => {
    const config = validateConfig({ guided: true });
    expect(config.guided).toBe(true);
    expect(config.targetTsVersion).toBe('6.0'); // Default
  });

  it('should print help without throwing', () => {
    expect(() => printHelp()).not.toThrow();
  });
});
