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


## 🛠️ Interactive Configuration

Generate a configuration file interactively with step-by-step guidance:

bash
ts-migrate-2026 init


This wizard will guide you through:
- **Target TypeScript version** (5.0-7.0)
- **Storage directory** for logs and reports
- **Safe mode** (dry run) vs apply changes
- **Log verbosity level**
- **File selection** (specific files or entire project)
- **Interactive mode** (prompt for each change)

The configuration is saved as `ts-migrate.json` in your current directory.

## 📖 Usage

### Basic Commands

bash
# Create configuration interactively
ts-migrate-2026 init

# Preview changes without modifying files
ts-migrate-2026 --dry-run

# Apply changes directly
ts-migrate-2026 --apply

# Run interactive migration wizard
ts-migrate-2026 --guided

# Target specific TypeScript version
ts-migrate-2026 --target 7.0 --dry-run

# Process specific files only
ts-migrate-2026 --dry-run --files "src/**/*.ts,lib/**/*.ts"


### Configuration File

After running `init`, you'll get a `ts-migrate.json` file:


{
  "targetTsVersion": "6.0",
  "dataDir": "/Users/you/.ts-migrate-2026",
  "dryRun": true,
  "logLevel": "info",
  "interactive": false,
  "files": ["src/**/*.ts"]
}


Use the config file:
bash
ts-migrate-2026 --config ts-migrate.json


## 🧪 Testing

Run the test suite:

bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test tests/init.test.ts


## 🔧 Development

bash
# Clone and install
bun install

# Build the project
bun run build

# Run in development mode
bun run dev


## 📄 License

MIT © 2024
