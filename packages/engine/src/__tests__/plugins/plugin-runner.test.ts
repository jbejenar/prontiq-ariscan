import { describe, it, expect } from "vitest";
import { runPlugins } from "../../plugins/runner.js";
import { createMockContext } from "../helpers.js";
import type { LoadedPlugin, AriscanPlugin } from "../../plugins/types.js";

function createTestPlugin(
  name: string,
  findings: Array<{
    code: string;
    severity: string;
    pillar: string;
    message: string;
  }>,
  options: { shouldThrow?: boolean; delay?: number; summary?: string } = {},
): LoadedPlugin {
  const plugin: AriscanPlugin = {
    manifest: {
      name,
      version: "1.0.0",
      apiVersion: "1.0",
    },
    async analyze() {
      if (options.delay) {
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      }
      if (options.shouldThrow) {
        throw new Error(`Plugin "${name}" crashed`);
      }
      return {
        findings: findings as Array<{
          code: string;
          severity: "low" | "medium" | "high" | "critical" | "info";
          pillar: "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8";
          message: string;
        }>,
        summary: options.summary,
      };
    },
  };

  return { plugin, source: "local", location: "/test/plugins/" + name };
}

describe("Plugin Runner", () => {
  const context = createMockContext({ "package.json": '{ "name": "test" }' });

  it("runs plugins and returns attributed findings", async () => {
    const plugins = [
      createTestPlugin("terraform-check", [
        {
          code: "ARI-SEC-901",
          severity: "medium",
          pillar: "P8",
          message: "No .terraform-lock.hcl found",
        },
      ]),
    ];

    const result = await runPlugins(plugins, context);

    expect(result.findings).toHaveLength(1);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ source: "plugin:terraform-check", code: "ARI-SEC-901" }),
    );
    expect(result.errors).toHaveLength(0);
  });

  it("collects findings from multiple plugins", async () => {
    const plugins = [
      createTestPlugin("plugin-a", [
        { code: "ARI-TST-901", severity: "low", pillar: "P3", message: "Finding A" },
      ]),
      createTestPlugin("plugin-b", [
        { code: "ARI-TST-902", severity: "medium", pillar: "P3", message: "Finding B1" },
        { code: "ARI-TST-903", severity: "high", pillar: "P3", message: "Finding B2" },
      ]),
    ];

    const result = await runPlugins(plugins, context);

    expect(result.findings).toHaveLength(3);
    const sources = result.findings.map((f) => f.source);
    expect(sources).toEqual(["plugin:plugin-a", "plugin:plugin-b", "plugin:plugin-b"]);
  });

  it("isolates plugin errors — one crash does not affect others", async () => {
    const plugins = [
      createTestPlugin("crashing-plugin", [], { shouldThrow: true }),
      createTestPlugin("healthy-plugin", [
        { code: "ARI-TST-901", severity: "low", pillar: "P3", message: "Healthy finding" },
      ]),
    ];

    const result = await runPlugins(plugins, context);

    // Healthy plugin's findings still collected
    expect(result.findings).toHaveLength(1);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ source: "plugin:healthy-plugin" }),
    );

    // Error from crashing plugin recorded
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ pluginName: "crashing-plugin" }),
    );
    expect(result.errors.some((e) => e.error.includes("crashed"))).toBe(true);
  });

  it("times out slow plugins", async () => {
    const plugins = [createTestPlugin("slow-plugin", [], { delay: 5000 })];

    const result = await runPlugins(plugins, context, 100);

    expect(result.findings).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toContainEqual(expect.objectContaining({ pluginName: "slow-plugin" }));
    expect(result.errors.some((e) => e.error.includes("timed out"))).toBe(true);
  });

  it("collects plugin summaries", async () => {
    const plugins = [createTestPlugin("summarizing-plugin", [], { summary: "All checks passed" })];

    const result = await runPlugins(plugins, context);

    expect(result.summaries).toHaveLength(1);
    expect(result.summaries).toContainEqual({
      pluginName: "summarizing-plugin",
      summary: "All checks passed",
    });
  });

  it("returns empty result when no plugins provided", async () => {
    const result = await runPlugins([], context);

    expect(result.findings).toHaveLength(0);
    expect(result.summaries).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("handles plugin returning empty findings array", async () => {
    const plugins = [createTestPlugin("empty-plugin", [])];

    const result = await runPlugins(plugins, context);

    expect(result.findings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
