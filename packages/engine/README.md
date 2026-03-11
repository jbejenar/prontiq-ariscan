# @prontiq/ariscan-engine

> Scoring engine for the [ARI (Agent Readiness Index)](https://github.com/jbejenar/prontiq-ariscan) — scan repositories programmatically and get structured readiness scores.

Use this package to embed ARI scanning in your own tooling, CI pipelines, or reporting systems.

## Install

```bash
npm install @prontiq/ariscan-engine
```

## Quick Start

```ts
import { scan } from "@prontiq/ariscan-engine";

const result = await scan("/path/to/repo");

console.log(result.score);          // 0-100
console.log(result.level);          // "L1" .. "L5"
console.log(result.pillars);        // Per-pillar scores and findings
```

## API

### `scan(repoPath, config?)`

The primary entry point. Scans a repository and returns a full `ScanResult`.

```ts
import { scan } from "@prontiq/ariscan-engine";
import type { ScanResult, ScanConfig } from "@prontiq/ariscan-schema";

const config: Partial<ScanConfig> = {
  pillars: {
    P4: { enabled: false }, // skip Dev Environment pillar
  },
};

const result: ScanResult = await scan(".", config);
```

### `createRepoContext(repoPath)`

Creates a read-only filesystem abstraction used by analyzers. Useful for testing or building custom analysis pipelines.

```ts
import { createRepoContext } from "@prontiq/ariscan-engine";

const ctx = await createRepoContext("/path/to/repo");
const content = await ctx.readFile("package.json");
const exists = await ctx.fileExists("tsconfig.json");
```

### Scoring Utilities

```ts
import {
  calculateCompositeScore, // Weighted sum across pillar scores
  classifyMaturityLevel,   // Score -> L1..L5
  applySecurityGate,       // Enforce security gate cap
  aggregateResults,        // PillarResult[] -> ScanResult
} from "@prontiq/ariscan-engine";
```

### Detection

```ts
import { detect, detectLanguages, detectFrameworks, detectMonorepo } from "@prontiq/ariscan-engine";

const ctx = await createRepoContext(".");
const detection = await detect(ctx);
// { languages: [...], frameworks: [...], monorepo: { tool, packages } }
```

### Analyzer Interface

For building custom analyzers or plugins:

```ts
import type { PillarAnalyzer, RepoContext } from "@prontiq/ariscan-engine";
```

A `PillarAnalyzer` must implement:
- `pillar` — which `PillarId` it scores
- `name` — human-readable name
- `version` — semver string
- `supports(context)` — whether it can run on the given repo
- `analyze(context)` — returns a `PillarResult`

### Built-in Analyzers

```ts
import { ANALYZERS, getAnalyzer } from "@prontiq/ariscan-engine";

// All 8 built-in analyzers
console.log(ANALYZERS.map(a => a.name));

// Get a specific analyzer by pillar ID
const analyzer = getAnalyzer("P1"); // Agent Context Quality
```

## Related Packages

- [`ariscan`](https://www.npmjs.com/package/ariscan) — CLI tool
- [`@prontiq/ariscan-schema`](https://www.npmjs.com/package/@prontiq/ariscan-schema) — Type definitions and Zod schemas

## License

Elastic License 2.0 (ELv2)
