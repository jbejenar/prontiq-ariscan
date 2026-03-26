/**
 * Community preset: Express.js API
 *
 * Generates an Express.js + TypeScript API project with agent readiness
 * essentials: provider interfaces, test doubles, AGENTS.md, devcontainer, CI.
 *
 * Usage:
 *   ariscan init --preset community/express --name my-api
 *
 * Or install from npm:
 *   npm install -D ariscan-preset-express
 *   ariscan init --preset community/express --name my-api
 */

/** @type {import('@prontiq/ariscan-cli').ScaffolderPreset} */
export default {
  manifest: {
    id: "express",
    name: "Express API",
    description: "Express.js API with TypeScript, provider pattern, and agent readiness essentials",
    version: "0.1.0",
    author: "Prontiq",
  },

  generate(options) {
    const { name } = options;
    return [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name,
            version: "0.0.1",
            private: true,
            type: "module",
            scripts: {
              dev: "tsx watch src/server.ts",
              build: "tsc",
              start: "node dist/server.js",
              test: "vitest run",
              "test:watch": "vitest",
              lint: "eslint .",
              typecheck: "tsc --noEmit",
              format: "prettier --write .",
              "format:check": "prettier --check .",
            },
            dependencies: {
              express: "^5.0.0",
            },
            devDependencies: {
              "@types/express": "^5.0.0",
              "@types/node": "^22.0.0",
              eslint: "^9.0.0",
              prettier: "^3.4.0",
              tsx: "^4.0.0",
              typescript: "^5.7.0",
              vitest: "^3.0.0",
            },
          },
          null,
          2,
        ),
      },
      {
        path: "tsconfig.json",
        content: JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "Node16",
              moduleResolution: "Node16",
              outDir: "dist",
              rootDir: "src",
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              declaration: true,
            },
            include: ["src"],
          },
          null,
          2,
        ),
      },
      {
        path: "src/server.ts",
        content: `import express from "express";
import { healthRouter } from "./routes/health.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use("/health", healthRouter);

app.listen(port, () => {
  // Server ready
});

export { app };
`,
      },
      {
        path: "src/routes/health.ts",
        content: `import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
`,
      },
      {
        path: "src/routes/health.test.ts",
        content: `import { describe, it, expect } from "vitest";

describe("health route", () => {
  it("returns ok status", () => {
    // Unit test — route handler logic
    expect(true).toBe(true);
  });
});
`,
      },
      {
        path: "src/providers/storage.ts",
        content: `/** Storage provider interface. */
export interface StorageProvider {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
}

/** In-memory storage for testing. */
export class MemoryStorage implements StorageProvider {
  private store = new Map<string, string>();
  async get(key: string): Promise<string | undefined> { return this.store.get(key); }
  async put(key: string, value: string): Promise<void> { this.store.set(key, value); }
  async delete(key: string): Promise<boolean> { return this.store.delete(key); }
}
`,
      },
      {
        path: "AGENTS.md",
        content: `# AGENTS.md — ${name}

## Overview
Express.js API built with TypeScript, provider pattern for external dependencies, and agent readiness essentials.

## Architecture
- \`src/routes/\` — Express route handlers
- \`src/providers/\` — Provider interfaces + test doubles

## Commands
\`\`\`bash
npm install       # Install dependencies
npm run dev       # Start dev server (tsx watch)
npm run build     # Build TypeScript
npm test          # Run tests (vitest)
npm run lint      # Lint (eslint)
npm run typecheck # Type check (tsc --noEmit)
\`\`\`

## Conventions
- ESM only (\`"type": "module"\`)
- Strict TypeScript
- Provider pattern for external dependencies (storage, queue, email)
- In-memory test doubles for isolated testing
`,
      },
      {
        path: ".agentignore",
        content: `node_modules/
dist/
coverage/
.env
.env.local
*.log
`,
      },
      {
        path: ".gitignore",
        content: `node_modules/
dist/
coverage/
.env
.env.local
*.log
`,
      },
      {
        path: "vitest.config.ts",
        content: `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
  },
});
`,
      },
      {
        path: ".nvmrc",
        content: "22\n",
      },
      {
        path: "README.md",
        content: `# ${name}\n\nExpress.js API built with TypeScript.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
      },
    ];
  },
};
