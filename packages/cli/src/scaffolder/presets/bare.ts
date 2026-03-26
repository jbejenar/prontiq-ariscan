/**
 * Bare TypeScript preset (S.02).
 *
 * Framework-agnostic TypeScript foundation with all agent readiness essentials:
 * strict TypeScript, Vitest, ESLint, Prettier, AGENTS.md, .agentignore,
 * devcontainer, CI pipeline, provider interfaces, and test doubles.
 */
import type { ScaffolderPreset, ScaffoldOptions, FileEntry } from "../types.js";

export const barePreset: ScaffolderPreset = {
  manifest: {
    id: "bare",
    name: "Bare TypeScript",
    description: "Framework-agnostic TypeScript foundation with agent readiness essentials",
  },

  generate(options: ScaffoldOptions): FileEntry[] {
    const { name } = options;
    return [
      packageJson(name),
      tsconfigJson(),
      vitestConfig(),
      eslintConfig(),
      prettierConfig(),
      gitignore(),
      nvmrc(),
      srcIndex(name),
      srcIndexTest(name),
      agentsMd(name),
      agentignore(),
      devcontainerJson(name),
      ciWorkflow(),
      readme(name),
      providerStorage(),
      providerBarrel(),
      providerQueue(),
      providerEmail(),
      providerTests(),
      envExample(),
    ];
  },
};

/* ------------------------------------------------------------------ */
/*  File generators                                                    */
/* ------------------------------------------------------------------ */

function packageJson(name: string): FileEntry {
  const pkg = {
    name,
    version: "0.1.0",
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    scripts: {
      build: "tsc",
      test: "vitest run",
      "test:watch": "vitest",
      lint: "eslint src/",
      typecheck: "tsc --noEmit",
      format: "prettier --write .",
      "format:check": "prettier --check .",
    },
    devDependencies: {
      typescript: "^5.7.0",
      vitest: "^3.0.0",
      eslint: "^9.18.0",
      "typescript-eslint": "^8.0.0",
      prettier: "^3.4.0",
      "@types/node": "^22.0.0",
    },
  };
  return { path: "package.json", content: JSON.stringify(pkg, null, 2) + "\n" };
}

function tsconfigJson(): FileEntry {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "Node16",
      moduleResolution: "Node16",
      lib: ["ES2022"],
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ["src"],
    exclude: ["node_modules", "dist"],
  };
  return {
    path: "tsconfig.json",
    content: JSON.stringify(tsconfig, null, 2) + "\n",
  };
}

function vitestConfig(): FileEntry {
  return {
    path: "vitest.config.ts",
    content: `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
`,
  };
}

function eslintConfig(): FileEntry {
  return {
    path: "eslint.config.js",
    content: `import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    files: ["src/**/*.ts"],
    extends: [...tseslint.configs.strict],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
`,
  };
}

function prettierConfig(): FileEntry {
  return {
    path: ".prettierrc",
    content:
      JSON.stringify(
        { semi: true, singleQuote: false, trailingComma: "all", printWidth: 100 },
        null,
        2,
      ) + "\n",
  };
}

function gitignore(): FileEntry {
  return {
    path: ".gitignore",
    content: `node_modules/
dist/
coverage/
*.tsbuildinfo
.env
.env.local
`,
  };
}

function nvmrc(): FileEntry {
  return { path: ".nvmrc", content: "22\n" };
}

function srcIndex(name: string): FileEntry {
  return {
    path: "src/index.ts",
    content: `/**
 * ${name} — main entry point.
 */
export function greet(who: string): string {
  return \`Hello, \${who}!\`;
}
`,
  };
}

function srcIndexTest(name: string): FileEntry {
  return {
    path: "src/index.test.ts",
    content: `import { describe, it, expect } from "vitest";
import { greet } from "./index.js";

describe("${name}", () => {
  it("greets by name", () => {
    expect(greet("World")).toBe("Hello, World!");
  });
});
`,
  };
}

function agentsMd(name: string): FileEntry {
  return {
    path: "AGENTS.md",
    content: `# AGENTS.md — ${name}

## Project Overview

${name} is a TypeScript project.

## Architecture

\`\`\`
src/
  index.ts              — main entry point
  providers/            — dependency injection interfaces
    storage.ts          — storage provider interface + memory implementation
    queue.ts            — queue provider interface + memory implementation
    email.ts            — email provider interface + memory implementation
\`\`\`

## Key Commands

\`\`\`bash
npm install             # Install dependencies
npm run build           # Compile TypeScript
npm test                # Run tests (Vitest)
npm run lint            # Lint with ESLint
npm run typecheck       # Type-check (tsc --noEmit)
npm run format          # Format with Prettier
\`\`\`

## Code Conventions

- **ESM only** — \`"type": "module"\` in package.json
- **Strict TypeScript** — \`strict: true\` in tsconfig
- **No \`any\` type** — use \`unknown\` and narrow
- **Provider pattern** — external dependencies accessed via interfaces in \`src/providers/\`
- **Test doubles** — in-memory implementations for all providers (no mocks needed)

## Testing

- **Framework:** Vitest
- **Pattern:** colocated \`*.test.ts\` files
- **Providers:** use in-memory implementations for isolation

## Do NOT

- Use \`any\` type — use \`unknown\` with type narrowing
- Import without \`.js\` extension — ESM requires explicit extensions
- Access external services directly — use provider interfaces
`,
  };
}

function agentignore(): FileEntry {
  return {
    path: ".agentignore",
    content: `# Build artifacts
dist/
*.tsbuildinfo

# Dependencies
node_modules/

# Coverage
coverage/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/settings.json

# OS
.DS_Store
Thumbs.db

# Lockfiles (large, not useful for agents)
pnpm-lock.yaml
package-lock.json
yarn.lock
`,
  };
}

function devcontainerJson(name: string): FileEntry {
  const config = {
    name,
    image: "mcr.microsoft.com/devcontainers/typescript-node:22",
    postCreateCommand: "npm install",
    customizations: {
      vscode: {
        extensions: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode", "vitest.explorer"],
      },
    },
  };
  return {
    path: ".devcontainer/devcontainer.json",
    content: JSON.stringify(config, null, 2) + "\n",
  };
}

function ciWorkflow(): FileEntry {
  return {
    path: ".github/workflows/ci.yml",
    content: `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
      - run: npm install
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
`,
  };
}

function readme(name: string): FileEntry {
  return {
    path: "README.md",
    content: `# ${name}

A TypeScript project scaffolded with [ariscan](https://github.com/prontiq/ariscan).

## Getting Started

\`\`\`bash
npm install
npm test
\`\`\`

## Development

\`\`\`bash
npm run build       # Compile TypeScript
npm run lint        # Lint
npm run typecheck   # Type-check
npm run format      # Format code
\`\`\`
`,
  };
}

/* ------------------------------------------------------------------ */
/*  Provider interfaces & test doubles (S.05)                          */
/* ------------------------------------------------------------------ */

function providerStorage(): FileEntry {
  return {
    path: "src/providers/storage.ts",
    content: `/**
 * Storage provider interface.
 *
 * Use the in-memory implementation for tests.
 * Implement a real adapter (S3, GCS, local disk) for production.
 */
export interface StorageProvider {
  get(key: string): Promise<Buffer | null>;
  put(key: string, data: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** In-memory storage for testing. */
export class MemoryStorage implements StorageProvider {
  private readonly store = new Map<string, Buffer>();

  async get(key: string): Promise<Buffer | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, data: Buffer): Promise<void> {
    this.store.set(key, data);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}
`,
  };
}

function providerBarrel(): FileEntry {
  return {
    path: "src/providers/index.ts",
    content: `export type { StorageProvider } from "./storage.js";
export { MemoryStorage } from "./storage.js";
export type { QueueProvider } from "./queue.js";
export { MemoryQueue } from "./queue.js";
export type { EmailProvider, EmailMessage } from "./email.js";
export { MemoryEmail } from "./email.js";
`,
  };
}

function providerQueue(): FileEntry {
  return {
    path: "src/providers/queue.ts",
    content: `/**
 * Queue provider interface.
 *
 * Use the in-memory implementation for tests.
 * Implement a real adapter (SQS, Redis, RabbitMQ) for production.
 */
export interface QueueProvider {
  enqueue(topic: string, payload: unknown): Promise<void>;
  dequeue(topic: string): Promise<unknown | null>;
  size(topic: string): Promise<number>;
}

/** In-memory queue for testing. */
export class MemoryQueue implements QueueProvider {
  private readonly queues = new Map<string, unknown[]>();

  private getQueue(topic: string): unknown[] {
    let q = this.queues.get(topic);
    if (!q) {
      q = [];
      this.queues.set(topic, q);
    }
    return q;
  }

  async enqueue(topic: string, payload: unknown): Promise<void> {
    this.getQueue(topic).push(payload);
  }

  async dequeue(topic: string): Promise<unknown | null> {
    const q = this.getQueue(topic);
    return q.shift() ?? null;
  }

  async size(topic: string): Promise<number> {
    return this.getQueue(topic).length;
  }
}
`,
  };
}

function providerEmail(): FileEntry {
  return {
    path: "src/providers/email.ts",
    content: `/**
 * Email provider interface.
 *
 * Use the in-memory implementation for tests.
 * Implement a real adapter (SendGrid, SES, SMTP) for production.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/** In-memory email for testing. Stores sent messages for assertion. */
export class MemoryEmail implements EmailProvider {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
`,
  };
}

function providerTests(): FileEntry {
  return {
    path: "src/providers/providers.test.ts",
    content: `import { describe, it, expect } from "vitest";
import { MemoryStorage, MemoryQueue, MemoryEmail } from "./index.js";

describe("MemoryStorage", () => {
  it("stores and retrieves data", async () => {
    const storage = new MemoryStorage();
    await storage.put("key", Buffer.from("value"));
    const result = await storage.get("key");
    expect(result?.toString()).toBe("value");
  });

  it("returns null for missing keys", async () => {
    const storage = new MemoryStorage();
    expect(await storage.get("missing")).toBeNull();
  });

  it("checks existence", async () => {
    const storage = new MemoryStorage();
    expect(await storage.exists("key")).toBe(false);
    await storage.put("key", Buffer.from("value"));
    expect(await storage.exists("key")).toBe(true);
  });

  it("deletes keys", async () => {
    const storage = new MemoryStorage();
    await storage.put("key", Buffer.from("value"));
    await storage.delete("key");
    expect(await storage.exists("key")).toBe(false);
  });
});

describe("MemoryQueue", () => {
  it("enqueues and dequeues in order", async () => {
    const queue = new MemoryQueue();
    await queue.enqueue("tasks", "first");
    await queue.enqueue("tasks", "second");
    expect(await queue.dequeue("tasks")).toBe("first");
    expect(await queue.dequeue("tasks")).toBe("second");
  });

  it("returns null when empty", async () => {
    const queue = new MemoryQueue();
    expect(await queue.dequeue("tasks")).toBeNull();
  });

  it("tracks queue size", async () => {
    const queue = new MemoryQueue();
    expect(await queue.size("tasks")).toBe(0);
    await queue.enqueue("tasks", "item");
    expect(await queue.size("tasks")).toBe(1);
  });
});

describe("MemoryEmail", () => {
  it("records sent messages", async () => {
    const email = new MemoryEmail();
    await email.send({ to: "test@example.com", subject: "Hi", body: "Hello" });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toBe("test@example.com");
  });
});
`,
  };
}

function envExample(): FileEntry {
  return {
    path: ".env.example",
    content: `# Environment variables
# Copy to .env and fill in values
#
# NODE_ENV=development
`,
  };
}
