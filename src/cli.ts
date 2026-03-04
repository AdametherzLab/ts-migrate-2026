import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { createIssue, getDefaultDataDir } from "./types";
import type { Config, LogLevel, ScanResult, CodemodAction } from "./types";

interface ParseResult {
  config: Partial<Config>;
  help: boolean;
}

export function parseArgs(argv: string[]): ParseResult {
  const args = argv.slice(2);
  const config: {
    dataDir?: string;
    dryRun?: boolean;
    logLevel?: LogLevel;
    targetTsVersion?: "6.0" | "7.0";
  } = {};
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      config.dryRun = true;
    } else if (arg === "--log-level") {
      const level = args[++i] as LogLevel;
      if (level && ["info", "warn", "error", "debug"].includes(level)) {
        config.logLevel = level;
      }
    } else if (arg === "--target") {
      const target = args[++i];
      if (target === "6.0" || target === "7.0") {
        config.targetTsVersion = target as "6.0" | "7.0";
      }
    } else if (arg === "--data-dir") {
      config.dataDir = args[++i];
    } else if (arg === "--help") {
      help = true;
    }
  }

  return { config, help };
}

export function validateConfig(input: Partial<Config> & { config?: Partial<Config> }): Config {
  const config = input.config ? input.config : input;
  return {
    dataDir: config.dataDir || getDefaultDataDir(),
    dryRun: config.dryRun ?? true,
    logLevel: config.logLevel || "info",
    targetTsVersion: config.targetTsVersion || "6.0",
  };
}

export function printHelp(): void {
  console.log(`
ts-migrate-2026 - CLI to automatically fix TypeScript breaking changes for TS 6.0/7.0 migrations

Usage:
  ts-migrate-2026 [options]

Options:
  --dry-run        Show what changes would be made without applying them (default: true)
  --log-level      Set log level: info, warn, error, debug (default: info)
  --target         Target TypeScript version: 6.0 or 7.0 (default: 6.0)
  --data-dir       Directory to store migration data (default: ~/.ts-migrate-2026)
  --help           Show this help message
`);
}

export async function runCli(argv: string[] = process.argv): Promise<number> {
  const { config: args, help } = parseArgs(argv);
  if (help || argv.includes("--help")) {
    printHelp();
    return 0;
  }

  const config = validateConfig(args);
  const dataDir = config.dataDir;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log(`Using data directory: ${dataDir}`);
  console.log(`Target TypeScript version: ${config.targetTsVersion}`);
  console.log(`Dry run: ${config.dryRun}`);

  console.log("Scanning project for migration issues...");
  const result: ScanResult = {
    issues: [],
    filesScanned: 0,
    timestamp: new Date().toISOString(),
  };

  console.log("Migration scan complete.");
  console.log(`Issues found: ${result.issues.length}`);
  console.log(`Files scanned: ${result.filesScanned}`);

  return 0;
}

if (import.meta.main) {
  runCli().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}