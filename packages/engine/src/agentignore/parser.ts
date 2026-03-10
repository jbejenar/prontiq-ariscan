/**
 * .agentignore parser (P2.05)
 *
 * Parses .agentignore files using .gitignore-compatible syntax:
 * - Glob patterns to exclude files from agent context
 * - # comments
 * - ! negation patterns
 * - Empty lines ignored
 * - Trailing slashes indicate directories
 */

/** A parsed .agentignore rule. */
export interface AgentignoreRule {
  /** The original pattern string. */
  pattern: string;
  /** Whether this is a negation rule (starts with !). */
  negated: boolean;
  /** Whether this pattern targets directories only (trailing /). */
  directoryOnly: boolean;
  /** The normalized pattern (without leading ! and trailing /). */
  normalizedPattern: string;
}

/** Parsed .agentignore file. */
export interface AgentignoreFile {
  rules: AgentignoreRule[];
  /** Number of comment lines. */
  comments: number;
  /** Number of blank lines. */
  blanks: number;
}

/**
 * Parse a .agentignore file content into structured rules.
 */
export function parseAgentignore(content: string): AgentignoreFile {
  const lines = content.split("\n");
  const rules: AgentignoreRule[] = [];
  let comments = 0;
  let blanks = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Skip empty lines
    if (line.length === 0) {
      blanks++;
      continue;
    }

    // Skip comments
    if (line.startsWith("#")) {
      comments++;
      continue;
    }

    // Parse negation
    const negated = line.startsWith("!");
    const stripped = negated ? line.slice(1) : line;

    // Parse directory-only marker
    const directoryOnly = stripped.endsWith("/");
    const normalizedPattern = directoryOnly ? stripped.slice(0, -1) : stripped;

    rules.push({
      pattern: line,
      negated,
      directoryOnly,
      normalizedPattern,
    });
  }

  return { rules, comments, blanks };
}

/**
 * Test if a file path matches a .agentignore pattern.
 * Uses gitignore-compatible matching logic.
 */
export function matchesPattern(filePath: string, pattern: string): boolean {
  // Normalize: remove trailing /
  const cleanPattern = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;

  // Convert gitignore pattern to regex
  const regexStr = gitignorePatternToRegex(cleanPattern);
  const regex = new RegExp(regexStr);
  return regex.test(filePath);
}

/**
 * Test if a file path should be ignored based on all rules.
 * Later rules override earlier rules (negation support).
 */
export function shouldIgnore(filePath: string, rules: AgentignoreRule[]): boolean {
  let ignored = false;

  for (const rule of rules) {
    if (matchesPattern(filePath, rule.normalizedPattern)) {
      ignored = !rule.negated;
    }
  }

  return ignored;
}

/** Convert a gitignore-style pattern to a regex string. */
function gitignorePatternToRegex(pattern: string): string {
  let regex = "";

  // If pattern doesn't contain /, it matches against the filename only
  const matchFullPath = pattern.includes("/");

  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "*" && pattern[i + 1] === "*") {
      // ** matches any number of directories
      if (pattern[i + 2] === "/") {
        regex += "(?:.+/)?";
        i += 3;
      } else {
        regex += ".*";
        i += 2;
      }
    } else if (ch === "*") {
      // * matches anything except /
      regex += "[^/]*";
      i++;
    } else if (ch === "?") {
      regex += "[^/]";
      i++;
    } else if (ch === ".") {
      regex += "\\.";
      i++;
    } else if (ch === "{") {
      regex += "(";
      i++;
    } else if (ch === "}") {
      regex += ")";
      i++;
    } else if (ch === ",") {
      regex += "|";
      i++;
    } else {
      regex += ch;
      i++;
    }
  }

  if (matchFullPath) {
    // Pattern with / matches from root
    return `^${regex}(?:/.*)?$`;
  } else {
    // Pattern without / matches against basename or full path
    return `(?:^|/)${regex}(?:/.*)?$`;
  }
}

/** Default .agentignore patterns by language ecosystem. */
export function getDefaultPatterns(primaryLanguage?: string): string[] {
  const universal = [
    "# Build artifacts",
    "dist/",
    "build/",
    ".next/",
    "out/",
    ".turbo/",
    "",
    "# Dependencies",
    "node_modules/",
    "vendor/",
    ".venv/",
    "__pycache__/",
    "",
    "# Lockfiles",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "Cargo.lock",
    "go.sum",
    "poetry.lock",
    "composer.lock",
    "",
    "# Generated files",
    "*.generated.*",
    "*.min.js",
    "*.min.css",
    "*.map",
    "*.d.ts",
    "",
    "# Coverage & reports",
    "coverage/",
    ".nyc_output/",
    "htmlcov/",
    "",
    "# IDE & editor",
    ".idea/",
    "*.swp",
    "*.swo",
  ];

  const languageSpecific: Record<string, string[]> = {
    python: ["", "# Python", "*.pyc", "*.egg-info/", ".tox/", ".mypy_cache/", ".pytest_cache/"],
    go: ["", "# Go", "*.test"],
    rust: ["", "# Rust", "target/"],
    java: ["", "# Java", "*.class", "target/", ".gradle/", "*.jar"],
    "c#": ["", "# C#", "bin/", "obj/", "*.dll"],
    ruby: ["", "# Ruby", "*.gem", ".bundle/"],
  };

  const specific = primaryLanguage ? (languageSpecific[primaryLanguage] ?? []) : [];
  return [...universal, ...specific];
}
