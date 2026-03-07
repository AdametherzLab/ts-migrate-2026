import type {
  Config,
  LogLevel,
  ScanResult,
  CodemodAction,
  MigrationIssue,
  TsConfigJson,
  TargetTsVersion,
} from "./types";

export {
  parseArgs,
  validateConfig,
  printHelp,
  runCli,
} from "./cli";

export {
  Migrator
} from "./migrator";

export {
  parseConfig,
  generateDiff,
  validateTsConfig,
  readTsConfig,
  writeTsConfig,
  getTsConfigPath,
} from "./utils";

export { getDefaultDataDir, createIssue, MigrationError } from "./types";

export type {
  Config,
  LogLevel,
  ScanResult,
  CodemodAction,
  MigrationIssue,
  TsConfigJson,
  TargetTsVersion,
};
