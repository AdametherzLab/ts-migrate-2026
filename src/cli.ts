import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { createIssue, getDefaultDataDir, MigrationError } from "./types";
import type { Config, LogLevel, ScanResult, CodemodAction } from "./types";
import { Migrator } from "./migrator";

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
    } else if (arg === "--apply") {
      config.dryRun = false; // --apply explicitly sets dryRun to false
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
    dryRun: config.dryRun ?? true, // Default to true if not explicitly set
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
  --apply          Apply changes directly to files (overrides --dry-run)
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

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log(`Using data directory: ${dataDir}`);
    console.log(`Target TypeScript version: ${config.targetTsVersion}`);
    console.log(`Dry run: ${config.dryRun}`);

    console.log("Scanning project for migration issues...");
    const migrator = new Migrator(config);
    const scanResult = migrator.scan();

    console.log("Migration scan complete.");
    console.log(`Issues found: ${scanResult.issues.length}`);
    console.log(`Files scanned: ${scanResult.filesScanned}`);

    if (scanResult.issues.length > 0) {
      console.log("Applying codemods...");
      const actions = migrator.applyCodemods(scanResult.issues);

      if (actions.length > 0) {
        console.log(`Generated ${actions.length} codemod actions.`);
        for (const action of actions) {
          console.log(`\n--- Diff for ${action.filePath} (${action.description}) ---`);
          console.log(action.oldContent);
          console.log("--------------------------------------------------");
          console.log(action.newContent);
          console.log("--------------------------------------------------");

          if (!config.dryRun) {
            fs.writeFileSync(action.filePath, action.newContent, "utf-8");
            console.log(`Applied changes to ${action.filePath}`);
          } else {
            console.log(`(Dry run) Changes for ${action.filePath} not applied.`);
          }
        }
      } else {
        console.log("No codemod actions generated for the found issues.");
      }
    } else {
      console.log("No migration issues found. Your project seems compatible!");
    }

    return 0;
  } catch (err) {
    if (err instanceof MigrationError) {
      console.error(`\nMigration failed: ${err.message}`);
      if (err.cause) {
        console.error(`Caused by: ${err.cause instanceof Error ? err.cause.message : String(err.cause)}`);
      }
    } else if (err instanceof Error) {
      console.error(`\nAn unexpected error occurred: ${err.message}`);
      console.error(err.stack);
    } else {
      console.error(`\nAn unknown error occurred: ${String(err)}`);
    }
    return 1;
  }
}

if (import.meta.main) {
  runCli().catch((err) => {
    // This catch block is mostly for unhandled promise rejections outside runCli's try/catch
    // runCli itself should handle and return exit codes.
    console.error("Migration process exited with an unhandled error:", err);
    process.exit(1);
  });
}
