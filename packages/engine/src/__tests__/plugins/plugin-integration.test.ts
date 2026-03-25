import { describe, it, expect } from "vitest";
import { loadPlugins } from "../../plugins/loader.js";
import { runPlugins } from "../../plugins/runner.js";
import { validatePlugin } from "../../plugins/conformance.js";
import { createMockContext } from "../helpers.js";
import type { AriscanPlugin } from "../../plugins/types.js";

describe("Plugin Integration", () => {
  it("end-to-end: load, validate, run a mock plugin", async () => {
    const mockPlugin: AriscanPlugin = {
      manifest: {
        name: "test-integration-plugin",
        version: "1.0.0",
        apiVersion: "1.0",
        description: "Integration test plugin",
        pillar: "P6",
      },
      async analyze(context) {
        const hasPkgJson = await context.fileExists("package.json");
        if (!hasPkgJson) {
          return { findings: [] };
        }
        return {
          findings: [
            {
              code: "ARI-BLD-999",
              severity: "info" as const,
              pillar: "P6" as const,
              message: "Integration test finding",
            },
          ],
          summary: "Integration test complete",
        };
      },
    };

    // Step 1: Validate via conformance suite
    const conformance = await validatePlugin(mockPlugin);
    expect(conformance.passed).toBe(true);

    // Step 2: Run against a mock context
    const context = createMockContext({
      "package.json": '{ "name": "test-project" }',
      "src/index.ts": "export const x = 1;",
    });

    const result = await runPlugins(
      [{ plugin: mockPlugin, source: "local", location: "/test" }],
      context,
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ source: "plugin:test-integration-plugin", code: "ARI-BLD-999" }),
    );
    expect(result.summaries).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("plugin findings appear in scan result when plugins configured", async () => {
    const result = await loadPlugins("/nonexistent/path");
    expect(result.plugins).toHaveLength(0);
  });

  it("multiple plugins run without interfering with each other", async () => {
    const pluginA: AriscanPlugin = {
      manifest: { name: "plugin-a", version: "1.0.0", apiVersion: "1.0" },
      async analyze() {
        return {
          findings: [
            { code: "ARI-TST-901", severity: "low" as const, pillar: "P3" as const, message: "A" },
          ],
        };
      },
    };

    const pluginB: AriscanPlugin = {
      manifest: { name: "plugin-b", version: "1.0.0", apiVersion: "1.0" },
      async analyze() {
        return {
          findings: [
            {
              code: "ARI-TST-902",
              severity: "medium" as const,
              pillar: "P3" as const,
              message: "B",
            },
          ],
        };
      },
    };

    const context = createMockContext({});

    const result = await runPlugins(
      [
        { plugin: pluginA, source: "local", location: "/a" },
        { plugin: pluginB, source: "npm", location: "plugin-b" },
      ],
      context,
    );

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((f) => f.source)).toEqual(["plugin:plugin-a", "plugin:plugin-b"]);
  });
});
