import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { Config, TsConfigJson, MigrationIssue, CodemodAction, getDefaultDataDir } from "./types";

export function parseConfig(configPath: string): Config {
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<Config>;
  return {
    dataDir: parsed.dataDir ?? getDefaultDataDir(),
    dryRun: parsed.dryRun ?? true,
    logLevel: parsed.logLevel ?? "info",
    targetTsVersion: parsed.targetTsVersion ?? "6.0",
  };
}

export function generateDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const maxLen = Math.max(oldLines.length, newLines.length);
  const diffLines: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] ?? "";
    const newLine = newLines[i] ?? "";
    if (oldLine !== newLine) {
      diffLines.push(`- ${oldLine}`);
      diffLines.push(`+ ${newLine}`);
    } else {
      diffLines.push(`  ${oldLine}`);
    }
  }

  return diffLines.join("\n");
}

export function createCodemodAction(
  filePath: string,
  description: string,
  oldContent: string,
  newContent: string
): CodemodAction {
  return { filePath, description, oldContent, newContent };
}

export function validateTsConfig(config: TsConfigJson): void {
  if (!config.compilerOptions) return;
  const { target, module, baseUrl, moduleResolution } = config.compilerOptions;
  if (target === "ES5") {
    throw new Error("ES5 target is deprecated in TS 6.0+");
  }
  if (module === "commonjs" && moduleResolution === "classic") {
    throw new Error("Classic module resolution is deprecated in TS 6.0+");
  }
  if (baseUrl) {
    throw new Error("baseUrl is deprecated in TS 6.0+");
  }
}

export function readTsConfig(tsconfigPath: string): TsConfigJson {
  const raw = fs.readFileSync(tsconfigPath, "utf-8");
  return JSON.parse(raw) as TsConfigJson;
}

export function writeTsConfig(tsconfigPath: string, config: TsConfigJson): void {
  fs.writeFileSync(tsconfigPath, JSON.stringify(config, null, 2));
}

export function getTsConfigPath(projectDir: string): string {
  return path.join(projectDir, "tsconfig.json");
}