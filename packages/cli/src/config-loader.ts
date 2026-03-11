import { readFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { FileConfig } from "@prontiq/ariscan-schema";
import type {
  FileConfig as FileConfigType,
  ScanConfig as ScanConfigType,
} from "@prontiq/ariscan-schema";

const CONFIG_FILENAME = ".ariscan.yml";

/**
 * Search for `.ariscan.yml` starting from `startDir` and walking up to the filesystem root.
 * Returns the parsed and validated FileConfig, or `undefined` if no config file is found.
 */
export async function findConfigFile(startDir: string): Promise<string | undefined> {
  let dir = resolve(startDir);
  const root = resolve("/");

  while (true) {
    const candidate = join(dir, CONFIG_FILENAME);
    try {
      await readFile(candidate, "utf-8");
      return candidate;
    } catch {
      // File not found, walk up
    }

    if (dir === root) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return undefined;
}

/**
 * Load and validate a config file at the given path.
 * Throws if the file cannot be read or fails validation.
 */
export async function loadConfigFile(configPath: string): Promise<FileConfigType> {
  const raw = await readFile(configPath, "utf-8");
  const parsed: unknown = parseYaml(raw);

  if (parsed === null || parsed === undefined) {
    return {} as FileConfigType;
  }

  return FileConfig.parse(parsed);
}

/**
 * Convert a FileConfig (YAML structure) into a partial ScanConfig
 * that can be merged with CLI flags.
 */
export function fileConfigToScanConfig(fileConfig: FileConfigType): Partial<ScanConfigType> {
  const result: Partial<ScanConfigType> = {};

  if (fileConfig.threshold !== undefined) {
    result.threshold = fileConfig.threshold;
  }

  if (fileConfig.format !== undefined) {
    result.format = fileConfig.format;
  }

  if (fileConfig.pillars) {
    const pillars: NonNullable<ScanConfigType["pillars"]> = {};

    // Apply weight overrides
    if (fileConfig.pillars.weights) {
      for (const [id, weight] of Object.entries(fileConfig.pillars.weights)) {
        const pillarId = id as keyof typeof pillars;
        pillars[pillarId] = { enabled: true, ...pillars[pillarId], weight };
      }
    }

    // Apply exclusions (set enabled: false)
    if (fileConfig.pillars.exclude) {
      for (const id of fileConfig.pillars.exclude) {
        const pillarId = id as keyof typeof pillars;
        const existing = pillars[pillarId] ?? { enabled: true };
        pillars[pillarId] = { ...existing, enabled: false };
      }
    }

    if (Object.keys(pillars).length > 0) {
      result.pillars = pillars;
    }
  }

  return result;
}

/**
 * Resolve the final ScanConfig by merging (in precedence order):
 * CLI flags > config file > defaults.
 */
export async function resolveConfig(options: {
  repoPath: string;
  configPath?: string;
  cliOverrides: Partial<ScanConfigType>;
}): Promise<Partial<ScanConfigType>> {
  const { repoPath, configPath, cliOverrides } = options;

  // Load config file
  let fileConfig: FileConfigType | undefined;
  const resolvedConfigPath = configPath ? resolve(configPath) : await findConfigFile(repoPath);

  if (resolvedConfigPath) {
    try {
      fileConfig = await loadConfigFile(resolvedConfigPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `Warning: Failed to load config file ${resolvedConfigPath}: ${message}\n`,
      );
    }
  }

  // Convert file config to scan config
  const fromFile = fileConfig ? fileConfigToScanConfig(fileConfig) : {};

  // Merge: CLI flags > config file > defaults
  // Only include CLI overrides that were explicitly set (not defaults)
  const merged: Partial<ScanConfigType> = {
    ...fromFile,
    ...cliOverrides,
  };

  return merged;
}
