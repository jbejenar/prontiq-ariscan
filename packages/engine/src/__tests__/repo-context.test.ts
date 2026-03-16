import { describe, it, expect, vi } from "vitest";

// Mock fast-glob to return fresh arrays (avoids frozen-array re-sort issues)
vi.mock("fast-glob", () => ({
  default: vi.fn().mockImplementation(() => Promise.resolve(["src/index.ts", "package.json"])),
}));

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue('{"name": "test"}'),
  access: vi.fn().mockResolvedValue(undefined),
}));

describe("createRepoContext", () => {
  it("exports createRepoContext function", async () => {
    const mod = await import("../context/repo-context.js");
    expect(mod.createRepoContext).toBeDefined();
    expect(typeof mod.createRepoContext).toBe("function");
  });

  it("creates a RepoContext with expected interface", async () => {
    const { createRepoContext } = await import("../context/repo-context.js");
    const ctx = await createRepoContext("/mock/repo");

    expect(ctx.rootPath).toBe("/mock/repo");
    expect(ctx.files).toBeDefined();
    expect(Array.isArray(ctx.files)).toBe(true);
    expect(typeof ctx.readFile).toBe("function");
    expect(typeof ctx.fileExists).toBe("function");
    expect(typeof ctx.readJson).toBe("function");
  });

  it("files list is frozen (immutable)", async () => {
    const { createRepoContext } = await import("../context/repo-context.js");
    const ctx = await createRepoContext("/mock/repo");
    expect(Object.isFrozen(ctx.files)).toBe(true);
  });

  it("files list is sorted", async () => {
    const { createRepoContext } = await import("../context/repo-context.js");
    const ctx = await createRepoContext("/mock/repo");
    const sorted = [...ctx.files].sort();
    expect([...ctx.files]).toEqual(sorted);
  });
});
