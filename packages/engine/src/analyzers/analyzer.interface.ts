import type { PillarId, PillarResult } from "@prontiq/ariscan-schema";

/**
 * Context provided to each analyzer about the repository being scanned.
 */
export interface RepoContext {
  /** Absolute path to the repository root */
  readonly rootPath: string;
  /** List of all file paths relative to rootPath */
  readonly files: readonly string[];
  /** Read a file's contents (utf-8). Returns null if file doesn't exist or is binary. */
  readFile(relativePath: string): Promise<string | null>;
  /** Check if a file exists */
  fileExists(relativePath: string): Promise<boolean>;
  /** Read and parse a JSON file. Returns null if not found or invalid. */
  readJson<T = unknown>(relativePath: string): Promise<T | null>;
}

/**
 * Interface that every pillar analyzer must implement.
 * Each analyzer is responsible for scoring one pillar of the ARI rubric.
 */
export interface PillarAnalyzer {
  /** Which pillar this analyzer scores */
  readonly pillar: PillarId;
  /** Human-readable name */
  readonly name: string;
  /** Analyzer version (semver) */
  readonly version: string;
  /** Whether this analyzer can run on the given repo */
  supports(context: RepoContext): Promise<boolean>;
  /** Run the analysis and return a scored result */
  analyze(context: RepoContext): Promise<PillarResult>;
}
