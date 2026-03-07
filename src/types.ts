import * as path from "path";
import * as os from "os";

export type LogLevel = "info" | "warn" | "error" | "debug";

export type TargetTsVersion = "5.0" | "5.1" | "5.2" | "5.3" | "5.4" | "5.5" | "6.0" | "7.0";

export interface MigrationIssue {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface CodemodAction {
  readonly filePath: string;
  readonly description: string;
  readonly oldContent: string;
  readonly newContent: string;
}

export interface ScanResult {
  readonly issues: readonly MigrationIssue[];
  readonly filesScanned: number;
  readonly timestamp: string;
}

export interface Config {
  readonly dataDir: string;
  readonly dryRun: boolean;
  readonly logLevel: LogLevel;
  readonly targetTsVersion: TargetTsVersion;
}

export interface TsConfigJson {
  readonly compilerOptions?: {
    readonly target?: string;
    readonly module?: string;
    readonly baseUrl?: string;
    readonly moduleResolution?: string;
  };
}

export function getDefaultDataDir(): string {
  return path.join(os.homedir(), ".ts-migrate-2026");
}

export function createIssue(
  filePath: string,
  line: number,
  column: number,
  code: string,
  message: string,
  severity: "error" | "warning"
): MigrationIssue {
  return {
    filePath,
    line,
    column,
    code,
    message,
    severity,
  };
}

export class MigrationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MigrationError";
  }
}
