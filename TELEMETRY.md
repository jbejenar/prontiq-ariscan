# Telemetry

Prontiq ARI collects **anonymous, opt-in** usage telemetry to help improve scoring accuracy and prioritize development.

**Telemetry is disabled by default.** No data is ever sent without your explicit consent.

## What is collected

Every telemetry payload contains exactly these fields — nothing more:

| Field | Example | Description |
|-------|---------|-------------|
| `scan_id` | `"a1b2c3d4-..."` | Random UUID per scan (not persisted, not linkable) |
| `version` | `"0.1.0"` | CLI version |
| `platform` | `"darwin"` | OS platform (no version, no hostname) |
| `language` | `"typescript"` | Primary detected language |
| `framework` | `"react"` | Primary detected framework |
| `repo_size_bucket` | `"medium"` | File count bucket (small/medium/large/xlarge — never exact count) |
| `timestamp` | `"2026-03-26"` | Day-only date (no time, no timezone) |
| `score_bucket` | `"61-80"` | Bucketed composite score (never raw score) |
| `duration_ms` | `1234` | Scan wall-clock time |
| `pillar_count` | `8` | Number of pillars analyzed |
| `finding_count` | `12` | Total findings |
| `pillar_scores` | `[{"pillar_id":"P1","score_bucket":"61-80"}]` | Per-pillar bucketed scores (5 bands: 0-20, 21-40, 41-60, 61-80, 81-100) |
| `maturity_level` | `"L4"` | Maturity level (L1–L5) |
| `fix_applied` | `false` | Whether the user ran with `--fix` |
| `action_used` | `true` | Whether the scan ran from a GitHub Action |
| `simulation_ran` | `true` | Whether the `simulate` subcommand was executed |
| `simulation_step_count` | `4` | Number of simulation steps executed |
| `simulation_pass_rate_bucket` | `"61-80"` | Bucketed simulation pass rate |
| `simulation_prediction_accuracy_bucket` | `"61-80"` | Bucketed static vs simulation accuracy |
| `circular_dependency_detected` | `false` | Whether circular dependencies were found |
| `module_cohesion_bucket` | `"61-80"` | Bucketed P7 navigability score (cohesion proxy) |
| `plugin_count` | `2` | Number of plugins loaded |
| `mcp_resource_count` | `5` | Number of MCP resources registered |

**Not collected:** repository names/URLs, file names/paths/contents, git remote/branch/commit, user identity/email/IP, org name, finding details/code snippets, raw scores, or any PII. No persistent device identifier.

## How to opt in / out

### CLI

```bash
# Enable telemetry
npx @prontiq/ariscan-cli --telemetry true

# Disable telemetry
npx @prontiq/ariscan-cli --telemetry false

# See exactly what would be sent
npx @prontiq/ariscan-cli --telemetry-show

# Disable for a single run
npx @prontiq/ariscan-cli . --no-telemetry
```

### Environment variable

```bash
# Override the consent file for all runs in this shell
export ARISCAN_TELEMETRY=false   # disable
export ARISCAN_TELEMETRY=true    # enable
```

The environment variable takes precedence over the consent file.

### Consent file

Consent is stored at `~/.config/ariscan/telemetry.json` (or `$XDG_CONFIG_HOME/ariscan/telemetry.json`):

```json
{
  "enabled": true,
  "consentedAt": "2026-03-15T12:00:00.000Z"
}
```

## Where data is sent

Telemetry is sent via HTTPS POST to `https://telemetry.prontiq.dev/v1/scan`.

You can override the endpoint with `ARISCAN_TELEMETRY_URL`:

```bash
export ARISCAN_TELEMETRY_URL=https://your-proxy.example.com/v1/scan
```

## Behavior guarantees

- **Fire-and-forget**: Telemetry never blocks or slows your scan. Sends have a sub-1-second timeout (800ms) and all errors are silently swallowed.
- **No persistence**: The `scan_id` is a random UUID generated per scan. It is not stored anywhere and cannot be used to link scans.
- **No network on disable**: When telemetry is off, no HTTP requests are made at all.

## Data retention

Telemetry data is retained for aggregate analysis only. Individual payloads are not stored long-term. Retention policy details will be published at [prontiq.dev/privacy](https://prontiq.dev/privacy).
