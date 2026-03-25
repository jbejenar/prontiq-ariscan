import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SCRIPT_PATH = join(__dirname, "..", "create-codequality.mjs");

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
    findings: [
      {
        code: "ARI-CTX-001",
        severity: "high",
        pillar: "P1",
        file: "README.md",
        line: 1,
        message: "Missing AGENTS.md file",
        remediation: {
          action: "create-file",
          description: "Create an AGENTS.md file",
          confidence: "high",
        },
      },
      {
        code: "ARI-FBK-001",
        severity: "medium",
        pillar: "P2",
        file: "package.json",
        message: "No test command found",
        remediation: {
          action: "modify-config",
          description: "Add a test script",
          confidence: "high",
        },
      },
      {
        code: "ARI-SEC-001",
        severity: "critical",
        pillar: "P8",
        message: "No security policy",
      },
    ],
    ...overrides,
  };
}

describe("create-codequality", () => {
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

  it("generates valid Code Climate JSON", () => {
    const scanPath = writeScan("scan.json", makeScanResult());
    const output = runScript({ ARI_PR_SCAN: scanPath });
    const issues = JSON.parse(output);

    expect(Array.isArray(issues)).toBe(true);
    expect(issues.length).toBe(3);
  });

  it("maps severity correctly", () => {
    const scanPath = writeScan("scan.json", makeScanResult());
    const output = runScript({ ARI_PR_SCAN: scanPath });
    const issues = JSON.parse(output);

    const critical = issues.find((i: Record<string, string>) => i.check_name === "ARI-SEC-001");
    const high = issues.find((i: Record<string, string>) => i.check_name === "ARI-CTX-001");
    const medium = issues.find((i: Record<string, string>) => i.check_name === "ARI-FBK-001");

    expect(critical.severity).toBe("blocker");
    expect(high.severity).toBe("critical");
    expect(medium.severity).toBe("major");
  });

  it("includes file location when available", () => {
    const scanPath = writeScan("scan.json", makeScanResult());
    const output = runScript({ ARI_PR_SCAN: scanPath });
    const issues = JSON.parse(output);

    const withFile = issues.find((i: Record<string, string>) => i.check_name === "ARI-CTX-001");
    expect(withFile.location.path).toBe("README.md");
    expect(withFile.location.lines.begin).toBe(1);
  });

  it("uses default location for findings without file", () => {
    const scanPath = writeScan("scan.json", makeScanResult());
    const output = runScript({ ARI_PR_SCAN: scanPath });
    const issues = JSON.parse(output);

    const noFile = issues.find((i: Record<string, string>) => i.check_name === "ARI-SEC-001");
    expect(noFile.location.path).toBe(".");
    expect(noFile.location.lines.begin).toBe(1);
  });

  it("generates stable fingerprints", () => {
    const scanPath = writeScan("scan.json", makeScanResult());
    const output1 = runScript({ ARI_PR_SCAN: scanPath });
    const output2 = runScript({ ARI_PR_SCAN: scanPath });

    const issues1 = JSON.parse(output1);
    const issues2 = JSON.parse(output2);

    for (let i = 0; i < issues1.length; i++) {
      expect(issues1[i].fingerprint).toBe(issues2[i].fingerprint);
      expect(issues1[i].fingerprint).toMatch(/^[a-f0-9]{32}$/);
    }
  });

  it("skips suppressed findings", () => {
    const scanPath = writeScan(
      "scan.json",
      makeScanResult({
        findings: [
          {
            code: "ARI-CTX-001",
            severity: "high",
            pillar: "P1",
            file: "README.md",
            message: "Missing AGENTS.md",
            suppressed: true,
          },
          {
            code: "ARI-FBK-001",
            severity: "medium",
            pillar: "P2",
            file: "package.json",
            message: "No test command",
          },
        ],
      }),
    );
    const output = runScript({ ARI_PR_SCAN: scanPath });
    const issues = JSON.parse(output);

    expect(issues.length).toBe(1);
    expect(issues[0].check_name).toBe("ARI-FBK-001");
  });

  it("handles empty findings", () => {
    const scanPath = writeScan("scan.json", makeScanResult({ findings: [] }));
    const output = runScript({ ARI_PR_SCAN: scanPath });
    const issues = JSON.parse(output);

    expect(issues).toEqual([]);
  });

  it("combines message and remediation in description", () => {
    const scanPath = writeScan("scan.json", makeScanResult());
    const output = runScript({ ARI_PR_SCAN: scanPath });
    const issues = JSON.parse(output);

    const withRemediation = issues.find(
      (i: Record<string, string>) => i.check_name === "ARI-CTX-001",
    );
    expect(withRemediation.description).toContain("Missing AGENTS.md");
    expect(withRemediation.description).toContain("Create an AGENTS.md");
  });

  it("includes type and categories fields", () => {
    const scanPath = writeScan("scan.json", makeScanResult());
    const output = runScript({ ARI_PR_SCAN: scanPath });
    const issues = JSON.parse(output);

    for (const issue of issues) {
      expect(issue.type).toBe("issue");
      expect(issue.categories).toContain("Style");
    }
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
