import { describe, it, expect } from "vitest";
import {
  parseAgentignore,
  matchesPattern,
  shouldIgnore,
  getDefaultPatterns,
} from "../../agentignore/parser.js";

describe("parseAgentignore", () => {
  it("parses simple patterns", () => {
    const result = parseAgentignore("dist/\nnode_modules/\n*.min.js");
    expect(result.rules.length).toBe(3);
    expect(result.rules[0]?.pattern).toBe("dist/");
    expect(result.rules[0]?.directoryOnly).toBe(true);
    expect(result.rules[2]?.pattern).toBe("*.min.js");
    expect(result.rules[2]?.directoryOnly).toBe(false);
  });

  it("skips comments and blank lines", () => {
    const result = parseAgentignore("# Build output\ndist/\n\n# Deps\nnode_modules/");
    expect(result.rules.length).toBe(2);
    expect(result.comments).toBe(2);
    expect(result.blanks).toBe(1);
  });

  it("handles negation patterns", () => {
    const result = parseAgentignore("*.log\n!important.log");
    expect(result.rules[0]?.negated).toBe(false);
    expect(result.rules[1]?.negated).toBe(true);
    expect(result.rules[1]?.normalizedPattern).toBe("important.log");
  });

  it("handles empty input", () => {
    const result = parseAgentignore("");
    expect(result.rules.length).toBe(0);
    expect(result.blanks).toBe(1);
  });

  it("normalizes directory patterns", () => {
    const result = parseAgentignore("dist/\nbuild/");
    expect(result.rules[0]?.normalizedPattern).toBe("dist");
    expect(result.rules[1]?.normalizedPattern).toBe("build");
  });
});

describe("matchesPattern", () => {
  it("matches simple glob patterns", () => {
    expect(matchesPattern("dist/index.js", "dist/")).toBe(true);
    expect(matchesPattern("src/index.ts", "dist/")).toBe(false);
  });

  it("matches wildcard extensions", () => {
    expect(matchesPattern("bundle.min.js", "*.min.js")).toBe(true);
    expect(matchesPattern("src/app.min.js", "*.min.js")).toBe(true);
    expect(matchesPattern("app.js", "*.min.js")).toBe(false);
  });

  it("matches nested paths", () => {
    expect(matchesPattern("node_modules/lodash/index.js", "node_modules/")).toBe(true);
    // gitignore behavior: node_modules/ matches at any level
    expect(matchesPattern("src/node_modules/foo", "node_modules/")).toBe(true);
    // But a rooted pattern only matches at root
    expect(matchesPattern("src/dist/bundle.js", "dist/")).toBe(true);
  });

  it("matches patterns with dots", () => {
    expect(matchesPattern("file.d.ts", "*.d.ts")).toBe(true);
    expect(matchesPattern("src/types/api.d.ts", "*.d.ts")).toBe(true);
  });

  it("matches exact filenames without path separator", () => {
    expect(matchesPattern("pnpm-lock.yaml", "pnpm-lock.yaml")).toBe(true);
    expect(matchesPattern("nested/pnpm-lock.yaml", "pnpm-lock.yaml")).toBe(true);
  });
});

describe("shouldIgnore", () => {
  it("ignores matched files", () => {
    const rules = parseAgentignore("dist/\n*.min.js").rules;
    expect(shouldIgnore("dist/bundle.js", rules)).toBe(true);
    expect(shouldIgnore("src/app.ts", rules)).toBe(false);
  });

  it("supports negation override", () => {
    const rules = parseAgentignore("*.log\n!important.log").rules;
    expect(shouldIgnore("debug.log", rules)).toBe(true);
    expect(shouldIgnore("important.log", rules)).toBe(false);
  });

  it("returns false for empty rules", () => {
    expect(shouldIgnore("any-file.ts", [])).toBe(false);
  });

  it("later rules override earlier ones", () => {
    const rules = parseAgentignore("*.js\n!src/keep.js").rules;
    expect(shouldIgnore("src/keep.js", rules)).toBe(false);
    expect(shouldIgnore("dist/bundle.js", rules)).toBe(true);
  });
});

describe("getDefaultPatterns", () => {
  it("returns universal patterns without language", () => {
    const patterns = getDefaultPatterns();
    const nonEmpty = patterns.filter((p) => p.length > 0 && !p.startsWith("#"));
    expect(nonEmpty.length).toBeGreaterThan(10);
    expect(nonEmpty).toContain("dist/");
    expect(nonEmpty).toContain("node_modules/");
    expect(nonEmpty).toContain("pnpm-lock.yaml");
  });

  it("adds Python-specific patterns", () => {
    const patterns = getDefaultPatterns("python");
    expect(patterns).toContain("*.pyc");
    expect(patterns).toContain(".mypy_cache/");
  });

  it("adds Rust-specific patterns", () => {
    const patterns = getDefaultPatterns("rust");
    expect(patterns).toContain("target/");
  });

  it("adds Java-specific patterns", () => {
    const patterns = getDefaultPatterns("java");
    expect(patterns).toContain("*.class");
    expect(patterns).toContain(".gradle/");
  });

  it("returns only universal patterns for unknown languages", () => {
    const universal = getDefaultPatterns();
    const unknown = getDefaultPatterns("brainfuck");
    expect(unknown).toEqual(universal);
  });
});
