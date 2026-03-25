import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasDevcontainer } from "../../simulate/docker.js";
import { access } from "node:fs/promises";

vi.mock("node:fs/promises", () => ({
  access: vi.fn(),
  readFile: vi.fn(),
}));

describe("hasDevcontainer", () => {
  beforeEach(() => {
    vi.mocked(access).mockRejectedValue(new Error("ENOENT"));
  });

  it("returns true when .devcontainer/devcontainer.json exists", async () => {
    vi.mocked(access).mockImplementation(async (path) => {
      if (String(path).includes(".devcontainer/devcontainer.json")) return;
      throw new Error("ENOENT");
    });

    const result = await hasDevcontainer("/repo");
    expect(result).toBe(true);
  });

  it("returns true when .devcontainer.json exists at root", async () => {
    vi.mocked(access).mockImplementation(async (path) => {
      if (String(path).endsWith(".devcontainer.json") && !String(path).includes(".devcontainer/"))
        return;
      throw new Error("ENOENT");
    });

    const result = await hasDevcontainer("/repo");
    expect(result).toBe(true);
  });

  it("returns false when no devcontainer config exists", async () => {
    const result = await hasDevcontainer("/repo");
    expect(result).toBe(false);
  });
});
