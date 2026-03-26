import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scan } from "@prontiq/ariscan-engine";
import { scaffold } from "../scaffolder/engine.js";
import { getPreset, listPresets } from "../scaffolder/presets/index.js";
import { validateProjectName } from "../scaffolder/prompts.js";
import { barePreset } from "../scaffolder/presets/bare.js";
import { nextjsPreset } from "../scaffolder/presets/nextjs.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "ariscan-scaffold-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("preset registry", () => {
  it("lists available presets", () => {
    const presets = listPresets();
    expect(presets.length).toBeGreaterThanOrEqual(1);
    expect(presets[0]?.manifest.id).toBe("bare");
  });

  it("gets preset by id", () => {
    const preset = getPreset("bare");
    expect(preset).toBeDefined();
    expect(preset?.manifest.name).toBe("Bare TypeScript");
  });

  it("returns undefined for unknown preset", () => {
    expect(getPreset("nonexistent")).toBeUndefined();
  });
});

describe("bare preset", () => {
  it("generates expected files", () => {
    const files = barePreset.generate({
      name: "test-project",
      preset: "bare",
      outputDir: "/tmp/test",
    });

    const paths = files.map((f) => f.path);

    // Core project files
    expect(paths).toContain("package.json");
    expect(paths).toContain("tsconfig.json");
    expect(paths).toContain("vitest.config.ts");
    expect(paths).toContain("eslint.config.js");
    expect(paths).toContain(".prettierrc");
    expect(paths).toContain(".gitignore");
    expect(paths).toContain(".nvmrc");
    expect(paths).toContain("README.md");

    // Source files
    expect(paths).toContain("src/index.ts");
    expect(paths).toContain("src/index.test.ts");

    // Agent readiness files
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain(".agentignore");
    expect(paths).toContain(".devcontainer/devcontainer.json");
    expect(paths).toContain(".github/workflows/ci.yml");

    // Provider interfaces
    expect(paths).toContain("src/providers/storage.ts");
    expect(paths).toContain("src/providers/queue.ts");
    expect(paths).toContain("src/providers/email.ts");
    expect(paths).toContain("src/providers/index.ts");
    expect(paths).toContain("src/providers/providers.test.ts");
  });

  it("uses project name in package.json", () => {
    const files = barePreset.generate({
      name: "my-app",
      preset: "bare",
      outputDir: "/tmp/test",
    });

    const pkgEntry = files.find((f) => f.path === "package.json");
    if (!pkgEntry) throw new Error("package.json not found");
    const pkg = JSON.parse(pkgEntry.content) as Record<string, unknown>;
    expect(pkg.name).toBe("my-app");
    expect(pkg.type).toBe("module");
  });

  it("generates strict TypeScript config", () => {
    const files = barePreset.generate({
      name: "test",
      preset: "bare",
      outputDir: "/tmp/test",
    });

    const tsconfig = files.find((f) => f.path === "tsconfig.json");
    if (!tsconfig) throw new Error("tsconfig.json not found");
    const config = JSON.parse(tsconfig.content) as Record<string, unknown>;
    const opts = config.compilerOptions as Record<string, unknown>;
    expect(opts.strict).toBe(true);
    expect(opts.module).toBe("Node16");
  });

  it("generates AGENTS.md with project name", () => {
    const files = barePreset.generate({
      name: "cool-project",
      preset: "bare",
      outputDir: "/tmp/test",
    });

    const agents = files.find((f) => f.path === "AGENTS.md");
    if (!agents) throw new Error("AGENTS.md not found");
    expect(agents.content).toContain("cool-project");
    expect(agents.content).toContain("Key Commands");
    expect(agents.content).toContain("providers/");
  });
});

describe("nextjs preset", () => {
  it("is listed in preset registry", () => {
    const presets = listPresets();
    const ids = presets.map((p) => p.manifest.id);
    expect(ids).toContain("nextjs");
  });

  it("generates Next.js-specific files", () => {
    const files = nextjsPreset.generate({
      name: "my-next-app",
      preset: "nextjs",
      outputDir: "/tmp/test",
    });

    const paths = files.map((f) => f.path);

    // Next.js-specific files
    expect(paths).toContain("next.config.ts");
    expect(paths).toContain("tailwind.config.ts");
    expect(paths).toContain("postcss.config.js");
    expect(paths).toContain("app/layout.tsx");
    expect(paths).toContain("app/page.tsx");
    expect(paths).toContain("app/globals.css");
    expect(paths).toContain("app/loading.tsx");
    expect(paths).toContain("app/not-found.tsx");
    expect(paths).toContain("app/actions.ts");

    // Shared agent readiness files
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain(".agentignore");
    expect(paths).toContain(".devcontainer/devcontainer.json");
    expect(paths).toContain(".github/workflows/ci.yml");

    // Provider interfaces
    expect(paths).toContain("src/providers/storage.ts");
    expect(paths).toContain("src/providers/queue.ts");
    expect(paths).toContain("src/providers/email.ts");
  });

  it("includes Next.js dependencies in package.json", () => {
    const files = nextjsPreset.generate({
      name: "my-next-app",
      preset: "nextjs",
      outputDir: "/tmp/test",
    });

    const pkgEntry = files.find((f) => f.path === "package.json");
    if (!pkgEntry) throw new Error("package.json not found");
    const pkg = JSON.parse(pkgEntry.content) as Record<string, Record<string, unknown>>;
    expect(pkg.dependencies).toHaveProperty("next");
    expect(pkg.dependencies).toHaveProperty("react");
    expect(pkg.dependencies).toHaveProperty("react-dom");
    expect(pkg.devDependencies).toHaveProperty("tailwindcss");
  });

  it("generates AGENTS.md with Next.js context", () => {
    const files = nextjsPreset.generate({
      name: "my-next-app",
      preset: "nextjs",
      outputDir: "/tmp/test",
    });

    const agents = files.find((f) => f.path === "AGENTS.md");
    if (!agents) throw new Error("AGENTS.md not found");
    expect(agents.content).toContain("my-next-app");
    expect(agents.content).toContain("Next.js");
    expect(agents.content).toContain("App Router");
    expect(agents.content).toContain("Server Actions");
    expect(agents.content).toContain("Tailwind");
  });

  it("includes .next/ in agentignore", () => {
    const files = nextjsPreset.generate({
      name: "my-next-app",
      preset: "nextjs",
      outputDir: "/tmp/test",
    });

    const agentignore = files.find((f) => f.path === ".agentignore");
    if (!agentignore) throw new Error(".agentignore not found");
    expect(agentignore.content).toContain(".next/");
  });

  it("includes build step in CI workflow", () => {
    const files = nextjsPreset.generate({
      name: "my-next-app",
      preset: "nextjs",
      outputDir: "/tmp/test",
    });

    const ci = files.find((f) => f.path === ".github/workflows/ci.yml");
    if (!ci) throw new Error("ci.yml not found");
    expect(ci.content).toContain("npm run build");
  });

  it("uses strict TypeScript config", () => {
    const files = nextjsPreset.generate({
      name: "my-next-app",
      preset: "nextjs",
      outputDir: "/tmp/test",
    });

    const tsconfig = files.find((f) => f.path === "tsconfig.json");
    if (!tsconfig) throw new Error("tsconfig.json not found");
    const config = JSON.parse(tsconfig.content) as Record<string, unknown>;
    const opts = config.compilerOptions as Record<string, unknown>;
    expect(opts.strict).toBe(true);
    expect(opts.jsx).toBe("preserve");
  });
});

describe("scaffold engine", () => {
  it("writes files to output directory", async () => {
    const outputDir = join(tempDir, "my-project");

    const result = await scaffold({
      name: "my-project",
      preset: "bare",
      outputDir,
    });

    expect(result.filesWritten).toBeGreaterThan(10);
    expect(result.outputDir).toBe(outputDir);

    // Verify files exist on disk
    const pkg = await readFile(join(outputDir, "package.json"), "utf-8");
    const parsed = JSON.parse(pkg) as Record<string, unknown>;
    expect(parsed.name).toBe("my-project");

    const agents = await readFile(join(outputDir, "AGENTS.md"), "utf-8");
    expect(agents).toContain("my-project");
  });

  it("creates nested directories", async () => {
    const outputDir = join(tempDir, "nested-project");

    await scaffold({
      name: "nested-project",
      preset: "bare",
      outputDir,
    });

    // Check nested files exist
    const devcontainer = await readFile(
      join(outputDir, ".devcontainer/devcontainer.json"),
      "utf-8",
    );
    expect(devcontainer).toContain("nested-project");

    const ci = await readFile(join(outputDir, ".github/workflows/ci.yml"), "utf-8");
    expect(ci).toContain("npm test");
  });

  it("refuses to write to non-empty directory", async () => {
    const outputDir = join(tempDir, "non-empty");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "existing.txt"), "hello");

    await expect(scaffold({ name: "test", preset: "bare", outputDir })).rejects.toThrow(
      "not empty",
    );
  });

  it("throws for unknown preset", async () => {
    const outputDir = join(tempDir, "unknown");

    await expect(scaffold({ name: "test", preset: "nonexistent", outputDir })).rejects.toThrow(
      "Unknown preset",
    );
  });
});

describe("validateProjectName", () => {
  it("accepts valid names", () => {
    expect(validateProjectName("my-app")).toBeNull();
    expect(validateProjectName("my.app")).toBeNull();
    expect(validateProjectName("app123")).toBeNull();
    expect(validateProjectName("a")).toBeNull();
  });

  it("rejects empty name", () => {
    expect(validateProjectName("")).not.toBeNull();
  });

  it("rejects names with uppercase", () => {
    expect(validateProjectName("MyApp")).not.toBeNull();
  });

  it("rejects names with spaces", () => {
    expect(validateProjectName("my app")).not.toBeNull();
  });

  it("rejects names starting with hyphen", () => {
    expect(validateProjectName("-my-app")).not.toBeNull();
  });
});

describe("dogfood gate (S.04)", () => {
  it("bare preset scores L3+ (>= 46)", async () => {
    const outputDir = join(tempDir, "dogfood-bare");
    await scaffold({ name: "dogfood-bare", preset: "bare", outputDir });
    // Scanner needs .git to recognise directory as a repo
    await mkdir(join(outputDir, ".git"), { recursive: true });

    const result = await scan(outputDir);
    expect(result.score).toBeGreaterThanOrEqual(46);
  }, 30_000);

  it("nextjs preset scores L3+ (>= 46)", async () => {
    const outputDir = join(tempDir, "dogfood-nextjs");
    await scaffold({ name: "dogfood-nextjs", preset: "nextjs", outputDir });
    await mkdir(join(outputDir, ".git"), { recursive: true });

    const result = await scan(outputDir);
    expect(result.score).toBeGreaterThanOrEqual(46);
  }, 30_000);
});
