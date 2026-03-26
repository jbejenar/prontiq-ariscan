/**
 * Scaffolder types for `ariscan init` (S.01).
 */

/** A single file to be written by the scaffolder. */
export interface FileEntry {
  /** Relative path within the project directory. */
  readonly path: string;
  /** UTF-8 file content. */
  readonly content: string;
}

/** Preset manifest metadata. */
export interface PresetManifest {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Parent preset ID this preset extends (if any). */
  readonly extends?: string;
}

/** A scaffolder preset that can generate project files. */
export interface ScaffolderPreset {
  readonly manifest: PresetManifest;
  /** Generate file entries for a project. */
  generate(options: ScaffoldOptions): FileEntry[];
}

/** Options passed to the scaffold engine. */
export interface ScaffoldOptions {
  /** Project name (used in package.json, directory name, etc.). */
  readonly name: string;
  /** Preset ID to use. */
  readonly preset: string;
  /** Absolute path to the output directory. */
  readonly outputDir: string;
}

/** Result of a scaffold operation. */
export interface ScaffoldResult {
  /** Absolute path to the created project. */
  readonly outputDir: string;
  /** Number of files written. */
  readonly filesWritten: number;
  /** List of relative file paths created. */
  readonly files: readonly string[];
}
