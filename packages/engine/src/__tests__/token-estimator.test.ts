import { describe, it, expect } from "vitest";
import { classifyFile, estimateTokens } from "../budget/token-estimator.js";

describe("classifyFile", () => {
  it("classifies TypeScript source files", () => {
    expect(classifyFile("src/index.ts")).toBe("source");
    expect(classifyFile("packages/engine/src/scan.ts")).toBe("source");
    expect(classifyFile("lib/utils.tsx")).toBe("source");
  });

  it("classifies JavaScript source files", () => {
    expect(classifyFile("src/app.js")).toBe("source");
    expect(classifyFile("utils/helper.mjs")).toBe("source");
    expect(classifyFile("lib/compat.cjs")).toBe("source");
  });

  it("classifies Python source files", () => {
    expect(classifyFile("app/main.py")).toBe("source");
    expect(classifyFile("types/models.pyi")).toBe("source");
  });

  it("classifies Go, Rust, Java source files", () => {
    expect(classifyFile("cmd/main.go")).toBe("source");
    expect(classifyFile("src/lib.rs")).toBe("source");
    expect(classifyFile("src/App.java")).toBe("source");
  });

  it("classifies test files", () => {
    expect(classifyFile("src/index.test.ts")).toBe("test");
    expect(classifyFile("src/index.spec.js")).toBe("test");
    expect(classifyFile("test/unit/app_test.py")).toBe("test");
    expect(classifyFile("src/__tests__/foo.ts")).toBe("test");
    expect(classifyFile("tests/integration/api.test.ts")).toBe("test");
    expect(classifyFile("spec/models/user_spec.rb")).toBe("test");
  });

  it("classifies documentation files", () => {
    expect(classifyFile("README.md")).toBe("docs");
    expect(classifyFile("docs/guide.mdx")).toBe("docs");
    expect(classifyFile("CHANGELOG.md")).toBe("docs");
    expect(classifyFile("docs/api.rst")).toBe("docs");
  });

  it("classifies config files", () => {
    expect(classifyFile("tsconfig.json")).toBe("config");
    expect(classifyFile("tsconfig.build.json")).toBe("config");
    expect(classifyFile(".eslintrc")).toBe("config");
    expect(classifyFile("vitest.config.ts")).toBe("config");
    expect(classifyFile("Dockerfile")).toBe("config");
    expect(classifyFile(".gitignore")).toBe("config");
    expect(classifyFile(".env")).toBe("config");
    expect(classifyFile(".env.local")).toBe("config");
    expect(classifyFile("turbo.json")).toBe("config");
    expect(classifyFile("package.json")).toBe("config");
    expect(classifyFile("Makefile")).toBe("config");
  });

  it("classifies generated files", () => {
    expect(classifyFile("dist/index.d.ts")).toBe("generated");
    expect(classifyFile("build/output.min.js")).toBe("generated");
    expect(classifyFile("src/api.generated.ts")).toBe("generated");
    expect(classifyFile("dist/index.js.map")).toBe("generated");
  });

  it("classifies lockfiles", () => {
    expect(classifyFile("package-lock.json")).toBe("lockfile");
    expect(classifyFile("pnpm-lock.yaml")).toBe("lockfile");
    expect(classifyFile("yarn.lock")).toBe("lockfile");
    expect(classifyFile("Cargo.lock")).toBe("lockfile");
    expect(classifyFile("go.sum")).toBe("lockfile");
    expect(classifyFile("poetry.lock")).toBe("lockfile");
  });

  it("classifies binary files", () => {
    expect(classifyFile("logo.png")).toBe("binary");
    expect(classifyFile("font.woff2")).toBe("binary");
    expect(classifyFile("archive.zip")).toBe("binary");
    expect(classifyFile("parser.wasm")).toBe("binary");
    expect(classifyFile("app.pdf")).toBe("binary");
  });

  it("classifies data files", () => {
    expect(classifyFile("data/fixtures.json")).toBe("data");
    expect(classifyFile("reports/output.csv")).toBe("data");
    expect(classifyFile("feed.xml")).toBe("data");
  });

  it("classifies unknown extensions as other", () => {
    expect(classifyFile("LICENSE")).toBe("other");
    expect(classifyFile("CODEOWNERS")).toBe("other");
  });
});

describe("estimateTokens", () => {
  it("estimates tokens for source code", () => {
    // 3500 bytes / 3.5 chars per token = 1000 tokens
    expect(estimateTokens(3500, "source")).toBe(1000);
  });

  it("estimates tokens for documentation", () => {
    // 4000 bytes / 4.0 chars per token = 1000 tokens
    expect(estimateTokens(4000, "docs")).toBe(1000);
  });

  it("estimates tokens for lockfiles", () => {
    // 3000 bytes / 3.0 chars per token = 1000 tokens
    expect(estimateTokens(3000, "lockfile")).toBe(1000);
  });

  it("returns 0 for binary files", () => {
    expect(estimateTokens(1000000, "binary")).toBe(0);
  });

  it("returns 0 for zero bytes", () => {
    expect(estimateTokens(0, "source")).toBe(0);
  });

  it("rounds up to nearest integer", () => {
    // 10 bytes / 3.5 = 2.857... → ceil to 3
    expect(estimateTokens(10, "source")).toBe(3);
  });
});
