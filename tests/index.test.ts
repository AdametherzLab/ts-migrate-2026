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
} from "../src/index";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

describe("CLI Argument Parsing", () => {
  it("should parse --dry-run flag", () => {
    const args = ["node", "script.js", "--dry-run"];
    const parsed = parseArgs(args);
    const result = validateConfig(parsed);
    expect(result.dryRun).toBe(true);
  });

  it("should parse --log-level with valid value", () => {
    const args = ["node", "script.js", "--log-level", "debug"];
    const parsed = parseArgs(args);
    const result = validateConfig(parsed);
    expect(result.logLevel).toBe("debug");
  });

  it("should ignore invalid --log-level values", () => {
    const args = ["node", "script.js", "--log-level", "invalid"];
    const parsed = parseArgs(args);
    const result = validateConfig(parsed);
    expect(result.logLevel).toBe("info");
  });
});

describe("Configuration Validation", () => {
  it("should provide defaults for missing config values", () => {
    const partialConfig = {};
    const result = validateConfig(partialConfig);
    expect(result.dataDir).toBe(getDefaultDataDir());
    expect(result.dryRun).toBe(true);
    expect(result.logLevel).toBe("info");
    expect(result.targetTsVersion).toBe("6.0");
  });

  it("should override defaults with provided values", () => {
    const partialConfig = {
      dryRun: false,
      logLevel: "error" as const,
      targetTsVersion: "7.0" as const,
    };
    const result = validateConfig(partialConfig);
    expect(result.dryRun).toBe(false);
    expect(result.logLevel).toBe("error");
    expect(result.targetTsVersion).toBe("7.0");
  });
});

describe("TypeScript Config Utilities", () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ts-migrate-test-"));
  const tsconfigPath = path.join(testDir, "tsconfig.json");

  it("should read and parse tsconfig.json", () => {
    const config = { compilerOptions: { target: "ES5", baseUrl: "./src" } };
    fs.writeFileSync(tsconfigPath, JSON.stringify(config));
    const result = readTsConfig(tsconfigPath);
    expect(result.compilerOptions?.target).toBe("ES5");
    expect(result.compilerOptions?.baseUrl).toBe("./src");
  });

  it("should validate tsconfig and throw on deprecated patterns", () => {
    const config = {
      compilerOptions: {
        target: "ES5",
        baseUrl: "./src",
        moduleResolution: "classic",
      },
    };
    expect(() => validateTsConfig(config)).toThrow();
  });

  it("should generate diff between old and new content", () => {
    const oldContent = `{
  "target": "ES5",
  "baseUrl": "./src"
}`;
    const newContent = `{
  "target": "ES2020"
}`;
    const diff = generateDiff(oldContent, newContent);
    expect(diff).toContain("-   \"baseUrl\": \"./src\"");
    expect(diff).toContain("+   \"target\": \"ES2020\"");
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });
});

describe("Issue Creation", () => {
  it("should create a migration issue with correct properties", () => {
    const issue = createIssue(
      "test.ts",
      10,
      5,
      "TS6001",
      "baseUrl is deprecated",
      "warning"
    );
    expect(issue.filePath).toBe("test.ts");
    expect(issue.line).toBe(10);
    expect(issue.column).toBe(5);
    expect(issue.code).toBe("TS6001");
    expect(issue.message).toBe("baseUrl is deprecated");
    expect(issue.severity).toBe("warning");
  });
});

describe("Path Utilities", () => {
  it("should return correct default data directory", () => {
    const defaultDir = getDefaultDataDir();
    expect(defaultDir).toBe(path.join(os.homedir(), ".ts-migrate-2026"));
  });

  it("should construct tsconfig path correctly", () => {
    const projectDir = "/test/project";
    const tsconfigPath = getTsConfigPath(projectDir);
    expect(tsconfigPath).toBe(path.join(projectDir, "tsconfig.json"));
  });
});