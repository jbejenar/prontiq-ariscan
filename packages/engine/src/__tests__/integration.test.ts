import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scan } from "../scan.js";
import type { ScanProgressEvent } from "../scan.js";
import { createRepoContext } from "../context/repo-context.js";
import { detect } from "../detection/index.js";
import { classifyProfile } from "../detection/profile.js";
import { generateFixProposals } from "../fix/index.js";

// Path to test fixtures
const FIXTURES = resolve(import.meta.dirname, "../../../../packages/testing/fixtures");

describe("integration: scan", () => {
  it("scans a hostile repo and returns L1 score", async () => {
    const result = await scan(resolve(FIXTURES, "hostile-repo"));
    expect(result.score).toBeLessThanOrEqual(25);
    expect(result.level).toBe("L1");
    expect(result.pillars).toHaveLength(8);
    expect(result.metadata.rubricVersion).toBe("v1");
  }, 30000);

  it("scans a capable repo and returns L2-L3 score", async () => {
    const result = await scan(resolve(FIXTURES, "capable-repo"));
    expect(result.score).toBeGreaterThanOrEqual(26);
    expect(result.score).toBeLessThanOrEqual(65);
    expect(["L2", "L3"]).toContain(result.level);
  }, 30000);

  it("returns all 8 pillar results", async () => {
    const result = await scan(resolve(FIXTURES, "capable-repo"));
    const pillarIds = result.pillars.map((p) => p.pillar).sort();
    expect(pillarIds).toEqual(["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]);
  }, 30000);

  it("applies correct weights", async () => {
    const result = await scan(resolve(FIXTURES, "capable-repo"));
    for (const pillar of result.pillars) {
      expect(pillar.weight).toBeGreaterThan(0);
      expect(pillar.weight).toBeLessThanOrEqual(1);
    }
    const totalWeight = result.pillars.reduce((sum, p) => sum + p.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 2);
  }, 30000);

  it("includes findings with valid ARI codes", async () => {
    const result = await scan(resolve(FIXTURES, "hostile-repo"));
    expect(result.findings.length).toBeGreaterThan(0);
    for (const finding of result.findings) {
      expect(finding.code).toMatch(/^ARI-[A-Z]{3}-\d{3}$/);
    }
  }, 30000);

  it("security gate caps maturity when P8 < 40", async () => {
    // hostile-repo has no security controls, P8 should be < 40
    const result = await scan(resolve(FIXTURES, "hostile-repo"));
    const p8 = result.pillars.find((p) => p.pillar === "P8");
    if (p8 && p8.score < 40) {
      expect(["L1", "L2"]).toContain(result.level);
    }
  }, 30000);

  it("self-scan produces a reasonable score", async () => {
    const result = await scan(resolve(import.meta.dirname, "../../../.."));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.pillars).toHaveLength(8);
    expect(result.metadata.duration).toBeLessThan(60000);
  }, 60000);
});

describe("integration: scan progress callback", () => {
  it("fires start and done events for each pillar", async () => {
    const events: ScanProgressEvent[] = [];
    await scan(resolve(FIXTURES, "capable-repo"), {}, (event) => {
      events.push(event);
    });

    // Each of the 8 pillars should have a start and done event
    const starts = events.filter((e) => e.status === "start");
    const dones = events.filter((e) => e.status === "done");
    expect(starts).toHaveLength(8);
    expect(dones).toHaveLength(8);

    // All pillar IDs should be present
    const pillarIds = [...new Set(events.map((e) => e.pillar))].sort();
    expect(pillarIds).toEqual(["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]);
  }, 30000);

  it("elapsed times are non-negative and monotonically increasing", async () => {
    const events: ScanProgressEvent[] = [];
    await scan(resolve(FIXTURES, "capable-repo"), {}, (event) => {
      events.push(event);
    });

    for (const event of events) {
      expect(event.elapsed).toBeGreaterThanOrEqual(0);
    }

    // Each pillar's done should be after or equal to its start
    for (const pillar of ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]) {
      const start = events.find((e) => e.pillar === pillar && e.status === "start");
      const done = events.find((e) => e.pillar === pillar && e.status === "done");
      expect(start).toBeDefined();
      expect(done).toBeDefined();
      if (start && done) {
        expect(done.elapsed).toBeGreaterThanOrEqual(start.elapsed);
      }
    }
  }, 30000);

  it("works without onProgress callback (backward compat)", async () => {
    // No callback — should not throw
    const result = await scan(resolve(FIXTURES, "capable-repo"));
    expect(result.score).toBeGreaterThanOrEqual(0);
  }, 30000);
});

describe("integration: scaffold→scan gate", () => {
  let scaffoldDir = "";

  beforeEach(async () => {
    // Create a minimal TypeScript project
    scaffoldDir = await mkdtemp(join(tmpdir(), "ari-scaffold-"));
    await mkdir(join(scaffoldDir, ".git"), { recursive: true });
    await mkdir(join(scaffoldDir, "src"), { recursive: true });

    await writeFile(
      join(scaffoldDir, "package.json"),
      JSON.stringify({
        name: "scaffold-test",
        version: "1.0.0",
        type: "module",
        scripts: {
          build: "tsc",
          test: "vitest run",
          lint: "eslint src/",
          typecheck: "tsc --noEmit",
        },
      }),
    );
    await writeFile(
      join(scaffoldDir, "src/index.ts"),
      'export function hello(): string { return "world"; }\n',
    );
    await writeFile(
      join(scaffoldDir, "src/index.test.ts"),
      [
        'import { describe, it, expect } from "vitest";',
        'import { hello } from "./index.js";',
        'describe("hello", () => {',
        '  it("returns world", () => { expect(hello()).toBe("world"); });',
        "});",
        "",
      ].join("\n"),
    );

    // Generate scaffold via --fix
    const ctx = await createRepoContext(scaffoldDir);
    const detection = await detect(ctx);
    const proposals = await generateFixProposals(ctx, detection);

    // Write all non-existing proposals
    for (const p of proposals) {
      if (!p.alreadyExists && p.content) {
        const filePath = join(scaffoldDir, p.path);
        await mkdir(join(filePath, ".."), { recursive: true });
        await writeFile(filePath, p.content);
      }
    }
  }, 30000);

  afterEach(async () => {
    if (scaffoldDir) {
      await rm(scaffoldDir, { recursive: true, force: true });
    }
  });

  it("scaffold scores at least L3 (46+)", async () => {
    const result = await scan(scaffoldDir);
    expect(result.score).toBeGreaterThanOrEqual(46);
    expect(["L3", "L4", "L5"]).toContain(result.level);
  }, 30000);

  it("scaffold has no pillar below 10", async () => {
    const result = await scan(scaffoldDir);
    for (const pillar of result.pillars) {
      expect(pillar.score).toBeGreaterThanOrEqual(10);
    }
  }, 30000);

  it("scaffold P8 security is above gate threshold (40+)", async () => {
    const result = await scan(scaffoldDir);
    const p8 = result.pillars.find((p) => p.pillar === "P8");
    expect(p8).toBeDefined();
    expect(p8?.score).toBeGreaterThanOrEqual(40);
  }, 30000);
});

describe("integration: context-aware remediation (P2.18)", () => {
  let makeDir: string;

  beforeEach(async () => {
    makeDir = await mkdtemp(join(tmpdir(), "ari-make-"));
    await writeFile(
      join(makeDir, "Makefile"),
      [
        "all: build test",
        "",
        "build:",
        "\tgo build ./...",
        "",
        "test:",
        "\tgo test ./...",
        "",
      ].join("\n"),
    );
    await writeFile(join(makeDir, "go.mod"), "module example.com/foo\n\ngo 1.22\n");
    await mkdir(join(makeDir, "cmd"), { recursive: true });
    await writeFile(join(makeDir, "cmd/main.go"), "package main\n\nfunc main() {}\n");
  });

  afterEach(async () => {
    if (makeDir) {
      await rm(makeDir, { recursive: true, force: true });
    }
  });

  it("Make-based Go project gets build-tool-aware remediation", async () => {
    const result = await scan(makeDir);
    // Detection should include build systems
    expect(result.detection?.buildSystems).toContain("make");
    expect(result.detection?.buildSystems).toContain("go");

    // Check that findings don't suggest npm/pnpm
    const allFindings = result.pillars.flatMap((p) => p.findings);
    for (const finding of allFindings) {
      if (finding.remediation?.description) {
        // No package.json suggestions for Go+Make project
        expect(finding.remediation.description).not.toContain("package.json");
      }
    }
  }, 30000);

  it("--fix for solo-hobby Make project uses growth-oriented language", async () => {
    const ctx = await createRepoContext(makeDir);
    const detection = await detect(ctx);
    const profile = await classifyProfile(ctx, detection);
    // Should classify as solo-hobby (few files, no CI)
    expect(profile.archetype).toBe("solo-hobby");

    const proposals = await generateFixProposals(ctx, detection, profile);
    const codeowners = proposals.find((p) => p.path.includes("CODEOWNERS"));
    if (codeowners) {
      expect(codeowners.rationale).toContain("Consider");
    }
  }, 30000);
});
