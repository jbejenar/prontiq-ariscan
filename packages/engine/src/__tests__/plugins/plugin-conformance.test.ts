import { describe, it, expect } from "vitest";
import { validatePlugin } from "../../plugins/conformance.js";
import type { AriscanPlugin } from "../../plugins/types.js";

function createValidPlugin(overrides: Partial<AriscanPlugin> = {}): AriscanPlugin {
  return {
    manifest: {
      name: "test-plugin",
      version: "1.0.0",
      apiVersion: "1.0",
      description: "A test plugin",
    },
    async analyze() {
      return {
        findings: [
          {
            code: "ARI-TST-901",
            severity: "low",
            pillar: "P3",
            message: "Test finding from plugin",
          },
        ],
        summary: "Test plugin ran successfully",
      };
    },
    ...overrides,
  };
}

describe("Plugin Conformance Suite", () => {
  it("passes for a valid plugin", async () => {
    const plugin = createValidPlugin();
    const result = await validatePlugin(plugin);

    expect(result.passed).toBe(true);
    expect(result.pluginName).toBe("test-plugin");
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it("fails when manifest is missing name", async () => {
    const plugin = createValidPlugin({
      manifest: { name: "", version: "1.0.0", apiVersion: "1.0" },
    });
    const result = await validatePlugin(plugin);

    expect(result.passed).toBe(false);
    const manifestCheck = result.checks.find((c) => c.name === "valid-manifest");
    expect(manifestCheck?.passed).toBe(false);
  });

  it("fails when API version is incompatible (major mismatch)", async () => {
    const plugin = createValidPlugin({
      manifest: {
        name: "old-plugin",
        version: "1.0.0",
        apiVersion: "2.0",
      },
    });
    const result = await validatePlugin(plugin);

    expect(result.passed).toBe(false);
    const apiCheck = result.checks.find((c) => c.name === "api-version-compatible");
    expect(apiCheck?.passed).toBe(false);
  });

  it("passes when API minor version differs", async () => {
    const plugin = createValidPlugin({
      manifest: {
        name: "minor-diff-plugin",
        version: "1.0.0",
        apiVersion: "1.1",
      },
    });
    const result = await validatePlugin(plugin);

    const apiCheck = result.checks.find((c) => c.name === "api-version-compatible");
    expect(apiCheck?.passed).toBe(true);
  });

  it("fails when analyze is not a function", async () => {
    const plugin = {
      manifest: {
        name: "no-analyze-plugin",
        version: "1.0.0",
        apiVersion: "1.0",
      },
    } as unknown as AriscanPlugin;

    const result = await validatePlugin(plugin);

    expect(result.passed).toBe(false);
    const analyzeCheck = result.checks.find((c) => c.name === "has-analyze-function");
    expect(analyzeCheck?.passed).toBe(false);
  });

  it("fails when analyze throws on empty context", async () => {
    const plugin = createValidPlugin({
      async analyze() {
        throw new Error("Cannot handle empty context!");
      },
    });
    const result = await validatePlugin(plugin);

    expect(result.passed).toBe(false);
    const throwCheck = result.checks.find((c) => c.name === "no-throw-on-empty");
    expect(throwCheck?.passed).toBe(false);
    expect(throwCheck?.message).toContain("Cannot handle empty context!");
  });

  it("fails when analyze times out", async () => {
    const plugin = createValidPlugin({
      async analyze() {
        return new Promise((resolve) => setTimeout(resolve, 5000));
      },
    });

    // Use a short timeout for the test
    const result = await validatePlugin(plugin, 100);

    expect(result.passed).toBe(false);
    const timeoutCheck = result.checks.find((c) => c.name === "completes-within-timeout");
    expect(timeoutCheck?.passed).toBe(false);
  });

  it("accepts a plugin that returns zero findings on empty context", async () => {
    const plugin = createValidPlugin({
      async analyze() {
        return { findings: [] };
      },
    });

    const result = await validatePlugin(plugin);
    expect(result.passed).toBe(true);
  });

  it("reports the check names consistently", async () => {
    const plugin = createValidPlugin();
    const result = await validatePlugin(plugin);

    const checkNames = result.checks.map((c) => c.name);
    expect(checkNames).toContain("valid-manifest");
    expect(checkNames).toContain("api-version-compatible");
    expect(checkNames).toContain("has-analyze-function");
    expect(checkNames).toContain("returns-valid-findings");
    expect(checkNames).toContain("completes-within-timeout");
    expect(checkNames).toContain("no-throw-on-empty");
  });
});
