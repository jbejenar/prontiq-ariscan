import { describe, it, expect } from "vitest";
import { classifyProfile } from "../detection/profile.js";
import { createMockContext } from "./helpers.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";

function emptyDetection(): DetectionResult {
  return { languages: [], frameworks: [], monorepo: null };
}

function detectionWithMonorepo(): DetectionResult {
  return {
    languages: [{ language: "TypeScript", confidence: 0.9, primary: true }],
    frameworks: [],
    monorepo: { tool: "Turborepo", workspaceRoot: ".", packages: ["packages/a", "packages/b"] },
  };
}

function detectionWithApiFramework(framework: string): DetectionResult {
  return {
    languages: [{ language: "TypeScript", confidence: 0.9, primary: true }],
    frameworks: [{ framework, confidence: 0.9 }],
    monorepo: null,
  };
}

describe("repo profile classifier", () => {
  describe("solo-hobby archetype", () => {
    it("classifies <10 source files, no CI, no team signals", async () => {
      const ctx = createMockContext({
        "index.ts": "console.log('hello');",
        "util.ts": "export const add = (a: number, b: number) => a + b;",
      });
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.archetype).toBe("solo-hobby");
      expect(profile.confidence).toBe("high");
      expect(profile.sourceFileCount).toBeLessThan(10);
      expect(profile.hasCI).toBe(false);
    });
  });

  describe("small-team archetype", () => {
    it("classifies 10-50 source files with CI", async () => {
      const files: Record<string, string | null> = {
        ".github/workflows/ci.yml": "name: CI",
      };
      // Create 15 source files
      for (let i = 0; i < 15; i++) {
        files[`src/file${i}.ts`] = `export const x${i} = ${i};`;
      }
      const ctx = createMockContext(files);
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.archetype).toBe("small-team");
      expect(profile.confidence).toBe("high");
    });

    it("classifies 10-50 source files without CI as medium confidence", async () => {
      const files: Record<string, string | null> = {};
      for (let i = 0; i < 15; i++) {
        files[`src/file${i}.ts`] = `export const x${i} = ${i};`;
      }
      const ctx = createMockContext(files);
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.archetype).toBe("small-team");
      expect(profile.confidence).toBe("medium");
    });
  });

  describe("library archetype", () => {
    it("classifies package.json with exports field", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "my-lib",
          exports: { ".": "./dist/index.js" },
        }),
        "src/index.ts": "export const foo = 1;",
        "src/lib.ts": "export const bar = 2;",
      });
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.archetype).toBe("library");
    });

    it("classifies Cargo.toml with [lib] section", async () => {
      const ctx = createMockContext({
        "Cargo.toml": '[lib]\nname = "mylib"',
        "src/lib.rs": "pub fn hello() {}",
      });
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.archetype).toBe("library");
    });
  });

  describe("api-service archetype", () => {
    it("classifies when Express framework detected", async () => {
      const ctx = createMockContext({
        "src/server.ts": "import express from 'express';",
        "package.json": JSON.stringify({ dependencies: { express: "^4.0.0" } }),
      });
      const profile = await classifyProfile(ctx, detectionWithApiFramework("Express"));
      expect(profile.archetype).toBe("api-service");
      expect(profile.confidence).toBe("high");
    });

    it("classifies when FastAPI framework detected", async () => {
      const ctx = createMockContext({
        "main.py": "from fastapi import FastAPI",
      });
      const profile = await classifyProfile(ctx, detectionWithApiFramework("FastAPI"));
      expect(profile.archetype).toBe("api-service");
    });

    it("classifies Dockerfile with EXPOSE", async () => {
      const ctx = createMockContext({
        Dockerfile: "FROM node:20\nEXPOSE 3000\nCMD ['node', 'server.js']",
        "server.js": "const http = require('http');",
      });
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.archetype).toBe("api-service");
    });
  });

  describe("cli-tool archetype", () => {
    it("classifies package.json with bin field", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "my-cli", bin: { "my-cli": "./dist/cli.js" } }),
        "src/cli.ts": "#!/usr/bin/env node",
      });
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.archetype).toBe("cli-tool");
    });

    it("classifies when commander dependency present", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "my-tool",
          dependencies: { commander: "^10.0.0" },
        }),
        "src/index.ts": "import { program } from 'commander';",
      });
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.archetype).toBe("cli-tool");
    });
  });

  describe("monorepo-enterprise archetype", () => {
    it("classifies when monorepo tool detected", async () => {
      const ctx = createMockContext({
        "turbo.json": "{}",
        "packages/a/src/index.ts": "export {};",
        "packages/b/src/index.ts": "export {};",
      });
      const profile = await classifyProfile(ctx, detectionWithMonorepo());
      expect(profile.archetype).toBe("monorepo-enterprise");
      expect(profile.confidence).toBe("high");
    });

    it("classifies >200 source files with CI and team signals", async () => {
      const files: Record<string, string | null> = {
        ".github/workflows/ci.yml": "name: CI",
        CODEOWNERS: "* @team",
      };
      for (let i = 0; i < 210; i++) {
        files[`src/file${i}.ts`] = `export const x${i} = ${i};`;
      }
      const ctx = createMockContext(files);
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.archetype).toBe("monorepo-enterprise");
      expect(profile.confidence).toBe("medium");
    });
  });

  describe("signal tracking", () => {
    it("includes file count signals", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export {};",
        "src/util.ts": "export {};",
      });
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.signals).toContain("source-files:2");
      expect(profile.fileCount).toBe(2);
      expect(profile.sourceFileCount).toBe(2);
    });

    it("includes ci-detected signal when CI present", async () => {
      const files: Record<string, string | null> = {
        ".github/workflows/ci.yml": "name: CI",
      };
      for (let i = 0; i < 15; i++) {
        files[`src/file${i}.ts`] = `export {};`;
      }
      const ctx = createMockContext(files);
      const profile = await classifyProfile(ctx, emptyDetection());
      expect(profile.signals).toContain("ci-detected");
      expect(profile.hasCI).toBe(true);
    });
  });
});
