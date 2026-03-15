# Telemetry

Prontiq ARI collects **anonymous, opt-in** usage telemetry to help improve scoring accuracy and prioritize development.

**Telemetry is disabled by default.** No data is ever sent without your explicit consent.

## What is collected

Every telemetry payload contains exactly these fields — nothing more:

| Field | Example | Description |
|-------|---------|-------------|
| `scan_id` | `"a1b2c3d4-..."` | Random UUID per scan (not persisted, not linkable) |
| `version` | `"0.1.0"` | CLI version |
| `platform` | `"darwin"` | OS platform |
| `language` | `"typescript"` | Primary detected language |
| `score_bucket` | `"66-80"` | Bucketed score range (never the raw score) |
| `duration_ms` | `1234` | Scan wall-clock time |
| `pillar_count` | `8` | Number of pillars analyzed |
| `finding_count` | `12` | Total findings |

**Not collected:** repository names, file paths, file contents, usernames, IP-derived location, raw scores, or any PII.

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

Telemetry is sent via HTTPS POST to `https://telemetry.prontiq.dev/v1/ari`.

You can override the endpoint with `ARISCAN_TELEMETRY_URL`:

```bash
export ARISCAN_TELEMETRY_URL=https://your-proxy.example.com/v1/ari
```

## Behavior guarantees

- **Fire-and-forget**: Telemetry never blocks or slows your scan. Sends have a 2-second timeout and all errors are silently swallowed.
- **No persistence**: The `scan_id` is a random UUID generated per scan. It is not stored anywhere and cannot be used to link scans.
- **No network on disable**: When telemetry is off, no HTTP requests are made at all.

## Data retention

Telemetry data is retained for aggregate analysis only. Individual payloads are not stored long-term. Retention policy details will be published at [prontiq.dev/privacy](https://prontiq.dev/privacy).
