/** Tests for the policy subcommand (init + validate). */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { validatePolicyFile } from "../commands/policy.js";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises");
const mockedFs = vi.mocked(fs);

describe("validatePolicyFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns no errors for valid minimal config", async () => {
    mockedFs.readFile.mockResolvedValue("threshold: 70\n");
    const errors = await validatePolicyFile("/repo/.ariscan.yml");
    expect(errors).toHaveLength(0);
  });

  it("returns no errors for valid full config", async () => {
    const yaml = `
version: "1"
enforcement: fail
thresholds:
  composite: 70
  pillars:
    P1: 60
    P8: 40
suppressions:
  - code: ARI-CTX-001
    reason: "accepted"
    expiry: "2027-12-31"
profiles:
  strict:
    name: "Strict CI"
    thresholds:
      composite: 80
activeProfile: strict
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const errors = await validatePolicyFile("/repo/.ariscan.yml");
    expect(errors).toHaveLength(0);
  });

  it("reports schema validation errors", async () => {
    mockedFs.readFile.mockResolvedValue("threshold: 200\n");
    const errors = await validatePolicyFile("/repo/.ariscan.yml");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain("Schema validation failed");
  });

  it("reports missing active profile", async () => {
    const yaml = `
profiles:
  strict:
    name: "Strict"
activeProfile: nonexistent
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const errors = await validatePolicyFile("/repo/.ariscan.yml");
    expect(errors.some((e) => e.message.includes("nonexistent"))).toBe(true);
  });

  it("reports active profile without profiles section", async () => {
    const yaml = `activeProfile: strict\n`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const errors = await validatePolicyFile("/repo/.ariscan.yml");
    expect(errors.some((e) => e.message.includes("no profiles defined"))).toBe(true);
  });

  it("reports duplicate suppression codes", async () => {
    const yaml = `
suppressions:
  - code: ARI-CTX-001
    reason: "first"
    expiry: "no-expiry"
  - code: ARI-CTX-001
    reason: "duplicate"
    expiry: "no-expiry"
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const errors = await validatePolicyFile("/repo/.ariscan.yml");
    expect(errors.some((e) => e.message.includes("Duplicate suppression"))).toBe(true);
  });

  it("reports expired suppressions", async () => {
    const yaml = `
suppressions:
  - code: ARI-CTX-001
    reason: "old"
    expiry: "2020-01-01"
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const errors = await validatePolicyFile("/repo/.ariscan.yml");
    expect(errors.some((e) => e.message.includes("expired"))).toBe(true);
  });

  it("reports invalid weight sum when all 8 pillars overridden", async () => {
    const yaml = `
pillars:
  weights:
    P1: 0.1
    P2: 0.1
    P3: 0.1
    P4: 0.1
    P5: 0.1
    P6: 0.1
    P7: 0.1
    P8: 0.1
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const errors = await validatePolicyFile("/repo/.ariscan.yml");
    expect(errors.some((e) => e.message.includes("weights sum"))).toBe(true);
  });

  it("does not flag partial weight overrides", async () => {
    const yaml = `
pillars:
  weights:
    P1: 0.2
    P2: 0.15
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const errors = await validatePolicyFile("/repo/.ariscan.yml");
    // Partial overrides: only 2 of 8 pillars overridden, no sum check
    expect(errors.filter((e) => e.message.includes("weights sum"))).toHaveLength(0);
  });
});
