import { describe, it, expect } from "vitest";
import { detectFrameworks } from "../detection/frameworks.js";
import { createMockContext } from "./helpers.js";

describe("detectFrameworks", () => {
  it("detects Next.js via config file", async () => {
    const ctx = createMockContext({
      "next.config.js": "module.exports = {}",
      "package.json": JSON.stringify({
        dependencies: { next: "14.0.0", react: "18.0.0" },
      }),
      "src/app/page.tsx": "",
    });

    const result = await detectFrameworks(ctx);
    const nextjs = result.find((f) => f.framework === "Next.js");
    expect(nextjs).toBeDefined();
    if (!nextjs) return;
    expect(nextjs.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects React via package.json dependency", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({
        dependencies: { react: "18.0.0", "react-dom": "18.0.0" },
      }),
      "src/App.tsx": "",
    });

    const result = await detectFrameworks(ctx);
    const react = result.find((f) => f.framework === "React");
    expect(react).toBeDefined();
    if (!react) return;
    expect(react.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects Express via dependency", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({
        dependencies: { express: "4.18.0" },
      }),
      "src/server.js": "",
    });

    const result = await detectFrameworks(ctx);
    const express = result.find((f) => f.framework === "Express");
    expect(express).toBeDefined();
  });

  it("detects Django via manage.py", async () => {
    const ctx = createMockContext({
      "manage.py": "#!/usr/bin/env python",
      "requirements.txt": "django>=4.0\ndjango-rest-framework>=3.14",
      "myapp/settings.py": "",
    });

    const result = await detectFrameworks(ctx);
    const django = result.find((f) => f.framework === "Django");
    expect(django).toBeDefined();
    if (!django) return;
    expect(django.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("detects FastAPI from requirements.txt", async () => {
    const ctx = createMockContext({
      "requirements.txt": "fastapi>=0.100\nuvicorn>=0.23",
      "main.py": "",
    });

    const result = await detectFrameworks(ctx);
    const fastapi = result.find((f) => f.framework === "FastAPI");
    expect(fastapi).toBeDefined();
  });

  it("detects Vue via package.json dependency", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({
        dependencies: { vue: "3.3.0" },
      }),
      "src/App.vue": "",
    });

    const result = await detectFrameworks(ctx);
    const vue = result.find((f) => f.framework === "Vue");
    expect(vue).toBeDefined();
  });

  it("detects Angular via angular.json", async () => {
    const ctx = createMockContext({
      "angular.json": "{}",
      "package.json": JSON.stringify({
        dependencies: { "@angular/core": "17.0.0" },
      }),
      "src/app/app.component.ts": "",
    });

    const result = await detectFrameworks(ctx);
    const angular = result.find((f) => f.framework === "Angular");
    expect(angular).toBeDefined();
    if (!angular) return;
    expect(angular.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects Rails via config/routes.rb", async () => {
    const ctx = createMockContext({
      "config/routes.rb": "Rails.application.routes.draw do\nend",
      Gemfile: 'gem "rails", "~> 7.0"\ngem "pg"',
      "app/controllers/application_controller.rb": "",
    });

    const result = await detectFrameworks(ctx);
    const rails = result.find((f) => f.framework === "Rails");
    expect(rails).toBeDefined();
    if (!rails) return;
    expect(rails.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("returns empty array for unknown project", async () => {
    const ctx = createMockContext({
      "main.c": "#include <stdio.h>",
      Makefile: "all: main",
    });

    const result = await detectFrameworks(ctx);
    expect(result).toEqual([]);
  });

  it("detects multiple frameworks", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({
        dependencies: { next: "14.0.0", react: "18.0.0", express: "4.18.0" },
      }),
      "next.config.js": "module.exports = {}",
    });

    const result = await detectFrameworks(ctx);
    expect(result.length).toBeGreaterThanOrEqual(3);

    const names = result.map((f) => f.framework);
    expect(names).toContain("Next.js");
    expect(names).toContain("React");
    expect(names).toContain("Express");
  });
});
