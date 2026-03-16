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
} from "@prontiq/ariscan-schema";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { ANALYZERS } from "./analyzers/registry.js";
import { createRepoContext } from "./context/repo-context.js";
import { aggregateResults } from "./scoring/composite.js";
import { detect } from "./detection/index.js";
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

const VERSION = "0.1.0";

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
  const finalPillarResults = config.suppressions
    ? applySuppressions(pillarResults, config.suppressions)
    : pillarResults;

  const duration = Math.round(performance.now() - startTime);

  const result = aggregateResults(finalPillarResults, {
    version: VERSION,
    repoPath,
    duration,
  });

  return { ...result, detection, contextFiles: contextFiles.length > 0 ? contextFiles : undefined };
}

/**
 * Estimated score penalty per severity level.
 * Used to adjust pillar scores when findings are suppressed.
 */
const SEVERITY_PENALTY: Record<string, number> = {
  critical: 15,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
};

/**
 * Apply suppressions to pillar results: mark matching findings as suppressed
 * and adjust pillar scores to remove the suppressed findings' penalty.
 * Suppressed findings are kept in the output (with `suppressed: true`) for audit trail
 * but their estimated penalty is added back to the pillar score.
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

    let scoreBoost = 0;
    const updatedFindings: Finding[] = pr.findings.map((f) => {
      if (suppressedCodes.has(f.code)) {
        scoreBoost += SEVERITY_PENALTY[f.severity] ?? 0;
        return { ...f, suppressed: true };
      }
      return f;
    });

    const adjustedScore = Math.min(100, Math.max(0, pr.score + scoreBoost));

    return {
      ...pr,
      score: adjustedScore,
      findings: updatedFindings,
    };
  });
}
