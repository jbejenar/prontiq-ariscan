import { describe, it, expect, beforeEach } from "vitest";
import { loadPlugins } from "../../plugins/loader.js";
import { writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Plugin Loader", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "ariscan-plugin-test-"));
  });

  it("returns empty when plugin directory does not exist", async () => {
    const result = await loadPlugins("/nonexistent/repo");

    expect(result.plugins).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("returns empty when plugin directory is empty", async () => {
    const pluginDir = join(testDir, ".ariscan/plugins");
    await mkdir(pluginDir, { recursive: true });

    const result = await loadPlugins(testDir);

    expect(result.plugins).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("loads a valid local plugin from a JS file", async () => {
    const pluginDir = join(testDir, ".ariscan/plugins");
    await mkdir(pluginDir, { recursive: true });

    const pluginCode = `
      export default {
        manifest: {
          name: "test-local-plugin",
          version: "1.0.0",
          apiVersion: "1.0",
        },
        async analyze() {
          return { findings: [] };
        },
      };
    `;
    await writeFile(join(pluginDir, "test-plugin.js"), pluginCode);

    const result = await loadPlugins(testDir);

    expect(result.plugins).toHaveLength(1);
    const plugin = result.plugins.find((p) => p.plugin.manifest.name === "test-local-plugin");
    expect(plugin).toBeDefined();
    expect(plugin?.source).toBe("local");
    expect(result.errors).toHaveLength(0);
  });

  it("loads a valid local plugin from a directory with index.js", async () => {
    const pluginDir = join(testDir, ".ariscan/plugins/my-plugin");
    await mkdir(pluginDir, { recursive: true });

    const pluginCode = `
      export default {
        manifest: {
          name: "dir-plugin",
          version: "1.0.0",
          apiVersion: "1.0",
        },
        async analyze() {
          return { findings: [] };
        },
      };
    `;
    await writeFile(join(pluginDir, "index.js"), pluginCode);

    const result = await loadPlugins(testDir);

    expect(result.plugins).toHaveLength(1);
    expect(result.plugins.some((p) => p.plugin.manifest.name === "dir-plugin")).toBe(true);
  });

  it("reports errors for invalid plugins (missing manifest)", async () => {
    const pluginDir = join(testDir, ".ariscan/plugins");
    await mkdir(pluginDir, { recursive: true });

    const pluginCode = `
      export default {
        async analyze() {
          return { findings: [] };
        },
      };
    `;
    await writeFile(join(pluginDir, "bad-plugin.js"), pluginCode);

    const result = await loadPlugins(testDir);

    expect(result.plugins).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors.some((e) => e.error.includes("manifest"))).toBe(true);
  });

  it("reports errors for plugins with incompatible API version", async () => {
    const pluginDir = join(testDir, ".ariscan/plugins");
    await mkdir(pluginDir, { recursive: true });

    const pluginCode = `
      export default {
        manifest: {
          name: "old-api-plugin",
          version: "1.0.0",
          apiVersion: "99.0",
        },
        async analyze() {
          return { findings: [] };
        },
      };
    `;
    await writeFile(join(pluginDir, "old-api.js"), pluginCode);

    const result = await loadPlugins(testDir);

    expect(result.plugins).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors.some((e) => e.error.includes("API version mismatch"))).toBe(true);
  });

  it("deduplicates plugins by name (first wins)", async () => {
    const pluginDir = join(testDir, ".ariscan/plugins");
    await mkdir(pluginDir, { recursive: true });

    const code1 = `
      export default {
        manifest: { name: "dupe", version: "1.0.0", apiVersion: "1.0" },
        async analyze() { return { findings: [], summary: "first" }; },
      };
    `;
    const code2 = `
      export default {
        manifest: { name: "dupe", version: "2.0.0", apiVersion: "1.0" },
        async analyze() { return { findings: [], summary: "second" }; },
      };
    `;
    await writeFile(join(pluginDir, "a-dupe.js"), code1);
    await writeFile(join(pluginDir, "b-dupe.js"), code2);

    const result = await loadPlugins(testDir);

    expect(result.plugins).toHaveLength(1);
    expect(result.plugins.some((p) => p.plugin.manifest.version === "1.0.0")).toBe(true);
  });

  it("loads from custom plugin directory", async () => {
    const customDir = join(testDir, "custom-plugins");
    await mkdir(customDir, { recursive: true });

    const pluginCode = `
      export default {
        manifest: { name: "custom-dir-plugin", version: "1.0.0", apiVersion: "1.0" },
        async analyze() { return { findings: [] }; },
      };
    `;
    await writeFile(join(customDir, "plugin.js"), pluginCode);

    const result = await loadPlugins(testDir, { directory: "custom-plugins" });

    expect(result.plugins).toHaveLength(1);
    expect(result.plugins.some((p) => p.plugin.manifest.name === "custom-dir-plugin")).toBe(true);
  });

  it("reports error for npm packages not found in node_modules", async () => {
    const result = await loadPlugins(testDir, {
      packages: ["ariscan-plugin-nonexistent"],
    });

    expect(result.plugins).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors.some((e) => e.error.includes("not found in node_modules"))).toBe(true);
  });

  it("skips non-JS/TS files in plugin directory", async () => {
    const pluginDir = join(testDir, ".ariscan/plugins");
    await mkdir(pluginDir, { recursive: true });

    await writeFile(join(pluginDir, "README.md"), "# Not a plugin");
    await writeFile(join(pluginDir, "config.json"), "{}");

    const result = await loadPlugins(testDir);

    expect(result.plugins).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
