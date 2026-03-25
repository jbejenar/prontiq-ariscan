# ARI Scan GitHub Action

Score your repository on AI agent readiness (0-100) and report results on every PR.

## Quick Start

Add this workflow to `.github/workflows/ari.yml`:

```yaml
name: ARI Score
on:
  pull_request:
    branches: [main]

permissions:
  pull-requests: write
  contents: read

jobs:
  ari:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: prontiq/ariscan-action@v1
```

That's it. The action will:
1. Install the ARI scanner
2. Score your repository
3. Post a PR comment with the score, pillar breakdown, and top recommendations
4. Add inline annotations for findings on changed files
5. Compare against the base branch and show the delta

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Path to scan (repo root or subdirectory) | `.` |
| `threshold` | Minimum composite score (fails if below) | `0` (use policy file) |
| `config` | Path to `.ariscan.yml` policy file | auto-detected |
| `fail-on-violation` | Fail the action on policy violations | `true` |
| `comment` | Post a PR comment with results | `true` |
| `annotations` | Add inline annotations for findings | `true` |
| `delta` | Compare scores against the base branch | `true` |
| `version` | Version of `@prontiq/ariscan-cli` to install | `latest` |
| `node-version` | Node.js version to use | `22` |
| `token` | GitHub token for comments/annotations | `${{ github.token }}` |
| `skip-install` | Skip CLI installation (when CLI is already available) | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `score` | Composite ARI score (0-100) |
| `level` | Maturity level (L1-L5) |
| `delta` | Score delta from base branch |
| `result-json` | Path to the full JSON scan result |

## Policy Enforcement

Create an `.ariscan.yml` at your repo root to define policies:

```yaml
version: "1"
enforcement: fail  # warn | fail | block

thresholds:
  composite: 60
  pillars:
    P1: 50  # Agent Context Quality
    P6: 40  # Build Determinism & Type Safety

suppressions:
  - code: ARI-CTX-001
    reason: "We use a custom context format"
    expiry: "2026-06-01"
```

The action respects `enforcement` mode:
- **warn**: Reports violations but exits successfully
- **fail/block**: Fails the check if thresholds are not met

## Examples

### Basic — Score Every PR

```yaml
name: ARI Score
on:
  pull_request:
    branches: [main]

permissions:
  pull-requests: write
  contents: read

jobs:
  ari:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: prontiq/ariscan-action@v1
```

### Strict — Enforce Policy Thresholds

```yaml
name: ARI Policy Gate
on:
  pull_request:
    branches: [main]

permissions:
  pull-requests: write
  contents: read

jobs:
  ari:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: prontiq/ariscan-action@v1
        with:
          threshold: 60
          fail-on-violation: "true"
```

### Monorepo — Per-Package Scanning

```yaml
name: ARI Monorepo
on:
  pull_request:
    branches: [main]

permissions:
  pull-requests: write
  contents: read

jobs:
  ari:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [packages/api, packages/web, packages/shared]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: prontiq/ariscan-action@v1
        with:
          path: ${{ matrix.package }}
```

## PR Comment

The action posts a sticky PR comment with:
- Composite score and maturity level
- Score delta from the base branch
- Per-pillar breakdown with status indicators
- Top 3 actionable recommendations
- Security gate status (if triggered)

## Inline Annotations

Findings with file locations appear as inline annotations on changed files, making it easy to see exactly where improvements are needed during code review.
