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

  it("prefers Rust over TypeScript in Rust-runtime + TS-test repo (Deno-like)", async () => {
    // Simulates a Rust project where TypeScript files are mostly in test/stdlib dirs
    const ctx = createMockContext({
      "Cargo.toml": '[package]\nname = "runtime"',
      "src/main.rs": "fn main() {}",
      "src/lib.rs": "pub fn foo() {}",
      "src/parser.rs": "mod parser {}",
      "src/compiler.rs": "mod compiler {}",
      "crates/core/src/lib.rs": "pub mod core;",
      // TypeScript files predominantly in test directories
      "tests/unit/test_parser.ts": "",
      "tests/unit/test_compiler.ts": "",
      "tests/integration/test_e2e.ts": "",
      "tests/fixtures/input.ts": "",
      "tests/fixtures/output.ts": "",
      "tests/helpers.ts": "",
      "benchmark/bench_parser.ts": "",
      "benchmark/bench_compiler.ts": "",
    });

    const result = await detectLanguages(ctx);
    const primary = result.find((l) => l.primary);
    expect(primary).toBeDefined();
    expect(primary?.language).toBe("Rust");
  });

  it("prefers TypeScript over JavaScript in TS-compiler + JS-runtime repo (Svelte-like)", async () => {
    // Simulates a TypeScript project where JS files are in tests and runtime
    const ctx = createMockContext({
      "tsconfig.json": '{"compilerOptions":{}}',
      "src/compiler/parse.ts": "",
      "src/compiler/transform.ts": "",
      "src/compiler/generate.ts": "",
      "src/runtime/internal.ts": "",
      "src/types.ts": "",
      // JavaScript files in test directories
      "test/runtime/ssr.js": "",
      "test/runtime/dom.js": "",
      "test/compiler/parse.js": "",
      "test/helpers.js": "",
      "test/fixtures/sample.js": "",
      "examples/counter/main.js": "",
    });

    const result = await detectLanguages(ctx);
    const primary = result.find((l) => l.primary);
    expect(primary).toBeDefined();
    expect(primary?.language).toBe("TypeScript");
  });

  it("down-weights test directory files in language detection", async () => {
    // Without down-weighting, JavaScript would win (6 files vs 3 TypeScript)
    // With down-weighting + tsconfig marker, TypeScript wins clearly
    const ctx = createMockContext({
      "tsconfig.json": "{}",
      "src/app.ts": "",
      "src/utils.ts": "",
      "src/main.ts": "",
      "__tests__/app.test.js": "",
      "__tests__/utils.test.js": "",
      "tests/integration.js": "",
      "test/e2e.js": "",
      "spec/helpers.js": "",
      "fixtures/data.js": "",
    });

    const result = await detectLanguages(ctx);
    const ts = result.find((l) => l.language === "TypeScript");
    const js = result.find((l) => l.language === "JavaScript");
    expect(ts).toBeDefined();
    expect(js).toBeDefined();
    // TypeScript should have higher confidence due to test down-weighting
    expect(ts?.confidence).toBeGreaterThan(js?.confidence ?? 0);
  });

  it("prefers Rust over JavaScript in Rust-core + massive JS fixture repo (SWC-like)", async () => {
    // Simulates a Rust project with a large JS/TS test fixture suite.
    // Without the test-dominance penalty, JS would win even after down-weighting
    // because the sheer volume of JS test fixtures overwhelms Rust source files.
    const files: Record<string, string> = {
      "Cargo.toml": '[workspace]\nmembers = ["crates/*"]',
      "Cargo.lock": "# lock",
    };
    // 20 Rust source files in crates/ (core code)
    for (let i = 0; i < 20; i++) {
      files[`crates/parser/src/file${i}.rs`] = "";
    }
    // 5 Rust test files
    for (let i = 0; i < 5; i++) {
      files[`crates/parser/tests/test${i}.rs`] = "";
    }
    // 60 JS files almost entirely in test/fixture directories
    for (let i = 0; i < 55; i++) {
      files[`crates/parser/tests/fixture/case${i}.js`] = "";
    }
    files["bindings/node/index.js"] = "";
    files["bindings/node/utils.js"] = "";
    files["bindings/wasm/index.js"] = "";
    files["bindings/wasm/utils.js"] = "";
    files["bindings/node/test.js"] = "";

    const ctx = createMockContext(files);
    const result = await detectLanguages(ctx);
    const primary = result.find((l) => l.primary);
    expect(primary).toBeDefined();
    expect(primary?.language).toBe("Rust");
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
