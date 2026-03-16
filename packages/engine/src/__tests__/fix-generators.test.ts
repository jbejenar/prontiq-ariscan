import { describe, it, expect } from "vitest";
import { generateFixProposals } from "../fix/generators.js";
import type { TemplateMetadata } from "../fix/generators.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";
import { createMockContext } from "./helpers.js";

/** Helper: assert metadata has all required fields. */
function assertValidMetadata(metadata: TemplateMetadata): void {
  expect(Array.isArray(metadata.prerequisites)).toBe(true);
  expect(metadata.prerequisites.length).toBeGreaterThan(0);
  expect(Array.isArray(metadata.steps)).toBe(true);
  expect(metadata.steps.length).toBeGreaterThan(0);
  expect(typeof metadata.rollbackAdvice).toBe("string");
  expect(metadata.rollbackAdvice.length).toBeGreaterThan(0);
  expect(typeof metadata.expectedImpact.pillar).toBe("string");
  expect(metadata.expectedImpact.pillar).toMatch(/^P\d$/);
  expect(typeof metadata.expectedImpact.estimatedDelta).toBe("string");
  expect(metadata.expectedImpact.estimatedDelta.length).toBeGreaterThan(0);
}

const tsDetection: DetectionResult = {
  languages: [{ language: "TypeScript", confidence: 0.9, primary: true }],
  frameworks: [],
  monorepo: null,
};

const pyDetection: DetectionResult = {
  languages: [{ language: "Python", confidence: 0.9, primary: true }],
  frameworks: [{ framework: "fastapi", confidence: 0.8 }],
  monorepo: null,
};

const jsDetection: DetectionResult = {
  languages: [{ language: "JavaScript", confidence: 0.9, primary: true }],
  frameworks: [],
  monorepo: null,
};

const monorepoDetection: DetectionResult = {
  languages: [{ language: "TypeScript", confidence: 0.9, primary: true }],
  frameworks: [{ framework: "nestjs", confidence: 0.8 }],
  monorepo: {
    tool: "pnpm-workspaces",
    workspaceRoot: "/mock/repo",
    packages: ["packages/schema", "packages/engine", "packages/cli"],
  },
};

describe("fix generators — template metadata (P2.06)", () => {
  it("every proposal has valid metadata", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { build: "tsc", test: "vitest", lint: "eslint" } }),
      "src/index.ts": "export const x = 1;",
      "pnpm-lock.yaml": "",
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    expect(proposals.length).toBeGreaterThan(0);

    for (const proposal of proposals) {
      assertValidMetadata(proposal.metadata);
    }
  });

  it("AGENTS.md metadata references P1 pillar", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { build: "tsc" } }),
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");
    expect(agentsMd).toBeDefined();
    if (!agentsMd) return;
    expect(agentsMd.metadata.expectedImpact.pillar).toBe("P1");
  });

  it("devcontainer metadata references P4 pillar", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: {} }),
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    const devcontainer = proposals.find((p) => p.path === ".devcontainer/devcontainer.json");
    expect(devcontainer).toBeDefined();
    if (!devcontainer) return;
    expect(devcontainer.metadata.expectedImpact.pillar).toBe("P4");
  });

  it("storage provider metadata references P3 pillar", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: {} }),
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    const provider = proposals.find((p) => p.path === "src/providers/storage.provider.ts");
    expect(provider).toBeDefined();
    if (!provider) return;
    expect(provider.metadata.expectedImpact.pillar).toBe("P3");
  });

  it("PR template metadata references P8 pillar", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: {} }),
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    const prTemplate = proposals.find((p) => p.path === ".github/pull_request_template.md");
    expect(prTemplate).toBeDefined();
    if (!prTemplate) return;
    expect(prTemplate.metadata.expectedImpact.pillar).toBe("P8");
    expect(prTemplate.metadata.prerequisites).toContain("Repository hosted on GitHub");
  });
});

describe("fix generators — monorepo progressive disclosure (P2.06)", () => {
  it("includes monorepo structure section when monorepo detected", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { build: "tsc" } }),
      "pnpm-workspace.yaml": "",
      "packages/schema/package.json": "{}",
      "packages/engine/package.json": "{}",
      "packages/cli/package.json": "{}",
    });

    const proposals = await generateFixProposals(ctx, monorepoDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");
    expect(agentsMd).toBeDefined();
    if (!agentsMd) return;
    expect(agentsMd.content).toContain("## Monorepo Structure");
    expect(agentsMd.content).toContain("pnpm-workspaces");
    expect(agentsMd.content).toContain("packages/schema");
    expect(agentsMd.content).toContain("packages/engine");
    expect(agentsMd.content).toContain("packages/cli");
    expect(agentsMd.content).toContain("### Build Order & Dependencies");
    expect(agentsMd.content).toContain("### Package-Level Commands");
  });

  it("omits monorepo section when no monorepo detected", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { build: "tsc" } }),
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");
    expect(agentsMd).toBeDefined();
    if (!agentsMd) return;
    expect(agentsMd.content).not.toContain("## Monorepo Structure");
  });
});

describe("fix generators — env var schema (P2.06)", () => {
  it("generates Zod schema for TypeScript projects", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({
        scripts: { build: "tsc" },
        dependencies: { zod: "^3.0.0" },
      }),
      "src/index.ts": "export const x = 1;",
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    const schema = proposals.find((p) => p.path === "src/config/env.ts");
    expect(schema).toBeDefined();
    if (!schema) return;
    expect(schema.content).toContain("import { z }");
    expect(schema.content).toContain("z.object");
    expect(schema.content).toContain("envSchema.parse(process.env)");
    expect(schema.criterion).toBe("ARI-DOC-002");
    assertValidMetadata(schema.metadata);
  });

  it("generates pydantic schema for Python projects", async () => {
    const ctx = createMockContext({
      "pyproject.toml": "[project]\nname = 'myapp'",
      "src/main.py": "print('hello')",
    });

    const proposals = await generateFixProposals(ctx, pyDetection);
    const schema = proposals.find((p) => p.path === "src/config/env.py");
    expect(schema).toBeDefined();
    if (!schema) return;
    expect(schema.content).toContain("pydantic_settings");
    expect(schema.content).toContain("BaseSettings");
    expect(schema.content).toContain("settings = Settings()");
    assertValidMetadata(schema.metadata);
  });

  it("skips env var schema when config file already exists", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { build: "tsc" } }),
      "src/config/env.ts": "export const env = {};",
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    const schema = proposals.find((p) => p.path === "src/config/env.ts");
    expect(schema).toBeUndefined();
  });

  it("skips env var schema when JS config file already exists", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { start: "node index.js" } }),
      "src/config/env.js": "module.exports = { port: process.env.PORT };",
    });

    const proposals = await generateFixProposals(ctx, jsDetection);
    const schema = proposals.find((p) => p.path === "src/config/env.js");
    expect(schema).toBeUndefined();
  });

  it("skips env var schema when src/env.js already exists in JS repo", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { start: "node index.js" } }),
      "src/env.js": "module.exports = {};",
    });

    const proposals = await generateFixProposals(ctx, jsDetection);
    const schema = proposals.find((p) => p.path === "src/config/env.js");
    expect(schema).toBeUndefined();
  });

  it("skips env var schema when src/config.js already exists in JS repo", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { start: "node index.js" } }),
      "src/config.js": "module.exports = {};",
    });

    const proposals = await generateFixProposals(ctx, jsDetection);
    const schema = proposals.find((p) => p.path === "src/config/env.js");
    expect(schema).toBeUndefined();
  });

  it("skips env var schema when TypeScript repo already has JS config file", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { build: "tsc" } }),
      "src/config/env.js": "module.exports = { port: process.env.PORT };",
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    const schema = proposals.find((p) => p.path === "src/config/env.ts");
    expect(schema).toBeUndefined();
  });

  it("skips env var schema when TypeScript repo already has src/env.js", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { build: "tsc" } }),
      "src/env.js": "module.exports = {};",
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    const schema = proposals.find((p) => p.path === "src/config/env.ts");
    expect(schema).toBeUndefined();
  });

  it("skips env var schema when TypeScript repo already has src/config.js", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { build: "tsc" } }),
      "src/config.js": "module.exports = {};",
    });

    const proposals = await generateFixProposals(ctx, tsDetection);
    const schema = proposals.find((p) => p.path === "src/config/env.ts");
    expect(schema).toBeUndefined();
  });
});

describe("fix generators — framework-aware templates (P2.06)", () => {
  it("generates NestJS DI wiring for nestjs framework", async () => {
    const nestDetection: DetectionResult = {
      languages: [{ language: "TypeScript", confidence: 0.9, primary: true }],
      frameworks: [{ framework: "nestjs", confidence: 0.8 }],
      monorepo: null,
    };

    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: {} }),
    });

    const proposals = await generateFixProposals(ctx, nestDetection);
    const diWiring = proposals.find((p) => p.path === "src/providers/storage.module.example.ts");
    expect(diWiring).toBeDefined();
    if (!diWiring) return;
    expect(diWiring.content).toContain("@Module");
    expect(diWiring.content).toContain("NestJS");
    assertValidMetadata(diWiring.metadata);
  });

  it("generates FastAPI DI wiring for FastAPI framework", async () => {
    const ctx = createMockContext({
      "pyproject.toml": "[project]\nname = 'myapp'",
    });

    const proposals = await generateFixProposals(ctx, pyDetection);
    const diWiring = proposals.find((p) => p.path === "src/providers/storage_provider.example.py");
    expect(diWiring).toBeDefined();
    if (!diWiring) return;
    expect(diWiring.content).toContain("FastAPI");
    expect(diWiring.content).toContain("Depends");
    assertValidMetadata(diWiring.metadata);
  });
});
