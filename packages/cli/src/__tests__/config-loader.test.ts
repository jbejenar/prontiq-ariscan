/** Tests for config file loading, merging, and CLI flag resolution. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadConfigFile,
  fileConfigToScanConfig,
  findConfigFile,
  resolveInheritance,
  resolveProfile,
  filterSuppressions,
  extractPolicyMeta,
} from "../config-loader.js";
import type {
  FileConfig as FileConfigType,
  Suppression as SuppressionType,
} from "@prontiq/ariscan-schema";
import * as fs from "node:fs/promises";
import { join } from "node:path";

vi.mock("node:fs/promises");

const mockedFs = vi.mocked(fs);

describe("loadConfigFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("parses a valid .ariscan.yml with threshold", async () => {
    mockedFs.readFile.mockResolvedValue("threshold: 70\n");
    const config = await loadConfigFile("/repo/.ariscan.yml");
    expect(config.threshold).toBe(70);
  });

  it("parses a valid .ariscan.yml with format", async () => {
    mockedFs.readFile.mockResolvedValue("format: json\n");
    const config = await loadConfigFile("/repo/.ariscan.yml");
    expect(config.format).toBe("json");
  });

  it("parses pillar exclusions", async () => {
    const yaml = `
pillars:
  exclude:
    - P3
    - P8
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const config = await loadConfigFile("/repo/.ariscan.yml");
    expect(config.pillars?.exclude).toEqual(["P3", "P8"]);
  });

  it("parses pillar weight overrides", async () => {
    const yaml = `
pillars:
  weights:
    P1: 0.25
    P2: 0.10
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const config = await loadConfigFile("/repo/.ariscan.yml");
    expect(config.pillars?.weights).toEqual({ P1: 0.25, P2: 0.1 });
  });

  it("returns empty config for empty YAML", async () => {
    mockedFs.readFile.mockResolvedValue("");
    const config = await loadConfigFile("/repo/.ariscan.yml");
    expect(config).toEqual({});
  });

  it("throws on invalid config values", async () => {
    mockedFs.readFile.mockResolvedValue("threshold: 200\n");
    await expect(loadConfigFile("/repo/.ariscan.yml")).rejects.toThrow();
  });

  it("throws on invalid pillar ID in exclude", async () => {
    const yaml = `
pillars:
  exclude:
    - INVALID
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    await expect(loadConfigFile("/repo/.ariscan.yml")).rejects.toThrow();
  });

  it("parses enforcement mode", async () => {
    mockedFs.readFile.mockResolvedValue("enforcement: fail\n");
    const config = await loadConfigFile("/repo/.ariscan.yml");
    expect(config.enforcement).toBe("fail");
  });

  it("parses suppressions", async () => {
    const yaml = `
suppressions:
  - code: ARI-CTX-001
    reason: "Legacy module"
    expiry: "2026-12-31"
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const config = await loadConfigFile("/repo/.ariscan.yml");
    expect(config.suppressions).toHaveLength(1);
    expect(config.suppressions?.[0]?.code).toBe("ARI-CTX-001");
  });

  it("parses thresholds with per-pillar values", async () => {
    const yaml = `
thresholds:
  composite: 70
  pillars:
    P1: 60
    P8: 40
`;
    mockedFs.readFile.mockResolvedValue(yaml);
    const config = await loadConfigFile("/repo/.ariscan.yml");
    expect(config.thresholds?.composite).toBe(70);
    expect(config.thresholds?.pillars?.P1).toBe(60);
  });
});

describe("fileConfigToScanConfig", () => {
  it("converts threshold", () => {
    const result = fileConfigToScanConfig({ threshold: 60 });
    expect(result.threshold).toBe(60);
  });

  it("converts format", () => {
    const result = fileConfigToScanConfig({ format: "json" });
    expect(result.format).toBe("json");
  });

  it("converts pillar exclusions to enabled: false", () => {
    const result = fileConfigToScanConfig({
      pillars: { exclude: ["P3", "P8"] },
    });
    expect(result.pillars?.P3?.enabled).toBe(false);
    expect(result.pillars?.P8?.enabled).toBe(false);
  });

  it("converts pillar weight overrides", () => {
    const result = fileConfigToScanConfig({
      pillars: { weights: { P1: 0.25 } },
    });
    expect(result.pillars?.P1?.weight).toBe(0.25);
  });

  it("handles combined exclusions and weights", () => {
    const result = fileConfigToScanConfig({
      pillars: {
        exclude: ["P8"],
        weights: { P1: 0.2, P8: 0.05 },
      },
    });
    // P8 should be disabled AND have weight
    expect(result.pillars?.P8?.enabled).toBe(false);
    expect(result.pillars?.P8?.weight).toBe(0.05);
    expect(result.pillars?.P1?.weight).toBe(0.2);
  });

  it("returns empty object for empty config", () => {
    const result = fileConfigToScanConfig({});
    expect(result).toEqual({});
  });

  it("prefers thresholds.composite over flat threshold", () => {
    const result = fileConfigToScanConfig({
      threshold: 60,
      thresholds: { composite: 80 },
    });
    expect(result.threshold).toBe(80);
  });

  it("falls back to flat threshold when thresholds.composite is absent", () => {
    const result = fileConfigToScanConfig({
      threshold: 60,
      thresholds: { pillars: { P1: 50 } },
    });
    expect(result.threshold).toBe(60);
  });

  it("passes through suppressions", () => {
    const result = fileConfigToScanConfig({
      suppressions: [{ code: "ARI-CTX-001", reason: "test", expiry: "no-expiry" }],
    });
    expect(result.suppressions).toHaveLength(1);
  });
});

describe("findConfigFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("finds config in the start directory", async () => {
    mockedFs.readFile.mockImplementation((path) => {
      if (String(path) === join("/repo", ".ariscan.yml")) {
        return Promise.resolve("threshold: 50\n");
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const found = await findConfigFile("/repo");
    expect(found).toBe(join("/repo", ".ariscan.yml"));
  });

  it("walks up directories to find config", async () => {
    mockedFs.readFile.mockImplementation((path) => {
      if (String(path) === join("/parent", ".ariscan.yml")) {
        return Promise.resolve("threshold: 50\n");
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const found = await findConfigFile("/parent/child/grandchild");
    expect(found).toBe(join("/parent", ".ariscan.yml"));
  });

  it("returns undefined when no config found", async () => {
    mockedFs.readFile.mockRejectedValue(new Error("ENOENT"));
    const found = await findConfigFile("/some/deep/path");
    expect(found).toBeUndefined();
  });
});

describe("resolveInheritance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns config unchanged when no extends", async () => {
    const config: FileConfigType = { threshold: 70 };
    const result = await resolveInheritance(config, "/repo/.ariscan.yml");
    expect(result.threshold).toBe(70);
  });

  it("merges parent config with child overrides", async () => {
    mockedFs.readFile.mockResolvedValue("threshold: 50\nenforcement: warn\n");
    const child: FileConfigType = {
      extends: "./base.yml",
      threshold: 70,
    };
    const result = await resolveInheritance(child, "/repo/.ariscan.yml");
    expect(result.threshold).toBe(70); // child wins
    expect(result.enforcement).toBe("warn"); // inherited from parent
  });

  it("detects circular inheritance", async () => {
    // Parent points back to itself
    mockedFs.readFile.mockResolvedValue('extends: "./.ariscan.yml"\nthreshold: 50\n');
    const config: FileConfigType = { extends: "./base.yml" };
    await expect(resolveInheritance(config, "/repo/.ariscan.yml")).rejects.toThrow(
      "Circular policy inheritance",
    );
  });
});

describe("resolveProfile", () => {
  it("returns config unchanged when no activeProfile", () => {
    const config: FileConfigType = { threshold: 70 };
    const result = resolveProfile(config);
    expect(result).toEqual(config);
  });

  it("merges active profile thresholds", () => {
    const config: FileConfigType = {
      thresholds: { composite: 60 },
      profiles: {
        strict: {
          name: "Strict",
          thresholds: { composite: 80 },
        },
      },
      activeProfile: "strict",
    };
    const result = resolveProfile(config);
    expect(result.thresholds?.composite).toBe(80);
  });

  it("merges active profile weights", () => {
    const config: FileConfigType = {
      profiles: {
        custom: {
          name: "Custom",
          weights: { P1: 0.25 },
        },
      },
      activeProfile: "custom",
    };
    const result = resolveProfile(config);
    expect(result.pillars?.weights?.P1).toBe(0.25);
  });

  it("throws on missing profile", () => {
    const config: FileConfigType = {
      profiles: { strict: { name: "Strict" } },
      activeProfile: "nonexistent",
    };
    expect(() => resolveProfile(config)).toThrow('Active profile "nonexistent" not found');
  });

  it("throws when activeProfile is set but no profiles defined", () => {
    const config: FileConfigType = {
      activeProfile: "strict",
    };
    expect(() => resolveProfile(config)).toThrow(
      'Active profile "strict" is set but no profiles are defined',
    );
  });
});

describe("filterSuppressions", () => {
  const now = new Date("2026-03-16");

  it("keeps no-expiry suppressions", () => {
    const suppressions: SuppressionType[] = [
      { code: "ARI-CTX-001", reason: "test", expiry: "no-expiry" },
    ];
    const result = filterSuppressions(suppressions, now);
    expect(result).toHaveLength(1);
  });

  it("keeps future-dated suppressions", () => {
    const suppressions: SuppressionType[] = [
      { code: "ARI-CTX-001", reason: "test", expiry: "2026-12-31" },
    ];
    const result = filterSuppressions(suppressions, now);
    expect(result).toHaveLength(1);
  });

  it("removes expired suppressions", () => {
    const suppressions: SuppressionType[] = [
      { code: "ARI-CTX-001", reason: "test", expiry: "2025-01-01" },
    ];
    const result = filterSuppressions(suppressions, now);
    expect(result).toHaveLength(0);
  });

  it("handles mixed active and expired", () => {
    const suppressions: SuppressionType[] = [
      { code: "ARI-CTX-001", reason: "test", expiry: "2025-01-01" },
      { code: "ARI-SEC-001", reason: "test", expiry: "no-expiry" },
      { code: "ARI-BLD-001", reason: "test", expiry: "2027-06-30" },
    ];
    const result = filterSuppressions(suppressions, now);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.code)).toEqual(["ARI-SEC-001", "ARI-BLD-001"]);
  });
});

describe("extractPolicyMeta", () => {
  it("extracts enforcement mode", () => {
    const meta = extractPolicyMeta({ enforcement: "fail" });
    expect(meta.enforcement).toBe("fail");
  });

  it("extracts pillar thresholds", () => {
    const meta = extractPolicyMeta({
      thresholds: { pillars: { P1: 60, P8: 40 } },
    });
    expect(meta.pillarThresholds?.P1).toBe(60);
    expect(meta.pillarThresholds?.P8).toBe(40);
  });

  it("returns empty meta for empty config", () => {
    const meta = extractPolicyMeta({});
    expect(meta.enforcement).toBeUndefined();
    expect(meta.pillarThresholds).toBeUndefined();
  });
});
