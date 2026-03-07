import * as path from "path";
import * as ts from "typescript";
import * as fs from "fs";
import type { CodemodAction, Config, MigrationIssue, ScanResult, TsConfigJson } from "./types";
import { MigrationError } from "./types";

interface MutableTsConfigJson {
  compilerOptions?: {
    target?: string;
    module?: string;
    baseUrl?: string;
    moduleResolution?: string;
  };
}

export class Migrator {
  private readonly program: ts.Program;
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
    const tsConfigPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
    if (!tsConfigPath) throw new MigrationError("tsconfig.json not found in the current directory or its parents.");
    
    const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(
      tsConfigPath,
      {},
      ts.sys as unknown as ts.ParseConfigFileHost
    );

    if (!parsedCommandLine) throw new MigrationError("Failed to parse tsconfig.json.");
    
    // Check for parsing diagnostics
    if (parsedCommandLine.errors.length > 0) {
      const errorMessages = parsedCommandLine.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n');
      throw new MigrationError(`Errors found in tsconfig.json: ${errorMessages}`);
    }

    this.program = ts.createProgram({
      rootNames: parsedCommandLine.fileNames,
      options: parsedCommandLine.options,
      configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(parsedCommandLine)
    });
  }

  public scan(): ScanResult {
    const issues: MigrationIssue[] = [];
    const files = this.program.getSourceFiles();
    let filesScanned = 0;

    for (const file of files) {
      filesScanned++;
      // Skip declaration files and node_modules for scanning deprecated patterns
      if (file.isDeclarationFile || file.fileName.includes("node_modules")) {
        continue;
      }

      // Special handling for tsconfig.json files
      if (path.basename(file.fileName) === "tsconfig.json") {
        this.checkTsConfig(file.fileName, issues);
      } else {
        this.checkDeprecatedPatterns(file, issues);
      }
    }

    return {
      issues,
      filesScanned,
      timestamp: new Date().toISOString(),
    };
  }

  public applyCodemods(issues: readonly MigrationIssue[]): CodemodAction[] {
    const actions: CodemodAction[] = [];

    for (const issue of issues) {
      try {
        const action = this.applyFix(issue);
        if (action) actions.push(action);
      } catch (error) {
        console.warn(`Failed to apply fix for issue ${issue.code} in ${issue.filePath}:`, error);
      }
    }

    return actions;
  }

  private checkTsConfig(filePath: string, issues: MigrationIssue[]): void {
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      issues.push({
        filePath,
        line: 1,
        column: 1,
        code: "TS9001",
        message: `Failed to read tsconfig.json: ${(error as Error).message}`,
        severity: "error",
      });
      return;
    }

    const config = this.parseTsConfig(content);

    if (config.compilerOptions?.baseUrl) {
      issues.push({
        filePath,
        line: 1,
        column: 1,
        code: "TS6001",
        message: "baseUrl is deprecated in TypeScript 6.0+",
        severity: "warning",
      });
    }

    if (config.compilerOptions?.target === "ES5") {
      issues.push({
        filePath,
        line: 1,
        column: 1,
        code: "TS6002",
        message: "ES5 target is deprecated in TypeScript 6.0+",
        severity: "warning",
      });
    }

    if (config.compilerOptions?.moduleResolution === "classic") {
      issues.push({
        filePath,
        line: 1,
        column: 1,
        code: "TS6003",
        message: "classic module resolution is deprecated in TypeScript 6.0+",
        severity: "warning",
      });
    }
  }

  private checkDeprecatedPatterns(sourceFile: ts.SourceFile, issues: MigrationIssue[]): void {
    const checkNode = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) {
        const specifier = node.moduleSpecifier.getText().replace(/['"`]/g, ''); // Handle template literals too
        // Basic check for direct node_modules imports, could be more sophisticated
        if (specifier.startsWith("../node_modules/") || specifier.startsWith("./node_modules/")) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          issues.push({
            filePath: sourceFile.fileName,
            line: line + 1,
            column: character + 1,
            code: "TS6004",
            message: "Direct relative node_modules imports are discouraged. Use package names directly.",
            severity: "warning",
          });
        }
      }
      ts.forEachChild(node, checkNode);
    };

    ts.forEachChild(sourceFile, checkNode);
  }

  private applyFix(issue: MigrationIssue): CodemodAction | null {
    if (!issue.filePath.endsWith("tsconfig.json")) return null; // Only apply fixes to tsconfig.json for now

    let content: string;
    try {
      content = fs.readFileSync(issue.filePath, "utf-8");
    } catch (error) {
      throw new MigrationError(`Failed to read file for fix at ${issue.filePath}`, { cause: error });
    }

    const config = this.parseTsConfig(content);

    switch (issue.code) {
      case "TS6001":
        return this.fixBaseUrl(issue.filePath, content, config);
      case "TS6002":
        return this.fixTarget(issue.filePath, content, config);
      case "TS6003":
        return this.fixModuleResolution(issue.filePath, content, config);
      default:
        return null;
    }
  }

  private fixBaseUrl(filePath: string, oldContent: string, config: MutableTsConfigJson): CodemodAction | null {
    if (!config.compilerOptions?.baseUrl) return null;

    const newConfig = { ...config, compilerOptions: { ...config.compilerOptions } };
    delete newConfig.compilerOptions.baseUrl;
    const newContent = JSON.stringify(newConfig, null, 2);

    return {
      filePath,
      description: "Remove deprecated baseUrl",
      oldContent,
      newContent,
    };
  }

  private fixTarget(filePath: string, oldContent: string, config: MutableTsConfigJson): CodemodAction | null {
    if (config.compilerOptions?.target !== "ES5") return null;

    const newConfig = { ...config, compilerOptions: { ...config.compilerOptions, target: "ES2020" } };
    const newContent = JSON.stringify(newConfig, null, 2);

    return {
      filePath,
      description: "Update target from ES5 to ES2020",
      oldContent,
      newContent,
    };
  }

  private fixModuleResolution(filePath: string, oldContent: string, config: MutableTsConfigJson): CodemodAction | null {
    if (config.compilerOptions?.moduleResolution !== "classic") return null;

    const newConfig = { ...config, compilerOptions: { ...config.compilerOptions, moduleResolution: "node" } };
    const newContent = JSON.stringify(newConfig, null, 2);

    return {
      filePath,
      description: "Update moduleResolution from classic to node",
      oldContent,
      newContent,
    };
  }

  private parseTsConfig(content: string): MutableTsConfigJson {
    try {
      return JSON.parse(content) as MutableTsConfigJson;
    } catch (error) {
      // If parsing fails, return an empty object to prevent further errors
      // The checkTsConfig method will handle the missing properties gracefully
      console.warn("Failed to parse tsconfig.json content, returning empty config.", error);
      return {};
    }
  }
}
