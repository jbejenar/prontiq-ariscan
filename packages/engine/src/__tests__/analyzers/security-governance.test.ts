import { describe, it, expect } from "vitest";
import { securityGovernanceAnalyzer } from "../../analyzers/security-governance.js";
import { createMockContext } from "../helpers.js";

describe("securityGovernanceAnalyzer (P8)", () => {
  it("always reports pillar P8 with weight 0.05", async () => {
    const ctx = createMockContext({});
    const result = await securityGovernanceAnalyzer.analyze(ctx);
    expect(result.pillar).toBe("P8");
    expect(result.weight).toBe(0.05);
  });

  it("always supports any repo", async () => {
    const ctx = createMockContext({});
    expect(await securityGovernanceAnalyzer.supports(ctx)).toBe(true);
  });

  describe("empty repo", () => {
    it("scores near 0", async () => {
      const ctx = createMockContext({});
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(5);
    });

    it("emits findings for missing CODEOWNERS, SECURITY.md, secrets scanning, dependabot", async () => {
      const ctx = createMockContext({});
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      const codes = result.findings.map((f) => f.code);
      expect(codes).toContain("ARI-SEC-001"); // CODEOWNERS
      expect(codes).toContain("ARI-SEC-002"); // SECURITY.md
      expect(codes).toContain("ARI-SEC-003"); // secrets scanning
      expect(codes).toContain("ARI-SEC-004"); // dependabot/renovate
    });
  });

  describe("repo with CODEOWNERS + SECURITY.md + dependabot", () => {
    it("scores a decent amount", async () => {
      const ctx = createMockContext({
        ".github/CODEOWNERS": "* @team-lead",
        "SECURITY.md": "# Security Policy\nReport vulnerabilities to security@example.com",
        ".github/dependabot.yml": "version: 2\nupdates:\n  - package-ecosystem: npm",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      // CODEOWNERS: 15, SECURITY.md: 10, dependabot: 15 = 40
      expect(result.score).toBeGreaterThanOrEqual(40);
    });

    it("does not emit ARI-SEC-001, ARI-SEC-002, or ARI-SEC-004", async () => {
      const ctx = createMockContext({
        ".github/CODEOWNERS": "* @team-lead",
        "SECURITY.md": "# Security Policy",
        ".github/dependabot.yml": "version: 2",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      const codes = result.findings.map((f) => f.code);
      expect(codes).not.toContain("ARI-SEC-001");
      expect(codes).not.toContain("ARI-SEC-002");
      expect(codes).not.toContain("ARI-SEC-004");
    });
  });

  describe("full security setup", () => {
    const fullSecurityFiles: Record<string, string> = {
      ".github/CODEOWNERS": "* @team-lead\nsrc/security/ @security-team",
      "SECURITY.md": "# Security Policy\nReport to security@example.com",
      ".gitleaks.toml": "[allowlist]\ndescription = 'global'",
      ".github/dependabot.yml": "version: 2\nupdates:\n  - package-ecosystem: npm",
      ".github/workflows/security.yml": [
        "name: Security",
        "on: push",
        "jobs:",
        "  sast:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: github/codeql-action/analyze@v2",
        "      - uses: zricethezav/gitleaks-action@v2",
      ].join("\n"),
      LICENSE: "MIT License",
      ".github/pull_request_template.md": "## Description\n## Checklist",
      ".gitignore": "node_modules/\n.env\ncredentials/\n",
    };

    it("scores high (>= 80)", async () => {
      const ctx = createMockContext(fullSecurityFiles);
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      // CODEOWNERS: 15, SECURITY.md: 10, gitleaks: 15, dependabot: 15,
      // PR with pull_request trigger: 15, SAST (codeql): 15, LICENSE: 5,
      // PR template: 5, .gitignore with .env: 5 = 100
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it("emits no major findings", async () => {
      const ctx = createMockContext(fullSecurityFiles);
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      const highFindings = result.findings.filter(
        (f) => f.severity === "high" || f.severity === "critical",
      );
      expect(highFindings).toHaveLength(0);
    });
  });

  describe("CODEOWNERS in different locations", () => {
    it("detects CODEOWNERS at root", async () => {
      const ctx = createMockContext({ CODEOWNERS: "* @owner" });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-001")).toBe(false);
    });

    it("detects CODEOWNERS in .github/", async () => {
      const ctx = createMockContext({ ".github/CODEOWNERS": "* @owner" });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-001")).toBe(false);
    });

    it("detects CODEOWNERS in docs/", async () => {
      const ctx = createMockContext({ "docs/CODEOWNERS": "* @owner" });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-001")).toBe(false);
    });
  });

  describe("secrets scanning detection", () => {
    it("detects .gitleaks.toml", async () => {
      const ctx = createMockContext({ ".gitleaks.toml": "[allowlist]" });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-003")).toBe(false);
    });

    it("detects .pre-commit-config.yaml", async () => {
      const ctx = createMockContext({
        ".pre-commit-config.yaml":
          "repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-003")).toBe(false);
    });

    it("detects gitleaks in CI workflows", async () => {
      const ctx = createMockContext({
        ".github/workflows/secrets.yml":
          "name: Secrets\njobs:\n  scan:\n    steps:\n      - uses: gitleaks/gitleaks-action@v2",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-003")).toBe(false);
    });

    it("detects trufflehog in CI workflows", async () => {
      const ctx = createMockContext({
        ".github/workflows/security.yml":
          "name: Security\njobs:\n  scan:\n    steps:\n      - run: trufflehog --json .",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-003")).toBe(false);
    });
  });

  describe("dependency audit detection", () => {
    it("detects renovate.json", async () => {
      const ctx = createMockContext({
        "renovate.json": JSON.stringify({ extends: ["config:base"] }),
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-004")).toBe(false);
    });

    it("detects .github/renovate.json", async () => {
      const ctx = createMockContext({
        ".github/renovate.json": JSON.stringify({ extends: ["config:base"] }),
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-004")).toBe(false);
    });
  });

  describe("SAST in workflows", () => {
    it("detects CodeQL", async () => {
      const ctx = createMockContext({
        ".github/workflows/codeql.yml":
          "name: CodeQL\njobs:\n  analyze:\n    steps:\n      - uses: github/codeql-action/analyze@v2",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      // SAST adds 15 points
      expect(result.score).toBeGreaterThanOrEqual(15);
    });

    it("detects semgrep", async () => {
      const ctx = createMockContext({
        ".github/workflows/sast.yml":
          "name: SAST\njobs:\n  scan:\n    steps:\n      - run: semgrep scan",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.score).toBeGreaterThanOrEqual(15);
    });
  });

  describe("branch protection / PR requirements", () => {
    it("gives points when pull_request + enforcement pattern exist", async () => {
      const withEnforcement = createMockContext({
        ".github/workflows/ci.yml":
          "name: CI\non:\n  pull_request:\n    branches: [main]\njobs:\n  check:\n    steps:\n      - name: required status check",
      });
      const without = createMockContext({
        ".github/workflows/ci.yml": "name: CI\non:\n  push:\n    branches: [main]",
      });

      const enforcedResult = await securityGovernanceAnalyzer.analyze(withEnforcement);
      const noPrResult = await securityGovernanceAnalyzer.analyze(without);
      expect(enforcedResult.score).toBeGreaterThan(noPrResult.score);
    });

    it("does not give points for bare pull_request trigger without enforcement patterns", async () => {
      const barepr = createMockContext({
        ".github/workflows/ci.yml":
          "name: CI\non:\n  pull_request:\n    branches: [main]\njobs:\n  build:\n    steps:\n      - run: echo hello",
      });
      const noPr = createMockContext({
        ".github/workflows/ci.yml": "name: CI\non:\n  push:\n    branches: [main]",
      });

      const bareResult = await securityGovernanceAnalyzer.analyze(barepr);
      const noPrResult = await securityGovernanceAnalyzer.analyze(noPr);
      expect(bareResult.score).toBe(noPrResult.score);
    });
  });

  describe("additional governance items", () => {
    it("adds points for LICENSE file", async () => {
      const with_ = createMockContext({ LICENSE: "MIT License" });
      const without_ = createMockContext({});
      const r1 = await securityGovernanceAnalyzer.analyze(with_);
      const r2 = await securityGovernanceAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("adds points for PR template", async () => {
      const with_ = createMockContext({
        ".github/pull_request_template.md": "## Description",
      });
      const without_ = createMockContext({});
      const r1 = await securityGovernanceAnalyzer.analyze(with_);
      const r2 = await securityGovernanceAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("adds points for .gitignore with sensitive patterns", async () => {
      const with_ = createMockContext({
        ".gitignore": "node_modules/\n.env\nsecrets/\n",
      });
      const without_ = createMockContext({
        ".gitignore": "node_modules/\ndist/\n",
      });
      const r1 = await securityGovernanceAnalyzer.analyze(with_);
      const r2 = await securityGovernanceAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });
  });

  describe("AI-specific review checklist in PR templates", () => {
    it("adds points when PR template mentions AI review", async () => {
      const with_ = createMockContext({
        ".github/PULL_REQUEST_TEMPLATE.md":
          "## Description\n## AI Review\n- [ ] Was this code AI-generated?\n- [ ] Have AI changes been reviewed for security?",
      });
      const without_ = createMockContext({
        ".github/PULL_REQUEST_TEMPLATE.md": "## Description\n## Checklist\n- [ ] Tests pass",
      });
      const r1 = await securityGovernanceAnalyzer.analyze(with_);
      const r2 = await securityGovernanceAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("detects LLM/agent/copilot keywords in PR template", async () => {
      const ctx = createMockContext({
        ".github/PULL_REQUEST_TEMPLATE.md":
          "## Checklist\n- [ ] If LLM-generated, verify no hardcoded credentials",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-005")).toBe(false);
    });

    it("emits ARI-SEC-005 when PR template has no AI mentions", async () => {
      const ctx = createMockContext({
        ".github/PULL_REQUEST_TEMPLATE.md": "## Description\n## Testing",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-005")).toBe(true);
    });

    it("emits ARI-SEC-005 when no PR template exists", async () => {
      const ctx = createMockContext({});
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-005")).toBe(true);
    });
  });

  describe("agent scope control detection", () => {
    it("adds points for .agentignore", async () => {
      const with_ = createMockContext({ ".agentignore": "secrets/\n.env" });
      const without_ = createMockContext({});
      const r1 = await securityGovernanceAnalyzer.analyze(with_);
      const r2 = await securityGovernanceAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("adds points for CLAUDE.md", async () => {
      const with_ = createMockContext({ "CLAUDE.md": "# Agent instructions" });
      const without_ = createMockContext({});
      const r1 = await securityGovernanceAnalyzer.analyze(with_);
      const r2 = await securityGovernanceAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("adds points for .copilotignore", async () => {
      const with_ = createMockContext({ ".copilotignore": "secrets/" });
      const without_ = createMockContext({});
      const r1 = await securityGovernanceAnalyzer.analyze(with_);
      const r2 = await securityGovernanceAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("emits ARI-SEC-006 when no agent scope control exists", async () => {
      const ctx = createMockContext({});
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-006")).toBe(true);
    });
  });

  describe("ARI-SEC-007: License compliance tooling", () => {
    it("emits ARI-SEC-007 when no license compliance tooling found", async () => {
      const ctx = createMockContext({});
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-007")).toBe(true);
    });

    it("does not emit ARI-SEC-007 when license-checker found in CI", async () => {
      const ctx = createMockContext({
        ".github/workflows/ci.yml":
          "name: CI\njobs:\n  license:\n    steps:\n      - run: npx license-checker",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-007")).toBe(false);
    });

    it("does not emit ARI-SEC-007 when fossa found in CI", async () => {
      const ctx = createMockContext({
        ".github/workflows/ci.yml":
          "name: CI\njobs:\n  license:\n    steps:\n      - uses: fossa-contrib/fossa-action@v1",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-007")).toBe(false);
    });

    it("does not emit ARI-SEC-007 when license-checker is in package.json scripts", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          scripts: { "license:check": "license-checker --onlyAllow 'MIT;ISC'" },
        }),
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-SEC-007")).toBe(false);
    });
  });

  describe("summary shows configuration status labels", () => {
    it("shows 'configured' for present controls", async () => {
      const ctx = createMockContext({
        ".github/CODEOWNERS": "* @owner",
        ".gitleaks.toml": "[allowlist]",
        ".github/dependabot.yml": "version: 2",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.summary).toContain("CODEOWNERS: configured");
      expect(result.summary).toContain("Secrets scanning: configured");
      expect(result.summary).toContain("Dep audit: configured");
    });

    it("shows 'missing' for absent controls", async () => {
      const ctx = createMockContext({});
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.summary).toContain("CODEOWNERS: missing");
      expect(result.summary).toContain("SAST: missing");
    });
  });

  describe("score clamping", () => {
    it("never exceeds 100", async () => {
      const ctx = createMockContext({
        ".github/CODEOWNERS": "* @owner",
        "SECURITY.md": "# Policy",
        ".gitleaks.toml": "[allowlist]",
        ".github/dependabot.yml": "version: 2",
        ".github/workflows/ci.yml":
          "on: pull_request\njobs:\n  sast:\n    steps:\n      - uses: github/codeql-action/analyze@v2\n      - run: gitleaks detect",
        LICENSE: "MIT",
        ".github/pull_request_template.md": "## Desc",
        ".gitignore": ".env\ncredentials\n",
      });
      const result = await securityGovernanceAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
