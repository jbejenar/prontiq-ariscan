import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SCRIPT_PATH = join(__dirname, "..", "generate-mr-comment.mjs");

function runScript(env: Record<string, string>): string {
  return execFileSync("node", [SCRIPT_PATH], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function makeScanResult(overrides: Record<string, unknown> = {}): object {
  return {
    score: 75,
    level: "L4",
    levelMeta: { level: "L4", name: "Productive", description: "" },
    securityGateTriggered: false,
    metadata: { version: "1.0.0" },
    pillars: [
      {
        pillar: "P1",
        name: "Agent Context Quality",
        score: 80,
        weight: 0.15,
        status: "excellent",
        findings: [],
        summary: "",
      },
      {
        pillar: "P2",
        name: "Feedback Loop Speed",
        score: 60,
        weight: 0.15,
        status: "good",
        findings: [],
        summary: "",
      },
    ],
    findings: [
      {
        code: "ARI-CTX-001",
        severity: "high",
        pillar: "P1",
        message: "Missing AGENTS.md",
        remediation: {
          action: "create-file",
          description: "Create an AGENTS.md file",
          estimatedImpact: "+5 points",
          confidence: "high",
        },
      },
      {
        code: "ARI-FBK-001",
        severity: "medium",
        pillar: "P2",
        message: "No test command found",
        remediation: {
          action: "modify-config",
          description: "Add a test script to package.json",
          confidence: "high",
        },
      },
    ],
    ...overrides,
  };
}

describe("generate-mr-comment", () => {
  let tmpDir: string;

  function writeScan(name: string, data: object): string {
    const path = join(tmpDir, name);
    writeFileSync(path, JSON.stringify(data));
    return path;
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "ari-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates a basic comment without delta", () => {
    const scanPath = writeScan("pr.json", makeScanResult());
    const output = runScript({ ARI_PR_SCAN: scanPath });

    expect(output).toContain("ARI Score: 75/100 (Productive)");
    expect(output).toContain("📊");
    expect(output).toContain("Agent Context Quality");
    expect(output).toContain("Feedback Loop Speed");
    expect(output).toContain("ARI-CTX-001");
    expect(output).toContain("Prontiq ARI");
  });

  it("generates a comment with positive delta", () => {
    const prPath = writeScan("pr.json", makeScanResult({ score: 80 }));
    const basePath = writeScan(
      "base.json",
      makeScanResult({
        score: 70,
        pillars: [
          {
            pillar: "P1",
            name: "Agent Context Quality",
            score: 70,
            weight: 0.15,
            status: "good",
            findings: [],
            summary: "",
          },
        ],
      }),
    );

    const output = runScript({
      ARI_PR_SCAN: prPath,
      ARI_BASE_SCAN: basePath,
      ARI_DELTA_VALUE: "10",
      ARI_BASE_SCORE: "70",
    });

    expect(output).toContain("📈");
    expect(output).toContain("Delta: +10");
    expect(output).toContain("Delta |");
  });

  it("generates a comment with negative delta", () => {
    const prPath = writeScan("pr.json", makeScanResult({ score: 60 }));
    const basePath = writeScan("base.json", makeScanResult({ score: 70 }));

    const output = runScript({
      ARI_PR_SCAN: prPath,
      ARI_BASE_SCAN: basePath,
      ARI_DELTA_VALUE: "-10",
      ARI_BASE_SCORE: "70",
    });

    expect(output).toContain("📉");
    expect(output).toContain("Delta: -10");
  });

  it("generates a comment with zero delta", () => {
    const prPath = writeScan("pr.json", makeScanResult());
    const basePath = writeScan("base.json", makeScanResult());

    const output = runScript({
      ARI_PR_SCAN: prPath,
      ARI_BASE_SCAN: basePath,
      ARI_DELTA_VALUE: "0",
      ARI_BASE_SCORE: "75",
    });

    expect(output).toContain("➡️");
    expect(output).toContain("±0");
  });

  it("shows security gate warning when triggered", () => {
    const scanPath = writeScan("pr.json", makeScanResult({ securityGateTriggered: true }));
    const output = runScript({ ARI_PR_SCAN: scanPath });

    expect(output).toContain("Security Gate Triggered");
    expect(output).toContain("P8 score below 40%");
  });

  it("handles no findings gracefully", () => {
    const scanPath = writeScan("pr.json", makeScanResult({ findings: [] }));
    const output = runScript({ ARI_PR_SCAN: scanPath });

    expect(output).toContain("ARI Score: 75/100");
    expect(output).not.toContain("Top Recommendations");
  });

  it("skips suppressed findings in recommendations", () => {
    const scanPath = writeScan(
      "pr.json",
      makeScanResult({
        findings: [
          {
            code: "ARI-CTX-001",
            severity: "high",
            pillar: "P1",
            message: "Missing AGENTS.md",
            suppressed: true,
            remediation: {
              action: "create-file",
              description: "Create an AGENTS.md file",
              confidence: "high",
            },
          },
        ],
      }),
    );
    const output = runScript({ ARI_PR_SCAN: scanPath });

    expect(output).not.toContain("ARI-CTX-001");
  });

  it("fails when ARI_PR_SCAN is not set", () => {
    expect(() => {
      execFileSync("node", [SCRIPT_PATH], {
        env: { ...process.env, ARI_PR_SCAN: "" },
        encoding: "utf8",
      });
    }).toThrow();
  });
});
