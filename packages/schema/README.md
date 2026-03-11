# @prontiq/ariscan-schema

> Zod schemas and TypeScript types for the [ARI (Agent Readiness Index)](https://github.com/jbejenar/prontiq-ariscan) scoring framework.

This package contains the shared type contracts used by `@prontiq/ariscan-engine`, `ariscan`, and third-party plugins.

## Install

```bash
npm install @prontiq/ariscan-schema
```

## Exports

### Pillar Definitions

```ts
import {
  PillarId,           // "P1" | "P2" | ... | "P8"
  PillarDefinition,   // { id, name, weight }
  MaturityLevel,      // "L1" | "L2" | "L3" | "L4" | "L5"
  PILLAR_NAMES,       // Record<PillarId, string>
  PILLAR_WEIGHTS,     // Record<PillarId, number> (sum = 1.0)
  MATURITY_NAMES,     // Record<MaturityLevel, string>
  MATURITY_THRESHOLDS,// Score boundaries for each level
  SECURITY_GATE,      // Threshold below which Security caps maturity at L2
} from "@prontiq/ariscan-schema";
```

### Scan Results

```ts
import {
  Severity,           // "critical" | "high" | "medium" | "low" | "info"
  Confidence,         // "low" | "medium" | "high"
  Finding,            // Individual issue found by an analyzer
  PillarResult,       // Score + findings for one pillar
  ScanResult,         // Complete scan output (all pillars + metadata)
  ScanMetadata,       // Timing, version, repo path
  DetectedLanguage,   // Language detection result
  DetectedFramework,  // Framework detection result
  DetectedMonorepo,   // Monorepo tool detection result
  DetectionResult,    // Combined detection output
} from "@prontiq/ariscan-schema";
```

### Configuration

```ts
import {
  ScanConfig,         // Runtime scan configuration
  FileConfig,         // .ariscan.yml file shape
  PillarOverride,     // Per-pillar enable/disable + weight override
} from "@prontiq/ariscan-schema";
```

## Usage with Zod

All types are Zod-validated. You can use the schemas for runtime validation of scan results (e.g., in CI pipelines or plugin conformance tests).

## Related Packages

- [`ariscan`](https://www.npmjs.com/package/ariscan) — CLI tool
- [`@prontiq/ariscan-engine`](https://www.npmjs.com/package/@prontiq/ariscan-engine) — Scoring engine

## License

Elastic License 2.0 (ELv2)
