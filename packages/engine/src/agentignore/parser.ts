/**
 * .agentignore parser (P2.05)
 *
 * Parses .agentignore files using .gitignore-compatible syntax:
 * - Glob patterns to exclude files from agent context
 * - # comments
 * - ! negation patterns
 * - Empty lines ignored
 * - Trailing slashes indicate directories
 * - # @category: <name> annotations (RFC-0002)
 */

/** Well-known .agentignore categories per RFC-0002. */
export type AgentignoreCategory =
  | "generated"
  | "data"
  | "binary"
  | "vendor"
  | "sensitive"
  | (string & Record<never, never>);

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
  /** Category from the nearest preceding `# @category:` annotation. */
  category?: AgentignoreCategory;
}

/** Parsed .agentignore file. */
export interface AgentignoreFile {
  rules: AgentignoreRule[];
  /** Number of comment lines. */
  comments: number;
  /** Number of blank lines. */
  blanks: number;
  /** Count of rules per category. */
  categories: Map<string, number>;
}

/** Regex for `# @category: <name>` annotations. */
const CATEGORY_RE = /^#\s*@category:\s*(\S+)/;

/**
 * Parse a .agentignore file content into structured rules.
 */
export function parseAgentignore(content: string): AgentignoreFile {
  const lines = content.split("\n");
  const rules: AgentignoreRule[] = [];
  const categories = new Map<string, number>();
  let comments = 0;
  let blanks = 0;
  let currentCategory: AgentignoreCategory | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Skip empty lines
    if (line.length === 0) {
      blanks++;
      continue;
    }

    // Check for category annotation before counting as comment
    if (line.startsWith("#")) {
      const categoryMatch = CATEGORY_RE.exec(line);
      if (categoryMatch) {
        currentCategory = categoryMatch[1] as AgentignoreCategory;
      }
      comments++;
      continue;
    }

    // Parse negation
    const negated = line.startsWith("!");
    const stripped = negated ? line.slice(1) : line;

    // Parse directory-only marker
    const directoryOnly = stripped.endsWith("/");
    const normalizedPattern = directoryOnly ? stripped.slice(0, -1) : stripped;

    const rule: AgentignoreRule = {
      pattern: line,
      negated,
      directoryOnly,
      normalizedPattern,
    };

    if (currentCategory) {
      rule.category = currentCategory;
      categories.set(currentCategory, (categories.get(currentCategory) ?? 0) + 1);
    }

    rules.push(rule);
  }

  return { rules, comments, blanks, categories };
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

/** Default .agentignore patterns by language ecosystem (RFC-0002 categorized). */
export function getDefaultPatterns(primaryLanguage?: string): string[] {
  const universal = [
    "# @category: generated",
    "dist/",
    "build/",
    ".next/",
    ".nuxt/",
    "out/",
    ".turbo/",
    "*.generated.*",
    "*.min.js",
    "*.min.css",
    "*.map",
    "*.d.ts",
    "*.tsbuildinfo",
    "",
    "# @category: vendor",
    "node_modules/",
    "vendor/",
    ".venv/",
    "__pycache__/",
    "third_party/",
    "",
    "# @category: data",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "Cargo.lock",
    "go.sum",
    "poetry.lock",
    "composer.lock",
    "**/fixtures/**",
    "**/__snapshots__/**",
    "**/testdata/**",
    "",
    "# @category: binary",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.svg",
    "*.ico",
    "*.woff",
    "*.woff2",
    "*.ttf",
    "*.eot",
    "",
    "# @category: sensitive",
    ".env*",
    "**/credentials/**",
    "**/secrets/**",
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
    typescript: ["", "# TypeScript / JavaScript", "storybook-static/", ".cache/", ".parcel-cache/"],
    javascript: ["", "# JavaScript", "storybook-static/", ".cache/", ".parcel-cache/"],
    python: [
      "",
      "# Python",
      "*.pyc",
      "*.pyo",
      "*.egg-info/",
      "*.whl",
      ".eggs/",
      ".tox/",
      ".mypy_cache/",
      ".ruff_cache/",
      ".pytest_cache/",
    ],
    go: ["", "# Go", "*.test"],
    rust: ["", "# Rust", "target/", "*.rlib"],
    java: ["", "# Java", "*.class", "*.jar", "*.war", "*.ear", "target/", ".gradle/", ".mvn/"],
    "c#": ["", "# C# / .NET", "bin/", "obj/", "*.dll", "*.nupkg", ".vs/"],
    ruby: ["", "# Ruby", "*.gem", ".bundle/"],
  };

  const specific = primaryLanguage ? (languageSpecific[primaryLanguage] ?? []) : [];
  return [...universal, ...specific];
}
