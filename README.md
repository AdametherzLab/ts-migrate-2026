# 🚀 ts-migrate-2026: Painless TypeScript 6.0/7.0 Upgrades

Tired of manual, error-prone TypeScript upgrades? **ts-migrate-2026** scans your project, fixes breaking changes, and generates a clean diff/PR — so you can focus on building, not migrating!

## 📦 Installation

bash
bun add -g ts-migrate-2026
# or
npm install -g ts-migrate-2026


## 🚀 Quick Start

bash
# Run in your project root
ts-migrate-2026 --dry-run


## 🛠️ Create Configuration

Generate a configuration file interactively:

bash
ts-migrate-2026 init


This guides you through setting up your migration preferences and creates a `ts-migrate.json` file.

## 📖 API

### CLI Functions
- **`parseArgs(argv: string[]): Partial<Config>`** – Parse command-line arguments
- **`validateConfig(config: Partial<Config>): Config`** – Validate and normalize config
- **`printHelp()`** – Print help text
- **`runCli(argv?: string[]): Promise<number>`** – Run the CLI (returns exit code)

### Core Migrator

import { Migrator } from "ts-migrate-2026";

const migrator = new Migrator({
  dataDir: "./.ts-migrate-data", // Optional: custom data directory
  dryRun: true, // Optional: set to false to apply changes
  logLevel