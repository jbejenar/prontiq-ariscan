import type {
  ScanResult,
  ScanConfig,
  ContextFileInfo,
  ContextFileType,
  ParseStatus,
  PillarId,
  Suppression,
  PillarResult,
  Finding,
  RepoProfile,
  PluginFinding,
} from "@prontiq/ariscan-schema";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { ANALYZERS } from "./analyzers/registry.js";
import { createRepoContext } from "./context/repo-context.js";
import { aggregateResults } from "./scoring/composite.js";
import { detect } from "./detection/index.js";
import { classifyProfile } from "./detection/profile.js";
import { adjustPillarResults } from "./scoring/applicability.js";
import { adaptPillarRemediation } from "./scoring/remediation-adapter.js";
import { resolveLanguageProfile } from "./profiles/index.js";
import { loadPlugins } from "./plugins/loader.js";
import { runPlugins } from "./plugins/runner.js";
import type { RepoContext } from "./analyzers/analyzer.interface.js";

/** Progress event emitted during a scan. */
export interface ScanProgressEvent {
  /** Which pillar is being analyzed. */
  pillar: PillarId;
  /** Whether the analyzer is starting or finished. */
  status: "start" | "done";
  /** Milliseconds elapsed since scan began. */
  elapsed: number;
}

/** Callback for streaming scan progress. */
export type OnProgress = (event: ScanProgressEvent) => void;

const VERSION = "0.2.0";

/** Root-level context files to probe for. */
const CONTEXT_FILE_PATHS = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
  ".cursor/rules",
  ".github/copilot-instructions.md",
  ".aider.conf.yml",
  ".aiderignore",
  ".agentignore",
  ".mcp.json",
  "mcp.config.js",
  ".claude/settings.json",
] as const;

/** Map a file path to its ContextFileType. */
function classifyContextFile(filePath: string): ContextFileType {
  if (filePath === "AGENTS.md" || /\/AGENTS\.md$/.test(filePath)) return "agents-md";
  if (filePath === "CLAUDE.md") return "claude-md";
  if (filePath === ".cursorrules" || filePath === ".cursor/rules") return "cursorrules";
  if (filePath === ".github/copilot-instructions.md") return "copilot-instructions";
  if (filePath === ".aider.conf.yml" || filePath === ".aiderignore") return "aider-config";
  if (filePath === ".agentignore") return "agentignore";
  if (filePath === ".mcp.json" || filePath === "mcp.config.js") return "mcp-config";
  if (filePath === ".claude/settings.json" || filePath.startsWith(".claude/commands/"))
    return "claude-md";
  return "other";
}

/** Determine parse status for a context file based on its type and content. */
function determineParseStatus(filePath: string, content: string): ParseStatus {
  if (!content || content.trim().length === 0) return "warning";

  // JSON files: try parsing
  if (filePath.endsWith(".json")) {
    try {
      JSON.parse(content);
      return "valid";
    } catch {
      return "error";
    }
  }

  // YAML files: check for non-empty content (basic check)
  if (filePath.endsWith(".yml") || filePath.endsWith(".yaml")) {
    return content.trim().length > 0 ? "valid" : "warning";
  }

  // Markdown and other files: valid if non-empty
  return "valid";
}

/** Discover context files in the repository and return metadata for each. */
async function discoverContextFiles(context: RepoContext): Promise<ContextFileInfo[]> {
  // Collect candidate paths: known root files + nested AGENTS.md + .claude/commands/*
  const candidates: string[] = [...CONTEXT_FILE_PATHS];

  for (const f of context.files) {
    if (/\/AGENTS\.md$/.test(f) && f !== "AGENTS.md") {
      candidates.push(f);
    }
    if (f.startsWith(".claude/commands/")) {
      candidates.push(f);
    }
  }

  const results: ContextFileInfo[] = [];

  await Promise.all(
    candidates.map(async (filePath) => {
      const exists = await context.fileExists(filePath);
      if (!exists) return;

      const content = await context.readFile(filePath);

      // Get lastModified from file stat
      let lastModified: string | undefined;
      try {
        const fileStat = await stat(join(context.rootPath, filePath));
        lastModified = fileStat.mtime.toISOString();
      } catch {
        // stat failed — skip lastModified
      }

      const entry: ContextFileInfo = {
        path: filePath,
        type: classifyContextFile(filePath),
        ...(content != null
          ? {
              size: Buffer.byteLength(content, "utf-8"),
              lineCount: content.split("\n").length,
              parseStatus: determineParseStatus(filePath, content),
            }
          : {}),
        ...(lastModified ? { lastModified } : {}),
      };
      results.push(entry);
    }),
  );

  // Sort for deterministic output
  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}

/**
 * Pure function: scan a repository and produce an ARI score.
 * This is the core entry point for the scanning engine.
 *
 * @param onProgress — optional callback for streaming per-pillar progress updates.
 */
export async function scan(
  repoPath: string,
  config: Partial<ScanConfig> = {},
  onProgress?: OnProgress,
): Promise<ScanResult> {
  const startTime = performance.now();

  const context = await createRepoContext(repoPath);

  // Run detection BEFORE analyzers so results are available
  const detection = await detect(context);

  // Discover context files in the repository
  const contextFiles = await discoverContextFiles(context);

  // Filter analyzers by pillar config (only run enabled pillars)
  let activeAnalyzers = ANALYZERS;
  if (config.pillars) {
    const pillarConfig = config.pillars;
    activeAnalyzers = ANALYZERS.filter((analyzer) => {
      const override = pillarConfig[analyzer.pillar];
      // If pillar is explicitly configured, respect its enabled flag
      if (override && override.enabled === false) return false;
      return true;
    });
  }

  // Run analyzers in parallel (RFC-0003) with progress instrumentation
  const supportChecks = await Promise.all(
    activeAnalyzers.map(async (analyzer) => ({
      analyzer,
      supported: await analyzer.supports(context),
    })),
  );

  const supported = supportChecks.filter(({ supported: s }) => s);

  const pillarResults = await Promise.all(
    supported.map(async ({ analyzer }) => {
      onProgress?.({
        pillar: analyzer.pillar,
        status: "start",
        elapsed: Math.round(performance.now() - startTime),
      });
      const result = await analyzer.analyze(context);
      onProgress?.({
        pillar: analyzer.pillar,
        status: "done",
        elapsed: Math.round(performance.now() - startTime),
      });
      return result;
    }),
  );

  // Apply suppressions: mark matching findings and recalculate pillar scores
  const suppressedResults = config.suppressions
    ? applySuppressions(pillarResults, config.suppressions)
    : pillarResults;

  // Classify repo profile and apply archetype-based finding applicability
  const repoProfile: RepoProfile = config.archetype
    ? {
        archetype: config.archetype,
        confidence: "high",
        signals: ["user-override"],
        fileCount: 0,
        sourceFileCount: 0,
        hasCI: false,
      }
    : await classifyProfile(context, detection);
  const applicabilityResults = adjustPillarResults(suppressedResults, repoProfile.archetype);

  // Adapt remediation text to detected build systems and repo archetype (P2.18)
  const finalPillarResults = adaptPillarRemediation(applicabilityResults, detection, repoProfile);

  // Resolve language profile for weight adjustment (P3.06)
  const languageProfileDef = resolveLanguageProfile(detection, config.language);
  const customWeights = languageProfileDef?.weights;

  // Merge user-specified pillar weights on top of language profile weights
  const effectiveWeights = mergeWeights(customWeights, config.pillars);

  const duration = Math.round(performance.now() - startTime);

  const result = aggregateResults(
    finalPillarResults,
    { version: VERSION, repoPath, duration },
    effectiveWeights,
  );

  // Explicit devcontainer detection — propagated into ScanResult so telemetry
  // doesn't need to reverse-infer from finding codes.
  const devcontainerDetected = await context.fileExists(".devcontainer/devcontainer.json");

  // Run plugins if configured (P3.08)
  let pluginFindings: PluginFinding[] | undefined;
  const pluginConfig = config.plugins;
  if (pluginConfig?.enabled !== false) {
    const { plugins } = await loadPlugins(repoPath, {
      directory: pluginConfig?.directory,
      packages: pluginConfig?.packages,
    });

    if (plugins.length > 0) {
      const pluginResult = await runPlugins(plugins, context);
      if (pluginResult.findings.length > 0) {
        pluginFindings = pluginResult.findings;
      }
    }
  }

  return {
    ...result,
    detection,
    contextFiles: contextFiles.length > 0 ? contextFiles : undefined,
    devcontainerDetected,
    repoProfile,
    languageProfile: languageProfileDef?.language,
    ...(pluginFindings ? { pluginFindings } : {}),
  };
}

/**
 * Merge language profile weights with user-specified pillar weight overrides.
 * User config weights take precedence over language profile weights.
 * Returns undefined if no custom weights are in play.
 */
function mergeWeights(
  profileWeights?: Record<PillarId, number>,
  pillarConfig?: Record<string, { weight?: number; threshold?: number; enabled?: boolean }>,
): Partial<Record<PillarId, number>> | undefined {
  if (!profileWeights && !pillarConfig) return undefined;

  // Start with language profile weights (if any)
  const merged: Partial<Record<PillarId, number>> = profileWeights ? { ...profileWeights } : {};

  // Layer user-specified pillar weight overrides on top
  if (pillarConfig) {
    for (const [pillar, override] of Object.entries(pillarConfig)) {
      if (override.weight !== undefined) {
        merged[pillar as PillarId] = override.weight;
      }
    }
  }

  // If nothing was merged, return undefined
  if (Object.keys(merged).length === 0) return undefined;

  return merged;
}

/**
 * Apply suppressions to pillar results: mark matching findings as suppressed.
 * Suppressions are audit-only — they annotate findings with `suppressed: true`
 * but do not alter pillar scores, because analyzers do not expose per-finding
 * score contributions and any heuristic adjustment would be unreliable.
 */
function applySuppressions(
  pillarResults: PillarResult[],
  suppressions: Suppression[],
): PillarResult[] {
  const suppressedCodes = new Set(suppressions.map((s) => s.code));
  if (suppressedCodes.size === 0) return pillarResults;

  return pillarResults.map((pr) => {
    const hasAnySuppressed = pr.findings.some((f) => suppressedCodes.has(f.code));
    if (!hasAnySuppressed) return pr;

    const updatedFindings: Finding[] = pr.findings.map((f) => {
      if (suppressedCodes.has(f.code)) {
        return { ...f, suppressed: true };
      }
      return f;
    });

    return {
      ...pr,
      findings: updatedFindings,
    };
  });
}
