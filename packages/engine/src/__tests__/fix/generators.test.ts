import { describe, it, expect } from "vitest";
import { generateFixProposals } from "../../fix/generators.js";
import type { RepoContext } from "../../analyzers/analyzer.interface.js";
import type { DetectionResult } from "@prontiq/schema";

function createMockContext(
  fileMap: Record<string, string>,
  extraFiles: string[] = [],
): RepoContext {
  const allFiles = [...Object.keys(fileMap), ...extraFiles].sort();
  return {
    rootPath: "/mock/repo",
    files: Object.freeze(allFiles),
    async readFile(path: string) {
      return fileMap[path] ?? null;
    },
    async fileExists(path: string) {
      return path in fileMap || extraFiles.includes(path);
    },
    async readJson<T = unknown>(path: string): Promise<T | null> {
      const content = fileMap[path];
      if (!content) return null;
      try {
        return JSON.parse(content) as T;
      } catch {
        return null;
      }
    },
  };
}

const nodeDetection: DetectionResult = {
  languages: [{ language: "typescript", confidence: 0.9, primary: true }],
  frameworks: [{ framework: "express", confidence: 0.8 }],
  monorepo: null,
};

const pythonDetection: DetectionResult = {
  languages: [{ language: "python", confidence: 0.9, primary: true }],
  frameworks: [],
  monorepo: null,
};

describe("generateFixProposals", () => {
  it("proposes AGENTS.md, .agentignore, and devcontainer for empty repo", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test", scripts: { build: "tsc", test: "vitest" } }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);

    expect(proposals.length).toBe(3);
    const paths = proposals.map((p) => p.path);
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain(".agentignore");
    expect(paths).toContain(".devcontainer/devcontainer.json");
  });

  it("marks existing files as alreadyExists", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# Existing agents file",
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);

    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");
    expect(agentsMd?.alreadyExists).toBe(true);

    const agentignore = proposals.find((p) => p.path === ".agentignore");
    expect(agentignore?.alreadyExists).toBe(false);
  });

  it("generates AGENTS.md with build/test commands from package.json", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({
        name: "test",
        scripts: { build: "tsc", test: "vitest", lint: "eslint ." },
      }),
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");

    expect(agentsMd).toBeDefined();
    expect(agentsMd?.content).toContain("pnpm build");
    expect(agentsMd?.content).toContain("pnpm test");
    expect(agentsMd?.content).toContain("pnpm lint");
    expect(agentsMd?.content).toContain("TODO");
  });

  it("generates AGENTS.md with TODO prompts referencing ARI criteria", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");

    expect(agentsMd?.content).toContain("TODO(ARI-CTX-001)");
    expect(agentsMd?.content).toContain("TODO(ARI-CTX-002)");
    expect(agentsMd?.content).toContain("TODO(ARI-CTX-003)");
    expect(agentsMd?.content).toContain("TODO(ARI-TST-001)");
  });

  it("generates AGENTS.md with Do NOT section", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");

    expect(agentsMd?.content).toContain("## Do NOT");
  });

  it("generates .agentignore with standard patterns", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const agentignore = proposals.find((p) => p.path === ".agentignore");

    expect(agentignore).toBeDefined();
    expect(agentignore?.content).toContain("dist/");
    expect(agentignore?.content).toContain("node_modules/");
    expect(agentignore?.content).toContain("pnpm-lock.yaml");
    expect(agentignore?.content).toContain("coverage/");
  });

  it("generates .agentignore with Python-specific patterns", async () => {
    const ctx = createMockContext({
      "pyproject.toml": "[project]\nname = 'test'",
    });

    const proposals = await generateFixProposals(ctx, pythonDetection);
    const agentignore = proposals.find((p) => p.path === ".agentignore");

    expect(agentignore?.content).toContain("*.pyc");
    expect(agentignore?.content).toContain(".mypy_cache/");
  });

  it("generates devcontainer.json with correct image for TypeScript", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const devcontainer = proposals.find((p) => p.path === ".devcontainer/devcontainer.json");

    expect(devcontainer).toBeDefined();
    const config = JSON.parse(devcontainer?.content ?? "{}");
    expect(config.image).toContain("typescript-node");
    expect(config.postCreateCommand).toContain("pnpm install");
    expect(config["// TODO(ARI-ENV-001)"]).toBeDefined();
  });

  it("generates devcontainer.json with correct image for Python", async () => {
    const ctx = createMockContext({
      "pyproject.toml": "[project]\nname = 'test'",
    });

    const proposals = await generateFixProposals(ctx, pythonDetection);
    const devcontainer = proposals.find((p) => p.path === ".devcontainer/devcontainer.json");

    const config = JSON.parse(devcontainer?.content ?? "{}");
    expect(config.image).toContain("python");
    expect(config.postCreateCommand).toContain("pip install");
  });

  it("each proposal has a rationale and criterion", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);

    for (const p of proposals) {
      expect(p.rationale.length).toBeGreaterThan(10);
      expect(p.criterion).toMatch(/^ARI-[A-Z]{3}-\d{3}$/);
    }
  });

  it("is idempotent — all proposals marked alreadyExists if files present", async () => {
    const ctx = createMockContext(
      {
        "AGENTS.md": "# exists",
        ".agentignore": "dist/",
      },
      [".devcontainer/devcontainer.json"],
    );

    const proposals = await generateFixProposals(ctx, nodeDetection);
    expect(proposals.every((p) => p.alreadyExists)).toBe(true);
  });

  it("generates for repo with no package.json (Go project)", async () => {
    const goDetection: DetectionResult = {
      languages: [{ language: "go", confidence: 0.9, primary: true }],
      frameworks: [],
      monorepo: null,
    };
    const ctx = createMockContext({
      "go.mod": "module example.com/test",
    });

    const proposals = await generateFixProposals(ctx, goDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");
    expect(agentsMd?.content).toContain("go build");

    const devcontainer = proposals.find((p) => p.path === ".devcontainer/devcontainer.json");
    const config = JSON.parse(devcontainer?.content ?? "{}");
    expect(config.image).toContain("go");
    expect(config.postCreateCommand).toContain("go mod download");
  });

  it("includes detection metadata in AGENTS.md", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");

    expect(agentsMd?.content).toContain("typescript");
    expect(agentsMd?.content).toContain("express");
  });
});
