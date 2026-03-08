import { describe, it, expect, afterAll } from "bun:test";
import {
  parseArgs,
  validateConfig,
  printHelp,
  runCli,
  parseConfig,
  generateDiff,
  validateTsConfig,
  readTsConfig,
  writeTsConfig,
  getTsConfigPath,
  getDefaultDataDir,
  createIssue,
  MigrationError,
} from "../src/index";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ts-migrate-test-"));

afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ─── CLI Argument Parsing ────────────────────────────────────────

describe("CLI Argument Parsing", () => {
  it("should parse --dry-run flag", () => {
    const parsed = parseArgs(["node", "script.js", "--dry-run"]);
    const result = validateConfig(parsed);
    expect(result.dryRun).toBe(true);
  });

  it("should parse --apply flag (sets dryRun to false)", () => {
    const parsed = parseArgs(["node", "script.js", "--apply"]);
    const result = validateConfig(parsed);
    expect(result.dryRun).toBe(false);
  });

  it("should parse --log-level with valid value", () => {
    const parsed = parseArgs(["node", "script.js", "--log-level", "debug"]);
    const result = validateConfig(parsed);
    expect(result.logLevel).toBe("debug");
  });

  it("should parse --log-level warn", () => {
    const parsed = parseArgs(["node", "script.js", "--log-level", "warn"]);
    const result = validateConfig(parsed);
    expect(result.logLevel).toBe("warn");
  });

  it("should parse --log-level error", () => {
    const parsed = parseArgs(["node", "script.js", "--log-level", "error"]);
    const result = validateConfig(parsed);
    expect(result.logLevel).toBe("error");
  });

  it("should ignore invalid --log-level values", () => {
    const parsed = parseArgs(["node", "script.js", "--log-level", "invalid"]);
    const result = validateConfig(parsed);
    expect(result.logLevel).toBe("info");
  });

  it("should parse --target 6.0", () => {
    const parsed = parseArgs(["node", "script.js", "--target", "6.0"]);
    const result = validateConfig(parsed);
    expect(result.targetTsVersion).toBe("6.0");
  });

  it("should parse --target 7.0", () => {
    const parsed = parseArgs(["node", "script.js", "--target", "7.0"]);
    const result = validateConfig(parsed);
    expect(result.targetTsVersion).toBe("7.0");
  });

  it("should ignore invalid --target values", () => {
    const parsed = parseArgs(["node", "script.js", "--target", "4.9"]);
    const result = validateConfig(parsed);
    expect(result.targetTsVersion).toBe("6.0");
  });

  it("should parse --data-dir", () => {
    const parsed = parseArgs(["node", "script.js", "--data-dir", "/tmp/custom"]);
    const result = validateConfig(parsed);
    expect(result.dataDir).toBe("/tmp/custom");
  });

  it("should parse --help flag", () => {
    const parsed = parseArgs(["node", "script.js", "--help"]);
    expect(parsed.help).toBe(true);
  });

  it("should set help to false when --help not provided", () => {
    const parsed = parseArgs(["node", "script.js"]);
    expect(parsed.help).toBe(false);
  });

  it("should combine multiple flags", () => {
    const parsed = parseArgs([
      "node", "script.js",
      "--apply",
      "--log-level", "debug",
      "--target", "7.0",
      "--data-dir", "/tmp/data",
    ]);
    const result = validateConfig(parsed);
    expect(result.dryRun).toBe(false);
    expect(result.logLevel).toBe("debug");
    expect(result.targetTsVersion).toBe("7.0");
    expect(result.dataDir).toBe("/tmp/data");
  });

  it("should return defaults with no arguments", () => {
    const parsed = parseArgs(["node", "script.js"]);
    const result = validateConfig(parsed);
    expect(result.dryRun).toBe(true);
    expect(result.logLevel).toBe("info");
    expect(result.targetTsVersion).toBe("6.0");
    expect(result.dataDir).toBe(getDefaultDataDir());
  });
});

// ─── Configuration Validation ────────────────────────────────────

describe("Configuration Validation", () => {
  it("should provide defaults for empty config", () => {
    const result = validateConfig({});
    expect(result.dataDir).toBe(getDefaultDataDir());
    expect(result.dryRun).toBe(true);
    expect(result.logLevel).toBe("info");
    expect(result.targetTsVersion).toBe("6.0");
    expect(result.files).toBeUndefined();
  });

  it("should override defaults with provided values", () => {
    const result = validateConfig({
      dryRun: false,
      logLevel: "error" as const,
      targetTsVersion: "7.0" as const,
    });
    expect(result.dryRun).toBe(false);
    expect(result.logLevel).toBe("error");
    expect(result.targetTsVersion).toBe("7.0");
  });

  it("should handle nested config from parseArgs result", () => {
    const parseResult = { config: { dryRun: false, logLevel: "debug" as const }, help: false };
    const result = validateConfig(parseResult);
    expect(result.dryRun).toBe(false);
    expect(result.logLevel).toBe("debug");
  });

  it("should default dryRun to true when undefined", () => {
    const result = validateConfig({ logLevel: "warn" });
    expect(result.dryRun).toBe(true);
  });

  it("should preserve explicit dryRun false", () => {
    const result = validateConfig({ dryRun: false });
    expect(result.dryRun).toBe(false);
  });
});

// ─── parseConfig (file-based) ────────────────────────────────────

describe("parseConfig (file-based)", () => {
  it("should parse a valid config file", () => {
    const configPath = path.join(testDir, "valid-config.json");
    fs.writeFileSync(configPath, JSON.stringify({
      dryRun: false,
      logLevel: "debug",
      targetTsVersion: "7.0",
    }));
    const config = parseConfig(configPath);
    expect(config.dryRun).toBe(false);
    expect(config.logLevel).toBe("debug");
    expect(config.targetTsVersion).toBe("7.0");
  });

  it("should use defaults for missing fields in config file", () => {
    const configPath = path.join(testDir, "partial-config.json");
    fs.writeFileSync(configPath, JSON.stringify({ dryRun: false }));
    const config = parseConfig(configPath);
    expect(config.dryRun).toBe(false);
    expect(config.logLevel).toBe("info");
    expect(config.targetTsVersion).toBe("6.0");
    expect(config.dataDir).toBe(getDefaultDataDir());
  });

  it("should use defaults for empty JSON object", () => {
    const configPath = path.join(testDir, "empty-config.json");
    fs.writeFileSync(configPath, "{}");
    const config = parseConfig(configPath);
    expect(config.dryRun).toBe(true);
    expect(config.logLevel).toBe("info");
  });

  it("should throw MigrationError for invalid JSON", () => {
    const configPath = path.join(testDir, "bad-config.json");
    fs.writeFileSync(configPath, "not json");
    expect(() => parseConfig(configPath)).toThrow(MigrationError);
  });

  it("should throw MigrationError for missing file", () => {
    expect(() => parseConfig("/nonexistent/config.json")).toThrow(MigrationError);
  });

  it("should parse config with files array", () => {
    const configPath = path.join(testDir, "files-config.json");
    fs.writeFileSync(configPath, JSON.stringify({
      files: ["src/index.ts", "src/cli.ts"],
    }));
    const config = parseConfig(configPath);
    expect(config.files).toEqual(["src/index.ts", "src/cli.ts"]);
  });

  it("should parse config with custom dataDir", () => {
    const configPath = path.join(testDir, "datadir-config.json");
    fs.writeFileSync(configPath, JSON.stringify({ dataDir: "/custom/path" }));
    const config = parseConfig(configPath);
    expect(config.dataDir).toBe("/custom/path");
  });
});

// ─── TypeScript Config Read/Write ────────────────────────────────

describe("TypeScript Config Read/Write", () => {
  it("should read and parse tsconfig.json", () => {
    const tsconfigPath = path.join(testDir, "tsconfig-read.json");
    const config = { compilerOptions: { target: "ES2020", module: "ESNext" } };
    fs.writeFileSync(tsconfigPath, JSON.stringify(config));
    const result = readTsConfig(tsconfigPath);
    expect(result.compilerOptions?.target).toBe("ES2020");
    expect(result.compilerOptions?.module).toBe("ESNext");
  });

  it("should throw MigrationError for missing tsconfig", () => {
    expect(() => readTsConfig("/nonexistent/tsconfig.json")).toThrow(MigrationError);
  });

  it("should throw MigrationError for invalid tsconfig JSON", () => {
    const badPath = path.join(testDir, "bad-tsconfig.json");
    fs.writeFileSync(badPath, "{ invalid json");
    expect(() => readTsConfig(badPath)).toThrow(MigrationError);
  });

  it("should write tsconfig.json", () => {
    const tsconfigPath = path.join(testDir, "tsconfig-write.json");
    const config = { compilerOptions: { target: "ES2022" } };
    writeTsConfig(tsconfigPath, config);
    const raw = fs.readFileSync(tsconfigPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.compilerOptions.target).toBe("ES2022");
  });

  it("should roundtrip read/write tsconfig", () => {
    const tsconfigPath = path.join(testDir, "tsconfig-roundtrip.json");
    const original = { compilerOptions: { target: "ES2020", moduleResolution: "node" } };
    writeTsConfig(tsconfigPath, original);
    const readBack = readTsConfig(tsconfigPath);
    expect(readBack.compilerOptions?.target).toBe("ES2020");
    expect(readBack.compilerOptions?.moduleResolution).toBe("node");
  });

  it("should write pretty-printed JSON (2-space indent)", () => {
    const tsconfigPath = path.join(testDir, "tsconfig-pretty.json");
    writeTsConfig(tsconfigPath, { compilerOptions: { target: "ES2022" } });
    const raw = fs.readFileSync(tsconfigPath, "utf-8");
    expect(raw).toContain("\n  ");
  });

  it("should throw MigrationError when writing to invalid path", () => {
    expect(() => writeTsConfig("/nonexistent/dir/tsconfig.json", {})).toThrow(MigrationError);
  });
});

// ─── validateTsConfig ────────────────────────────────────────────

describe("validateTsConfig", () => {
  it("should pass for valid ES2020 config targeting 6.0", () => {
    const config = { compilerOptions: { target: "ES2020", moduleResolution: "node" } };
    expect(() => validateTsConfig(config, "6.0")).not.toThrow();
  });

  it("should pass for config with no compilerOptions", () => {
    expect(() => validateTsConfig({}, "6.0")).not.toThrow();
  });

  it("should throw for ES5 target in TS 6.0", () => {
    const config = { compilerOptions: { target: "ES5" } };
    expect(() => validateTsConfig(config, "6.0")).toThrow("ES5 target is deprecated");
  });

  it("should throw for classic moduleResolution with commonjs in TS 6.0", () => {
    const config = { compilerOptions: { module: "commonjs", moduleResolution: "classic" } };
    expect(() => validateTsConfig(config, "6.0")).toThrow("Classic module resolution is deprecated");
  });

  it("should throw for baseUrl in TS 6.0", () => {
    const config = { compilerOptions: { baseUrl: "./src" } };
    expect(() => validateTsConfig(config, "6.0")).toThrow("baseUrl is deprecated");
  });

  it("should throw for ES5 target in TS 7.0", () => {
    const config = { compilerOptions: { target: "ES5" } };
    expect(() => validateTsConfig(config, "7.0")).toThrow("ES5 target is deprecated");
  });

  it("should throw for baseUrl in TS 7.0", () => {
    const config = { compilerOptions: { baseUrl: "." } };
    expect(() => validateTsConfig(config, "7.0")).toThrow("baseUrl is deprecated");
  });

  it("should not throw for classic moduleResolution without commonjs module", () => {
    const config = { compilerOptions: { module: "ESNext", moduleResolution: "classic" } };
    expect(() => validateTsConfig(config, "6.0")).not.toThrow();
  });

  it("should not throw for ES5 in TS 5.0 target", () => {
    const config = { compilerOptions: { target: "ES5" } };
    expect(() => validateTsConfig(config, "5.0")).not.toThrow();
  });

  it("should not throw for baseUrl in TS 5.4", () => {
    const config = { compilerOptions: { baseUrl: "./src" } };
    expect(() => validateTsConfig(config, "5.4")).not.toThrow();
  });
});

// ─── generateDiff ────────────────────────────────────────────────

describe("generateDiff", () => {
  it("should show changes between old and new content", () => {
    const oldContent = '{\n  "target": "ES5",\n  "baseUrl": "./src"\n}';
    const newContent = '{\n  "target": "ES2020"\n}';
    const diff = generateDiff(oldContent, newContent);
    expect(diff).toContain('- ');
    expect(diff).toContain('+ ');
  });

  it("should show no diff markers for identical content", () => {
    const content = '{\n  "target": "ES2020"\n}';
    const diff = generateDiff(content, content);
    expect(diff).not.toContain('- ');
    expect(diff).not.toContain('+ ');
  });

  it("should handle empty old content", () => {
    const diff = generateDiff("", '{"target": "ES2020"}');
    expect(diff).toContain('+');
  });

  it("should handle empty new content", () => {
    const diff = generateDiff('{"target": "ES5"}', "");
    expect(diff).toContain('-');
  });

  it("should handle multiline additions", () => {
    const oldContent = "line1";
    const newContent = "line1\nline2\nline3";
    const diff = generateDiff(oldContent, newContent);
    expect(diff).toContain("  line1");
    expect(diff).toContain("+ line2");
    expect(diff).toContain("+ line3");
  });

  it("should handle multiline removals", () => {
    const oldContent = "line1\nline2\nline3";
    const newContent = "line1";
    const diff = generateDiff(oldContent, newContent);
    expect(diff).toContain("  line1");
    expect(diff).toContain("- line2");
    expect(diff).toContain("- line3");
  });
});

// ─── Issue Creation ──────────────────────────────────────────────

describe("Issue Creation", () => {
  it("should create an issue with correct properties", () => {
    const issue = createIssue("test.ts", 10, 5, "TS6001", "baseUrl is deprecated", "warning");
    expect(issue.filePath).toBe("test.ts");
    expect(issue.line).toBe(10);
    expect(issue.column).toBe(5);
    expect(issue.code).toBe("TS6001");
    expect(issue.message).toBe("baseUrl is deprecated");
    expect(issue.severity).toBe("warning");
  });

  it("should create an error-severity issue", () => {
    const issue = createIssue("src/main.ts", 1, 1, "TS9001", "Critical error", "error");
    expect(issue.severity).toBe("error");
    expect(issue.filePath).toBe("src/main.ts");
  });

  it("should handle zero line/column values", () => {
    const issue = createIssue("file.ts", 0, 0, "TS0000", "test", "warning");
    expect(issue.line).toBe(0);
    expect(issue.column).toBe(0);
  });

  it("should preserve long messages", () => {
    const longMsg = "A".repeat(500);
    const issue = createIssue("file.ts", 1, 1, "TS0001", longMsg, "warning");
    expect(issue.message).toBe(longMsg);
    expect(issue.message.length).toBe(500);
  });
});

// ─── Path Utilities ──────────────────────────────────────────────

describe("Path Utilities", () => {
  it("should return correct default data directory", () => {
    expect(getDefaultDataDir()).toBe(path.join(os.homedir(), ".ts-migrate-2026"));
  });

  it("should construct tsconfig path correctly", () => {
    expect(getTsConfigPath("/test/project")).toBe(path.join("/test/project", "tsconfig.json"));
  });

  it("should handle paths with trailing slash", () => {
    const result = getTsConfigPath("/test/project/");
    expect(result).toContain("tsconfig.json");
  });

  it("should handle relative project paths", () => {
    const result = getTsConfigPath(".");
    expect(result).toBe(path.join(".", "tsconfig.json"));
  });
});

// ─── MigrationError ──────────────────────────────────────────────

describe("MigrationError", () => {
  it("should create an error with a message", () => {
    const error = new MigrationError("Something went wrong");
    expect(error.message).toBe("Something went wrong");
    expect(error.name).toBe("MigrationError");
  });

  it("should create an error with a cause", () => {
    const cause = new Error("Original error");
    const error = new MigrationError("Wrapper", { cause });
    expect(error.message).toBe("Wrapper");
    expect(error.cause).toBe(cause);
  });

  it("should be an instance of Error", () => {
    expect(new MigrationError("Test")).toBeInstanceOf(Error);
  });

  it("should have a stack trace", () => {
    const error = new MigrationError("Stack test");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("MigrationError");
  });

  it("should be catchable as Error", () => {
    let caught = false;
    try {
      throw new MigrationError("thrown");
    } catch (e) {
      if (e instanceof Error) caught = true;
    }
    expect(caught).toBe(true);
  });
});

// ─── runCli ──────────────────────────────────────────────────────

describe("runCli", () => {
  it("should return 0 for --help", async () => {
    const exitCode = await runCli(["node", "script.js", "--help"]);
    expect(exitCode).toBe(0);
  });
});

// ─── printHelp ───────────────────────────────────────────────────

describe("printHelp", () => {
  it("should not throw", () => {
    expect(() => printHelp()).not.toThrow();
  });
});
