# 🚀 ts-migrate-2026: Painless TypeScript 6.0/7.0 Upgrades

Tired of manual, error-prone TypeScript upgrades? **ts-migrate-2026** scans your project, fixes breaking changes, and generates a clean diff/PR — so you can focus on building, not migrating!

## 📦 Installation

```bash
bun add -g ts-migrate-2026
# or
npm install -g ts-migrate-2026
```

## 🚀 Quick Start

```bash
# Run in your project root
ts-migrate-2026 --dry-run
```

## 📖 API

### CLI Functions
- **`parseArgs(argv: string[]): Partial<Config>`** – Parse command-line arguments
- **`validateConfig(config: Partial<Config>): Config`** – Validate and normalize config
- **`printHelp()`** – Print help text
- **`runCli(argv?: string[]): Promise<number>`** – Run the CLI (returns exit code)

### Core Migrator
```typescript
import { Migrator } from "ts-migrate-2026";

const migrator = new Migrator({
  dataDir: "./.ts-migrate-data", // Optional: custom data directory
  dryRun: true, // Optional: set to false to apply changes
  logLevel: "info", // Optional: debug, warn, error
  targetTsVersion: "6.0", // Optional: "6.0" or "7.0"
});

try {
  const scanResult = migrator.scan();
  console.log(`Found ${scanResult.issues.length} issues.`);

  if (scanResult.issues.length > 0) {
    const actions = migrator.applyCodemods(scanResult.issues);
    console.log(`Generated ${actions.length} codemod actions.`);

    // If not dryRun, apply actions (e.g., write to files)
    // For dryRun, you might just print the diffs
  }
} catch (error) {
  if (error instanceof MigrationError) {
    console.error(`Migration failed: ${error.message}`);
  } else {
    console.error(`An unexpected error occurred: ${error}`);
  }
}
```

### Utility Functions
- **`parseConfig(configPath: string): Config`** – Load config from file
- **`generateDiff(oldContent: string, newContent: string): string`** – Generate a diff
- **`validateTsConfig(config: TsConfigJson): void`** – Validate tsconfig.json
- **`readTsConfig(tsconfigPath: string): TsConfigJson`** – Read tsconfig.json
- **`writeTsConfig(tsconfigPath: string, config: TsConfigJson): void`** – Write tsconfig.json
- **`getTsConfigPath(projectDir: string): string`** – Resolve tsconfig path

### Types
```typescript
import type { Config, LogLevel, ScanResult, MigrationError } from "ts-migrate-2026";
```

## 🧪 Examples

### Dry Run (Safe Mode)
```bash
ts-migrate-2026 --dry-run
```

### Apply Fixes Automatically
```bash
ts-migrate-2026 --apply
```

### Custom Data Directory
```bash
ts-migrate-2026 --data-dir ./custom-dir
```

### Target TypeScript 7.0
```bash
ts-migrate-2026 --target 7.0 --dry-run
```

## 🤝 Contributing
Found a bug? Got an idea? Open an issue or PR! We lov
