import { describe, it, expect } from "vitest";
import { detectLanguages } from "../../detection/languages.js";
import { createMockContext } from "../helpers.js";

describe("detectLanguages", () => {
  it("detects TypeScript project with tsconfig marker", async () => {
    const ctx = createMockContext({
      "tsconfig.json": '{"compilerOptions":{}}',
      "src/index.ts": "export const x = 1;",
      "src/utils.ts": "export const y = 2;",
      "src/types.ts": "export type Foo = string;",
    });

    const result = await detectLanguages(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.language).toBe("TypeScript");
    expect(first?.primary).toBe(true);
    expect(first?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects Python project with pyproject.toml", async () => {
    const ctx = createMockContext({
      "pyproject.toml": '[project]\nname = "my-app"',
      "src/main.py": "print('hello')",
      "src/utils.py": "def foo(): pass",
      "tests/test_main.py": "def test_foo(): pass",
    });

    const result = await detectLanguages(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.language).toBe("Python");
    expect(first?.primary).toBe(true);
    expect(first?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects Go project with go.mod", async () => {
    const ctx = createMockContext({
      "go.mod": "module example.com/app\n\ngo 1.21",
      "main.go": "package main",
      "handler.go": "package main",
    });

    const result = await detectLanguages(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.language).toBe("Go");
    expect(first?.primary).toBe(true);
    expect(first?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects mixed TypeScript and JavaScript project", async () => {
    const ctx = createMockContext({
      "tsconfig.json": "{}",
      "src/app.ts": "",
      "src/utils.ts": "",
      "scripts/build.js": "",
      "scripts/deploy.js": "",
    });

    const result = await detectLanguages(ctx);
    expect(result.length).toBeGreaterThanOrEqual(2);

    const tsLang = result.find((l) => l.language === "TypeScript");
    const jsLang = result.find((l) => l.language === "JavaScript");
    expect(tsLang).toBeDefined();
    expect(jsLang).toBeDefined();

    // Only one should be primary
    const primaries = result.filter((l) => l.primary);
    expect(primaries).toHaveLength(1);
  });

  it("returns empty array for empty repo", async () => {
    const ctx = createMockContext({});
    const result = await detectLanguages(ctx);
    expect(result).toEqual([]);
  });

  it("returns empty array for repo with only non-source files", async () => {
    const ctx = createMockContext({
      "README.md": "# Hello",
      "config.yaml": "key: value",
      ".gitignore": "node_modules",
    });

    const result = await detectLanguages(ctx);
    expect(result).toEqual([]);
  });

  it("detects Rust project", async () => {
    const ctx = createMockContext({
      "Cargo.toml": '[package]\nname = "my-app"',
      "src/main.rs": "fn main() {}",
      "src/lib.rs": "pub fn foo() {}",
    });

    const result = await detectLanguages(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.language).toBe("Rust");
    expect(first?.primary).toBe(true);
  });

  it("detects Java project", async () => {
    const ctx = createMockContext({
      "pom.xml": "<project></project>",
      "src/main/java/App.java": "class App {}",
    });

    const result = await detectLanguages(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.language).toBe("Java");
    expect(first?.primary).toBe(true);
  });

  it("detects language from marker only when no source files exist", async () => {
    const ctx = createMockContext({
      "tsconfig.json": "{}",
      "README.md": "# Project",
    });

    const result = await detectLanguages(ctx);
    // Should still detect TypeScript via marker with low confidence
    const tsLang = result.find((l) => l.language === "TypeScript");
    expect(tsLang).toBeDefined();
    if (!tsLang) return; // type narrowing
    expect(tsLang.confidence).toBeLessThanOrEqual(0.3);
  });
});
