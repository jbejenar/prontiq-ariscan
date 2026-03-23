/**
 * `audit agents-md` engine — P2.02
 *
 * Produces a detailed quality report for existing context files (AGENTS.md,
 * CLAUDE.md, .cursorrules, etc.) covering 7 scoring dimensions:
 *   1. Redundancy — % of content duplicated elsewhere in repo
 *   2. Staleness — contradictions with current repo state
 *   3. Instruction clarity — vague vs specific instructions
 *   4. Front-loading — critical info in first 20%
 *   5. Negative instruction coverage — "do NOT" constraints
 *   6. Cross-agent compatibility — coverage across agent types
 *   7. Token budget impact — estimated token cost
 */

import type { RepoContext } from "../analyzers/analyzer.interface.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";
import {
  computeAdditionality,
  computeFrontLoadScore,
  normalizeForComparison,
  REFERENCE_DOC_PATHS,
  REFERENCE_CONFIG_PATHS,
  DYNAMIC_CONFIG_PATTERNS,
  SOURCE_EXTENSIONS,
  MAX_SOURCE_FILES_FOR_DOCSTRINGS,
  CI_WORKFLOW_PREFIXES,
  normalizeConfigContent,
  extractLeadingDocstring,
} from "../context/additionality.js";
import type { ReferenceDoc, AdditionalityResult } from "../context/additionality.js";

// ─── Types ────────────────────────────────────────────────────────────────

export type IssueSeverity = "critical" | "warning" | "info";

export interface AuditIssue {
  severity: IssueSeverity;
  dimension: string;
  message: string;
  line?: number;
  fix?: string;
}

export interface DimensionScore {
  id: string;
  label: string;
  score: number; // 0-100
  details: string;
}

export interface AuditResult {
  filePath: string;
  dimensions: DimensionScore[];
  issues: AuditIssue[];
  overallScore: number;
  tokenEstimate: number;
  redundancy: AdditionalityResult;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Context file names recognized for auditing */
const CONTEXT_FILE_NAMES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
  ".github/copilot-instructions.md",
  "COPILOT.md",
  ".windsurfrules",
  "codex.md",
  ".claude/settings.json",
] as const;

/** Agent tool indicators for cross-agent compatibility */
const AGENT_INDICATORS: Record<string, RegExp[]> = {
  claude: [/claude/i, /anthropic/i, /CLAUDE\.md/i],
  copilot: [/copilot/i, /github\s+copilot/i],
  cursor: [/cursor/i, /\.cursorrules/i],
  codex: [/codex/i, /openai/i],
  generic: [/agent/i, /AI\s+(coding|assistant|tool)/i, /LLM/i],
};

/** Patterns that indicate vague instructions */
const VAGUE_PATTERNS: Array<{ pattern: RegExp; suggestion: string }> = [
  {
    pattern: /\bfollow\s+best\s+practices\b/i,
    suggestion: "Specify which practices: e.g., 'use strict TypeScript with no `any` types'",
  },
  {
    pattern: /\bkeep\s+it\s+(clean|simple|readable)\b/i,
    suggestion: "Define measurable criteria: e.g., 'functions under 50 lines, max 3 parameters'",
  },
  {
    pattern: /\buse\s+proper\s+(error\s+handling|logging|testing)\b/i,
    suggestion:
      "Specify the pattern: e.g., 'wrap async calls in try/catch, log errors with structured JSON'",
  },
  {
    pattern: /\bwrite\s+good\s+(tests|code|documentation)\b/i,
    suggestion:
      "Define 'good': e.g., 'every public function has a unit test with ≥80% branch coverage'",
  },
  {
    pattern: /\bensure\s+quality\b/i,
    suggestion: "Specify quality gates: e.g., 'all tests pass, lint clean, no type errors'",
  },
  {
    pattern: /\bappropriate\s+(error|level|amount)\b/i,
    suggestion: "Be specific: e.g., 'return HTTP 4xx for client errors, 5xx for server errors'",
  },
  {
    pattern: /\bas\s+needed\b/i,
    suggestion: "Define the criteria: e.g., 'add logging when error rate exceeds 1%'",
  },
  {
    pattern: /\bwhen\s+possible\b/i,
    suggestion: "Specify conditions: e.g., 'use const for all non-reassigned variables'",
  },
];

/** Patterns indicating negative instructions (do NOT / never / avoid) */
const NEGATIVE_INSTRUCTION_PATTERNS = [
  /\bdo\s+NOT\b/,
  /\bDo\s+NOT\b/,
  /\bDO\s+NOT\b/,
  /\bnever\b/i,
  /\bavoid\b/i,
  /\bdon['']t\b/i,
  /\bmust\s+not\b/i,
  /\bshould\s+not\b/i,
  /\bprohibited\b/i,
  /\bforbidden\b/i,
];

/** Approximate chars per token for context files (markdown) */
const CHARS_PER_TOKEN = 4;

// ─── Staleness detection ──────────────────────────────────────────────────

interface StalenessCheck {
  pattern: RegExp;
  getRepoValue: (ctx: RepoContext, detection: DetectionResult) => Promise<string | null>;
  description: string;
}

/** Build staleness checks from repo state */
function buildStalenessChecks(): StalenessCheck[] {
  return [
    {
      pattern: /\buse\s+(npm|yarn|pnpm|bun)\b/i,
      description: "package manager reference",
      getRepoValue: async (ctx) => {
        if (await ctx.fileExists("pnpm-lock.yaml")) return "pnpm";
        if (await ctx.fileExists("yarn.lock")) return "yarn";
        if (await ctx.fileExists("bun.lockb")) return "bun";
        if (await ctx.fileExists("package-lock.json")) return "npm";
        return null;
      },
    },
    {
      pattern: /\bnode\s*(?:\.?js)?\s*(\d+)/i,
      description: "Node.js version reference",
      getRepoValue: async (ctx) => {
        const nvmrc = await ctx.readFile(".nvmrc");
        if (nvmrc) return nvmrc.trim();
        const pkgJson = await ctx.readJson<{ engines?: { node?: string } }>("package.json");
        if (pkgJson?.engines?.node) return pkgJson.engines.node;
        return null;
      },
    },
    {
      pattern: /\b(jest|vitest|mocha|jasmine)\b/i,
      description: "test framework reference",
      getRepoValue: async (ctx) => {
        const pkg = await ctx.readJson<{ devDependencies?: Record<string, string> }>(
          "package.json",
        );
        const deps = pkg?.devDependencies ?? {};
        if ("vitest" in deps) return "vitest";
        if ("jest" in deps) return "jest";
        if ("mocha" in deps) return "mocha";
        return null;
      },
    },
  ];
}

// ─── Core audit function ──────────────────────────────────────────────────

/**
 * Discover context files in the repo that can be audited.
 */
export async function discoverContextFiles(ctx: RepoContext): Promise<string[]> {
  const found: string[] = [];
  for (const name of CONTEXT_FILE_NAMES) {
    if (await ctx.fileExists(name)) {
      found.push(name);
    }
  }
  // Also check for nested AGENTS.md in monorepo packages
  for (const file of ctx.files) {
    if (file.endsWith("/AGENTS.md") && !found.includes(file) && file !== "AGENTS.md") {
      found.push(file);
    }
  }
  return found.sort();
}

/**
 * Build reference corpus for additionality comparison.
 * Reuses the same logic as the context-quality analyzer and generator.
 */
async function buildReferenceDocs(ctx: RepoContext): Promise<ReferenceDoc[]> {
  const docs: ReferenceDoc[] = [];

  // Text docs
  for (const path of REFERENCE_DOC_PATHS) {
    const content = await ctx.readFile(path);
    if (content) docs.push({ path, content });
  }

  // Static config paths
  for (const path of REFERENCE_CONFIG_PATHS) {
    const content = await ctx.readFile(path);
    if (content) docs.push({ path, content: normalizeConfigContent(content, path) });
  }

  // Dynamic config patterns
  for (const file of ctx.files) {
    const base = file.split("/").pop() ?? "";
    if (DYNAMIC_CONFIG_PATTERNS.some((p) => p.test(base))) {
      const content = await ctx.readFile(file);
      if (content) docs.push({ path: file, content: normalizeConfigContent(content, file) });
    }
  }

  // CI workflows
  for (const file of ctx.files) {
    if (CI_WORKFLOW_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      const content = await ctx.readFile(file);
      if (content) docs.push({ path: file, content });
    }
  }

  // Leading docstrings from source files
  let sourceCount = 0;
  for (const file of ctx.files) {
    if (sourceCount >= MAX_SOURCE_FILES_FOR_DOCSTRINGS) break;
    if (SOURCE_EXTENSIONS.some((ext) => file.endsWith(ext))) {
      const content = await ctx.readFile(file);
      if (content) {
        sourceCount++;
        const docstring = extractLeadingDocstring(content);
        if (docstring) docs.push({ path: file, content: docstring });
      }
    }
  }

  return docs;
}

/**
 * Score redundancy dimension (0-100, higher = less redundant = better).
 */
function scoreRedundancy(additionality: AdditionalityResult): DimensionScore {
  const redundancy = additionality.redundancyPct;
  let score: number;
  let details: string;

  if (redundancy < 0) {
    score = 50; // Indeterminate
    details = "Could not determine redundancy (file too short or no comparable segments)";
  } else {
    score = Math.min(100, Math.max(0, Math.round(100 - redundancy)));
    details = `${redundancy.toFixed(1)}% of content duplicated elsewhere in repo`;
    if (additionality.duplicateLines.length > 0) {
      const sources = [...new Set(additionality.duplicateLines.map((d) => d.matchedIn))];
      details += ` — overlaps with ${sources.join(", ")}`;
    }
  }

  return { id: "redundancy", label: "Redundancy", score, details };
}

/**
 * Score staleness dimension (0-100, higher = less stale = better).
 */
async function scoreStaleness(
  content: string,
  ctx: RepoContext,
  detection: DetectionResult,
): Promise<{ dimension: DimensionScore; issues: AuditIssue[] }> {
  const issues: AuditIssue[] = [];
  const checks = buildStalenessChecks();
  const lines = content.split("\n");

  for (const check of checks) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const match = check.pattern.exec(line);
      if (match) {
        const repoValue = await check.getRepoValue(ctx, detection);
        if (repoValue) {
          const mentioned = match[1] ?? match[0];
          const mentionedLower = mentioned.toLowerCase();
          const repoLower = repoValue.toLowerCase();
          // Check for contradiction
          if (
            mentionedLower !== repoLower &&
            !repoLower.includes(mentionedLower) &&
            !mentionedLower.includes(repoLower)
          ) {
            issues.push({
              severity: "critical",
              dimension: "staleness",
              message: `Line ${i + 1} says '${mentioned}' but repo uses '${repoValue}' (${check.description})`,
              line: i + 1,
              fix: line.replace(match[0], match[0].replace(mentioned, repoValue)),
            });
          }
        }
      }
    }
  }

  // Also check for stale file path references
  const pathPattern = /(?:^|\s|`)([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+)(?:`|\s|$)/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    let pathMatch;
    while ((pathMatch = pathPattern.exec(line)) !== null) {
      const refPath = pathMatch[1]?.trim();
      if (refPath && !refPath.startsWith("http") && !refPath.startsWith("//")) {
        const exists = await ctx.fileExists(refPath);
        if (!exists && !refPath.includes("*") && !refPath.includes("{")) {
          issues.push({
            severity: "warning",
            dimension: "staleness",
            message: `Line ${i + 1} references '${refPath}' which does not exist in repo`,
            line: i + 1,
          });
        }
      }
    }
  }

  const score = Math.min(100, Math.max(0, 100 - issues.length * 15));
  const details =
    issues.length === 0
      ? "No contradictions or stale references detected"
      : `${issues.length} staleness issue(s) found`;

  return {
    dimension: { id: "staleness", label: "Staleness", score, details },
    issues,
  };
}

/**
 * Score instruction clarity (0-100, higher = clearer).
 */
function scoreClarity(content: string): { dimension: DimensionScore; issues: AuditIssue[] } {
  const issues: AuditIssue[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const vague of VAGUE_PATTERNS) {
      if (vague.pattern.test(line)) {
        issues.push({
          severity: "warning",
          dimension: "clarity",
          message: `Line ${i + 1}: vague instruction '${line.trim().slice(0, 60)}...'`,
          line: i + 1,
          fix: vague.suggestion,
        });
      }
    }
  }

  // Count specific vs vague instructions
  const normalized = normalizeForComparison(content);
  const sentences = normalized.split(/[.!?\n]+/).filter((s) => s.trim().length > 10);
  const specificCount = sentences.filter(
    (s) =>
      /\b(must|shall|always|never|exactly|require|use|import|export)\b/i.test(s) &&
      !/\b(best\s+practices|as\s+needed|when\s+possible)\b/i.test(s),
  ).length;
  const ratio = sentences.length > 0 ? specificCount / sentences.length : 0;

  const score = Math.min(
    100,
    Math.max(0, Math.round(ratio * 100 + (issues.length === 0 ? 20 : 0))),
  );
  const details =
    issues.length === 0
      ? `${specificCount}/${sentences.length} instructions are specific and actionable`
      : `${issues.length} vague instruction(s) found; ${specificCount}/${sentences.length} are specific`;

  return {
    dimension: { id: "clarity", label: "Instruction Clarity", score, details },
    issues,
  };
}

/**
 * Score front-loading (0-100).
 */
function scoreFrontLoading(content: string): DimensionScore {
  const score = computeFrontLoadScore(content);
  const details =
    score >= 80
      ? "Critical info (build/test/constraints) is well front-loaded in first 20%"
      : score >= 50
        ? "Some critical info is front-loaded but could be improved"
        : "Critical info is buried — move build/test commands and constraints to the top";

  return { id: "front-loading", label: "Front-loading", score, details };
}

/**
 * Score negative instruction coverage (0-100).
 */
function scoreNegativeInstructions(content: string): {
  dimension: DimensionScore;
  issues: AuditIssue[];
} {
  const lines = content.split("\n");
  let negativeCount = 0;

  for (const line of lines) {
    if (NEGATIVE_INSTRUCTION_PATTERNS.some((p) => p.test(line))) {
      negativeCount++;
    }
  }

  // Research shows 3-5 negative instructions is optimal
  let score: number;
  if (negativeCount >= 5) score = 100;
  else if (negativeCount >= 3) score = 80;
  else if (negativeCount >= 1) score = 50;
  else score = 10;

  const issues: AuditIssue[] = [];
  if (negativeCount === 0) {
    issues.push({
      severity: "warning",
      dimension: "negative-instructions",
      message:
        "No negative instructions found. Research shows explicit 'do NOT' constraints are the most impactful instructions for agents.",
      fix: "Add 3-5 'do NOT' constraints, e.g., 'Do NOT use the `any` type', 'Never import without `.js` extension'",
    });
  }

  const details = `${negativeCount} negative instruction(s) found (optimal: 3-5)`;

  return {
    dimension: {
      id: "negative-instructions",
      label: "Negative Instruction Coverage",
      score,
      details,
    },
    issues,
  };
}

/**
 * Score cross-agent compatibility (0-100).
 */
function scoreCrossAgent(
  content: string,
  contextFiles: string[],
): { dimension: DimensionScore; issues: AuditIssue[] } {
  const issues: AuditIssue[] = [];
  const covered: string[] = [];

  // Check content for agent-specific references
  for (const [agent, patterns] of Object.entries(AGENT_INDICATORS)) {
    if (patterns.some((p) => p.test(content))) {
      covered.push(agent);
    }
  }

  // Check for multiple context file formats
  const fileFormats = new Set<string>();
  for (const f of contextFiles) {
    if (f.includes("AGENTS")) fileFormats.add("agents-md");
    if (f.includes("CLAUDE")) fileFormats.add("claude-md");
    if (f.includes("cursorrules")) fileFormats.add("cursorrules");
    if (f.includes("copilot")) fileFormats.add("copilot");
    if (f.includes("codex")) fileFormats.add("codex");
  }

  const agentCoverage = Math.min(5, covered.length);
  const formatCoverage = Math.min(3, fileFormats.size);
  const score = Math.min(100, Math.max(0, agentCoverage * 15 + formatCoverage * 10 + 10));

  if (covered.length <= 1 && !covered.includes("generic")) {
    issues.push({
      severity: "info",
      dimension: "cross-agent",
      message: `Context file only references ${covered.join(", ") || "no"} agent(s). Consider using vendor-neutral language for broader compatibility.`,
      fix: "Use AGENTS.md as the primary context file with vendor-neutral instructions. Add vendor-specific files (CLAUDE.md, .cursorrules) only for tool-specific overrides.",
    });
  }

  const details = `Covers ${covered.length} agent type(s): ${covered.join(", ") || "none"}. ${fileFormats.size} context format(s) detected.`;

  return {
    dimension: { id: "cross-agent", label: "Cross-agent Compatibility", score, details },
    issues,
  };
}

/**
 * Estimate token count for a context file.
 */
function scoreTokenBudget(content: string): {
  dimension: DimensionScore;
  issues: AuditIssue[];
  tokenEstimate: number;
} {
  const tokenEstimate = Math.ceil(content.length / CHARS_PER_TOKEN);
  const issues: AuditIssue[] = [];

  let score: number;
  if (tokenEstimate <= 2000) {
    score = 100;
  } else if (tokenEstimate <= 5000) {
    score = 80;
  } else if (tokenEstimate <= 10000) {
    score = 60;
    issues.push({
      severity: "warning",
      dimension: "token-budget",
      message: `Context file is ~${tokenEstimate.toLocaleString()} tokens — this consumes significant agent context window.`,
      fix: "Consider splitting into root-level and subdirectory AGENTS.md files, or removing redundant content.",
    });
  } else {
    score = 30;
    issues.push({
      severity: "critical",
      dimension: "token-budget",
      message: `Context file is ~${tokenEstimate.toLocaleString()} tokens — very large for agent context windows (typically 8k-128k total).`,
      fix: "Aggressively deduplicate, remove info that's discoverable from files, split into progressive disclosure files.",
    });
  }

  const details = `~${tokenEstimate.toLocaleString()} tokens estimated`;

  return {
    dimension: { id: "token-budget", label: "Token Budget Impact", score, details },
    issues,
    tokenEstimate,
  };
}

/**
 * Run a full audit on a single context file.
 */
export async function auditContextFile(
  filePath: string,
  content: string,
  ctx: RepoContext,
  detection: DetectionResult,
  contextFiles: string[],
): Promise<AuditResult> {
  // Build reference docs for additionality
  const referenceDocs = await buildReferenceDocs(ctx);
  const redundancyResult = computeAdditionality(content, filePath, referenceDocs);

  // Score all 7 dimensions
  const redundancyDim = scoreRedundancy(redundancyResult);
  const { dimension: stalenessDim, issues: stalenessIssues } = await scoreStaleness(
    content,
    ctx,
    detection,
  );
  const { dimension: clarityDim, issues: clarityIssues } = scoreClarity(content);
  const frontLoadDim = scoreFrontLoading(content);
  const { dimension: negativeDim, issues: negativeIssues } = scoreNegativeInstructions(content);
  const { dimension: crossAgentDim, issues: crossAgentIssues } = scoreCrossAgent(
    content,
    contextFiles,
  );
  const { dimension: tokenDim, issues: tokenIssues, tokenEstimate } = scoreTokenBudget(content);

  const dimensions = [
    redundancyDim,
    stalenessDim,
    clarityDim,
    frontLoadDim,
    negativeDim,
    crossAgentDim,
    tokenDim,
  ];

  // Collect issues from redundancy
  const redundancyIssues: AuditIssue[] = [];
  if (redundancyResult.redundancyPct > 30) {
    redundancyIssues.push({
      severity: "critical",
      dimension: "redundancy",
      message: `Redundancy is ${redundancyResult.redundancyPct.toFixed(1)}% (target: <20%)`,
      fix: "Remove content that duplicates README, CONTRIBUTING, or config files. Focus on information not discoverable from file traversal.",
    });
    // Add specific duplicated sections
    for (const dup of redundancyResult.duplicateLines.slice(0, 5)) {
      redundancyIssues.push({
        severity: "info",
        dimension: "redundancy",
        message: `Line ${dup.line}: '${dup.text.slice(0, 60)}' duplicates content from ${dup.matchedIn}`,
        line: dup.line,
      });
    }
  } else if (redundancyResult.redundancyPct > 20) {
    redundancyIssues.push({
      severity: "warning",
      dimension: "redundancy",
      message: `Redundancy is ${redundancyResult.redundancyPct.toFixed(1)}% (target: <20%)`,
    });
  }

  const allIssues = [
    ...redundancyIssues,
    ...stalenessIssues,
    ...clarityIssues,
    ...negativeIssues,
    ...crossAgentIssues,
    ...tokenIssues,
  ].sort((a, b) => {
    const severityOrder: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const overallScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
  );

  return {
    filePath,
    dimensions,
    issues: allIssues,
    overallScore,
    tokenEstimate,
    redundancy: redundancyResult,
  };
}

/**
 * Audit all context files in a repository.
 */
export async function auditAgentsMd(
  ctx: RepoContext,
  detection: DetectionResult,
): Promise<AuditResult[]> {
  const contextFiles = await discoverContextFiles(ctx);
  if (contextFiles.length === 0) {
    return [];
  }

  const results: AuditResult[] = [];
  for (const filePath of contextFiles) {
    const content = await ctx.readFile(filePath);
    if (content) {
      const result = await auditContextFile(filePath, content, ctx, detection, contextFiles);
      results.push(result);
    }
  }

  return results;
}
