import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfigFile, fileConfigToScanConfig, findConfigFile } from "../config-loader.js";
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
    expect(config.pillars?.weights).toEqual({ P1: 0.25, P2: 0.10 });
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
        weights: { P1: 0.20, P8: 0.05 },
      },
    });
    // P8 should be disabled AND have weight
    expect(result.pillars?.P8?.enabled).toBe(false);
    expect(result.pillars?.P8?.weight).toBe(0.05);
    expect(result.pillars?.P1?.weight).toBe(0.20);
  });

  it("returns empty object for empty config", () => {
    const result = fileConfigToScanConfig({});
    expect(result).toEqual({});
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
