import { describe, it, expect } from "vitest";
import { detectMonorepo } from "../../detection/monorepo.js";
import { createMockContext } from "../helpers.js";

describe("detectMonorepo", () => {
  it("detects Turborepo monorepo", async () => {
    const ctx = createMockContext({
      "turbo.json": '{"pipeline":{"build":{}}}',
      "package.json": JSON.stringify({
        workspaces: ["packages/*"],
      }),
      "packages/web/package.json": '{"name":"web"}',
      "packages/web/src/index.ts": "",
      "packages/api/package.json": '{"name":"api"}',
      "packages/api/src/index.ts": "",
    });

    const result = await detectMonorepo(ctx);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.tool).toBe("Turborepo");
    expect(result.workspaceRoot).toBe(".");
    expect(result.packages).toContain("packages/web");
    expect(result.packages).toContain("packages/api");
  });

  it("detects pnpm workspaces", async () => {
    const ctx = createMockContext({
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "packages/schema/src/index.ts": "",
      "packages/engine/src/index.ts": "",
    });

    const result = await detectMonorepo(ctx);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.tool).toBe("pnpm workspaces");
    expect(result.packages).toContain("packages/schema");
    expect(result.packages).toContain("packages/engine");
  });

  it("detects Nx monorepo", async () => {
    const ctx = createMockContext({
      "nx.json": '{"tasksRunnerOptions":{}}',
      "package.json": JSON.stringify({
        workspaces: ["apps/*", "libs/*"],
      }),
      "apps/frontend/src/main.ts": "",
      "libs/shared/src/index.ts": "",
    });

    const result = await detectMonorepo(ctx);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.tool).toBe("Nx");
    expect(result.packages).toContain("apps/frontend");
    expect(result.packages).toContain("libs/shared");
  });

  it("detects Lerna monorepo", async () => {
    const ctx = createMockContext({
      "lerna.json": JSON.stringify({ packages: ["packages/*"] }),
      "packages/core/src/index.ts": "",
      "packages/cli/src/index.ts": "",
    });

    const result = await detectMonorepo(ctx);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.tool).toBe("Lerna");
    expect(result.packages).toContain("packages/core");
    expect(result.packages).toContain("packages/cli");
  });

  it("detects Cargo workspaces", async () => {
    const ctx = createMockContext({
      "Cargo.toml":
        '[workspace]\nmembers = [\n  "crates/*"\n]\n\n[package]\nname = "root"',
      "crates/core/src/lib.rs": "",
      "crates/cli/src/main.rs": "",
    });

    const result = await detectMonorepo(ctx);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.tool).toBe("Cargo workspaces");
    expect(result.packages).toContain("crates/core");
    expect(result.packages).toContain("crates/cli");
  });

  it("detects Go workspaces", async () => {
    const ctx = createMockContext({
      "go.work": "go 1.21\n\nuse (\n\t./cmd/api\n\t./pkg/shared\n)\n",
      "cmd/api/main.go": "package main",
      "pkg/shared/lib.go": "package shared",
    });

    const result = await detectMonorepo(ctx);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.tool).toBe("Go workspaces");
    expect(result.packages).toContain("./cmd/api");
    expect(result.packages).toContain("./pkg/shared");
  });

  it("returns null for non-monorepo", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "simple-app" }),
      "src/index.ts": "",
    });

    const result = await detectMonorepo(ctx);
    expect(result).toBeNull();
  });

  it("returns null for empty repo", async () => {
    const ctx = createMockContext({});

    const result = await detectMonorepo(ctx);
    expect(result).toBeNull();
  });

  it("ignores Cargo.toml without [workspace] section", async () => {
    const ctx = createMockContext({
      "Cargo.toml": '[package]\nname = "my-app"\nversion = "0.1.0"',
      "src/main.rs": "fn main() {}",
    });

    const result = await detectMonorepo(ctx);
    expect(result).toBeNull();
  });
});
