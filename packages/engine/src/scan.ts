import type { ScanResult, ScanConfig, ContextFileInfo, ContextFileType } from "@prontiq/schema";
import { ANALYZERS } from "./analyzers/registry.js";
import { createRepoContext } from "./context/repo-context.js";
import { aggregateResults } from "./scoring/composite.js";
import { detect } from "./detection/index.js";
import type { RepoContext } from "./analyzers/analyzer.interface.js";

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
      const entry: ContextFileInfo = {
        path: filePath,
        type: classifyContextFile(filePath),
        ...(content != null
          ? {
              size: Buffer.byteLength(content, "utf-8"),
              lineCount: content.split("\n").length,
            }
          : {}),
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
 */
export async function scan(
  repoPath: string,
  config: Partial<ScanConfig> = {},
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

  // Run analyzers in parallel (RFC-0003)
  const supportChecks = await Promise.all(
    activeAnalyzers.map(async (analyzer) => ({
      analyzer,
      supported: await analyzer.supports(context),
    })),
  );

  const pillarResults = await Promise.all(
    supportChecks
      .filter(({ supported }) => supported)
      .map(({ analyzer }) => analyzer.analyze(context)),
  );

  const duration = Math.round(performance.now() - startTime);

  const result = aggregateResults(pillarResults, {
    version: VERSION,
    repoPath,
    duration,
  });

  return { ...result, detection, contextFiles: contextFiles.length > 0 ? contextFiles : undefined };
}
