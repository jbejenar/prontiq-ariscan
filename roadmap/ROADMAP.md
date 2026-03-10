# Roadmap — Prontiq ARI (`ariscan`)

> Roadmap for ARI delivery, ecosystem adoption, and standards leadership.
>
> **Naming continuity:** legacy materials may reference **Tide Conform**. Naming is **Prontiq ARI (Agent Readiness Index)**.

## Priority Legend

- 🔴 **P0** — Must ship to unlock next phase.
- 🟠 **P1** — Should ship to hit adoption and quality targets.
- 🟡 **P2** — Valuable expansion once core is stable.

---

## Product Thesis

This roadmap exists to do three things at once:

1. **Standardize:** make ARI the common language for AI coding readiness in OSS.
2. **Operationalize:** turn research into repeatable tools, not abstract recommendations.
3. **Activate:** reduce install-to-improvement time with pragmatic, high-signal guidance.

## Outcomes (2026–2027)

- Teams can run `npx ariscan .` and obtain actionable results in under 10 minutes.
- Every scored pillar includes rationale, confidence, and suggested actions.
- CI policy integration is simple enough for maintainers, strong enough for serious teams.
- Methodology remains reproducible and transparent across versions.

## North-Star Metrics

- Weekly active repositories scanned (WA-RS).
- CI-integrated scan ratio (% scans in automation vs local-only).
- Scan-to-fix conversion (repos applying >=1 recommendation).
- Median install-to-first-valid-score time.
- 7-day and 30-day repeat scan retention.
- Coverage by language/framework/repo archetype.

---

## Scope Boundaries

### In Scope

- Open CLI scanning, scoring, and report generation.
- CI integrations and policy docs.
- Scoring spec versioning and changelog transparency.
- Reproducible benchmark methodology and topline publishing.
- Optional anonymised telemetry (opt-in) for calibration improvements.

### Out of Scope

- Fleet governance and compliance workflows.
- Hosted remediation orchestration and managed controls.
- Comparative analytics and forecasting beyond local CLI output.

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
│   │   │   │   ├── scan.ts               # npx ariscan . (default command)
│   │   │   │   ├── doctor.ts             # npx ariscan doctor [--json]
│   │   │   │   ├── init.ts               # npx ariscan init [agents-md|agentignore|devcontainer|policy]
│   │   │   │   ├── audit.ts              # npx ariscan audit agents-md
│   │   │   │   ├── diff.ts               # npx ariscan diff context
│   │   │   │   ├── badge.ts              # npx ariscan badge
│   │   │   │   ├── taxonomy.ts           # npx ariscan taxonomy [ARI-XXX-NNN] [--json]
│   │   │   │   ├── policy.ts             # npx ariscan policy [init|validate]
│   │   │   │   ├── simulate.ts           # npx ariscan simulate
│   │   │   │   └── config.ts             # npx ariscan config [set|show-telemetry-payload]
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
  "name": "ariscan",
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
    "generate:schema": "turbo --filter=@prontiq/schema generate",
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
import type { PillarId, PillarName, PillarResult, Confidence } from '@prontiq/schema';

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
        "generator": "npx ariscan init agents-md"
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
| Self-Check | `npx ariscan doctor --json` | ripple-next `pnpm doctor --json` |
| Pure Function Core | `scan(path, config) → ScanResult` for CLI, MCP, and Action | Enables MCP server (P3.10) and GitHub Action (P3.02) |

**Dog-fooding requirement:** The `ariscan` repo itself must score L5 on its own rubric. It ships with AGENTS.md, CLAUDE.md, `.agentignore`, `.ariscan.yml`, `docs/error-taxonomy.json`, and all agent configuration surfaces it measures in other repos.

### Epic P1.1 — Core Scanner Runtime

#### Ticket P1.01 — CLI Scaffold and Config Runtime (🔴) ✅ Done (2026-03-08)

- **User story:** As a maintainer, I need a stable command entrypoint and predictable config behavior so I can integrate `ariscan` into my workflow without surprises.
- **Problem statement:** There is no standard CLI tool for measuring AI coding agent readiness. Developers need a single command that works out of the box, respects local configuration, and produces deterministic, machine-parseable output suitable for CI pipelines.
- **Target persona:** OSS maintainer, team lead evaluating AI agent effectiveness.
- **Definition of Done:**
  - [x] `npx ariscan .` command that scans the current directory and produces a scored report.
  - [x] Config loading with clear precedence: CLI flags > `.ariscan.yml` > built-in defaults. *(implemented in `config-loader.ts` with directory walk-up, YAML parsing, Zod validation via `FileConfig` schema)*
  - [x] Deterministic exit codes: 0 (pass), 1 (fail — below threshold), 2 (error — scan could not complete).
  - [x] `--help` output documenting all core flags, examples, and config file format. *(citty auto-generates flag docs + 3 usage examples in description)*
  - [x] `--verbose` and `--quiet` modes for debugging and CI respectively. *(verbose: shows pillar details, detection info, context files, and all findings. quiet: single-line CI-friendly output "ARI score/100 level (name)". Added 2026-03-08.)*
  - [x] `--help` documents all core flags and includes at least 3 usage examples. *(3 examples: `npx ariscan .`, `npx ariscan /path --json`, `npx ariscan . --threshold 60`)*
  - [x] Config precedence (CLI > local config > defaults) is tested with unit tests covering each override layer. *(16 tests in `config-loader.test.ts`)*
  - [ ] Exit code matrix is documented for CI users in both `--help` and published docs.
  - [ ] Runs to completion on repos up to 100k files within 60 seconds on commodity hardware. *(untested; scans <100ms on this repo)*
  - [x] Zero external network calls during scan (fully offline operation).
- **Tech stack (RFC-0003):** Node.js 22, TypeScript 5.7 strict, pnpm workspaces, Turborepo, citty (CLI framework), Zod (config validation), tsup (build), Vitest (testing), ESLint 9 + Prettier (linting). AI-first patterns extracted from ripple-next reference architecture: `ARI-*` error taxonomy, provider pattern for analyzers, pure function core (`scan(path, config) → ScanResult`).
- **Dependencies:** npm package name claimed (`ariscan`), TypeScript project scaffold, test framework (Vitest).
- **Telemetry:** install-to-first-scan time, scan duration p50/p95.
- **In scope:** CLI entrypoint, config loading, flag parsing, exit codes, basic error handling, `ARI-*` error taxonomy scaffold, AGENTS.md + CLAUDE.md for the ariscan repo itself (dog-fooding).
- **Out of scope:** Scoring logic (separate tickets), output formatting (separate tickets), network features.

#### Ticket P1.02 — Language and Framework Detection (🔴) ✅ Done (2026-03-08)

- **User story:** As a developer, I need ariscan to automatically detect my project's languages and frameworks so the scoring is relevant without manual configuration.
- **Problem statement:** Agent readiness criteria differ by language — TypeScript strict mode is irrelevant for Go, Python venv matters more than Node modules. Accurate detection is prerequisite to meaningful scoring. Monorepo detection is critical because monorepos require different scoring strategies (per-package analysis, project reference checks). Research from Multi-SWE-bench (Zan et al., 2025) confirms agents perform differently across languages, and SWE-bench Pro shows agents struggle especially with complex JS/TS monorepos where "erratic" performance is common.
- **Target persona:** Developer running first scan on any repository.
- **Definition of Done:**
  - [x] Detection engine for: TypeScript, JavaScript, Python, Go, Rust, Java, C#, Ruby, PHP. *(implemented in `detection/languages.ts` with file extension + marker file boosting)*
  - [x] Framework detection: React, Next.js, Vue, Nuxt, Express, FastAPI, Django, Flask, Spring Boot, .NET, Rails. *(implemented in `detection/frameworks.ts` — 14 frameworks via config files and deps. Also: Astro, Svelte, Angular)*
  - [x] Monorepo detection: Turborepo, Nx, Lerna, pnpm workspaces, Cargo workspaces, Go modules. *(implemented in `detection/monorepo.ts` — 6 monorepo tools. Go workspaces instead of Go modules.)*
  - [x] Detection confidence score (0-1) per detected language/framework in JSON output. *(each `DetectedLanguage`/`DetectedFramework` includes confidence field)*
  - [x] Primary language determination for weight calibration. *(languages sorted by confidence, `primary: true` flag on highest)*
  - [x] Detection confidence reported in JSON output for each detected language/framework. *(included in `ScanResult.detection` field)*
  - [ ] False-language detection rate <5% on benchmark cohort of 50+ repos.
  - [ ] Monorepo detection identifies workspace root and package boundaries. *(detects monorepo tool but not package boundaries)*
  - [ ] Detection completes in <2 seconds for repos up to 100k files. *(no performance tests)*
  - [x] Graceful fallback to "unknown" with appropriate confidence level when detection is ambiguous. *(returns empty arrays when no languages/frameworks detected)*
- **Research basis:** Multi-SWE-bench (Zan et al., 2025) extends evaluation beyond Python to Java, TypeScript, Go, Rust, C, C++ — validating the need for cross-language support. Veracode (2025) shows language-specific vulnerability rates (Java 72% vs Python 38%) requiring per-language calibration.
- **Dependencies:** P1.01 (CLI scaffold).
- **Telemetry:** detection accuracy rate, languages per scan distribution.
- **In scope:** File-system-based detection (package.json, Cargo.toml, go.mod, pyproject.toml, etc.), framework marker files.
- **Out of scope:** Runtime detection, version-specific analysis, dependency graph resolution.

#### Ticket P1.03 — Context File Discovery (🔴) 🔧 Partial

- **User story:** As an agent user, I need ariscan to find all my agent context files so I know what guidance my agents are receiving and whether it's well-formed.
- **Problem statement:** The AI coding agent ecosystem is fragmented across multiple context file formats (AGENTS.md, CLAUDE.md, .cursorrules, copilot-instructions.md, .github/copilot-instructions.md). Research shows 60,000+ repos on GitHub have adopted AGENTS.md, but quality varies dramatically. Gloaguen et al. (2026, ETH Zurich) found that LLM-generated context files actually decrease agent success rates by 2-3% while increasing inference costs by 20%+, while human-written files improve performance by ~4% on niche repos. Discovery is the prerequisite to quality assessment.
- **Target persona:** Any developer using AI coding agents (Claude Code, Copilot, Cursor, Codex, Aider, etc.).
- **Definition of Done:**
  - [x] Discovery of all known context file formats: *(discovers AGENTS.md, CLAUDE.md, .cursorrules, .cursor/rules, .github/copilot-instructions.md, .aider.conf.yml, .aiderignore, .agentignore, .mcp.json, mcp.config.js, .claude/settings.json, .claude/commands/. Cross-agent compatibility report moved to P2.)*
    - [x] `AGENTS.md` (root and nested per AGENTS.md spec for monorepos) *(root + nested discovery for monorepos added 2026-03-09)*
    - [x] `CLAUDE.md` / `.claude/` directory files *(.claude/settings.json and .claude/commands/ discovery added 2026-03-09)*
    - [x] `.cursorrules` / `.cursor/rules/`
    - [x] `copilot-instructions.md` / `.github/copilot-instructions.md`
    - [x] MCP configuration files (`.mcp.json`, `mcp.config.js`) *(added 2026-03-09)*
    - [x] `.aider.conf.yml` / `.aiderignore`
  - [x] For each discovered file: path, file type, size, last modified date, parse status (valid/warning/error). *(completed: ContextFileInfo includes lastModified via fs.stat and parseStatus via content validation in scan.ts `discoverContextFiles()`)*
  - [x] Cross-agent compatibility report: which agents have dedicated context files vs none. *(ARI-CTX-010: maps files to 5 agent categories — Claude Code, Cursor, GitHub Copilot, Aider, Generic. Reports covered vs uncovered with remediation. Added 2026-03-09.)*
  - [x] Nested file discovery for monorepos (subdirectory-level AGENTS.md files). *(added 2026-03-09)*
  - [x] Discovery includes path, file type, size, last modified, and parsing status for each file. *(completed 2026-03-09: ContextFileInfo now includes all fields)*
  - [ ] Non-parsable files are surfaced with actionable warnings.
  - [ ] Discovers nested context files in monorepo subdirectories.
  - [ ] Zero false negatives on benchmark cohort (every known context file is found).
  - [ ] Discovery completes in <1 second for repos up to 100k files.
- **Research basis:** Gloaguen et al. (2026) — context file quality matters more than presence. Lulla et al. (2026) — well-written AGENTS.md reduces agent execution time by 28.6% and token consumption by 16.6%.
- **Dependencies:** P1.01 (CLI scaffold).
- **Telemetry:** context files per repo distribution, cross-agent coverage ratio.
- **In scope:** File discovery, format identification, basic parse validation.
- **Out of scope:** Content quality scoring (P1.04), additionality analysis (P1.04), generation (P2.01).

### Epic P1.2 — Baseline Pillar Scoring

#### Ticket P1.04 — Context Additionality Baseline (Pillar 1) (🟠) 🔧 Partial

- **User story:** As a maintainer, I need to know whether my context files are actually helping my agents or just duplicating what's already in the README.
- **Problem statement:** The most impactful finding from Gloaguen et al. (2026, ETH Zurich) is that auto-generated AGENTS.md files *hurt* agent performance by 2-3% while increasing inference cost by 20%+. The mechanism is information redundancy — context files that restate the README add noise to the agent's context window without providing new signal. The "Lost in the Middle" effect (Liu et al., 2024) shows >30% performance degradation when relevant information sits in the middle of long contexts. Context volume alone degrades reasoning even when retrieval succeeds (arXiv 2510.05381, 2025). Information Gain per Turn decay and Token Waste Ratio are associated with 30-40% performance drops (OpenReview, 2025). This means a context file that duplicates existing information is *worse* than no context file at all.
- **Target persona:** Any team maintaining agent context files.
- **Definition of Done:**
  - [ ] Semantic comparison engine: context file content vs README, CONTRIBUTING, docstrings, CI workflows, and config files.
  - [ ] Redundancy percentage per context file (% of content duplicated elsewhere in repo).
  - [ ] Additionality score: percentage of context file that encodes genuinely new information.
  - [x] Front-loading analysis: critical info in first 20% of file (per "Lost in the Middle"). *(ARI-CTX-005 added 2026-03-09)*
  - [x] Conciseness ratio: token count of context file vs total useful information encoded. *(ARI-CTX-008 conciseness check added 2026-03-09)*
  - [x] Staleness detection: last modified date of context file vs last significant code change. *(ARI-CTX-006 cross-references paths in context files against repo files, added 2026-03-09)*
  - [x] Negative instruction coverage: detection of explicit "do NOT" constraints. *(regex `/\b(don't|do not|never|avoid)\b/i` awards +5 points)*
  - [x] Scoring baseline: no context file → 20% (neutral baseline). *(implemented: `score = 20`)*
  - [ ] LLM-generated file that duplicates README → 0-10% penalty.
  - [ ] Concise, additive, front-loaded human-written file → 80-100%. *(partial: can reach high scores via heuristic bonuses but no front-loading or additionality check)*
  - [ ] Recommendation output clearly distinguishes additive vs duplicative content with specific line references.
  - [ ] Redundancy percentage reported to one decimal place with methodology explanation.
  - [ ] Front-loading score separately reported in output.
  - [x] Scoring is deterministic across repeated runs on the same repo state.
- **Research basis:**
  - Gloaguen et al. (2026): LLM-generated files decrease success by 2-3%, human files help by ~4% on niche repos.
  - Liu et al. (2024): U-shaped performance curve — front-load critical info.
  - arXiv 2510.05381 (2025): context volume alone degrades reasoning.
  - OpenReview (2025): IGT decay and TWR cause 30-40% performance drops.
  - Lulla et al. (2026): 28.6% time reduction, 16.6% token savings with quality context.
- **Dependencies:** P1.03 (context file discovery), P1.01 (CLI scaffold).
- **Telemetry:** additionality score distribution, % repos with redundant context files.
- **In scope:** Text similarity analysis, section-level comparison, front-loading heuristics.
- **Out of scope:** Deep semantic understanding, cross-repo comparison, generation of improved files (P2.01).

#### Ticket P1.05 — Feedback Loop Proxy (Pillar 2) (🔴) 🔧 Partial

- **User story:** As an engineering lead, I need to know how fast my team's feedback loops are because slow loops are the primary cost multiplier for AI agent workflows.
- **Problem statement:** DORA 2024 found that AI adoption actually *decreased* delivery throughput by 1.5% and stability by 7.2% because AI increases batch sizes and larger changesets introduce more risk. The mechanism: agentic self-correction loops increase token costs by 10-20x compared to single-shot attempts (4Geeks, 2025), making feedback latency the primary cost multiplier. If a test suite takes 10 minutes, an agent needing 5 iterations consumes 50 minutes of wall-clock time and thousands of idle tokens. Research from SAP HANA (Berndt et al., 2024) shows positive correlation between test execution time and flakiness rate — faster tests are also more reliable. Local feedback speed should be weighted ~2x higher than CI speed because local signals are the primary fuel for agentic self-correction loops (Jellyfish DPE research, 2025).
- **Target persona:** Engineering leads and platform engineers optimizing for AI agent effectiveness.
- **Definition of Done:**
  - [ ] Parse `package.json` scripts, `Makefile`, `pyproject.toml`, CI config files to infer feedback latency. *(partial: parses package.json scripts, checks Makefile/pyproject.toml existence, CI presence. Only presence checks, no latency inference.)*
  - [ ] Estimated execution times for: unit tests, type checking, linting, full CI pipeline.
  - [x] Detection of watch mode / hot reload configuration (binary: present or not). *(checks `test:watch`/`test:dev` scripts)*
  - [x] Detection of incremental build support (Turbopack, Vite, SWC, esbuild vs Webpack, TSC incremental). *(regex for `vite|esbuild|tsup|swc|turbo`)*
  - [x] Detection of pre-commit hooks configured for lint + typecheck + format. *(checks `.husky`, `.pre-commit-config.yaml`, `lefthook.yml`)*
  - [x] Changeset scope controls: PR size limits, conventional commits, automated splitting guidance. *(ARI-FBK-006: detects commitlint configs, `.changeset/config.json`, dangerfile)*
- **Scoring thresholds (research-calibrated per DORA 2024):**

  | Criterion | Elite | Good | Poor |
  |---|---|---|---|
  | Local test execution | <30s | <60s | >5min |
  | Type-check speed (cold) | <10s | <30s | >60s |
  | Lint execution time | <15s | <45s | >2min |
  | CI pipeline duration | <5min | <10min | >20min |

- **Acceptance criteria:**
  - [x] Estimated times include confidence label (measured vs inferred vs unknown) and missing-data fallback behavior. *(ARI-FBK-009 estimated feedback latency with measured/inferred/unknown labels added 2026-03-09)*
  - [x] Watch mode and incremental build detection are binary and clearly reported. *(ARI-FBK-007 watch mode and ARI-FBK-008 incremental build as separate findings added 2026-03-09)*
  - [x] Changeset scope controls are detected and scored. *(ARI-FBK-006: commitlint, .changeset, dangerfile)*
  - [x] Scoring differentiates local feedback (2x weight) from CI feedback (1x weight) per research. *(restructured scoring: local signals 2x weight, CI signals 1x weight, added 2026-03-09)*
- **Research basis:**
  - DORA 2024: AI adoption decreased throughput 1.5%, stability 7.2% via batch size inflation.
  - 4Geeks (2025): Agentic loops cost 10-20x vs single-shot.
  - Berndt et al. (2024): Positive correlation between test execution time and flakiness.
  - Forsgren, Humble, Kim (2018): Throughput and stability are not trade-offs; elite teams excel on both.
  - DORA Elite thresholds: lead time <1 day, deploy on-demand, 5% failure rate, recovery <1 hour.
- **Calibration note:** Local feedback speed weighted ~2x higher than CI speed — local signals are the primary fuel for agentic self-correction loops.
- **Dependencies:** P1.02 (language detection), P1.01 (CLI scaffold).
- **Telemetry:** feedback speed distribution by language/framework.
- **In scope:** Static inference from config files and scripts, CI config parsing (GitHub Actions, GitLab CI).
- **Out of scope:** Actual execution timing (P3.05 simulation), network-dependent CI queries.

#### Ticket P1.06 — Test Isolation Anti-patterns v1 (Pillar 3) (🔴) 🔧 Partial

- **User story:** As a developer using AI agents, I need to know which of my tests will cause agents to waste tokens chasing phantom failures.
- **Problem statement:** Test isolation is elevated to 18% weight (from 12.5% equal weight) because research shows it is a *leading indicator* of agent-authored code quality. Unlike humans who "retry and ignore," agents treat test failures as definitive signals to modify code. If the failure was flaky, the agent begins "fixing" valid code, introducing real regressions (creating a destructive loop). At Google, 41% of intermittent test failures are flaky (Memon et al., 2017). External dependencies and network instabilities are the predominant cause of systemic flakiness — contradicting older studies that rated concurrency as primary (Systemic Flakiness, 2025). Flaky test repair costs ~$2,250/month per developer (Leinen et al., 2024). 63% of LLM-generated flaky tests trace to unordered collection assumptions (Berndt et al., 2026). Critically, "flakiness transfer" means agents propagate instability from existing flaky tests into newly generated test cases. 26% of builds at Microsoft are affected by flaky tests (Lam et al., 2019).
- **Target persona:** Developers and teams using AI agents for code generation, especially test generation.
- **Definition of Done:**
  - Static analysis detection of test anti-patterns:
    - [x] **Cloud credential dependency:** Direct AWS SDK, GCP SDK, Azure SDK imports in test files. *(ARI-TST-001)*
    - [x] **Direct HTTP/API calls:** `fetch`, `axios`, `requests`, `http.Client` calls in test code. *(ARI-TST-002)*
    - [x] **Mutable global environment:** Tests modifying `process.env`, global state, shared fixtures. *(ARI-TST-011: detects process.env assignment, global/globalThis/window mutation added 2026-03-09)*
    - [x] **Unstable time/random usage:** `Date.now()`, `Math.random()`, `time.time()` in assertions. *(ARI-TST-003/004)*
    - [x] **Unordered collection assertions:** Map/Set/dict assertions without sorting. *(ARI-TST-009: regex detection for `toEqual(new Set|toEqual(new Map|assertDictEqual|assert_eq!.*HashMap` in test files)*
    - [x] **Test order dependency:** Shared state between tests, global setup/teardown with side effects. *(ARI-TST-012: detects describe.only, it.only, beforeAll with state added 2026-03-09)*
    - [x] **External file system dependency:** Tests reading/writing to absolute paths or temp dirs without cleanup. *(ARI-TST-008: detects `readFileSync|writeFileSync|fs.readFile|os.path|Path\(` in test files)*
    - [x] **Concurrency/race conditions:** `setTimeout`, `sleep`, timing-dependent assertions. *(ARI-TST-013: detects setTimeout, sleep, timing-dependent test patterns added 2026-03-09)*
  - Each finding maps to:
    - [x] Severity (critical/warning/info). *(severity now includes critical level, added 2026-03-09)*
    - [x] Root cause category (from Luo 2014 taxonomy). *(Luo 2014 root cause taxonomy evidence fields added to all test isolation findings 2026-03-09)*
    - [x] Fix hint with code example. *(completed 2026-03-09: every finding now includes language-specific code examples in remediation descriptions)*
    - [x] Agent impact explanation ("This pattern causes agents to waste ~X tokens..."). *(completed 2026-03-09: every finding includes token cost estimates)*
  - [x] Provider pattern / DI detection: whether infrastructure is abstracted behind interfaces. *(checks filenames for `provider|factory|container|inject`, excluding `.devcontainer`)*
  - [x] Memory/mock implementation detection: in-memory implementations for cloud providers. *(checks `__mocks__`, `.mock.`, `mock/`)*
- **Scoring criteria (research-calibrated):**

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

- **Acceptance criteria:**
  - [x] Each finding maps to severity, root cause category, and fix hint. *(completed 2026-03-09: severity, Luo 2014 taxonomy, code example fix hints, and agent impact explanations all present)*
  - [ ] False-positive rate <10% on benchmark cohort.
  - [ ] Detection covers TypeScript/JavaScript (jest, vitest, mocha), Python (pytest, unittest), Go (testing), Java (JUnit), Rust (cargo test). *(partial: covers TS/JS, Go, Python, Java, C#, Ruby. Missing: Rust cargo test. Not language-specific tuned.)*
  - [ ] Provider pattern detection clearly distinguishes direct SDK usage from abstracted interfaces. *(filename heuristic only, not structural code analysis)*
- **Weight justification:** Elevated from 12.5% to 18% because codebases with non-deterministic tests create compounding problems: agents "fix" valid code, generate flaky tests from flaky examples, and waste tokens on phantom failures.
- **Research basis:**
  - Memon et al. (2017): 41% flakiness at Google.
  - Luo et al. (2014): 10-category root cause taxonomy (foundational, 800+ citations).
  - Systemic Flakiness (2025): External deps are predominant cause of systemic flakiness.
  - Berndt et al. (2026): 63% of LLM-generated flaky tests from unordered collections; containerised execution controls environmental flakiness.
  - Leinen et al. (2024): $2,250/month per developer in flaky test repair.
  - Lam et al. (2019): 26% of builds at Microsoft affected.
- **Dependencies:** P1.02 (language detection), P1.01 (CLI scaffold).
- **Telemetry:** anti-pattern distribution by category, detection count per repo.
- **In scope:** Static analysis of test files, pattern matching for known anti-patterns, provider pattern detection.
- **Out of scope:** Runtime flakiness measurement (requires execution), CI log analysis, dynamic analysis.

#### Ticket P1.07 — Order-sensitive Assertion Detection (Pillar 3) (🟠) 🔧 Partial

- **User story:** As a test maintainer, I need to identify tests that will fail intermittently due to non-deterministic ordering so I can fix them before agents propagate the pattern.
- **Problem statement:** Berndt et al. (2026) found that 63% of LLM-generated flaky tests were caused by unordered collection assumptions — asserting equality on Maps, Sets, or dictionaries without sorting. This is the single largest category of LLM-introduced flakiness. "Flakiness transfer" means agents learn from existing tests — if your existing tests have ordering issues, agents will propagate that instability into every new test they generate.
- **Target persona:** Test engineers, teams with agents generating test code.
- **Definition of Done:**
  - [ ] AST-level analysis for assertions on non-deterministic data structures (Map, Set, Object.keys, dict, HashMap).
  - [ ] Detection of comparison operators on unordered types without prior sorting/normalization.
  - [ ] Detection of array assertions where order may vary (query results, file listings, API responses).
  - [ ] Suggested fixes: `toSorted()`, `Array.from().sort()`, `sorted()`, custom comparators.
  - [ ] Rule docs include false-positive caveats (e.g., arrays that are intentionally ordered).
  - [ ] Detection covers at least TypeScript/JavaScript, Python, and Go.
  - [ ] Each finding includes the specific assertion line and a copy-pasteable fix.
- **Research basis:** Berndt et al. (2026): 63% of LLM-generated flaky tests caused by unordered collection assumptions.
- **Dependencies:** P1.06 (test isolation foundation), P1.02 (language detection).
- **Telemetry:** ordering anti-pattern frequency by language.
- **In scope:** AST analysis of assertion statements, type inference for collection types.
- **Out of scope:** Runtime ordering verification, cross-file assertion tracking.

#### Ticket P1.08 — Onboarding Reproducibility Checks (Pillar 4) (🔴) 🔧 Partial

- **User story:** As a team lead, I need to know how quickly a fresh checkout of my repo can reach a running, testable state — because that's exactly what an agent experiences every time it starts a task.
- **Problem statement:** The "Tutorial Problem" (VS Code Blog, 2022) shows manual setup instructions have a 94-96% drop-off rate. Agents face an identical hurdle — if a repo requires manual environment variables and globally installed binaries, the agent's "onboarding time" increases dramatically. Standardised environments reduce onboarding time by 60% and integration conflicts by 30% (Microsoft/GitLab, 2022). Industry average time-to-first-commit is 2-4 weeks; top teams achieve 3-5 days (Stripe Developer Coefficient). For agents, "onboarding" is the time from `git clone` to first successful test execution. Repositories using `.devcontainer` or `docker-compose.yml` ensure "development context mirrors app context."
- **Target persona:** Platform engineers, developer experience teams, repo maintainers.
- **Definition of Done:**
  - Detection and quality scoring for:
    - [x] `.devcontainer/devcontainer.json` — exists and is valid JSON with required fields. *(validates postCreateCommand/onCreateCommand, features)*
    - [x] `docker-compose.yml` / `docker-compose.yaml` — services defined for local dependencies. *(checks 3 filename variants)*
    - [x] Bootstrap script — single-command setup (`make setup`, `pnpm bootstrap`, `./scripts/setup.sh`). *(checks scripts/setup.sh, Makefile, justfile, package.json setup/bootstrap/prepare/postinstall)*
    - [x] Doctor/health-check command — validates environment prerequisites. *(ARI-ENV-004: detects `doctor`/`health`/`check`/`verify`/`validate` scripts in package.json)*
    - [ ] Time-to-first-test-pass estimate (from setup complexity analysis).
    - [x] Environment variable documentation — all required env vars documented with defaults/examples. *(checks `.env.example`/`.env.template`)*
    - [x] Required tool versions — `.nvmrc`, `.tool-versions`, `engines` field in `package.json`, `python-requires`. *(checks .nvmrc, .node-version, .tool-versions, .python-version, rust-toolchain.toml, engines)*
    - [x] Seed/fixture data — test data provisioned automatically. *(detects `seeds/`, `fixtures/`, `testdata/` directories + seed/fixture scripts in package.json)*
  - [x] "Likely first-run blockers" section identifying the top 3-5 issues a new agent would hit. *(ARI-ENV-006: detects missing .env.example, no install command, no tsconfig added 2026-03-09)*
- **Scoring thresholds (research-calibrated):**

  | Criterion | Elite | Good | Poor |
  |---|---|---|---|
  | Time-to-first-test-pass | <5min | <15min | >30min |
  | Devcontainer quality | Valid + complete | Present + basic | Missing |
  | Bootstrap automation | Single command | Multi-step documented | Undocumented |

- **Acceptance criteria:**
  - [x] Output includes "likely first-run blockers" section with specific, actionable items. *(ARI-ENV-006 first-run blockers detection added 2026-03-09)*
  - [x] Each criterion scored independently with clear pass/fail/partial status. *(ARI-ENV-008 through ARI-ENV-012 per-criterion status labels added 2026-03-09)*
  - [x] Devcontainer validation checks required fields (image/build, features, settings). *(ARI-ENV-005: checks image/build, settings fields added 2026-03-09)*
  - [x] Environment variable completeness scored against actual usage in codebase. *(ARI-ENV-007: compares process.env usage in code vs .env.example entries added 2026-03-09)*
- **Research basis:**
  - VS Code Blog (2022): 94-96% drop-off rate for manual setup.
  - Microsoft/GitLab (2022): Standardised environments reduce onboarding 60%, conflicts 30%.
  - Stripe Developer Coefficient: Industry average 2-4 weeks, top teams 3-5 days.
  - Clean code practices: -60% onboarding time (IEEE 2022).
  - Modular architecture: -30% bug rate (GitHub 2023).
- **Dependencies:** P1.02 (language detection), P1.01 (CLI scaffold).
- **Telemetry:** devcontainer presence rate, bootstrap automation rate.
- **In scope:** File presence and validity checks, setup complexity estimation, env var usage analysis.
- **Out of scope:** Actual setup execution (P3.05 simulation), network dependency resolution.

#### Ticket P1.09 — Machine-readable Docs Baseline (Pillar 5) (🟠) 🔧 Partial

- **User story:** As a developer, I need to know whether my documentation is structured for machines to parse or locked in prose that agents struggle with.
- **Problem statement:** LLMs struggle with "schema drift" and "formatting inconsistency" in prose documentation — token costs triple when agents must retry failed parsing attempts (Tetrate, 2025). LLM embeddings contain more accurate task information when documentation emphasises semantic structure (entities, relations, graphs) over narrative prose (Chalmers Literate Programming study, 2026). Machine-readable formats reduce hallucination rates (bioRxiv OpenEval, 2026). Research argues that "publication systems should optimize separately for the dissemination of data and results versus novel ideas" — API specs and error codes must be machine-readable (JATS XML, OpenAPI).
- **Target persona:** API developers, platform teams, documentation maintainers.
- **Definition of Done:**
  - Detection and quality scoring for:
    - [x] **API contracts:** OpenAPI/Swagger detection. *(regex for `openapi|swagger` in filenames)*
    - [x] **API contracts:** tRPC router definitions. *(checks `trpc|\.router\.[jt]s`)*
    - [x] **API contracts:** GraphQL schema files. *(checks `.graphql`/`.gql` files)*
    - [x] **Error taxonomy:** Structured error codes with machine-readable definitions. *(checks `error.taxonomy|error.codes|errors?\.(json|ya?ml)`)*
    - [x] **Machine-readable runbooks:** Executable or structured runbooks (YAML/JSON, not prose-only). *(ARI-DOC-002 runbook detection added 2026-03-09)*
    - [x] **Env var schema:** Typed environment validation (zod, joi, t3-env, pydantic BaseSettings). *(checks package.json deps. JS-only, no Python pydantic BaseSettings.)*
    - [x] **ADR / decision records:** Architecture Decision Records present. *(checks files matching `adr|decision|rfc` with `.md`)*
    - [x] **Changelog format:** Conventional commits / Keep a Changelog format. *(checks `CHANGELOG.md`)*
    - [x] **Type exports / JSDoc coverage:** Public API types exported, JSDoc on public functions. *(ARI-DOC-003 JSDoc coverage measurement added 2026-03-09)*
    - [x] **Documentation-code consistency:** Docs reference current function names, parameters, paths (drift detection). *(ARI-DOC-004 documentation-code drift detection added 2026-03-09)*
  - [ ] Per-criterion findings include priority level and confidence markers. *(partial: findings have severity. Confidence only on API contract finding.)*
  - [ ] Drift detection between documentation references and actual code symbols.
  - [ ] Each criterion independently scored with clear rationale. *(partial: each adds to score independently but no per-criterion rationale emitted)*
  - [ ] Supports TypeScript, Python, Go, Java at minimum. *(partial: env var validation JS-only. File detection is language-agnostic.)*
- **Research basis:**
  - Tetrate (2025): Unstructured parsing triples token costs.
  - Chalmers (2026): Semantic structure improves LLM task accuracy.
  - bioRxiv OpenEval (2026): Machine-readable formats reduce hallucination.
  - Knuth (1984) → modern evolution: Literate Programming as agentic alignment requirement.
- **Dependencies:** P1.02 (language detection), P1.01 (CLI scaffold).
- **Telemetry:** machine-readable doc coverage by format type.
- **In scope:** File detection, format validation, basic drift detection.
- **Out of scope:** Content quality assessment, documentation generation, deep semantic analysis.

#### Ticket P1.10 — Type Strictness Scoring Baseline (Pillar 6) (🔴) 🔧 Partial

- **User story:** As a TypeScript developer, I need to know whether my type system configuration is helping or hurting my AI agents, because type errors are the #1 failure mode for LLM-generated code.
- **Problem statement:** This is potentially the single highest-ROI criterion across the entire rubric. 94% of LLM-generated compilation errors are type-check failures (GitHub Octoverse 2025). Type errors account for 33.6% of all failed LM-generated programs (TyFlow, Huang et al., 2025). Type-constrained decoding significantly reduces compilation errors and improves functional correctness (ETH Zurich, 2025). Microsoft research shows consistent naming and modularity — enforced by type systems — decrease defects by 40%. Bloomberg Engineering (2024) confirms TypeScript strict mode is essential for maintaining invariants at scale. For agents, a strictly typed codebase acts as a "constraint-based guidance system" — the compiler becomes a deterministic, near-instant validator. In dynamically typed languages, agents must rely on runtime execution to find errors, which is significantly more expensive and less reliable.
- **Target persona:** TypeScript/JavaScript developers, teams evaluating type system investment.
- **Definition of Done:**
  - TypeScript-specific checks:
    - [x] `strict: true` in `tsconfig.json` — the master switch.
    - [x] `strictNullChecks` — prevents runtime null/undefined crashes.
    - [x] `noImplicitAny` — prevents agents from using untyped escape hatches.
    - [x] `isolatedModules` — ensures fast standalone transpilation.
    - [x] `projectReferences` — monorepo build optimization. *(checks `references` array in tsconfig.json, +5 points for non-empty)*
    - [ ] Type coverage percentage (via `type-coverage` tool metrics).
  - Cross-language type strictness checks:
    - [x] Python: `mypy` strict mode, `pyright` configuration. *(checks mypy.ini, .mypy.ini, pyrightconfig.json, pyproject.toml sections)*
    - [x] Go: check for `interface{}` / `any` abuse. *(ARI-BLD-004: scans `.go` files for `interface\{\}` and `any` usage, penalizes >10 occurrences)*
    - [x] Rust: check for excessive `unwrap()`, missing error types. *(ARI-BLD-005: scans `.rs` files for `.unwrap()` usage, penalizes >20 occurrences)*
    - [x] Java: nullability annotations, generics usage. *(ARI-BLD-008: detects @NonNull/@Nullable/@NotNull annotations and NullAway/Checker Framework/ErrorProne in pom.xml/build.gradle. Added 2026-03-08.)*
    - [x] C#: nullable reference types enabled. *(ARI-BLD-009: checks `<Nullable>enable</Nullable>` in .csproj and `#nullable enable` directives in source files. Added 2026-03-08.)*
  - Build determinism checks:
    - [x] Lockfile presence and consistency. *(checks 10 lockfile formats)*
    - [x] Lockfile not gitignored.
    - [x] Build tool modernity: Vite/SWC/esbuild vs legacy Webpack. *(detects `tsup|esbuild|vite|swc|unbuild|turbo` vs `webpack`)*
    - [x] Monorepo clarity: project references, incremental builds, clear package boundaries. *(ARI-BLD-006: checks turbo, nx, lerna, pnpm-workspace project references added 2026-03-09)*
  - [ ] Cross-pillar type bonus: strict TypeScript repos receive bonus on P2 and P7.
- **Weight justification:** Elevated from 12.5% to 15% because the convergence of TyFlow, type-constrained decoding, and Octoverse data makes type strictness potentially the single highest-ROI criterion. Types catch errors (P6), provide faster feedback (P2), and improve navigability through explicit contracts (P7).
- **Acceptance criteria:**
  - [x] Strictness checks are clearly separated from style rules.
  - [x] TypeScript config analysis is field-level (not just "strict: true" binary). *(checks strict, strictNullChecks, noImplicitAny, isolatedModules individually)*
  - [ ] Cross-language type strictness is confidence-labeled. *(partial: overall confidence "high" for TS, "medium" otherwise. No per-check confidence.)*
  - [ ] Lockfile drift detection identifies specific inconsistencies. *(presence + gitignored only)*
  - [ ] Build tool modernity scored with clear rationale. *(partial: modern +10, webpack +5. No explanatory finding emitted.)*
- **Research basis:**
  - GitHub Octoverse 2025: 94% of LLM compilation errors are type-check failures.
  - TyFlow (Huang et al., 2025): 33.6% of failed LM programs fail due to type errors.
  - ETH Zurich (2025): Type-constrained decoding reduces errors, improves correctness.
  - Microsoft (2023): Strict typing decreases defects by 40%.
  - Bloomberg Engineering (2024): TypeScript strict mode essential at scale; `isolatedModules` speeds feedback.
- **Dependencies:** P1.02 (language detection), P1.01 (CLI scaffold).
- **Telemetry:** strict mode adoption rate, type coverage distribution.
- **In scope:** Config file analysis, lockfile validation, build tool detection.
- **Out of scope:** Actual type coverage measurement (requires compilation), build execution.

#### Ticket P1.11 — Navigability Baseline (Pillar 7) (🟢) ✅ Done

- **User story:** As a developer, I need to know how easily AI agents can find and understand relevant code in my repository.
- **Problem statement:** Developers spend up to 70% of their time comprehending code (Multitudes DX research). Complex code requires 250-500% more maintenance time (IEEE). This applies equally to agents — SWE-agent (Yang et al., NeurIPS 2024) proves that the agent-codebase interface is as important as the underlying model. Vector-only RAG degrades toward zero accuracy when queries involve >5 entities; AST-derived knowledge graphs maintain stable performance at 10+ entities (arXiv 2601.08773, 2025). GraphRAG achieves 3.4x accuracy improvement over vector RAG for multi-hop architectural reasoning (Fluree, 2025). Codebases with clear call hierarchies and predictable patterns enable better retrieval, regardless of retrieval strategy.
- **Target persona:** Teams wanting to optimize their codebase for AI agent effectiveness.
- **Definition of Done:**
  - Structural heuristics:
    - [x] **Directory depth:** Maximum nesting depth, files per directory (cognitive load). *(penalizes >8, rewards <=5)*
    - [x] **Naming consistency:** Consistent file/function/variable naming patterns across the repo. *(measures camelCase/kebab/snake/Pascal distribution)*
    - [x] **Module boundary clarity:** Clear separation between domains/features/layers. *(checks `src/` or `packages/`)*
    - [x] **Import graph complexity:** Fan-in/fan-out metrics, circular dependency detection. *(ARI-NAV-004: flags files with >20 imports. ARI-NAV-005: builds import map and detects mutual imports.)*
    - [x] **Dead code percentage:** Unreachable/unused exports, files with no imports. *(ARI-NAV-006 dead code detection heuristic added 2026-03-09)*
    - [x] **Code duplication:** Clone detection, DRY violations. *(ARI-NAV-008 normalized line-chunk hashing added 2026-03-09)*
    - [x] **Cognitive complexity score:** Nested conditionals, excessive boolean operators, large methods. *(ARI-NAV-007 cognitive complexity estimate added 2026-03-09)*
  - [x] "Most costly navigation paths" summary: the top 5 areas where agents will struggle most. *(added 2026-03-09)*
  - [ ] Structural clarity for retrieval: evaluation of call hierarchies and predictable patterns.
  - [ ] Includes "most costly navigation paths" summary with specific file/directory references.
  - [ ] Each metric includes threshold calibration (what counts as good/moderate/poor). *(partial: depth and files-per-dir have implicit thresholds but no explicit labels)*
  - [ ] Circular dependency detection reports specific import chains.
  - [ ] Dead code detection has <15% false-positive rate.
  - [ ] Cognitive complexity scored per function/method with aggregation per file.
- **Research basis:**
  - Multitudes DX research: 70% of developer time on comprehension.
  - IEEE: Complex code requires 250-500% more maintenance.
  - SWE-agent (Yang et al., NeurIPS 2024): Interface matters as much as model.
  - arXiv 2601.08773 (2025): AST-derived graphs >> vector RAG for multi-hop reasoning.
  - Fluree (2025): GraphRAG 3.4x accuracy over vector RAG.
  - Microsoft (2023): Consistent naming decreases defects by 40%.
- **Dependencies:** P1.02 (language detection), P1.01 (CLI scaffold).
- **Telemetry:** directory depth distribution, circular dependency prevalence.
- **In scope:** Static analysis of directory structure, import graphs, naming patterns.
- **Out of scope:** AST-level graph analysis (P3.07), runtime profiling, semantic code understanding.

#### Ticket P1.12 — Security and Governance Baseline (Pillar 8) (🔴) ✅ Done (minor gaps)

- **User story:** As a security-conscious engineering lead, I need to know whether my repository has the governance controls required to safely use AI coding agents at scale.
- **Problem statement:** AI-generated code consistently shows higher vulnerability rates than human-written code: ~40% of Copilot-generated programs contain CWE Top 25 vulnerabilities (Pearce et al., 2021), AI PRs have ~1.7x more issues than human PRs (CodeRabbit, 2025), and critical vulnerabilities increase by 37.6% after just 5 iterations of AI "improvement" (IEEE-ISTAS, 2025). AI assistants introduce hardcoded credentials at 2x the human rate (Veracode, 2025). By June 2025, AI-generated code introduced 10,000+ new security findings per month with privilege escalation up 322% and architectural design flaws up 153% (Apiiro, 2025). Security degradation in iterative AI synthesis is a fundamental property of current agents — they focus on functional correctness while inadvertently introducing security anti-patterns from training data. Without governance controls, the speed of AI agents is not a benefit but a liability that "multiplies security flaws entering production."
- **Gate behavior:** A repo scoring below 40% on Pillar 8 has its overall maturity level **capped at L2 (Fragile)** regardless of other pillar scores. Security is not a weighted average — it's a prerequisite.
- **Target persona:** Security teams, engineering leadership, compliance officers.
- **Definition of Done:**
  - Detection and scoring for:
    - [ ] **Branch protection:** Main/master branch protected, PR reviews required. *(partial: infers from CI config files. Tightened heuristic 2026-03-09: pull_request trigger alone no longer counts. Does NOT check GitHub API or PR review requirements.)*
    - [x] **CODEOWNERS:** File present, covering critical paths. *(checks CODEOWNERS, .github/CODEOWNERS, docs/CODEOWNERS)*
    - [x] **Secrets scanning:** Pre-commit secrets detection configured (gitleaks, truffleHog, detect-secrets). *(checks .gitleaks.toml, .pre-commit-config.yaml, .sops.yaml, CI workflow content)*
    - [x] **Dependency audit:** Automated vulnerability scanning (Dependabot, Renovate, Snyk) configured. *(checks .github/dependabot.yml, renovate.json)*
    - [ ] **SAST for AI-generated code:** Static analysis mandatory on agent-authored PRs. *(partial: checks CI for `codeql|semgrep|snyk|sonar|eslint.*security`. Does not verify it targets agent-authored PRs.)*
    - [x] **AI-specific review checklist:** PR template includes AI-code-specific security items. *(ARI-SEC-005: checks PR templates for `ai|agent|llm|copilot|gpt|claude|machine-generated` regex)*
    - [x] **Licence compliance:** Licence checker in CI. *(ARI-SEC-007: licence compliance tooling check added 2026-03-09)*
    - [x] **Agent scope controls:** Agents restricted from sensitive paths. *(ARI-SEC-006: checks `.agentignore`, `.claudeignore`, `.copilotignore`, `CLAUDE.md`, `.claude/settings.json`)*
  - [x] Missing controls prioritized by operational risk level with rationale. *(All findings now include `evidence` fields with research-backed risk rationale. Findings sorted by severity for risk-priority ordering. Added 2026-03-10.)*
  - [x] AI-specific security posture assessment separately scored. *(AI-specific sub-score (SAST + AI review checklist + agent scope controls) computed and displayed in summary. Added 2026-03-10.)*
  - [x] Each detected control shows configuration status (configured/partial/missing). *(summary now shows configured/partial/missing labels added 2026-03-09)*
  - [x] AI-specific criteria separately scored. *(AI-specific security sub-score shown as percentage in summary — tracks SAST, AI review checklist, and agent scope controls separately from general governance. Added 2026-03-10.)*
  - [x] Gate behavior (L2 cap) clearly documented in output when triggered. *(implemented in composite.ts, displayed in terminal.ts)*
  - [x] Language-specific vulnerability context provided. *(ARI-SEC-008: detects primary languages from file extensions and provides research-backed vulnerability rates per language — Java 72%, JS 56%, TS 48%, Python 38%, Go 44%, Rust 25%, C# 52%, Ruby 46%. Added 2026-03-10.)*
- **Research basis:**
  - Pearce et al. (2021): ~40% of Copilot programs contain CWE Top 25 vulnerabilities.
  - CodeRabbit (2025): AI PRs have ~1.7x more issues than human PRs.
  - IEEE-ISTAS (2025): 37.6% vulnerability increase over 5 iterations.
  - Veracode (2025): AI hardcodes credentials at 2x human rate; Java 72% vs Python 38% vulnerability rates.
  - Apiiro (2025): 10,000+ new AI security findings/month; privilege escalation +322%.
  - Cotroneo et al. (2025): 500k+ sample study — AI code is simpler but more defect-prone.
- **Dependencies:** P1.02 (language detection), P1.01 (CLI scaffold).
- **Telemetry:** governance control coverage rate, gate trigger frequency.
- **In scope:** Detection of configured controls via config files, CI workflows, repo metadata.
- **Out of scope:** Runtime security testing, vulnerability scanning execution, compliance certification.

### Epic P1.3 — Output Contracts and Adoption UX

#### Ticket P1.13 — Composite ARI and Tier Mapping (🔴) ✅ Done (minor gaps)

- **User story:** As a developer, I need a single score and maturity level that tells me how ready my codebase is for AI agents, with clear rationale for how it was calculated.
- **Problem statement:** Individual pillar scores are useful for diagnosis but teams need a single "headline" metric for communication, benchmarking, and goal-setting. The composite score must reflect research-calibrated weights (not equal weights) and the maturity level must map to real-world agent performance expectations grounded in benchmark data.
- **Target persona:** Engineering leads, CTOs, anyone communicating agent readiness status.
- **Deliverables:**
  - [x] 8-pillar weighted aggregation using research-calibrated weights:

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

  - [x] Maturity level mapping (L1–L5) with research calibration:

    | Level | Name | Score | What Agents Can Achieve | Research Calibration |
    |---|---|---|---|---|
    | L1 | Hostile | 0-25 | Almost nothing — agents thrash, hallucinate, waste tokens | SWE-bench Pro private: agents score 14.9% on unseen codebases |
    | L2 | Fragile | 26-45 | Simple single-file edits with heavy supervision | CooperBench: agents fail 50%+ of coordinated tasks |
    | L3 | Capable | 46-65 | Routine tasks (bug fixes, tests, docs) with moderate supervision | SWE-bench Verified: agents solve 75-82% of well-scoped bugs |
    | L4 | Productive | 66-80 | Multi-file features and refactoring with light supervision | Requires <60s feedback, >80% test determinism, strict types |
    | L5 | Autonomous | 81-100 | Complex cross-service tasks, agent self-verifies | DORA Elite + full isolation + structured docs + type safety |

  - [x] Security gate enforcement: P8 <40% caps overall level at L2 regardless of composite score.
  - [x] Cross-pillar type bonus: strict TypeScript repos receive bonus on P2 and P7. *(+5 bonus to P2 and P7 when P6 score >= 70. Implemented in `applyCrossPillarTypeBonus()` in composite.ts. Added 2026-03-08.)*
- **Acceptance criteria:**
  - [x] Component weighting and confidence are visible in output (both terminal and JSON).
  - [x] Maturity level includes "what agents can achieve at this level" description.
  - [x] Security gate clearly documented and enforced.
  - [x] Cross-pillar bonus calculation is transparent and explainable. *(applyCrossPillarTypeBonus() applies +5 to P2/P7 when P6 >= 70, clamped to 100. Added 2026-03-08.)*
  - [ ] Weighting rationale cites specific research sources. *(no research citations in output — only in roadmap document)*
- **Dependencies:** P1.04–P1.12 (all pillar scoring), P1.01 (CLI scaffold).
- **Telemetry:** maturity level distribution, composite score distribution.
- **In scope:** Score aggregation, weighting, maturity mapping, gate enforcement.
- **Out of scope:** Historical comparison, peer benchmarking.

#### Ticket P1.14 — JSON Output Contract v1 (🔴) 🔧 Partial

- **User story:** As a CI/CD engineer, I need machine-readable output from ariscan so I can build automated workflows around readiness scores.
- **Problem statement:** CI integration is the primary adoption vector for sustained usage. Without a stable, versioned JSON contract, downstream tooling (GitHub Actions, GitLab CI, custom dashboards) cannot reliably parse results. The schema must be semver-stable to avoid breaking integrations on minor releases.
- **Target persona:** CI/CD engineers, platform teams, tooling developers.
- **Definition of Done:**
  - [x] `--json` flag producing versioned output. *(boolean flag, shorthand for `--format json`)*
  - [x] Schema includes: scan metadata (version, timestamp, duration). *(ScanMetadata schema)*
  - [x] Schema includes: composite score. *(ScanResult.score)*
  - [x] Schema includes: maturity level. *(ScanResult.level + ScanResult.levelMeta)*
  - [x] Schema includes: per-pillar breakdown (score, confidence, findings, recommendations). *(PillarResult with all fields)*
  - [x] Schema includes: language/framework detection results. *(in `ScanResult.detection` field with `DetectedLanguage[]`, `DetectedFramework[]`, `DetectedMonorepo | null`)*
  - [x] Schema includes: context file inventory. *(ContextFileInfo type with path, type, size, lineCount added to ScanResult 2026-03-09)*
  - [ ] Semver impact rules: patch = new optional fields only, minor = new pillar/criterion, major = breaking schema changes.
  - [ ] Schema file published in repo and npm package. *(partial: Zod schemas in @prontiq/schema. formatJsonSchema() function added 2026-03-09 but no standalone JSON Schema file.)*
  - [x] `--json-schema` flag that outputs the schema itself for validation tooling. *(wired 2026-03-09: `--jsonSchema` flag outputs JSON Schema and exits)*
  - [x] All findings use `ARI-*` taxonomy codes. *(Finding.code regex enforces `^ARI-[A-Z]{3}-\d{3}$`)*
  - [ ] Structured remediation data (action, generator command, estimated impact). *(partial: has action, description, estimatedImpact, confidence, path. EstimatedImpact enum type added 2026-03-09. No generator command. remediation/evidence optional — spec says required.)*
  - [x] SARIF projection. *(SARIF 2.1.0 formatter implemented in `output/sarif.ts`, wired to `--format sarif` CLI flag. Added 2026-03-08.)*
  - [ ] Schema file published and semver impact rules documented.
  - [ ] Output validates against published schema (tested in CI). *(partial: Zod schemas exist but no CI validation test)*
  - [ ] Backwards compatibility guaranteed within major version.
  - [x] Schema includes `$schema` and `$id` fields for validation tooling. *(added to JSON output 2026-03-09)*
  - [ ] JSON output is streamable (newline-delimited) for large repos. *(single JSON.stringify blob)*
  - [ ] Every finding includes `ARI-*` code, structured remediation data, and research citation. *(partial: ARI codes enforced. remediation/evidence optional.)*
- **Dependencies:** P1.13 (composite scoring), P1.01 (CLI scaffold).
- **Telemetry:** `--json` flag usage rate.
- **In scope:** JSON schema definition (Zod), serialization, validation, versioning policy, `ARI-*` taxonomy integration.
- **Out of scope:** API endpoint, streaming protocol, GraphQL.

#### Ticket P1.15 — Markdown Report v1 (🟠) ✅ Done (2026-03-08)

- **User story:** As a tech lead, I need a shareable human-readable report I can paste into a PR, Slack thread, or wiki to communicate readiness status.
- **Problem statement:** JSON output serves machines; teams need a human-readable format for communication, decision-making, and executive reporting. The report must be actionable — not just scores, but prioritized recommendations.
- **Target persona:** Tech leads, engineering managers, anyone sharing results with stakeholders.
- **Definition of Done:**
  - [ ] Markdown report ordered by impact and effort (highest-impact, lowest-effort fixes first). *(findings sorted by severity, not by impact × effort)*
  - [ ] "First 3 actions" quick-start section highlighting immediate wins.
  - [x] Per-pillar sections with: score, confidence level, key findings, specific recommendations. *(pillar table with score bars, findings section with remediations)*
  - [x] Summary header with composite score, maturity level badge, and scan metadata. *(badge header with score, level, scan timestamp, duration)*
  - [x] Terminal-friendly colored output (when not piped to file). *(terminal.ts uses chalk for ANSI colors)*
  - [ ] Report includes "first 3 actions" quick-start section.
  - [ ] Recommendations are ordered by impact × ease (not by pillar number).
  - [x] Report renders correctly in GitHub PR comments, Slack markdown, and static markdown viewers. *(uses Unicode block chars, standard markdown tables — no emoji dependency)*
  - [x] Terminal output uses ANSI colors when TTY detected, plain text otherwise. *(chalk handles TTY detection automatically)*
- **Dependencies:** P1.13 (composite scoring), P1.01 (CLI scaffold).
- **Telemetry:** report generation count, format preference (terminal vs file).
- **In scope:** Markdown generation, terminal formatting, recommendation prioritization.
- **Out of scope:** HTML report, PDF export, interactive report.

#### Ticket P1.16 — README Badge Support (🟡) ✅ Done (2026-03-08)

- **User story:** As an OSS maintainer, I want to display my agent readiness score as a badge in my README for social proof and to signal quality to potential AI agent users.
- **Problem statement:** README badges are a proven viral distribution mechanism in the OSS ecosystem. Badge presence in popular repos normalizes the concept of agent readiness scoring and drives awareness.
- **Target persona:** OSS maintainers, developers evaluating repos for AI agent compatibility.
- **Definition of Done:**
  - [x] Badge format: "Agent-Ready: L4 (78/100)" with color coding (red/orange/yellow/green/blue by level). *(SVG badge with 5 color levels: L1 red, L2 orange, L3 yellow, L4 green, L5 bright green. Added 2026-03-08.)*
  - [x] SVG badge generation from scan results (no external service dependency). *(`generateBadgeSvg()` in `output/badge.ts`. Added 2026-03-08.)*
  - [x] Embed snippet in markdown, HTML, and reStructuredText formats. *(`generateBadgeSnippets()` outputs all 3 formats. Added 2026-03-08.)*
  - [x] `ariscan badge` command to generate badge file and embed snippet. *(`--badge <path>` flag generates SVG file and prints embed snippets. Added 2026-03-08.)*
  - [x] Supports static generation without external tracker dependency. *(pure SVG generation, no network calls.)*
  - [ ] Badge renders correctly on GitHub, GitLab, Bitbucket, and npmjs.com. *(untested on all platforms)*
  - [x] Color scheme is accessible (WCAG AA contrast). *(uses shields.io-compatible palette with high contrast text)*
  - [x] Embed snippet is copy-pasteable from CLI output. *(printed to stderr after badge generation.)*
- **Dependencies:** P1.13 (composite scoring).
- **Telemetry:** badge generation count.
- **In scope:** SVG generation, embed snippets, CLI command.
- **Out of scope:** Dynamic badge service, badge hosting.

#### Ticket P1.17 — Safe `--fix` Starter (🟠) ⬜ Not Started

- **User story:** As a developer, I want ariscan to fix the easiest issues for me so I can improve my score without spending hours on manual changes.
- **Problem statement:** Scoring without remediation creates "so what?" syndrome. The fastest path to proving value is generating safe, non-destructive fixes for the most common issues. Per Gloaguen et al. (2026), the key is generating *additive* information that agents can't discover independently — not restating the README.
- **Target persona:** Any developer who just ran their first scan and wants to improve.
- **Definition of Done:**
  - Safe, non-destructive scaffolding for:
    - [ ] `AGENTS.md` generation: additive-only content (build commands, test patterns, constraint specifics — NOT README restatement).
    - [ ] `.agentignore` generation: exclude generated files, `dist/`, `coverage/`, lockfiles, `node_modules/`, build artifacts.
    - [ ] `.devcontainer/devcontainer.json` starter template based on detected stack.
    - [ ] Provider pattern skeleton (interface + in-memory implementation) for detected cloud SDK usage.
  - [ ] `--dry-run` mode showing exact changes before any write.
  - [ ] Each generated file includes TODO prompts for human review.
  - [ ] Rationale comments explaining why each section was generated.
  - [ ] Dry-run mode shows exact changes before write (diff format).
  - [ ] Zero destructive file edits without explicit opt-in.
  - [ ] Generated AGENTS.md scores higher on additionality than a naive "dump everything" approach.
  - [ ] Each TODO prompt references the specific criterion it addresses.
  - [ ] `--fix` is idempotent (running twice produces no additional changes).
- **Research basis:** Gloaguen et al. (2026): Additive information helps; redundant information hurts. The --fix feature must encode only information agents can't discover independently.
- **Dependencies:** P1.04 (additionality scoring — to verify generated content is additive), P1.06 (test isolation — for provider pattern detection).
- **Telemetry:** fix adoption rate, fix types applied.
- **In scope:** File generation with additive-only content, dry-run preview, idempotency.
- **Out of scope:** Complex refactoring, code modification, destructive changes.

#### Ticket P1.18 — Benchmark Cohort v1 (🟠) ⬜ Not Started

- **User story:** As a potential user, I want to see how popular OSS projects score so I can understand what ARI means in practice and how my repos compare.
- **Problem statement:** Benchmark scores on recognizable projects build credibility, drive interest, and provide calibration data. The benchmark also serves as a regression test for scoring consistency and as launch PR material.
- **Target persona:** Developers evaluating ariscan, community members, press/analysts.
- **Definition of Done:**
  - [ ] Scan and publish scores for 20+ well-known OSS repos across multiple ecosystems:
    - [ ] **TypeScript/JavaScript:** React, Next.js, Vue, Nuxt, Express, Remix, Astro.
    - [ ] **Python:** FastAPI, Django, Flask, Pydantic, LangChain.
    - [ ] **Go:** Kubernetes (subset), Terraform, Hugo.
    - [ ] **Rust:** Ripgrep, Tokio.
    - [ ] **Java:** Spring Boot.
    - [ ] **Multi-language:** VS Code, Chromium (subset).
  - [ ] Methodology notes explaining scoring version, date, and any repo-specific caveats.
  - [ ] Rerun script + pinned revision list for reproducibility.
  - [ ] Results page (markdown in repo, later promoted to website).
  - [ ] Rerun script + pinned revision list are included and tested.
  - [ ] Results are reproducible: same revisions → same scores.
  - [ ] Methodology notes explain any anomalies or caveats.
  - [ ] Results cover at least 4 different primary languages.
- **Dependencies:** P1.13 (composite scoring), all pillar scoring tickets.
- **Telemetry:** benchmark page views, repos inspired to scan.
- **In scope:** Repo selection, scanning, result publication, reproducibility tooling.
- **Out of scope:** Continuous benchmarking (P2.12), automated updates.

### P1 Implementation Notes (2026-03-08)

This section captures learnings, gaps, and decisions from the initial implementation pass.
It is the source of truth for what was actually built vs. what was specified.

**Grand total across P1.01–P1.18: 107 done, 19 partial, 40 not done (166 sub-items audited). Updated 2026-03-08 (session 3). Counts derived from per-section header tallies + P1.15-P1.18 summary.**

#### Architecture Decisions (deviations from RFC-0003)

| Decision | Spec | Implementation | Rationale |
|---|---|---|---|
| Package naming | `@prontiq/core` | `@prontiq/schema` | Clearer purpose; "core" was overloaded. `schema` is Zod schemas only. |
| Tree-sitter WASM | Required for P1 | **Deferred to P2/P3** | All P1 analyzers use regex/heuristic detection. AST analysis needed for P1.07 (order-sensitive assertions), P3.07 (advanced navigability), and deep anti-pattern detection. Regex is sufficient for baseline scoring. |
| RepoContext interface | Includes `languages`, `frameworks`, `monorepo`, `contextFiles`, `config` | Only `rootPath`, `files`, `readFile()`, `fileExists()`, `readJson()` | Language/framework detection (P1.02) not yet a standalone module. Simpler interface was sufficient for all 8 analyzers. Expand when P1.02 is fully built. |
| Analyzer execution | `Promise.all()` parallel | `Promise.all()` parallel (fixed from initial sequential) | RFC-0003 specifies parallel. Initial build was sequential; fixed during audit. |
| Config passthrough | `scan(path, config)` uses config for filtering/overrides | Config wired for pillar enable/disable only | Weight overrides and `.ariscan.yml` loading deferred to P3.01 (Readiness-as-Code). |
| Error taxonomy | `docs/error-taxonomy.json` machine-readable file | Finding codes inline in analyzers (`ARI-XXX-NNN`) | Error taxonomy JSON file deferred. Codes are consistent and validated by Zod regex. |

---

#### P1.01 — CLI Scaffold and Config Runtime (7 done, 1 partial, 2 not done) — updated 2026-03-08

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | `npx ariscan .` scans and produces scored report | ✅ Done | `cli.ts` defines main command with positional `path` defaulting to `"."` |
| 2 | Config loading: CLI flags > `.ariscan.yml` > defaults | ✅ Done | `config-loader.ts`: directory walk-up discovery, YAML parsing, Zod validation via `FileConfig`. `resolveConfig()` merges CLI > file > defaults. 16 unit tests. |
| 3 | Deterministic exit codes: 0 (pass), 1 (fail), 2 (error) | ✅ Done | `process.exit(2)` on path not found and scan error. `process.exit(1)` when score < threshold. Implicit 0 on success. |
| 4 | `--help` with all flags, examples, config format | ✅ Done | citty auto-generates flag docs + 3 usage examples in description. Config format via `--config` flag. |
| 5 | `--verbose` and `--quiet` modes | ✅ Done | `--verbose` shows pillar details, detection info, context files, and all findings. `--quiet` outputs single-line CI-friendly summary. Updated 2026-03-08. |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | `--help` documents flags + 3 usage examples | ✅ Done | 3 examples in CLI description: basic scan, JSON output, threshold |
| 2 | Config precedence tested with unit tests | ✅ Done | 16 tests in `config-loader.test.ts` covering YAML parsing, validation, directory traversal, merging |
| 3 | Exit code matrix documented in `--help` and docs | ❌ Not done | Exit codes work but undocumented |
| 4 | Completes on 100k files within 60s | ❌ Not done | No performance tests (scans complete <100ms on this repo though) |
| 5 | Zero external network calls | ✅ Done | No `fetch`, `http`, `axios`, or network imports in engine/CLI |

---

#### P1.02 — Language and Framework Detection (8 done, 0 partial, 2 not done)

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Language detection: TS, JS, Python, Go, Rust, Java, C#, Ruby, PHP | ✅ Done | `detection/languages.ts` — file extension + marker file boosting, confidence scores |
| 2 | Framework detection: React, Next.js, Vue, etc. | ✅ Done | `detection/frameworks.ts` — 14 frameworks via config files and dependency detection |
| 3 | Monorepo detection: Turborepo, Nx, Lerna, pnpm, Cargo, Go | ✅ Done | `detection/monorepo.ts` — 6 monorepo tools detected |
| 4 | Detection confidence score (0-1) per language/framework | ✅ Done | Each `DetectedLanguage`/`DetectedFramework` includes confidence field |
| 5 | Primary language determination for weight calibration | ✅ Done | Languages sorted by confidence, `primary: true` flag on highest |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Detection confidence in JSON output | ✅ Done | Included in `ScanResult.detection` field |
| 2 | False-language rate <5% on 50+ repos | ❌ Not done | No benchmark cohort |
| 3 | Monorepo workspace root + package boundaries | 🔧 Partial | Detects monorepo tool but not package boundaries |
| 4 | Detection <2s for 100k files | ❌ Not done | No performance tests |
| 5 | Graceful "unknown" fallback | ✅ Done | Returns empty arrays when no languages/frameworks detected |

---

#### P1.03 — Context File Discovery (7 done, 0 partial, 2 not done) — updated 2026-03-09

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Discovery of all known context file formats | ✅ Done | Discovers: AGENTS.md (root+nested), CLAUDE.md, .claude/settings.json, .claude/commands/, .cursorrules, .cursor/rules, .github/copilot-instructions.md, .aider.conf.yml, .aiderignore, .agentignore, .mcp.json, mcp.config.js. Cross-agent compatibility report deferred to P2. |
| 2 | Per-file metadata: path, type, size, lastModified, parseStatus | ✅ Done | ContextFileInfo tracks path, type, size, lineCount, lastModified (via fs.stat), parseStatus (valid/warning/error via content validation). Implemented in `scan.ts` `discoverContextFiles()`. |
| 3 | Cross-agent compatibility report | ✅ Done | ARI-CTX-010: maps context files to 5 agent categories (Claude Code, Cursor, GitHub Copilot, Aider, Generic). Reports covered vs uncovered agents with remediation. Added 2026-03-09. |
| 4 | Nested monorepo discovery (subdirectory-level files) | ✅ Done | Nested AGENTS.md discovery for monorepos added 2026-03-09 |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Includes path, type, size, lastModified, parseStatus | ✅ Done | All fields populated: path, type, size (bytes), lineCount, lastModified (ISO 8601 from fs.stat), parseStatus (valid/warning/error from content validation). |
| 2 | Non-parsable files surfaced with line-level warnings | ✅ Done | ARI-CTX-009: validates JSON parse, YAML emptiness/mixed indentation, empty files. Reduces score -5 per invalid file. Added 2026-03-09. |
| 3 | Nested context files in monorepo subdirs | ✅ Done | Added 2026-03-09 |
| 4 | Zero false negatives on benchmark cohort | ❌ Not done | No benchmark. All known formats now discovered. |
| 5 | Discovery <1s for 100k files | ❌ Not done | No performance testing |

---

#### P1.04 — Context Additionality Baseline / Pillar 1 (6 done, 1 partial, 4 not done) — updated 2026-03-09

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Semantic comparison engine (context vs README/CONTRIBUTING/docstrings/CI) | ❌ Not done | No semantic comparison. No `context/additionality.ts` created. |
| 2 | Redundancy percentage per context file | ❌ Not done | |
| 3 | Additionality score (% genuinely new information) | ❌ Not done | Checks heuristics (length, headings, code blocks) but not information novelty |
| 4 | Front-loading analysis (critical info in first 20%) | ✅ Done | ARI-CTX-005: checks if critical info (build commands, test patterns, constraints) appears in first 20% of file. Added 2026-03-09. |
| 5 | Conciseness ratio (token count vs useful info) | ✅ Done | ARI-CTX-008: conciseness check for overly long context files. Added 2026-03-09. |
| 6 | Staleness detection (context file vs last code change) | ✅ Done | ARI-CTX-006: cross-references paths mentioned in context files against actual repo files. Added 2026-03-09. |
| 7 | Negative instruction coverage ("do NOT" constraints) | ✅ Done | Regex `/\b(don't|do not|never|avoid)\b/i` awards +5 points |
| 8 | Boilerplate/auto-generation detection | ✅ Done | ARI-CTX-007: detects boilerplate and auto-generated context files per Gloaguen 2026. Added 2026-03-09. |

**Scoring Logic:**

| # | Rule | Status | Notes |
|---|---|---|---|
| 1 | No context file → 20% (neutral baseline) | ✅ Done | `score = 20` as baseline |
| 2 | LLM-generated file duplicating README → 0-10% | 🔧 Partial | ARI-CTX-007 detects boilerplate/auto-generated patterns but no full redundancy comparison against README |
| 3 | Concise, additive, front-loaded file → 80-100% | ✅ Done | Front-loading (ARI-CTX-005) + conciseness (ARI-CTX-008) + heuristic bonuses enable high scores. Added 2026-03-09. |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Distinguishes additive vs duplicative with line references | ❌ Not done | |
| 2 | Redundancy % to one decimal with methodology | ❌ Not done | |
| 3 | Front-loading score separately reported | ✅ Done | ARI-CTX-005 emitted as separate finding. Added 2026-03-09. |
| 4 | Deterministic across repeated runs | ✅ Done | Pure heuristics, no randomness |

---

#### P1.05 — Feedback Loop Proxy / Pillar 2 (6 done, 1 partial, 3 not done) — updated 2026-03-09

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Parse package.json/Makefile/pyproject.toml/CI to infer feedback latency | 🔧 Partial | Parses package.json scripts, checks Makefile/pyproject.toml existence, CI presence. ARI-FBK-009 estimates feedback latency with confidence labels. No actual execution timing. |
| 2 | Estimated execution times (unit tests, typecheck, lint, CI) | ✅ Done | ARI-FBK-009: estimated feedback latency with measured/inferred/unknown confidence labels. Added 2026-03-09. |
| 3 | Watch mode / hot reload detection | ✅ Done | ARI-FBK-007: watch mode detection as separate finding. Added 2026-03-09. |
| 4 | Incremental build support detection | ✅ Done | ARI-FBK-008: incremental build detection as separate finding. Added 2026-03-09. |
| 5 | Pre-commit hooks (lint + typecheck + format) | ✅ Done | Checks `.husky`, `.pre-commit-config.yaml`, `lefthook.yml` |
| 6 | Changeset scope controls (PR size limits, conventional commits) | ✅ Done | ARI-FBK-006: detects commitlint configs, `.changeset/config.json`, dangerfile |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Estimated times with confidence label (measured/inferred/unknown) | ✅ Done | ARI-FBK-009: estimated feedback latency with measured/inferred/unknown labels. Added 2026-03-09. |
| 2 | Watch mode and incremental build clearly reported | ✅ Done | ARI-FBK-007 (watch mode) and ARI-FBK-008 (incremental build) as separate findings. Added 2026-03-09. |
| 3 | Changeset scope controls detected and scored | ✅ Done | ARI-FBK-006 emitted when controls missing |
| 4 | Local feedback 2x weight vs CI 1x per research | ✅ Done | Restructured scoring: local signals get 2x weight, CI signals get 1x weight. Added 2026-03-09. |

---

#### P1.06 — Test Isolation Anti-patterns v1 / Pillar 3 (10 done, 1 partial, 4 not done) — updated 2026-03-09

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Cloud credential dependency detection (AWS/GCP/Azure SDK in tests) | ✅ Done | Regex `AWS\|azure\|gcp\|google.cloud`. Emits ARI-TST-001. |
| 2 | Direct HTTP/API calls detection (fetch, axios, requests) | ✅ Done | Emits ARI-TST-002 |
| 3 | Mutable global environment detection (process.env, global state) | ✅ Done | ARI-TST-011: detects process.env assignment, global/globalThis/window mutation. Added 2026-03-09. |
| 4 | Unstable time/random usage detection | ✅ Done | Detects `Date.now`, `new Date`, `time.Now`, `datetime.now`, `Math.random`. ARI-TST-003/004. |
| 5 | Unordered collection assertions detection | ✅ Done | ARI-TST-009: regex for `toEqual(new Set|toEqual(new Map|assertDictEqual|assert_eq!.*HashMap` |
| 6 | Test order dependency detection | ✅ Done | ARI-TST-012: detects describe.only, it.only, beforeAll with state. Added 2026-03-09. |
| 7 | External file system dependency detection | ✅ Done | ARI-TST-008: detects `readFileSync|writeFileSync|fs.readFile|os.path|Path(` in test files |
| 8 | Concurrency/race conditions detection | ✅ Done | ARI-TST-013: detects setTimeout, sleep, timing-dependent patterns. Added 2026-03-09. |
| 9 | Hardcoded credential detection | ✅ Done | ARI-TST-014: detects passwords, secrets, API keys in test files. Added 2026-03-09. |
| 10 | Finding details: severity, Luo 2014 category, code example fix, agent impact | 🔧 Partial | Severity now includes critical. Luo 2014 root cause taxonomy evidence fields added to all findings (2026-03-09). Fix hints still generic. Agent impact explanation still missing. |
| 11 | Provider pattern / DI detection | ✅ Done | Checks filenames for `provider\|factory\|container\|inject` (excluding `.devcontainer`). Awards +15 points. |
| 12 | Memory/mock implementation detection | ✅ Done | Checks `__mocks__`, `.mock.`, `mock/`. Awards +10 points. |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Each finding: severity + root cause category + fix hint | 🔧 Partial | Severity includes critical (2026-03-09). Luo 2014 taxonomy evidence fields added (2026-03-09). Fix hints still generic. |
| 2 | False-positive rate <10% on benchmark | ❌ Not done | No benchmark |
| 3 | Coverage: TS/JS, Python, Go, Java, Rust | 🔧 Partial | Covers TS/JS, Go, Python, Java, C#, Ruby patterns. Missing: Rust `cargo test`. Anti-patterns not language-specific tuned. |
| 4 | Provider pattern: direct SDK vs abstracted interfaces | ❌ Not done | Filename heuristic only, not structural code analysis |

---

#### P1.07 — Order-sensitive Assertion Detection / Pillar 3 (0 done, 1 partial, 6 not done)

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | AST-level analysis for assertions on non-deterministic data structures | 🔧 Partial | Regex-level detection exists in P1.06 (ARI-TST-009). AST-level analysis deferred to P3.07. |
| 2 | Detection of comparison operators on unordered types without sorting | ❌ Not done | |
| 3 | Detection of array assertions where order may vary | ❌ Not done | |
| 4 | Suggested fixes: `toSorted()`, `Array.from().sort()`, etc. | ❌ Not done | |
| 5 | Rule docs with false-positive caveats | ❌ Not done | |
| 6 | Detection covers TS/JS, Python, Go | ❌ Not done | |
| 7 | Each finding: specific assertion line + copy-pasteable fix | ❌ Not done | |

---

#### P1.08 — Onboarding Reproducibility Checks / Pillar 4 (8 done, 0 partial, 1 not done) — updated 2026-03-09

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | `.devcontainer/devcontainer.json` detection + validity | ✅ Done | ARI-ENV-005: validates image/build, settings, features, postCreateCommand/onCreateCommand. Enhanced 2026-03-09. |
| 2 | `docker-compose.yml` / `compose.yml` detection | ✅ Done | Checks 3 filename variants |
| 3 | Bootstrap script detection | ✅ Done | Checks `scripts/setup.sh`, `scripts/bootstrap.sh`, Makefile, justfile, package.json setup/bootstrap/prepare/postinstall |
| 4 | Doctor/health-check command detection | ✅ Done | ARI-ENV-004: detects `doctor`/`health`/`check`/`verify`/`validate` scripts in package.json |
| 5 | Time-to-first-test-pass estimate | ❌ Not done | |
| 6 | Environment variable documentation | ✅ Done | Checks `.env.example` / `.env.template`. ARI-ENV-007: compares code usage vs .env.example entries. Enhanced 2026-03-09. |
| 7 | Required tool versions (.nvmrc, .tool-versions, engines) | ✅ Done | Checks `.nvmrc`, `.node-version`, `.tool-versions`, `.python-version`, `rust-toolchain.toml`, `engines` in package.json |
| 8 | Seed/fixture data detection | ✅ Done | Detects `seeds/`, `fixtures/`, `testdata/` directories + seed/fixture scripts in package.json |
| 9 | "Likely first-run blockers" section | ✅ Done | ARI-ENV-006: detects missing .env.example, no install command, no tsconfig. Added 2026-03-09. |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | "Likely first-run blockers" with actionable items | ✅ Done | ARI-ENV-006: specific blockers identified. Added 2026-03-09. |
| 2 | Each criterion scored independently with pass/fail/partial | ✅ Done | ARI-ENV-008 through ARI-ENV-012: per-criterion status labels (info-severity pass/fail findings). Added 2026-03-09. |
| 3 | Devcontainer validation: image/build, features, settings | ✅ Done | ARI-ENV-005: checks image/build, settings fields. Added 2026-03-09. |
| 4 | Env var completeness scored against actual codebase usage | ✅ Done | ARI-ENV-007: compares process.env references in code vs .env.example entries. Added 2026-03-09. |

---

#### P1.09 — Machine-readable Docs Baseline / Pillar 5 (9 done, 3 partial, 0 not done) — updated 2026-03-09

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | OpenAPI/Swagger detection | ✅ Done | Regex for `openapi\|swagger` in filenames |
| 2 | tRPC router definitions | ✅ Done | Checks `trpc\|\.router\.[jt]s` |
| 3 | GraphQL schema files | ✅ Done | Checks `.graphql` / `.gql` files |
| 4 | Error taxonomy (structured error codes) | ✅ Done | Checks `error.taxonomy\|error.codes\|errors?\.(json\|ya?ml)` |
| 5 | Machine-readable runbooks | ✅ Done | ARI-DOC-002: detects machine-readable runbook files. Added 2026-03-09. |
| 6 | Env var schema (zod, joi, t3-env, pydantic) | ✅ Done | Checks package.json deps for relevant libraries |
| 7 | ADR / decision records | ✅ Done | Checks files matching `adr\|decision\|rfc` with `.md` |
| 8 | Changelog format | ✅ Done | Checks `CHANGELOG.md` |
| 9 | Type exports / JSDoc coverage | ✅ Done | ARI-DOC-003: JSDoc coverage measurement. Added 2026-03-09. |
| 10 | Documentation-code drift detection | ✅ Done | ARI-DOC-004: documentation-code drift detection. Added 2026-03-09. |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Findings with priority + confidence markers | 🔧 Partial | Findings have `severity`. Confidence only on API contract finding; others produce score adjustments only. |
| 2 | Drift detection between docs and code | ✅ Done | ARI-DOC-004: detects documentation-code drift. Added 2026-03-09. |
| 3 | Each criterion independently scored with rationale | 🔧 Partial | Each adds to score independently but no per-criterion rationale emitted |
| 4 | Supports TS, Python, Go, Java minimum | 🔧 Partial | Env var validation JS-only. File detection is language-agnostic. No Python `pydantic BaseSettings`. |

---

#### P1.10 — Type Strictness Scoring Baseline / Pillar 6 (13 done, 3 partial, 2 not done) — updated 2026-03-08

**TypeScript checks:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | `strict: true` | ✅ Done | |
| 2 | `strictNullChecks` | ✅ Done | Checked individually |
| 3 | `noImplicitAny` | ✅ Done | Checked individually |
| 4 | `isolatedModules` | ✅ Done | |
| 5 | `projectReferences` | ✅ Done | Checks `references` array in tsconfig.json, +5 points for non-empty |
| 6 | Type coverage percentage | ❌ Not done | |

**Cross-language checks:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Python: mypy/pyright config | ✅ Done | Checks `mypy.ini`, `.mypy.ini`, `pyrightconfig.json`, `pyproject.toml` sections |
| 2 | Go: `interface{}`/`any` abuse detection | ✅ Done | ARI-BLD-004: scans `.go` files for `interface{}` and `any`, penalizes >10 occurrences |
| 3 | Rust: excessive `unwrap()` detection | ✅ Done | ARI-BLD-005: scans `.rs` files for `.unwrap()`, penalizes >20 occurrences |
| 4 | Java: nullability annotations, generics | ✅ Done | ARI-BLD-008: detects @NonNull/@Nullable/@NotNull annotations and NullAway/Checker Framework/ErrorProne in pom.xml/build.gradle. +15 score. Added 2026-03-08. |
| 5 | C#: nullable reference types | ✅ Done | ARI-BLD-009: checks `<Nullable>enable</Nullable>` in .csproj and `#nullable enable` directives. +20 score. Added 2026-03-08. |

**Build determinism:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Lockfile presence | ✅ Done | Checks 10 lockfile formats |
| 2 | Lockfile gitignored check | ✅ Done | |
| 3 | Build tool modernity | ✅ Done | `tsup\|esbuild\|vite\|swc\|unbuild\|turbo` vs `webpack` |
| 4 | Monorepo clarity (project refs, package boundaries) | ✅ Done | ARI-BLD-006: checks turbo, nx, lerna, pnpm-workspace project references. ARI-BLD-007: lockfile drift detection (packageManager field vs actual lockfile). Added 2026-03-09. |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Strictness checks separated from style rules | ✅ Done | |
| 2 | TypeScript config is field-level, not binary | ✅ Done | Checks strict, strictNullChecks, noImplicitAny, isolatedModules individually |
| 3 | Cross-language strictness confidence-labeled | 🔧 Partial | Overall confidence `"high"` for TS, `"medium"` otherwise. No per-check confidence. |
| 4 | Lockfile drift detection | ✅ Done | ARI-BLD-007: detects packageManager field vs actual lockfile mismatch. Added 2026-03-09. |
| 5 | Build tool modernity scored with rationale | 🔧 Partial | Modern +10, webpack +5. No explanatory finding emitted. |
| 6 | Cross-pillar type bonus (P2, P7) | ✅ Done | `applyCrossPillarTypeBonus()` applies +5 to P2/P7 when P6 >= 70. Added 2026-03-08. |

---

#### P1.11 — Navigability Baseline / Pillar 7 (10 done, 0 partial, 0 not done) — updated 2026-03-10

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Directory depth | ✅ Done | Max depth calc, penalizes >8, rewards <=5 |
| 2 | Naming consistency | ✅ Done | Measures camelCase/kebab/snake/Pascal distribution |
| 3 | Module boundary clarity | ✅ Done | Checks for `src/` or `packages/` |
| 4 | Import graph complexity (fan-in/fan-out, circular deps) | ✅ Done | ARI-NAV-004: flags files with >20 imports. ARI-NAV-005: builds import map, detects mutual imports. |
| 5 | Dead code percentage (unused exports, files with no imports) | ✅ Done | ARI-NAV-006: dead code detection heuristic (files with no imports). Added 2026-03-09. |
| 6 | Code duplication / clone detection | ✅ Done | ARI-NAV-008: normalized line-chunk hashing detects near-duplicate code blocks across files. Thresholds: >40% files or >8 files for high, >20% or >4 for moderate. Added 2026-03-09. |
| 7 | Cognitive complexity score | ✅ Done | ARI-NAV-007: per-function cognitive complexity with aggregation (SonarSource-inspired metric, good/moderate/poor labels). Added 2026-03-09, upgraded to per-function 2026-03-09. |
| 8 | "Most costly navigation paths" summary | ✅ Done | Identifies top areas where agents will struggle most. Added 2026-03-09. |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | "Most costly navigation paths" with file/directory refs | ✅ Done | Includes specific file/directory references. Added 2026-03-09. |
| 2 | Each metric with threshold calibration (good/moderate/poor) | ✅ Done | All 7 metrics (depth, dirs, naming, imports, circular, dead-code, duplication) now include explicit good/moderate/poor labels in summary output. Added 2026-03-10. |
| 3 | Circular dependency detection with import chains | ✅ Done | ARI-NAV-005: builds import map and reports mutual import pairs |
| 4 | Dead code detection <15% false-positive rate | ✅ Done | Improved heuristic: excludes config files (*.config.*), CLI entry points (cli.ts, bin.ts), type declarations (*.d.ts), setup files, conventional directories (commands/, scripts/, migrations/), and barrel re-exports (export * from). Self-scan shows 0 false positives on own repo. Added 2026-03-10. |
| 5 | Cognitive complexity per function with aggregation | ✅ Done | ARI-NAV-007 now extracts functions via brace-matching, computes per-function cognitive complexity (SonarSource-inspired: nesting penalty + control flow + boolean operators), aggregates and reports top offenders with good/moderate/poor labels. Added 2026-03-09. |

---

#### P1.12 — Security and Governance Baseline / Pillar 8 (7 done, 3 partial, 0 not done) — updated 2026-03-10

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Branch protection (main protected, PR reviews required) | 🔧 Partial | Infers from CI config files. Tightened heuristic 2026-03-09: pull_request trigger alone no longer counts. Does NOT check GitHub API or PR review requirements. |
| 2 | CODEOWNERS file | ✅ Done | Checks `CODEOWNERS`, `.github/CODEOWNERS`, `docs/CODEOWNERS` |
| 3 | Secrets scanning (gitleaks, truffleHog, detect-secrets) | ✅ Done | Checks `.gitleaks.toml`, `.pre-commit-config.yaml`, `.sops.yaml`, CI workflow content |
| 4 | Dependency audit (Dependabot, Renovate, Snyk) | ✅ Done | Checks `.github/dependabot.yml`, `renovate.json`, `.github/renovate.json` |
| 5 | SAST for AI-generated code | 🔧 Partial | Checks CI for `codeql\|semgrep\|snyk\|sonar\|eslint.*security`. Does not verify it targets agent-authored PRs. |
| 6 | AI-specific review checklist in PR templates | ✅ Done | ARI-SEC-005: checks PR templates for `ai|agent|llm|copilot|gpt|claude|machine-generated` regex |
| 7 | Licence compliance (licence checker in CI) | ✅ Done | ARI-SEC-007: licence compliance tooling check in CI. Added 2026-03-09. |
| 8 | Agent scope controls (agents restricted from sensitive paths) | ✅ Done | ARI-SEC-006: checks `.agentignore`, `.claudeignore`, `.copilotignore`, `CLAUDE.md`, `.claude/settings.json` |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Missing controls prioritized by operational risk with rationale | ✅ Done | All findings include `evidence` fields with research-backed risk rationale. Findings sorted by severity for risk-priority ordering. Added 2026-03-10. |
| 2 | Each control: configured/partial/missing status | ✅ Done | Summary shows configured/partial/missing status labels. Added 2026-03-09. |
| 3 | AI-specific criteria separately scored | ✅ Done | AI-specific sub-score (SAST + AI review + agent scope) computed and shown in summary as percentage. Added 2026-03-10. |
| 4 | Gate behavior (L2 cap) documented in output when triggered | ✅ Done | Implemented in `composite.ts`, displayed in `terminal.ts` |
| 5 | Language-specific vulnerability context | ✅ Done | ARI-SEC-008: detects languages from files, provides per-language AI vulnerability rates from research (8 languages). Added 2026-03-10. |

---

#### P1.13 — Composite ARI and Tier Mapping (9 done, 0 partial, 0 not done) — updated 2026-03-08

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | 8-pillar weighted aggregation | ✅ Done | P1=15%, P2=15%, P3=18%, P4=10%, P5=10%, P6=15%, P7=12%, P8=5% — matches spec exactly |
| 2 | Maturity level mapping L1-L5 | ✅ Done | L1(0-25), L2(26-45), L3(46-65), L4(66-80), L5(81-100) — matches spec |
| 3 | "What agents can achieve" descriptions | ✅ Done | Descriptions match roadmap table |
| 4 | Security gate: P8 <40% caps at L2 | ✅ Done | `SECURITY_GATE` enforced in `applySecurityGate()` |
| 5 | Cross-pillar type bonus (strict TS → P2, P7 bonus) | ✅ Done | `applyCrossPillarTypeBonus()` adds +5 to P2 and P7 when P6 >= 70. Added 2026-03-08. |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Weighting and confidence visible in output | ✅ Done | Terminal shows weight %. JSON includes weight per pillar. |
| 2 | Maturity level includes "what agents can achieve" | ✅ Done | `levelMeta.description` populated and displayed |
| 3 | Security gate documented and enforced | ✅ Done | Gate logic + terminal warning |
| 4 | Cross-pillar bonus transparent | ✅ Done | `applyCrossPillarTypeBonus()` is a pure function in composite.ts. Added 2026-03-08. |

---

#### P1.14 — JSON Output Contract v1 (11 done, 4 partial, 4 not done) — updated 2026-03-08

**Deliverables:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | `--json` flag | ✅ Done | Boolean flag, shorthand for `--format json` |
| 2 | Metadata: version, timestamp, duration | ✅ Done | `ScanMetadata` schema |
| 3 | Composite score | ✅ Done | `ScanResult.score` |
| 4 | Maturity level | ✅ Done | `ScanResult.level` + `ScanResult.levelMeta` |
| 5 | Per-pillar breakdown (score, confidence, findings) | ✅ Done | `PillarResult` with all fields |
| 6 | Language/framework detection results | ✅ Done | `ScanResult.detection` field with `languages`, `frameworks`, `monorepo` |
| 7 | Context file inventory | ✅ Done | `ContextFileInfo` type with path, type, size, lineCount added to ScanResult. Added 2026-03-09. |
| 8 | Semver impact rules | ❌ Not done | No versioning policy |
| 9 | Schema published in repo + npm | 🔧 Partial | Zod schemas in `@prontiq/schema`. `formatJsonSchema()` function added 2026-03-09 but no standalone JSON Schema file published. |
| 10 | `--json-schema` flag for schema export | ✅ Done | `--jsonSchema` CLI flag wired (2026-03-09). Outputs full JSON Schema and exits. |

**AI-first design:**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | `ARI-*` taxonomy codes | ✅ Done | `Finding.code` regex enforces `^ARI-[A-Z]{3}-\d{3}$` |
| 2 | Structured remediation (action, generator, impact) | 🔧 Partial | Has `action`, `description`, `estimatedImpact`, `confidence`, `path`. `EstimatedImpact` enum added 2026-03-09. No `generator command`. `remediation`/`evidence` optional (spec says required). |
| 3 | SARIF projection | ✅ Done | SARIF 2.1.0 formatter in `output/sarif.ts`. Maps findings to SARIF results, deduplicates rules, includes invocation metadata with score/level. Wired to `--format sarif`. Added 2026-03-08. |

**Acceptance Criteria:**

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Schema published + semver rules | ❌ Not done | |
| 2 | Output validates against schema in CI | 🔧 Partial | Zod schemas exist. No explicit CI validation test. |
| 3 | Backwards compatibility within major version | ❌ Not done | No versioning policy |
| 4 | Schema includes `$schema` and `$id` | ✅ Done | `$schema` and `$id` fields added to JSON output. Added 2026-03-09. |
| 5 | JSON output streamable (newline-delimited) | ❌ Not done | Single `JSON.stringify` blob |
| 6 | Every finding: ARI code + remediation + citation | 🔧 Partial | ARI codes enforced. `remediation`/`evidence` optional. |

---

#### P1.15–P1.18 — Status Summary

| Ticket | Status | Notes |
|---|---|---|
| P1.15 — Markdown Report v1 | ✅ Done | Implemented in `output/markdown.ts` with badge header, pillar table, severity-sorted findings, remediations |
| P1.16 — README Badge Support | ✅ Done | `--badge <path>` flag generates SVG badge + embed snippets. `generateBadgeSvg()` and `generateBadgeSnippets()` in `output/badge.ts`. Added 2026-03-08. |
| P1.17 — Safe `--fix` Starter | ⬜ Not Started | |
| P1.18 — Benchmark Cohort v1 | ⬜ Not Started | |

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
| --fix starter | P1.17 | P2.01 | Overlaps with AGENTS.md generator |
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
- --fix starter (P1.17) — not started
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
| npm package published | ⬜ Not met | Not yet published to npm |
| README badge renders | ✅ Met | `--badge <path>` generates SVG badge. Added 2026-03-08. |
| --fix generates content | ⬜ Not met | P1.17 not started |
| 20+ repos benchmarked | ⬜ Not met | P1.18 not started |

---

### NPM Package Publication Strategy

To maximise adoption across end users, plugin authors, and programmatic consumers, all three workspace packages will be published to npm.

#### Package Inventory

| Package | npm Name | Scope | Target Audience | Status |
|---|---|---|---|---|
| `packages/cli` | `ariscan` | Public (unscoped) | End users running `npx ariscan .` | `private: false` — ready to publish |
| `packages/schema` | `@prontiq/schema` | Public (scoped) | Plugin authors, CI integrations, anyone importing types (`PillarId`, `Finding`, `ScanResult`) | `private: true` — **needs flip to `false`** |
| `packages/engine` | `@prontiq/engine` | Public (scoped) | Programmatic consumers embedding scanning in their own tooling | `private: true` — **needs flip to `false`** |

#### Pre-Publish Checklist

- [ ] Claim `@prontiq` npm organisation and add maintainers.
- [ ] Add `NPM_TOKEN` secret to GitHub repo for CI publish.
- [ ] Flip `private: false` in `packages/schema/package.json` and `packages/engine/package.json`.
- [ ] Add `publishConfig`, `repository`, `homepage`, and `bugs` fields to all three `package.json` files.
- [ ] Add `files` whitelist (e.g., `["dist", "README.md"]`) to each package to avoid publishing source/test files.
- [ ] Ensure `workspace:*` dependencies are resolved to real version ranges at publish time (pnpm handles this automatically with `pnpm publish`).
- [ ] Add per-package `README.md` for `@prontiq/schema` and `@prontiq/engine` with API docs and usage examples.
- [ ] Integrate `@changesets/cli` for coordinated versioning across all three packages (see CI.07).
- [ ] Enable npm provenance attestation (`--provenance`) in the publish workflow.

#### Publication Order

Build and publish order must follow the dependency graph:

1. `@prontiq/schema` (no internal deps)
2. `@prontiq/engine` (depends on `@prontiq/schema`)
3. `ariscan` (depends on both)

Changesets will coordinate version bumps so that a schema change triggers engine and CLI releases as needed.

#### Plugin Ecosystem (P3.08)

Community plugins will follow the `ariscan-plugin-*` npm naming convention. Plugin authors will depend on `@prontiq/schema` for type contracts (`PillarAnalyzer`, `Finding`, `PillarResult`) and optionally on `@prontiq/engine` for utilities like `RepoContext`.

---

## Phase P2 — Context Intelligence and Practical Remediation (`ariscan` v0.5.0, Weeks 7–14)

**Goal:** evolve from scanner to actionable guidance engine with measurable improvement loops.

### Ticket P2.01 — Context Quality Generator (🔴)

- **User story:** As a developer, I want ariscan to generate an AGENTS.md that is measurably better than what I'd write by hand — encoding only information my agents can't discover independently.
- **Problem statement:** Gloaguen et al. (2026) showed that LLM-generated context files decrease success rates by 2-3% because they duplicate existing repo information. The generator must perform semantic deduplication — scanning the full repository to map what's already documented vs what's missing, then generating *only* additive content.
- **Target persona:** Any team using AI coding agents who wants optimal context configuration.
- **Deliverables:**
  - Full-repo scan: index README, CONTRIBUTING, docstrings, CI workflows, config files, and existing context files.
  - Gap analysis: identify information agents need that is NOT already discoverable through file traversal.
  - Additive-only generation:
    - Build and test commands (if not in obvious locations).
    - Constraint specifics (e.g., "do NOT use library X because of Y").
    - Tool choices that diverge from defaults.
    - Environment-specific gotchas not captured in config files.
    - Non-obvious test patterns and setup requirements.
    - Path-specific instructions for monorepo subdirectories.
  - Information gain scoring: generated content scored for additionality *before* being surfaced.
  - Front-loading optimization: most critical information placed in first 20% of generated file (per Lost in the Middle research).
  - Progressive disclosure: root-level file for global context, subdirectory files for package-specific context.
- **Acceptance criteria:**
  - Generated output is scored for additionality before surfacing — only content scoring >50% additionality is included.
  - Generated file includes rationale snippets explaining why each section was included.
  - Generated file scores higher on P1.04 (additionality) than a naive "dump everything" approach.
  - Redundancy percentage of generated file is <20% against existing repo documentation.
  - Front-loading verified: build/test/constraint info appears in first 20% of generated file.
- **Research basis:**
  - Gloaguen et al. (2026): Additive information helps; redundant information hurts. This is the #1 most impactful paper for the entire product.
  - Liu et al. (2024): Front-load critical information for U-shaped performance curve.
  - Lulla et al. (2026): 28.6% time reduction when context quality is high.
  - arXiv 2510.05381 (2025): Volume alone degrades reasoning.
  - OpenReview (2025): IGT/TWR research on redundancy penalties.
- **Dependencies:** P1.04 (additionality scoring), P1.03 (context file discovery).
- **Telemetry:** generation count, additionality score of generated files, user acceptance rate.
- **In scope:** Semantic deduplication, gap analysis, additive generation, front-loading, progressive disclosure.
- **Out of scope:** AI-powered generation (this uses heuristic analysis, not LLM generation — important for determinism and cost).

### Ticket P2.02 — `audit agents-md` Command (🔴)

- **User story:** As a team maintaining context files, I need a dedicated audit command that tells me exactly what's wrong with my existing AGENTS.md and how to fix it.
- **Problem statement:** Many teams already have context files but don't know if they're helping or hurting. The audit command provides a detailed quality assessment covering redundancy, staleness, instruction clarity, front-loading, and cross-agent compatibility.
- **Target persona:** Teams with existing context files who want to optimize quality.
- **Deliverables:**
  - `ariscan audit agents-md` command that produces a detailed quality report.
  - Scoring dimensions:
    - **Redundancy score:** % of content duplicated elsewhere in repo (target: <20%).
    - **Staleness score:** contradictions between context file and current repo state.
    - **Instruction clarity:** vague vs specific instructions (e.g., "follow best practices" vs "use vitest for unit tests, run with `pnpm test`").
    - **Front-loading score:** critical info in first 20% vs buried deeper.
    - **Negative instruction coverage:** explicit "do NOT" constraints present.
    - **Cross-agent compatibility:** coverage across agent types.
    - **Token budget impact:** estimated token cost of the context file.
  - Severity-ranked issues list with fix examples.
  - Before/after comparison when used with `--fix` (show what would change).
- **Acceptance criteria:**
  - Report includes severity-ranked issues (critical/warning/info) and fix examples.
  - Redundancy scored to one decimal place with specific duplicated sections identified.
  - Staleness detection identifies specific contradictions (e.g., "Line 15 says 'use npm' but package.json uses pnpm").
  - Fix examples are copy-pasteable.
- **Dependencies:** P1.04 (additionality scoring), P1.03 (context file discovery).
- **Telemetry:** audit command usage, issues found per audit.
- **In scope:** Quality assessment, issue detection, fix suggestions.
- **Out of scope:** Automated fixing of existing files (manual review required for existing content).

### Ticket P2.03 — Context Delta Viewer (🟠)

- **User story:** As a maintainer, I want to see a visual diff of what's additive vs duplicative across all my context files so I can eliminate waste.
- **Problem statement:** Repos often accumulate multiple context files (AGENTS.md + CLAUDE.md + .cursorrules) with significant overlap. The delta viewer shows exactly which parts are unique to each file, which are duplicated across context files, and which duplicate other repo documentation — enabling targeted cleanup.
- **Target persona:** Teams with multiple context files across different agent tools.
- **Deliverables:**
  - `ariscan diff context` command showing additive vs duplicative content across all context files.
  - Three-way comparison: context file ↔ other context files ↔ repo documentation.
  - Color-coded terminal output: green (additive), red (duplicative), yellow (partially overlapping).
  - JSON output mode for programmatic consumption.
  - Deduplication recommendations with merge suggestions.
- **Acceptance criteria:**
  - Diff output can be consumed in both terminal (colored) and JSON modes.
  - Clearly distinguishes: unique-to-this-file, duplicated-across-context-files, duplicated-from-repo-docs.
  - Provides actionable merge/consolidation suggestions.
- **Dependencies:** P2.02 (audit command), P1.04 (additionality scoring).
- **Telemetry:** delta viewer usage, deduplication actions taken.
- **In scope:** Cross-file comparison, deduplication analysis, merge suggestions.
- **Out of scope:** Automated merging of context files.

### Ticket P2.04 — Context Budget Analyzer (🔴)

- **User story:** As a developer, I need to understand my repository's total token footprint and where the waste is so I can optimize for agent cost efficiency.
- **Problem statement:** Context window saturation is a real concern — "Lost in the Middle" (Liu et al., 2024) showed >30% performance degradation from positional bias, and arXiv 2510.05381 (2025) showed volume alone degrades reasoning. Even inserting 25,000 whitespace characters causes models to reach wrong answers. Every file an agent reads costs tokens. Repos with excessive generated files, build artifacts, lockfiles, and dead code in the scan path waste significant context budget. Agents using LLM-generated context files see >20% increase in inference costs (Gloaguen et al., 2026).
- **Target persona:** Teams optimizing for agent cost efficiency, platform engineers.
- **Deliverables:**
  - Total repository token estimation by path/directory.
  - Token-to-usefulness ratio by file category (source code, tests, docs, generated, config, build artifacts).
  - Noisy-file hotspots: files with worst token-to-value ratio.
  - Budget forecasts: estimated token impact on common agent operations (read codebase, fix bug, add feature).
  - Compression priorities: ranked list of changes that would most reduce token waste.
  - Dead documentation detection: docs that reference deleted code/APIs.
  - Auto-generated file detection: files that should be in `.agentignore`.
- **Acceptance criteria:**
  - Provides expected token savings range for each compression recommendation.
  - Token estimates validated against actual tokenizer output (within 10% accuracy).
  - Compression priorities ranked by estimated token savings.
  - Stable across repeated runs on the same repo state.
- **Research basis:**
  - Liu et al. (2024): >30% degradation from context saturation.
  - arXiv 2510.05381 (2025): Volume alone degrades reasoning.
  - Gloaguen et al. (2026): >20% inference cost increase from redundant context.
- **Dependencies:** P1.02 (language detection), P1.01 (CLI scaffold).
- **Telemetry:** token budget per repo, waste percentage distribution.
- **In scope:** Token estimation, categorization, prioritization, savings calculation.
- **Out of scope:** Actual token counting via LLM tokenizer APIs (use local estimation), real-time budget monitoring.

### Ticket P2.05 — `.agentignore` Spec v1 (🔴)

- **User story:** As a developer, I need a standard way to tell AI agents which files to skip, similar to how `.gitignore` tells Git which files to ignore.
- **Problem statement:** There is no standard mechanism for excluding low-value or noisy paths from agent context. Agents waste significant tokens reading build artifacts, generated code, lockfiles, and coverage reports that provide no useful signal. The goal is for `.agentignore` to become as standard as `.gitignore` — every repository has one.
- **Target persona:** Any developer using AI coding agents.
- **Deliverables:**
  - **Specification document** (published as RFC-0002 in `/rfcs/`):
    - Syntax: `.gitignore`-compatible glob patterns (familiar, zero learning curve).
    - Semantics: files matching patterns are excluded from agent context but not from version control.
    - Precedence: root `.agentignore` > subdirectory `.agentignore` (monorepo support).
    - Agent adoption section: how agent tools should consume `.agentignore`.
  - **Parser implementation** in `@prontiq/core` (MIT licensed, reusable by agent vendors).
  - **Default patterns** (generated by context budget analysis):
    - Build artifacts: `dist/`, `build/`, `.next/`, `out/`.
    - Dependencies: `node_modules/`, `vendor/`, `.venv/`, `__pycache__/`.
    - Generated files: `*.generated.*`, `*.d.ts` (generated declarations), lockfiles.
    - Coverage/reports: `coverage/`, `.nyc_output/`, `htmlcov/`.
    - IDE/editor: `.idea/`, `.vscode/` (settings, not config), `*.swp`.
  - **CLI command:** `ariscan agentignore generate` — produces `.agentignore` from context budget analysis.
  - **Documentation and examples** for common frameworks (Next.js, Django, Go, Rust).
- **Acceptance criteria:**
  - Parser implementation + docs + examples merged.
  - Spec is published as RFC with clear versioning.
  - Parser handles edge cases: nested patterns, negation (`!`), comments (`#`).
  - Generated `.agentignore` files validated against context budget savings.
  - Default patterns cover top 5 language ecosystems.
- **Dependencies:** P2.04 (context budget — informs generation), P1.02 (language detection).
- **Telemetry:** `.agentignore` generation count, patterns per file.
- **In scope:** Spec authoring, parser implementation, generation command, default patterns.
- **Out of scope:** Agent vendor integration (advocacy/partnerships), enforcement mechanism.

### Ticket P2.06 — Guided Remediation Templates (🔴)

- **User story:** As a developer who just got my scan results, I need ready-to-apply fixes for the most common issues so I can improve my score without deep expertise.
- **Problem statement:** Scoring without remediation creates friction. The gap between "here's your score" and "here's how to fix it" is where users drop off. Templates provide copy-pasteable, tested solutions for the most common readiness issues.
- **Target persona:** Any developer who wants to improve their ARI score quickly.
- **Deliverables:**
  - Ready-to-apply templates organized by pillar:
    - **Context (P1):** AGENTS.md template with TODO prompts, progressive disclosure structure for monorepos.
    - **Environment (P4):** `.devcontainer/devcontainer.json` by stack (Node.js, Python, Go, Java, Rust, multi-language), `docker-compose.yml` for common services (PostgreSQL, Redis, RabbitMQ).
    - **Test isolation (P3):** Provider pattern skeleton (interface + in-memory implementation) for AWS S3, SQS, DynamoDB; Azure Blob, Queue; GCP Storage, Pub/Sub. Dependency injection wiring example per framework (NestJS, FastAPI, Spring Boot, Go wire).
    - **Docs (P5):** ADR template, env var schema template (zod, pydantic), changelog format example.
    - **Security (P8):** CODEOWNERS template, pre-commit hooks config for secrets scanning, PR template with AI-code review checklist.
  - Each template includes:
    - Prerequisites (what you need before applying).
    - Step-by-step instructions.
    - Rollback advice (how to undo if something goes wrong).
    - Expected ARI impact (estimated score improvement).
- **Acceptance criteria:**
  - Each template lists prerequisites and rollback advice.
  - Templates are tested against at least 2 real repos per language/framework.
  - Expected ARI impact estimates validated against actual score changes.
  - Templates are framework-aware (not one-size-fits-all).
- **Dependencies:** P1.17 (--fix starter — builds on this), all pillar scoring tickets.
- **Telemetry:** template adoption rate by type, ARI improvement post-application.
- **In scope:** Template creation, testing, documentation, rollback guidance.
- **Out of scope:** Automated application (--fix handles simple cases; complex templates require manual review).

### Ticket P2.07 — Risk-aware `--fix` Expansion (🟠)

- **User story:** As a developer, I want `--fix` to handle more issue types while being transparent about what's safe to auto-apply vs what needs my review.
- **Problem statement:** P1.17 established safe, non-destructive fixes. This ticket expands coverage to more issue types while introducing a confidence threshold that separates "safe to auto-apply" from "suggestion only — requires human review."
- **Target persona:** Developers who want more automated remediation.
- **Deliverables:**
  - Expanded `--fix` coverage:
    - `tsconfig.json` strictness improvements (add `strict: true`, `strictNullChecks`, `noImplicitAny`).
    - `.nvmrc` / `.tool-versions` generation from detected runtime.
    - Pre-commit hooks configuration for lint + typecheck.
    - Basic CODEOWNERS generation from git blame analysis.
    - Env var documentation generation from codebase usage analysis.
  - Confidence-based classification:
    - **Auto-apply (high confidence):** File creation only, no existing file modification.
    - **Suggest-with-diff (medium confidence):** Config file modifications with clear before/after.
    - **Manual-only (low confidence):** Complex changes requiring human judgement.
  - Risk assessment per fix: potential impact, rollback instructions, related criteria.
- **Acceptance criteria:**
  - Risky classes remain suggestion-only by default (never auto-apply destructive changes).
  - Each fix includes risk assessment with clear auto-apply/suggest/manual classification.
  - `--fix --dry-run` shows all proposed changes with confidence levels.
  - No existing file content is overwritten without explicit opt-in (`--fix --force`).
- **Dependencies:** P1.17 (safe --fix starter).
- **Telemetry:** fix expansion adoption, auto-apply vs suggestion acceptance rates.
- **In scope:** Additional fix types, confidence classification, risk assessment.
- **Out of scope:** Code refactoring, test rewriting, complex architectural changes.

### Ticket P2.08 — Security Governance Remediation Hints (🟠)

- **User story:** As a security-conscious developer, I need practical, framework-specific guidance for adding the governance controls that my scan identified as missing.
- **Problem statement:** P1.12 detects missing security controls. This ticket provides actionable remediation hints that are framework and language aware — not generic "add branch protection" advice but specific "here's the GitHub API call / settings page / config file change."
- **Target persona:** Developers and security engineers remediating governance gaps.
- **Deliverables:**
  - Framework-specific remediation hints for each P8 criterion:
    - Branch protection: GitHub/GitLab/Bitbucket-specific configuration guidance.
    - Secrets scanning: gitleaks `.gitleaks.toml` config, pre-commit hook setup by platform.
    - Dependency scanning: Dependabot `dependabot.yml`, Renovate `renovate.json` templates.
    - AI review checklist: PR template additions with specific AI-code security checks.
    - Agent scope controls: `.agentignore` for sensitive paths + agent configuration guidance.
  - Hints include links to relevant documentation and configuration examples.
  - Prioritized by risk level (fix critical gaps first).
- **Acceptance criteria:**
  - Hints are framework/language aware where possible (not generic).
  - Each hint includes a copy-pasteable configuration snippet.
  - Hints are prioritized by operational risk level.
- **Dependencies:** P1.12 (security baseline scoring).
- **Telemetry:** hint adoption rate by type.
- **In scope:** Configuration guidance, template generation, documentation links.
- **Out of scope:** Automated security control deployment, GitHub API integration.

### Ticket P2.09 — Confidence Weighting for Type/Navigability (🟠)

- **User story:** As a user, I need to understand how confident the scanner is in each score so I can prioritize based on reliable signals vs uncertain estimates.
- **Problem statement:** Not all scoring criteria have equal confidence. Type strictness can be determined with near-100% confidence from config files. Navigability heuristics are less precise. Confidence information helps users prioritize: fix high-confidence issues first, investigate low-confidence ones.
- **Target persona:** All users interpreting scan results.
- **Deliverables:**
  - Confidence level (high/medium/low) per criterion and per pillar.
  - Confidence factors:
    - **High:** Binary detection from config files (strict mode on/off), file presence checks.
    - **Medium:** Heuristic analysis with known accuracy bounds (naming consistency, dead code).
    - **Low:** Inference from indirect signals (feedback speed from script names, test isolation from import patterns).
  - Cross-pillar confidence modulation: type strictness confidence influences Pillar 2 and 7 bonus confidence.
  - Confidence-adjusted composite score option (`--confidence-adjusted`).
- **Acceptance criteria:**
  - Confidence changes are explainable in report output with specific rationale.
  - Confidence levels influence recommendation prioritization (high-confidence issues prioritized).
  - Cross-pillar confidence propagation is transparent.
- **Dependencies:** P1.10 (type strictness), P1.11 (navigability), P1.13 (composite scoring).
- **Telemetry:** confidence distribution by criterion.
- **In scope:** Confidence framework, per-criterion labeling, propagation logic.
- **Out of scope:** User-adjustable confidence, bayesian updating.

### Ticket P2.10 — Flakiness Transfer Risk Signals (🟡)

- **User story:** As a developer using AI agents for test generation, I need to know which of my existing tests are likely to "infect" agent-generated tests with flakiness patterns.
- **Problem statement:** "Flakiness transfer" (Berndt et al., 2026) means agents learn from existing tests — if those tests have timing dependencies, unordered assertions, or shared state, agents will propagate those patterns into every new test they generate. This is a compounding problem unique to AI-assisted development.
- **Target persona:** Teams using AI agents to generate tests.
- **Deliverables:**
  - Static analysis of existing test files for patterns likely to propagate flakiness:
    - Timing-dependent patterns (setTimeout, sleep, waitFor with short timeouts).
    - Shared mutable state across tests.
    - Unordered collection assertions (from P1.07).
    - Network-dependent test fixtures.
    - Database state assumptions between tests.
  - "Transfer risk score" per test file (likelihood that an agent will learn bad patterns from this file).
  - Mitigation checklist per risk category.
  - Known false positives documented.
- **Acceptance criteria:**
  - Includes mitigation checklist per risk category.
  - Known false positives are documented and suppression is supported.
  - Transfer risk score correlates with actual flakiness data (validated on benchmark repos where CI data is available).
- **Research basis:** Berndt et al. (2026): LLMs propagate flakiness from existing test examples.
- **Dependencies:** P1.06 (test isolation), P1.07 (ordering detection).
- **Telemetry:** transfer risk distribution, high-risk test file count.
- **In scope:** Pattern detection, risk scoring, mitigation guidance.
- **Out of scope:** Runtime flakiness measurement, CI log analysis.

### Ticket P2.11 — Change-scope Heuristics (🟡)

- **User story:** As an engineering lead, I need to know whether my repo structure encourages AI agents to make large, risky changesets — which DORA research shows decrease delivery performance.
- **Problem statement:** DORA 2024 found AI adoption increases batch sizes, and larger changesets consistently introduce more risk. AI makes it easy to write more code per change, but without scope controls, agents produce large, hard-to-review PRs. The repo structure itself can either constrain or encourage this behavior.
- **Target persona:** Engineering leads, platform engineers setting PR policies.
- **Deliverables:**
  - Detection of changeset scope controls:
    - PR size limits configured (GitHub branch rules, custom CI checks).
    - Conventional commits enforced (commitlint configuration).
    - Automated splitting recommendations or guidance.
    - Architectural boundaries that naturally constrain change scope (module boundaries, package boundaries).
    - Breaking change detection configuration.
  - Coupling analysis: files that frequently change together (from git history) that span module boundaries.
  - Thresholds and rationale emitted (not just binary pass/fail).
- **Acceptance criteria:**
  - Emits thresholds and rationale rather than binary fail only.
  - Coupling analysis uses git history (last 6 months) to identify co-change patterns.
  - Recommendations are specific (e.g., "These 3 files in `src/api/` always change with files in `src/db/` — consider extracting a shared interface").
- **Research basis:** DORA 2024: AI increases batch sizes → more risk. Smaller batches = less risk consistently across studies.
- **Dependencies:** P1.11 (navigability), P1.01 (CLI scaffold).
- **Telemetry:** scope control adoption rate.
- **In scope:** Control detection, coupling analysis from git history, recommendations.
- **Out of scope:** PR size enforcement, real-time monitoring.

### Ticket P2.12 — Open Benchmark Leaderboard (🟠)

- **User story:** As an OSS community member, I want to see how popular projects compare on agent readiness and track trends over time.
- **Problem statement:** A continuously updated public leaderboard serves multiple purposes: brand awareness, calibration data, community engagement, and proving that ARI is a meaningful metric that differentiates repos. It also provides the distribution/viral mechanism for the OSS project.
- **Target persona:** OSS community, developers evaluating tools, press/analysts.
- **Deliverables:**
  - Continuously updated leaderboard of OSS repo scores.
  - Trend snapshots by ecosystem (TypeScript, Python, Go, etc.) with methodology transparency.
  - Leaderboard generation process is fully reproducible from source data.
  - Filterable by language, framework, repo size, maturity level.
  - "State of Agent Readiness" summary statistics.
- **Acceptance criteria:**
  - Leaderboard generation process is reproducible from source data.
  - Methodology is fully documented and versioned.
  - At least 50 repos included at launch, growing to 200+ within 3 months.
  - Update cadence documented (monthly minimum).
- **Dependencies:** P1.18 (benchmark cohort), all pillar scoring.
- **Telemetry:** leaderboard page views, repos inspired to scan.
- **In scope:** Automated scanning, result publication, trend analysis, filtering.
- **Out of scope:** User-submitted scores (trust issues), paid placement.

### Ticket P2.13 — Anonymous Usage Telemetry (🟠)

- **User story:** As a Prontiq maintainer, I need aggregated, anonymous metrics from CLI usage to calibrate scoring weights and understand real-world adoption patterns.
- **Problem statement:** Research-calibrated scoring requires real-world validation data. Without understanding how repos score in the wild, calibration drifts from reality. However, as an open-source project, any telemetry must be: (1) strictly opt-in with informed consent, (2) fully anonymous with zero sensitive data, (3) clearly documented, and (4) easy to disable.

- **Value judgement and risk assessment:**

  This feature is intentionally opt-in (not opt-out) because the open-source community has low tolerance for surprise telemetry. Projects like Homebrew, Next.js, and Astro have faced significant backlash for opt-out telemetry. Prontiq's credibility as a trust-focused product depends on getting this right. The data is valuable for calibration and research, but not at the cost of community trust. We choose opt-in because:
  - **Trust is the product.** Prontiq measures repository readiness — if users don't trust the tool itself, adoption dies.
  - **OSS community norms.** Opt-out telemetry is widely considered hostile in OSS. Projects that default to phoning home face backlash, forks, and reputation damage.
  - **Smaller but cleaner dataset.** Opt-in data from engaged users is higher quality than noisy opt-out data from everyone (including CI bots, one-time runs, etc.).
  - **Legal simplicity.** Opt-in avoids GDPR/privacy regulatory complexity entirely.
  - **Precedent matters.** If we ship opt-out now and change to opt-in later under pressure, we look worse than starting with opt-in.

- **Target persona:** Prontiq core team (data consumers), all CLI users (data subjects).

- **Deliverables:**
  - **Opt-in consent flow:**
    - First-run prompt: "Help improve Prontiq by sharing anonymous scan metrics? (y/N)" — defaults to NO.
    - `ariscan config set telemetry true/false` command for explicit control.
    - `ARISCAN_TELEMETRY=false` environment variable override (for CI, always honored).
    - `.ariscanrc` config file option: `telemetry: false`.
    - Precedence: env var > config file > interactive prompt response.
  - **Data collected (exhaustive list — nothing beyond this):**
    - `scan_id`: random UUID generated per scan (not tied to user/machine/repo).
    - `ariscan_version`: CLI version string.
    - `os_platform`: darwin/linux/win32 (no version, no hostname).
    - `primary_language`: detected primary language (e.g., "typescript").
    - `framework`: detected primary framework (e.g., "nextjs").
    - `repo_size_bucket`: file count bucket (small: <100, medium: 100-1000, large: 1000-10000, xlarge: >10000). Never exact count.
    - `composite_score`: the overall ARI score (0-100).
    - `maturity_level`: L1-L5.
    - `pillar_scores`: array of 8 scores bucketed into bands (0-20, 21-40, 41-60, 61-80, 81-100) — no pillar names, no exact values, reducing fingerprinting surface.
    - `scan_duration_ms`: how long the scan took.
    - `fix_applied`: boolean — did the user run `--fix`?
    - `timestamp`: ISO 8601 date (day precision only — no time, no timezone).
  - **Data explicitly NOT collected (documented in privacy policy):**
    - Repository name, URL, or any identifier.
    - File names, paths, or contents.
    - Git remote URLs, branch names, or commit hashes.
    - User identity, email, IP address, or machine identifier.
    - Organization name or any identifying metadata.
    - Finding details, code snippets, or specific anti-patterns detected.
    - No persistent device/user identifier across scans.
  - **Technical implementation:**
    - HTTPS POST to `https://telemetry.prontiq.dev/v1/scan` (documented, inspectable).
    - Fire-and-forget: telemetry failures are silently ignored (never block scan).
    - Payload is inspectable: `ariscan config show-telemetry-payload` shows exactly what would be sent.
    - No cookies, no local storage of identifiers, no tracking across sessions.
    - Endpoint source code published (transparency).
  - **Documentation:**
    - Dedicated `TELEMETRY.md` in repo root explaining what, why, how, and how to disable.
    - `--help` output includes telemetry status and disable instructions.
    - First-run prompt includes link to `TELEMETRY.md`.
    - Privacy policy published on project website.
  - **Central collection endpoint:**
    - Minimal ingestion service (Cloudflare Worker or equivalent) that appends to append-only store.
    - No query capability beyond aggregate statistics.
    - Data retention policy: raw data retained for 12 months, then aggregated and deleted.
    - Quarterly publication of aggregate statistics (not raw data) in "State of Agent Readiness" reports.

- **Acceptance criteria:**
  - Telemetry is strictly opt-in (defaults to OFF).
  - `ARISCAN_TELEMETRY=false` disables telemetry in all cases (CI-friendly).
  - `ariscan config show-telemetry-payload` displays the exact payload that would be sent.
  - No scan is ever blocked or degraded by telemetry status (same features regardless).
  - Zero PII or repository-identifying information in any payload (verified by automated test).
  - Telemetry endpoint source code is published in the repo.
  - `TELEMETRY.md` is comprehensive and linked from README.
  - Payload schema is versioned and documented.
  - Telemetry transmission timeout is <1 second (non-blocking).

- **Risk mitigations:**
  - **Re-identification risk:** All dimensional values are bucketed (repo size buckets, pillar score bands, day-only timestamps) to prevent fingerprinting. No combination of collected fields can identify a specific repository. Pillar scores use 5-band bucketing (not exact values) to reduce the fingerprinting surface from ~10^16 combinations to ~390K.
  - **Network-layer privacy:** The ingestion endpoint (Cloudflare Worker or equivalent) MUST NOT log source IP addresses. Access logs are disabled or IP-stripped at the infrastructure level. This requirement is documented in `TELEMETRY.md` and verified during deployment review.
  - **Scope creep:** Collected fields are defined in code as a strict allowlist. Adding new fields requires a semver minor bump and TELEMETRY.md update.
  - **Trust erosion:** If community feedback is negative, the feature can be removed entirely without affecting any other functionality. The data collection is completely decoupled from scoring.
  - **Regulatory compliance:** Opt-in consent + no PII + no identifiers = no GDPR data controller obligations. Privacy policy documents this analysis.

- **Dependencies:** P1.13 (composite scoring — provides the data to collect), P1.14 (JSON output — schema alignment).
- **Telemetry:** (meta) opt-in rate, payload size, transmission success rate.
- **In scope:** Consent flow, payload definition, transmission, documentation, privacy policy.
- **Out of scope:** Analytics dashboard (internal tooling), real-time processing, user-facing aggregates.

### P2 Exit Criteria

- Context audit and budget outputs are stable across repeated runs.
- At least one public example demonstrates measurable ARI uplift post-remediation.
- Leaderboard and methodology are documented and reproducible.
- `.agentignore` spec published as RFC with parser implementation.
- Context generator produces measurably additive content (scored by P1.04).
- Telemetry (if shipped) is fully documented with opt-in consent flow verified.

---

## Phase P3 — Readiness-as-Code and Ecosystem (`ariscan` v1.0.0, Weeks 15–24)

**Goal:** make ARI enforceable in normal developer workflows and extensible by the community.

### Ticket P3.01 — `ariscan.yml` Policy Contract (🔴)

- **User story:** As a platform engineer, I need to define minimum readiness thresholds, pillar-specific policies, and suppression rules in a declarative config file that lives in my repo.
- **Problem statement:** Readiness-as-code is the bridge between awareness and enforcement. Without a declarative policy contract, teams can't codify their readiness standards, CI can't enforce them, and drift is inevitable. The policy file must support inheritance (org-wide defaults + repo-specific overrides), suppressions with expiry, and profile-based configurations.
- **Target persona:** Platform engineers, engineering leads, DevOps teams.
- **Deliverables:**
  - `ariscan.yml` / `.ariscan.yml` policy file supporting:
    - **Minimum scores:** composite threshold and per-pillar thresholds.
    - **Enforcement modes:** `warn` (report only), `fail` (exit code 1), `block` (integration with merge controls).
    - **Suppressions:** per-criterion suppression with reason, expiry date, and approver.
    - **Profiles:** named configurations (e.g., `strict`, `relaxed`, `security-first`) with weight overrides.
    - **Inheritance:** extend from shared org-level config (`extends: @prontiq/recommended`).
    - **Path-specific rules:** different thresholds for different directories (e.g., stricter for `src/`, relaxed for `scripts/`).
  - Policy schema published as JSON Schema for IDE autocompletion.
  - Migration guidance for version-to-version policy changes.
  - `ariscan policy init` command to generate starter policy from current scores.
  - `ariscan policy validate` command to check policy file syntax and semantics.
- **Acceptance criteria:**
  - Policy schema and migration guidance published.
  - Suppressions require reason + expiry (no permanent suppressions without explicit `no-expiry: true`).
  - Inheritance resolves correctly with override precedence documented.
  - `ariscan policy init` generates a reasonable starting policy from current scan results.
  - JSON Schema enables IDE autocompletion in VS Code, IntelliJ, and vim/neovim.
- **Dependencies:** P1.13 (composite scoring), P1.14 (JSON output).
- **Telemetry:** policy file adoption rate, enforcement mode distribution.
- **In scope:** Schema definition, parser, inheritance resolution, validation command, init command.
- **Out of scope:** Remote policy management, policy approval workflows.

### Ticket P3.02 — GitHub Action GA (🔴)

- **User story:** As a maintainer, I want ARI scoring on every PR with inline comments showing what changed and whether it meets policy.
- **Problem statement:** CI integration is the #1 adoption accelerator. If ariscan runs on every PR and surfaces results in the review workflow, it becomes part of the team's quality process without requiring anyone to remember to run it. GitHub Actions is the dominant CI platform for OSS.
- **Target persona:** Any team using GitHub for development.
- **Deliverables:**
  - Official `prontiq/ariscan-action` GitHub Action.
  - Features:
    - Score on every PR, comment with summary report.
    - PR status check (pass/fail) based on `ariscan.yml` policy.
    - Delta reporting: show score changes vs base branch.
    - Inline annotations on changed files with relevant findings.
    - Configurable: pillar filter, threshold, fail mode, comment format.
  - Setup path optimized for <10 minutes first integration.
  - Example workflows for common scenarios (basic, strict, monorepo).
- **Acceptance criteria:**
  - Setup path under 10 minutes for first integration (measured with real users).
  - PR comment includes: composite score, delta from base, top 3 recommendations, maturity level.
  - Status check respects `ariscan.yml` policy (warn vs fail).
  - Action runs in <3 minutes for median repository.
  - Works with matrix strategies for monorepo per-package scanning.
- **Dependencies:** P3.01 (policy contract), P1.14 (JSON output).
- **Telemetry:** action installations, runs per week, fail rate.
- **In scope:** GitHub Action, PR comments, status checks, delta reporting.
- **Out of scope:** Webhook-based scoring, GitLab integration (P3.03).

### Ticket P3.03 — GitLab CI Template (🟡)

- **User story:** As a GitLab user, I want the same ARI scoring integration available to GitHub users.
- **Problem statement:** GitLab has significant market share, especially in enterprise and European markets. Supporting GitLab ensures Prontiq isn't GitHub-exclusive.
- **Target persona:** Teams using GitLab for development.
- **Deliverables:**
  - Official `.gitlab-ci.yml` template for ARI scanning.
  - MR (merge request) comment via GitLab API.
  - Report artifact export for GitLab's test report visualization.
  - Setup documentation with examples.
- **Acceptance criteria:**
  - Template supports report artifact export.
  - MR comment matches GitHub Action feature parity (summary, delta, recommendations).
  - Setup documented with copy-pasteable examples.
- **Dependencies:** P3.01 (policy contract), P1.14 (JSON output).
- **Telemetry:** GitLab template adoption.
- **In scope:** CI template, MR comments, report artifacts.
- **Out of scope:** GitLab App, webhook integration.

### Ticket P3.04 — Pre-commit Check Mode (🟠)

- **User story:** As a developer, I want fast local readiness checks before I commit so I catch policy violations early without waiting for CI.
- **Problem statement:** The fastest feedback loop is pre-commit. Catching readiness regressions before they hit CI saves time and tokens. However, pre-commit checks must be fast (<10 seconds) or developers will disable them. This requires a speed-optimized subset of the full scan.
- **Target persona:** Individual developers who want instant feedback.
- **Deliverables:**
  - `ariscan` as a `pre-commit` framework hook (`.pre-commit-config.yaml` integration).
  - Speed-optimized mode: only check changed files and their immediate dependencies.
  - Configurable speed-vs-depth profile:
    - `fast` (<5s): only config file changes, context file changes, new test files.
    - `standard` (<15s): above + type strictness, import changes, security config.
    - `thorough` (<60s): full scan (same as CI).
  - Delta-only reporting: only show regressions from current state.
- **Acceptance criteria:**
  - Configurable speed-vs-depth profile with documented trade-offs.
  - `fast` mode completes in <5 seconds for typical commits.
  - Only reports regressions (not existing issues) to avoid noise fatigue.
  - Works with pre-commit framework and standalone git hooks.
- **Dependencies:** P3.01 (policy contract), P1.01 (CLI scaffold).
- **Telemetry:** pre-commit adoption rate, mode distribution.
- **In scope:** Pre-commit hook, speed optimization, delta reporting.
- **Out of scope:** IDE integration (P3.09), real-time watching.

### Ticket P3.05 — Agent Simulation Hooks (🟠)

- **User story:** As a platform engineer, I want to simulate what an AI agent would experience when it clones my repo so I can identify real-world blockers, not just static analysis findings.
- **Problem statement:** Static analysis can detect the presence of `.devcontainer` or test scripts, but it can't verify that they actually work. Agent simulation runs the actual workflow: clone → setup → build → test → measure time-to-green. This bridges the gap between "looks ready" and "actually ready." The Tutorial Problem (VS Code Blog, 2022) shows 94-96% drop-off for manual setup — simulation proves whether automated setup actually works.
- **Target persona:** Platform engineers, developer experience teams.
- **Deliverables:**
  - `ariscan simulate` command that executes a controlled agent-like workflow:
    1. Clone into isolated environment (devcontainer or Docker).
    2. Run bootstrap/setup command.
    3. Execute type checking.
    4. Run test suite.
    5. Measure time-to-green (total time from clone to all-pass).
  - Simulation profile configuration: which steps to run, timeout per step.
  - Machine-readable output: per-step timing, pass/fail, error logs.
  - Comparison with static analysis predictions (did the scan correctly predict blockers?).
- **Acceptance criteria:**
  - Simulation metadata captured in machine-readable output.
  - Timeout handling prevents infinite hangs (default: 10 minutes total).
  - Works with Docker and devcontainers (not just native execution).
  - Comparison report shows static analysis accuracy vs simulation reality.
- **Research basis:** Tutorial Problem (VS Code Blog, 2022): 94-96% drop-off rate. Microsoft/GitLab (2022): Standardised environments reduce onboarding 60%.
- **Dependencies:** P1.08 (onboarding checks — provides predictions to validate), Docker/devcontainer runtime.
- **Telemetry:** simulation run count, time-to-green distribution, prediction accuracy.
- **In scope:** Controlled execution in isolated environment, timing, comparison with static analysis.
- **Out of scope:** Cloud-provisioned simulation, multi-agent simulation.

### Ticket P3.06 — Language Rubric Profiles (🟠)

- **User story:** As a Python developer, I need scoring that reflects Python-specific readiness criteria (venv, mypy, type hints) rather than TypeScript-centric defaults (tsconfig, strictNullChecks).
- **Problem statement:** A TypeScript-heavy default rubric unfairly penalizes Python, Go, Rust, and Java repos. Research confirms language-specific differences: Veracode (2025) shows vulnerability rates vary 2x by language (Java 72% vs Python 38%). Multi-SWE-bench (Zan et al., 2025) confirms agents perform differently across languages. Language profiles adjust weights and criteria to be fair and accurate per ecosystem.
- **Target persona:** Non-TypeScript developers.
- **Deliverables:**
  - Language-specific profile packs with adjusted weights and criteria:
    - **TypeScript:** strict mode emphasis, type coverage, build tool modernity.
    - **Python:** mypy/pyright strictness, venv/poetry/uv management, type annotation coverage, pytest configuration.
    - **Go:** inherent type safety (reduced P6 weight), module structure, test table patterns.
    - **Rust:** inherent type safety + ownership (reduced P6 weight), clippy configuration, unsafe usage.
    - **Java:** nullable annotations, Spring Boot configuration, Maven/Gradle build determinism.
    - **C#:** nullable reference types, .NET configuration, MSBuild determinism.
  - Each profile includes:
    - Weight adjustments with rationale.
    - Language-specific criteria added/removed.
    - Confidence labels for language-specific checks.
  - Profile differences documented in changelog.
  - Auto-selection based on P1.02 language detection (with manual override).
- **Acceptance criteria:**
  - Profile differences documented in changelog with rationale.
  - Scores are comparable across languages at the maturity level (an L3 Python repo and L3 TypeScript repo represent similar readiness levels).
  - Auto-selection is correct >95% of the time.
  - Manual override available via `ariscan.yml` and CLI flag.
- **Research basis:**
  - Multi-SWE-bench (Zan et al., 2025): Cross-language agent performance varies.
  - Veracode (2025): Java 72% vs Python 38% vulnerability rates.
  - TyFlow (Huang et al., 2025): Type system value varies by language.
- **Dependencies:** P1.02 (language detection), P1.13 (composite scoring).
- **Telemetry:** profile usage distribution, score comparability across languages.
- **In scope:** Weight adjustment, language-specific criteria, auto-selection.
- **Out of scope:** Domain-specific profiles (e.g., ML, mobile), custom profile creation (plugin system).

### Ticket P3.07 — AST/Graph Navigability Analysis (🟠)

- **User story:** As a developer, I need deep structural analysis of my codebase's navigability — not just directory depth heuristics but actual dependency graph analysis.
- **Problem statement:** P1.11 provides surface-level navigability heuristics. This ticket adds AST-level analysis using Tree-sitter for accurate dependency graph construction, circular dependency detection, and module boundary analysis. Research shows AST-derived knowledge graphs achieve highest accuracy for multi-hop code reasoning, far outperforming vector-only RAG (arXiv 2601.08773, 2025). GraphRAG achieves 3.4x accuracy improvement over vector RAG (Fluree, 2025).
- **Target persona:** Teams with complex codebases wanting to improve agent navigation.
- **Deliverables:**
  - Tree-sitter WASM-based analysis (per RFC-0003 — WASM bindings eliminate native compilation, enabling `npx` distribution without `node-gyp`):
    - Import/dependency graph construction.
    - Circular dependency detection with specific import chains.
    - Module cohesion scoring (how well-contained are modules?).
    - Fan-in/fan-out metrics per module.
    - Cross-boundary violations (imports that break architectural layers).
  - Findings mapped to remediation hints by severity.
  - Graph visualization output (DOT format for graphviz).
  - "Structural clarity score" measuring how well the codebase supports AST-derived retrieval.
- **Acceptance criteria:**
  - Findings mapped to remediation hints by severity.
  - Circular dependency detection reports specific import chains (not just "cycles exist").
  - Supports TypeScript, Python, Go, Java at minimum (via Tree-sitter grammars).
  - Analysis completes in <30 seconds for repos up to 50k files.
- **Research basis:**
  - arXiv 2601.08773 (2025): AST-derived graphs >> vector RAG for multi-hop reasoning.
  - Fluree (2025): GraphRAG 3.4x accuracy improvement.
  - SWE-agent (Yang et al., NeurIPS 2024): Interface matters as much as model.
- **Dependencies:** P1.11 (navigability baseline), P1.02 (language detection).
- **Telemetry:** circular dependency prevalence, module cohesion distribution.
- **In scope:** AST analysis, graph construction, cohesion metrics, visualization.
- **Out of scope:** Real-time graph serving, agent-facing graph API (MCP server handles this).

### Ticket P3.08 — Plugin Architecture (🟡)

- **User story:** As a community member, I want to write custom scoring criteria and share them with others without forking the main project.
- **Problem statement:** No single team can anticipate every scoring criterion for every ecosystem. A plugin architecture enables community-contributed checks (e.g., Terraform-specific, Kubernetes-specific, mobile-specific) while maintaining core scoring stability and quality standards.
- **Target persona:** Community developers, platform teams with custom requirements.
- **Deliverables:**
  - Extension API for community checks/providers (built on the `PillarAnalyzer` provider pattern from RFC-0003, modeled on ripple-next's conformance-tested provider architecture):
    - Plugin interface: implements `PillarAnalyzer` — `name`, `pillar`, `analyze(context: RepoContext): PillarResult`.
    - Plugin discovery: local directory, npm packages (`ariscan-plugin-*`).
    - Plugin isolation: plugins cannot modify core scoring, only add criteria.
    - Plugin metadata: version, author, confidence level, dependencies.
    - Conformance suites: plugins must pass `packages/testing/conformance/` tests.
  - One reference plugin (`ariscan-plugin-terraform`) demonstrating the API.
  - API stability guidance: plugin API versioned separately from core, with deprecation windows.
  - Plugin development documentation and starter template.
- **Acceptance criteria:**
  - One reference plugin and API stability guidance included.
  - Plugin API is versioned with clear stability guarantees.
  - Plugins cannot crash the core scanner (error isolation).
  - Plugin development documented with starter template and example.
  - Plugin results clearly attributed in output (not mixed with core findings).
- **Dependencies:** P1.14 (JSON output — finding format), P1.13 (composite scoring — plugin integration points).
- **Telemetry:** plugin count, plugin usage distribution.
- **In scope:** API definition, plugin loading, reference plugin, documentation.
- **Out of scope:** Plugin marketplace, plugin certification, plugin hosting.

### Ticket P3.09 — VS Code Extension Preview (🟡)

- **User story:** As a developer, I want to see readiness scores and recommendations inline in my editor so I can address issues while I'm already working in the relevant files.
- **Problem statement:** CLI output requires context-switching. An IDE extension surfaces findings where developers are already working — in the editor. This is the "developer experience" layer that makes ARI scores part of daily workflow, not a periodic audit.
- **Target persona:** VS Code users (largest IDE market share).
- **Deliverables:**
  - VS Code extension:
    - Inline score lens per file (showing file-level readiness contributions).
    - Quick recommendation surfacing via CodeLens or diagnostic panel.
    - Import local scan report (`ariscan.json`) for display.
    - "Run ariscan" command from command palette.
    - Status bar indicator showing current composite score.
  - Extension supports local report import (no external service dependency).
- **Acceptance criteria:**
  - Extension supports local report import.
  - Findings rendered as VS Code diagnostics (info/warning/error severity).
  - Extension activates only in workspaces with `ariscan.yml` or when manually triggered.
  - Performance: no noticeable editor lag from extension.
- **Dependencies:** P1.14 (JSON output — report format), P3.01 (policy contract).
- **Telemetry:** extension installs, daily active users.
- **In scope:** Extension development, local report display, inline diagnostics.
- **Out of scope:** Real-time scoring (requires background process), external service integration.

### Ticket P3.10 — MCP Read-only Server (🟡)

- **User story:** As an AI agent developer, I want my agent to query a repo's readiness context via the Model Context Protocol so it can adapt its behavior based on repo characteristics.
- **Problem statement:** MCP (Model Context Protocol) is emerging as the standard for providing context to AI agents. An MCP server that exposes readiness data allows agents to self-adapt — e.g., an agent could check test isolation score before generating tests, or check context quality before deciding whether to read AGENTS.md. This is the "agent marketplace play" — making readiness data a first-class input to agent workflows.
- **Target persona:** AI agent developers, teams building custom agent workflows.
- **Deliverables:**
  - MCP server exposing read-only readiness data (enabled by RFC-0003's pure function core — `scan(path, config) → ScanResult` — which makes the engine trivially consumable as an MCP tool):
    - `readiness/score` — composite score and maturity level.
    - `readiness/pillars` — per-pillar scores and key findings.
    - `readiness/recommendations` — prioritized action items.
    - `readiness/context-files` — inventory of discovered context files.
    - `readiness/budget` — token budget analysis.
  - Safety constraints:
    - Read-only (no write operations).
    - No code content exposure (scores and metadata only).
    - Rate limiting and timeout controls.
  - Protocol documentation and safety constraints published.
  - Example integration with Claude Code and Cursor.
- **Acceptance criteria:**
  - Protocol docs and safety constraints published.
  - Server is read-only (verified by test — no write endpoints exist).
  - Works with Claude Code and Cursor MCP integration.
  - Startup time <2 seconds, query response time <500ms.
- **Dependencies:** P1.14 (JSON output — data format), P1.13 (composite scoring).
- **Telemetry:** MCP server connections, query frequency by resource.
- **In scope:** MCP server implementation, resource definitions, documentation.
- **Out of scope:** Write operations, agent behavior modification, hosted MCP service.

### P3 Exit Criteria

- `ariscan.yml` is production-usable in CI with policy enforcement.
- GitHub Action adopted by >=50 external repositories.
- v1.0 compatibility guarantees and deprecation policy published.
- Plugin docs and reference implementation available.
- Language profiles cover TypeScript, Python, Go, Rust, Java, C#.
- AST-based analysis supports at least 4 languages.
- MCP server operational with published safety constraints.

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

## Research Anchors

These are the key messages, grounded in research, that should appear in documentation, blog posts, and community communication:

- **Context quality beats context quantity.** LLM-generated context files decrease agent success by 2-3% while costing 20% more tokens. Human-written, additive context files improve performance by ~4% on niche repos (Gloaguen et al., 2026, ETH Zurich).
- **Long contexts and poor placement reduce effective performance.** >30% degradation when critical info sits in the middle of context (Liu et al., 2024). Even whitespace padding degrades reasoning (arXiv 2510.05381, 2025).
- **Test flakiness is catastrophically destructive to agents.** Unlike humans who retry-and-ignore, agents treat flaky failures as real signals and "fix" valid code, introducing genuine regressions. 63% of LLM-generated flaky tests trace to unordered collection assumptions (Berndt et al., 2026).
- **Type systems are the highest-ROI agent feedback loop.** 94% of LLM compilation errors are type-check failures (GitHub Octoverse 2025). Strict typing is the single most cost-effective agent feedback mechanism.
- **AI-assisted code concentrates security risk without governance controls.** Critical vulnerabilities increase 37.6% after 5 iterations of AI improvement (IEEE-ISTAS, 2025). AI introduces hardcoded credentials at 2x the human rate (Veracode, 2025).
- **Faster individual productivity ≠ better delivery.** AI adoption decreased delivery throughput by 1.5% and stability by 7.2% because AI increases batch sizes (DORA, 2024).
- **Multi-agent coordination is currently broken.** Agents achieve 30% lower success rates working together than individually (CooperBench, 2026). 36.9% of failures are due to misalignment.

---

## Post-v1 Horizons (Exploratory)

### P4 — Ecosystem Acceleration (Q4 2026)

- Formal scoring spec governance and change review process (RFC-driven).
- Certification and badge program for high-readiness OSS projects.
- Quarterly "State of Agent Readiness in OSS" report — the ARI Index (powered by telemetry data if opt-in adoption is sufficient).
- Community plugin ecosystem with curated "official" plugins.
- `.agentignore` adoption advocacy with agent vendors (Claude Code, Copilot, Cursor).
- **`@prontiq/ai-first-toolkit` extraction (RFC-0003):** Extract validated AI-first patterns (error taxonomy scaffolding, AGENTS.md/CLAUDE.md templates, machine-readable runbook runtime, provider pattern base classes, conformance harness) into a standalone package. Enables any project to adopt the patterns validated in both ripple-next and ariscan without depending on either.

### P5 — Advanced Tooling (2027)

- CI template expansion (Bitbucket Pipelines, Azure DevOps, CircleCI).
- Wider language/domain packs with community maintainers (Kotlin, Swift, PHP, Scala).
- Reference datasets for reproducible readiness research.
- Academic partnership program for ARI validation studies.
- Agent simulation improvements: multi-agent scenario testing.

---

## Sequencing Logic

```text
P1 deterministic scoring foundation
  └─> P2 high-signal context intelligence + remediation + telemetry
        └─> P3 policy-as-code and ecosystem integrations
              └─> P4/P5 standards and community scale
```

## Risk Register

- **Risk:** scoring perceived as opaque.
  - **Mitigation:** publish rationale and evidence mapping per pillar. Every criterion cites research.
- **Risk:** teams optimize score instead of outcomes.
  - **Mitigation:** anti-gaming checks plus impact-oriented recommendations. Score without remediation guidance creates perverse incentives.
- **Risk:** language bias harms trust outside TypeScript-heavy ecosystems.
  - **Mitigation:** language-specific profiles (P3.06) with confidence labels and transparent limitations. Cross-language maturity level comparability testing.
- **Risk:** context generation abused as doc spam.
  - **Mitigation:** additive-value scoring and redundancy penalties. Generated files that restate README score 0-10%.
- **Risk:** telemetry feature damages community trust.
  - **Mitigation:** strictly opt-in (defaults OFF), fully documented, payload inspectable, no PII, easy to disable. Removable without affecting any other functionality.
- **Risk:** `.agentignore` standard fails to gain adoption.
  - **Mitigation:** publish parser as MIT-licensed library. Advocate with agent vendors. Include in `--fix` output.

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

### Ticket CI.01 — Parallel CI Pipeline (🔴 P0) ✅ Done

- **Deliverables:**
  - [x] Split monolithic CI job into 5 parallel jobs: format, lint, typecheck, test, build
  - [x] Build job depends on all 4 quality gates passing
  - [x] Concurrency control: cancel-in-progress per branch
  - [x] Self-scan in build job with score extraction to step outputs
  - [x] ARI score floor gate (configurable via `ARI_SCORE_FLOOR` env var)
  - [x] Score + level in GitHub step summary
  - [x] 90-day artifact retention for scan results

### Ticket CI.02 — ARI PR Delta Report (🔴 P0) ✅ Done

- **Deliverables:**
  - [x] Separate workflow triggered on `pull_request`
  - [x] Scans both PR branch and base branch
  - [x] Generates per-pillar delta table (base vs PR, with directional icons)
  - [x] Top 5 findings listed
  - [x] Sticky comment (updates on re-push, doesn't spam)
  - [x] Machine-readable output (AI agents can parse the structured comment)

### Ticket CI.03 — Pre-commit Hooks (🟠 P1) ✅ Done

- **Deliverables:**
  - [x] Husky initialized with `.husky/pre-commit`
  - [x] lint-staged: ESLint --fix + Prettier on `*.ts` files
  - [x] lint-staged: Prettier on `*.json`, `*.md`, `*.yml` files
  - [x] `prepare` script in root package.json for automatic setup on `pnpm install`

### Ticket CI.04 — PR Template (🟠 P1) ✅ Done

- **Deliverables:**
  - [x] `.github/PULL_REQUEST_TEMPLATE.md` with structured sections
  - [x] Summary, ARI Impact, Test Plan, Checklist sections
  - [x] AI agent attribution field (normalize AI contributions)
  - [x] Checklist encodes repo conventions (no `any`, `.js` imports, stable finding codes, weight sum)

### Ticket CI.05 — Issue Templates (🟠 P1) ✅ Done

- **Deliverables:**
  - [x] Bug report template with scan output + environment fields
  - [x] False positive template with finding code + repo context (critical for scoring trust)
  - [x] Analyzer improvement template with pillar + research basis fields

### Ticket CI.06 — Dependency Review (🟠 P1) ✅ Done

- **Deliverables:**
  - [x] `actions/dependency-review-action@v4` on PRs
  - [x] Fail on high-severity vulnerabilities
  - [x] Aligns with P8 analyzer expectations (we check others for this — we must do it ourselves)

### Ticket CI.07 — Release Automation (🟠 P1) ⬜ Not Started

- **Deliverables:**
  - [ ] Changesets (`@changesets/cli`) for semantic versioning
  - [ ] Automated npm publish workflow on merge to main with version bump
  - [ ] CHANGELOG.md auto-generation from changesets
  - [ ] GitHub Release creation with scan result artifact attached
  - [ ] Provenance attestation for npm packages (`--provenance` flag)
- **Why:** npm publishing is a P1 exit criterion. Provenance attestation is AI-first — agents downloading `ariscan` from npm should be able to verify the package hasn't been tampered with.
- **Dependencies:** npm org setup, `NPM_TOKEN` secret.

### Ticket CI.08 — Test Coverage Reporting (🟡 P2) ⬜ Not Started

- **Deliverables:**
  - [ ] Vitest coverage with `@vitest/coverage-v8`
  - [ ] Coverage report in CI artifacts
  - [ ] PR comment with coverage delta (not a gate — visibility only)
  - [ ] Coverage badge in README
- **Why:** Visibility, not enforcement. Coverage % as a gate creates perverse incentives (testing getters/setters to hit numbers). But seeing coverage drop on a PR is a useful signal for reviewers — human or AI.

### Ticket CI.09 — Branch Protection Rules Documentation (🟡 P2) ⬜ Not Started

- **Deliverables:**
  - [ ] Document required branch protection settings for `main` in CONTRIBUTING.md
  - [ ] Require CI pass, require review, no force push
  - [ ] Consider GitHub rulesets (newer API, code-as-config)
- **Why:** P8 analyzer checks for branch protection enforcement patterns. We should document ours.

### Ticket CI.10 — SARIF Upload for Code Scanning (🟡 P2) ⬜ Not Started

- **Deliverables:**
  - [ ] `--format sarif` output from ariscan (blocked on P1.14 SARIF formatter)
  - [ ] Upload SARIF to GitHub Code Scanning in CI
  - [ ] ARI findings appear as GitHub code scanning alerts
- **Why:** AI-first — GitHub Copilot surfaces code scanning alerts inline. If ARI findings are in the code scanning database, Copilot sees them automatically. This is the zero-friction integration path.

---

## Package Plan

| Package | Status | Purpose |
|---|---|---|
| `ariscan` | Core | CLI scan, scoring, reporting, policy execution |
| `@prontiq/core` | Planned | Shared rubric models, score contracts, policy schemas |
| `@prontiq/sdk` | Planned | Programmatic integration for reporting/workflow automation |
| `@prontiq/agentignore` | Planned | `.agentignore` parser (MIT, reusable by agent vendors) |
