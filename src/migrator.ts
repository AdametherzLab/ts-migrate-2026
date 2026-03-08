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
  private readonly projectRoot: string;

  constructor(config: Config) {
    this.config = config;
    this.projectRoot = process.cwd(); // Assume current working directory is project root

    const tsConfigPath = ts.findConfigFile(this.projectRoot, ts.sys.fileExists, "tsconfig.json");
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

    const filesToProcess = this.config.files ? this.resolveFilesToProcess(this.config.files) : null;

    for (const file of files) {
      // Skip declaration files and node_modules for scanning deprecated patterns
      if (file.isDeclarationFile || file.fileName.includes("node_modules")) {
        continue;
      }

      // If specific files/directories are provided, filter them
      if (filesToProcess && !filesToProcess.has(file.fileName)) {
        continue;
      }

      filesScanned++;

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

  private isGlob(pattern: string): boolean {
    return /[*?\[\]]/.test(pattern);
  }

  private resolveFilesToProcess(filePaths: string[]): Set<string> {
    const resolvedPaths = new Set<string>();
    for (const item of filePaths) {
      if (this.isGlob(item)) {
        // Handle glob pattern using Bun's built-in glob support
        const glob = new Bun.Glob(item);
        const matches = glob.scanSync({ cwd: this.projectRoot, absolute: true });
        for (const match of matches) {
          if (match.endsWith('.ts') || match.endsWith('.tsx') || match.endsWith('.json')) {
            resolvedPaths.add(match);
          }
        }
      } else {
        const absolutePath = path.resolve(this.projectRoot, item);
        try {
          const stats = fs.statSync(absolutePath);
          if (stats.isDirectory()) {
            // Recursively add all TypeScript files in the directory
            this.addTsFilesFromDirectory(absolutePath, resolvedPaths);
          } else if (stats.isFile() && (absolutePath.endsWith('.ts') || absolutePath.endsWith('.tsx') || absolutePath.endsWith('.json'))) {
            resolvedPaths.add(absolutePath);
          }
        } catch (error) {
          console.warn(`Warning: Could not resolve path '${item}'. Skipping.`, error);
        }
      }
    }
    return resolvedPaths;
  }

  private addTsFilesFromDirectory(directoryPath: string, resolvedPaths: Set<string>): void {
    const files = fs.readdirSync(directoryPath);
    for (const file of files) {
      const fullPath = path.join(directoryPath, file);
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        this.addTsFilesFromDirectory(fullPath, resolvedPaths);
      } else if (stats.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.json'))) {
        resolvedPaths.add(fullPath);
      }
    }
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
    const targetVersion = this.config.targetTsVersion;

    if (targetVersion >= "6.0") {
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

    // Add checks for other target versions here
    if (targetVersion >= "5.0" && targetVersion < "6.0") {
      // Example: If 'strict' is not enabled in TS 5.0-5.x, warn
      if (config.compilerOptions && config.compilerOptions.target && parseFloat(config.compilerOptions.target) < 5.0) {
        issues.push({
          filePath,
          line: 1,
          column: 1,
          code: "TS5001",
          message: `Target TypeScript version is ${targetVersion}, but tsconfig.json target is ${config.compilerOptions.target}. Consider upgrading.`,
          severity: "warning",
        });
      }
    }
  }

  private parseTsConfig(content: string): MutableTsConfigJson {
    try {
      return JSON.parse(content) as MutableTsConfigJson;
    } catch (error) {
      throw new MigrationError(`Failed to parse tsconfig.json content: ${(error as Error).message}`);
    }
  }

  private checkDeprecatedPatterns(sourceFile: ts.SourceFile, issues: MigrationIssue[]): void {
    // Placeholder for deprecated pattern checking logic
    // This would traverse the AST and check for deprecated TypeScript patterns
  }

  private applyFix(issue: MigrationIssue): CodemodAction | null {
    // Placeholder for applying fixes
    return null;
  }
}