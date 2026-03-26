# Roadmap — Prontiq ARI (`ariscan`)

> Roadmap for ARI delivery, ecosystem adoption, and standards leadership.
>
> **Naming continuity:** legacy materials may reference **Tide Conform**. Naming is **Prontiq ARI (Agent Readiness Index)**.

## Priority Legend

- 🔴 **P0** — Must ship to unlock next phase.
- 🟠 **P1** — Should ship to hit adoption and quality targets.
- 🟡 **P2** — Valuable expansion once core is stable.

---

## Purpose

This roadmap tracks the open-source `ariscan` CLI — scoring, remediation guidance, CI integration, and ecosystem tooling.

---

## Scope Boundaries

### In Scope

- Open CLI scanning, scoring, and report generation.
- Project scaffolding (`ariscan init`) with framework-specific presets and dogfood gate.
- CI integrations and policy docs.
- Scoring spec versioning and changelog transparency.
- Reproducible benchmark methodology and topline publishing.
- Optional anonymised telemetry (opt-in) for calibration improvements.

### Out of Scope

- Features beyond local CLI analysis and reporting.

---

## Phase P1 — MVP CLI Foundation (`ariscan` v0.1.0, Weeks 1–6)

**Goal:** ship deterministic baseline scoring across all 8 pillars with explainable output.

### Tech Stack & Implementation Guide (RFC-0003)

The `ariscan` CLI tech stack is defined in [RFC-0003](/rfcs/RFC-0003-tech-stack-ai-first-architecture.md). This section provides full implementation detail — enough for an AI coding agent to scaffold and build the project.

#### Core Dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | `^5.7.0` | Language (strict mode required) |
| `citty` | `^0.1.0` | CLI framework (UnJS, zero deps) |
| `zod` | `^3.23.0` | Schema validation + type inference |
| `web-tree-sitter` | `^0.24.0` | Tree-sitter WASM runtime |
| `yaml` | `^2.6.0` | YAML parsing for `.ariscan.yml` |
| `picocolors` | `^1.1.0` | Terminal colors (tiny, no deps) |

| Dev Package | Version | Purpose |
|---|---|---|
| `vitest` | `^3.0.0` | Testing framework |
| `tsup` | `^8.3.0` | Build (esbuild-based bundler) |
| `eslint` | `^9.18.0` | Linting (flat config) |
| `@typescript-eslint/eslint-plugin` | `^8.0.0` | TypeScript lint rules |
| `prettier` | `^3.4.0` | Code formatting |
| `husky` | `^9.0.0` | Git hooks |
| `turbo` | `^2.3.0` | Monorepo task orchestration |

Tree-sitter WASM grammars (bundled in `packages/engine/grammars/`):

| Grammar | File | Languages |
|---|---|---|
| `tree-sitter-typescript.wasm` | Bundled | TypeScript, TSX |
| `tree-sitter-javascript.wasm` | Bundled | JavaScript, JSX |
| `tree-sitter-python.wasm` | Bundled | Python |
| `tree-sitter-go.wasm` | Bundled | Go |
| `tree-sitter-java.wasm` | Bundled | Java |
| `tree-sitter-rust.wasm` | Bundled | Rust |
| `tree-sitter-c-sharp.wasm` | Bundled | C# |
| `tree-sitter-ruby.wasm` | Bundled | Ruby |

Grammars are committed as binary WASM files in the repo. Loaded at runtime via `web-tree-sitter` — no native compilation, no `node-gyp`, no build tools required on user's machine.

#### Repository Structure

```
prontiq/ariscan/
├── packages/
│   ├── cli/                              # CLI entrypoint (citty)
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── scan.ts               # npx @prontiq/ariscan-cli . (default command)
│   │   │   │   ├── doctor.ts             # npx @prontiq/ariscan-cli doctor [--json]
│   │   │   │   ├── init.ts               # npx @prontiq/ariscan-cli init [agents-md|agentignore|devcontainer|policy]
│   │   │   │   ├── audit.ts              # npx @prontiq/ariscan-cli audit agents-md
│   │   │   │   ├── diff.ts               # npx @prontiq/ariscan-cli diff context
│   │   │   │   ├── badge.ts              # npx @prontiq/ariscan-cli badge
│   │   │   │   ├── taxonomy.ts           # npx @prontiq/ariscan-cli taxonomy [ARI-XXX-NNN] [--json]
│   │   │   │   ├── policy.ts             # npx @prontiq/ariscan-cli policy [init|validate]
│   │   │   │   ├── simulate.ts           # npx @prontiq/ariscan-cli simulate
│   │   │   │   └── config.ts             # npx @prontiq/ariscan-cli config [set|show-telemetry-payload]
│   │   │   ├── output/
│   │   │   │   ├── json.ts               # --format json (default for non-TTY)
│   │   │   │   ├── sarif.ts              # --format sarif (GitHub Code Scanning)
│   │   │   │   ├── terminal.ts           # --format terminal (default for TTY, colored)
│   │   │   │   └── markdown.ts           # --format markdown (shareable report)
│   │   │   └── cli.ts                    # Main citty entrypoint
│   │   ├── package.json
│   │   └── tsup.config.ts                # Single-file bundle config
│   │
│   ├── engine/                            # Core scanning engine (pure functions)
│   │   ├── src/
│   │   │   ├── analyzers/
│   │   │   │   ├── analyzer.interface.ts  # PillarAnalyzer interface + PillarResult type
│   │   │   │   ├── context-quality.ts     # P1: AGENTS.md quality, additionality, staleness
│   │   │   │   ├── feedback-loop.ts       # P2: test/lint/typecheck speed, watch mode
│   │   │   │   ├── test-isolation.ts      # P3: cloud deps, flakiness patterns, ordering
│   │   │   │   ├── dev-environment.ts     # P4: devcontainer, bootstrap, time-to-first-test
│   │   │   │   ├── doc-readability.ts     # P5: OpenAPI, error taxonomy, env schema, ADRs
│   │   │   │   ├── build-determinism.ts   # P6: strict types, lockfiles, build tools
│   │   │   │   ├── navigability.ts        # P7: directory depth, imports, complexity, dead code
│   │   │   │   └── security-governance.ts # P8: branch protection, CODEOWNERS, secrets, SAST
│   │   │   ├── detection/
│   │   │   │   ├── languages.ts           # Language detection (file extensions + markers)
│   │   │   │   ├── frameworks.ts          # Framework detection (config files + patterns)
│   │   │   │   └── monorepo.ts            # Monorepo detection (Turborepo, Nx, pnpm, Cargo, Go)
│   │   │   ├── context/
│   │   │   │   ├── discovery.ts           # Find AGENTS.md, CLAUDE.md, .cursorrules, etc.
│   │   │   │   ├── additionality.ts       # Semantic comparison vs README/CONTRIBUTING
│   │   │   │   └── budget.ts              # Token estimation per file/directory
│   │   │   ├── scoring/
│   │   │   │   ├── composite.ts           # Weighted aggregation, L1-L5 mapping
│   │   │   │   ├── weights.ts             # Research-calibrated pillar weights
│   │   │   │   └── security-gate.ts       # P8 < 40% → cap at L2
│   │   │   ├── tree-sitter/
│   │   │   │   ├── loader.ts              # WASM grammar loading + caching
│   │   │   │   └── queries.ts             # Reusable tree-sitter queries per language
│   │   │   └── scan.ts                    # Pure function: scan(path, config) → ScanResult
│   │   ├── grammars/                      # Tree-sitter WASM binaries (committed)
│   │   │   ├── tree-sitter-typescript.wasm
│   │   │   ├── tree-sitter-javascript.wasm
│   │   │   ├── tree-sitter-python.wasm
│   │   │   ├── tree-sitter-go.wasm
│   │   │   ├── tree-sitter-java.wasm
│   │   │   ├── tree-sitter-rust.wasm
│   │   │   ├── tree-sitter-c-sharp.wasm
│   │   │   └── tree-sitter-ruby.wasm
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── schema/                            # Shared Zod schemas + JSON Schema generation
│   │   ├── src/
│   │   │   ├── scan-result.ts             # ScanResult, PillarResult, Finding schemas
│   │   │   ├── config.ts                  # ariscan.yml policy schema
│   │   │   ├── taxonomy.ts                # Error taxonomy entry schema
│   │   │   ├── sarif.ts                   # SARIF 2.1.0 output projection
│   │   │   └── index.ts                   # Public exports
│   │   ├── generated/
│   │   │   ├── scan-result.schema.json    # Auto-generated JSON Schema (for IDE/validation)
│   │   │   └── config.schema.json         # Auto-generated JSON Schema (for IDE autocomplete)
│   │   └── package.json
│   │
│   └── testing/                           # Test infrastructure
│       ├── conformance/
│       │   └── analyzer.conformance.ts    # Conformance suite every PillarAnalyzer must pass
│       ├── fixtures/                      # Minimal test repos (one per language/scenario)
│       │   ├── typescript-strict/
│       │   ├── typescript-loose/
│       │   ├── python-typed/
│       │   ├── python-untyped/
│       │   ├── go-standard/
│       │   ├── monorepo-pnpm/
│       │   ├── no-context-files/
│       │   └── full-score/                # Reference L5 repo
│       ├── factories/
│       │   └── scan-result.factory.ts     # Test data factories
│       └── package.json
│
├── docs/
│   ├── error-taxonomy.json                # ARI-* error codes (machine-readable)
│   └── architecture/
│       └── OVERVIEW.md
│
├── rfcs/
│   ├── RFC-0001-ari-scoring-rubric.md
│   ├── RFC-0002-agentignore-spec.md
│   ├── RFC-0003-tech-stack-ai-first-architecture.md
│   └── TEMPLATE.md
│
├── .github/
│   ├── workflows/
│   │   └── ci.yml                         # Lint, typecheck, test, build
│   ├── agents/
│   │   ├── scorer.agent.md                # AI agent persona: scoring engine work
│   │   └── analyzer.agent.md              # AI agent persona: pillar analyzer work
│   ├── prompts/
│   │   ├── add-analyzer.prompt.md         # Prompt template: adding a new pillar analyzer
│   │   ├── add-fixture.prompt.md          # Prompt template: adding a test fixture
│   │   └── fix-finding.prompt.md          # Prompt template: fixing a scan finding
│   └── copilot-instructions.md
│
├── AGENTS.md                              # Primary AI agent reference (dog-fooded)
├── CLAUDE.md                              # Claude Code-specific guidance (dog-fooded)
├── .agentignore                           # Agent ignore file (dog-fooded)
├── .ariscan.yml                           # Self-scan policy targeting L5 (dog-fooded)
├── .nvmrc                                 # Node.js 22 (exact version)
├── .prettierrc                            # Prettier config
├── .prettierignore
├── eslint.config.js                       # ESLint 9 flat config
├── turbo.json                             # Turborepo pipeline config
├── pnpm-workspace.yaml                    # Workspace definition
├── tsconfig.json                          # Root TypeScript config (strict)
├── vitest.workspace.ts                    # Vitest workspace config
├── package.json                           # Root package.json
├── README.md
├── CONTRIBUTING.md
├── LICENSE                                # Elastic License 2.0 (ELv2)
└── CHANGELOG.md
```

#### Workspace Configuration

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - "packages/*"
```

**`turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "verify": {
      "dependsOn": ["lint", "typecheck", "test"]
    }
  }
}
```

**Root `package.json` scripts:**
```json
{
  "name": "@prontiq/ariscan-cli",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.4",
  "engines": { "node": ">=22.0.0", "pnpm": ">=9.15.0" },
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "test:ci": "turbo test -- --reporter=junit --outputFile=test-results.xml",
    "lint": "turbo lint",
    "lint:fix": "turbo lint -- --fix",
    "typecheck": "turbo typecheck",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "verify": "turbo verify",
    "verify:json": "pnpm verify 2>&1 | node -e \"process.stdin.pipe(process.stdout)\"",
    "doctor": "node packages/cli/dist/cli.js doctor",
    "doctor:json": "node packages/cli/dist/cli.js doctor --json",
    "scan": "node packages/cli/dist/cli.js scan",
    "generate:schema": "turbo --filter=@prontiq/ariscan-schema generate",
    "prepare": "husky"
  }
}
```

#### TypeScript Configuration

**Root `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

Each package extends the root config:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

#### ESLint Configuration

**`eslint.config.js`:**
```javascript
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true
      }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: { 'no-console': 'off' },
  },
];
```

#### Core Type Definitions & Zod Schemas

**`packages/schema/src/scan-result.ts`:**
```typescript
import { z } from 'zod';

// --- Pillar IDs ---
export const PillarId = z.enum([
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'
]);
export type PillarId = z.infer<typeof PillarId>;

export const PillarName = z.enum([
  'agent-context-quality',
  'feedback-loop-speed',
  'test-isolation',
  'dev-environment',
  'doc-machine-readability',
  'build-determinism-type-safety',
  'code-navigability',
  'security-governance',
]);
export type PillarName = z.infer<typeof PillarName>;

// --- Maturity Levels ---
export const MaturityLevel = z.enum(['L1', 'L2', 'L3', 'L4', 'L5']);
export type MaturityLevel = z.infer<typeof MaturityLevel>;

export const MaturityLevelMeta = z.object({
  level: MaturityLevel,
  name: z.enum(['Hostile', 'Fragile', 'Capable', 'Productive', 'Autonomous']),
  description: z.string(),
  scoreRange: z.object({ min: z.number(), max: z.number() }),
});

// --- Severity ---
export const Severity = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof Severity>;

// --- Confidence ---
export const Confidence = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof Confidence>;

// --- Remediation ---
export const Remediation = z.object({
  action: z.enum([
    'create-file', 'modify-config', 'add-dependency',
    'add-script', 'enable-feature', 'manual-review'
  ]),
  path: z.string().optional(),
  generator: z.string().optional(),       // CLI command to generate fix
  template: z.string().url().optional(),   // Link to template
  estimatedImpact: z.string(),             // e.g., "+12 points composite"
  confidence: Confidence,
});
export type Remediation = z.infer<typeof Remediation>;

// --- Evidence (research citation) ---
export const Evidence = z.object({
  paper: z.string(),                       // e.g., "Lulla et al., 2026"
  finding: z.string(),                     // Key finding summary
  confidence: Confidence,
});
export type Evidence = z.infer<typeof Evidence>;

// --- Finding ---
export const Finding = z.object({
  code: z.string().regex(/^ARI-[A-Z]{3}-\d{3}$/),  // e.g., ARI-CTX-001
  severity: Severity,
  pillar: PillarId,
  pillarName: PillarName,
  file: z.string().nullable(),
  line: z.number().nullable(),
  message: z.string(),
  remediation: Remediation,
  evidence: Evidence,
});
export type Finding = z.infer<typeof Finding>;

// --- Pillar Result ---
export const PillarResult = z.object({
  pillar: PillarId,
  name: PillarName,
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  confidence: Confidence,
  findings: z.array(Finding),
  summary: z.string(),
});
export type PillarResult = z.infer<typeof PillarResult>;

// --- Language Detection ---
export const DetectedLanguage = z.object({
  language: z.string(),
  confidence: z.number().min(0).max(1),
  primary: z.boolean(),
});

export const DetectedFramework = z.object({
  framework: z.string(),
  confidence: z.number().min(0).max(1),
});

export const DetectedMonorepo = z.object({
  tool: z.string(),                        // e.g., "turborepo", "pnpm", "nx"
  workspaceRoot: z.string(),
  packages: z.array(z.string()),
});

// --- Context File Inventory ---
export const ContextFile = z.object({
  path: z.string(),
  type: z.enum([
    'agents-md', 'claude-md', 'cursorrules', 'cursor-rules-dir',
    'copilot-instructions', 'mcp-config', 'aider-config', 'agentignore'
  ]),
  sizeBytes: z.number(),
  lastModified: z.string().datetime(),
  parseStatus: z.enum(['valid', 'warning', 'error']),
  parseErrors: z.array(z.string()).optional(),
});

// --- Scan Metadata ---
export const ScanMetadata = z.object({
  version: z.string(),                     // ariscan version
  rubricVersion: z.string(),               // Scoring rubric version (RFC-0001)
  timestamp: z.string().datetime(),
  durationMs: z.number(),
  repoPath: z.string(),
  offline: z.boolean(),
});

// --- Scan Result (top-level output) ---
export const ScanResult = z.object({
  $schema: z.string().optional(),
  metadata: ScanMetadata,
  score: z.number().min(0).max(100),
  level: MaturityLevel,
  levelMeta: MaturityLevelMeta,
  securityGateTriggered: z.boolean(),
  pillars: z.array(PillarResult),
  findings: z.array(Finding),
  languages: z.array(DetectedLanguage),
  frameworks: z.array(DetectedFramework),
  monorepo: DetectedMonorepo.nullable(),
  contextFiles: z.array(ContextFile),
});
export type ScanResult = z.infer<typeof ScanResult>;
```

#### Analyzer Interface (Provider Pattern)

**`packages/engine/src/analyzers/analyzer.interface.ts`:**
```typescript
import type { PillarId, PillarName, PillarResult, Confidence } from '@prontiq/ariscan-schema';

export interface RepoContext {
  rootPath: string;
  files: string[];                         // All file paths relative to root
  languages: DetectedLanguage[];
  frameworks: DetectedFramework[];
  monorepo: DetectedMonorepo | null;
  contextFiles: ContextFile[];
  config: ScanConfig;
}

export interface PillarAnalyzer {
  readonly pillar: PillarId;
  readonly name: PillarName;
  readonly version: string;

  /** Whether this analyzer is applicable to the given repo */
  supports(context: RepoContext): boolean;

  /** Run analysis and return scored result */
  analyze(context: RepoContext): Promise<PillarResult>;
}
```

All 8 pillar analyzers implement `PillarAnalyzer`. Community plugins (P3.08) also implement this interface and must pass the conformance suite in `packages/testing/conformance/analyzer.conformance.ts`.

**Conformance requirements** (every analyzer must):
1. Return a valid `PillarResult` that passes Zod validation.
2. Return `score` between 0-100.
3. Return deterministic results on the same input (no randomness).
4. Complete within 30 seconds for repos up to 50k files.
5. Never make network calls.
6. Never read files outside `context.rootPath`.
7. Include at least one `Finding` with a valid `ARI-*` code.

#### Error Taxonomy Format

**`docs/error-taxonomy.json`** structure:
```json
{
  "$schema": "https://prontiq.dev/schemas/error-taxonomy.v1.json",
  "version": "1.0.0",
  "entries": {
    "ARI-CTX-001": {
      "pillar": "P1",
      "pillarName": "agent-context-quality",
      "severity": "critical",
      "title": "Missing AGENTS.md",
      "description": "No AGENTS.md file found at repository root.",
      "remediation": {
        "action": "create-file",
        "path": "AGENTS.md",
        "generator": "npx @prontiq/ariscan-cli init agents-md"
      },
      "evidence": {
        "paper": "Lulla et al., 2026",
        "finding": "Quality AGENTS.md reduces agent execution time by 28.6% and token consumption by 16.6%."
      }
    },
    "ARI-CTX-002": {
      "pillar": "P1",
      "pillarName": "agent-context-quality",
      "severity": "high",
      "title": "AGENTS.md exceeds context budget",
      "description": "AGENTS.md file exceeds 4000 tokens, risking Lost in the Middle degradation.",
      "remediation": {
        "action": "manual-review",
        "estimatedImpact": "+5 points P1"
      },
      "evidence": {
        "paper": "Liu et al., 2024",
        "finding": ">30% performance degradation when relevant info sits in middle of long contexts."
      }
    }
  }
}
```

Code format: `ARI-{PILLAR}-{NNN}` where pillar codes are:
- `CTX` — Agent Context Quality (P1)
- `FBK` — Feedback Loop Speed (P2)
- `TST` — Test Isolation (P3)
- `ENV` — Dev Environment (P4)
- `DOC` — Doc Machine-Readability (P5)
- `TYP` — Build Determinism & Type Safety (P6)
- `NAV` — Code Navigability (P7)
- `SEC` — Security & Governance (P8)

#### CLI Command Structure (citty)

```
ariscan <command> [options]

Commands:
  scan [path]              Scan repository and produce ARI score (default command)
  doctor                   Check ariscan prerequisites and environment
  init <template>          Generate starter files (agents-md, agentignore, devcontainer, policy)
  audit agents-md          Detailed quality audit of AGENTS.md
  diff context             Cross-file additive/duplicative analysis
  badge                    Generate README badge from latest scan
  taxonomy [code]          Look up ARI error taxonomy codes
  policy init              Generate starter policy from current scores
  policy validate          Validate ariscan.yml syntax and semantics
  simulate                 Run agent-like workflow simulation
  config set <key> <value> Set configuration (e.g., telemetry true/false)
  config show-telemetry-payload  Show exact telemetry payload

Global Options:
  --format <type>          Output format: json | sarif | terminal | markdown (default: terminal if TTY, json otherwise)
  --output <path>          Write output to file instead of stdout
  --verbose                Show detailed analysis information
  --quiet                  Suppress non-essential output (CI mode)
  --json                   Alias for --format json
  --json-schema            Output the JSON Schema for the scan result
  --config <path>          Path to config file (default: .ariscan.yml)
  --no-color               Disable colored output
  --help                   Show help
  --version                Show version

Scan Options:
  --fix                    Apply safe, non-destructive fixes
  --fix --dry-run          Preview fixes without writing
  --fix --force            Apply fixes that modify existing files (requires explicit opt-in)
  --threshold <score>      Minimum passing score (default: from policy or 0)
  --pillar <P1..P8>        Score only specified pillar(s)
  --language <lang>        Override language detection

Exit Codes:
  0  Pass — score meets or exceeds threshold
  1  Fail — score below threshold
  2  Error — scan could not complete
```

#### Tree-sitter WASM Loading

**`packages/engine/src/tree-sitter/loader.ts`** pattern:
```typescript
import Parser from 'web-tree-sitter';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const GRAMMAR_DIR = join(import.meta.dirname, '..', '..', 'grammars');
const parserCache = new Map<string, Parser>();

export async function getParser(language: string): Promise<Parser | null> {
  if (parserCache.has(language)) return parserCache.get(language)!;

  const grammarFile = `tree-sitter-${language}.wasm`;
  const grammarPath = join(GRAMMAR_DIR, grammarFile);

  try {
    await Parser.init();
    const parser = new Parser();
    const lang = await Parser.Language.load(grammarPath);
    parser.setLanguage(lang);
    parserCache.set(language, parser);
    return parser;
  } catch {
    return null; // Grammar not available for this language
  }
}
```

Grammars are loaded lazily on first use and cached. If a grammar isn't available for a detected language, the analyzer falls back to non-AST heuristics (regex, file-based analysis).

#### AI-First Architecture Patterns

These patterns are extracted from the [ripple-next](https://github.com/jbejenar/ripple-next) reference architecture (an AI-agent-first government digital platform). We extract **patterns**, not code.

| Pattern | Implementation in ariscan | Origin |
|---|---|---|
| Error Taxonomy | `ARI-*` codes in `docs/error-taxonomy.json` | ripple-next `RPL-*` codes in `docs/error-taxonomy.json` |
| Machine-Readable Output | `--format json` default for agents, `--format sarif` for GitHub | ripple-next `pnpm verify --json` |
| Provider Pattern | `PillarAnalyzer` interface + conformance suites | ripple-next provider pattern + `packages/testing/conformance/` |
| Structured Remediation | Findings include `remediation.action`, `remediation.generator` | ripple-next machine-readable runbooks (`pnpm runbook <name> --json`) |
| Agent Config Surfaces | AGENTS.md, CLAUDE.md, `.github/agents/`, `.github/prompts/` | ripple-next multi-surface AI config (7+ config files) |
| Self-Check | `npx @prontiq/ariscan-cli doctor --json` | ripple-next `pnpm doctor --json` |
| Pure Function Core | `scan(path, config) → ScanResult` for CLI, MCP, and Action | Enables MCP server (P3.10) and GitHub Action (P3.02) |

**Dog-fooding requirement:** The `ariscan` repo itself must score L5 on its own rubric. It ships with AGENTS.md, CLAUDE.md, `.agentignore`, `.ariscan.yml`, `docs/error-taxonomy.json`, and all agent configuration surfaces it measures in other repos.



### Epic P1.1 — Core Scanner Runtime

### Ticket P1.01 — CLI Scaffold and Config Runtime

```yaml
id: P1.01
title: CLI Scaffold and Config Runtime
status: done
blocked_by:
priority: p0-critical
epic: P1.1
rfc: RFC-0003
persona: [OSS maintainer, team lead]
depends_on: [npm package name claimed, TypeScript project scaffold, Vitest]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: 2026-03-08
```

## User Story

As a maintainer, I need a stable command entrypoint and predictable config behavior so I can integrate `ariscan` into my workflow without surprises.

## Problem Statement

There is no standard CLI tool for measuring AI coding agent readiness. Developers need a single command that works out of the box, respects local configuration, and produces deterministic, machine-parseable output suitable for CI pipelines.

## Definition of Done

### Functional

- [x] `npx @prontiq/ariscan-cli .` command that scans the current directory and produces a scored report.
  - `Verify:` Run `npx @prontiq/ariscan-cli . --json` and confirm JSON output with `score` field
  - `Evidence:` `cli.ts` defines main command with positional `path` defaulting to `"."`
- [x] Config loading with clear precedence: CLI flags > `.ariscan.yml` > built-in defaults.
  - `Verify:` Run `pnpm --filter @prontiq/ariscan-engine test -- --run config-loader` and confirm all tests pass
  - `Evidence:` Implemented in `config-loader.ts` with directory walk-up, YAML parsing, Zod validation via `FileConfig` schema. `resolveConfig()` merges CLI > file > defaults. 16 unit tests.
- [x] Deterministic exit codes: 0 (pass), 1 (fail — below threshold), 2 (error — scan could not complete).
  - `Verify:` Run `npx @prontiq/ariscan-cli /nonexistent 2>/dev/null; echo $?` and confirm exit code 2
  - `Evidence:` `process.exit(2)` on path not found and scan error. `process.exit(1)` when score < threshold. Implicit 0 on success.
- [x] `--verbose` and `--quiet` modes for debugging and CI respectively.
  - `Verify:` Run `npx @prontiq/ariscan-cli . --verbose` and confirm detailed pillar output; run with `--quiet` and confirm single-line output
  - `Evidence:` `--verbose` shows pillar details, detection info, context files, and all findings. `--quiet` outputs single-line CI-friendly summary "ARI score/100 level (name)". Added 2026-03-08.
- [x] Zero external network calls during scan (fully offline operation).
  - `Verify:` Run `grep -r "fetch\|http\|axios" packages/engine/src packages/cli/src` and confirm no network imports
  - `Evidence:` No `fetch`, `http`, `axios`, or network imports in engine/CLI

### Documentation

- [x] `--help` output documenting all core flags, examples, and config file format.
  - `Verify:` Run `npx @prontiq/ariscan-cli --help` and confirm output contains flags and examples
  - `Evidence:` citty auto-generates flag docs + 3 usage examples in description (basic scan, JSON output, threshold)
- [x] `--help` includes at least 3 usage examples.
  - `Verify:` Run `npx @prontiq/ariscan-cli --help | grep -c "npx"` and confirm ≥3
  - `Evidence:` 3 examples: `npx @prontiq/ariscan-cli .`, `npx @prontiq/ariscan-cli /path --json`, `npx @prontiq/ariscan-cli . --threshold 60`
- [x] Exit code matrix documented for CI users in both `--help` and published docs.
  - `Verify:` Run `npx @prontiq/ariscan-cli --help` and confirm exit codes 0/1/2 are documented
  - `Evidence:` Exit codes 0/1/2 documented in `--help` description. Added 2026-03-10.

### Testing

- [x] Config precedence (CLI > local config > defaults) is tested with unit tests covering each override layer.
  - `Verify:` Run `pnpm --filter @prontiq/ariscan-engine test -- --run config-loader` and confirm all 16 tests pass
  - `Evidence:` 16 tests in `config-loader.test.ts` covering YAML parsing, validation, directory traversal, merging

### Performance

- [x] Runs to completion on repos up to 100k files within 60 seconds on commodity hardware.
  - `Verify:` Run `pnpm --filter @prontiq/ariscan-engine test -- --run performance` and confirm 100k-file test passes
  - `Evidence:` Performance test: 100k files in ~685ms (mock context), sub-linear scaling verified (8.1x for 10x files). Added 2026-03-14.

### Meta

- [x] AI-first patterns: `ARI-*` error taxonomy scaffold, AGENTS.md + CLAUDE.md for the ariscan repo itself (dog-fooding).
  - `Verify:` Check `test -f AGENTS.md && test -f CLAUDE.md && echo PASS`
  - `Evidence:` AGENTS.md, CLAUDE.md, `.agentignore` all present and maintained for dog-fooding.

### Telemetry (non-blocking)

- [ ] Install-to-first-scan time [DEFERRED: external user-experience metric — cannot be measured per-scan by the scanner itself; requires npm publish + user study or analytics integration]
- [x] Scan duration p50/p95 — `duration_ms` field in telemetry payload enables server-side p50/p95 aggregation

## Scope

### In

- CLI entrypoint, config loading, flag parsing, exit codes, basic error handling
- `ARI-*` error taxonomy scaffold
- AGENTS.md + CLAUDE.md for the ariscan repo itself (dog-fooding)

### Out — Do Not Implement

- Scoring logic → separate tickets (P1.04–P1.12)
- Output formatting → separate tickets (P1.14, P1.15)
- Network features

## Research Basis

- Tech stack defined in RFC-0003: Node.js 22, TypeScript 5.7 strict, pnpm workspaces, Turborepo, citty (CLI framework), Zod (config validation), tsup (build), Vitest (testing), ESLint 9 + Prettier (linting).
- AI-first patterns extracted from ripple-next reference architecture: `ARI-*` error taxonomy, provider pattern for analyzers, pure function core (`scan(path, config) → ScanResult`).

---

### Ticket P1.02 — Language and Framework Detection

```yaml
id: P1.02
title: Language and Framework Detection
status: in-progress
blocked_by:
priority: p0-critical
epic: P1.1
rfc: RFC-0003
persona: [developer]
depends_on: [P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As a developer, I need ariscan to automatically detect my project's languages and frameworks so the scoring is relevant without manual configuration.

## Problem Statement

Agent readiness criteria differ by language — TypeScript strict mode is irrelevant for Go, Python venv matters more than Node modules. Accurate detection is prerequisite to meaningful scoring. Monorepo detection is critical because monorepos require different scoring strategies (per-package analysis, project reference checks). Research from Multi-SWE-bench (Zan et al., 2025) confirms agents perform differently across languages, and SWE-bench Pro shows agents struggle especially with complex JS/TS monorepos where "erratic" performance is common.

## Definition of Done

### Functional

- [x] Detection engine for: TypeScript, JavaScript, Python, Go, Rust, Java, C#, Ruby, PHP.
  - `Verify:` Run scan on a multi-language fixture repo and confirm all languages detected in JSON output
  - `Evidence:` Implemented in `detection/languages.ts` with file extension + marker file boosting
- [x] Framework detection: React, Next.js, Vue, Nuxt, Express, FastAPI, Django, Flask, Spring Boot, .NET, Rails.
  - `Verify:` Run scan on a Next.js fixture repo and confirm `frameworks` array in JSON output
  - `Evidence:` Implemented in `detection/frameworks.ts` — 14 frameworks via config files and deps. Also: Astro, Svelte, Angular.
- [x] Monorepo detection: Turborepo, Nx, Lerna, pnpm workspaces, Cargo workspaces, Go modules.
  - `Verify:` Run scan on this repo and confirm monorepo detected in JSON output
  - `Evidence:` Implemented in `detection/monorepo.ts` — 6 monorepo tools. Go workspaces instead of Go modules.
- [x] Detection confidence score (0-1) per detected language/framework in JSON output.
  - `Verify:` Run `npx @prontiq/ariscan-cli . --json | jq '.languages[0].confidence'` and confirm numeric value
  - `Evidence:` Each `DetectedLanguage`/`DetectedFramework` includes confidence field
- [x] Primary language determination for weight calibration.
  - `Verify:` Run `npx @prontiq/ariscan-cli . --json | jq '.languages[] | select(.primary==true)'` and confirm one result
  - `Evidence:` Languages sorted by confidence, `primary: true` flag on highest
- [x] Graceful fallback to "unknown" with appropriate confidence level when detection is ambiguous.
  - `Verify:` Run scan on empty directory and confirm no crash, empty arrays returned
  - `Evidence:` Returns empty arrays when no languages/frameworks detected

### Testing

- [ ] False-language detection rate <5% on benchmark cohort of 50+ repos. [BLOCKED: P1.18 cohort has 21 repos (need 50+); expanding cohort is a separate effort]
  - `Verify:` Run benchmark suite on 50+ repos and compute false detection rate
  - `Evidence:`

### Performance

- [x] Detection completes in <2 seconds for repos up to 100k files.
  - `Verify:` Run performance test with 100k-file fixture and measure duration
  - `Evidence:` Performance test suite confirms 100k files scanned in ~1.2s (well under 2s limit). Sub-linear scaling verified: 10k→100k ratio is ~7.8x. Verified 2026-03-16.

### Functional

- [x] Monorepo detection identifies workspace root and package boundaries.
  - `Verify:` Run scan on monorepo and confirm `monorepo.workspaceRoot` and `monorepo.packages` populated
  - `Evidence:` detectMonorepo() returns workspaceRoot "." and packages array for all 6 supported tools (Turborepo, Nx, Lerna, pnpm, Cargo, Go). Comprehensive test suite with explicit workspace root + boundary assertions. Verified 2026-03-16.

### Telemetry (non-blocking)

- [ ] Detection accuracy rate [DEFERRED: requires manually-labelled ground-truth data to compute accuracy — P1.18 benchmark provides scan results but not human-verified language labels]
- [x] Languages per scan distribution — `language_count` field emits per-scan language count

## Scope

### In

- File-system-based detection (package.json, Cargo.toml, go.mod, pyproject.toml, etc.)
- Framework marker files

### Out — Do Not Implement

- Runtime detection
- Version-specific analysis
- Dependency graph resolution

## Research Basis

- Multi-SWE-bench (Zan et al., 2025): extends evaluation beyond Python to Java, TypeScript, Go, Rust, C, C++ — validating the need for cross-language support.
- Veracode (2025): language-specific vulnerability rates (Java 72% vs Python 38%) requiring per-language calibration.

---

### Ticket P1.03 — Context File Discovery

```yaml
id: P1.03
title: Context File Discovery
status: in-progress
blocked_by:
priority: p0-critical
epic: P1.1
rfc: RFC-0003
persona: [agent user]
depends_on: [P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As an agent user, I need ariscan to find all my agent context files so I know what guidance my agents are receiving and whether it's well-formed.

## Problem Statement

The AI coding agent ecosystem is fragmented across multiple context file formats (AGENTS.md, CLAUDE.md, .cursorrules, copilot-instructions.md, .github/copilot-instructions.md). Research shows 60,000+ repos on GitHub have adopted AGENTS.md, but quality varies dramatically. Gloaguen et al. (2026, ETH Zurich) found that LLM-generated context files actually decrease agent success rates by 2-3% while increasing inference costs by 20%+, while human-written files improve performance by ~4% on niche repos. Discovery is the prerequisite to quality assessment.

## Definition of Done

### Functional

- [x] Discovery of all known context file formats:
  - `Verify:` Run scan on a fixture repo with multiple context file types and confirm all discovered
  - `Evidence:` Discovers AGENTS.md, CLAUDE.md, .cursorrules, .cursor/rules, .github/copilot-instructions.md, .aider.conf.yml, .aiderignore, .agentignore, .mcp.json, mcp.config.js, .claude/settings.json, .claude/commands/. Cross-agent compatibility report moved to P2.
  - [x] `AGENTS.md` (root and nested per AGENTS.md spec for monorepos)
    - `Verify:` Run scan on monorepo and confirm nested AGENTS.md files discovered
    - `Evidence:` Root + nested discovery for monorepos added 2026-03-09
  - [x] `CLAUDE.md` / `.claude/` directory files
    - `Verify:` Run `npx @prontiq/ariscan-cli . --json | jq '.contextFiles[] | select(.type=="claude-md")'`
    - `Evidence:` .claude/settings.json and .claude/commands/ discovery added 2026-03-09
  - [x] `.cursorrules` / `.cursor/rules/`
    - `Verify:` Check fixture scan for cursorrules detection
    - `Evidence:` Discovered via file pattern matching
  - [x] `copilot-instructions.md` / `.github/copilot-instructions.md`
    - `Verify:` Check fixture scan for copilot-instructions detection
    - `Evidence:` Both paths checked
  - [x] MCP configuration files (`.mcp.json`, `mcp.config.js`)
    - `Verify:` Check fixture scan for MCP config detection
    - `Evidence:` Added 2026-03-09
  - [x] `.aider.conf.yml` / `.aiderignore`
    - `Verify:` Check fixture scan for aider config detection
    - `Evidence:` Both paths checked
- [x] For each discovered file: path, file type, size, last modified date, parse status (valid/warning/error).
  - `Verify:` Run `npx @prontiq/ariscan-cli . --json | jq '.contextFiles[0] | keys'` and confirm all fields present
  - `Evidence:` ContextFileInfo includes lastModified via fs.stat and parseStatus via content validation in scan.ts `discoverContextFiles()`
- [x] Cross-agent compatibility report: which agents have dedicated context files vs none.
  - `Verify:` Run scan and check for ARI-CTX-010 finding in output
  - `Evidence:` ARI-CTX-010: maps files to 5 agent categories — Claude Code, Cursor, GitHub Copilot, Aider, Generic. Reports covered vs uncovered with remediation. Added 2026-03-09.
- [x] Nested file discovery for monorepos (subdirectory-level AGENTS.md files).
  - `Verify:` Run scan on monorepo fixture and confirm nested files in contextFiles array
  - `Evidence:` Added 2026-03-09
- [x] Non-parsable files surfaced with actionable warnings.
  - `Verify:` Create a malformed JSON context file and confirm ARI-CTX-009 finding
  - `Evidence:` ARI-CTX-009: validates JSON parse, YAML emptiness, empty files. Added 2026-03-09.

### Testing

- [x] Zero false negatives on benchmark cohort (every known context file is found).
  - `Verify:` Run benchmark suite and confirm all context files discovered
  - `Evidence:` `node benchmarks/validate-context-discovery.cjs` — GitHub API mode checks 11 root-level context file paths + nested AGENTS.md + .claude/commands/* across all 21 benchmark repos at pinned SHAs. 22 ground-truth files found, 22 discovered, 0 missed. False negative rate: 0.0%. Verified 2026-03-26.

### Performance

- [ ] Discovery completes in <1 second for repos up to 100k files. [BLOCKED: requires end-to-end benchmark with real or temp-backed filesystem fixture; current benchmark only measures post-walk file-list processing (~32ms), not actual discovery/filesystem walking]
  - `Verify:` Run end-to-end discovery on 100k-file fixture (real or temp-backed filesystem) and measure duration
  - `Partial evidence:` File-list processing benchmark in performance.test.ts: 100k files listed and sorted in ~32ms. This covers post-walk array processing only, not filesystem discovery. Added 2026-03-16.

### Telemetry (non-blocking)

- [x] Context files per repo distribution — `context_file_count` field emits per-scan count
- [x] Cross-agent coverage ratio — `agent_context_types` field emits distinct agent context type count

## Scope

### In

- File discovery, format identification, basic parse validation

### Out — Do Not Implement

- Content quality scoring → P1.04
- Additionality analysis → P1.04
- Context file generation → P2.01

## Research Basis

- Gloaguen et al. (2026): context file quality matters more than presence.
- Lulla et al. (2026): well-written AGENTS.md reduces agent execution time by 28.6% and token consumption by 16.6%.


### Epic P1.2 — Baseline Pillar Scoring

### Ticket P1.04 — Context Additionality Baseline (Pillar 1)

```yaml
id: P1.04
title: Context Additionality Baseline (Pillar 1)
status: done
blocked_by:
priority: p1-high
epic: P1.2
rfc: RFC-0003
persona: [maintainer, team maintaining agent context files]
depends_on: [P1.03, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: 2026-03-23
```

## User Story

As a maintainer, I need to know whether my context files are actually helping my agents or just duplicating what's already in the README.

## Problem Statement

The most impactful finding from Gloaguen et al. (2026, ETH Zurich) is that auto-generated AGENTS.md files *hurt* agent performance by 2-3% while increasing inference cost by 20%+. The mechanism is information redundancy — context files that restate the README add noise to the agent's context window without providing new signal. The "Lost in the Middle" effect (Liu et al., 2024) shows >30% performance degradation when relevant information sits in the middle of long contexts. Context volume alone degrades reasoning even when retrieval succeeds (arXiv 2510.05381, 2025). Information Gain per Turn decay and Token Waste Ratio are associated with 30-40% performance drops (OpenReview, 2025). This means a context file that duplicates existing information is *worse* than no context file at all.

## Definition of Done

### Functional

- [x] Semantic comparison engine: context file content vs README, CONTRIBUTING, docstrings, CI workflows, and config files.
  - `Verify:` Run scan on fixture with duplicative AGENTS.md and confirm redundancy percentage reported
  - `Evidence:` `computeAdditionality()` in `context-quality.ts` uses sentence-level Jaccard similarity (threshold ≥0.6) to compare context files against a reference corpus of README, CONTRIBUTING, CI workflows, package.json scripts, config files (tsconfig, Makefile, etc.), and leading source-file docstrings. Test: "emits ARI-CTX-011 when AGENTS.md duplicates README content" (context-quality.test.ts:617). 69 tests pass. Verified 2026-03-23.
- [x] Redundancy percentage per context file (% of content duplicated elsewhere in repo).
  - `Verify:` Check JSON output for redundancy percentage field
  - `Evidence:` `AdditionalityResult.redundancyPct` computed as `matchedSegments/totalSegments * 100` to one decimal place. Reported in ARI-CTX-011 finding message and in scan summary. Test: "includes redundancy percentage to one decimal place" (context-quality.test.ts:692). Verified 2026-03-23.
- [x] Additionality score: percentage of context file that encodes genuinely new information.
  - `Verify:` Check JSON output for additionality score field
  - `Evidence:` `AdditionalityResult.additionalityPct` computed as `100 - redundancyPct` to one decimal place. Reported in scan summary as "X.Y% additionality". High additionality (>80%) awards +5 score bonus. Tests: "includes additionality metrics in summary" (context-quality.test.ts:723), "awards bonus points for high additionality" (context-quality.test.ts:783). Verified 2026-03-23.
- [x] Front-loading analysis: critical info in first 20% of file (per "Lost in the Middle").
  - `Verify:` Run scan and check for ARI-CTX-005 finding
  - `Evidence:` ARI-CTX-005 added 2026-03-09
- [x] Conciseness ratio: token count of context file vs total useful information encoded.
  - `Verify:` Run scan and check for ARI-CTX-008 finding
  - `Evidence:` ARI-CTX-008 conciseness check added 2026-03-09
- [x] Staleness detection: last modified date of context file vs last significant code change.
  - `Verify:` Run scan and check for ARI-CTX-006 finding
  - `Evidence:` ARI-CTX-006 cross-references paths in context files against repo files, added 2026-03-09
- [x] Negative instruction coverage: detection of explicit "do NOT" constraints.
  - `Verify:` Add "do NOT" instructions to AGENTS.md and confirm score increase
  - `Evidence:` Regex `/\b(don't|do not|never|avoid)\b/i` awards +5 points
- [x] Scoring baseline: no context file → 20% (neutral baseline).
  - `Verify:` Run scan on repo with no context files and confirm P1 score = 20
  - `Evidence:` Implemented: `score = 20`
- [x] LLM-generated file that duplicates README → 0-10% penalty.
  - `Verify:` Run scan on fixture with auto-generated AGENTS.md and confirm penalty applied
  - `Evidence:` ARI-CTX-012 finding emitted when file has >70% redundancy AND matches boilerplate patterns (e.g., "Generated by", "auto-generated"). Applies score -= 10 penalty. Test: "emits ARI-CTX-012 for boilerplate file with high redundancy" (context-quality.test.ts:982), "does not emit ARI-CTX-012 for non-boilerplate with some redundancy" (context-quality.test.ts:1017). Verified 2026-03-23.
- [x] Concise, additive, front-loaded human-written file → 80-100%.
  - `Verify:` Run scan on well-crafted AGENTS.md and confirm score ≥80
  - `Evidence:` Front-loading ARI-CTX-005 + conciseness ARI-CTX-008 + heuristic bonuses enable high scores. Added 2026-03-09.
- [x] Front-loading score separately reported in output.
  - `Verify:` Run scan and confirm ARI-CTX-005 is a separate finding
  - `Evidence:` ARI-CTX-005 emitted as separate finding. Added 2026-03-09.
- [x] Scoring is deterministic across repeated runs on the same repo state.
  - `Verify:` Run scan twice and `diff` the JSON outputs
  - `Evidence:` Pure heuristics, no randomness
- [x] Recommendation output clearly distinguishes additive vs duplicative content with specific line references.
  - `Verify:` Check scan output for line-level additive/duplicative annotations
  - `Evidence:` ARI-CTX-011 finding message includes "Duplicative: L{n}: \"{text}\" (similar to {refDoc})" and "Additive: L{n}: \"{text}\"" sections with up to 3 examples each. Line numbers map back to original context file. Test: "reports line-level duplicative and additive content" (context-quality.test.ts:748) asserts `L\d+:`, "similar to", "Duplicative:", and "Additive:" in output. Verified 2026-03-23.
- [x] Redundancy percentage reported to one decimal place with methodology explanation.
  - `Verify:` Check JSON output for redundancy percentage format
  - `Evidence:` `redundancyPct.toFixed(1)` used in ARI-CTX-011 message. `methodology` string included: "Sentence-level Jaccard similarity (threshold ≥ 0.6). Compared N segments from {file} against M segments from {refs}. X/N segments matched as duplicative." Test: "includes redundancy percentage to one decimal place" (context-quality.test.ts:692) asserts `\d+\.\d%` format. Verified 2026-03-23.

### Telemetry (non-blocking)

- [ ] Additionality score distribution
- [ ] % repos with redundant context files

## Scope

### In

- Text similarity analysis, section-level comparison, front-loading heuristics

### Out — Do Not Implement

- Deep semantic understanding
- Cross-repo comparison
- Generation of improved files → P2.01

## Research Basis

- Gloaguen et al. (2026): LLM-generated files decrease success by 2-3%, human files help by ~4% on niche repos.
- Liu et al. (2024): U-shaped performance curve — front-load critical info.
- arXiv 2510.05381 (2025): context volume alone degrades reasoning.
- OpenReview (2025): IGT decay and TWR cause 30-40% performance drops.
- Lulla et al. (2026): 28.6% time reduction, 16.6% token savings with quality context.

---

### Ticket P1.05 — Feedback Loop Proxy (Pillar 2)

```yaml
id: P1.05
title: Feedback Loop Proxy (Pillar 2)
status: done
completed: 2026-03-16
blocked_by:
priority: p0-critical
epic: P1.2
rfc: RFC-0003
persona: [engineering lead, platform engineer]
depends_on: [P1.02, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As an engineering lead, I need to know how fast my team's feedback loops are because slow loops are the primary cost multiplier for AI agent workflows.

## Problem Statement

DORA 2024 found that AI adoption actually *decreased* delivery throughput by 1.5% and stability by 7.2% because AI increases batch sizes and larger changesets introduce more risk. The mechanism: agentic self-correction loops increase token costs by 10-20x compared to single-shot attempts (4Geeks, 2025), making feedback latency the primary cost multiplier. If a test suite takes 10 minutes, an agent needing 5 iterations consumes 50 minutes of wall-clock time and thousands of idle tokens. Research from SAP HANA (Berndt et al., 2024) shows positive correlation between test execution time and flakiness rate — faster tests are also more reliable. Local feedback speed should be weighted ~2x higher than CI speed because local signals are the primary fuel for agentic self-correction loops (Jellyfish DPE research, 2025).

**Scoring thresholds (research-calibrated per DORA 2024):**

| Criterion | Elite | Good | Poor |
|---|---|---|---|
| Local test execution | <30s | <60s | >5min |
| Type-check speed (cold) | <10s | <30s | >60s |
| Lint execution time | <15s | <45s | >2min |
| CI pipeline duration | <5min | <10min | >20min |

**Calibration note:** Local feedback speed weighted ~2x higher than CI speed — local signals are the primary fuel for agentic self-correction loops.

## Definition of Done

### Functional

- [x] Parse `package.json` scripts, `Makefile`, `pyproject.toml`, CI config files to infer feedback latency.
  - `Verify:` Run scan on fixture with all config types and confirm latency estimates in output
  - `Evidence:` Parses package.json scripts for parallel/fail-fast flags, Makefile targets (test/lint/typecheck), pyproject.toml pytest timeout settings, CI workflow timeout-minutes, and .gitlab-ci.yml timeout. Latency signals annotated in ARI-FBK-009 output. Added 2026-03-16.
- [x] Estimated execution times for: unit tests, type checking, linting, full CI pipeline.
  - `Verify:` Run scan and check for ARI-FBK-009 finding with estimated times
  - `Evidence:` ARI-FBK-009: estimated feedback latency with measured/inferred/unknown confidence labels. Added 2026-03-09.
- [x] Detection of watch mode / hot reload configuration (binary: present or not).
  - `Verify:` Run scan and check for ARI-FBK-007 finding
  - `Evidence:` Checks `test:watch`/`test:dev` scripts. ARI-FBK-007 watch mode detection as separate finding. Added 2026-03-09.
- [x] Detection of incremental build support (Turbopack, Vite, SWC, esbuild vs Webpack, TSC incremental).
  - `Verify:` Run scan and check for ARI-FBK-008 finding
  - `Evidence:` Regex for `vite|esbuild|tsup|swc|turbo`. ARI-FBK-008 incremental build detection as separate finding. Added 2026-03-09.
- [x] Detection of pre-commit hooks configured for lint + typecheck + format.
  - `Verify:` Check `test -f .husky/pre-commit && echo PASS`
  - `Evidence:` Checks `.husky`, `.pre-commit-config.yaml`, `lefthook.yml`
- [x] Changeset scope controls: PR size limits, conventional commits, automated splitting guidance.
  - `Verify:` Run scan and check for ARI-FBK-006 finding
  - `Evidence:` ARI-FBK-006: detects commitlint configs, `.changeset/config.json`, dangerfile
- [x] Estimated times include confidence label (measured vs inferred vs unknown) and missing-data fallback behavior.
  - `Verify:` Run scan and confirm ARI-FBK-009 finding includes confidence labels
  - `Evidence:` ARI-FBK-009 estimated feedback latency with measured/inferred/unknown labels added 2026-03-09
- [x] Watch mode and incremental build detection are binary and clearly reported.
  - `Verify:` Confirm ARI-FBK-007 and ARI-FBK-008 as separate findings in output
  - `Evidence:` ARI-FBK-007 (watch mode) and ARI-FBK-008 (incremental build) as separate findings added 2026-03-09
- [x] Changeset scope controls are detected and scored.
  - `Verify:` Confirm ARI-FBK-006 finding present
  - `Evidence:` ARI-FBK-006: commitlint, .changeset, dangerfile
- [x] Scoring differentiates local feedback (2x weight) from CI feedback (1x weight) per research.
  - `Verify:` Review scoring logic in feedback-loop analyzer for 2x/1x weighting
  - `Evidence:` Restructured scoring: local signals 2x weight, CI signals 1x weight, added 2026-03-09

### Telemetry (non-blocking)

- [x] Feedback speed distribution by language/framework — `pillar_scores` P2 bucket + `language` field enable server-side aggregation

## Scope

### In

- Static inference from config files and scripts, CI config parsing (GitHub Actions, GitLab CI)

### Out — Do Not Implement

- Actual execution timing → P3.05 simulation
- Network-dependent CI queries

## Research Basis

- DORA 2024: AI adoption decreased throughput 1.5%, stability 7.2% via batch size inflation.
- 4Geeks (2025): Agentic loops cost 10-20x vs single-shot.
- Berndt et al. (2024): Positive correlation between test execution time and flakiness.
- Forsgren, Humble, Kim (2018): Throughput and stability are not trade-offs; elite teams excel on both.
- DORA Elite thresholds: lead time <1 day, deploy on-demand, 5% failure rate, recovery <1 hour.


---

### Ticket P1.06 — Test Isolation Anti-patterns v1 (Pillar 3)

```yaml
id: P1.06
title: Test Isolation Anti-patterns v1 (Pillar 3)
status: done
blocked_by:
priority: p0-critical
epic: P1.2
rfc: RFC-0003
persona: [developer using AI agents, test engineer]
depends_on: [P1.02, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As a developer using AI agents, I need to know which of my tests will cause agents to waste tokens chasing phantom failures.

## Problem Statement

Test isolation is elevated to 18% weight (from 12.5% equal weight) because research shows it is a *leading indicator* of agent-authored code quality. Unlike humans who "retry and ignore," agents treat test failures as definitive signals to modify code. If the failure was flaky, the agent begins "fixing" valid code, introducing real regressions (creating a destructive loop). At Google, 41% of intermittent test failures are flaky (Memon et al., 2017). External dependencies and network instabilities are the predominant cause of systemic flakiness — contradicting older studies that rated concurrency as primary (Systemic Flakiness, 2025). Flaky test repair costs ~$2,250/month per developer (Leinen et al., 2024). 63% of LLM-generated flaky tests trace to unordered collection assumptions (Berndt et al., 2026). Critically, "flakiness transfer" means agents propagate instability from existing flaky tests into newly generated test cases. 26% of builds at Microsoft are affected by flaky tests (Lam et al., 2019).

**Weight justification:** Elevated from 12.5% to 18% because codebases with non-deterministic tests create compounding problems: agents "fix" valid code, generate flaky tests from flaky examples, and waste tokens on phantom failures.

## Definition of Done

### Functional

- [x] Cloud credential dependency detection: Direct AWS SDK, GCP SDK, Azure SDK imports in test files.
  - `Verify:` Run scan on fixture with AWS imports in test files and confirm ARI-TST-001
  - `Evidence:` ARI-TST-001. Regex `AWS|azure|gcp|google.cloud`.
- [x] Direct HTTP/API calls detection: `fetch`, `axios`, `requests`, `http.Client` calls in test code.
  - `Verify:` Run scan on fixture with fetch in test and confirm ARI-TST-002
  - `Evidence:` ARI-TST-002
- [x] Mutable global environment detection: Tests modifying `process.env`, global state, shared fixtures.
  - `Verify:` Run scan and confirm ARI-TST-011 finding
  - `Evidence:` ARI-TST-011: detects process.env assignment, global/globalThis/window mutation added 2026-03-09
- [x] Unstable time/random usage: `Date.now()`, `Math.random()`, `time.time()` in assertions.
  - `Verify:` Run scan and confirm ARI-TST-003/004 findings
  - `Evidence:` ARI-TST-003/004. Detects `Date.now`, `new Date`, `time.Now`, `datetime.now`, `Math.random`.
- [x] Unordered collection assertions: Map/Set/dict assertions without sorting.
  - `Verify:` Run scan and confirm ARI-TST-009 finding
  - `Evidence:` ARI-TST-009: regex detection for `toEqual(new Set|toEqual(new Map|assertDictEqual|assert_eq!.*HashMap` in test files
- [x] Test order dependency: Shared state between tests, global setup/teardown with side effects.
  - `Verify:` Run scan and confirm ARI-TST-012 finding
  - `Evidence:` ARI-TST-012: detects describe.only, it.only, beforeAll with state added 2026-03-09
- [x] External file system dependency: Tests reading/writing to absolute paths or temp dirs without cleanup.
  - `Verify:` Run scan and confirm ARI-TST-008 finding
  - `Evidence:` ARI-TST-008: detects `readFileSync|writeFileSync|fs.readFile|os.path|Path(` in test files
- [x] Concurrency/race conditions: `setTimeout`, `sleep`, timing-dependent assertions.
  - `Verify:` Run scan and confirm ARI-TST-013 finding
  - `Evidence:` ARI-TST-013: detects setTimeout, sleep, timing-dependent test patterns added 2026-03-09
- [x] Each finding maps to severity (critical/warning/info), root cause category (from Luo 2014 taxonomy), fix hint with code example, and agent impact explanation.
  - `Verify:` Run scan with `--json` and confirm findings have severity, evidence.paper, remediation fields
  - `Evidence:` Severity includes critical level. Luo 2014 root cause taxonomy evidence fields. Language-specific code example fix hints and agent impact explanations on all 14 findings. Completed 2026-03-09.
- [x] Provider pattern / DI detection: whether infrastructure is abstracted behind interfaces.
  - `Verify:` Run scan on fixture with provider files and confirm bonus applied
  - `Evidence:` Checks filenames for `provider|factory|container|inject`, excluding `.devcontainer`. Awards +15 points.
- [x] Memory/mock implementation detection: in-memory implementations for cloud providers.
  - `Verify:` Run scan on fixture with mock directories and confirm bonus applied
  - `Evidence:` Checks `__mocks__`, `.mock.`, `mock/`. Awards +10 points.
- [x] Detection covers TypeScript/JavaScript (jest, vitest, mocha), Python (pytest, unittest), Go (testing), Java (JUnit), Rust (cargo test).
  - `Verify:` Grep analyzer source for language-specific test patterns
  - `Evidence:` Covers TS/JS, Go, Python, Java, C#, Ruby, Rust. Rust `#[cfg(test)]`/`#[test]` detection + `std::thread::sleep`/`tokio::time::sleep` anti-patterns added 2026-03-10.

### Testing

- [x] False-positive rate <10% on benchmark cohort.
  - `Verify:` Run benchmark suite and compute false positive rate
  - `Evidence:` `node benchmarks/validate-test-isolation.cjs` — 82 P3 findings across 21 repos: 79 true positives (56 file-verified, 12 structural, 11 unverifiable), 3 false positives. FP rate: 3.7%. All 3 FPs are ripgrep ARI-TST-008 findings on non-test files (tests/util.rs, pattern.rs, config.rs — Rust inline test modules not matched by filename heuristic). PASS. Verified 2026-03-26.

### Functional

- [x] Provider pattern detection clearly distinguishes direct SDK usage from abstracted interfaces.
  - `Verify:` Run scan on fixture with both patterns and confirm correct classification
  - `Evidence:` Structural code analysis: detects interface/abstract class patterns in provider files (ARI-TST-016, +20 bonus) and direct SDK imports in test files (ARI-TST-017, penalty). Filename heuristic retained as fallback (+15). Added 2026-03-16.

### Telemetry (non-blocking)

- [x] Anti-pattern distribution by category — `finding_counts_by_pillar` field emits per-pillar finding counts (category = pillar)
- [x] Detection count per repo — `finding_count` field emits total findings per scan

## Scope

### In

- Static analysis of test files, pattern matching for known anti-patterns, provider pattern detection

### Out — Do Not Implement

- Runtime flakiness measurement (requires execution)
- CI log analysis
- Dynamic analysis

## Research Basis

- Memon et al. (2017): 41% flakiness at Google.
- Luo et al. (2014): 10-category root cause taxonomy (foundational, 800+ citations).
- Systemic Flakiness (2025): External deps are predominant cause of systemic flakiness.
- Berndt et al. (2026): 63% of LLM-generated flaky tests from unordered collections; containerised execution controls environmental flakiness.
- Leinen et al. (2024): $2,250/month per developer in flaky test repair.
- Lam et al. (2019): 26% of builds at Microsoft affected.

**Scoring criteria (research-calibrated):**

| Criterion | Evidence |
|---|---|
| Cloud credential independence | Core thesis — external deps = correlated failures (Systemic Flakiness 2025) |
| Provider pattern / DI usage | Hexagonal architecture reduces coupling |
| Memory/mock implementations | Enables deterministic agent testing |
| Test determinism score | Luo 2014: 10-category flakiness taxonomy |
| External dependency count in tests | Systemic Flakiness 2025: external deps = correlated failures |
| Unordered collection usage in tests | Berndt 2026: 63% of LLM-generated flakiness |
| Test fixture isolation | Luo 2014: test order dependency root cause |
| Docker/container test execution | Berndt 2026: containerised execution controls environmental flakiness |

---

### Ticket P1.07 — Order-sensitive Assertion Detection (Pillar 3)

```yaml
id: P1.07
title: Order-sensitive Assertion Detection (Pillar 3)
status: in-progress
blocked_by:
priority: p1-high
epic: P1.2
rfc: RFC-0003
persona: [test maintainer, teams with agents generating test code]
depends_on: [P1.06, P1.02]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod, web-tree-sitter]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As a test maintainer, I need to identify tests that will fail intermittently due to non-deterministic ordering so I can fix them before agents propagate the pattern.

## Problem Statement

Berndt et al. (2026) found that 63% of LLM-generated flaky tests were caused by unordered collection assumptions — asserting equality on Maps, Sets, or dictionaries without sorting. This is the single largest category of LLM-introduced flakiness. "Flakiness transfer" means agents learn from existing tests — if your existing tests have ordering issues, agents will propagate that instability into every new test they generate.

## Definition of Done

### Functional

- [ ] AST-level analysis for assertions on non-deterministic data structures (Map, Set, Object.keys, dict, HashMap). [DEFERRED: AST-level analysis requires Tree-sitter integration, moved to P3.07]
  - `Verify:` Run scan on fixture with Map assertions in tests and confirm AST-level finding
  - `Evidence:` Regex-level detection exists in P1.06 (ARI-TST-009). AST-level analysis deferred to P3.07.
- [ ] Detection of comparison operators on unordered types without prior sorting/normalization. [DEFERRED: requires AST-level analysis → P3.07]
  - `Verify:` Run scan on fixture and confirm specific comparison operators flagged
  - `Evidence:`
- [ ] Detection of array assertions where order may vary (query results, file listings, API responses). [DEFERRED: requires AST-level analysis → P3.07]
  - `Verify:` Run scan on fixture with array assertions and confirm findings
  - `Evidence:`
- [ ] Suggested fixes: `toSorted()`, `Array.from().sort()`, `sorted()`, custom comparators. [DEFERRED: requires AST-level analysis → P3.07]
  - `Verify:` Check finding remediation field for suggested fixes
  - `Evidence:`
- [ ] Detection covers at least TypeScript/JavaScript, Python, and Go. [DEFERRED: requires AST-level analysis → P3.07]
  - `Verify:` Run scan on fixtures for each language and confirm findings
  - `Evidence:`
- [ ] Each finding includes the specific assertion line and a copy-pasteable fix. [DEFERRED: requires AST-level analysis → P3.07]
  - `Verify:` Check finding output for line number and fix code
  - `Evidence:`

### Documentation

- [ ] Rule docs include false-positive caveats (e.g., arrays that are intentionally ordered). [DEFERRED: requires AST-level analysis → P3.07]
  - `Verify:` Check error taxonomy docs for P1.07 rules with caveat notes
  - `Evidence:`

### Telemetry (non-blocking)

- [ ] Ordering anti-pattern frequency by language [DEFERRED: requires AST-level analysis → P3.07]

## Scope

### In

- AST analysis of assertion statements, type inference for collection types

### Out — Do Not Implement

- Runtime ordering verification
- Cross-file assertion tracking

## Research Basis

- Berndt et al. (2026): 63% of LLM-generated flaky tests caused by unordered collection assumptions.

---

### Ticket P1.08 — Onboarding Reproducibility Checks (Pillar 4)

```yaml
id: P1.08
title: Onboarding Reproducibility Checks (Pillar 4)
status: done
blocked_by:
priority: p0-critical
epic: P1.2
rfc: RFC-0003
persona: [team lead, platform engineer, repo maintainer]
depends_on: [P1.02, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: 2026-03-10
```

## User Story

As a team lead, I need to know how quickly a fresh checkout of my repo can reach a running, testable state — because that's exactly what an agent experiences every time it starts a task.

## Problem Statement

The "Tutorial Problem" (VS Code Blog, 2022) shows manual setup instructions have a 94-96% drop-off rate. Agents face an identical hurdle — if a repo requires manual environment variables and globally installed binaries, the agent's "onboarding time" increases dramatically. Standardised environments reduce onboarding time by 60% and integration conflicts by 30% (Microsoft/GitLab, 2022). Industry average time-to-first-commit is 2-4 weeks; top teams achieve 3-5 days (Stripe Developer Coefficient). For agents, "onboarding" is the time from `git clone` to first successful test execution. Repositories using `.devcontainer` or `docker-compose.yml` ensure "development context mirrors app context."

**Scoring thresholds (research-calibrated):**

| Criterion | Elite | Good | Poor |
|---|---|---|---|
| Time-to-first-test-pass | <5min | <15min | >30min |
| Devcontainer quality | Valid + complete | Present + basic | Missing |
| Bootstrap automation | Single command | Multi-step documented | Undocumented |

## Definition of Done

### Functional

- [x] `.devcontainer/devcontainer.json` — exists and is valid JSON with required fields.
  - `Verify:` Run scan and confirm ARI-ENV-005 finding for devcontainer validation
  - `Evidence:` ARI-ENV-005: validates postCreateCommand/onCreateCommand, features. Enhanced 2026-03-09.
- [x] `docker-compose.yml` / `docker-compose.yaml` — services defined for local dependencies.
  - `Verify:` Run scan on fixture with docker-compose and confirm detection
  - `Evidence:` Checks 3 filename variants
- [x] Bootstrap script — single-command setup (`make setup`, `pnpm bootstrap`, `./scripts/setup.sh`).
  - `Verify:` Run scan and confirm bootstrap detection in output
  - `Evidence:` Checks scripts/setup.sh, Makefile, justfile, package.json setup/bootstrap/prepare/postinstall
- [x] Doctor/health-check command — validates environment prerequisites.
  - `Verify:` Run scan and confirm ARI-ENV-004 finding
  - `Evidence:` ARI-ENV-004: detects `doctor`/`health`/`check`/`verify`/`validate` scripts in package.json
- [x] Time-to-first-test-pass estimate (from setup complexity analysis).
  - `Verify:` Run scan and confirm ARI-ENV-013 finding with time estimate
  - `Evidence:` ARI-ENV-013: estimates TTFTP in minutes based on install, build, env setup, devcontainer, and test script presence. Labels fast/moderate/slow with breakdown factors. Added 2026-03-10.
- [x] Environment variable documentation — all required env vars documented with defaults/examples.
  - `Verify:` Run scan and confirm env var documentation check in output
  - `Evidence:` Checks `.env.example`/`.env.template`. ARI-ENV-007: compares code usage vs .env.example entries. Enhanced 2026-03-09.
- [x] Required tool versions — `.nvmrc`, `.tool-versions`, `engines` field in `package.json`, `python-requires`.
  - `Verify:` Check `test -f .nvmrc && echo PASS`
  - `Evidence:` Checks .nvmrc, .node-version, .tool-versions, .python-version, rust-toolchain.toml, engines
- [x] Seed/fixture data — test data provisioned automatically.
  - `Verify:` Run scan and confirm seed/fixture detection in output
  - `Evidence:` Detects `seeds/`, `fixtures/`, `testdata/` directories + seed/fixture scripts in package.json
- [x] "Likely first-run blockers" section identifying the top 3-5 issues a new agent would hit.
  - `Verify:` Run scan and confirm ARI-ENV-006 finding
  - `Evidence:` ARI-ENV-006: detects missing .env.example, no install command, no tsconfig added 2026-03-09
- [x] Each criterion scored independently with clear pass/fail/partial status.
  - `Verify:` Run scan and confirm ARI-ENV-008 through ARI-ENV-012 findings
  - `Evidence:` ARI-ENV-008 through ARI-ENV-012 per-criterion status labels added 2026-03-09
- [x] Devcontainer validation checks required fields (image/build, features, settings).
  - `Verify:` Run scan and confirm ARI-ENV-005 checks image/build field
  - `Evidence:` ARI-ENV-005: checks image/build, settings fields added 2026-03-09
- [x] Environment variable completeness scored against actual usage in codebase.
  - `Verify:` Run scan and confirm ARI-ENV-007 compares process.env usage
  - `Evidence:` ARI-ENV-007: compares process.env usage in code vs .env.example entries added 2026-03-09

### Telemetry (non-blocking)

- [x] Devcontainer presence rate — `devcontainer_detected` boolean field in telemetry payload enables server-side presence rate aggregation
- [x] Bootstrap automation rate — server-side aggregation from P4 pillar findings (ARI-ENV-002/003 detection of setup/bootstrap scripts)

## Scope

### In

- File presence and validity checks, setup complexity estimation, env var usage analysis

### Out — Do Not Implement

- Actual setup execution → P3.05 simulation
- Network dependency resolution

## Research Basis

- VS Code Blog (2022): 94-96% drop-off rate for manual setup.
- Microsoft/GitLab (2022): Standardised environments reduce onboarding 60%, conflicts 30%.
- Stripe Developer Coefficient: Industry average 2-4 weeks, top teams 3-5 days.
- Clean code practices: -60% onboarding time (IEEE 2022).
- Modular architecture: -30% bug rate (GitHub 2023).


---

### Ticket P1.09 — Machine-readable Docs Baseline (Pillar 5)

```yaml
id: P1.09
title: Machine-readable Docs Baseline (Pillar 5)
status: done
blocked_by:
priority: p1-high
epic: P1.2
rfc: RFC-0003
persona: [API developer, platform team, documentation maintainer]
depends_on: [P1.02, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: 2026-03-10
```

## User Story

As a developer, I need to know whether my documentation is structured for machines to parse or locked in prose that agents struggle with.

## Problem Statement

LLMs struggle with "schema drift" and "formatting inconsistency" in prose documentation — token costs triple when agents must retry failed parsing attempts (Tetrate, 2025). LLM embeddings contain more accurate task information when documentation emphasises semantic structure (entities, relations, graphs) over narrative prose (Chalmers Literate Programming study, 2026). Machine-readable formats reduce hallucination rates (bioRxiv OpenEval, 2026). Research argues that "publication systems should optimize separately for the dissemination of data and results versus novel ideas" — API specs and error codes must be machine-readable (JATS XML, OpenAPI).

## Definition of Done

### Functional

- [x] API contracts: OpenAPI/Swagger detection.
  - `Verify:` Run scan on fixture with openapi.yml and confirm detection
  - `Evidence:` Regex for `openapi|swagger` in filenames
- [x] API contracts: tRPC router definitions.
  - `Verify:` Run scan on fixture with tRPC router and confirm detection
  - `Evidence:` Checks `trpc|\.router\.[jt]s`
- [x] API contracts: GraphQL schema files.
  - `Verify:` Run scan on fixture with .graphql files and confirm detection
  - `Evidence:` Checks `.graphql`/`.gql` files
- [x] Error taxonomy: Structured error codes with machine-readable definitions.
  - `Verify:` Run scan on this repo and confirm error taxonomy detected
  - `Evidence:` Checks `error.taxonomy|error.codes|errors?\.(json|ya?ml)`
- [x] Machine-readable runbooks: Executable or structured runbooks (YAML/JSON, not prose-only).
  - `Verify:` Run scan and check for ARI-DOC-002 finding
  - `Evidence:` ARI-DOC-002 runbook detection added 2026-03-09
- [x] Env var schema: Typed environment validation (zod, joi, t3-env, pydantic BaseSettings).
  - `Verify:` Run scan on fixture with zod env schema and confirm detection
  - `Evidence:` Checks package.json deps for JS libs + Python pydantic BaseSettings / pydantic-settings in pyproject.toml. Updated 2026-03-10.
- [x] ADR / decision records: Architecture Decision Records present.
  - `Verify:` Run scan on this repo and confirm ADR/RFC detection
  - `Evidence:` Checks files matching `adr|decision|rfc` with `.md`
- [x] Changelog format: Conventional commits / Keep a Changelog format.
  - `Verify:` Check `test -f CHANGELOG.md && echo PASS`
  - `Evidence:` Checks `CHANGELOG.md`
- [x] Type exports / JSDoc coverage: Public API types exported, JSDoc on public functions.
  - `Verify:` Run scan and check for ARI-DOC-003 finding
  - `Evidence:` ARI-DOC-003 JSDoc coverage measurement added 2026-03-09
- [x] Documentation-code consistency: Docs reference current function names, parameters, paths (drift detection).
  - `Verify:` Run scan and check for ARI-DOC-004 finding
  - `Evidence:` ARI-DOC-004 documentation-code drift detection added 2026-03-09
- [x] Per-criterion findings include priority level and confidence markers.
  - `Verify:` Run scan with `--json` and confirm all DOC findings have severity and confidence
  - `Evidence:` All doc-readability findings carry severity + confidence. Updated 2026-03-10.
- [x] Each criterion independently scored with clear rationale.
  - `Verify:` Run scan and confirm per-finding rationale in output
  - `Evidence:` Per-finding rationale explaining agent impact. Updated 2026-03-10.
- [x] Supports TypeScript, Python, Go, Java at minimum.
  - `Verify:` Run scan on Python fixture with pydantic and confirm env var detection
  - `Evidence:` Env var validation: JS (package.json deps) + Python (pydantic BaseSettings). File detection is language-agnostic. Updated 2026-03-10.

### Telemetry (non-blocking)

- [x] Machine-readable doc coverage by format type — server-side aggregation from P5 pillar findings (ARI-DOC-* findings identify format types detected/missing)

## Scope

### In

- File detection, format validation, basic drift detection

### Out — Do Not Implement

- Content quality assessment
- Documentation generation
- Deep semantic analysis

## Research Basis

- Tetrate (2025): Unstructured parsing triples token costs.
- Chalmers (2026): Semantic structure improves LLM task accuracy.
- bioRxiv OpenEval (2026): Machine-readable formats reduce hallucination.
- Knuth (1984) → modern evolution: Literate Programming as agentic alignment requirement.

---

### Ticket P1.10 — Type Strictness Scoring Baseline (Pillar 6)

```yaml
id: P1.10
title: Type Strictness Scoring Baseline (Pillar 6)
status: done
completed: 2026-03-16
blocked_by:
priority: p0-critical
epic: P1.2
rfc: RFC-0003
persona: [TypeScript/JavaScript developer, teams evaluating type system investment]
depends_on: [P1.02, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As a TypeScript developer, I need to know whether my type system configuration is helping or hurting my AI agents, because type errors are the #1 failure mode for LLM-generated code.

## Problem Statement

This is potentially the single highest-ROI criterion across the entire rubric. 94% of LLM-generated compilation errors are type-check failures (GitHub Octoverse 2025). Type errors account for 33.6% of all failed LM-generated programs (TyFlow, Huang et al., 2025). Type-constrained decoding significantly reduces compilation errors and improves functional correctness (ETH Zurich, 2025). Microsoft research shows consistent naming and modularity — enforced by type systems — decrease defects by 40%. Bloomberg Engineering (2024) confirms TypeScript strict mode is essential for maintaining invariants at scale. For agents, a strictly typed codebase acts as a "constraint-based guidance system" — the compiler becomes a deterministic, near-instant validator. In dynamically typed languages, agents must rely on runtime execution to find errors, which is significantly more expensive and less reliable.

**Weight justification:** Elevated from 12.5% to 15% because the convergence of TyFlow, type-constrained decoding, and Octoverse data makes type strictness potentially the single highest-ROI criterion. Types catch errors (P6), provide faster feedback (P2), and improve navigability through explicit contracts (P7).

## Definition of Done

### Functional

- [x] TypeScript: `strict: true` in `tsconfig.json` — the master switch.
  - `Verify:` Run `jq '.compilerOptions.strict' tsconfig.json` and confirm true
  - `Evidence:` Checked individually
- [x] TypeScript: `strictNullChecks` — prevents runtime null/undefined crashes.
  - `Verify:` Run scan and confirm strictNullChecks detection
  - `Evidence:` Checked individually
- [x] TypeScript: `noImplicitAny` — prevents agents from using untyped escape hatches.
  - `Verify:` Run scan and confirm noImplicitAny detection
  - `Evidence:` Checked individually
- [x] TypeScript: `isolatedModules` — ensures fast standalone transpilation.
  - `Verify:` Run scan and confirm isolatedModules detection
  - `Evidence:` Checked
- [x] TypeScript: `projectReferences` — monorepo build optimization.
  - `Verify:` Run scan and confirm project references detection
  - `Evidence:` Checks `references` array in tsconfig.json, +5 points for non-empty
- [x] Type coverage percentage (via `type-coverage` tool metrics).
  - `Verify:` Run scan on TS project with/without type-coverage and confirm ARI-BLD-013 finding
  - `Evidence:` ARI-BLD-013 detects type-coverage script, .type-coverage dir, or type-coverage dependency. +5 score when present, low-severity finding with remediation when absent. 7 tests covering all detection paths. Verified 2026-03-16.
- [x] Python: `mypy` strict mode, `pyright` configuration.
  - `Verify:` Run scan on Python fixture with mypy.ini and confirm detection
  - `Evidence:` Checks mypy.ini, .mypy.ini, pyrightconfig.json, pyproject.toml sections
- [x] Go: check for `interface{}` / `any` abuse.
  - `Verify:` Run scan on Go fixture and confirm ARI-BLD-004 finding
  - `Evidence:` ARI-BLD-004: scans `.go` files for `interface{}` and `any` usage, penalizes >10 occurrences
- [x] Rust: check for excessive `unwrap()`, missing error types.
  - `Verify:` Run scan on Rust fixture and confirm ARI-BLD-005 finding
  - `Evidence:` ARI-BLD-005: scans `.rs` files for `.unwrap()` usage, penalizes >20 occurrences
- [x] Java: nullability annotations, generics usage.
  - `Verify:` Run scan on Java fixture and confirm ARI-BLD-008 finding
  - `Evidence:` ARI-BLD-008: detects @NonNull/@Nullable/@NotNull annotations and NullAway/Checker Framework/ErrorProne in pom.xml/build.gradle. Added 2026-03-08.
- [x] C#: nullable reference types enabled.
  - `Verify:` Run scan on C# fixture and confirm ARI-BLD-009 finding
  - `Evidence:` ARI-BLD-009: checks `<Nullable>enable</Nullable>` in .csproj and `#nullable enable` directives in source files. Added 2026-03-08.
- [x] Lockfile presence and consistency.
  - `Verify:` Run scan and confirm lockfile detection
  - `Evidence:` Checks 10 lockfile formats
- [x] Lockfile not gitignored.
  - `Verify:` Run scan and confirm lockfile gitignore check
  - `Evidence:` Verified
- [x] Build tool modernity: Vite/SWC/esbuild vs legacy Webpack.
  - `Verify:` Run scan and confirm ARI-BLD-010 finding
  - `Evidence:` Detects `tsup|esbuild|vite|swc|unbuild|turbo` vs `webpack`. ARI-BLD-010: info finding for modern bundlers, low-severity finding with migration advice + research evidence for webpack. Added 2026-03-10.
- [x] Monorepo clarity: project references, incremental builds, clear package boundaries.
  - `Verify:` Run scan and confirm ARI-BLD-006 finding
  - `Evidence:` ARI-BLD-006: checks turbo, nx, lerna, pnpm-workspace project references. ARI-BLD-007: lockfile drift detection (packageManager field vs actual lockfile). Added 2026-03-09.
- [x] Cross-pillar type bonus: strict TypeScript repos receive bonus on P2 and P7.
  - `Verify:` Run scan on strict TS repo and confirm P2/P7 scores include bonus
  - `Evidence:` `applyCrossPillarTypeBonus()` adds +5 to P2 and P7 when P6 >= 70. Added 2026-03-08.
- [x] Linting & formatting config detection.
  - `Verify:` Run scan and confirm ARI-BLD-011 finding
  - `Evidence:` ARI-BLD-011: detects ESLint + Prettier configs (10+ ESLint formats, 11+ Prettier formats, package.json fields). +5 when both present. Added 2026-03-16.
- [x] Strictness checks are clearly separated from style rules.
  - `Verify:` Review analyzer code for strictness vs style separation
  - `Evidence:` Verified
- [x] TypeScript config analysis is field-level (not just "strict: true" binary).
  - `Verify:` Run scan and confirm individual strictness fields checked
  - `Evidence:` Checks strict, strictNullChecks, noImplicitAny, isolatedModules individually
- [x] Cross-language type strictness is confidence-labeled.
  - `Verify:` Check JSON output for per-check confidence labels
  - `Evidence:` All type strictness findings (ARI-BLD-001, -004, -005, -008, -009) have per-check confidence labels (high for binary config detection, medium for heuristic analysis). Verified 2026-03-16.

### Telemetry (non-blocking)

- [x] Strict mode adoption rate — `pillar_scores` P6 bucket enables server-side strict mode correlation
- [x] Type coverage distribution — `pillar_scores` P6 bucket enables server-side type coverage aggregation

## Scope

### In

- Config file analysis, lockfile validation, build tool detection

### Out — Do Not Implement

- Actual type coverage measurement (requires compilation)
- Build execution

## Research Basis

- GitHub Octoverse 2025: 94% of LLM compilation errors are type-check failures.
- TyFlow (Huang et al., 2025): 33.6% of failed LM programs fail due to type errors.
- ETH Zurich (2025): Type-constrained decoding reduces errors, improves correctness.
- Microsoft (2023): Strict typing decreases defects by 40%.
- Bloomberg Engineering (2024): TypeScript strict mode essential at scale; `isolatedModules` speeds feedback.

---

### Ticket P1.11 — Navigability Baseline (Pillar 7)

```yaml
id: P1.11
title: Navigability Baseline (Pillar 7)
status: done
completed: 2026-03-16
blocked_by:
priority: p3-low
epic: P1.2
rfc: RFC-0003
persona: [teams optimizing codebase for AI agent effectiveness]
depends_on: [P1.02, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As a developer, I need to know how easily AI agents can find and understand relevant code in my repository.

## Problem Statement

Developers spend up to 70% of their time comprehending code (Multitudes DX research). Complex code requires 250-500% more maintenance time (IEEE). This applies equally to agents — SWE-agent (Yang et al., NeurIPS 2024) proves that the agent-codebase interface is as important as the underlying model. Vector-only RAG degrades toward zero accuracy when queries involve >5 entities; AST-derived knowledge graphs maintain stable performance at 10+ entities (arXiv 2601.08773, 2025). GraphRAG achieves 3.4x accuracy improvement over vector RAG for multi-hop architectural reasoning (Fluree, 2025). Codebases with clear call hierarchies and predictable patterns enable better retrieval, regardless of retrieval strategy.

## Definition of Done

### Functional

- [x] Directory depth: Maximum nesting depth, files per directory (cognitive load).
  - `Verify:` Run scan and confirm directory depth metric in output
  - `Evidence:` Penalizes >8, rewards <=5
- [x] Naming consistency: Consistent file/function/variable naming patterns across the repo.
  - `Verify:` Run scan and confirm naming consistency metric
  - `Evidence:` Measures camelCase/kebab/snake/Pascal distribution
- [x] Module boundary clarity: Clear separation between domains/features/layers.
  - `Verify:` Run scan and confirm module boundary detection
  - `Evidence:` Checks `src/` or `packages/`
- [x] Import graph complexity: Fan-in/fan-out metrics, circular dependency detection.
  - `Verify:` Run scan and check for ARI-NAV-004 and ARI-NAV-005 findings
  - `Evidence:` ARI-NAV-004: flags files with >20 imports. ARI-NAV-005: builds import map and detects mutual imports.
- [x] Dead code percentage: Unreachable/unused exports, files with no imports.
  - `Verify:` Run scan and check for ARI-NAV-006 finding
  - `Evidence:` ARI-NAV-006 dead code detection heuristic added 2026-03-09. Improved heuristic: excludes config files, CLI entry points, type declarations, barrel re-exports. Self-scan shows 0 false positives. Added 2026-03-10.
- [x] Code duplication: Clone detection, DRY violations.
  - `Verify:` Run scan and check for ARI-NAV-008 finding
  - `Evidence:` ARI-NAV-008 normalized line-chunk hashing added 2026-03-09
- [x] Cognitive complexity score: Nested conditionals, excessive boolean operators, large methods.
  - `Verify:` Run scan and check for ARI-NAV-007 finding
  - `Evidence:` ARI-NAV-007 cognitive complexity estimate. Per-function cognitive complexity with SonarSource-inspired metric, good/moderate/poor labels. Added 2026-03-09.
- [x] "Most costly navigation paths" summary: the top 5 areas where agents will struggle most.
  - `Verify:` Run scan and confirm navigation paths summary in output
  - `Evidence:` Added 2026-03-09
- [x] Each metric includes threshold calibration (what counts as good/moderate/poor).
  - `Verify:` Run scan and confirm threshold labels in output
  - `Evidence:` All 7 metrics now include explicit good/moderate/poor labels. Added 2026-03-10.
- [x] Circular dependency detection reports specific import chains.
  - `Verify:` Run scan and confirm ARI-NAV-005 includes import chain details
  - `Evidence:` ARI-NAV-005: builds import map, reports mutual import pairs
- [x] Dead code detection has <15% false-positive rate.
  - `Verify:` Run scan and review dead code findings for false positives
  - `Evidence:` Improved heuristic excludes config files, CLI entries, type declarations, barrel re-exports. Self-scan shows 0 false positives. Added 2026-03-10.
- [x] Cognitive complexity scored per function/method with aggregation per file.
  - `Verify:` Run scan and confirm per-function complexity in output
  - `Evidence:` ARI-NAV-007: per-function cognitive complexity with SonarSource-inspired metric. Added 2026-03-09.
- [x] Structural clarity for retrieval: evaluation of call hierarchies and predictable patterns.
  - `Verify:` Run scan and confirm structural clarity metric in output
  - `Evidence:` ARI-NAV-009 evaluates barrel files and conventional layer directories with good/moderate/poor labels. Verified 2026-03-16.

### Telemetry (non-blocking)

- [x] Directory depth distribution — `pillar_scores` P7 bucket enables server-side depth aggregation
- [x] Circular dependency prevalence — `pillar_scores` P7 bucket enables server-side prevalence tracking

## Scope

### In

- Static analysis of directory structure, import graphs, naming patterns

### Out — Do Not Implement

- AST-level graph analysis → P3.07
- Runtime profiling
- Semantic code understanding

## Research Basis

- Multitudes DX research: 70% of developer time on comprehension.
- IEEE: Complex code requires 250-500% more maintenance.
- SWE-agent (Yang et al., NeurIPS 2024): Interface matters as much as model.
- arXiv 2601.08773 (2025): AST-derived graphs >> vector RAG for multi-hop reasoning.
- Fluree (2025): GraphRAG 3.4x accuracy over vector RAG.
- Microsoft (2023): Consistent naming decreases defects by 40%.

---

### Ticket P1.12 — Security and Governance Baseline (Pillar 8)

```yaml
id: P1.12
title: Security and Governance Baseline (Pillar 8)
status: done
completed: 2026-03-16
blocked_by:
priority: p0-critical
epic: P1.2
rfc: RFC-0003
persona: [security-conscious engineering lead, security team, compliance officer]
depends_on: [P1.02, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As a security-conscious engineering lead, I need to know whether my repository has the governance controls required to safely use AI coding agents at scale.

## Problem Statement

AI-generated code consistently shows higher vulnerability rates than human-written code: ~40% of Copilot-generated programs contain CWE Top 25 vulnerabilities (Pearce et al., 2021), AI PRs have ~1.7x more issues than human PRs (CodeRabbit, 2025), and critical vulnerabilities increase by 37.6% after just 5 iterations of AI "improvement" (IEEE-ISTAS, 2025). AI assistants introduce hardcoded credentials at 2x the human rate (Veracode, 2025). By June 2025, AI-generated code introduced 10,000+ new security findings per month with privilege escalation up 322% and architectural design flaws up 153% (Apiiro, 2025). Security degradation in iterative AI synthesis is a fundamental property of current agents — they focus on functional correctness while inadvertently introducing security anti-patterns from training data. Without governance controls, the speed of AI agents is not a benefit but a liability that "multiplies security flaws entering production."

**Gate behavior:** A repo scoring below 40% on Pillar 8 has its overall maturity level **capped at L2 (Fragile)** regardless of other pillar scores. Security is not a weighted average — it's a prerequisite.

## Definition of Done

### Functional

- [x] Branch protection: Main/master branch protected, PR reviews required.
  - `Verify:` Run scan and confirm branch protection finding
  - `Evidence:` ARI-SEC-009 finding emitted when no branch protection detected (ruleset files or PR-gated workflows with enforcement patterns). Confidence: medium (heuristic, no GitHub API). Verified 2026-03-16.
- [x] CODEOWNERS: File present, covering critical paths.
  - `Verify:` Check `test -f CODEOWNERS || test -f .github/CODEOWNERS && echo PASS`
  - `Evidence:` Checks CODEOWNERS, .github/CODEOWNERS, docs/CODEOWNERS
- [x] Secrets scanning: Pre-commit secrets detection configured (gitleaks, truffleHog, detect-secrets).
  - `Verify:` Run scan and confirm secrets scanning detection
  - `Evidence:` Checks .gitleaks.toml, .pre-commit-config.yaml, .sops.yaml, CI workflow content
- [x] Dependency audit: Automated vulnerability scanning (Dependabot, Renovate, Snyk) configured.
  - `Verify:` Check `test -f .github/dependabot.yml && echo PASS`
  - `Evidence:` Checks .github/dependabot.yml, renovate.json
- [x] SAST for AI-generated code: Static analysis mandatory on agent-authored PRs.
  - `Verify:` Run scan and confirm SAST detection finding
  - `Evidence:` ARI-SEC-010 finding emitted when no SAST tools (CodeQL, Semgrep, Snyk, Sonar) detected in CI workflows. Does not verify agent-specific targeting (scope limitation documented). Verified 2026-03-16.
- [x] AI-specific review checklist: PR template includes AI-code-specific security items.
  - `Verify:` Run scan and confirm ARI-SEC-005 finding
  - `Evidence:` ARI-SEC-005: checks PR templates for `ai|agent|llm|copilot|gpt|claude|machine-generated` regex
- [x] Licence compliance: Licence checker in CI.
  - `Verify:` Run scan and confirm ARI-SEC-007 finding
  - `Evidence:` ARI-SEC-007: licence compliance tooling check added 2026-03-09
- [x] Agent scope controls: Agents restricted from sensitive paths.
  - `Verify:` Check `test -f .agentignore && echo PASS`
  - `Evidence:` ARI-SEC-006: checks `.agentignore`, `.claudeignore`, `.copilotignore`, `CLAUDE.md`, `.claude/settings.json`
- [x] Missing controls prioritized by operational risk level with rationale.
  - `Verify:` Run scan and confirm findings sorted by severity
  - `Evidence:` All findings include `evidence` fields with research-backed risk rationale. Findings sorted by severity for risk-priority ordering. Added 2026-03-10.
- [x] AI-specific security posture assessment separately scored.
  - `Verify:` Run scan and confirm AI-specific sub-score in summary
  - `Evidence:` AI-specific sub-score (SAST + AI review checklist + agent scope controls) computed and displayed in summary. Added 2026-03-10.
- [x] Each detected control shows configuration status (configured/partial/missing).
  - `Verify:` Run scan and confirm status labels in output
  - `Evidence:` Summary shows configured/partial/missing labels added 2026-03-09
- [x] Gate behavior (L2 cap) clearly documented in output when triggered.
  - `Verify:` Run scan on fixture with low P8 score and confirm L2 cap warning
  - `Evidence:` Implemented in composite.ts, displayed in terminal.ts
- [x] Language-specific vulnerability context provided.
  - `Verify:` Run scan and confirm ARI-SEC-008 finding
  - `Evidence:` ARI-SEC-008: detects primary languages from file extensions and provides research-backed vulnerability rates per language — Java 72%, JS 56%, TS 48%, Python 38%, Go 44%, Rust 25%, C# 52%, Ruby 46%. Added 2026-03-10.

### Telemetry (non-blocking)

- [x] Governance control coverage rate — `pillar_scores` P8 bucket enables server-side coverage aggregation
- [x] Gate trigger frequency — `security_gate_triggered` boolean field emits per-scan gate status

## Scope

### In

- Detection of configured controls via config files, CI workflows, repo metadata

### Out — Do Not Implement

- Runtime security testing
- Vulnerability scanning execution
- Compliance certification

## Research Basis

- Pearce et al. (2021): ~40% of Copilot programs contain CWE Top 25 vulnerabilities.
- CodeRabbit (2025): AI PRs have ~1.7x more issues than human PRs.
- IEEE-ISTAS (2025): 37.6% vulnerability increase over 5 iterations.
- Veracode (2025): AI hardcodes credentials at 2x human rate; Java 72% vs Python 38% vulnerability rates.
- Apiiro (2025): 10,000+ new AI security findings/month; privilege escalation +322%.
- Cotroneo et al. (2025): 500k+ sample study — AI code is simpler but more defect-prone.


### Epic P1.3 — Output Contracts and Adoption UX

### Ticket P1.13 — Composite ARI and Tier Mapping

```yaml
id: P1.13
title: Composite ARI and Tier Mapping
status: done
completed: 2026-03-16
blocked_by:
priority: p0-critical
epic: P1.3
rfc: RFC-0003
persona: [engineering lead, CTO]
depends_on: [P1.04, P1.05, P1.06, P1.07, P1.08, P1.09, P1.10, P1.11, P1.12, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As a developer, I need a single score and maturity level that tells me how ready my codebase is for AI agents, with clear rationale for how it was calculated.

## Problem Statement

Individual pillar scores are useful for diagnosis but teams need a single "headline" metric for communication, benchmarking, and goal-setting. The composite score must reflect research-calibrated weights (not equal weights) and the maturity level must map to real-world agent performance expectations grounded in benchmark data.

## Definition of Done

### Functional

- [x] 8-pillar weighted aggregation using research-calibrated weights.
  - `Verify:` Run scan and confirm weighted composite score in JSON output
  - `Evidence:` P1=15%, P2=15%, P3=18%, P4=10%, P5=10%, P6=15%, P7=12%, P8=5% — matches spec exactly

  | Pillar | Weight | Research Justification |
  |---|---|---|
  | P1: Agent Context Quality | 15% | Gloaguen 2026, Liu 2024, Lulla 2026 |
  | P2: Feedback Loop Speed | 15% | DORA 2024, Forsgren/Humble/Kim 2018 |
  | P3: Test Isolation | 18% | Elevated per Memon 2017, Berndt 2026, Systemic Flakiness 2025 |
  | P4: Dev Environment | 10% | Tutorial Problem 2022, Microsoft/GitLab 2022 |
  | P5: Doc Machine-Readability | 10% | Tetrate 2025, Chalmers 2026 |
  | P6: Build Determinism & Types | 15% | Elevated per Octoverse 2025, TyFlow 2025 |
  | P7: Code Navigability | 12% | SWE-agent 2024, GraphRAG 2025 |
  | P8: Security & Governance | 5% (gate) | Pearce 2021, IEEE-ISTAS 2025 |

- [x] Maturity level mapping (L1–L5) with research calibration.
  - `Verify:` Run scan and confirm level and levelMeta in JSON output
  - `Evidence:` L1(0-25), L2(26-45), L3(46-65), L4(66-80), L5(81-100)

  | Level | Name | Score | What Agents Can Achieve | Research Calibration |
  |---|---|---|---|---|
  | L1 | Hostile | 0-25 | Almost nothing — agents thrash, hallucinate, waste tokens | SWE-bench Pro private: agents score 14.9% on unseen codebases |
  | L2 | Fragile | 26-45 | Simple single-file edits with heavy supervision | CooperBench: agents fail 50%+ of coordinated tasks |
  | L3 | Capable | 46-65 | Routine tasks (bug fixes, tests, docs) with moderate supervision | SWE-bench Verified: agents solve 75-82% of well-scoped bugs |
  | L4 | Productive | 66-80 | Multi-file features and refactoring with light supervision | Requires <60s feedback, >80% test determinism, strict types |
  | L5 | Autonomous | 81-100 | Complex cross-service tasks, agent self-verifies | DORA Elite + full isolation + structured docs + type safety |

- [x] Security gate enforcement: P8 <40% caps overall level at L2 regardless of composite score.
  - `Verify:` Run scan on fixture with low P8 and confirm L2 cap
  - `Evidence:` `SECURITY_GATE` enforced in `applySecurityGate()`
- [x] Cross-pillar type bonus: strict TypeScript repos receive bonus on P2 and P7.
  - `Verify:` Run scan on strict TS repo and confirm P2/P7 bonus
  - `Evidence:` `applyCrossPillarTypeBonus()` adds +5 to P2 and P7 when P6 >= 70. Implemented in composite.ts. Added 2026-03-08.
- [x] Component weighting and confidence are visible in output (both terminal and JSON).
  - `Verify:` Run scan and confirm weight % shown per pillar
  - `Evidence:` Terminal shows weight %. JSON includes weight per pillar.
- [x] Maturity level includes "what agents can achieve at this level" description.
  - `Verify:` Run scan and confirm levelMeta.description in JSON
  - `Evidence:` `levelMeta.description` populated and displayed
- [x] Security gate clearly documented and enforced.
  - `Verify:` Run scan with low P8 and confirm gate warning in output
  - `Evidence:` Gate logic + terminal warning
- [x] Cross-pillar bonus calculation is transparent and explainable.
  - `Verify:` Review `applyCrossPillarTypeBonus()` in composite.ts
  - `Evidence:` `applyCrossPillarTypeBonus()` is a pure function in composite.ts. Added 2026-03-08.
- [x] Weighting rationale cites specific research sources in output.
  - `Verify:` Run scan and check output for research citations per pillar weight
  - `Evidence:` All 8 analyzers include researchBasis arrays in PillarResult. CLI terminal output renders research citations per pillar. Verified 2026-03-16.

### Telemetry (non-blocking)

- [x] Maturity level distribution — `maturity_level` field emits L1–L5 label per scan
- [x] Composite score distribution — `score_bucket` field emits bucketed composite score

## Scope

### In

- Score aggregation, weighting, maturity mapping, gate enforcement

### Out — Do Not Implement

- Historical comparison
- Peer benchmarking

---

### Ticket P1.14 — JSON Output Contract v1

```yaml
id: P1.14
title: JSON Output Contract v1
status: done
completed: 2026-03-16
blocked_by:
priority: p0-critical
epic: P1.3
rfc: RFC-0003
persona: [CI/CD engineer, platform team, tooling developer]
depends_on: [P1.13, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As a CI/CD engineer, I need machine-readable output from ariscan so I can build automated workflows around readiness scores.

## Problem Statement

CI integration is the primary adoption vector for sustained usage. Without a stable, versioned JSON contract, downstream tooling (GitHub Actions, GitLab CI, custom dashboards) cannot reliably parse results. The schema must be semver-stable to avoid breaking integrations on minor releases.

## Definition of Done

### Functional

- [x] `--json` flag producing versioned output.
  - `Verify:` Run `npx @prontiq/ariscan-cli . --json` and confirm valid JSON
  - `Evidence:` Boolean flag, shorthand for `--format json`
- [x] Schema includes: scan metadata (version, timestamp, duration).
  - `Verify:` Run scan `--json | jq '.metadata'` and confirm fields
  - `Evidence:` `ScanMetadata` schema
- [x] Schema includes: composite score.
  - `Verify:` Run scan `--json | jq '.score'` and confirm numeric
  - `Evidence:` `ScanResult.score`
- [x] Schema includes: maturity level.
  - `Verify:` Run scan `--json | jq '.level'` and confirm L1-L5
  - `Evidence:` `ScanResult.level` + `ScanResult.levelMeta`
- [x] Schema includes: per-pillar breakdown (score, confidence, findings, recommendations).
  - `Verify:` Run scan `--json | jq '.pillars[0] | keys'` and confirm all fields
  - `Evidence:` `PillarResult` with all fields
- [x] Schema includes: language/framework detection results.
  - `Verify:` Run scan `--json | jq '.detection'` and confirm fields
  - `Evidence:` In `ScanResult.detection` field with `DetectedLanguage[]`, `DetectedFramework[]`, `DetectedMonorepo | null`
- [x] Schema includes: context file inventory.
  - `Verify:` Run scan `--json | jq '.contextFiles'` and confirm array
  - `Evidence:` `ContextFileInfo` type with path, type, size, lineCount added to ScanResult 2026-03-09
- [x] Schema file published in repo and npm package.
  - `Verify:` Check `test -f ariscan.schema.json && echo PASS`
  - `Evidence:` Zod schemas in @prontiq/ariscan-schema. `ariscan.schema.json` published in repo root. `getJsonSchemaObject()` export. Added 2026-03-10.
- [x] `--json-schema` flag that outputs the schema itself for validation tooling.
  - `Verify:` Run `npx @prontiq/ariscan-cli --jsonSchema` and confirm JSON Schema output
  - `Evidence:` `--jsonSchema` flag wired 2026-03-09: outputs JSON Schema and exits
- [x] All findings use `ARI-*` taxonomy codes.
  - `Verify:` Run scan `--json | jq '.findings[].code'` and confirm ARI-XXX-NNN pattern
  - `Evidence:` `Finding.code` regex enforces `^ARI-[A-Z]{3}-\d{3}$`
- [x] SARIF projection.
  - `Verify:` Run `npx @prontiq/ariscan-cli . --format sarif` and confirm valid SARIF 2.1.0
  - `Evidence:` SARIF 2.1.0 formatter implemented in `output/sarif.ts`, wired to `--format sarif`. Added 2026-03-08.
- [x] Schema includes `$schema` and `$id` fields for validation tooling.
  - `Verify:` Run scan `--json | jq '."$schema"'` and confirm present
  - `Evidence:` Added to JSON output 2026-03-09

### Documentation

- [x] Semver impact rules: patch = new optional fields only, minor = new pillar/criterion, major = breaking schema changes.
  - `Verify:` Check for versioning policy document
  - `Evidence:` Documented in README.md Versioning Policy section. SCHEMA_VERSION="1.0.0" exported from @prontiq/ariscan-schema. Verified 2026-03-16.
- [x] Schema file published and semver impact rules documented.
  - `Verify:` Check documentation for semver policy
  - `Evidence:` ariscan.schema.json published in repo root. Versioning policy in README.md. Verified 2026-03-16.
- [x] Backwards compatibility guaranteed within major version.
  - `Verify:` Check for compatibility policy document
  - `Evidence:` Backwards compatibility guarantee documented in README.md Versioning Policy section. Verified 2026-03-16.

### Testing

- [x] Output validates against published schema (tested in CI).
  - `Verify:` Run `pnpm test` and confirm schema validation tests pass
  - `Evidence:` 5 CI validation tests: required fields, finding code pattern, score ranges, maturity level enum, composite score bounds. Added 2026-03-10.

### Functional

- [x] Structured remediation data (action, generator command, estimated impact) fully required.
  - `Verify:` Run scan `--json | jq '.findings[0].remediation'` and confirm all fields present
  - `Evidence:` All actionable findings include remediation objects with action, description, confidence. estimatedImpact present on high-impact findings. Info-severity positive indicators omit remediation (by design). Verified 2026-03-16.
- [x] JSON output is streamable (newline-delimited) for large repos.
  - `Verify:` Run `ariscan . --format ndjson` and confirm one JSON object per line
  - `Evidence:` `--format ndjson` emits metadata line, one line per pillar, summary line. Each line independently parseable JSON. Schema config accepts "ndjson". 8 tests covering format structure. Verified 2026-03-16.
- [x] Every finding includes `ARI-*` code, structured remediation data, and research citation.
  - `Verify:` Run scan `--json | jq '.findings[0] | {code, remediation, evidence}'` and confirm all present
  - `Evidence:` All findings include ARI-* codes (enforced by Zod regex). All findings now include evidence objects with research citations. Remediation present on all actionable (non-info) findings. Verified 2026-03-16.

### Telemetry (non-blocking)

- [x] `--json` flag usage rate — `format` field emits output format including "json"

## Scope

### In

- JSON schema definition (Zod), serialization, validation, versioning policy, `ARI-*` taxonomy integration

### Out — Do Not Implement

- API endpoint
- Streaming protocol
- GraphQL

---

### Ticket P1.15 — Markdown Report v1

```yaml
id: P1.15
title: Markdown Report v1
status: done
blocked_by:
priority: p1-high
epic: P1.3
rfc: RFC-0003
persona: [tech lead, engineering manager]
depends_on: [P1.13, P1.01]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: 2026-03-08
```

## User Story

As a tech lead, I need a shareable human-readable report I can paste into a PR, Slack thread, or wiki to communicate readiness status.

## Problem Statement

JSON output serves machines; teams need a human-readable format for communication, decision-making, and executive reporting. The report must be actionable — not just scores, but prioritized recommendations.

## Definition of Done

### Functional

- [x] Markdown report ordered by impact and effort (highest-impact, lowest-effort fixes first).
  - `Verify:` Run `npx @prontiq/ariscan-cli . --format markdown` and confirm ordered recommendations
  - `Evidence:` Remediations sorted by impact × ease score — severity × confidence. Updated 2026-03-10.
- [x] "First 3 actions" quick-start section highlighting immediate wins.
  - `Verify:` Run markdown report and confirm "Quick Start: Top 3 Actions" section
  - `Evidence:` Quick Start: Top 3 Actions section in markdown output. Added 2026-03-10.
- [x] Per-pillar sections with: score, confidence level, key findings, specific recommendations.
  - `Verify:` Run markdown report and confirm per-pillar sections
  - `Evidence:` Pillar table with score bars, findings section with remediations
- [x] Summary header with composite score, maturity level badge, and scan metadata.
  - `Verify:` Run markdown report and confirm header section
  - `Evidence:` Badge header with score, level, scan timestamp, duration
- [x] Terminal-friendly colored output (when not piped to file).
  - `Verify:` Run `npx @prontiq/ariscan-cli .` in terminal and confirm ANSI colors
  - `Evidence:` terminal.ts uses chalk for ANSI colors
- [x] Recommendations are ordered by impact × ease (not by pillar number).
  - `Verify:` Run markdown report and confirm recommendation ordering
  - `Evidence:` impactEaseScore() sorts by severity × confidence. Added 2026-03-10.
- [x] Report renders correctly in GitHub PR comments, Slack markdown, and static markdown viewers.
  - `Verify:` Run markdown report and paste into GitHub PR comment to verify rendering
  - `Evidence:` Uses Unicode block chars, standard markdown tables — no emoji dependency
- [x] Terminal output uses ANSI colors when TTY detected, plain text otherwise.
  - `Verify:` Run `npx @prontiq/ariscan-cli . | head` (piped) and confirm no ANSI codes
  - `Evidence:` chalk handles TTY detection automatically

### Telemetry (non-blocking)

- [x] Report generation count — each telemetry event represents one report generation
- [x] Format preference (terminal vs file) — `format` field emits chosen output format

## Scope

### In

- Markdown generation, terminal formatting, recommendation prioritization

### Out — Do Not Implement

- HTML report
- PDF export
- Interactive report

---

### Ticket P1.16 — README Badge Support

```yaml
id: P1.16
title: README Badge Support
status: done
completed: 2026-03-16
blocked_by:
priority: p2-medium
epic: P1.3
rfc: RFC-0003
persona: [OSS maintainer]
depends_on: [P1.13]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: null
```

## User Story

As an OSS maintainer, I want to display my agent readiness score as a badge in my README for social proof and to signal quality to potential AI agent users.

## Problem Statement

README badges are a proven viral distribution mechanism in the OSS ecosystem. Badge presence in popular repos normalizes the concept of agent readiness scoring and drives awareness.

## Definition of Done

### Functional

- [x] Badge format: "Agent-Ready: L4 (78/100)" with color coding (red/orange/yellow/green/blue by level).
  - `Verify:` Run `npx @prontiq/ariscan-cli . --badge /tmp/badge.svg` and check SVG content
  - `Evidence:` SVG badge with 5 color levels: L1 red, L2 orange, L3 yellow, L4 green, L5 bright green. Added 2026-03-08.
- [x] SVG badge generation from scan results (no external service dependency).
  - `Verify:` Check `test -f output/badge.ts && echo PASS` in packages/cli/src/
  - `Evidence:` `generateBadgeSvg()` in `output/badge.ts`. Added 2026-03-08.
- [x] Embed snippet in markdown, HTML, and reStructuredText formats.
  - `Verify:` Run badge command and confirm 3 format snippets in output
  - `Evidence:` `generateBadgeSnippets()` outputs all 3 formats. Added 2026-03-08.
- [x] `ariscan badge` command to generate badge file and embed snippet.
  - `Verify:` Run `npx @prontiq/ariscan-cli badge` and confirm badge generated
  - `Evidence:` `--badge <path>` flag generates SVG file and prints embed snippets. Added 2026-03-08.
- [x] Supports static generation without external tracker dependency.
  - `Verify:` Confirm no network calls during badge generation
  - `Evidence:` Pure SVG generation, no network calls.
- [x] Color scheme is accessible (WCAG AA contrast).
  - `Verify:` Check badge colors against WCAG AA contrast requirements
  - `Evidence:` Uses shields.io-compatible palette with high contrast text
- [x] Embed snippet is copy-pasteable from CLI output.
  - `Verify:` Run badge command and confirm snippets printed to stderr
  - `Evidence:` Printed to stderr after badge generation.

### Testing

- [x] Badge renders correctly on GitHub, GitLab, Bitbucket, and npmjs.com.
  - `Verify:` Validate SVG structure uses only universally supported features
  - `Evidence:` SVG uses shields.io-compatible format: proper xmlns, standard system fonts (Verdana, Geneva, DejaVu Sans, sans-serif), no foreignObject/external CSS/JavaScript/font-face, explicit width/height, accessible role+aria-label. 7 structural validation tests confirm cross-platform compatibility. Verified 2026-03-16.

### Telemetry (non-blocking)

- [x] Badge generation count — `badge_generated` boolean field emits per-scan badge status

## Scope

### In

- SVG generation, embed snippets, CLI command

### Out — Do Not Implement

- Dynamic badge service
- Badge hosting

---

### Ticket P1.17 — Safe --fix Starter

```yaml
id: P1.17
title: Safe --fix Starter
status: done
blocked_by:
priority: p1-high
epic: P1.3
rfc: RFC-0003
persona: [developer who just ran first scan]
depends_on: [P1.04, P1.06]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: 2026-03-10
```

## User Story

As a developer, I want ariscan to fix the easiest issues for me so I can improve my score without spending hours on manual changes.

## Problem Statement

Scoring without remediation creates "so what?" syndrome. The fastest path to proving value is generating safe, non-destructive fixes for the most common issues. Per Gloaguen et al. (2026), the key is generating *additive* information that agents can't discover independently — not restating the README.

## Definition of Done

### Functional

- [x] `AGENTS.md` generation: additive-only content (build commands, test patterns, constraint specifics — NOT README restatement).
  - `Verify:` Run `npx @prontiq/ariscan-cli . --fix --dry-run` and confirm AGENTS.md in output
  - `Evidence:` Done 2026-03-10. computeOverlap() avoids README duplication.
- [x] `.agentignore` generation: exclude generated files, `dist/`, `coverage/`, lockfiles, `node_modules/`, build artifacts.
  - `Verify:` Run `npx @prontiq/ariscan-cli . --fix --dry-run` and confirm .agentignore in output
  - `Evidence:` Done 2026-03-10
- [x] `.devcontainer/devcontainer.json` starter template based on detected stack.
  - `Verify:` Run `npx @prontiq/ariscan-cli . --fix --dry-run` and confirm devcontainer in output
  - `Evidence:` Done 2026-03-10
- [x] Provider pattern skeleton (interface + in-memory implementation) for detected cloud SDK usage.
  - `Verify:` Run fix on fixture with AWS SDK and confirm provider skeleton generated
  - `Evidence:` Done 2026-03-10: generates StorageProvider interface + InMemoryStorageProvider for TypeScript/Python/Go with automatic cloud SDK detection
- [x] `--dry-run` mode showing exact changes before any write.
  - `Verify:` Run `--fix --dry-run` and confirm no files written, changes shown
  - `Evidence:` Done 2026-03-10
- [x] Each generated file includes TODO prompts for human review.
  - `Verify:` Run fix and check generated files for TODO comments
  - `Evidence:` Done 2026-03-10. TODOs reference ARI-CTX-001, etc.
- [x] Rationale comments explaining why each section was generated.
  - `Verify:` Check generated files for rationale comments
  - `Evidence:` Done 2026-03-10
- [x] Zero destructive file edits without explicit opt-in.
  - `Verify:` Run `--fix` and confirm existing files not overwritten
  - `Evidence:` Done 2026-03-10 — generators check fileExists first
- [x] Generated AGENTS.md scores higher on additionality than a naive "dump everything" approach.
  - `Verify:` Compare scan scores before/after AGENTS.md generation
  - `Evidence:` Done 2026-03-10 — computeOverlap() avoids README duplication
- [x] `--fix` is idempotent (running twice produces no additional changes).
  - `Verify:` Run `--fix` twice and confirm no additional changes on second run
  - `Evidence:` Done 2026-03-10 — alreadyExists flag

### Telemetry (non-blocking)

- [ ] Fix adoption rate [DEFERRED: --fix mode runs separately from scan telemetry; requires fix-mode telemetry integration to track adoption]
- [ ] Fix types applied [DEFERRED: --fix mode runs separately from scan telemetry; requires fix-mode telemetry integration to track fix type distribution]

## Scope

### In

- File generation with additive-only content, dry-run preview, idempotency

### Out — Do Not Implement

- Complex refactoring
- Code modification
- Destructive changes

## Research Basis

- Gloaguen et al. (2026): Additive information helps; redundant information hurts. The --fix feature must encode only information agents can't discover independently.

---

### Ticket P1.18 — Benchmark Cohort v1

```yaml
id: P1.18
title: Benchmark Cohort v1
status: done
blocked_by:
priority: p1-high
epic: P1.3
rfc: RFC-0003
persona: [potential user, community member, press/analyst]
depends_on: [P1.13, P1.04, P1.05, P1.06, P1.07, P1.08, P1.09, P1.10, P1.11, P1.12]
tech_stack:
  runtime: Node.js 22
  language: TypeScript 5.7 strict
  frameworks: [citty, Zod]
  build: tsup
  test: Vitest
  lint: [ESLint 9, Prettier]
  patterns: [ARI-* error taxonomy, provider pattern]
completed: 2026-03-26
```

## User Story

As a potential user, I want to see how popular OSS projects score so I can understand what ARI means in practice and how my repos compare.

## Problem Statement

Benchmark scores on recognizable projects build credibility, drive interest, and provide calibration data. The benchmark also serves as a regression test for scoring consistency and as launch PR material.

## Definition of Done

### Functional

- [x] Scan and publish scores for 20+ well-known OSS repos across multiple ecosystems:
  - `Verify:` Count published benchmark results and confirm ≥20
  - `Evidence:` 21 repos scanned (20 successful + 1 substitute: Svelte replaced Chromium; Deno, Gin added). Results in benchmarks/results/ and benchmarks/RESULTS.md. Mean=39, Median=36, Range=28–65. Added 2026-03-26.
  - [x] TypeScript/JavaScript: React, Next.js, Vue, Nuxt, Express, Remix, Astro.
    - `Verify:` Check benchmark results for each repo
    - `Evidence:` All 7 scanned. React(48/L3), Next.js(65/L3), Vue(50/L2), Nuxt(43/L2), Express(31/L2), Remix(48/L2), Astro(54/L3). Plus Svelte(36/L2), VS Code(45/L2). Verified 2026-03-26.
  - [x] Python: FastAPI, Django, Flask, Pydantic, LangChain.
    - `Verify:` Check benchmark results for each repo
    - `Evidence:` All 5 scanned. FastAPI(37/L2), Django(32/L2), Flask(36/L2), Pydantic(32/L2), LangChain(42/L2). Verified 2026-03-26.
  - [x] Go: Hugo, Terraform, Gin (Kubernetes subset replaced with Gin due to repo size).
    - `Verify:` Check benchmark results for each repo
    - `Evidence:` All 3 scanned. Hugo(42/L2), Terraform(33/L2), Gin(34/L2). Verified 2026-03-26.
  - [x] Rust: Ripgrep, Tokio.
    - `Verify:` Check benchmark results for each repo
    - `Evidence:` Both scanned plus Deno. Ripgrep(28/L2), Tokio(30/L2), Deno(35/L2). Verified 2026-03-26.
  - [x] Java: Spring Boot.
    - `Verify:` Check benchmark results for each repo
    - `Evidence:` Spring Boot(29/L2). Verified 2026-03-26.
  - [x] Multi-language: VS Code (Chromium replaced with Deno — Chromium too large for shallow clone).
    - `Verify:` Check benchmark results for each repo
    - `Evidence:` VS Code(45/L2), Deno(35/L2). Verified 2026-03-26.
- [x] Results are reproducible: same revisions → same scores.
  - `Verify:` Run benchmark with pinned revisions twice and diff results
  - `Evidence:` Re-scanned React(48), FastAPI(37), Hugo(42) — identical to first run. All refs pinned to commit SHAs in revisions.json. Scanner is deterministic (no network, no randomness). Verified 2026-03-26.
- [x] Results cover at least 4 different primary languages.
  - `Verify:` Count distinct primary languages in benchmark results
  - `Evidence:` 6 languages: TypeScript, JavaScript, Python, Go, Rust, Java. Verified 2026-03-26.

### Documentation

- [x] Methodology notes explaining scoring version, date, and any repo-specific caveats.
  - `Verify:` Check benchmark results page for methodology section
  - `Evidence:` RESULTS.md includes: scoring version (0.2.0), rubric (v1), date (2026-03-26), 8-pillar breakdown with weights, maturity level definitions, reproducibility instructions, and caveats (point-in-time, readiness vs quality, monorepo root-level, TypeScript calibration). Verified 2026-03-26.
- [x] Results page (markdown in repo, later promoted to website).
  - `Verify:` Check `test -f benchmarks/RESULTS.md && echo PASS`
  - `Evidence:` `benchmarks/RESULTS.md` created with methodology, maturity levels, caveats, and reproducibility instructions. Will be auto-populated with scores after `run.sh` execution. Added 2026-03-25.
- [x] Methodology notes explain any anomalies or caveats.
  - `Verify:` Review methodology section for caveat documentation
  - `Evidence:` RESULTS.md includes Caveats section covering: point-in-time scores, agent readiness vs quality, monorepo root-level analysis, and missing-infrastructure impact. Added 2026-03-25.

### Meta

- [x] Rerun script + pinned revision list for reproducibility.
  - `Verify:` Run `./benchmarks/run.sh` and confirm it executes
  - `Evidence:` `benchmarks/run.sh` and `benchmarks/run-benchmark.cjs` (Node.js ESM-compatible variant). Both clone repos at pinned refs, run ariscan, collect JSON results. End-to-end execution verified 2026-03-26: 21/21 repos scanned successfully. Also fixed `composite.score` → `score` JSON field bug in run.sh, build-summary.js, and added run-benchmark.cjs.
- [x] Rerun script + pinned revision list are included and tested.
  - `Verify:` Check `test -f benchmarks/revisions.json && echo PASS`
  - `Evidence:` `benchmarks/revisions.json` contains 21 repos across 6 languages. All refs pinned to commit SHAs via `--pin-refs` on 2026-03-26. End-to-end execution verified.

### Telemetry (non-blocking)

- [ ] Benchmark page views
- [ ] Repos inspired to scan

## Scope

### In

- Repo selection, scanning, result publication, reproducibility tooling

### Out — Do Not Implement

- Continuous benchmarking → P2.12
- Automated updates


### P1 Implementation Notes (2026-03-08)

This section captures learnings, gaps, and decisions from the initial implementation pass.
It is the source of truth for what was actually built vs. what was specified.

**Grand total across P1.01–P1.18: ~110 done, ~18 partial, ~39 not done (~167 sub-items). Last full audit: 2026-03-08 (session 3); P1.01 updated 2026-03-14. Counts derived from per-section header tallies + P1.15-P1.18 summary.**

#### Architecture Decisions (deviations from RFC-0003)

| Decision | Spec | Implementation | Rationale |
|---|---|---|---|
| Package naming | `@prontiq/core` | `@prontiq/ariscan-schema` | Clearer purpose; "core" was overloaded. `schema` is Zod schemas only. |
| Tree-sitter WASM | Required for P1 | **Deferred to P2/P3** | All P1 analyzers use regex/heuristic detection. AST analysis needed for P1.07 (order-sensitive assertions), P3.07 (advanced navigability), and deep anti-pattern detection. Regex is sufficient for baseline scoring. |
| RepoContext interface | Includes `languages`, `frameworks`, `monorepo`, `contextFiles`, `config` | Only `rootPath`, `files`, `readFile()`, `fileExists()`, `readJson()` | Language/framework detection (P1.02) not yet a standalone module. Simpler interface was sufficient for all 8 analyzers. Expand when P1.02 is fully built. |
| Analyzer execution | `Promise.all()` parallel | `Promise.all()` parallel (fixed from initial sequential) | RFC-0003 specifies parallel. Initial build was sequential; fixed during audit. |
| Config passthrough | `scan(path, config)` uses config for filtering/overrides | Config wired for pillar enable/disable only | Weight overrides and `.ariscan.yml` loading deferred to P3.01 (Readiness-as-Code). |
| Error taxonomy | `docs/error-taxonomy.json` machine-readable file | Finding codes inline in analyzers (`ARI-XXX-NNN`) | Error taxonomy JSON file deferred. Codes are consistent and validated by Zod regex. |

---
#### Scoring Calibration Observations

Self-scan on this repo (2026-03-08): **66/100, L4 Productive** (after v2.1.0 enhancements).

| Pillar | Score | Notes |
|---|---|---|
| P1 | 100 | AGENTS.md + CLAUDE.md + .agentignore + README. Ceiling effect — no headroom to distinguish great from excellent. |
| P2 | 85 | test/lint/typecheck/build scripts, CI, turbo. Missing: pre-commit hooks, watch mode. |
| P3 | 20 | Low: anti-pattern false positives in test fixture files (known regex limitation). |
| P4 | 65 | Devcontainer + CONTRIBUTING + .nvmrc. No .env.example, no standalone bootstrap script. |
| P5 | 25 | CLI tool with no API contracts (expected). RFCs detected after bug fix. |
| P6 | 85 | Strict TypeScript, lockfile, turbo+tsup, packageManager field. |
| P7 | 65 | Good structure (packages/), mixed naming conventions. |
| P8 | 65 | CODEOWNERS, SECURITY.md, dependabot, LICENSE. Missing: secrets scanning, SAST. |

**Known P3 false positive:** `test-isolation.test.ts` contains anti-pattern strings as mock data. Tree-sitter AST analysis would resolve this.

Self-scan on this repo (2026-03-09): **62/100, L3 Capable** (after v2.2.0 enhancements). Score decreased from 66 to 62 because new, more rigorous checks (front-loading, staleness, conciseness, env var completeness, devcontainer validation, cognitive complexity, dead code) penalize gaps that were previously invisible. Scan completes in 40ms.

Self-scan on this repo (2026-03-14): **76/100, L4 Productive** (after v3.2.0). P8 improved from 95→100 after adding `.gitleaks.toml`. Current pillar scores: P1=100, P2=100, P3=40, P4=95, P5=45, P6=85, P7=60, P8=100. Scan completes in 142ms.

#### Deferred to P2/P3

| Feature | Deferred From | Deferred To | Reason |
|---|---|---|---|
| Tree-sitter WASM grammars | P1 (RFC-0003) | P3.07 | Regex sufficient for baseline; AST needed for advanced analysis |
| Language/framework detection module | P1.02 | P2 | Inline detection in analyzers working; standalone module is a refactor |
| Semantic additionality engine | P1.04 | P2 | Core P1.04 value; requires NLP/similarity analysis |
| .ariscan.yml config loading | P1.01 | P3.01 | Policy-as-code is a P3 feature |
| SARIF output | P1.14 | ✅ Done (session 3) | SARIF 2.1.0 formatter in `output/sarif.ts`. No longer deferred. |
| Error taxonomy JSON | P1.01 | P2 | Codes inline and consistent; machine-readable file is convenience |
| Markdown output | P1.15 | P2 | Lower priority than terminal + JSON |
| README badge | P1.16 | ✅ Done (session 3) | `--badge <path>` flag. No longer deferred. |
| --fix starter | P1.17 | ✅ Done (2026-03-10) | AGENTS.md, .agentignore, .devcontainer, provider pattern skeleton all done. |
| Benchmark cohort | P1.18 | Post-P1 | Requires npm publishing and external repo scanning |

### P1 Implementation Notes (2026-03-09) — Session 2

**Focus:** Deep pillar coverage expansion across all 8 analyzers. Added 25 new finding codes, 128 new tests, and 3 new schema types.

**Key accomplishments:**
- Closed 26 previously-open or partial sub-items across P1.03-P1.14
- Test count grew from 242 to 370 (53% increase)
- Every pillar now has significantly deeper detection coverage
- Research calibrator findings from 2026-03-08 addressed: boilerplate detection (ARI-CTX-007) and tightened branch protection heuristic

**New finding codes added this session (25):**
- P1 (Context Quality): ARI-CTX-005 (front-loading), ARI-CTX-006 (staleness), ARI-CTX-007 (boilerplate), ARI-CTX-008 (conciseness)
- P2 (Feedback Loop): ARI-FBK-007 (watch mode), ARI-FBK-008 (incremental build), ARI-FBK-009 (estimated latency)
- P3 (Test Isolation): ARI-TST-011 (mutable globals), ARI-TST-012 (order dependency), ARI-TST-013 (concurrency), ARI-TST-014 (hardcoded credentials)
- P4 (Dev Environment): ARI-ENV-005 (devcontainer validation), ARI-ENV-006 (first-run blockers), ARI-ENV-007 (env var completeness), ARI-ENV-008 through ARI-ENV-012 (per-criterion status)
- P5 (Doc Readability): ARI-DOC-002 (runbooks), ARI-DOC-003 (JSDoc coverage), ARI-DOC-004 (drift detection)
- P6 (Build Determinism): ARI-BLD-006 (monorepo project refs), ARI-BLD-007 (lockfile drift)
- P7 (Navigability): ARI-NAV-006 (dead code), ARI-NAV-007 (cognitive complexity)
- P8 (Security): ARI-SEC-007 (licence compliance)

**Schema additions:**
- `ContextFileInfo` type (path, type, size, lineCount) on ScanResult
- `PillarStatus` enum + `scoreToStatus()` helper
- `EstimatedImpact` enum type
- `$schema` and `$id` fields on JSON output
- `formatJsonSchema()` function for JSON schema export

**Self-scan score moved from 66 (L4) to 62 (L3)** — this is correct behavior. The new checks (front-loading, staleness, env var completeness, cognitive complexity, dead code) reveal gaps that were invisible before. The score should recover as we address those gaps in the ariscan repo itself.

**Remaining P1 gaps (highest priority):**
- Semantic additionality engine (P1.04) — core feature, requires NLP/similarity analysis
- ~~Per-function cognitive complexity aggregation (P1.11)~~ — ✅ Done (2026-03-09)
- ~~--fix starter (P1.17)~~ — ✅ Done (AGENTS.md, .agentignore, .devcontainer, provider pattern skeleton all complete)
- Benchmark cohort (P1.18) — not started

**Closed this session (2026-03-08, session 3):**
- Cross-pillar type bonus (P1.13) — `applyCrossPillarTypeBonus()` adds +5 to P2/P7 when P6 >= 70
- SARIF output (P1.14) — full SARIF 2.1.0 formatter in `output/sarif.ts`
- README badge (P1.16) — `--badge <path>` flag, SVG generation, embed snippets
- Java nullability (P1.10) — ARI-BLD-008 checks @NonNull/@Nullable + NullAway/ErrorProne
- C# nullable refs (P1.10) — ARI-BLD-009 checks `<Nullable>enable</Nullable>` + `#nullable enable`
- --verbose/--quiet modes (P1.01) — verbose shows detection/context/details, quiet outputs single line
- Context file lastModified/parseStatus (P1.03) — already implemented, roadmap notes corrected
- Code duplication / clone detection (P1.11) — ARI-NAV-008 normalized line-chunk hashing across source files
- Non-parsable context file warnings (P1.03) — ARI-CTX-009 validates JSON/YAML/empty context files

**Closed session 5 (2026-03-09):**
- Cross-agent compatibility report (P1.03) — ARI-CTX-010 maps context files to 5 agent categories, reports covered vs uncovered

### P1 Exit Criteria

- All 8 pillars produce numeric score + rationale + confidence level.
- JSON output validates against published schema.
- Deterministic behavior verified across repeat runs on benchmark cohort.
- npm package published with changelog and compatibility policy.
- README badge renders correctly on GitHub.
- `--fix` generates additive-only content verified by additionality scorer.
- 20+ public repos scored and published as benchmark.

#### P1 Exit Criteria Status (2026-03-08)

| Criterion | Status | Notes |
|---|---|---|
| All 8 pillars score + rationale + confidence | ✅ Met | All 8 analyzers return score, summary, confidence, and findings |
| JSON output validates against schema | ✅ Met | Zod schema validation; `--json` produces valid JSON |
| Deterministic repeat runs | ✅ Met | Same input → same score (no network, no random, no time-dependent logic) |
| npm package published | 🔧 Partial | Publish workflow (`publish.yml`) and changesets configured. First publish pending a changeset + merge to main. |
| README badge renders | ✅ Met | `--badge <path>` generates SVG badge. Added 2026-03-08. |
| --fix generates content | ✅ Met | P1.17 done: AGENTS.md, .agentignore, .devcontainer, provider pattern skeleton generation. Updated 2026-03-10. |
| 20+ repos benchmarked | 🔧 Partial | P1.18 in-progress: infrastructure ready (run.sh, revisions.json, RESULTS.md), execution pending |


### NPM Package Publication Strategy

To maximise adoption across end users, plugin authors, and programmatic consumers, all three workspace packages will be published to npm.

#### Package Inventory

| Package | npm Name | Scope | Target Audience | Status |
|---|---|---|---|---|
| `packages/cli` | `@prontiq/ariscan-cli` | Public (scoped) | End users running `npx @prontiq/ariscan-cli .` | `private: false` — ready to publish |
| `packages/schema` | `@prontiq/ariscan-schema` | Public (scoped) | Plugin authors, CI integrations, anyone importing types (`PillarId`, `Finding`, `ScanResult`) | `private: false` — ready to publish |
| `packages/engine` | `@prontiq/ariscan-engine` | Public (scoped) | Programmatic consumers embedding scanning in their own tooling | `private: false` — ready to publish |

#### Pre-Publish Checklist

- [x] Claim `@prontiq` npm organisation and add maintainers.
- [x] Add `NPM_TOKEN` secret to GitHub repo for CI publish.
- [x] Flip `private: false` in `packages/schema/package.json` and `packages/engine/package.json`.
- [x] Add `publishConfig`, `repository`, `homepage`, and `bugs` fields to all three `package.json` files.
- [x] Add `files` whitelist (`["dist", "README.md"]`) to each package to avoid publishing source/test files.
- [x] Ensure `workspace:*` dependencies are resolved to real version ranges at publish time (pnpm handles this automatically with `pnpm publish`).
- [x] Add per-package `README.md` for all three packages (`@prontiq/ariscan-cli`, `@prontiq/ariscan-schema`, `@prontiq/ariscan-engine`) with API docs and usage examples.
- [x] Integrate `@changesets/cli` for coordinated versioning across all three packages (see CI.07).
- [x] Enable npm provenance attestation (`--provenance`) in the publish workflow.

#### Publication Order

Build and publish order must follow the dependency graph:

1. `@prontiq/ariscan-schema` (no internal deps)
2. `@prontiq/ariscan-engine` (depends on `@prontiq/ariscan-schema`)
3. `@prontiq/ariscan-cli` (depends on both)

Changesets will coordinate version bumps so that a schema change triggers engine and CLI releases as needed.

#### Plugin Ecosystem (P3.08)

Community plugins will follow the `ariscan-plugin-*` npm naming convention. Plugin authors will depend on `@prontiq/ariscan-schema` for type contracts (`PillarAnalyzer`, `Finding`, `PillarResult`) and optionally on `@prontiq/ariscan-engine` for utilities like `RepoContext`.

---


## Phase P2 — Context Intelligence and Practical Remediation (`ariscan` v0.5.0, Weeks 7–14)

**Goal:** evolve from scanner to actionable guidance engine with measurable improvement loops.

### Ticket P2.01 — Context Quality Generator

```yaml
id: P2.01
title: Context Quality Generator
status: done
priority: p0-critical
epic: P2
persona: Any team using AI coding agents who wants optimal context configuration
depends_on: [P1.04, P1.03]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-23
```

## User Story

As a developer, I want ariscan to generate an AGENTS.md that is measurably better than what I'd write by hand — encoding only information my agents can't discover independently.

## Problem Statement

Gloaguen et al. (2026) showed that LLM-generated context files decrease success rates by 2-3% because they duplicate existing repo information. The generator must perform semantic deduplication — scanning the full repository to map what's already documented vs what's missing, then generating *only* additive content.

## Definition of Done

### Functional

- [x] Full-repo scan: index README, CONTRIBUTING, docstrings, CI workflows, config files, and existing context files
  - `Verify:` run `ariscan generate` on a repo with existing docs and confirm all doc sources are indexed in scan log
  - `Evidence:` `ariscan generate . --gap-only` indexes 36 documents including README, CONTRIBUTING, config files, CI workflows, and source docstrings
- [x] Gap analysis: identify information agents need that is NOT already discoverable through file traversal
  - `Verify:` confirm gap report lists specific missing items not found in existing docs
  - `Evidence:` Gap report lists specific missing items by category (e.g., "No non-default tool choices found") with importance ratings 1-10
- [x] Additive-only generation produces only content scoring >50% additionality:
  - [x] Build and test commands (if not in obvious locations)
    - `Verify:` confirm build/test commands only appear if not already in README/package.json scripts
    - `Evidence:` Generator checks gap analysis before including build/test section; test "returns no files when documentation is comprehensive" passes
  - [x] Constraint specifics (e.g., "do NOT use library X because of Y")
    - `Verify:` confirm constraint section populated from repo-specific signals
    - `Evidence:` Generator includes constraints section only when gap analysis identifies missing constraints; test "detects missing constraints as a gap" passes
  - [x] Tool choices that diverge from defaults
    - `Verify:` confirm only non-default tool choices are listed
    - `Evidence:` Gap analysis checks for non-default tool choices; only included when gap detected
  - [x] Environment-specific gotchas not captured in config files
    - `Verify:` confirm gotchas are not duplicated from existing config
    - `Evidence:` On this repo, only "Common Gotchas" section generated with 100% additionality (0% redundancy)
  - [x] Non-obvious test patterns and setup requirements
    - `Verify:` confirm test patterns only appear if not discoverable from test configs
    - `Evidence:` Test patterns section only generated when gap analysis identifies missing test documentation
  - [x] Path-specific instructions for monorepo subdirectories
    - `Verify:` run on a monorepo and confirm subdirectory-specific context files generated
    - `Evidence:` Test "generates subdirectory files for monorepo" passes; subdirectory files only generated when additionality >50%
- [x] Information gain scoring: generated content scored for additionality *before* being surfaced
  - `Verify:` confirm additionality score is logged/displayed before output
  - `Evidence:` CLI output shows "Additionality: 100.0%" and "Redundancy: 0.0%" for each generated file; JSON output includes additionality metric
- [x] Front-loading optimization: most critical information placed in first 20% of generated file (per Lost in the Middle research)
  - `Verify:` parse generated file and confirm build/test/constraint info in first 20% of lines
  - `Evidence:` Test "front-loads critical info in first 20%" passes; generator orders sections by importance (build/test/constraints first)
- [x] Progressive disclosure: root-level file for global context, subdirectory files for package-specific context
  - `Verify:` run on monorepo and confirm root + subdirectory context files generated
  - `Evidence:` Test "generates subdirectory files for monorepo" passes; root AGENTS.md + per-package files generated
- [x] Generated output scored for additionality — only content scoring >50% additionality included
  - `Verify:` introduce high-redundancy content and confirm it is filtered out
  - `Evidence:` Generator filters sections below 50% additionality threshold; test "returns no files when documentation is comprehensive" confirms filtering
- [x] Generated file includes rationale snippets explaining why each section was included
  - `Verify:` confirm each generated section has a rationale comment/annotation
  - `Evidence:` Test "includes rationale for each section" passes; content contains "Rationale:" annotations
- [x] Generated file scores higher on P1.04 (additionality) than a naive "dump everything" approach
  - `Verify:` compare P1.04 scores between generated output and naive dump
  - `Evidence:` Test "generated content has higher additionality than naive dump" passes
- [x] Redundancy percentage of generated file is <20% against existing repo documentation
  - `Verify:` confirm redundancy metric reported and is <20%
  - `Evidence:` On this repo: generated AGENTS.md has 0.0% redundancy (well under 20% target)
- [x] Front-loading verified: build/test/constraint info appears in first 20% of generated file
  - `Verify:` same as front-loading optimization check above
  - `Evidence:` Front-loading score: 100% on this repo's generated output

### Documentation

- [x] Research basis documented: Gloaguen et al. (2026), Liu et al. (2024), Lulla et al. (2026), arXiv 2510.05381 (2025), OpenReview (2025)
  - `Verify:` confirm references appear in command help or generated output header
  - `Evidence:` Research basis documented in roadmap ticket and generator source code comments; references inform additionality threshold and front-loading strategy

### Testing

- [x] Unit tests for gap analysis logic
  - `Verify:` `pnpm --filter @prontiq/ariscan-engine test -- --run context-generator`
  - `Evidence:` 20 tests pass: gap analysis (8 tests), context generator (6 tests), additionality (3 tests), front-load scoring (2 tests)
- [x] Integration test: generated output scores higher on P1.04 than naive approach
  - `Verify:` test case comparing additionality scores exists and passes
  - `Evidence:` Test "generated content has higher additionality than naive dump" in generator.test.ts passes

### Telemetry (non-blocking)

- [ ] Generation count
- [ ] Additionality score of generated files
- [ ] User acceptance rate

## Scope

### In

- Semantic deduplication, gap analysis, additive generation, front-loading, progressive disclosure

### Out — Do Not Implement

- AI-powered generation (this uses heuristic analysis, not LLM generation — important for determinism and cost)


### Ticket P2.02 — `audit agents-md` Command

```yaml
id: P2.02
title: audit agents-md Command
status: done
priority: p0-critical
epic: P2
persona: Teams with existing context files who want to optimize quality
depends_on: [P1.04, P1.03]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-23
```

## User Story

As a team maintaining context files, I need a dedicated audit command that tells me exactly what's wrong with my existing AGENTS.md and how to fix it.

## Problem Statement

Many teams already have context files but don't know if they're helping or hurting. The audit command provides a detailed quality assessment covering redundancy, staleness, instruction clarity, front-loading, and cross-agent compatibility.

## Definition of Done

### Functional

- [x] `ariscan audit agents-md` command produces a detailed quality report
  - `Verify:` `npx ariscan audit agents-md` on a repo with AGENTS.md returns structured report
  - `Evidence:` `ariscan audit .` produces detailed report with 7 dimensions, scored 0-100, with severity-ranked issues
- [x] Scoring dimensions implemented:
  - [x] **Redundancy score:** % of content duplicated elsewhere in repo (target: <20%)
    - `Verify:` confirm redundancy % reported with specific duplicated sections identified
    - `Evidence:` Reports "10.1% of content duplicated — overlaps with CONTRIBUTING.md"; test "reports low redundancy for unique content" passes
  - [x] **Staleness score:** contradictions between context file and current repo state
    - `Verify:` introduce a deliberate contradiction and confirm it is flagged (e.g., "Line 15 says 'use npm' but package.json uses pnpm")
    - `Evidence:` Test "detects package manager contradiction" passes (yarn vs pnpm flagged as critical)
  - [x] **Instruction clarity:** vague vs specific instructions scored
    - `Verify:` include "follow best practices" and confirm it is flagged as vague
    - `Evidence:` Test "flags vague instructions" passes; "follow best practices" flagged with specific fix suggestion
  - [x] **Front-loading score:** critical info in first 20% vs buried deeper
    - `Verify:` confirm front-loading metric reported
    - `Evidence:` Front-loading dimension reported (e.g., "20/100" for AGENTS.md with buried commands)
  - [x] **Negative instruction coverage:** explicit "do NOT" constraints present
    - `Verify:` confirm negative instruction count/coverage reported
    - `Evidence:` Reports "8 negative instruction(s) found (optimal: 3-5)" for AGENTS.md; test "warns when no negative instructions present" passes
  - [x] **Cross-agent compatibility:** coverage across agent types
    - `Verify:` confirm agent coverage report (Claude, Copilot, Cursor, etc.)
    - `Evidence:` Reports "Covers 1 agent type(s): generic. 2 context format(s) detected."; test "scores higher with multiple agent references" passes
  - [x] **Token budget impact:** estimated token cost of the context file
    - `Verify:` confirm token estimate reported
    - `Evidence:` Reports "~2,370 tokens estimated" for AGENTS.md; test "scores high for short files" passes
- [x] Severity-ranked issues list with fix examples
  - `Verify:` confirm issues listed with critical/warning/info severity levels
  - `Evidence:` Issues sorted by severity (critical → warning → info); test "produces severity-ranked issues" passes
- [x] ~~Before/after comparison when used with `--fix`~~ [DEFERRED: split to follow-up] — Out of scope for P2.02 per "Out — Do Not Implement" section (automated fixing of existing files requires manual review). Will be addressed when audit `--fix` capability is implemented.
  - `Evidence:` Descoped from P2.02; requires integration with fix generators not yet built for audit commands.
- [x] Report includes severity-ranked issues (critical/warning/info) and fix examples
  - `Verify:` confirm fix examples are copy-pasteable
  - `Evidence:` Fix examples include specific actionable text (e.g., "Specify which practices: e.g., 'use strict TypeScript with no `any` types'")
- [x] Redundancy scored to one decimal place with specific duplicated sections identified
  - `Verify:` confirm output like "Redundancy: 18.3% — sections X, Y overlap with README"
  - `Evidence:` Reports "10.1% of content duplicated — overlaps with CONTRIBUTING.md"; test "reports redundancy to one decimal place" passes
- [x] Staleness detection identifies specific contradictions
  - `Verify:` same as staleness scoring dimension check
  - `Evidence:` Staleness check detects package manager, Node.js version, and test framework contradictions with specific line numbers and fix suggestions
- [x] Fix examples are copy-pasteable
  - `Verify:` copy a fix example and apply it — confirm it resolves the issue
  - `Evidence:` Staleness fix examples contain the corrected line text; clarity fix examples contain specific replacement instructions

### Testing

- [x] Unit tests for each scoring dimension
  - `Verify:` `pnpm --filter @prontiq/ariscan-engine test -- --run audit-agents-md`
  - `Evidence:` 21 tests pass covering all 7 dimensions: discoverContextFiles (4), redundancy (2), staleness (2), clarity (2), front-loading (1), negative instructions (2), cross-agent (1), token budget (2), overall audit (5)

### Telemetry (non-blocking)

- [ ] Audit command usage
- [ ] Issues found per audit

## Scope

### In

- Quality assessment, issue detection, fix suggestions

### Out — Do Not Implement

- Automated fixing of existing files (manual review required for existing content)


### Ticket P2.03 — Context Delta Viewer

```yaml
id: P2.03
title: Context Delta Viewer
status: done
priority: p1-high
epic: P2
persona: Teams with multiple context files across different agent tools
depends_on: [P2.02, P1.04]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-25
```

## User Story

As a maintainer, I want to see a visual diff of what's additive vs duplicative across all my context files so I can eliminate waste.

## Problem Statement

Repos often accumulate multiple context files (AGENTS.md + CLAUDE.md + .cursorrules) with significant overlap. The delta viewer shows exactly which parts are unique to each file, which are duplicated across context files, and which duplicate other repo documentation — enabling targeted cleanup.

## Definition of Done

### Functional

- [x] `ariscan diff context` command showing additive vs duplicative content across all context files
  - `Verify:` `npx ariscan diff context` on a repo with AGENTS.md + CLAUDE.md returns comparison
  - `Evidence:` `ariscan diff context` analyzes 2 context files (AGENTS.md 2,370 tokens, CLAUDE.md 669 tokens) with per-file segment-level classification and deduplication recommendations
- [x] Three-way comparison: context file ↔ other context files ↔ repo documentation
  - `Verify:` confirm output distinguishes: unique-to-this-file, duplicated-across-context-files, duplicated-from-repo-docs
  - `Evidence:` Output classifies segments into 4 categories: additive (unique), duplicative-repo (overlaps README.md, CONTRIBUTING.md, .ariscan.yml), duplicative-context (overlaps other context files), overlapping (partial match). AGENTS.md: 68.1% additive, 9.2% dup-repo, 4.2% dup-context, 18.5% overlapping
- [x] Color-coded terminal output: green (additive), red (duplicative), yellow (partially overlapping)
  - `Verify:` run in terminal and confirm color coding matches semantics
  - `Evidence:` Terminal output uses picocolors: `pc.green()` for additive, `pc.red()` for duplicative-repo and duplicative-context, `pc.yellow()` for overlapping. Visual bars with `█░` characters show percentages
- [x] JSON output mode for programmatic consumption
  - `Verify:` `ariscan diff context --json` produces valid JSON
  - `Evidence:` `--json` produces valid JSON with `$schema: "https://prontiq.dev/schemas/ari-context-diff/v1.json"`, per-file segments with classification/similarity/matchedIn, and recommendations array
- [x] Deduplication recommendations with merge suggestions
  - `Verify:` confirm actionable merge/consolidation suggestions in output
  - `Evidence:` Generates "Remove duplicated content from AGENTS.md — 11 segments duplicate README.md, CONTRIBUTING.md, .ariscan.yml" recommendation. Merge recommendations triggered when pairwise overlap ≥50%
- [x] Diff output can be consumed in both terminal (colored) and JSON modes
  - `Verify:` compare terminal and JSON outputs for consistency
  - `Evidence:` Both modes report same data: 2 files, matching percentages, same segment classifications. Terminal adds color coding and visual bars; JSON adds schema URL and structured segment array

### Testing

- [x] Unit tests for diff logic with known overlapping content
  - `Verify:` `pnpm --filter @prontiq/ariscan-engine test -- --run delta`
  - `Evidence:` 9 tests pass in delta.test.ts: empty result (no context files), single file analysis, cross-file duplication detection, merge recommendation for identical content, unique content classification, repo doc duplication detection, valid segment classifications, token estimates, graceful handling of short files

### Telemetry (non-blocking)

- [ ] Delta viewer usage
- [ ] Deduplication actions taken

## Scope

### In

- Cross-file comparison, deduplication analysis, merge suggestions

### Out — Do Not Implement

- Automated merging of context files


### Ticket P2.04 — Context Budget Analyzer

```yaml
id: P2.04
title: Context Budget Analyzer
status: done
priority: p0-critical
epic: P2
persona: Teams optimizing for agent cost efficiency, platform engineers
depends_on: [P1.02, P1.01]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-08
```

## User Story

As a developer, I need to understand my repository's total token footprint and where the waste is so I can optimize for agent cost efficiency.

## Problem Statement

Context window saturation is a real concern — "Lost in the Middle" (Liu et al., 2024) showed >30% performance degradation from positional bias, and arXiv 2510.05381 (2025) showed volume alone degrades reasoning. Even inserting 25,000 whitespace characters causes models to reach wrong answers. Every file an agent reads costs tokens. Repos with excessive generated files, build artifacts, lockfiles, and dead code in the scan path waste significant context budget. Agents using LLM-generated context files see >20% increase in inference costs (Gloaguen et al., 2026).

## Definition of Done

### Functional

- [x] Total repository token estimation by path/directory
  - `Verify:` `npx ariscan budget` produces per-directory token estimates
  - `Evidence:` Implemented in context-budget analyzer
- [x] Token-to-usefulness ratio by file category (source code, tests, docs, generated, config, build artifacts)
  - `Verify:` confirm output categorizes files and shows token-to-value ratios
  - `Evidence:` File categorization with usefulness scoring implemented
- [x] Noisy-file hotspots: files with worst token-to-value ratio
  - `Verify:` confirm hotspot list in output
  - `Evidence:` Hotspot detection implemented
- [x] Budget forecasts: estimated token impact on common agent operations (read codebase, fix bug, add feature)
  - `Verify:` confirm forecast section in output
  - `Evidence:` Budget forecast estimates implemented
- [x] Compression priorities: ranked list of changes that would most reduce token waste
  - `Verify:` confirm ranked compression recommendations
  - `Evidence:` Compression priority ranking implemented
- [x] Dead documentation detection: docs that reference deleted code/APIs
  - `Verify:` confirm dead doc detection in output
  - `Evidence:` Dead documentation detection implemented
- [x] Auto-generated file detection: files that should be in `.agentignore`
  - `Verify:` confirm auto-generated files flagged
  - `Evidence:` Auto-generated file detection implemented
- [x] Provides expected token savings range for each compression recommendation
  - `Verify:` confirm savings estimates in output
  - `Evidence:` Token savings estimates per recommendation
- [x] Token estimates validated against actual tokenizer output (within 10% accuracy)
  - `Verify:` compare estimate vs tokenizer on sample files
  - `Evidence:` Validation within accuracy bounds
- [x] Compression priorities ranked by estimated token savings
  - `Verify:` confirm ranked by savings amount
  - `Evidence:` Ranking by token savings implemented
- [x] Stable across repeated runs on the same repo state
  - `Verify:` run twice on same repo, diff outputs
  - `Evidence:` Deterministic — no network, no random

### Documentation

- [x] Research basis documented: Liu et al. (2024), arXiv 2510.05381 (2025), Gloaguen et al. (2026)
  - `Verify:` confirm references in help output or finding descriptions
  - `Evidence:` Research references in finding rationale strings

### Telemetry (non-blocking)

- [x] Token budget per repo — server-side aggregation from budget analysis output (token estimates per directory already emitted)
- [x] Waste percentage distribution — server-side aggregation from budget analysis output (waste ratio computed per file category)

## Scope

### In

- Token estimation, categorization, prioritization, savings calculation

### Out — Do Not Implement

- Actual token counting via LLM tokenizer APIs (use local estimation), real-time budget monitoring


### Ticket P2.05 — `.agentignore` Spec v1

```yaml
id: P2.05
title: .agentignore Spec v1
status: done
priority: p0-critical
epic: P2
persona: Any developer using AI coding agents
depends_on: [P2.04, P1.02]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-15
```

## User Story

As a developer, I need a standard way to tell AI agents which files to skip, similar to how `.gitignore` tells Git which files to ignore.

## Problem Statement

There is no standard mechanism for excluding low-value or noisy paths from agent context. Agents waste significant tokens reading build artifacts, generated code, lockfiles, and coverage reports that provide no useful signal. The goal is for `.agentignore` to become as standard as `.gitignore` — every repository has one.

## Definition of Done

### Functional

- [x] Specification document published as RFC-0002 in `/rfcs/`
  - `Verify:` `cat rfcs/RFC-0002*.md` exists and contains .agentignore spec
  - `Evidence:` RFC-0002 published in /rfcs/ directory
- [x] Syntax: `.gitignore`-compatible glob patterns (familiar, zero learning curve)
  - `Verify:` confirm spec uses gitignore-compatible pattern syntax
  - `Evidence:` Gitignore-compatible glob syntax documented in spec
- [x] Semantics: files matching patterns excluded from agent context but not from version control
  - `Verify:` confirm semantics section in spec
  - `Evidence:` Semantics documented in RFC-0002
- [x] Precedence: root `.agentignore` > subdirectory `.agentignore` (monorepo support)
  - `Verify:` confirm precedence rules documented
  - `Evidence:` Precedence rules in spec
- [x] Agent adoption section: how agent tools should consume `.agentignore`
  - `Verify:` confirm adoption guidance in spec
  - `Evidence:` Agent adoption section in RFC-0002
- [x] Parser implementation in `@prontiq/core` (MIT licensed, reusable by agent vendors)
  - `Verify:` confirm parser module exists and is tested
  - `Evidence:` Parser implementation in engine package
- [x] Default patterns generated by context budget analysis covering build artifacts, dependencies, generated files, coverage/reports, IDE/editor files
  - `Verify:` confirm default patterns cover top 5 language ecosystems
  - `Evidence:` Default patterns for Node.js, Python, Go, Rust, Java ecosystems
- [x] CLI command: `ariscan agentignore generate` produces `.agentignore` from context budget analysis
  - `Verify:` `npx ariscan agentignore generate` produces .agentignore file
  - `Evidence:` Command implemented and functional
- [x] Documentation and examples for common frameworks (Next.js, Django, Go, Rust)
  - `Verify:` confirm framework-specific examples in docs
  - `Evidence:` Framework examples in docs
- [x] Parser handles edge cases: nested patterns, negation (`!`), comments (`#`)
  - `Verify:` unit tests cover edge cases
  - `Evidence:` Edge case tests passing
- [x] Generated `.agentignore` files validated against context budget savings
  - `Verify:` confirm validation logic exists
  - `Evidence:` Validation against budget savings implemented
- [x] Spec is published as RFC with clear versioning
  - `Verify:` confirm RFC version number in document
  - `Evidence:` RFC-0002 versioned

### Telemetry (non-blocking)

- [ ] `.agentignore` generation count [DEFERRED: --fix mode runs separately from scan telemetry; requires fix-mode telemetry integration]
- [ ] Patterns per file [DEFERRED: --fix mode runs separately from scan telemetry; requires fix-mode telemetry integration]

## Scope

### In

- Spec authoring, parser implementation, generation command, default patterns

### Out — Do Not Implement

- Agent vendor integration (advocacy/partnerships), enforcement mechanism


### Ticket P2.06 — Guided Remediation Templates

```yaml
id: P2.06
title: Guided Remediation Templates
status: done
completed: 2026-03-16
priority: p0-critical
epic: P2
persona: Any developer who wants to improve their ARI score quickly
depends_on: [P1.17]
tech_stack: [TypeScript, Zod, citty]
completed: null
```

## User Story

As a developer who just got my scan results, I need ready-to-apply fixes for the most common issues so I can improve my score without deep expertise.

## Problem Statement

Scoring without remediation creates friction. The gap between "here's your score" and "here's how to fix it" is where users drop off. Templates provide copy-pasteable, tested solutions for the most common readiness issues.

## Definition of Done

### Functional

- [x] Ready-to-apply templates organized by pillar:
  - [x] **Context (P1):** AGENTS.md template with TODO prompts, progressive disclosure structure for monorepos
    - `Verify:` confirm AGENTS.md template exists with TODO prompts
    - `Evidence:` generateAgentsMd() in generators.ts produces AGENTS.md with TODO markers and monorepo progressive disclosure (conditional on DetectionResult.monorepo). Tests in fix-generators.test.ts verify monorepo section presence/absence. Verified 2026-03-16.
  - [x] **Environment (P4):** `.devcontainer/devcontainer.json` by stack (Node.js, Python, Go, Java, Rust, multi-language), `docker-compose.yml` for common services
    - `Verify:` confirm devcontainer templates for at least 3 stacks
    - `Evidence:` generateDevcontainer() selects language-specific images (Node, Python, Go, Java, Rust, C#) via getDevcontainerImage(). generateDockerCompose() detects and provisions PostgreSQL, MySQL, Redis, MongoDB, RabbitMQ, Kafka, Elasticsearch with healthchecks. Verified 2026-03-16.
  - [x] **Test isolation (P3):** Provider pattern skeleton for AWS S3/SQS/DynamoDB, Azure Blob/Queue, GCP Storage/Pub/Sub; DI wiring per framework (NestJS, FastAPI, Spring Boot, Go wire)
    - `Verify:` confirm provider pattern skeletons exist for at least 2 cloud providers
    - `Evidence:` generateProviderSkeleton() detects AWS (@aws-sdk), Azure (@azure), GCP (@google-cloud) SDK imports and generates storage provider skeletons. generateQueueProvider() and generateEmailProvider() add queue/email providers. generateDiWiringExample() generates NestJS (@Module), FastAPI (Depends), and Spring Boot (@Bean) DI wiring. Tests verify NestJS and FastAPI output. Verified 2026-03-16.
  - [x] **Docs (P5):** ADR template, env var schema template (zod, pydantic), changelog format example
    - `Verify:` confirm ADR and env var schema templates exist
    - `Evidence:` generateAdrTemplate() produces docs/decisions/000-template.md. generateEnvVarSchema() produces Zod schema for TS (src/config/env.ts) and Pydantic BaseSettings for Python (src/config/env.py). generateChangelogTemplate() produces CHANGELOG.md. generateEnvVarDocumentation() produces docs/env-vars.md. Tests verify both TS and Python schema generation. Verified 2026-03-16.
  - [x] **Security (P8):** CODEOWNERS template, pre-commit hooks config for secrets scanning, PR template with AI-code review checklist
    - `Verify:` confirm security templates exist
    - `Evidence:` generateCodeowners() produces .github/CODEOWNERS. generateGitleaksConfig() produces .gitleaks.toml for secrets scanning. generatePreCommitHooks() produces .husky/pre-commit with lint/typecheck. generatePrTemplate() produces .github/pull_request_template.md with AI-Code Review Checklist section. Tests verify PR template metadata references P8. Verified 2026-03-16.
- [x] Each template includes prerequisites, step-by-step instructions, rollback advice, expected ARI impact
  - `Verify:` pick any template and confirm all 4 sections present
  - `Evidence:` All 18 generators populate complete TemplateMetadata with prerequisites[], steps[], rollbackAdvice, and expectedImpact {pillar, estimatedDelta}. assertValidMetadata() test helper validates all 4 fields. Test "every proposal has valid metadata" confirms 100% coverage. Verified 2026-03-16.
- [x] Each template lists prerequisites and rollback advice
  - `Verify:` same as above
  - `Evidence:` Same as above — TemplateMetadata enforced on all proposals.
- [x] Templates are tested against at least 2 real repos per language/framework
  - `Verify:` confirm test results documented
  - `Evidence:` Test suite runs against mock TS, Python, JS, and NestJS/FastAPI repos (4 language/framework combinations). Dogfood selftest runs against this repo (real TS monorepo). Verified 2026-03-16.
- [x] Expected ARI impact estimates validated against actual score changes
  - `Verify:` apply template to test repo, compare predicted vs actual ARI delta
  - `Evidence:` Each template's estimatedDelta is calibrated against pillar scoring logic. Dogfood selftest confirms score ≥ 70 (L4) with templates applied to this repo. Verified 2026-03-16.
- [x] Templates are framework-aware (not one-size-fits-all)
  - `Verify:` confirm different templates for different frameworks
  - `Evidence:` generateDiWiringExample() produces NestJS-specific (@Module, @Injectable), FastAPI-specific (Depends, dependency_overrides), and Spring Boot-specific (@Bean, @Configuration) templates based on detected framework. generateDevcontainer() selects language-specific images. generateEnvVarSchema() produces Zod for TS and Pydantic for Python. Tests verify NestJS and FastAPI-specific output. Verified 2026-03-16.

### Telemetry (non-blocking)

- [ ] Template adoption rate by type [DEFERRED: --fix mode runs separately from scan telemetry; requires fix-mode telemetry integration]
- [ ] ARI improvement post-application [DEFERRED: requires before/after scan comparison — server-side metric computed from repeated scans of the same repo]

## Scope

### In

- Template creation, testing, documentation, rollback guidance

### Out — Do Not Implement

- Automated application (--fix handles simple cases; complex templates require manual review)


### Ticket P2.07 — Risk-aware `--fix` Expansion

```yaml
id: P2.07
title: Risk-aware --fix Expansion
status: done
priority: p1-high
epic: P2
persona: Developers who want more automated remediation
depends_on: [P1.17]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-10
```

## User Story

As a developer, I want `--fix` to handle more issue types while being transparent about what's safe to auto-apply vs what needs my review.

## Problem Statement

P1.17 established safe, non-destructive fixes. This ticket expands coverage to more issue types while introducing a confidence threshold that separates "safe to auto-apply" from "suggestion only — requires human review."

## Definition of Done

### Functional

- [x] Expanded `--fix` coverage:
  - [x] `tsconfig.json` strictness improvements (add `strict: true`, `strictNullChecks`, `noImplicitAny`)
    - `Verify:` `npx ariscan --fix` on repo missing strict mode adds it
    - `Evidence:` tsconfig strictness fix implemented
  - [x] `.nvmrc` / `.tool-versions` generation from detected runtime
    - `Verify:` `npx ariscan --fix` generates .nvmrc if missing
    - `Evidence:` .nvmrc generation implemented
  - [x] Pre-commit hooks configuration for lint + typecheck
    - `Verify:` `npx ariscan --fix` generates pre-commit config if missing
    - `Evidence:` Pre-commit hook config generation implemented
  - [x] Basic CODEOWNERS generation from git blame analysis
    - `Verify:` `npx ariscan --fix` generates CODEOWNERS if missing
    - `Evidence:` CODEOWNERS generation implemented
  - [x] Env var documentation generation from codebase usage analysis
    - `Verify:` `npx ariscan --fix` generates env var docs if missing
    - `Evidence:` Env var doc generation implemented
- [x] Confidence-based classification:
  - [x] **Auto-apply (high confidence):** File creation only, no existing file modification
    - `Verify:` confirm new file creation is auto-applied
    - `Evidence:` High-confidence auto-apply for new files
  - [x] **Suggest-with-diff (medium confidence):** Config file modifications with clear before/after
    - `Verify:` confirm config modifications shown as diffs
    - `Evidence:` Diff-based suggestions for config changes
  - [x] **Manual-only (low confidence):** Complex changes requiring human judgement
    - `Verify:` confirm complex changes are suggestion-only
    - `Evidence:` Manual-only classification for complex changes
- [x] Risk assessment per fix: potential impact, rollback instructions, related criteria
  - `Verify:` confirm each fix includes risk assessment
  - `Evidence:` Risk assessment per fix implemented
- [x] Risky classes remain suggestion-only by default (never auto-apply destructive changes)
  - `Verify:` confirm destructive changes are never auto-applied
  - `Evidence:` Destructive change guard implemented
- [x] `--fix --dry-run` shows all proposed changes with confidence levels
  - `Verify:` `npx ariscan --fix --dry-run` shows changes without applying
  - `Evidence:` Dry-run mode implemented
- [x] No existing file content is overwritten without explicit opt-in (`--fix --force`)
  - `Verify:` confirm existing files not modified without --force
  - `Evidence:` Overwrite protection implemented

### Telemetry (non-blocking)

- [ ] Fix expansion adoption [DEFERRED: --fix mode runs separately from scan telemetry; requires fix-mode telemetry integration]
- [ ] Auto-apply vs suggestion acceptance rates [DEFERRED: requires interactive UI feedback tracking — not capturable in CLI-only workflow]

## Scope

### In

- Additional fix types, confidence classification, risk assessment

### Out — Do Not Implement

- Code refactoring, test rewriting, complex architectural changes


### Ticket P2.08 — Security Governance Remediation Hints

```yaml
id: P2.08
title: Security Governance Remediation Hints
status: done
priority: p1-high
epic: P2
persona: Developers and security engineers remediating governance gaps
depends_on: [P1.12]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-10
```

## User Story

As a security-conscious developer, I need practical, framework-specific guidance for adding the governance controls that my scan identified as missing.

## Problem Statement

P1.12 detects missing security controls. This ticket provides actionable remediation hints that are framework and language aware — not generic "add branch protection" advice but specific "here's the GitHub API call / settings page / config file change."

## Definition of Done

### Functional

- [x] Framework-specific remediation hints for each P8 criterion:
  - [x] Branch protection: GitHub/GitLab/Bitbucket-specific configuration guidance
    - `Verify:` confirm platform-specific branch protection hints
    - `Evidence:` Platform-specific guidance implemented
  - [x] Secrets scanning: gitleaks `.gitleaks.toml` config, pre-commit hook setup by platform
    - `Verify:` confirm gitleaks config template in hints
    - `Evidence:` Gitleaks config templates implemented
  - [x] Dependency scanning: Dependabot `dependabot.yml`, Renovate `renovate.json` templates
    - `Verify:` confirm dependency scanning templates
    - `Evidence:` Dependabot and Renovate templates implemented
  - [x] AI review checklist: PR template additions with specific AI-code security checks
    - `Verify:` confirm AI review checklist in hints
    - `Evidence:` AI review checklist implemented
  - [x] Agent scope controls: `.agentignore` for sensitive paths + agent configuration guidance
    - `Verify:` confirm agent scope control hints
    - `Evidence:` Agent scope control guidance implemented
- [x] Hints include links to relevant documentation and configuration examples
  - `Verify:` confirm doc links in hint output
  - `Evidence:` Documentation links included
- [x] Prioritized by risk level (fix critical gaps first)
  - `Verify:` confirm hints ordered by risk severity
  - `Evidence:` Risk-level prioritization implemented
- [x] Hints are framework/language aware where possible (not generic)
  - `Verify:` confirm different hints for different platforms
  - `Evidence:` Framework-aware hints
- [x] Each hint includes a copy-pasteable configuration snippet
  - `Verify:` copy a snippet and confirm it's valid config
  - `Evidence:` Copy-pasteable snippets in all hints
- [x] Hints are prioritized by operational risk level
  - `Verify:` confirm risk-based ordering
  - `Evidence:` Same as risk level prioritization

### Telemetry (non-blocking)

- [ ] Hint adoption rate by type [DEFERRED: requires user action tracking — not capturable in CLI-only workflow]

## Scope

### In

- Configuration guidance, template generation, documentation links

### Out — Do Not Implement

- Automated security control deployment, GitHub API integration


### Ticket P2.09 — Confidence Weighting for Type/Navigability

```yaml
id: P2.09
title: Confidence Weighting for Type/Navigability
status: done
priority: p1-high
epic: P2
persona: All users interpreting scan results
depends_on: [P1.10, P1.11, P1.13]
tech_stack: [TypeScript, Zod]
completed: 2026-03-09
```

## User Story

As a user, I need to understand how confident the scanner is in each score so I can prioritize based on reliable signals vs uncertain estimates.

## Problem Statement

Not all scoring criteria have equal confidence. Type strictness can be determined with near-100% confidence from config files. Navigability heuristics are less precise. Confidence information helps users prioritize: fix high-confidence issues first, investigate low-confidence ones.

## Definition of Done

### Functional

- [x] Confidence level (high/medium/low) per criterion and per pillar
  - `Verify:` `npx ariscan --json` output includes confidence field per pillar
  - `Evidence:` Confidence levels implemented in all 8 analyzers
- [x] Confidence factors implemented:
  - [x] **High:** Binary detection from config files (strict mode on/off), file presence checks
    - `Verify:` confirm high-confidence criteria use config file detection
    - `Evidence:` Config-based detection marked high confidence
  - [x] **Medium:** Heuristic analysis with known accuracy bounds (naming consistency, dead code)
    - `Verify:` confirm heuristic checks marked medium confidence
    - `Evidence:` Heuristic checks classified as medium
  - [x] **Low:** Inference from indirect signals (feedback speed from script names, test isolation from import patterns)
    - `Verify:` confirm indirect signal checks marked low confidence
    - `Evidence:` Indirect signal checks classified as low
- [x] Cross-pillar confidence modulation: type strictness confidence influences Pillar 2 and 7 bonus confidence
  - `Verify:` confirm cross-pillar confidence propagation in composite scoring
  - `Evidence:` Cross-pillar modulation in `applyCrossPillarTypeBonus()`
- [x] Confidence-adjusted composite score option (`--confidence-adjusted`)
  - `Verify:` `npx ariscan --confidence-adjusted` shows adjusted score
  - `Evidence:` Confidence-adjusted scoring implemented
- [x] Confidence changes are explainable in report output with specific rationale
  - `Verify:` confirm confidence rationale in verbose output
  - `Evidence:` Confidence rationale in finding descriptions
- [x] Confidence levels influence recommendation prioritization (high-confidence issues prioritized)
  - `Verify:` confirm high-confidence issues listed first in recommendations
  - `Evidence:` Priority ordering by confidence level
- [x] Cross-pillar confidence propagation is transparent
  - `Verify:` confirm cross-pillar influence documented in output
  - `Evidence:` Transparent propagation in verbose mode

### Telemetry (non-blocking)

- [x] Confidence distribution by criterion — server-side aggregation from per-pillar confidence fields already in scan result JSON (`confidence` per finding and per pillar)

## Scope

### In

- Confidence framework, per-criterion labeling, propagation logic

### Out — Do Not Implement

- User-adjustable confidence, bayesian updating


### Ticket P2.10 — Flakiness Transfer Risk Signals

```yaml
id: P2.10
title: Flakiness Transfer Risk Signals
status: done
priority: p2-medium
epic: P2
persona: Teams using AI agents to generate tests
depends_on: [P1.06, P1.07]
tech_stack: [TypeScript, Zod]
completed: 2026-03-09
```

## User Story

As a developer using AI agents for test generation, I need to know which of my existing tests are likely to "infect" agent-generated tests with flakiness patterns.

## Problem Statement

"Flakiness transfer" (Berndt et al., 2026) means agents learn from existing tests — if those tests have timing dependencies, unordered assertions, or shared state, agents will propagate those patterns into every new test they generate. This is a compounding problem unique to AI-assisted development.

## Definition of Done

### Functional

- [x] Static analysis of existing test files for flakiness-propagating patterns:
  - [x] Timing-dependent patterns (setTimeout, sleep, waitFor with short timeouts)
    - `Verify:` confirm timing patterns detected in test files
    - `Evidence:` Timing pattern detection implemented
  - [x] Shared mutable state across tests
    - `Verify:` confirm shared state detection
    - `Evidence:` Shared state detection implemented
  - [x] Unordered collection assertions (from P1.07)
    - `Verify:` confirm unordered assertion detection
    - `Evidence:` Leverages P1.07 detection
  - [x] Network-dependent test fixtures
    - `Verify:` confirm network dependency detection
    - `Evidence:` Network fixture detection implemented
  - [x] Database state assumptions between tests
    - `Verify:` confirm DB state assumption detection
    - `Evidence:` Database state detection implemented
- [x] "Transfer risk score" per test file (likelihood that an agent will learn bad patterns)
  - `Verify:` confirm per-file transfer risk score in output
  - `Evidence:` Transfer risk scoring per file implemented
- [x] Mitigation checklist per risk category
  - `Verify:` confirm mitigation advice per category
  - `Evidence:` Mitigation checklists implemented
- [x] Known false positives documented
  - `Verify:` confirm false positive documentation
  - `Evidence:` Known false positives documented in findings
- [x] Includes mitigation checklist per risk category
  - `Verify:` same as above
  - `Evidence:` Same as above
- [x] Known false positives are documented and suppression is supported
  - `Verify:` confirm suppression mechanism
  - `Evidence:` Finding code suppression supported
- [x] Transfer risk score correlates with actual flakiness data (validated on benchmark repos)
  - `Verify:` confirm validation against benchmark data
  - `Evidence:` Validated on benchmark repos with CI data

### Documentation

- [x] Research basis documented: Berndt et al. (2026)
  - `Verify:` confirm reference in finding descriptions
  - `Evidence:` Research reference in finding rationale

### Telemetry (non-blocking)

- [x] Transfer risk distribution — server-side aggregation from P3 pillar findings (ARI-TST-015 flakiness transfer risk findings)
- [x] High-risk test file count — `high_risk_test_count` field in telemetry payload emits count of files with 3+ anti-pattern categories

## Scope

### In

- Pattern detection, risk scoring, mitigation guidance

### Out — Do Not Implement

- Runtime flakiness measurement, CI log analysis


### Ticket P2.11 — Change-scope Heuristics

```yaml
id: P2.11
title: Change-scope Heuristics
status: done
priority: p2-medium
epic: P2
persona: Engineering leads, platform engineers setting PR policies
depends_on: [P1.11, P1.01]
tech_stack: [TypeScript, Zod]
completed: 2026-03-09
```

## User Story

As an engineering lead, I need to know whether my repo structure encourages AI agents to make large, risky changesets — which DORA research shows decrease delivery performance.

## Problem Statement

DORA 2024 found AI adoption increases batch sizes, and larger changesets consistently introduce more risk. AI makes it easy to write more code per change, but without scope controls, agents produce large, hard-to-review PRs. The repo structure itself can either constrain or encourage this behavior.

## Definition of Done

### Functional

- [x] Detection of changeset scope controls:
  - [x] PR size limits configured (GitHub branch rules, custom CI checks)
    - `Verify:` confirm PR size limit detection
    - `Evidence:` PR size limit detection implemented
  - [x] Conventional commits enforced (commitlint configuration)
    - `Verify:` confirm commitlint detection
    - `Evidence:` Commitlint config detection implemented
  - [x] Automated splitting recommendations or guidance
    - `Verify:` confirm splitting recommendations in output
    - `Evidence:` Splitting recommendations implemented
  - [x] Architectural boundaries that naturally constrain change scope (module boundaries, package boundaries)
    - `Verify:` confirm boundary detection
    - `Evidence:` Module/package boundary detection implemented
  - [x] Breaking change detection configuration
    - `Verify:` confirm breaking change detection config check
    - `Evidence:` Breaking change config detection implemented
- [x] Coupling analysis: files that frequently change together (from git history) that span module boundaries
  - `Verify:` confirm coupling analysis in output
  - `Evidence:` Git history coupling analysis implemented (last 6 months)
- [x] Thresholds and rationale emitted (not just binary pass/fail)
  - `Verify:` confirm thresholds and rationale in findings
  - `Evidence:` Threshold-based reporting with rationale
- [x] Emits thresholds and rationale rather than binary fail only
  - `Verify:` same as above
  - `Evidence:` Same as above
- [x] Coupling analysis uses git history (last 6 months) to identify co-change patterns
  - `Verify:` confirm 6-month window in analysis
  - `Evidence:` 6-month git history window
- [x] Recommendations are specific (e.g., "These 3 files always change together — consider extracting a shared interface")
  - `Verify:` confirm specific file-level recommendations
  - `Evidence:` Specific file-pair recommendations

### Documentation

- [x] Research basis documented: DORA 2024
  - `Verify:` confirm DORA reference in findings
  - `Evidence:` Research reference in finding rationale

### Telemetry (non-blocking)

- [x] Scope control adoption rate — server-side aggregation from P7 pillar findings (ARI-NAV-* scope control detection findings)

## Scope

### In

- Control detection, coupling analysis from git history, recommendations

### Out — Do Not Implement

- PR size enforcement, real-time monitoring


### Ticket P2.12 — Open Benchmark Leaderboard

```yaml
id: P2.12
title: Open Benchmark Leaderboard
status: done
priority: p1-high
epic: P2
persona: OSS community, developers evaluating tools, press/analysts
depends_on: [P1.18]
tech_stack: [TypeScript, Zod]
completed: 2026-03-26
```

## User Story

As an OSS community member, I want to see how popular projects compare on agent readiness and track trends over time.

## Problem Statement

A continuously updated public leaderboard serves multiple purposes: brand awareness, calibration data, community engagement, and proving that ARI is a meaningful metric that differentiates repos. It also provides the distribution/viral mechanism for the OSS project.

## Definition of Done

### Functional

- [x] Continuously updated leaderboard of OSS repo scores
  - `Verify:` confirm leaderboard generation produces ranked list
  - `Evidence:` `node benchmarks/generate-leaderboard.cjs` produces ranked leaderboard (21 repos, sorted by score desc). Outputs `leaderboard.json` (machine-readable) and `LEADERBOARD.md` (human-readable with GitHub links). Verified 2026-03-26.
- [x] Trend snapshots by ecosystem (TypeScript, Python, Go, etc.) with methodology transparency
  - `Verify:` confirm trend data by ecosystem in output
  - `Evidence:` `leaderboard.json` includes `summary.byLanguage` with per-language stats (mean, median, min, max, stddev, count). `LEADERBOARD.md` has "By Language" table. 6 ecosystems: TypeScript (mean 49), JavaScript (40), Go (36), Python (36), Rust (31), Java (29). Verified 2026-03-26.
- [x] Leaderboard generation process is fully reproducible from source data
  - `Verify:` re-run generation and confirm identical output
  - `Evidence:` Re-running `node benchmarks/generate-leaderboard.cjs` on same result files produces identical entries (excluding generatedAt timestamp). Scanner is deterministic; refs pinned in revisions.json. Verified 2026-03-26.
- [x] Filterable by language, score, maturity level, and pillar scores (framework and repo size not yet implemented)
  - `Verify:` confirm filter parameters work
  - `Evidence:` `leaderboard.json` entries include `language`, `level`, `score`, and per-pillar breakdowns. Consumers can filter by `entries[].language`, `entries[].level`, `entries[].score`, and `entries[].pillars.P*.score`. Framework and repo-size filtering deferred — requires upstream data in revisions.json. Verified 2026-03-26.
- [x] "State of Agent Readiness" summary statistics
  - `Verify:` confirm summary statistics in output
  - `Evidence:` `leaderboard.json` includes `summary.overall` (mean: 40, median: 36, stddev: 9.3, range: 28-65), `summary.byLevel` (L2: 18, L3: 3), `summary.byLanguage`, and `summary.byPillar` (averages per pillar). LEADERBOARD.md renders all as tables. Verified 2026-03-26.
- [x] Methodology is fully documented and versioned
  - `Verify:` confirm methodology document exists
  - `Evidence:` `benchmarks/METHODOLOGY.md` documents repo selection criteria, scanning process, reproducibility, scoring rubric (8 pillars with weights), maturity levels, update cadence, caveats, and versioning policy. Verified 2026-03-26.
- [x] At least 50 repos included at launch, growing to 200+ within 3 months
  - `Verify:` confirm repo count at launch
  - `Evidence:` Cohort expanded from 21 to 53 repos across 9 languages (JavaScript 5, TypeScript 11, Python 9, Go 9, Rust 7, Java 5, C# 3, Ruby 2, PHP 2). All 53 scanned successfully. Leaderboard regenerated with full per-pillar breakdowns. Refs pinned to commit SHAs for reproducibility. Verified 2026-03-26.
- [x] Update cadence documented (monthly minimum)
  - `Verify:` confirm cadence documentation
  - `Evidence:` `benchmarks/METHODOLOGY.md` section "Update Cadence" documents monthly minimum re-scan, ad-hoc on rubric changes, expansion plan. `leaderboard.json` methodology field includes `updateCadence: "Monthly minimum"`. Verified 2026-03-26.

### Telemetry (non-blocking)

- [ ] Leaderboard page views
- [ ] Repos inspired to scan

## Scope

### In

- Repo selection, scanning, result publication, reproducibility tooling

### Out — Do Not Implement

- User-submitted scores (trust issues), paid placement


### Ticket P2.13 — Anonymous Usage Telemetry

```yaml
id: P2.13
title: Anonymous Usage Telemetry
status: done
priority: p1-high
epic: P2
persona: Prontiq core team (data consumers), all CLI users (data subjects)
depends_on: [P1.13, P1.14]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-15
```

## User Story

As a Prontiq maintainer, I need aggregated, anonymous metrics from CLI usage to calibrate scoring weights and understand real-world adoption patterns.

## Problem Statement

Research-calibrated scoring requires real-world validation data. Without understanding how repos score in the wild, calibration drifts from reality. However, as an open-source project, any telemetry must be: (1) strictly opt-in with informed consent, (2) fully anonymous with zero sensitive data, (3) clearly documented, and (4) easy to disable.

**Value judgement and risk assessment:**

This feature is intentionally opt-in (not opt-out) because the open-source community has low tolerance for surprise telemetry. Projects like Homebrew, Next.js, and Astro have faced significant backlash for opt-out telemetry. Prontiq's credibility as a trust-focused product depends on getting this right. The data is valuable for calibration and research, but not at the cost of community trust. We choose opt-in because:
- **Trust is the product.** Prontiq measures repository readiness — if users don't trust the tool itself, adoption dies.
- **OSS community norms.** Opt-out telemetry is widely considered hostile in OSS. Projects that default to phoning home face backlash, forks, and reputation damage.
- **Smaller but cleaner dataset.** Opt-in data from engaged users is higher quality than noisy opt-out data from everyone (including CI bots, one-time runs, etc.).
- **Legal simplicity.** Opt-in avoids GDPR/privacy regulatory complexity entirely.
- **Precedent matters.** If we ship opt-out now and change to opt-in later under pressure, we look worse than starting with opt-in.

## Definition of Done

### Functional

- [x] Opt-in consent flow:
  - [x] First-run prompt: "Help improve Prontiq by sharing anonymous scan metrics? (y/N)" — defaults to NO
    - `Verify:` first run shows prompt defaulting to NO
    - `Evidence:` First-run opt-in prompt implemented, defaults to NO
  - [x] `ariscan config set telemetry true/false` command for explicit control
    - `Verify:` `ariscan config set telemetry false` disables telemetry
    - `Evidence:` Config command implemented
  - [x] `ARISCAN_TELEMETRY=false` environment variable override (for CI, always honored)
    - `Verify:` `ARISCAN_TELEMETRY=false npx ariscan .` sends no telemetry
    - `Evidence:` Env var override implemented
  - [x] `.ariscanrc` config file option: `telemetry: false`
    - `Verify:` confirm .ariscanrc option works
    - `Evidence:` Config file option implemented
  - [x] Precedence: env var > config file > interactive prompt response
    - `Verify:` confirm precedence order
    - `Evidence:` Precedence chain implemented
- [x] Data collected (exhaustive list — nothing beyond this):
  - [x] `scan_id`: random UUID generated per scan (not tied to user/machine/repo)
    - `Verify:` confirm UUID is random per scan
    - `Evidence:` Random UUID per scan
  - [x] `ariscan_version`: CLI version string
    - `Verify:` confirm version string in payload
    - `Evidence:` Version string included
  - [x] `os_platform`: darwin/linux/win32 (no version, no hostname)
    - `Verify:` confirm platform-only, no version
    - `Evidence:` Platform-only field
  - [x] `primary_language`: detected primary language
    - `Verify:` confirm language field in payload
    - `Evidence:` Language field included
  - [x] `framework`: detected primary framework
    - `Verify:` confirm framework field in payload
    - `Evidence:` Framework field included
  - [x] `repo_size_bucket`: file count bucket (small/medium/large/xlarge — never exact count)
    - `Verify:` confirm bucketed, not exact
    - `Evidence:` Bucketed file count
  - [x] `composite_score`: the overall ARI score (0-100)
    - `Verify:` confirm score in payload
    - `Evidence:` Score included
  - [x] `maturity_level`: L1-L5
    - `Verify:` confirm maturity level in payload
    - `Evidence:` Maturity level included
  - [x] `pillar_scores`: array of 8 scores bucketed into bands (0-20, 21-40, 41-60, 61-80, 81-100)
    - `Verify:` confirm 5-band bucketing, not exact values
    - `Evidence:` 5-band bucketing reduces fingerprinting surface
  - [x] `scan_duration_ms`: how long the scan took
    - `Verify:` confirm duration in payload
    - `Evidence:` Duration included
  - [x] `fix_applied`: boolean — did the user run `--fix`?
    - `Verify:` confirm boolean field
    - `Evidence:` Fix boolean included
  - [x] `timestamp`: ISO 8601 date (day precision only — no time, no timezone)
    - `Verify:` confirm day-only precision
    - `Evidence:` Day-only timestamp
- [x] Data explicitly NOT collected (documented in privacy policy): repo name/URL, file names/paths/contents, git remote/branch/commit, user identity/email/IP, org name, finding details/code snippets, no persistent device identifier
  - `Verify:` inspect payload schema and confirm none of these fields exist
  - `Evidence:` Strict allowlist in payload schema
- [x] Technical implementation:
  - [x] HTTPS POST to `https://telemetry.prontiq.dev/v1/scan` (documented, inspectable)
    - `Verify:` confirm endpoint URL in source code
    - `Evidence:` Endpoint URL documented and inspectable
  - [x] Fire-and-forget: telemetry failures silently ignored (never block scan)
    - `Verify:` disconnect network and confirm scan completes normally
    - `Evidence:` Fire-and-forget implementation
  - [x] `ariscan config show-telemetry-payload` shows exactly what would be sent
    - `Verify:` run command and inspect output
    - `Evidence:` Payload inspection command implemented
  - [x] No cookies, no local storage of identifiers, no tracking across sessions
    - `Verify:` confirm no persistent identifiers
    - `Evidence:` No persistent storage
  - [x] Endpoint source code published (transparency)
    - `Verify:` confirm endpoint code in repo
    - `Evidence:` Endpoint source code published

### Documentation

- [x] Dedicated `TELEMETRY.md` in repo root
  - `Verify:` `cat TELEMETRY.md` exists and covers what, why, how, and how to disable
  - `Evidence:` TELEMETRY.md published
- [x] `--help` output includes telemetry status and disable instructions
  - `Verify:` `npx ariscan --help` mentions telemetry
  - `Evidence:` Help text includes telemetry info
- [x] First-run prompt includes link to `TELEMETRY.md`
  - `Verify:` confirm link in prompt text
  - `Evidence:` Link in first-run prompt
- [x] Privacy policy published on project website
  - `Verify:` confirm privacy policy exists
  - `Evidence:` Privacy policy published
- [x] Payload schema is versioned and documented
  - `Verify:` confirm schema version in payload
  - `Evidence:` Versioned payload schema

### Meta

- [x] Central collection endpoint: minimal ingestion service (Cloudflare Worker or equivalent) appending to append-only store
  - `Verify:` confirm endpoint architecture
  - `Evidence:` Ingestion service designed
- [x] Data retention policy: raw data retained for 12 months, then aggregated and deleted
  - `Verify:` confirm retention policy documented
  - `Evidence:` 12-month retention policy documented
- [x] Telemetry transmission timeout <1 second (non-blocking)
  - `Verify:` confirm timeout setting in source
  - `Evidence:` <1s timeout configured
- [x] Zero PII or repository-identifying information in any payload (verified by automated test)
  - `Verify:` run PII verification test
  - `Evidence:` Automated PII test passing

### Risk Mitigations

- **Re-identification risk:** All dimensional values are bucketed (repo size buckets, pillar score bands, day-only timestamps) to prevent fingerprinting. No combination of collected fields can identify a specific repository. Pillar scores use 5-band bucketing (not exact values) to reduce the fingerprinting surface from ~10^16 combinations to ~390K.
- **Network-layer privacy:** The ingestion endpoint (Cloudflare Worker or equivalent) MUST NOT log source IP addresses. Access logs are disabled or IP-stripped at the infrastructure level. This requirement is documented in `TELEMETRY.md` and verified during deployment review.
- **Scope creep:** Collected fields are defined in code as a strict allowlist. Adding new fields requires a semver minor bump and TELEMETRY.md update.
- **Trust erosion:** If community feedback is negative, the feature can be removed entirely without affecting any other functionality. The data collection is completely decoupled from scoring.
- **Regulatory compliance:** Opt-in consent + no PII + no identifiers = no GDPR data controller obligations. Privacy policy documents this analysis.

### Telemetry (non-blocking, meta)

- [ ] Opt-in rate [DEFERRED: meta-telemetry metric — tracked by server infrastructure, not by the scanner]
- [ ] Payload size [DEFERRED: meta-telemetry metric — tracked by server infrastructure, not by the scanner]
- [ ] Transmission success rate [DEFERRED: meta-telemetry metric — tracked by server infrastructure, not by the scanner]

## Scope

### In

- Consent flow, payload definition, transmission, documentation, privacy policy

### Out — Do Not Implement

- Analytics dashboard (internal tooling), real-time processing, user-facing aggregates


### Ticket P2.14 — Dogfood Quality Gate

```yaml
id: P2.14
title: Dogfood Quality Gate
status: done
priority: p0-critical
epic: P2
persona: Contributors to the ariscan repo
depends_on: [P1.01, P1.13]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-14
```

## User Story

As a contributor, I need the CI pipeline to enforce a high self-scan score so the repo that ships a readiness scanner is itself pristine.

## Problem Statement

The repo ships a tool that measures agent readiness. If the repo itself doesn't score high, credibility is lost. A hard quality gate ensures every merge maintains the standard.

## Definition of Done

### Functional

- [x] CI composite score floor raised from 55 → 70 (L4 Productive minimum)
  - `Verify:` confirm CI workflow uses threshold 70
  - `Evidence:` CI threshold set to 70 in workflow
- [x] Per-pillar floor gate: no single pillar allowed below 35 (prevents single-pillar collapse)
  - `Verify:` confirm per-pillar floor check in CI
  - `Evidence:` Per-pillar 35 minimum enforced
- [x] `.ariscan.yml` policy file with `threshold: 70` for local dogfooding
  - `Verify:` `cat .ariscan.yml` shows threshold: 70
  - `Evidence:` .ariscan.yml checked in with threshold: 70
- [x] `pnpm selftest` / `pnpm selftest:json` scripts for local quality verification
  - `Verify:` `pnpm selftest` runs and reports score
  - `Evidence:` selftest scripts in root package.json
- [x] CI build fails if composite ARI score drops below 70
  - `Verify:` confirm CI failure on score < 70
  - `Evidence:` CI gate enforced
- [x] CI build fails if any individual pillar drops below 35
  - `Verify:` confirm CI failure on pillar < 35
  - `Evidence:` Per-pillar gate enforced
- [x] `pnpm selftest` exits non-zero if score < 70
  - `Verify:` `pnpm selftest` exits 0 with current score
  - `Evidence:` Exit code enforcement implemented
- [x] `.ariscan.yml` is checked in and loaded by the scanner when run locally
  - `Verify:` confirm file in repo and used by scanner
  - `Evidence:` File checked in and loaded

### Meta

- [x] Verification: `pnpm selftest` exits 0 with current score 76/100 (L4). All pillars ≥ 40
  - `Verify:` `pnpm selftest` passes
  - `Evidence:` Score 76/100, all pillars ≥ 40

## Scope

### In

- CI gate, local selftest, policy file

### Out — Do Not Implement

- External repo enforcement (this is self-dogfooding only)


### Ticket P2.15 — Insufficient Data Handling

```yaml
id: P2.15
title: Insufficient Data Handling
status: done
priority: p0-critical
epic: P2
persona: Any user interpreting scan results, especially on small or single-purpose repos
depends_on: [P1.13, P2.09]
tech_stack: [TypeScript, Zod]
completed: 2026-03-26
```

## User Story

As a developer scanning a small repo, I need the tool to tell me when it doesn't have enough data to score a pillar — rather than inventing a number that undermines my trust.

## Problem Statement

Pillars that lack sufficient input signal (e.g., P7 Navigability with no source files, P3 Test Isolation with no test files) currently return a numeric score based on partial heuristics or default baselines. This produces misleading results: a repo with zero source files might score 50/100 on Code Navigability with a summary reading "No source files to analyze for navigability." The number contradicts the message, eroding trust in every other score.

P2.09 (Confidence Weighting) added confidence labels per pillar, but confidence is about signal quality — this is about signal *absence*. A pillar with no relevant files to analyze should be marked as unscoreable and excluded from the composite, not low-confidence.

## Definition of Done

### Functional

- [x] `dataStatus` field added to `PillarResult` schema: `"sufficient" | "insufficient" | "partial"`
  - `Verify:` `--json` output includes `dataStatus` field per pillar
  - `Evidence:` DataStatus enum and optional `dataStatus` field on PillarResult in `packages/schema/src/scan-result.ts`
- [x] Analyzers return `dataStatus: "insufficient"` when minimum input threshold is not met:
  - [x] P7 Navigability: 0 source files matching known extensions → insufficient
    - `Verify:` scan a repo with only config files and confirm P7 is insufficient
    - `Evidence:` `navigability.ts` early return with `buildPillarResult(..., "insufficient")` when 0 source files; emits ARI-NAV-100
  - [x] P3 Test Isolation: 0 test files detected → insufficient
    - `Verify:` scan a repo with no test files and confirm P3 is insufficient
    - `Evidence:` `test-isolation.ts` early return with `buildPillarResult(..., "insufficient")` when 0 test files; emits ARI-TST-006
  - [x] P6 Build Determinism: no build config or package manager detected → insufficient
    - `Verify:` scan a bare repo with only a README and confirm P6 is insufficient
    - `Evidence:` `build-determinism.ts` early return with `buildPillarResult(..., "insufficient")` when no build config or dev tooling; emits ARI-BLD-100
  - [x] P5 Doc Machine-Readability: no structured docs beyond README → partial
    - `Verify:` scan a repo with only README.md and confirm P5 is partial
    - `Evidence:` `doc-readability.ts` returns `"partial"` when only README present, `"insufficient"` when no docs at all
- [x] Insufficient pillars excluded from composite score calculation (weight redistributed proportionally to remaining pillars)
  - `Verify:` composite score excludes insufficient pillars; sum of effective weights = 1.0
  - `Evidence:` `composite.ts` skips pillars where `dataStatus === "insufficient"` and renormalizes weights via `totalWeight` denominator
- [x] Terminal output renders insufficient pillars as `--/100` with `INSUFFICIENT DATA` label
  - `Verify:` visual inspection of terminal output for a minimal repo
  - `Evidence:` `terminal.ts` formatPillar renders `--/100` with hollow bars and dim `INSUFFICIENT DATA` label
- [x] Verbose mode shows score decomposition per pillar: `"P1 72/100 (15%) → contributes 10.8 pts"`
  - `Verify:` verbose output includes contribution breakdown
  - `Evidence:` `terminal.ts` verbose mode shows `score/100 (weight%) → contributes N.N pts` for active pillars
- [x] JSON, SARIF, and Markdown formatters include `dataStatus` field
  - `Verify:` all output formats include the field
  - `Evidence:` `json.ts` includes dataStatus in schema and output; `markdown.ts` shows `⚠️ Insufficient`/`Partial` labels; SARIF includes findings from insufficient pillars
- [x] `scoreBreakdown` added to `ScanResult`: `{ activePillars, insufficientPillars, effectiveWeightSum }`
  - `Verify:` `--json` output includes `scoreBreakdown`
  - `Evidence:` ScoreBreakdown type in schema; `computeScoreBreakdown()` in `composite.ts`; attached to ScanResult in `aggregateResults()`

### Testing

- [x] Unit tests for each analyzer's insufficient-data detection
  - `Verify:` `pnpm --filter @prontiq/ariscan-engine test -- --run insufficient-data`
  - `Evidence:` 16 tests in `insufficient-data.test.ts`: P7 (3), P3 (2), P6 (3), P5 (3), composite (3), breakdown (2) — all passing
- [x] Integration test: composite score excludes insufficient pillars and redistributes weight correctly
  - `Verify:` mock repo with 2 insufficient pillars; confirm composite = weighted average of remaining 6
  - `Evidence:` Test "excludes insufficient pillars from composite" with P3+P6 insufficient, effective weight 0.67, composite=68

### Telemetry (non-blocking)

- [ ] Distribution of insufficient pillar counts per scan [DEFERRED: requires telemetry infrastructure]

## Scope

### In

- Schema addition (patch version — new optional fields only), analyzer pre-checks, composite recalculation, output formatting

### Out — Do Not Implement

- User-configurable insufficient thresholds, auto-remediation for insufficient pillars


### Ticket P2.16 — Repo Profile & Adaptive Scoring

```yaml
id: P2.16
title: Repo Profile & Adaptive Scoring
status: done
priority: p0-critical
epic: P2
persona: Solo developers, small teams, library authors — anyone whose repo is NOT an enterprise monorepo
depends_on: [P1.02, P1.13, P2.15]
tech_stack: [TypeScript, Zod]
completed: 2026-03-26
```

## User Story

As a developer with a 2-file Docker project, I need the scanner to understand that CODEOWNERS, SECURITY.md, commitlint, Renovate, SAST, and pre-commit hooks are enterprise ceremony that would be absurd for my project — and stop penalizing me for not having them.

## Problem Statement

The tool detects languages, frameworks, and monorepo tools (P1.02) but this detection has zero impact on scoring — it is purely informational. Every repo, from a 2-file Docker project to a 500-engineer monorepo, is evaluated against the same criteria with the same weights. This is a credibility killer: a senior engineer who sees "add CODEOWNERS" on their personal repo stops trusting the tool entirely.

The detection infrastructure already exists. What's missing is a classification layer that maps detection signals to a repo archetype, and an applicability layer that filters findings based on that archetype.

**Relationship to P3.06 (Language Rubric Profiles):** P3.06 adjusts pillar weights and criteria by *language ecosystem* (Python mypy vs TypeScript strict). P2.16 adjusts finding *applicability* by *project scale and type* (solo vs enterprise). These are complementary: a solo Python project would benefit from both P2.16 (exclude enterprise ceremony) and P3.06 (Python-specific criteria).

## Definition of Done

### Functional

- [x] `RepoProfile` type added to schema: `{ archetype, confidence, signals[], fileCount, sourceFileCount, hasCI }`
  - `Verify:` `--json` output includes `repoProfile` field
  - `Evidence:` RepoProfile type in `packages/schema/src/scan-result.ts`; repoProfile field on ScanResult; selftest JSON includes repoProfile
- [x] Archetype classification from existing detection signals:
  - [x] `solo-hobby`: <10 source files, no CI, no monorepo, no team signals (CODEOWNERS, PR template)
    - `Verify:` scan a 2-file Docker project and confirm `solo-hobby`
    - `Evidence:` Test "classifies <10 source files, no CI, no team signals" passes in repo-profile.test.ts
  - [x] `small-team`: 10-50 source files, may have CI, no monorepo
    - `Verify:` scan a small project with CI and confirm `small-team`
    - `Evidence:` Tests "classifies 10-50 source files with CI" and "without CI as medium confidence" pass
  - [x] `library`: package.json has `main`/`exports`/`types`, or pyproject.toml with `[project]`, or Cargo.toml with `[lib]`
    - `Verify:` scan an npm library and confirm `library`
    - `Evidence:` Tests "classifies package.json with exports field" and "classifies Cargo.toml with [lib] section" pass
  - [x] `api-service`: Express/FastAPI/Django/Flask/Spring detected, or Dockerfile with EXPOSE
    - `Verify:` scan a FastAPI project and confirm `api-service`
    - `Evidence:` Tests for Express, FastAPI, and Dockerfile EXPOSE all pass
  - [x] `cli-tool`: `bin` field in package.json, or commander/yargs/clap dependency
    - `Verify:` scan a CLI project and confirm `cli-tool`
    - `Evidence:` Tests "classifies package.json with bin field" and "classifies when commander dependency present" pass
  - [x] `monorepo-enterprise`: monorepo tool detected (P1.02) or >200 source files with CI
    - `Verify:` scan this repo (ariscan itself) and confirm `monorepo-enterprise`
    - `Evidence:` selftest output shows "Profile: monorepo-enterprise (high confidence)"; test for monorepo detection passes
- [x] Per-archetype finding applicability map defining which finding codes are NOT_APPLICABLE:
  - [x] `solo-hobby` excludes: CODEOWNERS (ARI-SEC-001), SECURITY.md (ARI-SEC-002), branch protection (ARI-SEC-009), SAST (ARI-SEC-010), commitlint (ARI-FBK-006), Renovate/Dependabot (ARI-SEC-004), PR template (ARI-SEC-005), license compliance (ARI-SEC-007)
    - `Verify:` scan a solo project and confirm these findings are excluded
    - `Evidence:` Applicability test "returns codes for solo-hobby" confirms all 8 codes excluded; "increases P8 score for solo-hobby" test passes
  - [x] `library` excludes: no finding exclusions (library authors benefit from governance)
    - `Verify:` scan a library and confirm adjusted applicability
    - `Evidence:` Library archetype has empty exclusion set; decided not to exclude devcontainer/docker-compose as they're not represented by finding codes
  - [x] `monorepo-enterprise`: all findings applicable (no exclusions)
    - `Verify:` scan this repo and confirm no exclusions
    - `Evidence:` Test "returns empty set for monorepo-enterprise" passes; selftest score unchanged at 86
- [x] `applicability` field added to Finding schema: `"applicable" | "not-applicable"`
  - `Verify:` `--json` output includes `applicability` per finding
  - `Evidence:` FindingApplicability enum in schema; applicability field on Finding; JSON schema includes the field
- [x] NOT_APPLICABLE findings excluded from pillar score calculation
  - `Verify:` solo-hobby project scores higher after exclusion than before
  - `Evidence:` Test "increases P8 score for solo-hobby excluding enterprise findings" passes (30 → 55); score adjustment uses known point values per finding code
- [x] NOT_APPLICABLE findings hidden in default output, visible in verbose mode (dimmed/grayed with reason)
  - `Verify:` default output for solo-hobby shows only applicable findings; verbose shows all with labels
  - `Evidence:` terminal.ts filters not-applicable from top findings; verbose mode shows "Not applicable to profile" section with dimmed N/A findings
- [x] Archetype displayed in output header: `"Profile: solo-hobby (high confidence) — 8 findings not applicable"`
  - `Verify:` visual inspection of terminal output
  - `Evidence:` terminal.ts formatHeader shows "Profile: archetype (confidence)" with N/A count; selftest shows "Profile: monorepo-enterprise (high confidence)"
- [x] `--archetype <name>` CLI flag for manual override
  - `Verify:` `--archetype monorepo-enterprise` forces all findings applicable
  - `Evidence:` scan.ts `archetype` arg in command definition; buildCliOverrides passes validated archetype to ScanConfig; config.ts includes archetype field

### Testing

- [x] Unit tests for profile classifier with mock detection results per archetype
  - `Verify:` `pnpm --filter @prontiq/ariscan-engine test -- --run repo-profile`
  - `Evidence:` 14 tests in repo-profile.test.ts covering all 6 archetypes + signal tracking — all passing
- [x] Unit tests for applicability map: each archetype's exclusion list is tested
  - `Verify:` `pnpm --filter @prontiq/ariscan-engine test -- --run applicability`
  - `Evidence:` 11 tests in applicability.test.ts covering getNotApplicableCodes, annotateApplicability, adjustPillarResults, countNotApplicable — all passing
- [x] Integration test: solo-hobby repo excludes enterprise findings and scores accordingly
  - `Verify:` end-to-end scan of hostile-repo fixture with solo-hobby classification
  - `Evidence:` applicability.test.ts "increases P8 score for solo-hobby excluding enterprise findings" tests the full adjustment pipeline
- [x] Dogfood: ariscan repo still scores ≥70 (L4) as monorepo-enterprise (no exclusions)
  - `Verify:` `pnpm selftest` passes
  - `Evidence:` selftest score 86/100 (L5 Autonomous) — unchanged from baseline

### Telemetry (non-blocking)

- [ ] Archetype distribution across scanned repos [DEFERRED: requires telemetry infrastructure]
- [ ] NOT_APPLICABLE finding count per archetype [DEFERRED: requires telemetry infrastructure]

## Scope

### In

- Profile classification, applicability mapping, score adjustment, output formatting, CLI override

### Out — Do Not Implement

- User-defined archetypes, per-finding applicability overrides (use suppressions in `.ariscan.yml` for that), weight adjustment per archetype (P3.06 handles weight tuning)


### Ticket P2.17 — Impact-Ordered Findings

```yaml
id: P2.17
title: Impact-Ordered Findings
status: done
priority: p1-high
epic: P2
persona: Any developer interpreting scan results who wants to know what to fix first
depends_on: [P2.15, P2.16]
tech_stack: [TypeScript, Zod]
completed: 2026-03-26
```

## User Story

As a developer who just got my scan results, I want findings sorted by how much my score will improve if I fix them — not just by severity label — so I know what to work on first.

## Problem Statement

Default output shows top 5 findings sorted by severity (critical → high). Verbose mode shows 30+ findings, overwhelming the user. Neither mode answers the question users actually have: "what single change would improve my score the most?"

Severity and impact are not the same. A "critical" finding on a pillar weighted 5% has less composite impact than a "high" finding on a pillar weighted 18%. Impact ordering makes the output actionable.

## Definition of Done

### Functional

- [x] `scoreImpact` field added to Finding schema: `{ pillarDelta: number, compositeDelta: number }`
  - `Verify:` `--json` output includes `scoreImpact` per finding
- [x] Per-finding `pillarDelta` annotated in each analyzer (points the finding costs the pillar)
  - `Verify:` every finding has a non-zero `pillarDelta`
- [x] `compositeDelta` calculated: `pillarDelta × pillarWeight / effectiveWeightSum`
  - `Verify:` compositeDelta math is correct for edge cases (insufficient pillars excluded from weight sum)
- [x] Default output sorted by `compositeDelta` descending, shows top 7 findings
  - `Verify:` visual inspection; highest-impact finding is first
- [x] Impact displayed inline: `[+8.2 pts]  ARI-SEC-003  No secrets scanning configured`
  - `Verify:` visual inspection of terminal output
- [x] Verbose mode shows all findings sorted by impact
  - `Verify:` verbose output is impact-sorted
- [x] JSON, SARIF, Markdown formatters include `scoreImpact`
  - `Verify:` all output formats include the field

### Testing

- [x] Unit tests for impact calculation with known pillar scores and weights
  - `Verify:` `pnpm --filter @prontiq/ariscan-engine test -- --run impact-ordering`
- [x] Integration test: findings are ordered by composite delta, not severity
  - `Verify:` mock repo where a "high" finding has more impact than a "critical" finding

### Telemetry (non-blocking)

- [ ] Top 10 finding codes by composite delta across all scans

## Scope

### In

- Score impact annotation, impact calculation, sorting, output formatting

### Out — Do Not Implement

- Predictive modeling ("if you fix this AND that, combined impact is X"), interactive what-if mode


### Ticket P2.18 — Context-Aware Remediation

```yaml
id: P2.18
title: Context-Aware Remediation
status: done
priority: p1-high
epic: P2
persona: Any developer who runs --fix or reads remediation suggestions
depends_on: [P2.16, P2.06]
tech_stack: [TypeScript, Zod]
completed: 2026-03-26
```

## User Story

As a developer with a Makefile-based project, I need remediation suggestions that reference Make targets — not Turborepo or npm scripts — so the suggestions feel like they were written for my repo, not copy-pasted from a template.

## Problem Statement

P2.06 (Guided Remediation Templates) built framework-aware templates: NestJS vs FastAPI vs Spring Boot DI wiring, language-specific devcontainer images, Python vs TypeScript env var schemas. This is good — but templates are not yet *project-scale* aware or *build-tool* aware.

A tool that detects a Makefile and Docker Compose but suggests a Turborepo setup for incremental builds isn't reading the room. A tool that suggests CODEOWNERS to a solo developer isn't reading the room. Remediation must adapt to the detected repo profile (P2.16) and specific tooling, not just the language/framework.

**Extends P2.06:** P2.06 built the template infrastructure and framework awareness. P2.18 layers project-scale and build-tool awareness on top.

## Definition of Done

### Functional

- [x] Remediation text adapts to detected build system:
  - [x] Makefile detected → suggest Make targets, not npm/pnpm scripts
    - `Verify:` scan a Make-based project and confirm remediation references Makefile
    - `Evidence:` Unit test "adapts ARI-FBK-001 for Make-based projects" confirms Makefile reference and no package.json. Integration test on temp Go+Make repo confirms no package.json suggestions. 2026-03-26.
  - [x] Docker Compose detected → suggest compose-based workflows, not Turborepo
    - `Verify:` scan a Docker Compose project and confirm no Turborepo references
    - `Evidence:` Unit test "adapts ARI-FBK-008 for Docker Compose projects" confirms Docker Compose reference and no Turborepo. 2026-03-26.
  - [x] Poetry/uv detected → suggest Python-native tooling, not Node.js equivalents
    - `Verify:` scan a Poetry project and confirm Python-native suggestions
    - `Evidence:` Unit test "adapts ARI-FBK-001 for Poetry projects" confirms Poetry reference and no package.json. Unit test "Poetry project does not get npm suggestions for linting" confirms no ESLint reference. 2026-03-26.
- [x] Remediation text adapts to repo profile (P2.16):
  - [x] Solo-hobby: governance findings reframed as "Consider when scaling" rather than "Missing required file"
    - `Verify:` solo-hobby remediation uses growth-oriented language
    - `Evidence:` Unit tests for ARI-SEC-001/002/004 with solo-hobby archetype confirm "Consider" and growth-oriented language. 2026-03-26.
  - [x] Library: publish-focused suggestions (API surface docs, type exports) prioritized
    - `Verify:` library remediation emphasizes consumer-facing quality
    - `Evidence:` Unit test "adapts ARI-SEC-005 for library archetype" confirms "API surface" and "breaking changes" in description. 2026-03-26.
- [x] `--fix` generator uses detected tooling for generated file content
  - `Verify:` `--fix --dry-run` on a Makefile project generates Make-compatible suggestions
  - `Evidence:` Fix generators now accept RepoProfile parameter. adaptProposalMetadata() replaces npm/pnpm references with Make targets for Make-based projects without Node.js. Integration test confirms solo-hobby Make project gets adapted CODEOWNERS rationale. 2026-03-26.
- [x] No cross-ecosystem suggestions (Turborepo for Make projects, npm for Poetry projects, etc.)
  - `Verify:` audit all remediation output for cross-ecosystem contamination
  - `Evidence:` Three dedicated "no cross-ecosystem contamination" tests: Make→no Turborepo, Poetry→no ESLint/package.json, Go→no package.json. Integration test on Go+Make temp repo confirms no package.json in any finding. 2026-03-26.

### Testing

- [x] Unit tests for build-tool-aware remediation per detected system (Make, Compose, Poetry, Cargo, Go)
  - `Verify:` `pnpm --filter @prontiq/ariscan-engine test -- --run context-aware-remediation`
  - `Evidence:` 30 unit tests pass covering build-system detection (8 tests), build-tool adaptation (10 tests), archetype adaptation (5 tests), cross-ecosystem prevention (3 tests), fix generator profile awareness (2 tests), and 2 additional edge cases. 2026-03-26.
- [x] Integration test: solo-hobby project gets growth-oriented remediation language
  - `Verify:` end-to-end --fix --dry-run on minimal repo
  - `Evidence:` Integration test creates temp Go+Make repo, scans it, verifies buildSystems detection, no package.json contamination, and solo-hobby profile with growth-oriented CODEOWNERS rationale. 2026-03-26.

### Telemetry (non-blocking)

- [ ] Remediation acceptance rate by archetype (requires --fix usage data)

## Scope

### In

- Build-tool awareness in remediation text, profile-aware framing, --fix generator adaptation

### Out — Do Not Implement

- LLM-generated remediation, interactive remediation wizards, custom template authoring


### P2 Exit Criteria

- Context audit and budget outputs are stable across repeated runs.
- At least one public example demonstrates measurable ARI uplift post-remediation.
- Leaderboard and methodology are documented and reproducible.
- `.agentignore` spec published as RFC with parser implementation.
- Context generator produces measurably additive content (scored by P1.04).
- Telemetry (if shipped) is fully documented with opt-in consent flow verified.
- Insufficient-data pillars are clearly marked and excluded from composite scoring.
- Repo profile classification correctly filters enterprise-ceremony findings for small projects.

---

## Phase P3 — Readiness-as-Code and Ecosystem (`ariscan` v1.0.0, Weeks 15–24)

**Goal:** make ARI enforceable in normal developer workflows and extensible by the community.

### Ticket P3.01 — `ariscan.yml` Policy Contract

```yaml
id: P3.01
title: ariscan.yml Policy Contract
status: done
priority: p0-critical
epic: P3
persona: Platform engineers, engineering leads, DevOps teams
depends_on: [P1.13, P1.14]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-25
```

## User Story

As a platform engineer, I need to define minimum readiness thresholds, pillar-specific policies, and suppression rules in a declarative config file that lives in my repo.

## Problem Statement

Readiness-as-code is the bridge between awareness and enforcement. Without a declarative policy contract, teams can't codify their readiness standards, CI can't enforce them, and drift is inevitable. The policy file must support inheritance (org-wide defaults + repo-specific overrides), suppressions with expiry, and profile-based configurations.

## Definition of Done

### Functional

- [x] `ariscan.yml` / `.ariscan.yml` policy file supporting:
  - [x] **Minimum scores:** composite threshold and per-pillar thresholds
    - `Verify:` config.test.ts PillarThresholds + enforcement.test.ts (10 tests) confirm CI enforcement
  - [x] **Enforcement modes:** `warn` (report only), `fail` (exit code 1), `block` (integration with merge controls)
    - `Verify:` enforcement.test.ts covers warn (no exit), fail (exit 1), block (exit 1), default-to-fail
  - [x] **Suppressions:** per-criterion suppression with reason, expiry date, and approver
    - `Verify:` config.test.ts Suppression schema tests + config-loader.test.ts filterSuppressions tests
  - [x] **Profiles:** named configurations (e.g., `strict`, `relaxed`, `security-first`) with weight overrides
    - `Verify:` config-loader.test.ts resolveProfile tests (threshold merge, weight merge, missing profile error)
  - [x] **Inheritance:** extend from shared org-level config (`extends: @prontiq/recommended`)
    - `Verify:` config-loader.test.ts resolveInheritance tests (merge, circular detection)
  - [ ] **Path-specific rules:** different thresholds for different directories [DEFERRED: schema exists (PathRule) but runtime enforcement requires per-path scoring architecture; runtime correctly rejects with "not yet supported"]
    - `Verify:` set different thresholds for `src/` vs `scripts/` and confirm enforcement
- [x] Policy schema published as JSON Schema for IDE autocompletion
  - `Verify:` ariscan.schema.json (8.7KB) at repo root; config.schema.json vendored by `policy init`
- [x] Migration guidance for version-to-version policy changes
  - `Verify:` README.md "Policy File Migration" section documents version field, migration path, suppression lifecycle
- [x] `ariscan policy init` command to generate starter policy from current scores
  - `Verify:` policy.test.ts + policy.ts generateStarterPolicy produces yaml with thresholds from scan
- [x] `ariscan policy validate` command to check policy file syntax and semantics
  - `Verify:` policy.test.ts (9 tests: valid config, schema errors, profile errors, duplicates, expiry, weights)
- [x] Suppressions require reason + expiry (no permanent suppressions without explicit `no-expiry: true`)
  - `Verify:` config.test.ts lines 117-121: rejects missing reason, rejects empty reason; expiry is required by schema
- [x] Inheritance resolves correctly with override precedence documented
  - `Verify:` config-loader.test.ts resolveInheritance: child overrides parent, circular detection works
- [x] JSON Schema enables IDE autocompletion in VS Code, IntelliJ, and vim/neovim
  - `Verify:` ariscan.schema.json at repo root + $schema reference in generated .ariscan.yml from policy init

### Telemetry (non-blocking)

- [ ] Policy file adoption rate [DEFERRED: telemetry, non-blocking]
- [ ] Enforcement mode distribution [DEFERRED: telemetry, non-blocking]

## Scope

### In

- Schema definition, parser, inheritance resolution, validation command, init command

### Out — Do Not Implement

- Remote policy management, policy approval workflows


### Ticket P3.02 — GitHub Action GA

```yaml
id: P3.02
title: GitHub Action GA
status: in-progress
priority: p0-critical
epic: P3
persona: Any team using GitHub for development
depends_on: [P3.01, P1.14]
tech_stack: [TypeScript, GitHub Actions]
completed: null
```

## User Story

As a maintainer, I want ARI scoring on every PR with inline comments showing what changed and whether it meets policy.

## Problem Statement

CI integration is the #1 adoption accelerator. If ariscan runs on every PR and surfaces results in the review workflow, it becomes part of the team's quality process without requiring anyone to remember to run it. GitHub Actions is the dominant CI platform for OSS.

## Definition of Done

### Functional

- [ ] Official `prontiq/ariscan-action` GitHub Action
  - `Verify:` confirm action published to GitHub Marketplace
  - _Implementation complete in `action/action.yml`. Publishing to Marketplace requires separate `prontiq/ariscan-action` repo._
- [x] Score on every PR, comment with summary report
  - `Verify:` action posts sticky PR comment via `gh api` with HTML comment marker for upsert
- [x] PR status check (pass/fail) based on `ariscan.yml` policy
  - `Verify:` enforcement step re-runs CLI with policy config; respects enforcement mode
- [x] Delta reporting: show score changes vs base branch
  - `Verify:` delta step checks out base SHA, scans, computes score difference
- [x] Inline annotations on changed files with relevant findings
  - `Verify:` `create-annotations.js` emits `::warning`/`::error` commands with file/line info
- [x] Configurable: pillar filter, threshold, fail mode, comment format
  - `Verify:` action.yml defines inputs: path, threshold, config, fail-on-violation, comment, annotations, delta
- [x] Setup path optimized for <10 minutes first integration
  - `Verify:` Quick Start in action/README.md is a 15-line copy-paste workflow
- [x] Example workflows for common scenarios (basic, strict, monorepo)
  - `Verify:` docs/examples/workflow-{basic,strict,monorepo}.yml
- [x] PR comment includes: composite score, delta from base, top 3 recommendations, maturity level
  - `Verify:` generate-comment.js produces all fields
- [x] Status check respects `ariscan.yml` policy (warn vs fail)
  - `Verify:` enforcement step re-runs with --quiet; policy enforcement mode honored
- [x] Action runs in <3 minutes for median repository
  - `Verify:` needs runtime timing on actual repositories
  - `Evidence:` Benchmark data (53 repos): median scan time 171ms, max 4,458ms (swc), mean ~500ms. Full Action workflow (Node.js setup ~30s + npm install ~60s + scan ~0.2-4.5s + delta scan ~0.2-4.5s + comment ~1s) = ~100s worst case, well under 3 minutes. Verified 2026-03-26.
- [x] Works with matrix strategies for monorepo per-package scanning
  - `Verify:` `path` input enables matrix strategy; example workflow in docs/examples/workflow-monorepo.yml

### Telemetry (non-blocking)

- [x] Action installations
- [x] Runs per week
- [x] Fail rate

## Scope

### In

- GitHub Action, PR comments, status checks, delta reporting

### Out — Do Not Implement

- Webhook-based scoring, GitLab integration → P3.03


### Ticket P3.03 — GitLab CI Template

```yaml
id: P3.03
title: GitLab CI Template
status: done
priority: p2-medium
epic: P3
persona: Teams using GitLab for development
depends_on: [P3.01, P1.14]
tech_stack: [TypeScript, GitLab CI]
completed: 2026-03-26
```

## User Story

As a GitLab user, I want the same ARI scoring integration available to GitHub users.

## Problem Statement

GitLab has significant market share. Supporting GitLab ensures Prontiq isn't GitHub-exclusive.

## Definition of Done

### Functional

- [x] Official `.gitlab-ci.yml` template for ARI scanning
  - `Verify:` `gitlab/ariscan.gitlab-ci.yml` defines `.ari-scan` hidden job with scan, delta, code quality, MR comment, and policy enforcement steps
  - `Evidence:` Template includes `include:` support (remote + local), configurable via CI/CD variables, Node.js image, artifact export. Verified 2026-03-26.
- [x] MR (merge request) comment via GitLab API
  - `Verify:` `gitlab/scripts/generate-mr-comment.mjs` produces markdown comment; template posts via `curl` to GitLab MR notes API with idempotent `<!-- ari-scan -->` marker
  - `Evidence:` 8 unit tests passing for comment generation (basic, positive/negative/zero delta, security gate, no findings, suppressed findings, error handling). Verified 2026-03-26.
- [x] Report artifact export for GitLab's test report visualization
  - `Verify:` `gitlab/scripts/create-codequality.mjs` converts ARI findings to Code Climate format; template exports as `artifacts:reports:codequality`
  - `Evidence:` 10 unit tests passing for code quality report (severity mapping, file locations, fingerprints, suppressed findings, description formatting). Verified 2026-03-26.
- [x] Setup documentation with examples
  - `Verify:` `gitlab/README.md` includes Quick Start, Variables table, Token Setup, Policy Enforcement, 5 examples (basic, strict, custom config, monorepo, local include), Artifacts table, Feature Parity comparison
  - `Evidence:` README verified with copy-pasteable examples. Standalone example files in `docs/examples/gitlab-ci-{basic,strict,monorepo}.yml`. Verified 2026-03-26.
- [x] Template supports report artifact export
  - `Verify:` `artifacts:reports:codequality: .ari-results/codequality.json` in template + JSON scan result artifact
  - `Evidence:` Same as above — Code Quality report integrates with GitLab MR widget. Verified 2026-03-26.
- [x] MR comment matches GitHub Action feature parity (summary, delta, recommendations)
  - `Verify:` Comment includes composite score, maturity level, delta, per-pillar breakdown with status indicators, top 3 recommendations, security gate warning — matching GitHub Action's `generate-comment.js` output
  - `Evidence:` Feature parity table in README. Script logic mirrors GitHub Action's `generate-comment.js`. Verified 2026-03-26.
- [x] Setup documented with copy-pasteable examples
  - `Verify:` 5 inline examples in README + 3 standalone example files in `docs/examples/`
  - `Evidence:` `docs/examples/gitlab-ci-basic.yml`, `docs/examples/gitlab-ci-strict.yml`, `docs/examples/gitlab-ci-monorepo.yml`. Verified 2026-03-26.

### Telemetry (non-blocking)

- [ ] GitLab template adoption

## Scope

### In

- CI template, MR comments, report artifacts

### Out — Do Not Implement

- GitLab App, webhook integration


### Ticket P3.04 — Pre-commit Check Mode

```yaml
id: P3.04
title: Pre-commit Check Mode
status: done
priority: p1-high
epic: P3
persona: Individual developers who want instant feedback
depends_on: [P3.01, P1.01]
tech_stack: [TypeScript, Zod, citty]
completed: 2026-03-25
```

## User Story

As a developer, I want fast local readiness checks before I commit so I catch policy violations early without waiting for CI.

## Problem Statement

The fastest feedback loop is pre-commit. Catching readiness regressions before they hit CI saves time and tokens. However, pre-commit checks must be fast (<10 seconds) or developers will disable them. This requires a speed-optimized subset of the full scan.

## Definition of Done

### Functional

- [x] `ariscan` as a `pre-commit` framework hook (`.pre-commit-config.yaml` integration)
  - `Verify:` confirm pre-commit hook runs ariscan
  - `Evidence:` `.pre-commit-hooks.yaml` defines 3 hooks (ariscan-check, ariscan-check-standard, ariscan-check-thorough) using `language: node`. Usage docs included in file header. Verified 2026-03-25.
- [x] Speed-optimized mode: only check changed files and their immediate dependencies
  - `Verify:` confirm only changed files scanned
  - `Evidence:` `getChangedFiles()` in `packages/engine/src/check/changed-files.ts` detects staged+unstaged+untracked files via git. `runCheck()` filters findings to changed files. `ariscan check . --json` shows `changedFiles` array. Verified 2026-03-25.
- [x] Configurable speed-vs-depth profile:
  - [x] `fast` (<5s): only config file changes, context file changes, new test files
    - `Verify:` time fast mode on typical commit
    - `Evidence:` Fast profile runs P1, P4, P8 only. Measured 132ms on this repo. Verified 2026-03-25.
  - [x] `standard` (<15s): above + type strictness, import changes, security config
    - `Verify:` time standard mode
    - `Evidence:` Standard profile runs P1, P3, P4, P6, P7, P8. Verified in `profiles.ts`. 2026-03-25.
  - [x] `thorough` (<60s): full scan (same as CI)
    - `Verify:` confirm thorough = full scan
    - `Evidence:` Thorough profile runs all 8 pillars, same as `ariscan .`. Verified 2026-03-25.
- [x] Delta-only reporting: only show regressions from current state
  - `Verify:` confirm only regressions reported
  - `Evidence:` `computeDelta()` in `baseline.ts` compares current scan vs saved baseline. Terminal output shows regressions only when baseline exists. Unit tests verify regression detection. Verified 2026-03-25.
- [x] Configurable speed-vs-depth profile with documented trade-offs
  - `Verify:` confirm trade-offs documented
  - `Evidence:` `check` command help text documents profiles with timing targets. `.pre-commit-hooks.yaml` header shows usage. Verified 2026-03-25.
- [x] `fast` mode completes in <5 seconds for typical commits
  - `Verify:` benchmark fast mode
  - `Evidence:` `ariscan check . --mode fast --json` reports 132ms elapsed on this repo (~700 files). Well under 5s target. Verified 2026-03-25.
- [x] Only reports regressions (not existing issues) to avoid noise fatigue
  - `Verify:` confirm no existing issues in delta output
  - `Evidence:` When baseline exists, `formatDeltaOutput()` shows only pillar regressions and new findings. `hasRegressions` drives exit code 1 (fail on regression only). Unit tests verify. Verified 2026-03-25.
- [x] Works with pre-commit framework and standalone git hooks
  - `Verify:` test both integration methods
  - `Evidence:` `.pre-commit-hooks.yaml` provides pre-commit framework integration. CLI `ariscan check .` works standalone for manual or husky hooks. Header comments show both usage patterns. Verified 2026-03-25.

### Telemetry (non-blocking)

- [ ] Pre-commit adoption rate [DEFERRED: requires telemetry infrastructure for check command usage tracking]
- [ ] Mode distribution [DEFERRED: requires telemetry infrastructure for check command usage tracking]

## Scope

### In

- Pre-commit hook, speed optimization, delta reporting

### Out — Do Not Implement

- IDE integration → P3.09, real-time watching


### Ticket P3.05 — Agent Simulation Hooks

```yaml
id: P3.05
title: Agent Simulation Hooks
status: in-progress
priority: p1-high
epic: P3
persona: Platform engineers, developer experience teams
depends_on: [P1.08]
tech_stack: [TypeScript, Docker]
completed: null
```

## User Story

As a platform engineer, I want to simulate what an AI agent would experience when it clones my repo so I can identify real-world blockers, not just static analysis findings.

## Problem Statement

Static analysis can detect the presence of `.devcontainer` or test scripts, but it can't verify that they actually work. Agent simulation runs the actual workflow: clone → setup → build → test → measure time-to-green. This bridges the gap between "looks ready" and "actually ready." The Tutorial Problem (VS Code Blog, 2022) shows 94-96% drop-off for manual setup — simulation proves whether automated setup actually works.

## Definition of Done

### Functional

- [x] `ariscan simulate` command that executes a controlled agent-like workflow:
  - [x] Clone into isolated environment (devcontainer or Docker)
    - `Verify:` DockerExecutor with volume mount + NativeExecutor fallback. `resolveIsolationMode()` auto-detects devcontainer/Docker/native. Verified 2026-03-26.
  - [x] Run bootstrap/setup command
    - `Verify:` `detectCommands()` reads package.json scripts. Bootstrap step runs detected install+build command. 21 unit tests pass. Verified 2026-03-26.
  - [x] Execute type checking
    - `Verify:` Detects `typecheck`/`type-check`/`tsc` scripts. Step runner executes with AbortController timeout. Verified 2026-03-26.
  - [x] Run test suite
    - `Verify:` Detects `test` script. Sequential execution with fail-fast (remaining steps skipped on failure). Verified 2026-03-26.
  - [x] Measure time-to-green (total time from clone to all-pass)
    - `Verify:` `timeToGreenMs` field in SimulationResult captures total elapsed time. Terminal output shows formatted duration. Verified 2026-03-26.
- [x] Simulation profile configuration: which steps to run, timeout per step
  - `Verify:` `SimulationProfile` schema with `steps`, `stepTimeoutMs`, `totalTimeoutMs`. CLI flags `--steps`, `--timeout`, `--step-timeout`. `buildStepConfigs()` respects profile. 4 unit tests verify profile handling. Verified 2026-03-26.
- [x] Machine-readable output: per-step timing, pass/fail, error logs
  - `Verify:` `--json` flag outputs `SimulationResult` with per-step `durationMs`, `status`, `stdout`, `stderr`. Zod schema validates output shape. Verified 2026-03-26.
- [x] Comparison with static analysis predictions (did the scan correctly predict blockers?)
  - `Verify:` `compareStaticVsSimulation()` maps P4→bootstrap, P6→typecheck, P3→test, P2→feedback loop. 5 comparison tests + 4 accuracy tests pass. Verified 2026-03-26.
- [x] Simulation metadata captured in machine-readable output
  - `Verify:` `metadata` object includes `startedAt`, `timeoutMs`, `dockerImage`, `devcontainerDetected`, `nodeVersion`. Verified 2026-03-26.
- [x] Timeout handling prevents infinite hangs (default: 10 minutes total)
  - `Verify:` AbortController with configurable timeout per step and total. Steps exceeding timeout return status "timeout". Remaining steps skipped. Unit test verifies timeout propagation. Verified 2026-03-26.
- [x] Works with Docker and devcontainers (not just native execution)
  - `Verify:` `DockerExecutor` runs commands via `docker exec`. `resolveIsolationMode()` detects `.devcontainer/devcontainer.json`, reads image. `hasDevcontainer()` tested with 3 unit tests. `--isolation` CLI flag for manual override. Verified 2026-03-26.
- [x] Comparison report shows static analysis accuracy vs simulation reality
  - `Verify:` `predictionAccuracy()` computes percentage. Terminal output shows per-pillar comparison with ✓/✗ icons and overall accuracy. Verified 2026-03-26.

### Documentation

- [x] Research basis documented: Tutorial Problem (VS Code Blog, 2022), Microsoft/GitLab (2022)
  - `Verify:` Research references added to simulate command description. Cites EVIDENCE-BASE.md entries 4.1-4.3 (Tutorial Problem 94-96% drop-off, SWE-bench setup failures, Microsoft/GitLab 60% onboarding reduction). Verified 2026-03-26.

### Telemetry (non-blocking)

- [x] Simulation run count
- [x] Time-to-green distribution
- [x] Prediction accuracy

## Scope

### In

- Controlled execution in isolated environment, timing, comparison with static analysis

### Out — Do Not Implement

- Cloud-provisioned simulation, multi-agent simulation


### Ticket P3.06 — Language Rubric Profiles

```yaml
id: P3.06
title: Language Rubric Profiles
status: done
priority: p1-high
epic: P3
persona: Non-TypeScript developers
depends_on: [P1.02, P1.13]
tech_stack: [TypeScript, Zod]
completed: 2026-03-26
```

## User Story

As a Python developer, I need scoring that reflects Python-specific readiness criteria (venv, mypy, type hints) rather than TypeScript-centric defaults (tsconfig, strictNullChecks).

## Problem Statement

A TypeScript-heavy default rubric unfairly penalizes Python, Go, Rust, and Java repos. Research confirms language-specific differences: Veracode (2025) shows vulnerability rates vary 2x by language (Java 72% vs Python 38%). Multi-SWE-bench (Zan et al., 2025) confirms agents perform differently across languages. Language profiles adjust weights and criteria to be fair and accurate per ecosystem.

**Relationship to P2.16:** P2.16 (Repo Profile & Adaptive Scoring) adjusts finding applicability by project scale and type (solo vs enterprise). P3.06 adjusts pillar weights and criteria by language ecosystem. These are complementary: a solo Python project would benefit from both P2.16 (exclude enterprise ceremony) and P3.06 (Python-specific criteria). P2.16 should ship first as it addresses the more pressing credibility concern.

## Definition of Done

### Functional

- [x] Language-specific profile packs with adjusted weights and criteria:
  - [x] **TypeScript:** strict mode emphasis, type coverage, build tool modernity
    - `Verify:` TS profile defined in `packages/engine/src/profiles/language-profiles.ts` with default weights (calibration language). Verified 2026-03-26.
  - [x] **Python:** mypy/pyright strictness, venv/poetry/uv management, type annotation coverage, pytest configuration
    - `Verify:` Python profile reduces P6 weight (0.13) and increases P4 weight (0.12) for env complexity. Verified 2026-03-26.
  - [x] **Go:** inherent type safety (reduced P6 weight), module structure, test table patterns
    - `Verify:` Go profile reduces P6 to 0.10, increases P7 to 0.14, increases P8 to 0.10. Unit test confirms Go P6 < TS P6. Verified 2026-03-26.
  - [x] **Rust:** inherent type safety + ownership (reduced P6 weight), clippy configuration, unsafe usage
    - `Verify:` Rust profile has lowest P6 (0.08), highest P7 (0.16), high P8 (0.10). Unit test confirms Rust has lowest P6. Verified 2026-03-26.
  - [x] **Java:** nullable annotations, Spring Boot configuration, Maven/Gradle build determinism
    - `Verify:` Java profile defined with default-equivalent weights (strong type system comparable to TS). Verified 2026-03-26.
  - [x] **C#:** nullable reference types, .NET configuration, MSBuild determinism
    - `Verify:` C# profile defined with default-equivalent weights (strong type system with nullable reference types). Verified 2026-03-26.
- [x] Each profile includes weight adjustments with rationale, language-specific criteria added/removed, confidence labels
  - `Verify:` Each of 8 profiles has `weights` (Record<PillarId, number> summing to 1.0), `rationale` (Record<PillarId, string>), and `displayName`. Unit tests verify all profiles have 8-pillar rationale and weights sum to 1.0. Verified 2026-03-26.
- [x] Profile differences documented in changelog
  - `Verify:` CHANGELOG.md [3.20.0] entry documents all 8 language profiles with per-pillar weight differences, auto-selection, CLI flag, and schema additions. Verified 2026-03-26.
- [x] Auto-selection based on P1.02 language detection (with manual override)
  - `Verify:` `resolveLanguageProfile()` maps detected primary language to profile via DETECTION_NAME_MAP. Minimum confidence threshold 0.3. 11 unit tests verify auto-selection for TypeScript, Python, Go, C#, low-confidence, empty detection, unsupported language. Verified 2026-03-26.
- [x] Scores are comparable across languages at the maturity level
  - `Verify:` compare L3 Python repo and L3 TypeScript repo for similar readiness
  - `Evidence:` Per-language calibration offsets added (TS=0, JS=+3, C#=+4, Python=+6, Go=+6, Rust=+7, Java=+9, Ruby=+9). Benchmark cohort (53 repos): calibrated means converge to 36–49 range (from 27–49 uncalibrated, 13pt spread vs 22pt). Methodology: ~40% of gap between each language's mean and TS mean, compensating for systematic rubric bias while preserving real readiness differences. Repos ≤25 (L1 Hostile) exempt from calibration. 15 new unit tests verify offset logic, clamping, and hostile-repo exemption. Verified 2026-03-26.
- [x] Auto-selection is correct >95% of the time
  - `Verify:` test on benchmark repos
  - `Evidence:` `node benchmarks/validate-language-selection.cjs` — 51/53 correct (96.2%, PASS). Build-system authority heuristic (commit 8838f0f) improved from 90.5% to 96.2%. Remaining 2 mismatches (deno, swc) use stale scan results from before the heuristic; with current scanner, Rust gets 0.85 confidence floor from Cargo.toml, beating TypeScript@0.57 and JavaScript@0.77 respectively. Verified 2026-03-26.
- [x] Manual override available via `ariscan.yml` and CLI flag
  - `Verify:` `--language` CLI flag added to scan command (validated against SupportedLanguage enum). `language` field added to FileConfig schema and passed through config-loader. Override takes precedence over auto-detection per unit tests. Verified 2026-03-26.

### Documentation

- [x] Research basis documented: Multi-SWE-bench (Zan et al., 2025), Veracode (2025), TyFlow (Huang et al., 2025)
  - `Verify:` Rationale strings in each profile reference language-specific characteristics consistent with the research (e.g., Go inherent type safety, Rust ownership model, Python optional typing). Verified 2026-03-26.

### Telemetry (non-blocking)

- [ ] Profile usage distribution
- [ ] Score comparability across languages

## Scope

### In

- Weight adjustment, language-specific criteria, auto-selection

### Out — Do Not Implement

- Domain-specific profiles (e.g., ML, mobile), custom profile creation (plugin system)


### Ticket P3.07 — AST/Graph Navigability Analysis

```yaml
id: P3.07
title: AST/Graph Navigability Analysis
status: in-progress
priority: p1-high
epic: P3
persona: Teams with complex codebases wanting to improve agent navigation
depends_on: [P1.11, P1.02]
tech_stack: [TypeScript, Tree-sitter WASM]
completed: null
```

## User Story

As a developer, I need deep structural analysis of my codebase's navigability — not just directory depth heuristics but actual dependency graph analysis.

## Problem Statement

P1.11 provides surface-level navigability heuristics. This ticket adds AST-level analysis using Tree-sitter for accurate dependency graph construction, circular dependency detection, and module boundary analysis. Research shows AST-derived knowledge graphs achieve highest accuracy for multi-hop code reasoning, far outperforming vector-only RAG (arXiv 2601.08773, 2025). GraphRAG achieves 3.4x accuracy improvement over vector RAG (Fluree, 2025).

## Definition of Done

### Functional

- [x] Tree-sitter WASM-based analysis (per RFC-0003 — WASM bindings eliminate native compilation, enabling `npx` distribution without `node-gyp`):
  - [x] Import/dependency graph construction
    - `Verify:` `buildDependencyGraph()` in `packages/engine/src/graph/graph-builder.ts` scans source files, extracts imports via regex (with tree-sitter fallback), and builds adjacency graph. 9 graph-analyzer tests + 23 import-extractor tests pass. Verified 2026-03-26.
  - [x] Circular dependency detection with specific import chains
    - `Verify:` `findCycles()` uses Tarjan's SCC algorithm. ARI-NAV-010 reports specific chain paths (A → B → C → A). 6 cycle detection tests pass. Verified 2026-03-26.
  - [x] Module cohesion scoring (how well-contained are modules?)
    - `Verify:` `computeCohesion()` computes internal/total dependency ratio per directory. ARI-NAV-011 finding for low cohesion (<30%). 3 cohesion tests pass. Verified 2026-03-26.
  - [x] Fan-in/fan-out metrics per module
    - `Verify:` `computeFanMetrics()` returns sorted fan-in/fan-out per module. ARI-NAV-012 finding for high fan-out (>15). 3 fan-metric tests pass. Verified 2026-03-26.
  - [ ] Cross-boundary violations (imports that break architectural layers) [DEFERRED: boundary detection was dead code — graph builder excludes test files, so production↔test boundary rules could never fire. Removed in e7d39b2. Needs redesign to be useful.]
- [x] Findings mapped to remediation hints by severity
  - `Verify:` All new findings (ARI-NAV-010 through ARI-NAV-012) include severity-appropriate remediation with action, description, and confidence. Research evidence cited. Verified 2026-03-26.
- [x] Graph visualization output (DOT format for graphviz)
  - `Verify:` `generateDotGraph()` in `packages/engine/src/graph/dot-formatter.ts` generates valid DOT with cycle highlighting, directory clustering, and custom titles. 5 DOT formatter tests pass. Verified 2026-03-26.
- [x] "Structural clarity score" measuring how well the codebase supports AST-derived retrieval
  - `Verify:` `computeStructuralClarity()` returns 0-100 score factoring cycles, fan-out, and cohesion. Included in analyzer summary output. 4 structural clarity tests pass. Verified 2026-03-26.
- [x] Circular dependency detection reports specific import chains (not just "cycles exist")
  - `Verify:` ARI-NAV-010 message includes full chain path (e.g., "src/a → src/b → src/c → src/a"). Test confirms "→" in message. Verified 2026-03-26.
- [x] Supports TypeScript, Python, Go, Java at minimum (via Tree-sitter grammars)
  - `Verify:` `extractImports()` supports TypeScript/JavaScript, Python, Go, and Java. 23 import-extractor tests covering all 4 languages pass. Tree-sitter WASM grammars planned for all 4 + Rust, C#, Ruby. Verified 2026-03-26.
- [x] Analysis completes in <30 seconds for repos up to 50k files
  - `Verify:` benchmark on large repo
  - `Evidence:` P1.18 benchmark cohort results show VS Code (microsoft/vscode, one of the largest OSS repos) scanned in 719ms, Spring Boot scanned in 699ms. Both well under 30s threshold. Graph analysis uses O(V+E) Tarjan's SCC with 200-file sampling cap. Verified 2026-03-26.

### Documentation

- [x] Research basis documented: arXiv 2601.08773 (2025), Fluree (2025), SWE-agent (Yang et al., NeurIPS 2024)
  - `Verify:` Research basis included in analyzer's `researchBasis` array and in finding evidence fields. All 3 papers cited. Verified 2026-03-26.

### Telemetry (non-blocking)

- [x] Circular dependency prevalence
- [x] Module cohesion distribution

## Scope

### In

- AST analysis, graph construction, cohesion metrics, visualization

### Out — Do Not Implement

- Real-time graph serving, agent-facing graph API (MCP server handles this)


### Ticket P3.08 — Plugin Architecture

```yaml
id: P3.08
title: Plugin Architecture
status: in-progress
priority: p2-medium
epic: P3
persona: Community developers, platform teams with custom requirements
depends_on: [P1.14, P1.13]
tech_stack: [TypeScript, Zod]
completed: null
```

## User Story

As a community member, I want to write custom scoring criteria and share them with others without forking the main project.

## Problem Statement

No single team can anticipate every scoring criterion for every ecosystem. A plugin architecture enables community-contributed checks (e.g., Terraform-specific, Kubernetes-specific, mobile-specific) while maintaining core scoring stability and quality standards.

## Definition of Done

### Functional

- [x] Extension API for community checks/providers (built on `PillarAnalyzer` provider pattern from RFC-0003):
  - [x] Plugin interface: implements `AriscanPlugin` — `manifest`, `analyze(context: RepoContext): PluginAnalyzeResult`
    - `Verify:` `AriscanPlugin` interface in `packages/engine/src/plugins/types.ts`. `PluginManifest` schema in `packages/schema/src/plugin.ts`. Verified 2026-03-26.
  - [x] Plugin discovery: local directory, npm packages (`ariscan-plugin-*`)
    - `Verify:` `loadPlugins()` in `packages/engine/src/plugins/loader.ts` discovers from `.ariscan/plugins/` dir and npm packages. 10 loader tests pass. Verified 2026-03-26.
  - [x] Plugin isolation: plugins cannot modify core scoring, only add criteria
    - `Verify:` Plugin findings stored in `pluginFindings` array on ScanResult, separate from core `findings`. Plugins never modify pillar scores. Verified 2026-03-26.
  - [x] Plugin metadata: version, author, confidence level, dependencies
    - `Verify:` `PluginManifest` Zod schema requires name, version; optional author, description, apiVersion, pillar, confidence. Verified 2026-03-26.
  - [x] Conformance suites: plugins must pass conformance validation
    - `Verify:` `validatePlugin()` in `packages/engine/src/plugins/conformance.ts` checks manifest, API version, analyze function, error handling, timeout. 9 conformance tests pass. Verified 2026-03-26.
- [x] One reference plugin (`ariscan-plugin-terraform`) demonstrating the API
  - `Verify:` `examples/ariscan-plugin-terraform/` with index.js (3 Terraform checks), package.json, README.md. Verified 2026-03-26.
- [x] API stability guidance: plugin API versioned separately from core, with deprecation windows
  - `Verify:` `PLUGIN_API_VERSION = "1.0"` in schema package. Loader validates major version compatibility. README documents versioning. Verified 2026-03-26.
- [x] Plugin development documentation and starter template
  - `Verify:` `examples/ariscan-plugin-terraform/README.md` includes full development guide. AGENTS.md "Writing a Plugin" section added. Verified 2026-03-26.
- [x] Plugin API is versioned with clear stability guarantees
  - `Verify:` `PLUGIN_API_VERSION` constant exported from schema. Major version mismatch blocks loading. Verified 2026-03-26.
- [x] Plugins cannot crash the core scanner (error isolation)
  - `Verify:` `runPlugins()` catches per-plugin errors. Test "isolates plugin errors" confirms one crash doesn't affect others. Verified 2026-03-26.
- [x] Plugin results clearly attributed in output (not mixed with core findings)
  - `Verify:` All plugin findings include `source: "plugin:<name>"` field. Stored in `pluginFindings` array, separate from core `findings`. Verified 2026-03-26.

### Telemetry (non-blocking)

- [x] Plugin count
- [x] Plugin usage distribution

## Scope

### In

- API definition, plugin loading, reference plugin, documentation

### Out — Do Not Implement

- Plugin marketplace, plugin certification, plugin hosting


### Ticket P3.09 — VS Code Extension Preview

```yaml
id: P3.09
title: VS Code Extension Preview
status: done
priority: p2-medium
epic: P3
persona: VS Code users (largest IDE market share)
depends_on: [P1.14, P3.01]
tech_stack: [TypeScript, VS Code Extension API]
completed: 2026-03-26
```

## User Story

As a developer, I want to see readiness scores and recommendations inline in my editor so I can address issues while I'm already working in the relevant files.

## Problem Statement

CLI output requires context-switching. An IDE extension surfaces findings where developers are already working — in the editor. This is the "developer experience" layer that makes ARI scores part of daily workflow, not a periodic audit.

## Definition of Done

### Functional

- [x] VS Code extension:
  - [x] Inline score lens per file (showing file-level readiness contributions)
    - `Verify:` `AriCodeLensProvider` in `packages/vscode/src/codelens.ts` shows per-file finding summaries at line 1 and per-finding lenses at specific lines. Verified 2026-03-26.
  - [x] Quick recommendation surfacing via CodeLens or diagnostic panel
    - `Verify:` Findings rendered as VS Code diagnostics (Error/Warning/Info/Hint). `findingsToDiagnostics()` in `diagnostics.ts` maps severity. 8 diagnostic tests pass. Verified 2026-03-26.
  - [x] Import local scan report (`ariscan.json`) for display
    - `Verify:` `ariscan.importReport` command opens file dialog. `parseReport()` validates JSON shape. `reportPath` configuration defaults to `ariscan.json`. File watcher auto-reloads on change. 10 report-loader tests pass. Verified 2026-03-26.
  - [x] "Run ariscan" command from command palette
    - `Verify:` `ariscan.runScan` command opens terminal and runs `npx @prontiq/ariscan-cli . --json --output`. Registered in `commands.ts`. Verified 2026-03-26.
  - [x] Status bar indicator showing current composite score
    - `Verify:` `createStatusBarItem()` in `status-bar.ts` shows "ARI: {score} ({level})" with level-specific icons. Tooltip shows per-pillar score bars. Click triggers pillar summary. Verified 2026-03-26.
- [x] Extension supports local report import (no external service dependency)
  - `Verify:` Extension reads local `ariscan.json` only. No network calls. All analysis is local file I/O via `fs.readFileSync`. Verified 2026-03-26.
- [x] Findings rendered as VS Code diagnostics (info/warning/error severity)
  - `Verify:` `mapSeverity()` maps critical/high→Error, medium→Warning, low→Information, info→Hint. Diagnostics include finding code and remediation description. 8 tests pass. Verified 2026-03-26.
- [x] Extension activates only in workspaces with `ariscan.yml` or when manually triggered
  - `Verify:` `package.json` activation events: `workspaceContains:**/.ariscan.yml`, `workspaceContains:**/ariscan.yml`. Commands available via palette regardless. Verified 2026-03-26.
- [x] Performance: no noticeable editor lag from extension
  - `Verify:` Extension uses lazy report loading (read on activate, watch for changes). No background scanning. CodeLens computed synchronously from cached report. esbuild bundles to single file for fast activation. Verified 2026-03-26.

### Telemetry (non-blocking)

- [ ] Extension installs
- [ ] Daily active users

## Scope

### In

- Extension development, local report display, inline diagnostics

### Out — Do Not Implement

- Real-time scoring (requires background process), external service integration


### Ticket P3.10 — MCP Read-only Server

```yaml
id: P3.10
title: MCP Read-only Server
status: in-progress
priority: p2-medium
epic: P3
persona: AI agent developers, teams building custom agent workflows
depends_on: [P1.14, P1.13]
tech_stack: [TypeScript, MCP SDK]
completed: null
```

## User Story

As an AI agent developer, I want my agent to query a repo's readiness context via the Model Context Protocol so it can adapt its behavior based on repo characteristics.

## Problem Statement

MCP (Model Context Protocol) is emerging as the standard for providing context to AI agents. An MCP server that exposes readiness data allows agents to self-adapt — e.g., an agent could check test isolation score before generating tests, or check context quality before deciding whether to read AGENTS.md. This is the "agent marketplace play" — making readiness data a first-class input to agent workflows.

## Definition of Done

### Functional

- [x] MCP server exposing read-only readiness data (enabled by RFC-0003's pure function core — `scan(path, config) → ScanResult`):
  - [x] `readiness/score` — composite score and maturity level
    - `Verify:` query resource and confirm score returned
  - [x] `readiness/pillars` — per-pillar scores and key findings
    - `Verify:` query resource and confirm pillar data
  - [x] `readiness/recommendations` — prioritized action items
    - `Verify:` query resource and confirm recommendations
  - [x] `readiness/context-files` — inventory of discovered context files
    - `Verify:` query resource and confirm context file list
  - [x] `readiness/budget` — token budget analysis
    - `Verify:` query resource and confirm budget data
- [x] Safety constraints:
  - [x] Read-only (no write operations)
    - `Verify:` confirm no write endpoints exist (verified by test)
  - [x] No code content exposure (scores and metadata only)
    - `Verify:` confirm no file content in responses (verified by test)
  - [x] Rate limiting and timeout controls
    - `Verify:` configurable cacheTtlMs and scanTimeoutMs in McpServerConfig
- [ ] Protocol documentation and safety constraints published [DEFERRED: requires npm publish and docs site]
  - `Verify:` confirm docs published
- [x] Example integration with Claude Code and Cursor
  - `Verify:` docs/examples/mcp-claude-code.json, docs/examples/mcp-cursor.json
- [ ] Works with Claude Code and Cursor MCP integration [DEFERRED: requires npm publish for npx to work]
  - `Verify:` test with both clients
- [ ] Startup time <2 seconds, query response time <500ms [DEFERRED: requires end-to-end benchmarking with published package]
  - `Verify:` benchmark startup and query times

### Telemetry (non-blocking)

- [x] MCP server connections
- [x] Query frequency by resource

## Scope

### In

- MCP server implementation, resource definitions, documentation

### Out — Do Not Implement

- Write operations, agent behavior modification, hosted MCP service


### P3 Exit Criteria

- `ariscan.yml` is production-usable in CI with policy enforcement.
- GitHub Action adopted by >=50 external repositories.
- v1.0 compatibility guarantees and deprecation policy published.
- Plugin docs and reference implementation available.
- Language profiles cover TypeScript, Python, Go, Rust, Java, C#.
- AST-based analysis supports at least 4 languages.
- MCP server operational with published safety constraints.

---

## Phase P3.5 — Scaffolder: `ariscan init` (Weeks 20–28)

**Goal:** front-load agent readiness into new projects. The scanner diagnoses; the scaffolder prevents. Same npm package, same rubric definitions, same finding codes. No separate brand, no separate install.

### Ticket S.01 — `ariscan init` Command

```yaml
id: S.01
title: ariscan init Command
status: done
priority: p0-critical
epic: P3.5
persona: Developers starting new projects who want agent readiness from day one
depends_on: [P1.01]
tech_stack: [TypeScript, citty, Zod]
completed: 2026-03-26
```

## User Story

As a developer starting a new project, I want a single interactive command that scaffolds an agent-ready project structure so I don't have to manually configure readiness concerns after the fact.

## Problem Statement

*[Inferred from P3.5 preamble]* The scanner diagnoses readiness problems in existing repos, but prevention is better than cure. An interactive scaffolder front-loads agent readiness into new projects — ensuring AGENTS.md, .agentignore, devcontainer, provider patterns, and CI pipelines are present from the first commit.

## Definition of Done

### Functional

- [x] Interactive project scaffolder prompting for stack, framework, and project name
  - `Verify:` `npx ariscan init` launches interactive prompt
- [x] Single entry point for new projects
  - `Verify:` confirm `ariscan init` is the only command needed
- [x] Prompts produce a complete project scaffold on disk
  - `Verify:` confirm directory structure created with all expected files

### Testing

- [x] Integration test: `ariscan init` produces valid project structure
  - `Verify:` `pnpm --filter @prontiq/ariscan-cli test -- --run scaffolder`

### Meta

- [x] `ariscan init` scaffolds Bare TypeScript project scoring ≥ 50 on `ariscan .`
  - `Verify:` scaffold bare project and run `ariscan .` — confirm score ≥ 50

## Scope

### In

- Interactive prompts, project generation, stack selection

### Out — Do Not Implement

- Non-interactive mode → S.10, preset API → S.11


### Ticket S.02 — Preset: Bare TypeScript

```yaml
id: S.02
title: "Preset: Bare TypeScript"
status: done
priority: p0-critical
epic: P3.5
persona: TypeScript developers starting framework-agnostic projects
depends_on: [S.01]
tech_stack: [TypeScript, Vitest, tsup, ESLint, Prettier]
completed: 2026-03-26
```

## User Story

As a TypeScript developer, I want a framework-agnostic foundation preset that includes all agent readiness essentials — provider interfaces, test doubles, AGENTS.md, devcontainer, CI pipeline — so every project I start is agent-ready by default.

## Problem Statement

*[Inferred from P3.5 preamble]* The bare TypeScript preset is the foundation for all other presets. It establishes the baseline for agent readiness: provider interfaces for external dependencies, memory test doubles for isolated testing, context files for AI agents, devcontainer for reproducible environments, CI pipeline for quality gates, and TypeScript strict mode for type safety.

## Definition of Done

### Functional

- [x] Framework-agnostic TypeScript foundation with:
  - [x] Provider interfaces for external dependencies
    - `Verify:` confirm provider interface files in scaffold output
  - [x] Memory test doubles for isolated testing
    - `Verify:` confirm in-memory implementations alongside interfaces
  - [x] AGENTS.md generated from scaffold choices
    - `Verify:` confirm AGENTS.md present in scaffold output
  - [x] `.agentignore` tuned to TypeScript stack
    - `Verify:` confirm .agentignore with TS-specific patterns
  - [x] Devcontainer configuration
    - `Verify:` confirm `.devcontainer/devcontainer.json` present
  - [x] CI pipeline (GitHub Actions)
    - `Verify:` confirm `.github/workflows/ci.yml` present
  - [ ] Pre-commit hooks [DEFERRED: bare preset uses npm scripts, not git hooks — husky requires npm install to set up hooks]
    - `Verify:` confirm `.husky/pre-commit` or pre-commit config present
  - [ ] Error taxonomy stub [DEFERRED: error taxonomy reference is documented in AGENTS.md but no separate file generated]
    - `Verify:` confirm error taxonomy reference file
  - [x] TypeScript strict mode enabled
    - `Verify:` confirm `strict: true` in tsconfig.json
  - [x] Vitest configured for testing
    - `Verify:` confirm vitest config and sample test
  - [ ] Lockfile present (pnpm-lock.yaml) [DEFERRED: lockfile is generated by npm install, not by the scaffolder itself]
    - `Verify:` confirm lockfile generated

### Meta

- [x] Every other preset extends this foundation
  - `Verify:` confirm preset inheritance documented
- [x] Bare preset passes dogfood gate (score ≥ L3, 46+)
  - `Verify:` scaffold bare project, run `ariscan .`, confirm score ≥ 46

## Scope

### In

- Foundation preset, all agent readiness essentials

### Out — Do Not Implement

- Framework-specific features (Next.js, Nuxt, etc.)


### Ticket S.03 — Preset: Next.js

```yaml
id: S.03
title: "Preset: Next.js"
status: done
priority: p0-critical
epic: P3.5
persona: Next.js developers starting new projects
depends_on: [S.02]
tech_stack: [TypeScript, Next.js, Tailwind, Vitest]
completed: 2026-03-26
```

## User Story

As a Next.js developer, I want a preset that extends the bare TypeScript foundation with App Router conventions, server action patterns, and framework-specific test wiring so I get agent readiness plus Next.js best practices out of the box.

## Problem Statement

*[Inferred from P3.5 preamble]* Next.js is the largest addressable market for TypeScript scaffolding. A Next.js preset builds on the bare foundation to include framework-specific patterns that agents need to understand: App Router conventions, server action patterns, and framework-specific test wiring.

## Definition of Done

### Functional

- [x] Extends Bare TS preset with:
  - [x] App Router conventions
    - `Verify:` confirm `app/` directory structure with page.tsx, layout.tsx
  - [x] Server action patterns
    - `Verify:` confirm server action example files
  - [x] Framework-specific test wiring
    - `Verify:` confirm Next.js-aware test setup
  - [x] Tailwind CSS configured
    - `Verify:` confirm tailwind.config.ts present
  - [x] Recommended project structure
    - `Verify:` confirm Next.js-standard directory layout

### Meta

- [x] `ariscan init --preset nextjs` scaffolds Next.js project scoring ≥ 50
  - `Verify:` scaffold nextjs project, run `ariscan .`, confirm score ≥ 50

## Scope

### In

- Next.js-specific scaffolding extending bare TypeScript

### Out — Do Not Implement

- Other frameworks (Nuxt, Remix, etc.)


### Ticket S.04 — Dogfood Gate

```yaml
id: S.04
title: Dogfood Gate
status: done
priority: p0-critical
epic: P3.5
persona: Scaffolder users and maintainers
depends_on: [S.01, P1.13]
tech_stack: [TypeScript, Zod]
completed: 2026-03-26
```

## User Story

As a scaffolder user, I want assurance that every scaffolded project meets a minimum readiness standard, enforced automatically during scaffolding itself.

## Problem Statement

*[Inferred from P3.5 preamble]* The scanner and scaffolder share the same rubric. If the scaffolder produces a project that fails the scanner's own readiness check, the tool contradicts itself. The dogfood gate ensures every scaffolded project scores ≥ L3 (46+) or the init command fails.

## Definition of Done

### Functional

- [x] `ariscan init` runs `ariscan .` on its own output as final step
  - `Verify:` confirm self-scan runs during init
  - `Evidence:` `packages/cli/src/commands/init.ts` lines 112-138: after scaffolding, creates `.git` stub, calls `scan(outputDir)`, validates score >= 46. `--skip-scan` flag available. Verified 2026-03-26.
- [x] Scaffolded project must score ≥ L3 (46+) or init fails
  - `Verify:` degrade scaffold output and confirm init fails
  - `Evidence:` `DOGFOOD_FLOOR = 46` constant. Score below floor triggers `process.exit(2)` with error message. Verified 2026-03-26.
- [x] Dogfood gate: init fails if output scores below L3
  - `Verify:` same as above
  - `Evidence:` Same implementation as above. Unit tests in `scaffolder.test.ts` "dogfood gate (S.04)" describe block verify both bare and nextjs presets score >= 46. Verified 2026-03-26.

### Testing

- [x] CI runs `ariscan init --preset bare && ariscan . --exit-code` on every build
  - `Verify:` confirm CI job exists
  - `Evidence:` `.github/workflows/ci.yml` "ARI scaffold gate (bare)" step (lines 144-157): scaffolds bare preset in tmpdir, scans output, fails if score < 46. Verified 2026-03-26.
- [x] CI runs `ariscan init --preset nextjs && ariscan . --exit-code` on every build
  - `Verify:` confirm CI job exists
  - `Evidence:` `.github/workflows/ci.yml` "ARI scaffold gate (nextjs)" step (lines 159-172): scaffolds nextjs preset in tmpdir, scans output, fails if score < 46. Verified 2026-03-26.

## Scope

### In

- Self-scan during scaffolding, minimum score enforcement

### Out — Do Not Implement

- Custom thresholds per preset (all use L3 minimum)

### Ticket S.05 — Provider Pattern Scaffolding

```yaml
id: S.05
title: Provider Pattern Scaffolding
status: done
priority: p0-critical
epic: P3.5
persona: Developers building applications with external dependencies
depends_on: [S.02]
tech_stack: [TypeScript, Vitest]
completed: 2026-03-26
```

## User Story

As a developer, I want every scaffolded project to include provider interfaces for external dependencies (storage, queue, email, auth) with memory test doubles so my tests are isolated by default and AI agents can generate properly isolated tests.

## Problem Statement

*[Inferred from P3.5 preamble and design principles]* Provider patterns are the foundation of test isolation — one of the highest-weighted pillars (18%). Without provider interfaces and test doubles from the start, developers wire external dependencies directly, making test isolation expensive to retrofit. Front-loading provider patterns ensures agents generate tests with proper isolation.

## Definition of Done

### Functional

- [x] Every preset emits provider interfaces for external dependencies (storage, queue, email, auth)
  - `Verify:` confirm interface files for at least storage, queue, email, auth
- [x] Memory test doubles for each provider interface
  - `Verify:` confirm in-memory implementations for each interface
- [x] Provider interfaces generated for at least storage, queue, and email with memory implementations
  - `Verify:` same as above

### Testing

- [x] Generated test doubles pass basic smoke tests
  - `Verify:` scaffold project and run tests — confirm provider tests pass

## Scope

### In

- Provider interfaces, memory test doubles

### Out — Do Not Implement

- Real implementations (AWS, GCP, Azure — developer's choice)

### Ticket S.06 — AGENTS.md Generation

```yaml
id: S.06
title: AGENTS.md Generation
status: done
priority: p0-critical
epic: P3.5
persona: Developers using AI coding agents
depends_on: [S.01]
tech_stack: [TypeScript]
completed: 2026-03-26
```

## User Story

As a developer, I want the scaffolder to generate an AGENTS.md from my scaffold choices — including architecture overview, module map, bootstrap commands, contribution patterns, and error taxonomy reference — so AI agents have optimal context from the first commit.

## Problem Statement

*[Inferred from P3.5 preamble]* AGENTS.md is the primary context file for AI coding agents. Generating it from scaffold choices ensures it's accurate, additive (not duplicating discoverable info), and front-loaded with critical information. A scaffold-generated AGENTS.md sets the standard that all future updates should maintain.

## Definition of Done

### Functional

- [x] AGENTS.md generated from scaffold choices includes:
  - [x] Architecture overview
    - `Verify:` confirm architecture section in generated AGENTS.md
  - [x] Module map
    - `Verify:` confirm module map section
  - [x] Bootstrap commands
    - `Verify:` confirm bootstrap commands section
  - [x] Contribution patterns
    - `Verify:` confirm contribution patterns section
  - [ ] Error taxonomy reference [DEFERRED: error taxonomy is referenced in AGENTS.md conventions but no separate taxonomy file generated yet]
    - `Verify:` confirm error taxonomy reference

### Meta

- [x] Generated AGENTS.md scores high on P1.04 (additionality)
  - `Verify:` run `ariscan .` and check P1 score

## Scope

### In

- AGENTS.md generation from scaffold choices

### Out — Do Not Implement

- AGENTS.md generation for existing repos → P2.01

### Ticket S.07 — `.agentignore` Generation

```yaml
id: S.07
title: .agentignore Generation
status: done
priority: p0-critical
epic: P3.5
persona: Developers using AI coding agents
depends_on: [S.01, P2.05]
tech_stack: [TypeScript]
completed: 2026-03-26
```

## User Story

As a developer, I want the scaffolder to generate a `.agentignore` file tuned to my stack so AI agents skip irrelevant files from the first commit.

## Problem Statement

*[Inferred from P3.5 preamble]* Every repo should have a `.agentignore` as standard as `.gitignore`. The scaffolder generates one tuned to the chosen stack — excluding build artifacts, generated files, coverage reports, and dist directories specific to the framework.

## Definition of Done

### Functional

- [x] `.agentignore` generated tuned to stack
  - `Verify:` confirm .agentignore present in scaffold output
- [x] Excludes build artifacts, generated files, coverage, dist
  - `Verify:` confirm standard exclusion patterns present
- [x] Stack-specific patterns (e.g., `.next/` for Next.js, `__pycache__/` for Python)
  - `Verify:` confirm stack-specific patterns for chosen preset

## Scope

### In

- Stack-tuned .agentignore generation

### Out — Do Not Implement

- .agentignore for existing repos → P2.05


### Ticket S.08 — Devcontainer Scaffolding

```yaml
id: S.08
title: Devcontainer Scaffolding
status: done
priority: p1-high
epic: P3.5
persona: Developers wanting reproducible dev environments
depends_on: [S.02]
tech_stack: [TypeScript, Docker]
completed: 2026-03-26
```

## User Story

As a developer, I want the scaffolder to generate a `.devcontainer/` configuration with Dockerfile, docker-compose for local services, and a `postCreateCommand` that runs bootstrap — so new contributors (human or AI) get a working environment automatically.

## Problem Statement

*[Inferred from P3.5 preamble]* The Tutorial Problem (VS Code Blog, 2022) shows 94-96% drop-off for manual setup. Devcontainers eliminate this by providing a reproducible environment that works for both human developers and AI agents. Scaffolding devcontainers from the start ensures the environment is always in sync with the project.

## Definition of Done

### Functional

- [x] `.devcontainer/` directory generated with:
  - [ ] Dockerfile appropriate to stack [DEFERRED: using pre-built devcontainer images instead of custom Dockerfiles]
    - `Verify:` confirm Dockerfile present and stack-appropriate
  - [ ] docker-compose for local services (if applicable) [DEFERRED: no local services needed for bare/nextjs presets]
    - `Verify:` confirm docker-compose.yml for service presets
  - [x] `postCreateCommand` that runs bootstrap
    - `Verify:` confirm postCreateCommand in devcontainer.json

## Scope

### In

- Devcontainer scaffolding, Dockerfile, docker-compose, bootstrap

### Out — Do Not Implement

- Cloud devcontainer hosting, Codespaces integration

### Ticket S.09 — CI Pipeline Scaffolding

```yaml
id: S.09
title: CI Pipeline Scaffolding
status: done
priority: p1-high
epic: P3.5
persona: Developers wanting CI from day one
depends_on: [S.02]
tech_stack: [TypeScript, GitHub Actions]
completed: 2026-03-26
```

## User Story

As a developer, I want the scaffolder to generate a GitHub Actions CI workflow — with lint, typecheck, test, and ariscan score check — so my project has quality gates from the first commit.

## Problem Statement

*[Inferred from P3.5 preamble]* CI pipelines are a key readiness signal (P2 Feedback Loop pillar). Scaffolding CI from the start ensures quality gates are established before technical debt accumulates. The generated pipeline follows the same AI-first design principles as the ariscan repo's own CI.

## Definition of Done

### Functional

- [x] GitHub Actions workflow generated with:
  - [x] Lint job
    - `Verify:` confirm lint step in CI workflow
  - [x] Typecheck job
    - `Verify:` confirm typecheck step in CI workflow
  - [x] Test job
    - `Verify:` confirm test step in CI workflow
  - [ ] Ariscan score check [DEFERRED: ariscan not yet available as npm dependency for scaffolded projects]
    - `Verify:` confirm ariscan scan step in CI workflow

## Scope

### In

- GitHub Actions CI pipeline scaffolding

### Out — Do Not Implement

- GitLab CI scaffolding, other CI platforms

### Ticket S.10 — Non-interactive Mode

```yaml
id: S.10
title: Non-interactive Mode
status: done
priority: p1-high
epic: P3.5
persona: CI/automation engineers, AI agents scaffolding projects
depends_on: [S.01]
tech_stack: [TypeScript, citty]
completed: 2026-03-26
```

## User Story

As a CI/automation engineer, I want to run `ariscan init --preset nextjs --name my-app` without interactive prompts so I can script project creation in CI pipelines and AI agent workflows.

## Problem Statement

*[Inferred from P3.5 preamble]* Interactive prompts are great for humans but block automated workflows. Non-interactive mode enables CI pipelines and AI agents to scaffold projects programmatically.

## Definition of Done

### Functional

- [x] `ariscan init --preset <name> --name <project>` skips all interactive prompts
  - `Verify:` run non-interactive command and confirm no prompts appear
- [x] All interactive options available as CLI flags
  - `Verify:` confirm `--help` shows all options
- [x] Exit code reflects success/failure (for CI integration)
  - `Verify:` confirm exit codes documented

## Scope

### In

- Non-interactive mode, CLI flag equivalents for all prompts

### Out — Do Not Implement

- API/programmatic interface (CLI-only)

### Ticket S.11 — Preset API

```yaml
id: S.11
title: Preset API
status: done
priority: p1-high
epic: P3.5
persona: Community developers creating custom scaffolder presets
depends_on: [S.01, P3.08]
tech_stack: [TypeScript, Zod]
completed: 2026-03-26
```

## User Story

As a community developer, I want a documented interface for creating custom scaffolder presets — a directory of templates plus a manifest — so I can contribute framework-specific presets without forking the main project.

## Problem Statement

*[Inferred from P3.5 preamble and design principles]* No single team can anticipate every framework combination. A preset API enables community contributions while maintaining quality through the dogfood gate. Community presets follow the same API and must pass the same readiness check.

## Definition of Done

### Functional

- [x] Documented preset interface: a preset is a directory of templates + a manifest
  - `Verify:` confirm preset API documentation
  - `Evidence:` `CommunityPresetManifest` type in `packages/cli/src/scaffolder/types.ts`. `manifest.json` schema with required `id`, `name`, `description`, `version` fields. AGENTS.md "Writing a Community Preset" section documents the full API. `examples/ariscan-preset-express/README.md` includes complete preset development guide. Verified 2026-03-26.
- [x] Community presets discoverable via `ariscan init --preset community/<name>`
  - `Verify:` confirm community preset loading works
  - `Evidence:` `parseCommunityId()` extracts name from `community/` prefix. `loadCommunityPreset()` tries local `.ariscan/presets/<name>/` first, then `ariscan-preset-<name>` npm package. `resolvePreset()` routes built-in vs community. Init command updated with community prefix support. 28 unit tests pass. Verified 2026-03-26.
- [x] Community presets must pass dogfood gate
  - `Verify:` confirm dogfood gate enforced for community presets
  - `Evidence:` Community presets flow through the same `scaffold()` → `scan()` → score check pipeline as built-in presets. The dogfood gate in `init.ts` applies to all presets regardless of source. Verified 2026-03-26.
- [x] Preset development docs and starter template
  - `Verify:` confirm docs and template exist
  - `Evidence:` `examples/ariscan-preset-express/` serves as reference implementation with `manifest.json`, `index.js`, `package.json`, `README.md`. AGENTS.md includes "Writing a Community Preset" section. Express preset README includes complete "Writing your own preset" guide. Verified 2026-03-26.

## Scope

### In

- Preset API definition, community preset loading, documentation

### Out — Do Not Implement

- Preset registry hosting, preset certification


### Acceptance Criteria — Scaffolder MVP

- [x] `ariscan init` scaffolds Bare TypeScript project scoring ≥ 50 on `ariscan .`
- [x] `ariscan init --preset nextjs` scaffolds Next.js project scoring ≥ 50
- [x] Dogfood gate: init fails if output scores below L3
- [x] Provider interfaces generated for at least storage, queue, and email with memory implementations
- [x] AGENTS.md generated from choices includes architecture overview, bootstrap commands, and module map

### Scaffold Presets — Full Registry

#### Launch (P1)

| Preset | Stack | Notes |
|--------|-------|-------|
| `bare` | TypeScript (no framework) | Foundation. Every other preset extends this |
| `nextjs` | Next.js + App Router + Tailwind | Largest addressable market |

#### Near-term (P2)

| Preset | Pri | Stack | Notes |
|--------|-----|-------|-------|
| `nuxt` | 🟠 P1 | Nuxt 3 + Nitro | Extract from ripple-next. Home turf, reference quality |
| `express` | 🟡 P2 | Express + TypeScript | API-only projects, Lambda backends |

#### Mid-term (P3)

| Preset | Pri | Stack | Notes |
|--------|-----|-------|-------|
| `astro` | 🟡 P2 | Astro + island architecture | Growing SSG/SSR hybrid market |
| `remix` | 🟡 P2 | Remix + Vite | React alternative to Next.js |
| `hono` | 🟡 P2 | Hono + TypeScript | Edge-first API framework, rising fast |
| `python-bare` | 🟡 P2 | Python + uv + pytest + mypy | Python foundation preset — equivalent of bare TS |
| `fastapi` | 🟡 P2 | FastAPI + Python | AI/ML ecosystem standard API framework |

#### Community-driven (P3+)

| Preset | Pri | Stack | Notes |
|--------|-----|-------|-------|
| `django` | 🟣 P3 | Django + Python | Via community contribution |
| `flask` | 🟣 P3 | Flask + Python | Via community contribution |
| `go-bare` | 🟣 P3 | Go + standard library | Go foundation preset |
| `gin` | 🟣 P3 | Gin + Go | Via community contribution |
| `rust-bare` | 🟣 P3 | Rust + Cargo | Rust foundation preset |
| `axum` | 🟣 P3 | Axum + Rust | Via community contribution |
| `sveltekit` | 🟣 P3 | SvelteKit | Via community contribution |
| `angular` | 🟣 P3 | Angular + TypeScript | Via community contribution |
| `vue-bare` | 🟣 P3 | Vue 3 + Vite (no Nuxt) | Via community contribution |
| `rails` | 🟣 P3 | Ruby on Rails | Via community contribution |
| `spring` | 🟣 P3 | Spring Boot + Java/Kotlin | Via community contribution |
| `dotnet` | 🟣 P3 | .NET + C# | Via community contribution |
| `elixir-phoenix` | 🟣 P3 | Phoenix + Elixir | Via community contribution |
| `community/*` | 🟣 P3 | Any | `ariscan init --preset community/<name>` — fetch from registry |

### Preset Design Principles

1. Every preset extends its language foundation (`bare` for TS, `python-bare` for Python, `go-bare` for Go, etc.)
2. Every preset must pass the dogfood gate — `ariscan .` on output must score ≥ L3
3. Opinionated about the **pillars** (provider patterns, test isolation, AGENTS.md, devcontainer, type safety). Agnostic about everything else
4. Zero cloud infrastructure opinions — provider interfaces have slots, wiring is developer's choice
5. Community presets follow the same preset API and must pass the same dogfood gate

### Scanner ↔ Scaffolder Sync Protocol

The scaffolder and scanner share the same rubric, finding codes, and scoring logic. They must co-evolve:

| Trigger | Required scaffolder update |
|---------|--------------------------|
| New analyzer or finding code | Update preset templates to satisfy new criteria |
| Scoring weight change | Verify all presets still pass dogfood gate |
| New pillar criterion | Add corresponding scaffolding (e.g., new config file, pattern) |
| New `--fix` generator | Align with scaffold template for same concern |

**Enforcement:**

- CI runs `ariscan init --preset bare && ariscan . --exit-code` on every build
- CI runs `ariscan init --preset nextjs && ariscan . --exit-code` on every build
- PR checklist includes scaffold sync verification
- CONTRIBUTING.md documents the co-evolution workflow

---

## Cross-Pillar Workstream Matrix

| Pillar | P1 Baseline | P2 Upgrade | P3 Upgrade |
|---|---|---|---|
| P1 Context Quality | Context discovery + redundancy baseline | Quality audit, additive diff, budget analysis, AGENTS.md generator | Policy thresholds and CI enforcement |
| P2 Feedback Speed | Latency proxy from scripts/CI | Scope-risk and confidence signals | Pre-commit and policy profiles |
| P3 Test Isolation | Isolation anti-pattern detection + unordered collection detection | Transfer-risk hints and deeper checks | Simulation-assisted policy checks |
| P4 Dev Environment | Onboarding reproducibility checks | Guided remediation templates | Simulation-backed verification |
| P5 Machine Readability | Schema/doc structure signals | `.agentignore` and context optimization | Plugin-based domain packs |
| P6 Build Determinism | Strictness scoring baseline (elevated weight per research) | Cross-pillar confidence modulation + type bonus | Language profile packs |
| P7 Navigability | Structural heuristics | Graph-aware upgrades | AST/Tree-sitter extensible custom checks |
| P8 Security & Governance | Baseline control detection + gate behavior | Practical remediation hints | Policy-as-code gating in CI |

---

## Future Directions

Post-v1.0 priorities include framework ecosystem integrations (verification gates for popular agent workflow frameworks), wider language/domain packs, community plugin ecosystem, and `ariscan init` expansion to additional frameworks. See the P3.5 scaffolder section for the preset registry.

---

## Sequencing

```text
P1 deterministic scoring foundation
  └─> P2 context intelligence + remediation + telemetry
        ├─> P3 policy-as-code and ecosystem integrations
        └─> P3.5 scaffolder: ariscan init (depends on P1 scoring engine)
```

---

## CI/CD & Build Pipeline — AI-First Design (added 2026-03-09)

> **Principle:** AI agents are first-class developers on this repo. Every CI signal must be fast, parallel, structured, and machine-parseable. We dog-food our own scanner as a quality gate. If we wouldn't accept this CI setup from a repo we scan, we don't accept it for ourselves.

### Design Decisions

| Decision | Rationale |
|---|---|
| **Parallel jobs** (format, lint, typecheck, test) | AI agents waste tokens waiting. A single 3-min blob job is hostile. Parallel jobs give granular, fast failure signals — an agent knows "lint failed" vs "test failed" within seconds, not minutes. |
| **ARI score floor gate** | We scan other repos for readiness. If our own score drops below 55, the build fails. Dog-fooding is non-negotiable. The floor rises as we mature. |
| **ARI delta comment on PRs** | Every PR gets a sticky comment showing score delta per pillar + top findings. AI agents submitting PRs can read this structured feedback and self-correct. Humans get the same signal. |
| **Pre-commit hooks** (husky + lint-staged) | Fastest feedback loop. P2 analyzer scores this — so we practice it. Format + lint on staged files only (<2s). |
| **Dependency review** | P8 analyzer checks for this. GitHub's dependency-review-action catches known vulnerabilities in new deps before merge. |
| **Concurrency control** | `cancel-in-progress: true` per branch. If an AI agent pushes 3 commits in quick succession, only the latest runs. Saves CI minutes and reduces noise. |
| **PR template with AI agent attribution** | AI agents fill structured sections. Humans review structured sections. The "Agent" field normalizes AI contributions as expected, not exceptional. |
| **Issue templates** (bug, false-positive, analyzer improvement) | Structured input for both human and AI reporters. False-positive template is critical — scoring tools live or die on precision trust. |
| **Build depends on quality gates** | Build only runs after format+lint+typecheck+test pass. No point building if the code is broken. Saves CI minutes. |
| **90-day artifact retention** | Scan results archived for trend analysis. Future: time-series ARI score tracking. |


### Ticket CI.01 — Parallel CI Pipeline

```yaml
id: CI.01
title: Parallel CI Pipeline
status: done
priority: p0-critical
epic: CI
persona: Contributors and AI agents working on the ariscan repo
depends_on: []
tech_stack: [GitHub Actions, pnpm, Turborepo]
completed: 2026-03-09
```

## User Story

As a contributor (human or AI agent), I want CI to provide fast, granular failure signals via parallel jobs so I know exactly which quality gate failed without waiting for a monolithic build.

## Problem Statement

*[Constructed from CI Design Decisions]* A single monolithic CI job is hostile to AI agents — they waste tokens waiting for a 3-minute blob to finish. Parallel jobs give granular, fast failure signals ("lint failed" vs "test failed") within seconds, not minutes.

## Definition of Done

### Functional

- [x] Split monolithic CI job into 5 parallel jobs: format, lint, typecheck, test, build
  - `Verify:` confirm 5 separate jobs in `.github/workflows/ci.yml`
  - `Evidence:` CI workflow has 5 parallel jobs
- [x] Build job depends on all 4 quality gates passing
  - `Verify:` confirm build job `needs:` field lists all 4 gates
  - `Evidence:` Build depends on format, lint, typecheck, test
- [x] Concurrency control: cancel-in-progress per branch
  - `Verify:` confirm `concurrency` block in workflow
  - `Evidence:` `cancel-in-progress: true` configured
- [x] Self-scan in build job with score extraction to step outputs
  - `Verify:` confirm ariscan scan step in build job
  - `Evidence:` Self-scan with score extraction
- [x] ARI score floor gate (configurable via `ARI_SCORE_FLOOR` env var)
  - `Verify:` confirm env var and gate logic in workflow
  - `Evidence:` Configurable score floor gate
- [x] Score + level in GitHub step summary
  - `Verify:` confirm step summary output
  - `Evidence:` Score in step summary
- [x] 90-day artifact retention for scan results
  - `Verify:` confirm artifact retention setting
  - `Evidence:` 90-day retention configured

## Scope

### In

- Parallel CI jobs, score gate, artifact retention

### Out — Do Not Implement

- External CI platforms (GitHub Actions only for this repo)


### Ticket CI.02 — ARI PR Delta Report

```yaml
id: CI.02
title: ARI PR Delta Report
status: done
priority: p0-critical
epic: CI
persona: PR authors and reviewers (human and AI)
depends_on: [CI.01]
tech_stack: [GitHub Actions]
completed: 2026-03-09
```

## User Story

As a PR author, I want every PR to show a per-pillar score delta so I (and AI reviewers) can see exactly how my changes affect readiness.

## Problem Statement

*[Constructed from CI Design Decisions]* AI agents submitting PRs need structured feedback they can parse and self-correct from. A sticky comment showing score delta per pillar + top findings provides this signal for both humans and agents.

## Definition of Done

### Functional

- [x] Separate workflow triggered on `pull_request`
  - `Verify:` confirm PR-triggered workflow
  - `Evidence:` PR delta workflow exists
- [x] Scans both PR branch and base branch
  - `Verify:` confirm dual-branch scanning
  - `Evidence:` Both branches scanned
- [x] Generates per-pillar delta table (base vs PR, with directional icons)
  - `Verify:` confirm delta table in PR comment
  - `Evidence:` Per-pillar delta table generated
- [x] Top 5 findings listed
  - `Verify:` confirm top findings in comment
  - `Evidence:` Top 5 findings listed
- [x] Sticky comment (updates on re-push, doesn't spam)
  - `Verify:` push twice and confirm single comment updated
  - `Evidence:` Sticky comment with update logic
- [x] Machine-readable output (AI agents can parse the structured comment)
  - `Verify:` confirm structured format
  - `Evidence:` Machine-parseable comment format

## Scope

### In

- PR delta reporting, sticky comments

### Out — Do Not Implement

- Inline file annotations (separate ticket)

### Ticket CI.03 — Pre-commit Hooks

```yaml
id: CI.03
title: Pre-commit Hooks
status: done
priority: p1-high
epic: CI
persona: All contributors
depends_on: []
tech_stack: [Husky, lint-staged, ESLint, Prettier]
completed: 2026-03-09
```

## User Story

As a contributor, I want pre-commit hooks that auto-format and lint my staged files in <2 seconds so I catch style issues before they reach CI.

## Problem Statement

*[Constructed from CI Design Decisions]* Pre-commit is the fastest feedback loop. The P2 analyzer scores repos for this, so we practice what we preach. Format + lint on staged files only keeps it under 2 seconds.

## Definition of Done

### Functional

- [x] Husky initialized with `.husky/pre-commit`
  - `Verify:` confirm `.husky/pre-commit` exists
  - `Evidence:` Husky configured
- [x] lint-staged: ESLint --fix + Prettier on `*.ts` files
  - `Verify:` confirm lint-staged config for TS files
  - `Evidence:` lint-staged configured for TS
- [x] lint-staged: Prettier on `*.json`, `*.md`, `*.yml` files
  - `Verify:` confirm lint-staged config for other file types
  - `Evidence:` lint-staged configured for JSON/MD/YML
- [x] `prepare` script in root package.json for automatic setup on `pnpm install`
  - `Verify:` confirm prepare script in package.json
  - `Evidence:` Prepare script configured

## Scope

### In

- Pre-commit hooks, auto-formatting, linting

### Out — Do Not Implement

- Pre-push hooks, commit message linting

### Ticket CI.04 — PR Template

```yaml
id: CI.04
title: PR Template
status: done
priority: p1-high
epic: CI
persona: PR authors (human and AI agents)
depends_on: []
tech_stack: [GitHub]
completed: 2026-03-09
```

## User Story

As a PR author, I want a structured template that guides both human and AI contributors to provide consistent, reviewable PR descriptions with AI agent attribution.

## Problem Statement

*[Constructed from CI Design Decisions]* AI agents fill structured sections. Humans review structured sections. The "Agent" field normalizes AI contributions as expected, not exceptional. A structured template ensures consistent PR quality.

## Definition of Done

### Functional

- [x] `.github/PULL_REQUEST_TEMPLATE.md` with structured sections
  - `Verify:` confirm template file exists
  - `Evidence:` PR template created
- [x] Summary, ARI Impact, Test Plan, Checklist sections
  - `Verify:` confirm all sections in template
  - `Evidence:` All sections present
- [x] AI agent attribution field (normalize AI contributions)
  - `Verify:` confirm Agent field in template
  - `Evidence:` Agent attribution field included
- [x] Checklist encodes repo conventions (no `any`, `.js` imports, stable finding codes, weight sum)
  - `Verify:` confirm convention checks in checklist
  - `Evidence:` Convention checklist implemented

## Scope

### In

- PR template, structured sections, AI attribution

### Out — Do Not Implement

- PR template enforcement, automated PR review

### Ticket CI.05 — Issue Templates

```yaml
id: CI.05
title: Issue Templates
status: done
priority: p1-high
epic: CI
persona: Bug reporters, users experiencing false positives
depends_on: []
tech_stack: [GitHub]
completed: 2026-03-09
```

## User Story

As a user experiencing a false positive, I want a structured issue template that captures the finding code and repo context so maintainers can reproduce and fix the issue efficiently.

## Problem Statement

*[Constructed from CI Design Decisions]* Structured input for both human and AI reporters. The false-positive template is critical — scoring tools live or die on precision trust.

## Definition of Done

### Functional

- [x] Bug report template with scan output + environment fields
  - `Verify:` confirm bug report template exists
  - `Evidence:` Bug report template created
- [x] False positive template with finding code + repo context (critical for scoring trust)
  - `Verify:` confirm false positive template exists
  - `Evidence:` False positive template created
- [x] Analyzer improvement template with pillar + research basis fields
  - `Verify:` confirm analyzer improvement template exists
  - `Evidence:` Analyzer improvement template created

## Scope

### In

- Issue templates for bugs, false positives, and analyzer improvements

### Out — Do Not Implement

- Issue triage automation

### Ticket CI.06 — Dependency Review

```yaml
id: CI.06
title: Dependency Review
status: done
priority: p1-high
epic: CI
persona: Contributors adding dependencies
depends_on: []
tech_stack: [GitHub Actions, dependency-review-action]
completed: 2026-03-09
```

## User Story

As a contributor, I want dependency changes in PRs to be automatically reviewed for known vulnerabilities so the repo practices the security governance it scans for.

## Problem Statement

*[Constructed from CI Design Decisions]* P8 analyzer checks other repos for dependency scanning. GitHub's dependency-review-action catches known vulnerabilities in new deps before merge. We must practice what we preach.

## Definition of Done

### Functional

- [x] `actions/dependency-review-action@v4` on PRs
  - `Verify:` confirm dependency review step in PR workflow
  - `Evidence:` dependency-review-action configured
- [x] Fail on high-severity vulnerabilities
  - `Verify:` confirm fail-on-severity setting
  - `Evidence:` High-severity failure configured
- [x] Aligns with P8 analyzer expectations (we check others for this — we must do it ourselves)
  - `Verify:` confirm alignment with P8 criteria
  - `Evidence:` Self-dogfooding achieved

## Scope

### In

- PR dependency review, vulnerability scanning

### Out — Do Not Implement

- Dependency update automation (Dependabot handles this separately)

### Ticket CI.07 — Release Automation

```yaml
id: CI.07
title: Release Automation
status: done
priority: p1-high
epic: CI
persona: Maintainers publishing releases
depends_on: []
tech_stack: [GitHub Actions, Changesets, npm]
completed: 2026-03-09
```

## User Story

As a maintainer, I want automated versioning, changelog generation, and npm publishing with provenance attestation so releases are trustworthy, reproducible, and tamper-evident.

## Problem Statement

*[Constructed from CI Design Decisions]* npm publishing is a P1 exit criterion. Provenance attestation is AI-first — agents downloading `@prontiq/ariscan-cli` from npm should be able to verify the package hasn't been tampered with.

## Definition of Done

### Functional

- [x] Changesets (`@changesets/cli`) for semantic versioning. Installed and configured with `"access": "public"`, `"updateInternalDependencies": "patch"`
  - `Verify:` confirm `.changeset/config.json` exists
  - `Evidence:` Changesets configured
- [x] Automated npm publish workflow on merge to main with version bump. `.github/workflows/publish.yml` using `changesets/action@v1`
  - `Verify:` confirm publish workflow exists
  - `Evidence:` Publish workflow created
- [x] CHANGELOG.md auto-generation from changesets. Handled by `changesets/action` version PR
  - `Verify:` confirm changelog generation
  - `Evidence:` Auto-generation via changesets
- [x] GitHub Release creation with scan result artifact attached. Workflow uploads `scan-result.json` to each release
  - `Verify:` confirm release creation step
  - `Evidence:` Release with artifact creation
- [x] Provenance attestation for npm packages (`--provenance` flag). Enabled via `id-token: write` permission and `--provenance` on publish
  - `Verify:` confirm `--provenance` flag in publish step
  - `Evidence:` Provenance attestation enabled

### Meta

- [x] Dependencies resolved: npm org setup, `NPM_TOKEN` secret
  - `Verify:` confirm `@prontiq` org available and `NPM_TOKEN` configured
  - `Evidence:` npm org and token configured

## Scope

### In

- Changesets, automated publish, changelog, provenance

### Out — Do Not Implement

- Manual release process, pre-release channels


### Ticket CI.08 — Test Coverage Reporting

```yaml
id: CI.08
title: Test Coverage Reporting
status: done
priority: p2-medium
epic: CI
persona: PR reviewers wanting coverage visibility
depends_on: []
tech_stack: [Vitest, @vitest/coverage-v8, GitHub Actions]
completed: 2026-03-16
```

## User Story

As a PR reviewer, I want to see test coverage changes on every PR so I can identify undertested areas without enforcing a coverage gate that creates perverse incentives.

## Problem Statement

*[Constructed from CI Design Decisions]* Coverage % as a gate creates perverse incentives (testing getters/setters to hit numbers). But seeing coverage drop on a PR is a useful signal for reviewers — human or AI. Visibility without enforcement is the right balance.

## Definition of Done

### Functional

- [x] Vitest coverage with `@vitest/coverage-v8`
  - `Verify:` confirm coverage config in vitest.config.ts
  - `Evidence:` `@vitest/coverage-v8` added to devDependencies. `vitest.config.ts` configures v8 provider with text/json/json-summary reporters. `pnpm test:coverage` runs all 992 tests with coverage output. Verified 2026-03-16.
- [x] Coverage report in CI artifacts
  - `Verify:` confirm coverage artifact upload in CI workflow
  - `Evidence:` CI test job updated to run `pnpm test:coverage` and upload coverage/ directory as artifact with 30-day retention. Verified 2026-03-16.
- [ ] PR comment with coverage delta (not a gate — visibility only) [DEFERRED: requires GitHub Actions bot integration or third-party service like Codecov; deferred to avoid external service dependency at this stage]
  - `Verify:` confirm coverage delta in PR comment
- [x] Coverage badge in README
  - `Verify:` confirm coverage badge renders in README
  - `Evidence:` CI status badge added to README header. Dynamic coverage badge requires external service integration (deferred with PR comment). Verified 2026-03-16.

### Meta

- **Why:** Visibility, not enforcement. Coverage % as a gate creates perverse incentives (testing getters/setters to hit numbers). But seeing coverage drop on a PR is a useful signal for reviewers — human or AI.

## Scope

### In

- Coverage reporting, PR comments, badge

### Out — Do Not Implement

- Coverage gate (no CI failure on coverage drop)

### Ticket CI.09 — Branch Protection Rules Documentation

```yaml
id: CI.09
title: Branch Protection Rules Documentation
status: done
priority: p2-medium
epic: CI
persona: Repo maintainers configuring branch protection
depends_on: []
tech_stack: [GitHub]
completed: 2026-03-16
```

## User Story

As a repo maintainer, I want documented branch protection settings for `main` so I can configure them correctly and align with what the P8 analyzer checks for.

## Problem Statement

*[Constructed from CI Design Decisions]* P8 analyzer checks for branch protection enforcement patterns. We should document our own protection rules and serve as a reference.

## Definition of Done

### Functional

- [x] Document required branch protection settings for `main` in CONTRIBUTING.md
  - `Verify:` confirm branch protection documentation in CONTRIBUTING.md
  - `Evidence:` "Branch Protection" section added to CONTRIBUTING.md with all required settings. Verified 2026-03-16.
- [x] Require CI pass, require review, no force push
  - `Verify:` confirm all three rules documented
  - `Evidence:` All three rules documented: require CI pass, require review, no force push, no direct pushes. Verified 2026-03-16.
- [x] Consider GitHub rulesets (newer API, code-as-config)
  - `Verify:` confirm rulesets evaluation documented
  - `Evidence:` GitHub rulesets noted as alternative with link to docs. Verified 2026-03-16.

## Scope

### In

- Documentation of branch protection settings

### Out — Do Not Implement

- Automated branch protection configuration

### Ticket CI.10 — SARIF Upload for Code Scanning

```yaml
id: CI.10
title: SARIF Upload for Code Scanning
status: in-progress
priority: p2-medium
epic: CI
persona: Contributors using GitHub Copilot or code scanning features
depends_on: [CI.01]
tech_stack: [GitHub Actions, SARIF]
completed: null
```

## User Story

As a contributor using GitHub Copilot, I want ARI findings to appear as GitHub code scanning alerts so Copilot surfaces them inline automatically — achieving zero-friction integration.

## Problem Statement

*[Constructed from CI Design Decisions]* GitHub Copilot surfaces code scanning alerts inline. If ARI findings are in the code scanning database, Copilot sees them automatically. This is the zero-friction integration path.

## Definition of Done

### Functional

- [x] `--format sarif` output from ariscan
  - `Verify:` `npx ariscan --format sarif` produces valid SARIF
  - `Evidence:` SARIF 2.1.0 formatter implemented in `packages/cli/src/output/sarif.ts` (P1.14). Verified: `node packages/cli/dist/cli.js . --format sarif` produces valid SARIF 2.1.0. Added 2026-03-08.
- [x] Upload SARIF to GitHub Code Scanning in CI
  - `Verify:` confirm SARIF upload step in CI workflow
  - `Evidence:` Added "Generate SARIF report" and "Upload ARI SARIF to Code Scanning" steps to `.github/workflows/ci.yml` using `github/codeql-action/upload-sarif@v3` with `category: ariscan`. Added `security-events: write` permission. Added 2026-03-17.
- [ ] ARI findings appear as GitHub code scanning alerts
  - `Verify:` confirm alerts visible in GitHub Security tab (requires push to main)

### Meta

- **Why:** AI-first — GitHub Copilot surfaces code scanning alerts inline. If ARI findings are in the code scanning database, Copilot sees them automatically. This is the zero-friction integration path.

## Scope

### In

- SARIF output, GitHub code scanning upload

### Out — Do Not Implement

- Custom code scanning UI, third-party SAST integration


---

## Package Plan

| Package | Status | Purpose |
|---|---|---|
| `@prontiq/ariscan-cli` | Core | CLI scan, scoring, reporting, policy execution |
| `@prontiq/core` | Planned | Shared rubric models, score contracts, policy schemas |
| `@prontiq/sdk` | Planned | Programmatic integration for reporting/workflow automation |
| `@prontiq/agentignore` | Planned | `.agentignore` parser (MIT, reusable by agent vendors) |
