/**
 * Additionality computation — shared by both the P1 context-quality analyzer
 * and the P2 context generator.
 *
 * Measures how much of a context file's content is novel (additive) vs
 * duplicated from existing repo documentation.
 */

/** Result of additionality analysis for a single context file */
export interface AdditionalityResult {
  redundancyPct: number; // 0-100, one decimal (-1 if indeterminate)
  additionalityPct: number; // 0-100, one decimal (-1 if indeterminate)
  duplicateLines: Array<{ line: number; text: string; matchedIn: string }>;
  additiveLines: Array<{ line: number; text: string }>;
  methodology: string;
}

/** Reference document used for comparison */
export interface ReferenceDoc {
  path: string;
  content: string;
}

/** Well-known reference document paths for additionality comparison */
export const REFERENCE_DOC_PATHS = [
  "README.md",
  "CONTRIBUTING.md",
  "CONTRIBUTING",
  "docs/README.md",
] as const;

/** Config files to include in reference corpus */
export const REFERENCE_CONFIG_PATHS = [
  "tsconfig.json",
  "Makefile",
  "Dockerfile",
  "Cargo.toml",
  "pyproject.toml",
  "setup.cfg",
  "Gemfile",
  "go.mod",
] as const;

/** Dynamic config patterns discovered from file list */
export const DYNAMIC_CONFIG_PATTERNS: RegExp[] = [
  /^turbo\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^\.ariscan\.yml$/,
  /^vitest\.config\.[a-z]+$/,
  /^vitest\.workspace\.[a-z]+$/,
  /^jest\.config\.[a-z]+$/,
  /^webpack\.config\.[a-z]+$/,
  /^rollup\.config\.[a-z]+$/,
  /^vite\.config\.[a-z]+$/,
  /^babel\.config\.[a-z]+$/,
  /^\.babelrc$/,
  /^tsconfig\.[a-z.]+\.json$/,
  /^docker-compose\.ya?ml$/,
  /^\.dockerignore$/,
  /^\.nvmrc$/,
  /^\.node-version$/,
  /^\.tool-versions$/,
  /^\.editorconfig$/,
  /^biome\.json$/,
  /^deno\.json[c]?$/,
  /^nx\.json$/,
  /^lerna\.json$/,
  /^rush\.json$/,
];

/** Common source-file extensions for docstring extraction */
export const SOURCE_EXTENSIONS = [".ts", ".js", ".py", ".go", ".rs", ".java", ".rb"] as const;

/** Maximum source files scanned for leading docstrings */
export const MAX_SOURCE_FILES_FOR_DOCSTRINGS = 200;

/** CI workflow glob prefixes to gather reference content */
export const CI_WORKFLOW_PREFIXES = [".github/workflows/", ".gitlab-ci"] as const;

/**
 * Flatten a JSON value into plain text lines grouped by top-level key.
 */
function flattenJsonToText(val: unknown): string[] {
  if (val === null || val === undefined) return [];
  if (typeof val !== "object" || Array.isArray(val)) return [String(val)];
  const lines: string[] = [];
  for (const [topKey, topVal] of Object.entries(val as Record<string, unknown>)) {
    const leaves: string[] = [];
    collectLeaves(topVal, leaves);
    lines.push(`${topKey} ${leaves.join(" ")}`);
  }
  return lines;
}

/** Recursively collect leaf key-value pairs as "key value" tokens. */
function collectLeaves(val: unknown, out: string[]): void {
  if (val === null || val === undefined) return;
  if (typeof val !== "object") {
    out.push(String(val));
    return;
  }
  if (Array.isArray(val)) {
    for (const item of val) collectLeaves(item, out);
    return;
  }
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (typeof v === "object" && v !== null) {
      out.push(k);
      collectLeaves(v, out);
    } else {
      out.push(`${k} ${String(v)}`);
    }
  }
}

/**
 * Normalize config file content into comparable plain text.
 */
export function normalizeConfigContent(content: string, path: string): string {
  if (path.endsWith(".json")) {
    try {
      const parsed: unknown = JSON.parse(content);
      const lines = flattenJsonToText(parsed);
      return lines.length > 0 ? lines.join("\n") : content;
    } catch {
      // Fall through to generic stripping
    }
  }
  return content
    .replace(/[{}[\]"',;()<>]/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

/**
 * Strip HTML tags and comments from text.
 */
function stripHtmlTags(text: string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "<") {
      const close = text.indexOf(">", i + 1);
      if (close !== -1) {
        result += " ";
        i = close + 1;
      } else {
        i++;
      }
    } else {
      result += text[i];
      i++;
    }
  }
  return result;
}

/**
 * Strip markdown formatting to extract plain text for comparison.
 */
export function normalizeForComparison(text: string): string {
  let normalized = text
    .replace(/```[^\n]*\n?/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
    .replace(/\*+/g, "")
    .replace(/_+/g, "");

  normalized = stripHtmlTags(normalized);

  return normalized
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

/**
 * Extract the leading comment/docstring block from a source file.
 */
export function extractLeadingDocstring(content: string): string | null {
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (line.trim() !== "" && !line.startsWith("#!")) break;
    i++;
  }
  if (i >= lines.length) return null;

  const firstLine = (lines[i] as string).trimStart();

  if (firstLine.startsWith("/**") || firstLine.startsWith("/*")) {
    const blockLines: string[] = [];
    const startIdx = i;
    for (; i < lines.length; i++) {
      const line = lines[i] as string;
      blockLines.push(line);
      if (line.includes("*/") && i > startIdx) break;
      if (i === startIdx && line.trimEnd().endsWith("*/")) break;
    }
    return blockLines.join("\n");
  }
  if (firstLine.startsWith('"""') || firstLine.startsWith("'''")) {
    const delim = firstLine.slice(0, 3);
    const currentLine = lines[i] as string;
    const blockLines: string[] = [currentLine];
    if (firstLine.indexOf(delim, 3) > 3) return firstLine;
    for (i++; i < lines.length; i++) {
      const line = lines[i] as string;
      blockLines.push(line);
      if (line.includes(delim)) break;
    }
    return blockLines.join("\n");
  }
  const commentPrefixes = ["//", "#", "--"];
  const prefix = commentPrefixes.find((p) => firstLine.startsWith(p));
  if (prefix) {
    const commentLines: string[] = [];
    for (; i < lines.length; i++) {
      const line = lines[i] as string;
      if (line.trimStart().startsWith(prefix)) {
        commentLines.push(line);
      } else {
        break;
      }
    }
    if (commentLines.length >= 2) return commentLines.join("\n");
  }
  return null;
}

/**
 * Detect whether a segment looks like a CLI command or config line.
 */
export function isCommandLike(segment: string): boolean {
  const trimmed = segment.trim();
  const words = trimmed.split(/\s+/);
  if (words.length < 2) return false;

  const first = words[0] ?? "";
  if (/^[a-zA-Z][a-zA-Z0-9_.-]*[:=]$/.test(first) || /^[a-zA-Z][a-zA-Z0-9_.-]*=/.test(first)) {
    return true;
  }
  if (/^[a-zA-Z][a-zA-Z0-9_.-]*=.+/.test(trimmed) && words.length <= 4) {
    return true;
  }

  if (/^\.{0,2}\//.test(first) || /^[a-zA-Z][a-zA-Z0-9._-]*\//.test(first)) {
    return true;
  }

  if (!/^[a-z][a-z0-9._-]*$/i.test(first)) return false;
  const PROSE_STARTERS = new Set([
    "the",
    "this",
    "that",
    "these",
    "those",
    "a",
    "an",
    "it",
    "its",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "if",
    "for",
    "but",
    "and",
    "or",
    "so",
    "we",
    "our",
    "you",
    "your",
    "can",
    "will",
    "may",
    "has",
    "have",
    "had",
    "do",
    "does",
    "did",
    "not",
    "no",
    "all",
    "each",
    "every",
    "some",
    "any",
    "when",
    "where",
    "how",
    "what",
    "which",
    "who",
  ]);
  if (PROSE_STARTERS.has(first.toLowerCase())) return false;

  const rest = words.slice(1);
  const hasFlag = rest.some((w) => /^-{1,2}[a-zA-Z]/.test(w));
  const hasPath = rest.some((w) => /[/.\\]/.test(w));
  if (hasFlag || hasPath) return true;

  if (words.length <= 4 && trimmed === trimmed.toLowerCase() && !/[,;!?]/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Split text into meaningful sentences/segments for comparison.
 */
export function splitSegments(text: string): string[] {
  const raw: string[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split(/\.(?:\s|$)/).map((s) => s.trim());
    for (const part of parts) {
      if (part.length > 0) raw.push(part);
    }
  }
  return raw.filter((s) => {
    const wordCount = s.split(/\s+/).length;
    if (isCommandLike(s)) return wordCount >= 2;
    return wordCount >= 5;
  });
}

/**
 * Compute Jaccard similarity between two word sets.
 * Returns value 0-1.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Compute additionality for a context file against reference documents.
 * Uses sentence-level Jaccard similarity to identify duplicated content.
 */
export function computeAdditionality(
  contextContent: string,
  contextPath: string,
  referenceDocs: ReferenceDoc[],
): AdditionalityResult {
  const normalizedContext = normalizeForComparison(contextContent);
  const contextSegments = splitSegments(normalizedContext);

  const refSegments: Array<{ segment: string; path: string }> = [];
  for (const doc of referenceDocs) {
    const normalized = normalizeForComparison(doc.content);
    for (const seg of splitSegments(normalized)) {
      refSegments.push({ segment: seg, path: doc.path });
    }
  }

  const lines = contextContent.split("\n");
  const duplicateLines: AdditionalityResult["duplicateLines"] = [];
  const additiveLines: AdditionalityResult["additiveLines"] = [];

  let matchedSegments = 0;
  const totalSegments = contextSegments.length;

  const SIMILARITY_THRESHOLD = 0.6;

  for (const segment of contextSegments) {
    let bestMatch = 0;
    let bestMatchPath = "";
    for (const ref of refSegments) {
      const sim = jaccardSimilarity(segment, ref.segment);
      if (sim > bestMatch) {
        bestMatch = sim;
        bestMatchPath = ref.path;
      }
    }
    if (bestMatch >= SIMILARITY_THRESHOLD) {
      matchedSegments++;
      let bestLineScore = 0;
      let bestLineIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const normalizedLine = line
          .toLowerCase()
          .replace(/[-#*_`()[\].:>]/g, "")
          .trim();
        const lineWordCount = normalizedLine.split(/\s+/).length;
        const minWords = isCommandLike(normalizedLine) ? 2 : 3;
        if (lineWordCount < minWords) continue;
        const sim = jaccardSimilarity(segment, normalizedLine);
        if (sim > bestLineScore) {
          bestLineScore = sim;
          bestLineIdx = i;
        }
      }
      if (bestLineIdx >= 0 && bestLineScore >= 0.4) {
        if (!duplicateLines.some((d) => d.line === bestLineIdx + 1)) {
          duplicateLines.push({
            line: bestLineIdx + 1,
            text: (lines[bestLineIdx] ?? "").trim(),
            matchedIn: bestMatchPath,
          });
        }
      }
    }
  }

  const dupLineNums = new Set(duplicateLines.map((d) => d.line));
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? "").trim();
    if (trimmed.length >= 10 && !dupLineNums.has(i + 1)) {
      if (!/^(#{1,6}\s*$|```|---|\*\*\*|___|\|)/.test(trimmed)) {
        additiveLines.push({ line: i + 1, text: trimmed });
      }
    }
  }

  const redundancyPct =
    totalSegments > 0 ? Math.round((matchedSegments / totalSegments) * 1000) / 10 : -1;
  const additionalityPct = redundancyPct >= 0 ? Math.round((100 - redundancyPct) * 10) / 10 : -1;

  const methodology = [
    `Sentence-level Jaccard similarity (threshold ≥ ${SIMILARITY_THRESHOLD}).`,
    `Compared ${totalSegments} segments from ${contextPath}`,
    `against ${refSegments.length} segments from ${referenceDocs.map((d) => d.path).join(", ")}.`,
    `${matchedSegments}/${totalSegments} segments matched as duplicative.`,
  ].join(" ");

  return { redundancyPct, additionalityPct, duplicateLines, additiveLines, methodology };
}

/** Keywords that indicate critical build/test/architecture info */
export const CRITICAL_INFO_PATTERNS = [
  /\b(pnpm|npm|yarn|make|cargo|go)\s+(install|build|test|run)/i,
  /\b(build|test|lint|format|typecheck)\s*(command|script|step)/i,
  /```\s*(bash|sh|shell|zsh)/i,
  /##\s*(architecture|overview|structure|getting started|setup|build|test)/i,
];

/**
 * Check if critical information is front-loaded in the first 20% of a file.
 * Returns true if critical info is found only in the bottom 80%.
 */
export function hasBuriedCriticalInfo(content: string): boolean {
  const lines = content.split("\n");
  const cutoff = Math.max(1, Math.ceil(lines.length * 0.2));
  const topSection = lines.slice(0, cutoff).join("\n");
  const bottomSection = lines.slice(cutoff).join("\n");

  const topHasCritical = CRITICAL_INFO_PATTERNS.some((p) => p.test(topSection));
  const bottomHasCritical = CRITICAL_INFO_PATTERNS.some((p) => p.test(bottomSection));

  return !topHasCritical && bottomHasCritical;
}

/**
 * Compute front-loading score (0-100).
 * 100 = all critical info in first 20%, 0 = all critical info buried.
 */
export function computeFrontLoadScore(content: string): number {
  const lines = content.split("\n");
  const cutoff = Math.max(1, Math.ceil(lines.length * 0.2));
  const topSection = lines.slice(0, cutoff).join("\n");

  let topMatches = 0;
  let totalMatches = 0;

  for (const pattern of CRITICAL_INFO_PATTERNS) {
    const topHits = topSection.match(new RegExp(pattern.source, pattern.flags + "g"));
    const allHits = content.match(new RegExp(pattern.source, pattern.flags + "g"));
    topMatches += topHits?.length ?? 0;
    totalMatches += allHits?.length ?? 0;
  }

  if (totalMatches === 0) return 100; // No critical info to front-load
  return Math.round((topMatches / totalMatches) * 100);
}
