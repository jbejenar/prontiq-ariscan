import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseCommunityId,
  validateManifest,
  loadLocalPreset,
  discoverLocalPresets,
} from "../scaffolder/presets/community.js";
import { resolvePreset, isCommunityPreset } from "../scaffolder/presets/index.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "ariscan-community-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("parseCommunityId", () => {
  it("extracts name from community/ prefix", () => {
    expect(parseCommunityId("community/express")).toBe("express");
  });

  it("returns undefined for built-in presets", () => {
    expect(parseCommunityId("bare")).toBeUndefined();
    expect(parseCommunityId("nextjs")).toBeUndefined();
  });

  it("returns undefined for empty name", () => {
    expect(parseCommunityId("community/")).toBeUndefined();
  });

  it("rejects nested paths", () => {
    expect(parseCommunityId("community/a/b")).toBeUndefined();
  });

  it("rejects directory traversal", () => {
    expect(parseCommunityId("community/..")).toBeUndefined();
  });
});

describe("isCommunityPreset", () => {
  it("returns true for community/ prefix", () => {
    expect(isCommunityPreset("community/express")).toBe(true);
  });

  it("returns false for built-in presets", () => {
    expect(isCommunityPreset("bare")).toBe(false);
  });
});

describe("validateManifest", () => {
  it("accepts valid manifest", () => {
    expect(
      validateManifest({
        id: "express",
        name: "Express API",
        description: "Express preset",
        version: "0.1.0",
      }),
    ).toBeUndefined();
  });

  it("accepts manifest with optional fields", () => {
    expect(
      validateManifest({
        id: "express",
        name: "Express API",
        description: "Express preset",
        version: "0.1.0",
        author: "Test",
        repository: "https://github.com/test/test",
      }),
    ).toBeUndefined();
  });

  it("rejects null", () => {
    expect(validateManifest(null)).toContain("non-null object");
  });

  it("rejects missing id", () => {
    expect(
      validateManifest({
        name: "Express",
        description: "d",
        version: "1.0.0",
      }),
    ).toContain("id");
  });

  it("rejects empty id", () => {
    expect(
      validateManifest({
        id: "",
        name: "Express",
        description: "d",
        version: "1.0.0",
      }),
    ).toContain("id");
  });

  it("rejects missing name", () => {
    expect(
      validateManifest({
        id: "express",
        description: "d",
        version: "1.0.0",
      }),
    ).toContain("name");
  });

  it("rejects missing description", () => {
    expect(
      validateManifest({
        id: "express",
        name: "Express",
        version: "1.0.0",
      }),
    ).toContain("description");
  });

  it("rejects missing version", () => {
    expect(
      validateManifest({
        id: "express",
        name: "Express",
        description: "d",
      }),
    ).toContain("version");
  });

  it("rejects non-string author", () => {
    expect(
      validateManifest({
        id: "express",
        name: "Express",
        description: "d",
        version: "1.0.0",
        author: 42,
      }),
    ).toContain("author");
  });
});

describe("loadLocalPreset", () => {
  it("loads a valid local preset", async () => {
    const presetDir = join(tempDir, ".ariscan", "presets", "test-preset");
    await mkdir(presetDir, { recursive: true });

    await writeFile(
      join(presetDir, "manifest.json"),
      JSON.stringify({
        id: "test-preset",
        name: "Test Preset",
        description: "A test preset",
        version: "0.1.0",
      }),
    );

    await writeFile(
      join(presetDir, "index.js"),
      `export default {
        manifest: { id: "test-preset", name: "Test", description: "test", version: "0.1.0" },
        generate(options) {
          return [{ path: "README.md", content: "# " + options.name }];
        }
      };`,
    );

    const preset = await loadLocalPreset(tempDir, "test-preset");
    expect(preset.manifest.id).toBe("community/test-preset");
    expect(preset.manifest.name).toBe("Test Preset");

    const files = preset.generate({
      name: "my-app",
      preset: "community/test-preset",
      outputDir: "/tmp/out",
    });
    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("README.md");
    expect(files[0]?.content).toBe("# my-app");
  });

  it("throws for missing manifest.json", async () => {
    const presetDir = join(tempDir, ".ariscan", "presets", "no-manifest");
    await mkdir(presetDir, { recursive: true });
    await writeFile(join(presetDir, "index.js"), "export default {};");

    await expect(loadLocalPreset(tempDir, "no-manifest")).rejects.toThrow("missing manifest.json");
  });

  it("throws for invalid manifest JSON", async () => {
    const presetDir = join(tempDir, ".ariscan", "presets", "bad-json");
    await mkdir(presetDir, { recursive: true });
    await writeFile(join(presetDir, "manifest.json"), "not valid json");
    await writeFile(join(presetDir, "index.js"), "export default {};");

    await expect(loadLocalPreset(tempDir, "bad-json")).rejects.toThrow("not valid JSON");
  });

  it("throws for invalid manifest schema", async () => {
    const presetDir = join(tempDir, ".ariscan", "presets", "bad-schema");
    await mkdir(presetDir, { recursive: true });
    await writeFile(join(presetDir, "manifest.json"), JSON.stringify({ id: "x" }));
    await writeFile(join(presetDir, "index.js"), "export default {};");

    await expect(loadLocalPreset(tempDir, "bad-schema")).rejects.toThrow("name");
  });

  it("throws for missing index.js", async () => {
    const presetDir = join(tempDir, ".ariscan", "presets", "no-entry");
    await mkdir(presetDir, { recursive: true });
    await writeFile(
      join(presetDir, "manifest.json"),
      JSON.stringify({
        id: "no-entry",
        name: "No Entry",
        description: "d",
        version: "0.1.0",
      }),
    );

    await expect(loadLocalPreset(tempDir, "no-entry")).rejects.toThrow("failed to load");
  });

  it("throws for module without preset export", async () => {
    const presetDir = join(tempDir, ".ariscan", "presets", "no-export");
    await mkdir(presetDir, { recursive: true });
    await writeFile(
      join(presetDir, "manifest.json"),
      JSON.stringify({
        id: "no-export",
        name: "No Export",
        description: "d",
        version: "0.1.0",
      }),
    );
    await writeFile(join(presetDir, "index.js"), "export const foo = 42;");

    await expect(loadLocalPreset(tempDir, "no-export")).rejects.toThrow("default export");
  });
});

describe("discoverLocalPresets", () => {
  it("returns empty array when no presets directory", async () => {
    const names = await discoverLocalPresets(tempDir);
    expect(names).toEqual([]);
  });

  it("discovers preset directories", async () => {
    const presetsDir = join(tempDir, ".ariscan", "presets");
    await mkdir(join(presetsDir, "alpha"), { recursive: true });
    await mkdir(join(presetsDir, "beta"), { recursive: true });
    // File should be ignored (only directories)
    await writeFile(join(presetsDir, "not-a-preset.txt"), "");

    const names = await discoverLocalPresets(tempDir);
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
    expect(names).not.toContain("not-a-preset.txt");
  });
});

describe("resolvePreset", () => {
  it("resolves built-in presets", async () => {
    const preset = await resolvePreset("bare");
    expect(preset).toBeDefined();
    expect(preset?.manifest.id).toBe("bare");
  });

  it("returns undefined for unknown non-community preset", async () => {
    const preset = await resolvePreset("nonexistent");
    expect(preset).toBeUndefined();
  });

  it("resolves local community preset", async () => {
    const presetDir = join(tempDir, ".ariscan", "presets", "local-test");
    await mkdir(presetDir, { recursive: true });

    await writeFile(
      join(presetDir, "manifest.json"),
      JSON.stringify({
        id: "local-test",
        name: "Local Test",
        description: "A local test preset",
        version: "0.1.0",
      }),
    );

    await writeFile(
      join(presetDir, "index.js"),
      `export default {
        manifest: { id: "local-test", name: "Local Test", description: "test", version: "0.1.0" },
        generate() { return [{ path: "test.txt", content: "hello" }]; }
      };`,
    );

    const preset = await resolvePreset("community/local-test", tempDir);
    expect(preset).toBeDefined();
    expect(preset?.manifest.id).toBe("community/local-test");
  });

  it("returns error for unfound community preset", async () => {
    // Both local and npm will fail for a nonexistent preset
    await expect(resolvePreset("community/nonexistent", tempDir)).rejects.toThrow();
  });
});
