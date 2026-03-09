# Architecture Overview

## System Diagram

```
prontiq/ariscan (CLI — ELv2)
  | npx ariscan .
  | consumes @prontiq/engine
  |
  +-- prontiq/engine (Analysis Engine)
  |     AGENTS.md quality, context budget, semantic dedup,
  |     provider detection, AST analysis, language rubric
  |
  +-- prontiq/cloud (SaaS Platform)
  |     +-- prontiq/remediate (PR Generation)
  |     +-- prontiq/fleet (Fleet Governance)
  |     +-- prontiq/sim (Simulation Engine)
  |     +-- prontiq/data (Data Platform)
  |     +-- prontiq/api (REST API)
  |
  +-- prontiq/web (Marketing + Docs — prontiq.dev)
  +-- prontiq/infra (IaC — SST v3)
```

---

## Tech Stack

> **Reference architecture:** [ripple-next](https://github.com/jbejenar/ripple-next) — an AI-agent-first government digital platform — validated these technology choices and AI-first patterns at production scale. `ariscan` extracts the **patterns** (error taxonomy, provider pattern, machine-readable outputs, multi-agent configuration surfaces), not the code. See [RFC-0003](/rfcs/RFC-0003-tech-stack-ai-first-architecture.md) for full rationale.

### CLI Stack (`prontiq/ariscan`)

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 22 + TypeScript 5.7 (strict) | Widest install base via `npx ariscan .`, type-safe internals. Pin via `.nvmrc` + `engines`. |
| Package Manager | pnpm 9.x + pnpm workspaces | Strict dependency management, workspace support for `@prontiq/engine`. Same as ripple-next. |
| Monorepo | Turborepo | Task caching, parallel execution, workspace-aware builds. Same as ripple-next. |
| CLI Framework | citty (UnJS) | Lightweight, TypeScript-native, zero deps. Aligns with Nuxt/Nitro ecosystem. |
| AST Parsing | Tree-sitter (WASM) | Multi-language (20+ langs), incremental, no native compilation (`node-gyp`). |
| Schema/Validation | Zod | Shared schemas between CLI config, output format, and future API. Same as ripple-next. |
| Testing | Vitest | Fast, TypeScript-native, workspace-aware. Same as ripple-next. |
| Linting | ESLint 9 (flat config) + Prettier | `no-console: error`, `no-explicit-any: error`. Same as ripple-next. |
| Build | tsup (esbuild) | Single-file CLI bundle, fast builds, tree-shaking. |
| Git Hooks | Husky | Pre-commit lint + typecheck + format. Same as ripple-next. |
| Config Format | YAML + JSON Schema | `.ariscan.yml` with published schema for IDE autocomplete + agent consumption. |

### SaaS Platform Stack (`prontiq/cloud`)

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Nuxt 3 + Vue 3 | SSR for marketing pages, SPA for dashboard, single framework |
| API | Nitro + oRPC | End-to-end type safety, OpenAPI 3.1.1 generation for Readiness API. Same as ripple-next. |
| Database | Neon (Postgres) + Drizzle ORM | Serverless Postgres, branching, scale-to-zero. Repository pattern via Drizzle. Same as ripple-next. |
| Auth | Lucia Auth + GitHub OAuth | Lightweight, no vendor lock-in, GitHub-native for target audience |
| Deploy | SST v3 on AWS | Infrastructure-as-code in TypeScript. Same as ripple-next. |
| Jobs | Inngest | Event-driven, durable functions, retry/backoff built-in |
| Monitoring | Sentry + Axiom | Error tracking + structured log aggregation |
| Billing | Stripe | Industry standard, metered billing support |

### AI-First Architecture Patterns (from ripple-next)

| Pattern | Implementation | Reference |
|---|---|---|
| Error Taxonomy | `ARI-*` codes in `docs/error-taxonomy.json` | ripple-next `RPL-*` codes |
| Machine-Readable Output | `--format json` default for agents, `--format sarif` for GitHub | ripple-next `pnpm verify --json` |
| Provider Pattern | `PillarAnalyzer` interface + conformance suites per analyzer | ripple-next provider pattern + conformance |
| Structured Remediation | Findings include `remediation.action`, `remediation.generator` | ripple-next machine-readable runbooks |
| Agent Config Surfaces | AGENTS.md, CLAUDE.md, `.github/agents/`, `.github/prompts/` | ripple-next multi-surface AI config |
| Self-Check | `npx ariscan doctor --json` | ripple-next `pnpm doctor --json` |
| Pure Function Core | `scan(path, config) → ScanResult` for CLI/MCP/Action/SaaS | Enables MCP server (P3.10) |

---

## Repository Boundaries and Responsibilities

### prontiq/ariscan (ELv2)

The open-source CLI and the public face of the project. Runs entirely locally with no network calls required.

**Owns:**
- CLI entrypoint, argument parsing, config loading
- Language and framework detection
- Pillar analyser orchestration (parallel execution)
- Composite ARI score calculation and tier mapping
- JSON/Markdown output generation
- Badge generation
- `.agentignore` parsing
- `ariscan.yml` policy evaluation
- GitHub Action and CI templates

**Depends on:** `@prontiq/engine` for advanced analysis capabilities. The CLI ships with baseline analysers; the engine provides semantic depth.

**Key constraint:** Must remain genuinely useful without the engine. Free tier is not artificially limited.

### prontiq/engine
The analysis intelligence layer. Provides semantic depth beyond the baseline CLI analysers.

**Owns:**
- AGENTS.md quality scoring (additionality, staleness, redundancy)
- Context budget analysis and token burden estimation
- Semantic deduplication across context files
- AST-based navigability analysis (Tree-sitter)
- Circular dependency and cohesion detection
- Language-specific rubric profiles and weighting
- Provider detection (Claude, Copilot, Cursor, etc.)
- Calibration benchmark execution harness

**Consumed by:** ariscan (via npm), cloud, remediate, api

### prontiq/cloud
The SaaS platform serving Pro and Enterprise customers.

**Owns:**
- Repository dashboard (ARI trends, pillar drill-down, comparisons)
- GitHub App (webhook handling, check runs, PR comments)
- Merge policy controls (warn/block modes, branch targeting)
- Notification rails (Slack, Teams, email)
- User management, onboarding flows
- Billing and metering
- Peer benchmark views (anonymized cohorts)

**Depends on:** engine (scoring), db (persistence), auth (identity), queue (job orchestration), github (API integration)

### prontiq/remediate
Automated remediation PR generation and orchestration.

**Owns:**
- Safe starter PR generation (AGENTS.md, .agentignore, environment templates)
- Remediation template library and prerequisite checking
- Dry-run preview and rollback notes
- Fleet sync campaign orchestration (batch remediation across repos)
- Blast-radius preview and campaign rollback controls

**Depends on:** engine (analysis), github (PR creation), queue (campaign orchestration)

### prontiq/fleet
Enterprise fleet governance and drift management.

**Owns:**
- Fleet Dashboard (org-level posture, risk segmentation)
- Drift Detection Engine (baseline deviation, severity classification)
- Custom rubric profiles (enterprise-specific weighting)
- Compliance reporting suite (exportable audit artifacts)
- Portfolio export packs for leadership review

**Depends on:** engine (scoring), db (fleet state), cloud (UI shell), auth (RBAC)

### prontiq/sim
Agent simulation and scenario testing harness.

**Owns:**
- Clone-setup-test-time-to-green simulation workflows
- Before/after policy impact scenarios
- Simulation metadata capture and reproducibility
- Agent task profile library
- Cloud simulation mode for enterprise

**Depends on:** engine (analysis), infra (isolated execution environments)

### prontiq/data
Analytics, forecasting, and ARI Index publication.

**Owns:**
- Outcome Correlation Engine (ARI vs completion rates, token spend)
- Cost Forecasting Models (scenario planning by tier)
- Codebase DNA Clustering (archetype segmentation)
- DORA Correlation Models (readiness vs delivery performance)
- ARI Index publication pipeline (quarterly reports)
- Custom benchmarking product (fleet vs peer cohort)
- Dynamic vulnerability weighting

**Data governance:** Tenant isolation, dataset lineage/versioning, retention/deletion controls, opt-in/opt-out policies. Non-negotiable.

### prontiq/api
Public REST API for integrations and enterprise consumption.

**Owns:**
- Tenant-safe endpoints for scores, policies, reports
- API versioning with deprecation windows
- Rate limiting, quotas, and SLA classes
- API key management and usage analytics
- Developer documentation and SDKs

**Depends on:** engine (scoring), db (persistence), auth (tenant isolation)

### prontiq/web
Public-facing website, documentation, and benchmark publication.

**Owns:**
- Marketing site (prontiq.dev)
- Public documentation (scoring methodology, CLI usage, API docs)
- Benchmark publication pages
- Blog and changelog

### prontiq/infra
Shared infrastructure-as-code and operational controls.

**Owns:**
- SST v3 infrastructure definitions
- Environment provisioning (dev, staging, production)
- Shared networking, DNS, and certificate management
- CI/CD pipeline definitions
- Monitoring and alerting infrastructure
- Secret management and rotation

---

## Data Flows

### CLI Scan (Local)

```
npx ariscan .
  -> Config loading (CLI flags > ariscan.yml > defaults)
  -> Language/framework detection
  -> Context file discovery (AGENTS.md, CLAUDE.md, Copilot rules, MCP files)
  -> Pillar analysers (parallel execution, 8 pillars)
  -> Weight application + confidence calculation
  -> Security gate check (P8 < 40% -> cap at L2)
  -> Composite ARI score + L1-L5 level
  -> Output (JSON / Markdown / terminal)
  -> Exit code (0=pass, 1=fail, 2=warn per policy)
```

### SaaS PR Scoring Flow

```
PR opened on GitHub
  -> GitHub webhook -> cloud receives event
  -> cloud queues analysis job (Inngest)
  -> engine analyses diff + full repo state
  -> ARI delta calculated (before/after)
  -> PR comment posted with score delta and top risks
  -> If score < policy threshold -> check run fails -> block merge
  -> If regression detected -> trigger remediate
  -> remediate opens fix PR with rationale and rollback notes
```

### Fleet Drift Detection

```
Scheduled job (weekly)
  -> fleet fetches all connected repos for org
  -> engine scores each repo against baseline policy
  -> Drift Detection Engine classifies deviations
  -> Severity assignment (warning / action required)
  -> Weekly drift report generated
  -> Notifications dispatched (Slack / Teams / email)
  -> Remediation queue updated with new items
```

### Data Collection and Analytics

```
Every scan (CLI + SaaS)
  -> Anonymised pillar scores to data platform (opt-out available)
  -> Pro/Enterprise with telemetry opt-in:
     -> Agent task completion rates
     -> Token consumption per task
     -> Iteration counts
     -> CI pass/fail correlation
  -> Feeds Outcome Correlation Engine (monthly)
  -> Powers Cost Forecasting Models
  -> Aggregates into ARI Index (quarterly publication)
```

---

## Shared Package Architecture

```
@prontiq/engine   -- Core scoring intelligence (consumed by all services)
@prontiq/db       -- Shared data model, Drizzle ORM, tenancy controls
@prontiq/auth     -- AuthN/AuthZ primitives, Lucia session management
@prontiq/queue    -- Inngest workflow definitions, retry/DLQ policies
@prontiq/github   -- GitHub App integration, webhook verification, PR ops
```

### Package Dependency Graph

```
ariscan -> @prontiq/engine
cloud   -> @prontiq/engine, @prontiq/db, @prontiq/auth, @prontiq/queue, @prontiq/github
remediate -> @prontiq/engine, @prontiq/db, @prontiq/queue, @prontiq/github
fleet   -> @prontiq/engine, @prontiq/db, @prontiq/auth, @prontiq/queue
api     -> @prontiq/engine, @prontiq/db, @prontiq/auth
data    -> @prontiq/db, @prontiq/queue
sim     -> @prontiq/engine, @prontiq/queue
```

---

## Security Architecture

### Tenant Isolation
- Row-level security in Postgres (Neon) for all customer data
- API keys scoped to tenant with least-privilege defaults
- Webhook verification for all inbound GitHub events
- Scan results never cross tenant boundaries

### Authentication and Authorization
- GitHub OAuth for initial sign-up (natural for target audience)
- SSO/SAML for Enterprise tier (Phase 2)
- RBAC with roles: Owner, Admin, Member, Viewer
- SCIM provisioning for enterprise identity sync
- Session management via Lucia Auth with secure cookie handling

### Data Protection
- Encryption at rest (AWS KMS) and in transit (TLS 1.3)
- No source code stored — only structural analysis metadata
- Anonymization pipeline for all aggregate analytics
- Customer data retention/deletion aligned to contracts
- Explicit opt-in/opt-out for telemetry data collection

### Operational Security
- Branch protection on all production repos
- CODEOWNERS enforcement for security-sensitive paths
- Dependency scanning (Dependabot + Snyk)
- SAST in CI pipeline
- Secret rotation automation via infra
- Incident playbooks and escalation matrix (Phase 2)
