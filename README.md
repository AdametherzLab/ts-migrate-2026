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
ts-migrate-2026 --project ./tsconfig.json --dry-run
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
  projectDir: "./",
  logLevel: "info",
});
const result = await migrator.scan();
await migrator.applyFixes(result.actions);
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
import type { Config, LogLevel, ScanResult } from "ts-migrate-2026";
```

## 🧪 Examples

### Dry Run (Safe Mode)
```bash
ts-migrate-2026 --project ./tsconfig.json --dry-run
```

### Apply Fixes Automatically
```bash
ts-migrate-2026 --project ./tsconfig.json --apply
```

### Custom Data Directory
```bash
ts-migrate-2026 --project ./tsconfig.json --data-dir ./custom-dir
```

## 🤝 Contributing
Found a bug? Got an idea? Open an issue or PR! We love contributions — just keep it simple and type-safe.

## 📄 License
MIT © 2026