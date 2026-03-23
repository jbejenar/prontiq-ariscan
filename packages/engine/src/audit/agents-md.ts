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

/** Context file names recognized for auditing.
 *  Only natural-language / markdown-like files belong here — the scoring
 *  dimensions (clarity, front-loading, negative instructions, etc.) assume
 *  prose content.  Structured config files such as `.claude/settings.json`
 *  are intentionally excluded because they would produce misleading scores
 *  when evaluated with text-quality heuristics.
 */
const CONTEXT_FILE_NAMES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
  ".github/copilot-instructions.md",
  "COPILOT.md",
  ".windsurfrules",
  "codex.md",
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
  /\bdo\s+not\b/i,
  /\bnever\b/i,
  /\bavoid\b/i,
  /\bdon['\u2018\u2019]t\b/i,
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

/**
 * Try to read a file starting from the nearest ancestor directory of `contextFilePath`,
 * walking upward to the repo root. Returns the first match found.
 */
async function readNearestFile(
  ctx: RepoContext,
  contextFilePath: string,
  target: string,
): Promise<string | null> {
  const segments = contextFilePath.split("/");
  // Walk from parent directory of context file up to root
  for (let i = segments.length - 1; i >= 1; i--) {
    const dir = segments.slice(0, i).join("/");
    const candidate = `${dir}/${target}`;
    const content = await ctx.readFile(candidate);
    if (content !== null && content !== undefined) return content;
  }
  // Root-level fallback
  return ctx.readFile(target);
}

/**
 * Try to read a JSON file starting from the nearest ancestor directory,
 * walking upward to the repo root.
 */
async function readNearestJson<T>(
  ctx: RepoContext,
  contextFilePath: string,
  target: string,
): Promise<T | null> {
  const segments = contextFilePath.split("/");
  for (let i = segments.length - 1; i >= 1; i--) {
    const dir = segments.slice(0, i).join("/");
    const candidate = `${dir}/${target}`;
    if (await ctx.fileExists(candidate)) {
      return ctx.readJson<T>(candidate);
    }
  }
  return ctx.readJson<T>(target);
}

/**
 * Check if a file exists starting from the nearest ancestor directory,
 * walking upward to the repo root. Returns the value associated with the
 * first match found.
 */
async function findNearestFile(
  ctx: RepoContext,
  contextFilePath: string,
  candidates: Array<{ file: string; value: string }>,
): Promise<string | null> {
  const segments = contextFilePath.split("/");
  for (let i = segments.length - 1; i >= 1; i--) {
    const dir = segments.slice(0, i).join("/");
    for (const { file, value } of candidates) {
      if (await ctx.fileExists(`${dir}/${file}`)) return value;
    }
  }
  // Root-level fallback
  for (const { file, value } of candidates) {
    if (await ctx.fileExists(file)) return value;
  }
  return null;
}

/** Build staleness checks from repo state, resolving relative to a context file path */
function buildStalenessChecks(contextFilePath: string): StalenessCheck[] {
  return [
    {
      pattern: /\buse\s+(npm|yarn|pnpm|bun)\b/i,
      description: "package manager reference",
      getRepoValue: async (ctx) => {
        return findNearestFile(ctx, contextFilePath, [
          { file: "pnpm-lock.yaml", value: "pnpm" },
          { file: "yarn.lock", value: "yarn" },
          { file: "bun.lockb", value: "bun" },
          { file: "package-lock.json", value: "npm" },
        ]);
      },
    },
    {
      pattern: /\bnode\s*(?:\.?js)?\s*(\d+)/i,
      description: "Node.js version reference",
      getRepoValue: async (ctx) => {
        const nvmrc = await readNearestFile(ctx, contextFilePath, ".nvmrc");
        if (nvmrc) return nvmrc.trim();
        const pkgJson = await readNearestJson<{ engines?: { node?: string } }>(
          ctx,
          contextFilePath,
          "package.json",
        );
        if (pkgJson?.engines?.node) return pkgJson.engines.node;
        return null;
      },
    },
    {
      pattern: /\b(jest|vitest|mocha|jasmine)\b/i,
      description: "test framework reference",
      getRepoValue: async (ctx) => {
        const pkg = await readNearestJson<{ devDependencies?: Record<string, string> }>(
          ctx,
          contextFilePath,
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
 * Searches all nesting depths for every supported context-file name so that
 * package-level vendor-specific files (e.g. `packages/foo/CLAUDE.md`) are
 * included alongside root-level files.
 */
export async function discoverContextFiles(ctx: RepoContext): Promise<string[]> {
  const found = new Set<string>();

  // Build a set of bare filenames / suffix patterns to match against.
  // CONTEXT_FILE_NAMES entries may contain a directory prefix
  // (e.g. ".github/copilot-instructions.md", ".claude/settings.json").
  // We match both the exact root-level path and any nested occurrence whose
  // path ends with "/<name>".
  for (const name of CONTEXT_FILE_NAMES) {
    // Root-level exact match
    if (await ctx.fileExists(name)) {
      found.add(name);
    }
    // Nested matches — look for any file whose path ends with "/<name>"
    const suffix = `/${name}`;
    for (const file of ctx.files) {
      if (file.endsWith(suffix) && !found.has(file)) {
        found.add(file);
      }
    }
  }

  return [...found].sort();
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
 * Resolves repo facts relative to the audited file's package directory so that
 * nested context files are compared against their nearest config, not the root.
 */
async function scoreStaleness(
  content: string,
  filePath: string,
  ctx: RepoContext,
  detection: DetectionResult,
): Promise<{ dimension: DimensionScore; issues: AuditIssue[] }> {
  const issues: AuditIssue[] = [];
  const checks = buildStalenessChecks(filePath);
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

  // Also check for stale file path references.
  // Resolve relative to the context file's directory first (for monorepo
  // package-level files), then fall back to repo-root lookup.
  const contextDir = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";

  // Match paths with slashes (e.g. src/index.ts).
  const slashPathPattern = /(?:^|\s|`)([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+)(?:`|[\s.,;:)\]!?]|$)/g;
  // Match standalone filenames with extensions, including multi-dot names
  // like vite.config.ts, tsconfig.base.json, .eslintrc.js, foo.test.ts.
  // Terminators include common punctuation so prose like "README.md." is caught.
  const standaloneFilePattern =
    /(?:^|\s|`)(\.[a-zA-Z][a-zA-Z0-9_.-]*|[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)(?:`|[\s.,;:)\]!?]|$)/g;

  const checkedPaths = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    // Collect all path references from both patterns
    const refs: string[] = [];
    let pathMatch;
    while ((pathMatch = slashPathPattern.exec(line)) !== null) {
      const ref = pathMatch[1]?.trim();
      if (ref) refs.push(ref);
    }
    while ((pathMatch = standaloneFilePattern.exec(line)) !== null) {
      const ref = pathMatch[1]?.trim();
      if (ref) refs.push(ref);
    }

    for (const refPath of refs) {
      if (checkedPaths.has(`${i}:${refPath}`)) continue;
      checkedPaths.add(`${i}:${refPath}`);

      if (refPath.startsWith("http") || refPath.startsWith("//")) continue;
      if (refPath.includes("*") || refPath.includes("{")) continue;
      // Skip common non-file-reference patterns (version-like, pure extensions)
      if (/^\d+\.\d+/.test(refPath)) continue;

      // Try relative to context file directory first, then repo root
      const relativePath = contextDir ? `${contextDir}/${refPath}` : refPath;
      const existsRelative = await ctx.fileExists(relativePath);
      const existsRoot = existsRelative || (await ctx.fileExists(refPath));
      if (!existsRelative && !existsRoot) {
        issues.push({
          severity: "warning",
          dimension: "staleness",
          message: `Line ${i + 1} references '${refPath}' which does not exist in repo`,
          line: i + 1,
        });
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

  // Count specific vs vague instructions.
  // Exclude any sentence that matches a VAGUE_PATTERN so that lines like
  // "use proper error handling" are not counted as "specific".
  const normalized = normalizeForComparison(content);
  const sentences = normalized.split(/[.!?\n]+/).filter((s) => s.trim().length > 10);
  const specificCount = sentences.filter(
    (s) =>
      /\b(must|shall|always|never|exactly|require|use|import|export)\b/i.test(s) &&
      !VAGUE_PATTERNS.some((v) => v.pattern.test(s)),
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
  filePath: string,
): { dimension: DimensionScore; issues: AuditIssue[] } {
  const issues: AuditIssue[] = [];
  const covered: string[] = [];

  // Check content for agent-specific references
  for (const [agent, patterns] of Object.entries(AGENT_INDICATORS)) {
    if (patterns.some((p) => p.test(content))) {
      covered.push(agent);
    }
  }

  // Determine format coverage based on the audited file's own name and content only.
  // A vendor-specific file like CLAUDE.md should not receive a cross-agent boost
  // merely because other context files (AGENTS.md, .cursorrules) exist elsewhere.
  const fileFormats = new Set<string>();
  const fileName = filePath.split("/").pop() ?? "";
  if (fileName.includes("AGENTS") || /\bagent/i.test(content)) fileFormats.add("agents-md");
  if (fileName.includes("CLAUDE") || /\bclaude/i.test(content)) fileFormats.add("claude-md");
  if (fileName.includes("cursorrules") || /\bcursor/i.test(content)) fileFormats.add("cursorrules");
  if (fileName.includes("copilot") || /\bcopilot/i.test(content)) fileFormats.add("copilot");
  if (fileName.includes("codex") || /\bcodex/i.test(content)) fileFormats.add("codex");

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
  // Empty / near-empty files are unusable — short-circuit with score 0 and a
  // critical issue instead of running the normal scoring pipeline, which would
  // produce misleadingly high dimension scores (e.g. staleness 100, token 100).
  if (content.trim().length === 0) {
    const zeroDimensions: DimensionScore[] = [
      { id: "redundancy", label: "Redundancy", score: 0, details: "File is empty" },
      { id: "staleness", label: "Staleness", score: 0, details: "File is empty" },
      { id: "clarity", label: "Instruction Clarity", score: 0, details: "File is empty" },
      { id: "front-loading", label: "Front-loading", score: 0, details: "File is empty" },
      {
        id: "negative-instructions",
        label: "Negative Instructions",
        score: 0,
        details: "File is empty",
      },
      { id: "cross-agent", label: "Cross-agent Compatibility", score: 0, details: "File is empty" },
      { id: "token-budget", label: "Token Budget", score: 0, details: "File is empty" },
    ];
    return {
      filePath,
      dimensions: zeroDimensions,
      issues: [
        {
          severity: "critical",
          dimension: "general",
          message: "Context file is empty — no useful instructions for agents",
          fix: "Add agent instructions covering project conventions, build commands, testing patterns, and constraints.",
        },
      ],
      overallScore: 0,
      tokenEstimate: 0,
      redundancy: {
        additionalityPct: 0,
        redundancyPct: 0,
        duplicateLines: [],
        additiveLines: [],
        methodology: "empty-file",
      },
    };
  }

  // Build reference docs for additionality
  const referenceDocs = await buildReferenceDocs(ctx);

  // Include all other discovered context files in the reference corpus so that
  // duplication across agent-context files (e.g. AGENTS.md vs CLAUDE.md) is
  // measured and reported (Bug 3 fix).
  for (const otherFile of contextFiles) {
    if (otherFile === filePath) continue; // exclude self
    if (referenceDocs.some((d) => d.path === otherFile)) continue; // already present
    const otherContent = await ctx.readFile(otherFile);
    if (otherContent) {
      referenceDocs.push({ path: otherFile, content: otherContent });
    }
  }

  const redundancyResult = computeAdditionality(content, filePath, referenceDocs);

  // Score all 7 dimensions
  const redundancyDim = scoreRedundancy(redundancyResult);
  const { dimension: stalenessDim, issues: stalenessIssues } = await scoreStaleness(
    content,
    filePath,
    ctx,
    detection,
  );
  const { dimension: clarityDim, issues: clarityIssues } = scoreClarity(content);
  const frontLoadDim = scoreFrontLoading(content);
  const { dimension: negativeDim, issues: negativeIssues } = scoreNegativeInstructions(content);
  const { dimension: crossAgentDim, issues: crossAgentIssues } = scoreCrossAgent(content, filePath);
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
    if (content != null) {
      const result = await auditContextFile(filePath, content, ctx, detection, contextFiles);
      results.push(result);
    }
  }

  return results;
}
