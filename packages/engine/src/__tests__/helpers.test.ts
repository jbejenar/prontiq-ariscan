import { describe, it, expect } from "vitest";
import { createMockContext } from "./helpers.js";

describe("createMockContext", () => {
  it("lists all file keys in sorted order", () => {
    const ctx = createMockContext({
      "b.ts": "b",
      "a.ts": "a",
    });
    expect(ctx.files).toEqual(["a.ts", "b.ts"]);
  });

  it("readFile returns content for known files", async () => {
    const ctx = createMockContext({ "foo.ts": "hello" });
    expect(await ctx.readFile("foo.ts")).toBe("hello");
  });

  it("readFile returns null for unknown files", async () => {
    const ctx = createMockContext({});
    expect(await ctx.readFile("missing.ts")).toBeNull();
  });

  it("fileExists returns true for registered files", async () => {
    const ctx = createMockContext({ "exists.ts": "" });
    expect(await ctx.fileExists("exists.ts")).toBe(true);
  });

  it("fileExists returns false for missing files", async () => {
    const ctx = createMockContext({});
    expect(await ctx.fileExists("nope.ts")).toBe(false);
  });

  it("fileExists returns true for directory prefixes", async () => {
    const ctx = createMockContext({ "src/foo.ts": "content" });
    expect(await ctx.fileExists("src")).toBe(true);
  });

  it("readJson parses valid JSON", async () => {
    const ctx = createMockContext({
      "data.json": JSON.stringify({ key: "value" }),
    });
    const result = await ctx.readJson<{ key: string }>("data.json");
    expect(result).toEqual({ key: "value" });
  });

  it("readJson returns null for invalid JSON", async () => {
    const ctx = createMockContext({ "bad.json": "not json" });
    expect(await ctx.readJson("bad.json")).toBeNull();
  });

  it("readJson returns null for missing files", async () => {
    const ctx = createMockContext({});
    expect(await ctx.readJson("missing.json")).toBeNull();
  });

  it("uses custom rootPath", () => {
    const ctx = createMockContext({}, "/custom/path");
    expect(ctx.rootPath).toBe("/custom/path");
  });

  it("includes extraFiles in file listing", () => {
    const ctx = createMockContext({ "a.ts": "a" }, "/mock/repo", ["b.ts"]);
    expect(ctx.files).toContain("b.ts");
  });

  it("files array is frozen", () => {
    const ctx = createMockContext({ "a.ts": "a" });
    expect(Object.isFrozen(ctx.files)).toBe(true);
  });
});
