/**
 * Gap analysis engine (P2.01)
 *
 * Indexes all existing documentation in a repository, then identifies
 * information agents need that is NOT already discoverable through
 * file traversal. Returns a structured gap report with ranked items.
 */

import type { RepoContext } from "../analyzers/analyzer.interface.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";
import {
  REFERENCE_DOC_PATHS,
  REFERENCE_CONFIG_PATHS,
  DYNAMIC_CONFIG_PATTERNS,
  CI_WORKFLOW_PREFIXES,
  SOURCE_EXTENSIONS,
  MAX_SOURCE_FILES_FOR_DOCSTRINGS,
  extractLeadingDocstring,
  normalizeConfigContent,
  type ReferenceDoc,
} from "./additionality.js";

/** Category of information agents need */
export interface InfoCategory {
  /** Unique identifier, e.g., "build-commands" */
  id: string;
  /** Human-readable label */
  label: string;
  /** Importance for front-loading: 1 (lowest) to 10 (highest, should be in first 20%) */
  importance: number;
  /** Patterns that indicate this info is present */
  patterns: RegExp[];
}

/** A single gap — information that is missing or incomplete */
export interface GapItem {
  category: InfoCategory;
  description: string;
  /** Where this info was found (null = missing entirely) */
  foundIn: string[] | null;
  /** Whether the info is adequate (true) or insufficient (false) */
  adequate: boolean;
}

/** An indexed document from the repo */
export interface IndexedDoc {
  path: string;
  type: "text-doc" | "config" | "ci-workflow" | "context-file" | "docstring";
  contentLength: number;
}

/** Result of gap analysis */
export interface GapAnalysisResult {
  /** All documents that were indexed */
  indexed: IndexedDoc[];
  /** Gaps found — info agents need but repo doesn't adequately provide */
  gaps: GapItem[];
  /** Overall coverage percentage (0-100) */
  coverage: number;
  /** Reference documents loaded for additionality comparison */
  referenceDocs: ReferenceDoc[];
}

/** Categories of information agents need, ordered by importance (descending) */
const INFO_CATEGORIES: InfoCategory[] = [
  {
    id: "build-commands",
    label: "Build commands",
    importance: 10,
    patterns: [
      /\b(pnpm|npm|yarn|make|cargo|go|gradle|mvn|dotnet)\s+(install|build|compile)/i,
      /\bbuild\b.*\b(command|script|step|instructions)\b/i,
    ],
  },
  {
    id: "test-commands",
    label: "Test commands",
    importance: 10,
    patterns: [
      /\b(pnpm|npm|yarn|make|cargo|go|pytest|jest|vitest|gradle|mvn)\s+test/i,
      /\btest\b.*\b(command|script|step|instructions)\b/i,
    ],
  },
  {
    id: "constraints",
    label: "Explicit constraints (do NOT / avoid / never)",
    importance: 9,
    patterns: [
      /\bdo\s+not\b/i,
      /\bdon'?t\b/i,
      /\bnever\b/i,
      /\bavoid\b/i,
      /\bforbidden\b/i,
      /\bprohibited\b/i,
    ],
  },
  {
    id: "architecture-overview",
    label: "Architecture overview",
    importance: 8,
    patterns: [
      /##?\s*(architecture|overview|structure|design)/i,
      /\barchitecture\b/i,
      /\bdirectory\s+structure\b/i,
      /\bpackage\s+structure\b/i,
    ],
  },
  {
    id: "env-setup",
    label: "Environment setup / prerequisites",
    importance: 8,
    patterns: [
      /##?\s*(setup|getting started|prerequisites|requirements|installation)/i,
      /\bnode\s+version\b/i,
      /\bpython\s+version\b/i,
      /\benv\b.*\b(var|variable|setup)\b/i,
    ],
  },
  {
    id: "tool-choices",
    label: "Non-default tool choices",
    importance: 7,
    patterns: [
      /\binstead\s+of\b/i,
      /\bwe\s+use\b/i,
      /\bprefer\b/i,
      /\bchosen\b/i,
      /\brather\s+than\b/i,
    ],
  },
  {
    id: "gotchas",
    label: "Environment gotchas / common pitfalls",
    importance: 7,
    patterns: [
      /\bgotcha\b/i,
      /\bpitfall\b/i,
      /\bcommon\s+(mistake|error|issue|problem)\b/i,
      /\bwatch\s+out\b/i,
      /\bnote:\b/i,
      /\bimportant:\b/i,
    ],
  },
  {
    id: "test-patterns",
    label: "Non-obvious test patterns",
    importance: 6,
    patterns: [
      /\btest\s+(pattern|convention|practice|strategy)\b/i,
      /\bmock(ing|s)?\b/i,
      /\bfixture\b/i,
      /\btest\s+isolation\b/i,
    ],
  },
  {
    id: "lint-format",
    label: "Lint / format commands",
    importance: 5,
    patterns: [
      /\b(pnpm|npm|yarn)\s+(lint|format)/i,
      /\beslint\b/i,
      /\bprettier\b/i,
      /\bformatting\b/i,
    ],
  },
  {
    id: "ci-workflow",
    label: "CI/CD workflow description",
    importance: 4,
    patterns: [
      /\bCI\b/i,
      /\bcontinuous\s+integration\b/i,
      /\bpipeline\b/i,
      /\bgithub\s+actions\b/i,
    ],
  },
  {
    id: "code-conventions",
    label: "Code conventions and naming",
    importance: 4,
    patterns: [
      /\bconvention\b/i,
      /\bnaming\b/i,
      /\bcode\s+style\b/i,
      /\bcamelCase\b/i,
      /\bPascalCase\b/i,
      /\bsnake_case\b/i,
    ],
  },
  {
    id: "monorepo-paths",
    label: "Monorepo package-specific instructions",
    importance: 5,
    patterns: [/\bpackages?\//i, /\bworkspace\b/i, /\bmonorepo\b/i],
  },
];

/**
 * Perform gap analysis on a repository.
 *
 * Indexes all existing documentation (README, CONTRIBUTING, configs, CI
 * workflows, docstrings, existing context files), then identifies which
 * categories of agent-relevant information are missing or inadequate.
 */
export async function analyzeGaps(
  context: RepoContext,
  detection?: DetectionResult,
): Promise<GapAnalysisResult> {
  const indexed: IndexedDoc[] = [];
  const referenceDocs: ReferenceDoc[] = [];

  // --- Index text documentation ---
  for (const docPath of REFERENCE_DOC_PATHS) {
    const content = await context.readFile(docPath);
    if (content !== null) {
      indexed.push({ path: docPath, type: "text-doc", contentLength: content.length });
      referenceDocs.push({ path: docPath, content });
    }
  }

  // --- Index config files ---
  for (const cfgPath of REFERENCE_CONFIG_PATHS) {
    const content = await context.readFile(cfgPath);
    if (content !== null) {
      const normalized = normalizeConfigContent(content, cfgPath);
      indexed.push({ path: cfgPath, type: "config", contentLength: content.length });
      referenceDocs.push({ path: cfgPath, content: normalized });
    }
  }

  // --- Index dynamic config files ---
  for (const file of context.files) {
    const basename = file.split("/").pop() ?? "";
    if (DYNAMIC_CONFIG_PATTERNS.some((p) => p.test(basename))) {
      // Skip if already indexed via static paths
      if (referenceDocs.some((d) => d.path === file)) continue;
      const content = await context.readFile(file);
      if (content !== null) {
        const normalized = normalizeConfigContent(content, file);
        indexed.push({ path: file, type: "config", contentLength: content.length });
        referenceDocs.push({ path: file, content: normalized });
      }
    }
  }

  // --- Index CI workflows ---
  for (const file of context.files) {
    if (CI_WORKFLOW_PREFIXES.some((p) => file.startsWith(p))) {
      const content = await context.readFile(file);
      if (content !== null) {
        indexed.push({ path: file, type: "ci-workflow", contentLength: content.length });
        referenceDocs.push({ path: file, content });
      }
    }
  }

  // --- Index existing context files ---
  const CONTEXT_FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursorrules",
    ".cursor/rules",
    ".github/copilot-instructions.md",
    ".aider.conf.yml",
    ".aiderignore",
    ".agentignore",
  ];
  for (const cf of CONTEXT_FILES) {
    const content = await context.readFile(cf);
    if (content !== null) {
      indexed.push({ path: cf, type: "context-file", contentLength: content.length });
      // Context files are also reference docs (for cross-context-file deduplication)
      referenceDocs.push({ path: cf, content });
    }
  }

  // --- Index source-file leading docstrings ---
  let sourceCount = 0;
  for (const file of context.files) {
    if (sourceCount >= MAX_SOURCE_FILES_FOR_DOCSTRINGS) break;
    if (!SOURCE_EXTENSIONS.some((ext) => file.endsWith(ext))) continue;
    sourceCount++;
    const content = await context.readFile(file);
    if (content !== null) {
      const docstring = extractLeadingDocstring(content);
      if (docstring && docstring.length > 20) {
        indexed.push({ path: file, type: "docstring", contentLength: docstring.length });
        referenceDocs.push({ path: file, content: docstring });
      }
    }
  }

  // --- Compute gaps ---
  // Combine all indexed content for pattern matching
  const allContent = referenceDocs.map((d) => d.content).join("\n\n");

  const gaps: GapItem[] = [];
  let categoriesMet = 0;

  for (const category of INFO_CATEGORIES) {
    // Skip monorepo-paths check if not a monorepo
    if (category.id === "monorepo-paths" && !detection?.monorepo) continue;

    const matchingDocs: string[] = [];
    for (const doc of referenceDocs) {
      if (category.patterns.some((p) => p.test(doc.content))) {
        matchingDocs.push(doc.path);
      }
    }

    const adequate = matchingDocs.length > 0;
    if (adequate) categoriesMet++;

    // Only report gaps (not adequately covered)
    if (!adequate) {
      gaps.push({
        category,
        description: `No ${category.label.toLowerCase()} found in repository documentation`,
        foundIn: null,
        adequate: false,
      });
    }
  }

  // Also check for info that exists but only in hard-to-find places
  // (not in README or context files)
  const easyAccessDocs = referenceDocs.filter(
    (d) =>
      d.path === "README.md" ||
      d.path === "AGENTS.md" ||
      d.path === "CLAUDE.md" ||
      d.path === "CONTRIBUTING.md",
  );
  const easyContent = easyAccessDocs.map((d) => d.content).join("\n\n");

  for (const category of INFO_CATEGORIES) {
    if (category.id === "monorepo-paths" && !detection?.monorepo) continue;

    const inEasyAccess = category.patterns.some((p) => p.test(easyContent));
    const inAllContent = category.patterns.some((p) => p.test(allContent));

    // Info exists but only in non-obvious places (configs, CI, docstrings)
    if (!inEasyAccess && inAllContent) {
      const deepDocs = referenceDocs
        .filter((d) => category.patterns.some((p) => p.test(d.content)))
        .map((d) => d.path);

      // Only add if not already reported as a full gap
      if (!gaps.some((g) => g.category.id === category.id)) {
        gaps.push({
          category,
          description: `${category.label} found only in non-obvious locations: ${deepDocs.join(", ")}`,
          foundIn: deepDocs,
          adequate: false,
        });
      }
    }
  }

  // Recompute categoriesMet: exclude categories that ended up as gaps (inadequate)
  // This ensures coverage is consistent with the gaps array
  const gapCategoryIds = new Set(gaps.map((g) => g.category.id));
  const adjustedCategoriesMet =
    categoriesMet -
    [...gapCategoryIds].filter((id) => {
      // Only subtract categories that were initially counted as met
      // (i.e., found in reference docs but only in deep locations)
      const gap = gaps.find((g) => g.category.id === id);
      return gap && gap.foundIn !== null; // foundIn !== null means it was found somewhere (deep)
    }).length;

  const activeCategoryCount = INFO_CATEGORIES.filter(
    (c) => c.id !== "monorepo-paths" || detection?.monorepo,
  ).length;
  const coverage =
    activeCategoryCount > 0 ? Math.round((adjustedCategoriesMet / activeCategoryCount) * 100) : 100;

  // Sort gaps by importance (highest first)
  gaps.sort((a, b) => b.category.importance - a.category.importance);

  return { indexed, gaps, coverage, referenceDocs };
}
