import { readFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { FileConfig } from "@prontiq/ariscan-schema";
import type {
  FileConfig as FileConfigType,
  ScanConfig as ScanConfigType,
  Suppression as SuppressionType,
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
 * Resolve inheritance: if `extends` is set, load parent config and deep-merge
 * (child values override parent). Only local file paths are supported.
 */
export async function resolveInheritance(
  config: FileConfigType,
  configPath: string,
  visited: Set<string> = new Set(),
): Promise<FileConfigType> {
  if (!config.extends) return config;

  const parentPath = resolve(dirname(configPath), config.extends);
  const normalizedParent = resolve(parentPath);

  if (visited.has(normalizedParent)) {
    throw new Error(`Circular policy inheritance detected: ${normalizedParent}`);
  }
  visited.add(normalizedParent);

  const parentConfig = await loadConfigFile(parentPath);
  const resolvedParent = await resolveInheritance(parentConfig, parentPath, visited);

  // Deep-merge: child overrides parent
  return mergeConfigs(resolvedParent, config);
}

function mergePillarRecord(
  parent?: Record<string, number>,
  child?: Record<string, number>,
): Record<string, number> | undefined {
  if (!parent && !child) return undefined;
  const merged = { ...parent, ...child };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeConfigs(parent: FileConfigType, child: FileConfigType): FileConfigType {
  const mergedPillarThresholds = mergePillarRecord(
    parent.thresholds?.pillars as Record<string, number> | undefined,
    child.thresholds?.pillars as Record<string, number> | undefined,
  );

  return {
    ...parent,
    ...child,
    // Don't carry `extends` forward after resolution
    extends: undefined,
    // Merge pillars object
    pillars:
      parent.pillars || child.pillars
        ? {
            exclude: child.pillars?.exclude ?? parent.pillars?.exclude,
            weights: mergePillarRecord(parent.pillars?.weights, child.pillars?.weights),
          }
        : undefined,
    // Merge thresholds
    thresholds:
      parent.thresholds || child.thresholds
        ? {
            composite: child.thresholds?.composite ?? parent.thresholds?.composite,
            ...(mergedPillarThresholds ? { pillars: mergedPillarThresholds } : {}),
          }
        : undefined,
    // Merge suppressions (child appends to parent)
    suppressions:
      parent.suppressions || child.suppressions
        ? [...(parent.suppressions ?? []), ...(child.suppressions ?? [])]
        : undefined,
    // Child profiles override parent profiles by name
    profiles:
      parent.profiles || child.profiles ? { ...parent.profiles, ...child.profiles } : undefined,
  };
}

/**
 * Resolve active profile: merge profile's weights/thresholds into base config.
 */
export function resolveProfile(config: FileConfigType): FileConfigType {
  if (!config.activeProfile || !config.profiles) return config;

  const profile = config.profiles[config.activeProfile];
  if (!profile) {
    throw new Error(
      `Active profile "${config.activeProfile}" not found. Available: ${Object.keys(config.profiles).join(", ")}`,
    );
  }

  const result = { ...config };

  if (profile.thresholds) {
    const mergedPillarThresholds = mergePillarRecord(
      result.thresholds?.pillars as Record<string, number> | undefined,
      profile.thresholds.pillars as Record<string, number> | undefined,
    );
    result.thresholds = {
      composite: profile.thresholds.composite ?? result.thresholds?.composite,
      ...(mergedPillarThresholds ? { pillars: mergedPillarThresholds } : {}),
    };
  }

  if (profile.weights) {
    result.pillars = {
      ...result.pillars,
      weights: { ...result.pillars?.weights, ...profile.weights },
    };
  }

  return result;
}

/**
 * Filter out expired suppressions. Returns only active suppressions.
 */
export function filterSuppressions(
  suppressions: SuppressionType[],
  now: Date = new Date(),
): SuppressionType[] {
  return suppressions.filter((s) => {
    if (s.expiry === "no-expiry") return true;
    return new Date(s.expiry) >= now;
  });
}

function applyWeightOverrides(
  pillars: NonNullable<ScanConfigType["pillars"]>,
  weights: Record<string, number>,
): void {
  for (const [id, weight] of Object.entries(weights)) {
    const pillarId = id as keyof typeof pillars;
    pillars[pillarId] = { enabled: true, ...pillars[pillarId], weight };
  }
}

function applyExclusions(pillars: NonNullable<ScanConfigType["pillars"]>, exclude: string[]): void {
  for (const id of exclude) {
    const pillarId = id as keyof typeof pillars;
    pillars[pillarId] = { ...(pillars[pillarId] ?? { enabled: true }), enabled: false };
  }
}

function buildPillarConfig(
  pillarsConfig: NonNullable<FileConfigType["pillars"]>,
): NonNullable<ScanConfigType["pillars"]> | undefined {
  const pillars: NonNullable<ScanConfigType["pillars"]> = {};

  if (pillarsConfig.weights) {
    applyWeightOverrides(pillars, pillarsConfig.weights);
  }
  if (pillarsConfig.exclude) {
    applyExclusions(pillars, pillarsConfig.exclude);
  }

  return Object.keys(pillars).length > 0 ? pillars : undefined;
}

/** Resolved policy metadata that doesn't map directly to ScanConfig fields. */
export interface ResolvedPolicyMeta {
  enforcement?: "warn" | "fail" | "block";
  pillarThresholds?: Record<string, number>;
}

/**
 * Convert a FileConfig (YAML structure) into a partial ScanConfig
 * that can be merged with CLI flags.
 */
export function fileConfigToScanConfig(fileConfig: FileConfigType): Partial<ScanConfigType> {
  const result: Partial<ScanConfigType> = {};

  // Resolve threshold: thresholds.composite takes precedence over flat threshold
  const compositeThreshold = fileConfig.thresholds?.composite ?? fileConfig.threshold;
  if (compositeThreshold !== undefined) {
    result.threshold = compositeThreshold;
  }

  if (fileConfig.format !== undefined) {
    result.format = fileConfig.format;
  }

  if (fileConfig.pillars) {
    const pillars = buildPillarConfig(fileConfig.pillars);
    if (pillars) {
      result.pillars = pillars;
    }
  }

  // Pass through active suppressions (expired ones already filtered)
  if (fileConfig.suppressions && fileConfig.suppressions.length > 0) {
    result.suppressions = fileConfig.suppressions;
  }

  return result;
}

/**
 * Extract policy metadata (enforcement mode, per-pillar thresholds) from FileConfig.
 */
export function extractPolicyMeta(fileConfig: FileConfigType): ResolvedPolicyMeta {
  const meta: ResolvedPolicyMeta = {};

  if (fileConfig.enforcement) {
    meta.enforcement = fileConfig.enforcement;
  }

  if (fileConfig.thresholds?.pillars) {
    meta.pillarThresholds = fileConfig.thresholds.pillars;
  }

  return meta;
}

export interface ResolvedConfig {
  scanConfig: Partial<ScanConfigType>;
  policyMeta: ResolvedPolicyMeta;
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
  const resolved = await resolveFullConfig(options);
  return resolved.scanConfig;
}

/**
 * Resolve config with full policy metadata.
 */
export async function resolveFullConfig(options: {
  repoPath: string;
  configPath?: string;
  cliOverrides: Partial<ScanConfigType>;
}): Promise<ResolvedConfig> {
  const { repoPath, configPath, cliOverrides } = options;

  // Load config file
  let fileConfig: FileConfigType | undefined;
  const resolvedConfigPath = configPath ? resolve(configPath) : await findConfigFile(repoPath);

  if (resolvedConfigPath) {
    try {
      fileConfig = await loadConfigFile(resolvedConfigPath);

      // Resolve inheritance chain
      fileConfig = await resolveInheritance(fileConfig, resolvedConfigPath);

      // Resolve active profile
      fileConfig = resolveProfile(fileConfig);

      // Filter expired suppressions
      if (fileConfig.suppressions) {
        fileConfig = { ...fileConfig, suppressions: filterSuppressions(fileConfig.suppressions) };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `Warning: Failed to load config file ${resolvedConfigPath}: ${message}\n`,
      );
    }
  }

  // Convert file config to scan config
  const fromFile = fileConfig ? fileConfigToScanConfig(fileConfig) : {};
  const policyMeta = fileConfig ? extractPolicyMeta(fileConfig) : {};

  // Merge: CLI flags > config file > defaults
  const scanConfig: Partial<ScanConfigType> = {
    ...fromFile,
    ...cliOverrides,
  };

  return { scanConfig, policyMeta };
}
