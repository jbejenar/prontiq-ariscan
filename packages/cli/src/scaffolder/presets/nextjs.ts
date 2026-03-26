/**
 * Next.js preset (S.03).
 *
 * Extends the bare TypeScript foundation with App Router conventions,
 * server action patterns, Tailwind CSS, and framework-specific test wiring.
 */
import type { ScaffolderPreset, ScaffoldOptions, FileEntry } from "../types.js";

export const nextjsPreset: ScaffolderPreset = {
  manifest: {
    id: "nextjs",
    name: "Next.js",
    description: "Next.js + App Router + Tailwind CSS with agent readiness essentials",
    extends: "bare",
  },

  generate(options: ScaffoldOptions): FileEntry[] {
    const { name } = options;
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
      throw new Error(
        `Invalid project name "${name}": must start with a lowercase letter or digit and contain only lowercase alphanumeric characters, dots, hyphens, or underscores.`,
      );
    }
    return [
      packageJson(name),
      tsconfigJson(),
      nextConfig(),
      tailwindConfig(),
      postcssConfig(),
      vitestConfig(),
      eslintConfig(),
      prettierConfig(),
      gitignore(),
      nvmrc(),
      appLayout(name),
      appPage(),
      appGlobalsCss(),
      appLoading(),
      appNotFound(),
      serverActionExample(),
      libIndex(),
      libIndexTest(),
      agentsMd(name),
      agentignore(),
      devcontainerJson(name),
      ciWorkflow(),
      readme(name),
      providerStorage(),
      providerQueue(),
      providerEmail(),
      providerBarrel(),
      providerTests(),
      envExample(),
      envLocalExample(),
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
    private: true,
    type: "module",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      test: "vitest run",
      "test:watch": "vitest",
      lint: "next lint",
      typecheck: "tsc --noEmit",
      format: "prettier --write .",
      "format:check": "prettier --check .",
    },
    dependencies: {
      next: "^15.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
    devDependencies: {
      typescript: "^5.7.0",
      "@types/node": "^22.0.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      vitest: "^3.0.0",
      eslint: "^9.18.0",
      "eslint-config-next": "^15.0.0",
      "typescript-eslint": "^8.0.0",
      prettier: "^3.4.0",
      tailwindcss: "^4.0.0",
      "@tailwindcss/postcss": "^4.0.0",
    },
  };
  return { path: "package.json", content: JSON.stringify(pkg, null, 2) + "\n" };
}

function tsconfigJson(): FileEntry {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "ES2022"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "ESNext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: {
        "@/*": ["./src/*"],
      },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  };
  return {
    path: "tsconfig.json",
    content: JSON.stringify(tsconfig, null, 2) + "\n",
  };
}

function nextConfig(): FileEntry {
  return {
    path: "next.config.ts",
    content: `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
`,
  };
}

function tailwindConfig(): FileEntry {
  return {
    path: "tailwind.config.ts",
    content: `import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
`,
  };
}

function postcssConfig(): FileEntry {
  return {
    path: "postcss.config.js",
    content: `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`,
  };
}

function vitestConfig(): FileEntry {
  return {
    path: "vitest.config.ts",
    content: `import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts", "app/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
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
    files: ["**/*.ts", "**/*.tsx"],
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
    content: `# Dependencies
node_modules/

# Next.js
.next/
out/

# Build
dist/
*.tsbuildinfo

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
`,
  };
}

function nvmrc(): FileEntry {
  return { path: ".nvmrc", content: "22\n" };
}

function appLayout(name: string): FileEntry {
  return {
    path: "app/layout.tsx",
    content: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${name}",
  description: "A Next.js project scaffolded with ariscan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
  };
}

function appPage(): FileEntry {
  return {
    path: "app/page.tsx",
    content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome</h1>
      <p className="mt-4 text-lg text-gray-600">
        Get started by editing <code className="font-mono">app/page.tsx</code>
      </p>
    </main>
  );
}
`,
  };
}

function appGlobalsCss(): FileEntry {
  return {
    path: "app/globals.css",
    content: `@import "tailwindcss";
`,
  };
}

function appLoading(): FileEntry {
  return {
    path: "app/loading.tsx",
    content: `export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg">Loading...</p>
    </div>
  );
}
`,
  };
}

function appNotFound(): FileEntry {
  return {
    path: "app/not-found.tsx",
    content: `import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="text-2xl font-bold">Not Found</h2>
      <p className="mt-2 text-gray-600">Could not find the requested resource.</p>
      <Link href="/" className="mt-4 text-blue-600 hover:underline">
        Go home
      </Link>
    </div>
  );
}
`,
  };
}

function serverActionExample(): FileEntry {
  return {
    path: "app/actions.ts",
    content: `"use server";

/**
 * Example server action.
 *
 * Server actions run on the server and can be called from client components.
 * They are useful for form submissions, data mutations, and server-side logic.
 */
export async function exampleAction(formData: FormData): Promise<{ success: boolean }> {
  const value = formData.get("value");
  if (!value || typeof value !== "string") {
    return { success: false };
  }
  // Process the value server-side
  return { success: true };
}
`,
  };
}

function libIndex(): FileEntry {
  return {
    path: "src/lib/index.ts",
    content: `/**
 * Shared utilities and business logic.
 *
 * Keep framework-agnostic code here so it can be tested without Next.js.
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}
`,
  };
}

function libIndexTest(): FileEntry {
  return {
    path: "src/lib/index.test.ts",
    content: `import { describe, it, expect } from "vitest";
import { formatDate } from "./index.js";

describe("formatDate", () => {
  it("formats date to YYYY-MM-DD", () => {
    const date = new Date("2025-03-15T12:00:00Z");
    expect(formatDate(date)).toBe("2025-03-15");
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

${name} is a Next.js application using the App Router, TypeScript, and Tailwind CSS.

## Architecture

\`\`\`
app/
  layout.tsx           — root layout (metadata, global providers)
  page.tsx             — home page
  loading.tsx          — loading UI (Suspense boundary)
  not-found.tsx        — 404 page
  actions.ts           — server actions
  globals.css          — Tailwind CSS directives
src/
  lib/                 — shared utilities (framework-agnostic)
    index.ts           — utility functions
  providers/           — dependency injection interfaces
    storage.ts         — storage provider interface + memory implementation
    queue.ts           — queue provider interface + memory implementation
    email.ts           — email provider interface + memory implementation
\`\`\`

## Key Commands

\`\`\`bash
npm install             # Install dependencies
npm run dev             # Start dev server
npm run build           # Build for production
npm test                # Run tests (Vitest)
npm run lint            # Lint with ESLint + Next.js rules
npm run typecheck       # Type-check (tsc --noEmit)
npm run format          # Format with Prettier
\`\`\`

## Code Conventions

- **App Router** — all routes live under \`app/\` using file-based routing
- **Server Components by default** — add \`"use client"\` only when needed
- **Server Actions** — mutations go in \`actions.ts\` files with \`"use server"\` directive
- **Strict TypeScript** — \`strict: true\` in tsconfig
- **No \`any\` type** — use \`unknown\` and narrow
- **Provider pattern** — external dependencies accessed via interfaces in \`src/providers/\`
- **Test doubles** — in-memory implementations for all providers (no mocks needed)
- **Tailwind CSS** — utility-first styling, configured in \`tailwind.config.ts\`

## Testing

- **Framework:** Vitest
- **Pattern:** colocated \`*.test.ts\` files in \`src/\`
- **Providers:** use in-memory implementations for isolation
- **Server actions:** test business logic in \`src/lib/\`, not the action wrapper

## Next.js Patterns

- **Layouts** — shared UI wrapping child routes (nested via \`layout.tsx\`)
- **Loading states** — \`loading.tsx\` files for Suspense boundaries
- **Error handling** — \`error.tsx\` files for error boundaries
- **Server Actions** — \`"use server"\` functions for mutations
- **Route groups** — \`(group)/\` directories for logical organization without URL impact
- **Parallel routes** — \`@slot/\` directories for simultaneous rendering
- **Dynamic routes** — \`[param]/\` directories for parameterized URLs

## Do NOT

- Use \`any\` type — use \`unknown\` with type narrowing
- Access external services directly — use provider interfaces
- Put business logic in React components — extract to \`src/lib/\`
- Use \`getServerSideProps\` / \`getStaticProps\` — these are Pages Router (legacy)
- Import server-only code in client components
`,
  };
}

function agentignore(): FileEntry {
  return {
    path: ".agentignore",
    content: `# Build artifacts
.next/
out/
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

# Next.js generated
next-env.d.ts
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
        extensions: [
          "dbaeumer.vscode-eslint",
          "esbenp.prettier-vscode",
          "vitest.explorer",
          "bradlc.vscode-tailwindcss",
        ],
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
      - run: npm run build
`,
  };
}

function readme(name: string): FileEntry {
  return {
    path: "README.md",
    content: `# ${name}

A Next.js application scaffolded with [ariscan](https://github.com/prontiq/ariscan).

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

\`\`\`bash
npm run build       # Build for production
npm run lint        # Lint
npm run typecheck   # Type-check
npm test            # Run tests
npm run format      # Format code
\`\`\`
`,
  };
}

/* ------------------------------------------------------------------ */
/*  Provider interfaces & test doubles (shared with bare)              */
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
# Copy to .env.local for development

# NEXT_PUBLIC_APP_URL=http://localhost:3000
`,
  };
}

function envLocalExample(): FileEntry {
  return {
    path: ".env.local.example",
    content: `# Local environment variables (not committed to git)
# Copy to .env.local and fill in values

# NEXT_PUBLIC_APP_URL=http://localhost:3000
# DATABASE_URL=
# API_SECRET=
`,
  };
}
