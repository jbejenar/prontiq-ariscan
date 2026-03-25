import { describe, it, expect } from "vitest";
import { adaptPillarRemediation } from "../scoring/remediation-adapter.js";
import { detectBuildSystems } from "../detection/build-systems.js";
import { generateFixProposals } from "../fix/generators.js";
import { createMockContext } from "./helpers.js";
import type { PillarResult, DetectionResult, RepoProfile, Finding } from "@prontiq/ariscan-schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFinding(code: string, description: string): Finding {
  return {
    code,
    severity: "medium",
    pillar: "P2",
    message: "test",
    scoreImpact: { pillarDelta: 5, compositeDelta: 0.5 },
    remediation: {
      action: "add-script",
      description,
      confidence: "high",
    },
  };
}

function makePillarResult(findings: Finding[]): PillarResult {
  return {
    pillar: "P2",
    name: "Feedback Loop Speed",
    weight: 0.15,
    score: 50,
    summary: "test",
    confidence: "high",
    dataStatus: "sufficient",
    findings,
  };
}

const baseDetection: DetectionResult = {
  languages: [{ language: "TypeScript", confidence: 0.9, primary: true }],
  frameworks: [],
  monorepo: null,
  buildSystems: [],
};

/** Extract the remediation description from the first finding of the first pillar. */
function getDesc(results: PillarResult[]): string {
  const pillar = results[0];
  const finding = pillar?.findings[0];
  return finding?.remediation?.description ?? "";
}

const defaultProfile: RepoProfile = {
  archetype: "small-team",
  confidence: "high",
  signals: [],
  fileCount: 50,
  sourceFileCount: 30,
  hasCI: true,
};

// ---------------------------------------------------------------------------
// Build system detection
// ---------------------------------------------------------------------------

describe("detectBuildSystems", () => {
  it("detects Makefile", async () => {
    const ctx = createMockContext({ Makefile: "all: build" });
    const bs = await detectBuildSystems(ctx);
    expect(bs).toContain("make");
  });

  it("detects Docker Compose", async () => {
    const ctx = createMockContext({ "docker-compose.yml": "services:" });
    const bs = await detectBuildSystems(ctx);
    expect(bs).toContain("docker-compose");
  });

  it("detects Poetry from pyproject.toml", async () => {
    const ctx = createMockContext({
      "pyproject.toml": "[tool.poetry]\nname = 'myproject'",
    });
    const bs = await detectBuildSystems(ctx);
    expect(bs).toContain("poetry");
  });

  it("does not detect Poetry for non-Poetry pyproject.toml", async () => {
    const ctx = createMockContext({
      "pyproject.toml": "[build-system]\nrequires = ['setuptools']",
    });
    const bs = await detectBuildSystems(ctx);
    expect(bs).not.toContain("poetry");
  });

  it("detects Cargo", async () => {
    const ctx = createMockContext({ "Cargo.toml": "[package]\nname = 'myapp'" });
    const bs = await detectBuildSystems(ctx);
    expect(bs).toContain("cargo");
  });

  it("detects Go modules", async () => {
    const ctx = createMockContext({ "go.mod": "module example.com/foo" });
    const bs = await detectBuildSystems(ctx);
    expect(bs).toContain("go");
  });

  it("detects Maven", async () => {
    const ctx = createMockContext({ "pom.xml": "<project></project>" });
    const bs = await detectBuildSystems(ctx);
    expect(bs).toContain("maven");
  });

  it("detects Gradle", async () => {
    const ctx = createMockContext({ "build.gradle": "plugins {}" });
    const bs = await detectBuildSystems(ctx);
    expect(bs).toContain("gradle");
  });

  it("detects pnpm lockfile", async () => {
    const ctx = createMockContext({ "pnpm-lock.yaml": "lockfileVersion: 9" });
    const bs = await detectBuildSystems(ctx);
    expect(bs).toContain("pnpm");
  });

  it("detects multiple build systems", async () => {
    const ctx = createMockContext({
      Makefile: "all: build",
      "docker-compose.yml": "services:",
      "go.mod": "module example.com/foo",
    });
    const bs = await detectBuildSystems(ctx);
    expect(bs).toContain("make");
    expect(bs).toContain("docker-compose");
    expect(bs).toContain("go");
  });
});

// ---------------------------------------------------------------------------
// Build-tool-aware remediation
// ---------------------------------------------------------------------------

describe("adaptPillarRemediation — build-tool awareness", () => {
  it("adapts ARI-FBK-001 for Make-based projects", () => {
    const finding = makeFinding("ARI-FBK-001", "Add a 'test' script to package.json");
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["make"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).toContain("Makefile");
    expect(desc).not.toContain("package.json");
  });

  it("adapts ARI-FBK-001 for Poetry projects", () => {
    const finding = makeFinding("ARI-FBK-001", "Add a 'test' script to package.json");
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["poetry"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).toContain("Poetry");
    expect(desc).not.toContain("package.json");
  });

  it("adapts ARI-FBK-001 for Go projects", () => {
    const finding = makeFinding("ARI-FBK-001", "Add a 'test' script to package.json");
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["go"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).toContain("go test");
  });

  it("adapts ARI-FBK-001 for Cargo projects", () => {
    const finding = makeFinding("ARI-FBK-001", "Add a 'test' script to package.json");
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["cargo"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).toContain("cargo test");
  });

  it("adapts ARI-FBK-002 for Make-based projects", () => {
    const finding = makeFinding(
      "ARI-FBK-002",
      "Add a 'lint' script to package.json with ESLint or equivalent",
    );
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["make"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).toContain("Makefile");
  });

  it("adapts ARI-FBK-008 for Make-based projects (no Turborepo suggestion)", () => {
    const finding = makeFinding("ARI-FBK-008", "Add Turborepo or Nx for incremental/cached builds");
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["make"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).not.toContain("Turborepo");
    expect(desc).toContain("Make");
  });

  it("adapts ARI-FBK-008 for Docker Compose projects", () => {
    const finding = makeFinding("ARI-FBK-008", "Add Turborepo or Nx for incremental/cached builds");
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["docker-compose"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).not.toContain("Turborepo");
    expect(desc).toContain("Docker Compose");
  });

  it("adapts ARI-FBK-008 for Cargo projects", () => {
    const finding = makeFinding("ARI-FBK-008", "Add Turborepo or Nx for incremental/cached builds");
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["cargo"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).not.toContain("Turborepo");
    expect(desc).toContain("Cargo");
  });

  it("does not adapt findings without remediation", () => {
    const noRemFinding: Finding = {
      code: "ARI-FBK-001",
      severity: "medium",
      pillar: "P2",
      message: "test",
      scoreImpact: { pillarDelta: 5, compositeDelta: 0.5 },
    };
    const results = adaptPillarRemediation(
      [makePillarResult([noRemFinding])],
      { ...baseDetection, buildSystems: ["make"] },
      defaultProfile,
    );
    const resultFinding = results[0]?.findings[0];
    expect(resultFinding?.remediation).toBeUndefined();
  });

  it("preserves remediation action and confidence", () => {
    const finding = makeFinding("ARI-FBK-001", "Add a 'test' script to package.json");
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["make"] },
      defaultProfile,
    );
    const adapted = results[0]?.findings[0];
    expect(adapted?.remediation?.action).toBe("add-script");
    expect(adapted?.remediation?.confidence).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Archetype-aware remediation
// ---------------------------------------------------------------------------

describe("adaptPillarRemediation — archetype awareness", () => {
  it("adapts ARI-SEC-001 for solo-hobby with growth-oriented language", () => {
    const finding = makeFinding("ARI-SEC-001", "Add a CODEOWNERS file to define code ownership");
    if (finding.remediation) finding.remediation.action = "create-file";
    const results = adaptPillarRemediation([makePillarResult([finding])], baseDetection, {
      ...defaultProfile,
      archetype: "solo-hobby",
    });
    const desc = getDesc(results);
    expect(desc).toContain("Consider");
    expect(desc).toContain("grows");
  });

  it("adapts ARI-SEC-002 for solo-hobby", () => {
    const finding = makeFinding(
      "ARI-SEC-002",
      "Add a SECURITY.md with vulnerability reporting instructions",
    );
    const results = adaptPillarRemediation([makePillarResult([finding])], baseDetection, {
      ...defaultProfile,
      archetype: "solo-hobby",
    });
    const desc = getDesc(results);
    expect(desc).toContain("Consider");
  });

  it("adapts ARI-SEC-004 for solo-hobby", () => {
    const finding = makeFinding(
      "ARI-SEC-004",
      "Enable Dependabot or Renovate for automated dependency updates",
    );
    const results = adaptPillarRemediation([makePillarResult([finding])], baseDetection, {
      ...defaultProfile,
      archetype: "solo-hobby",
    });
    const desc = getDesc(results);
    expect(desc).toContain("Consider");
  });

  it("adapts ARI-SEC-005 for library archetype", () => {
    const finding = makeFinding("ARI-SEC-005", "Add a pull request template");
    const results = adaptPillarRemediation([makePillarResult([finding])], baseDetection, {
      ...defaultProfile,
      archetype: "library",
    });
    const desc = getDesc(results);
    expect(desc).toContain("API surface");
    expect(desc).toContain("breaking changes");
  });

  it("does not adapt findings for monorepo-enterprise archetype", () => {
    const finding = makeFinding("ARI-SEC-001", "Add a CODEOWNERS file to define code ownership");
    const results = adaptPillarRemediation([makePillarResult([finding])], baseDetection, {
      ...defaultProfile,
      archetype: "monorepo-enterprise",
    });
    const desc = getDesc(results);
    expect(desc).toBe("Add a CODEOWNERS file to define code ownership");
  });
});

// ---------------------------------------------------------------------------
// No cross-ecosystem contamination
// ---------------------------------------------------------------------------

describe("adaptPillarRemediation — no cross-ecosystem contamination", () => {
  it("Make project does not get Turborepo suggestions", () => {
    const finding = makeFinding("ARI-FBK-008", "Add Turborepo or Nx for incremental/cached builds");
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["make"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).not.toContain("Turborepo");
    expect(desc).not.toContain("Nx");
  });

  it("Poetry project does not get npm suggestions for linting", () => {
    const finding = makeFinding(
      "ARI-FBK-002",
      "Add a 'lint' script to package.json with ESLint or equivalent",
    );
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["poetry"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).not.toContain("package.json");
    expect(desc).not.toContain("ESLint");
  });

  it("Go project does not get npm suggestions for testing", () => {
    const finding = makeFinding("ARI-FBK-001", "Add a 'test' script to package.json");
    const results = adaptPillarRemediation(
      [makePillarResult([finding])],
      { ...baseDetection, buildSystems: ["go"] },
      defaultProfile,
    );
    const desc = getDesc(results);
    expect(desc).not.toContain("package.json");
  });
});

// ---------------------------------------------------------------------------
// Fix generators with profile awareness
// ---------------------------------------------------------------------------

describe("generateFixProposals — profile-aware", () => {
  it("adapts CODEOWNERS rationale for solo-hobby", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ scripts: { test: "vitest", lint: "eslint" } }),
      "src/index.ts": "export const x = 1;",
      "pnpm-lock.yaml": "",
    });
    const detection: DetectionResult = {
      ...baseDetection,
      buildSystems: ["pnpm"],
    };
    const profile: RepoProfile = {
      ...defaultProfile,
      archetype: "solo-hobby",
    };
    const proposals = await generateFixProposals(ctx, detection, profile);
    const codeowners = proposals.find((p) => p.path.includes("CODEOWNERS"));
    if (codeowners) {
      expect(codeowners.rationale).toContain("Consider");
    }
  });

  it("adapts PR template rationale for library archetype", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({
        scripts: { test: "vitest", lint: "eslint" },
        main: "dist/index.js",
        exports: { ".": "./dist/index.js" },
      }),
      "src/index.ts": "export const x = 1;",
      "pnpm-lock.yaml": "",
    });
    const detection: DetectionResult = {
      ...baseDetection,
      buildSystems: ["pnpm"],
    };
    const profile: RepoProfile = {
      ...defaultProfile,
      archetype: "library",
    };
    const proposals = await generateFixProposals(ctx, detection, profile);
    const prTemplate = proposals.find((p) => p.path.includes("pull_request_template"));
    if (prTemplate) {
      expect(prTemplate.rationale).toContain("API surface");
    }
  });
});
