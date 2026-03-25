# ARI Scan GitLab CI Template

Score your repository on AI agent readiness (0-100) and report results on every merge request.

## Quick Start

Add this to your `.gitlab-ci.yml`:

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/prontiq/ariscan/main/gitlab/ariscan.gitlab-ci.yml'

ari-scan:
  extends: .ari-scan
```

This gives you scanning + policy enforcement. For MR comments and Code Quality reports, you also need the companion scripts — copy the `gitlab/` directory into your repo:

```bash
# From the prontiq/ariscan repo, copy gitlab/scripts/ into your project
mkdir -p gitlab/scripts
curl -sL https://raw.githubusercontent.com/prontiq/ariscan/main/gitlab/scripts/generate-mr-comment.mjs -o gitlab/scripts/generate-mr-comment.mjs
curl -sL https://raw.githubusercontent.com/prontiq/ariscan/main/gitlab/scripts/create-codequality.mjs -o gitlab/scripts/create-codequality.mjs
```

With scripts in place, the template will:
1. Install the ARI scanner
2. Score your repository
3. Post an MR comment with the score, pillar breakdown, and top recommendations
4. Generate a Code Quality report for GitLab's MR widget
5. Compare against the target branch and show the delta

> **Note:** When using `include: remote:`, the YAML template is fetched but the companion JS scripts are not. You must copy them locally (see above) or use a local include instead.

## Prerequisites

- **Node.js** available in your CI runner (the template uses `node:22-slim` by default)
- **`GITLAB_TOKEN`** variable set in CI/CD Settings with `api` scope (for MR comments)

## Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ARI_PATH` | Path to scan (repo root or subdirectory) | `.` |
| `ARI_THRESHOLD` | Minimum composite score (fails if below) | `0` (use policy file) |
| `ARI_CONFIG` | Path to `.ariscan.yml` policy file | auto-detected |
| `ARI_FAIL_ON_VIOLATION` | Fail pipeline on policy violations | `true` |
| `ARI_COMMENT` | Post an MR comment with results | `true` |
| `ARI_DELTA` | Compare scores against target branch | `true` |
| `ARI_VERSION` | Version of `@prontiq/ariscan-cli` to install | `latest` |
| `ARI_NODE_VERSION` | Node.js major version | `22` |
| `GITLAB_TOKEN` | Token with `api` scope for MR comments | _(set in CI/CD settings)_ |

## Token Setup

1. Go to **Settings > CI/CD > Variables** in your GitLab project
2. Add a variable named `GITLAB_TOKEN`
3. Use a [project access token](https://docs.gitlab.com/ee/user/project/settings/project_access_tokens.html) or [personal access token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) with `api` scope
4. Mark it as **Masked** (recommended) and optionally **Protected**

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

## Examples

### Basic — Score Every MR

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/prontiq/ariscan/main/gitlab/ariscan.gitlab-ci.yml'

ari-scan:
  extends: .ari-scan
```

### Strict — Enforce Policy Thresholds

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/prontiq/ariscan/main/gitlab/ariscan.gitlab-ci.yml'

ari-scan:
  extends: .ari-scan
  variables:
    ARI_THRESHOLD: "60"
    ARI_FAIL_ON_VIOLATION: "true"
```

### Custom Config Path

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/prontiq/ariscan/main/gitlab/ariscan.gitlab-ci.yml'

ari-scan:
  extends: .ari-scan
  variables:
    ARI_CONFIG: ".config/ariscan.yml"
```

### Monorepo — Per-Package Scanning

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/prontiq/ariscan/main/gitlab/ariscan.gitlab-ci.yml'

ari-scan-api:
  extends: .ari-scan
  variables:
    ARI_PATH: "packages/api"

ari-scan-web:
  extends: .ari-scan
  variables:
    ARI_PATH: "packages/web"
```

### Local Include (Copy Template Into Repo)

```yaml
include:
  - local: 'gitlab/ariscan.gitlab-ci.yml'

ari-scan:
  extends: .ari-scan
```

When using local include, copy the `gitlab/` directory into your repo. The scripts in `gitlab/scripts/` will be automatically discovered.

## Artifacts

The template produces these artifacts:

| File | Description |
|------|-------------|
| `.ari-results/pr-scan.json` | Full scan result JSON |
| `.ari-results/codequality.json` | Code Quality report (Code Climate format) |

The Code Quality report integrates with GitLab's [Code Quality widget](https://docs.gitlab.com/ee/ci/testing/code_quality.html) in merge requests, showing findings inline in the diff view.

## MR Comment

The template posts a sticky MR comment with:
- Composite score and maturity level
- Score delta from the target branch
- Per-pillar breakdown with status indicators
- Top 3 actionable recommendations
- Security gate status (if triggered)

The comment is updated on subsequent pipeline runs (not duplicated).

## Feature Parity with GitHub Action

| Feature | GitHub Action | GitLab CI Template |
|---------|---------------|-------------------|
| Scan and score | Yes | Yes |
| PR/MR comment | Yes | Yes |
| Score delta | Yes | Yes |
| Inline annotations | GitHub annotations | Code Quality report |
| Policy enforcement | Yes | Yes |
| Report artifact | JSON | JSON + Code Quality |
