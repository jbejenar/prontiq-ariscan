import { describe, it, expect } from "vitest";
import { buildDeterminismAnalyzer } from "../analyzers/build-determinism.js";
import { createMockContext } from "./helpers.js";

describe("buildDeterminismAnalyzer (P6)", () => {
  it("always reports pillar P6 with weight 0.15", async () => {
    const ctx = createMockContext({});
    const result = await buildDeterminismAnalyzer.analyze(ctx);
    expect(result.pillar).toBe("P6");
    expect(result.weight).toBe(0.15);
  });

  it("always supports any repo", async () => {
    const ctx = createMockContext({});
    expect(await buildDeterminismAnalyzer.supports(ctx)).toBe(true);
  });

  describe("repo with no tsconfig (checks for other languages)", () => {
    it("detects Go projects via go.mod", async () => {
      const ctx = createMockContext({
        "go.mod": "module example.com/app\ngo 1.21",
        "go.sum": "some hash",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // Go: 25 + lockfile(go.sum): 20 = 45
      expect(result.score).toBeGreaterThanOrEqual(45);
    });

    it("detects Rust projects via Cargo.toml", async () => {
      const ctx = createMockContext({
        "Cargo.toml": '[package]\nname = "app"',
        "Cargo.lock": "some lock data",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // Rust: 30 + lockfile: 20 = 50
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it("detects Python typing via mypy.ini", async () => {
      const ctx = createMockContext({
        "mypy.ini": "[mypy]\nstrict = true",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // mypy: 20
      expect(result.score).toBeGreaterThanOrEqual(20);
    });

    it("detects Python typing in pyproject.toml", async () => {
      const ctx = createMockContext({
        "pyproject.toml": "[tool.mypy]\nstrict = true",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.score).toBeGreaterThanOrEqual(20);
    });
  });

  describe("repo with tsconfig strict: true", () => {
    it("scores >= 30 from strict mode alone", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.score).toBeGreaterThanOrEqual(30);
    });

    it("does not emit ARI-BLD-001", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-001")).toBe(false);
    });

    it("has high confidence with tsconfig present", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.confidence).toBe("high");
    });
  });

  describe("repo with tsconfig strict: false", () => {
    it("emits ARI-BLD-001 finding when strict is not enabled", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: false },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-001")).toBe(true);
    });

    it("gives partial credit for strictNullChecks only", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strictNullChecks: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // strictNullChecks alone: 10 + ARI-BLD-001
      expect(result.score).toBeGreaterThanOrEqual(10);
      expect(result.findings.some((f) => f.code === "ARI-BLD-001")).toBe(true);
    });

    it("gives more credit for both strictNullChecks + noImplicitAny", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strictNullChecks: true, noImplicitAny: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // Both: 20
      expect(result.score).toBeGreaterThanOrEqual(20);
    });
  });

  describe("lockfile detection", () => {
    it("adds points for pnpm-lock.yaml", async () => {
      const withLock = createMockContext({
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
        "pnpm-lock.yaml": "lockfileVersion: 5",
      });
      const withoutLock = createMockContext({
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      });

      const lockResult = await buildDeterminismAnalyzer.analyze(withLock);
      const noLockResult = await buildDeterminismAnalyzer.analyze(withoutLock);
      expect(lockResult.score - noLockResult.score).toBe(20);
    });

    it("detects various lockfile formats", async () => {
      for (const lockfile of ["package-lock.json", "yarn.lock", "bun.lockb", "poetry.lock"]) {
        const ctx = createMockContext({ [lockfile]: "lock content" });
        const result = await buildDeterminismAnalyzer.analyze(ctx);
        // Should get lockfile points (20)
        expect(result.score).toBeGreaterThanOrEqual(20);
      }
    });
  });

  describe("lockfile in .gitignore", () => {
    it("emits ARI-BLD-002 when lockfile is gitignored", async () => {
      const ctx = createMockContext({
        ".gitignore": "node_modules/\npackage-lock.json\n",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-002")).toBe(true);
    });

    it("emits ARI-BLD-003 when no lockfile and not gitignored", async () => {
      const ctx = createMockContext({
        ".gitignore": "node_modules/\ndist/\n",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-003")).toBe(true);
    });

    it("does not emit ARI-BLD-002 or ARI-BLD-003 when lockfile exists", async () => {
      const ctx = createMockContext({
        "pnpm-lock.yaml": "lockfileVersion: 5",
        ".gitignore": "node_modules/\n",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-002")).toBe(false);
      expect(result.findings.some((f) => f.code === "ARI-BLD-003")).toBe(false);
    });
  });

  describe("turbo.json reproducibility points", () => {
    it("adds points for turbo.json", async () => {
      const withTurbo = createMockContext({
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
        "turbo.json": JSON.stringify({ pipeline: { build: {} } }),
      });
      const withoutTurbo = createMockContext({
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      });

      const turboResult = await buildDeterminismAnalyzer.analyze(withTurbo);
      const noTurboResult = await buildDeterminismAnalyzer.analyze(withoutTurbo);
      expect(turboResult.score).toBeGreaterThan(noTurboResult.score);
    });
  });

  describe("build tool detection", () => {
    it("adds points for having a build script", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { build: "tsc" } }),
      });
      const noScripts = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });

      const buildResult = await buildDeterminismAnalyzer.analyze(ctx);
      const noResult = await buildDeterminismAnalyzer.analyze(noScripts);
      expect(buildResult.score).toBeGreaterThan(noResult.score);
    });

    it("gives bonus for modern build tools (tsup, esbuild, vite)", async () => {
      const modernPkg = JSON.stringify({ scripts: { build: "tsup src/index.ts" } });
      const legacyPkg = JSON.stringify({ scripts: { build: "tsc" } });

      const modern = await buildDeterminismAnalyzer.analyze(
        createMockContext({ "package.json": modernPkg }),
      );
      const legacy = await buildDeterminismAnalyzer.analyze(
        createMockContext({ "package.json": legacyPkg }),
      );
      // Modern: build(10) + modern bonus(10), legacy: build(10)
      expect(modern.score).toBeGreaterThan(legacy.score);
    });

    it("gives partial bonus for webpack", async () => {
      const webpackPkg = JSON.stringify({ scripts: { build: "webpack --mode production" } });
      const tsupPkg = JSON.stringify({ scripts: { build: "tsup" } });

      const webpack = await buildDeterminismAnalyzer.analyze(
        createMockContext({ "package.json": webpackPkg }),
      );
      const tsup = await buildDeterminismAnalyzer.analyze(
        createMockContext({ "package.json": tsupPkg }),
      );
      // webpack: build(10) + webpack(5), tsup: build(10) + modern(10)
      expect(tsup.score).toBeGreaterThan(webpack.score);
    });
  });

  describe("package manager consistency", () => {
    it("adds points for .npmrc", async () => {
      const with_ = createMockContext({ ".npmrc": "save-exact=true" });
      const without_ = createMockContext({});
      const r1 = await buildDeterminismAnalyzer.analyze(with_);
      const r2 = await buildDeterminismAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("adds points for packageManager field", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ packageManager: "pnpm@9.0.0" }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // Should include package manager consistency points
      expect(result.score).toBeGreaterThanOrEqual(5);
    });
  });

  describe("isolatedModules bonus", () => {
    it("adds 5 points for isolatedModules: true", async () => {
      const with_ = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true, isolatedModules: true },
        }),
      });
      const without_ = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
      });

      const r1 = await buildDeterminismAnalyzer.analyze(with_);
      const r2 = await buildDeterminismAnalyzer.analyze(without_);
      expect(r1.score - r2.score).toBe(5);
    });
  });

  describe("TypeScript projectReferences", () => {
    it("adds points for tsconfig with references", async () => {
      const withRefs = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
          references: [{ path: "./packages/core" }, { path: "./packages/cli" }],
        }),
      });
      const withoutRefs = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
      });
      const r1 = await buildDeterminismAnalyzer.analyze(withRefs);
      const r2 = await buildDeterminismAnalyzer.analyze(withoutRefs);
      expect(r1.score - r2.score).toBe(5);
    });

    it("does not add points for empty references array", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
          references: [],
        }),
      });
      const baseline = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
      });
      const r1 = await buildDeterminismAnalyzer.analyze(ctx);
      const r2 = await buildDeterminismAnalyzer.analyze(baseline);
      expect(r1.score).toBe(r2.score);
    });
  });

  describe("Go interface{}/any abuse detection", () => {
    it("emits ARI-BLD-004 for excessive interface{} usage", async () => {
      const goContent = Array(12).fill("func doStuff(x interface{}) {}").join("\n");
      const ctx = createMockContext({
        "go.mod": "module example.com/app\ngo 1.21",
        "main.go": goContent,
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-004")).toBe(true);
    });

    it("does not emit ARI-BLD-004 for minimal any usage", async () => {
      const ctx = createMockContext({
        "go.mod": "module example.com/app\ngo 1.21",
        "main.go": "package main\n\nfunc main() {\n  x := 42\n  println(x)\n}",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-004")).toBe(false);
    });
  });

  describe("Rust excessive unwrap() detection", () => {
    it("emits ARI-BLD-005 for excessive unwrap() usage", async () => {
      const rsContent = Array(25).fill("let x = some_result.unwrap();").join("\n");
      const ctx = createMockContext({
        "Cargo.toml": '[package]\nname = "app"',
        "src/main.rs": rsContent,
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-005")).toBe(true);
    });

    it("does not emit ARI-BLD-005 for clean Rust code", async () => {
      const ctx = createMockContext({
        "Cargo.toml": '[package]\nname = "app"',
        "src/main.rs":
          "fn main() -> Result<(), Box<dyn std::error::Error>> {\n  let x = some_fn()?;\n  Ok(())\n}",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-005")).toBe(false);
    });
  });

  describe("ARI-BLD-006: Monorepo project references", () => {
    it("emits ARI-BLD-006 when turbo.json is detected", async () => {
      const ctx = createMockContext({
        "turbo.json": JSON.stringify({ pipeline: { build: {} } }),
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-006")).toBe(true);
    });

    it("emits ARI-BLD-006 when nx.json is detected", async () => {
      const ctx = createMockContext({
        "nx.json": JSON.stringify({ tasksRunnerOptions: {} }),
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-006")).toBe(true);
    });

    it("emits ARI-BLD-006 when pnpm-workspace.yaml is detected", async () => {
      const ctx = createMockContext({
        "pnpm-workspace.yaml": "packages:\n  - packages/*",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-006")).toBe(true);
    });

    it("emits info severity when project references are configured", async () => {
      const ctx = createMockContext({
        "turbo.json": JSON.stringify({ pipeline: { build: {} } }),
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
          references: [{ path: "./packages/core" }],
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-006");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });

    it("does not emit ARI-BLD-006 when no monorepo tool is detected", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-006")).toBe(false);
    });
  });

  describe("ARI-BLD-007: Lockfile drift detection", () => {
    it("emits ARI-BLD-007 when packageManager says pnpm but only package-lock.json exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ packageManager: "pnpm@9.0.0" }),
        "package-lock.json": "{}",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-007")).toBe(true);
    });

    it("does not emit ARI-BLD-007 when lockfile matches packageManager", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ packageManager: "pnpm@9.0.0" }),
        "pnpm-lock.yaml": "lockfileVersion: 5",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-007")).toBe(false);
    });

    it("does not emit ARI-BLD-007 when no packageManager field exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "my-app" }),
        "package-lock.json": "{}",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-007")).toBe(false);
    });
  });

  describe("Java nullability annotations (ARI-BLD-008)", () => {
    it("emits ARI-BLD-008 when Java files lack nullability annotations", async () => {
      const ctx = createMockContext({
        "src/Main.java": "public class Main { public static void main(String[] args) {} }",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-008")).toBe(true);
    });

    it("does not emit ARI-BLD-008 when @NonNull annotations are present", async () => {
      const ctx = createMockContext({
        "src/Main.java":
          'import javax.annotation.NonNull;\npublic class Main { public @NonNull String getName() { return ""; } }',
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-008")).toBe(false);
    });

    it("does not emit ARI-BLD-008 when NullAway is in build.gradle", async () => {
      const ctx = createMockContext({
        "src/Main.java": "public class Main {}",
        "build.gradle":
          'plugins { id "net.ltgt.errorprone" }\ndependencies { errorprone("com.uber.nullaway:nullaway:0.10.0") }',
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-008")).toBe(false);
    });

    it("scores +15 for Java projects with nullability annotations", async () => {
      const ctx = createMockContext({
        "src/Main.java":
          "import org.jetbrains.annotations.Nullable;\npublic class Main { public @Nullable String getName() { return null; } }",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.score).toBeGreaterThanOrEqual(15);
    });
  });

  describe("C# nullable reference types (ARI-BLD-009)", () => {
    it("emits ARI-BLD-009 when C# projects lack nullable reference types", async () => {
      const ctx = createMockContext({
        "src/Program.cs": "class Program { static void Main() {} }",
        "MyApp.csproj":
          "<Project><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-009")).toBe(true);
    });

    it("does not emit ARI-BLD-009 when Nullable is enabled in .csproj", async () => {
      const ctx = createMockContext({
        "src/Program.cs": "class Program { static void Main() {} }",
        "MyApp.csproj":
          "<Project><PropertyGroup><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable></PropertyGroup></Project>",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-009")).toBe(false);
    });

    it("does not emit ARI-BLD-009 when #nullable enable directive is in source", async () => {
      const ctx = createMockContext({
        "src/Program.cs": "#nullable enable\nclass Program { static void Main() {} }",
        "MyApp.csproj":
          "<Project><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-009")).toBe(false);
    });

    it("scores +20 for C# projects with nullable reference types", async () => {
      const ctx = createMockContext({
        "src/Program.cs": "class Program { static void Main() {} }",
        "MyApp.csproj":
          "<Project><PropertyGroup><Nullable>enable</Nullable></PropertyGroup></Project>",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.score).toBeGreaterThanOrEqual(20);
    });
  });

  describe("ARI-BLD-010: Build tool modernity rationale", () => {
    it("emits info ARI-BLD-010 for modern build tools", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { build: "tsup src/index.ts" } }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-010");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("Modern build tool");
    });

    it("emits low ARI-BLD-010 for webpack with migration advice", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { build: "webpack --mode production" } }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-010");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("low");
      expect(finding?.remediation).toBeDefined();
      expect(finding?.evidence).toBeDefined();
    });

    it("does not emit ARI-BLD-010 when no build script exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-010")).toBe(false);
    });
  });

  describe("ARI-BLD-011: Linting & formatting configuration", () => {
    it("adds +5 when both ESLint and Prettier configs are present", async () => {
      const withBoth = createMockContext({
        "eslint.config.js": "export default {};",
        ".prettierrc": "{}",
      });
      const withNeither = createMockContext({});
      const r1 = await buildDeterminismAnalyzer.analyze(withBoth);
      const r2 = await buildDeterminismAnalyzer.analyze(withNeither);
      expect(r1.score - r2.score).toBe(5);
    });

    it("emits info finding when both are configured", async () => {
      const ctx = createMockContext({
        "eslint.config.mjs": "export default {};",
        "prettier.config.js": "export default {};",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-011");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("Linting and formatting configured");
    });

    it("emits low finding when only ESLint is configured (no bonus)", async () => {
      const ctx = createMockContext({
        ".eslintrc.json": "{}",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-011");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("low");
      expect(finding?.message).toContain("formatter");
    });

    it("emits low finding when only Prettier is configured (no bonus)", async () => {
      const ctx = createMockContext({
        ".prettierrc.json": "{}",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-011");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("low");
      expect(finding?.message).toContain("linter");
    });

    it("emits low finding when neither is configured", async () => {
      const ctx = createMockContext({});
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-011");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("low");
      expect(finding?.message).toContain("linter and formatter");
    });

    it("detects ESLint config in package.json eslintConfig field", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          eslintConfig: { rules: {} },
          prettier: { singleQuote: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-011");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });

    it("detects Prettier config in package.json prettier field", async () => {
      const ctx = createMockContext({
        "eslint.config.js": "export default {};",
        "package.json": JSON.stringify({ prettier: { singleQuote: true } }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-011");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });
  });

  describe("ARI-BLD-012: Pre-commit hooks", () => {
    it("adds +5 when pre-commit hooks and lint-staged are both configured", async () => {
      const withHooks = createMockContext({
        ".husky/pre-commit": "#!/bin/sh\npnpm lint-staged",
        "package.json": JSON.stringify({ "lint-staged": { "*.ts": ["eslint --fix"] } }),
      });
      const withoutHooks = createMockContext({});
      const r1 = await buildDeterminismAnalyzer.analyze(withHooks);
      const r2 = await buildDeterminismAnalyzer.analyze(withoutHooks);
      expect(r1.score - r2.score).toBe(5);
    });

    it("adds +3 for pre-commit hooks without lint-staged", async () => {
      const ctx = createMockContext({
        ".husky/pre-commit": "#!/bin/sh\npnpm test",
      });
      const baseline = createMockContext({});
      const r1 = await buildDeterminismAnalyzer.analyze(ctx);
      const r2 = await buildDeterminismAnalyzer.analyze(baseline);
      expect(r1.score - r2.score).toBe(3);
    });

    it("emits info finding when fully configured", async () => {
      const ctx = createMockContext({
        ".husky/pre-commit": "#!/bin/sh\npnpm lint-staged",
        "package.json": JSON.stringify({ "lint-staged": { "*.ts": ["eslint --fix"] } }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-012");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });

    it("emits low finding when no hooks configured", async () => {
      const ctx = createMockContext({});
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-012");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("low");
    });

    it("detects Lefthook as pre-commit tool", async () => {
      const ctx = createMockContext({
        ".lefthook.yml": "pre-commit:\n  commands: {}",
        ".lintstagedrc": "{}",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-012");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("Lefthook");
    });

    it("detects pre-commit-config.yaml", async () => {
      const ctx = createMockContext({
        ".pre-commit-config.yaml": "repos: []",
        "lint-staged.config.js": "export default {};",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-BLD-012");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });
  });

  describe("score clamping", () => {
    it("never exceeds 100", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true, isolatedModules: true },
        }),
        "pnpm-lock.yaml": "lockfileVersion: 5",
        "package.json": JSON.stringify({
          scripts: { build: "tsup" },
          packageManager: "pnpm@9.0.0",
        }),
        "turbo.json": "{}",
        ".npmrc": "save-exact=true",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
