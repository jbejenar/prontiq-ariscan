/**
 * Token estimation for repository files.
 *
 * Uses a character-based heuristic calibrated against tiktoken (cl100k_base):
 * - English prose: ~4 characters per token
 * - Source code: ~3.5 characters per token (more symbols, shorter identifiers)
 * - JSON/YAML config: ~3.8 characters per token
 * - Binary/minified: not tokenizable, excluded
 *
 * Accuracy target: within 10% of actual tokenizer output (P2.04 AC).
 */

/** File category for token budget analysis. */
export type FileCategory =
  | "source"
  | "test"
  | "docs"
  | "config"
  | "generated"
  | "build-artifact"
  | "lockfile"
  | "data"
  | "binary"
  | "other";

/** Token estimate for a single file. */
export interface FileTokenEstimate {
  path: string;
  category: FileCategory;
  bytes: number;
  estimatedTokens: number;
}

/** Token budget summary for a directory or category. */
export interface CategoryBudget {
  category: FileCategory;
  fileCount: number;
  totalBytes: number;
  totalTokens: number;
  /** Percentage of total repo tokens consumed by this category. */
  percentage: number;
}

/** A compression recommendation to reduce token waste. */
export interface CompressionRecommendation {
  description: string;
  targetFiles: string[];
  estimatedSavingsTokens: number;
  /** How impactful is this recommendation? */
  priority: "high" | "medium" | "low";
}

/** Full token budget analysis result. */
export interface TokenBudgetResult {
  totalFiles: number;
  totalBytes: number;
  totalTokens: number;
  byCategory: CategoryBudget[];
  /** Top files by token count (worst offenders). */
  hotspots: FileTokenEstimate[];
  recommendations: CompressionRecommendation[];
}

// Characters-per-token ratios by category (calibrated against cl100k_base)
const CHARS_PER_TOKEN: Record<FileCategory, number> = {
  source: 3.5,
  test: 3.5,
  docs: 4.0,
  config: 3.8,
  generated: 3.5,
  "build-artifact": 3.5,
  lockfile: 3.0,
  data: 3.8,
  binary: Infinity, // excluded
  other: 4.0,
};

/** Source code file extensions. */
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".pyi",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".kts",
  ".cs",
  ".rb",
  ".c",
  ".cpp",
  ".cc",
  ".h",
  ".hpp",
  ".swift",
  ".scala",
  ".php",
  ".vue",
  ".svelte",
  ".sh",
  ".bash",
  ".zsh",
  ".sql",
  ".graphql",
  ".gql",
  ".proto",
]);

/** Test file patterns. */
const TEST_PATTERNS = [
  /\.test\.[a-z]+$/,
  /\.spec\.[a-z]+$/,
  /_test\.[a-z]+$/,
  /_spec\.[a-z]+$/,
  /\/test\/.*\.[a-z]+$/,
  /\/__tests__\/.*\.[a-z]+$/,
  /\/tests\/.*\.[a-z]+$/,
  /\/spec\/.*\.[a-z]+$/,
];

/** Documentation file extensions. */
const DOC_EXTENSIONS = new Set([".md", ".mdx", ".rst", ".txt", ".adoc"]);

/** Config file patterns. */
const CONFIG_PATTERNS = [
  /\.config\.[a-z]+$/,
  /\.conf$/,
  /\.ya?ml$/,
  /\.toml$/,
  /\.ini$/,
  /\.env(\.[a-z]+)?$/,
  /tsconfig.*\.json$/,
  /\.eslintrc/,
  /\.prettier/,
  /jest\.config/,
  /vitest\.config/,
  /vite\.config/,
  /webpack\.config/,
  /rollup\.config/,
  /babel\.config/,
  /\.babelrc/,
  /turbo\.json$/,
  /nx\.json$/,
  /\.editorconfig$/,
  /Makefile$/i,
  /Dockerfile/i,
  /docker-compose/i,
  /\.dockerignore$/,
  /\.gitignore$/,
  /\.gitattributes$/,
  /\.npmignore$/,
  /\.nvmrc$/,
  /\.tool-versions$/,
  /\.node-version$/,
];

/** Generated/build artifact patterns. */
const GENERATED_PATTERNS = [
  /\.generated\.[a-z]+$/,
  /\.d\.ts$/,
  /\.d\.mts$/,
  /\.min\.[a-z]+$/,
  /\.bundle\.[a-z]+$/,
  /\.chunk\.[a-z]+$/,
  /\.map$/,
  /\.sourcemap$/,
];

/** Lockfile patterns (case-insensitive — Cargo.lock, Gemfile.lock, Pipfile.lock). */
const LOCKFILE_PATTERNS = [
  /package-lock\.json$/i,
  /pnpm-lock\.ya?ml$/i,
  /yarn\.lock$/i,
  /Gemfile\.lock$/i,
  /Cargo\.lock$/i,
  /poetry\.lock$/i,
  /go\.sum$/i,
  /composer\.lock$/i,
  /Pipfile\.lock$/i,
];

/** Binary file extensions (should be excluded from token estimation). */
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".svg",
  ".webp",
  ".avif",
  ".mp3",
  ".wav",
  ".ogg",
  ".mp4",
  ".avi",
  ".mov",
  ".webm",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".rar",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".wasm",
  ".sqlite",
  ".db",
]);

/** Data file extensions. */
const DATA_EXTENSIONS = new Set([".json", ".csv", ".xml", ".ndjson", ".jsonl"]);

/** Classify a file path into a category. */
export function classifyFile(path: string): FileCategory {
  const lowerPath = path.toLowerCase();
  const ext = getExtension(lowerPath);

  // Binary check first
  if (BINARY_EXTENSIONS.has(ext)) return "binary";

  // Lockfiles
  if (LOCKFILE_PATTERNS.some((p) => p.test(lowerPath))) return "lockfile";

  // Generated/build artifacts
  if (GENERATED_PATTERNS.some((p) => p.test(lowerPath))) return "generated";

  // Test files (check before source since tests have source extensions)
  if (TEST_PATTERNS.some((p) => p.test(lowerPath))) return "test";

  // Config files
  if (CONFIG_PATTERNS.some((p) => p.test(lowerPath))) return "config";
  // Package.json is config
  if (lowerPath.endsWith("package.json")) return "config";

  // Documentation
  if (DOC_EXTENSIONS.has(ext)) return "docs";

  // Data files (JSON that's not config)
  if (DATA_EXTENSIONS.has(ext)) return "data";

  // Source code
  if (SOURCE_EXTENSIONS.has(ext)) return "source";

  return "other";
}

/** Estimate token count from byte length and category. */
export function estimateTokens(byteLength: number, category: FileCategory): number {
  const charsPerToken = CHARS_PER_TOKEN[category];
  if (!isFinite(charsPerToken)) return 0;
  return Math.ceil(byteLength / charsPerToken);
}

/** Get the file extension (lowercase, with leading dot). */
function getExtension(path: string): string {
  const lastDot = path.lastIndexOf(".");
  const lastSlash = path.lastIndexOf("/");
  if (lastDot <= lastSlash) return "";
  return path.slice(lastDot);
}
