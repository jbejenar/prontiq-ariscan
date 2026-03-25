/**
 * Context-aware remediation adapter (P2.18).
 *
 * Rewrites Finding remediation descriptions based on detected build systems
 * and repo archetype. Findings remain unchanged structurally — only
 * `remediation.description` text is adapted.
 */

import type {
  Finding,
  PillarResult,
  DetectionResult,
  RepoProfile,
  BuildSystem,
  Archetype,
} from "@prontiq/ariscan-schema";

// ---------------------------------------------------------------------------
// Build-tool adaptation rules
// ---------------------------------------------------------------------------

interface BuildToolRule {
  /** Pattern to match in the original description. */
  match: string | RegExp;
  /** Replacement description. Use `{tool}` as placeholder for the detected tool name. */
  replacement: string;
}

/** Build-tool-specific remediation overrides keyed by finding code. */
const BUILD_TOOL_RULES: Record<string, Partial<Record<BuildSystem, BuildToolRule>>> = {
  // "Add a 'test' script to package.json"
  "ARI-FBK-001": {
    make: {
      match: "Add a 'test' script to package.json",
      replacement: "Add a 'test' target to your Makefile (e.g., `make test`)",
    },
    poetry: {
      match: "Add a 'test' script to package.json",
      replacement:
        "Add a test command via Poetry scripts in pyproject.toml (e.g., `[tool.poetry.scripts]` or use `poetry run pytest`)",
    },
    go: {
      match: "Add a 'test' script to package.json",
      replacement: "Ensure `go test ./...` is documented in your README or Makefile",
    },
    cargo: {
      match: "Add a 'test' script to package.json",
      replacement: "Ensure `cargo test` is documented in your README or Makefile",
    },
    maven: {
      match: "Add a 'test' script to package.json",
      replacement: "Ensure `mvn test` is documented and runs successfully",
    },
    gradle: {
      match: "Add a 'test' script to package.json",
      replacement: "Ensure `gradle test` is documented and runs successfully",
    },
  },

  // "Add a 'lint' script to package.json with ESLint or equivalent"
  "ARI-FBK-002": {
    make: {
      match: /Add a 'lint' script to package\.json.*/,
      replacement: "Add a 'lint' target to your Makefile (e.g., `make lint`)",
    },
    poetry: {
      match: /Add a 'lint' script to package\.json.*/,
      replacement:
        "Configure a lint command via Poetry (e.g., `poetry run ruff check .` or `poetry run flake8`)",
    },
    go: {
      match: /Add a 'lint' script to package\.json.*/,
      replacement: "Add `golangci-lint run` to your Makefile or CI pipeline",
    },
    cargo: {
      match: /Add a 'lint' script to package\.json.*/,
      replacement: "Run `cargo clippy` as your lint step in your Makefile or CI pipeline",
    },
  },

  // "Add 'typecheck': 'tsc --noEmit' to package.json scripts"
  "ARI-FBK-003": {
    make: {
      match: /Add 'typecheck'.*package\.json scripts/,
      replacement: "Add a 'typecheck' target to your Makefile (e.g., `typecheck: tsc --noEmit`)",
    },
  },

  // "Add a 'test:watch' or 'dev' script for continuous feedback"
  "ARI-FBK-007": {
    make: {
      match: /Add a 'test:watch' or 'dev' script/,
      replacement:
        "Add a 'watch' target to your Makefile for continuous feedback during development",
    },
    poetry: {
      match: /Add a 'test:watch' or 'dev' script/,
      replacement:
        "Configure a watch command (e.g., `poetry run ptw` with pytest-watch for continuous feedback)",
    },
    go: {
      match: /Add a 'test:watch' or 'dev' script/,
      replacement:
        "Add a watch target using `air` or `entr` for continuous feedback (e.g., `find . -name '*.go' | entr go test ./...`)",
    },
  },

  // "Add Turborepo or Nx for incremental/cached builds"
  "ARI-FBK-008": {
    make: {
      match: "Add Turborepo or Nx for incremental/cached builds",
      replacement:
        "Use Make's built-in dependency tracking for incremental builds — ensure targets have proper prerequisites",
    },
    "docker-compose": {
      match: "Add Turborepo or Nx for incremental/cached builds",
      replacement: "Use Docker Compose build caching and multi-stage builds for incremental builds",
    },
    cargo: {
      match: "Add Turborepo or Nx for incremental/cached builds",
      replacement:
        "Cargo provides incremental compilation by default — ensure `cargo build` caching is preserved in CI",
    },
    go: {
      match: "Add Turborepo or Nx for incremental/cached builds",
      replacement:
        "Go provides built-in build caching — ensure `GOPATH` and build cache are preserved in CI",
    },
    maven: {
      match: "Add Turborepo or Nx for incremental/cached builds",
      replacement:
        "Use Maven incremental builds and cache `~/.m2/repository` in CI for faster builds",
    },
    gradle: {
      match: "Add Turborepo or Nx for incremental/cached builds",
      replacement:
        "Use Gradle build cache (`--build-cache`) and cache `~/.gradle` in CI for faster builds",
    },
  },

  // "Migrate from webpack to a modern bundler"
  "ARI-BLD-010": {
    make: {
      match: /Migrate from webpack/,
      replacement:
        "Consider migrating from webpack to a faster bundler (esbuild, vite) — integrate via Make target",
    },
  },
};

// ---------------------------------------------------------------------------
// Archetype adaptation rules
// ---------------------------------------------------------------------------

/** Archetype-specific description overrides keyed by finding code. */
const ARCHETYPE_RULES: Record<string, Partial<Record<Archetype, string>>> = {
  // CODEOWNERS — solo developers don't need it
  "ARI-SEC-001": {
    "solo-hobby":
      "Consider adding a CODEOWNERS file when your project grows to multiple contributors — it helps agents understand code ownership",
  },

  // SECURITY.md
  "ARI-SEC-002": {
    "solo-hobby":
      "Consider adding a SECURITY.md with vulnerability reporting instructions when your project gains external users",
  },

  // Dependency automation (Dependabot/Renovate)
  "ARI-SEC-004": {
    "solo-hobby":
      "Consider enabling Dependabot or Renovate when your project has external users — automated dependency updates reduce security exposure",
  },

  // License compliance
  "ARI-SEC-009": {
    "solo-hobby":
      "Consider adding a LICENSE file as your project grows — it clarifies usage rights for potential contributors and users",
  },

  // Branch protection
  "ARI-SEC-010": {
    "solo-hobby":
      "Consider enabling branch protection rules when collaborating with others — for solo projects, the risk is lower",
  },

  // Commitlint / changesets
  "ARI-FBK-006": {
    "solo-hobby":
      "Consider adding commit conventions as your project grows — for solo projects, informal commits are fine initially",
  },

  // PR template
  "ARI-SEC-005": {
    "solo-hobby": "Consider adding a PR template when your project accepts external contributions",
    library:
      "Add a PR template that includes sections for API surface changes, breaking changes, and type export impact",
  },

  // ADR template
  "ARI-DOC-004": {
    "solo-hobby":
      "Consider documenting key decisions in ADRs when your project grows — helpful for future contributors understanding 'why'",
  },

  // README presence/quality adaptations for library archetype
  "ARI-DOC-001": {
    library:
      "Add a README.md with API documentation, installation instructions, type export overview, and usage examples — this is your library's front door for consumers",
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Adapt pillar results with context-aware remediation text.
 *
 * Rewrites `remediation.description` based on detected build systems and
 * repo archetype. All other Finding fields are preserved unchanged.
 */
export function adaptPillarRemediation(
  pillarResults: PillarResult[],
  detection: DetectionResult,
  profile: RepoProfile,
): PillarResult[] {
  const buildSystems = detection.buildSystems ?? [];
  if (buildSystems.length === 0 && profile.archetype === "monorepo-enterprise") {
    // No adaptations needed for enterprise monorepos without non-JS build systems
    return pillarResults;
  }

  return pillarResults.map((pr) => ({
    ...pr,
    findings: pr.findings.map((f) => adaptFinding(f, buildSystems, profile.archetype)),
  }));
}

function adaptFinding(
  finding: Finding,
  buildSystems: BuildSystem[],
  archetype: Archetype,
): Finding {
  if (!finding.remediation) return finding;

  let description = finding.remediation.description;
  let adapted = false;

  // Apply build-tool rules (first matching build system wins)
  const buildRules = BUILD_TOOL_RULES[finding.code];
  if (buildRules) {
    for (const bs of buildSystems) {
      const rule = buildRules[bs];
      if (rule) {
        const original = description;
        if (typeof rule.match === "string") {
          if (description.includes(rule.match)) {
            description = description.replace(rule.match, rule.replacement);
            adapted = true;
          }
        } else {
          if (rule.match.test(description)) {
            description = description.replace(rule.match, rule.replacement);
            adapted = true;
          }
        }
        if (adapted && description !== original) break;
      }
    }
  }

  // Apply archetype rules (overrides build-tool description if present)
  const archetypeRules = ARCHETYPE_RULES[finding.code];
  if (archetypeRules) {
    const archetypeDesc = archetypeRules[archetype];
    if (archetypeDesc) {
      description = archetypeDesc;
      adapted = true;
    }
  }

  if (!adapted) return finding;

  return {
    ...finding,
    remediation: {
      ...finding.remediation,
      description,
    },
  };
}
