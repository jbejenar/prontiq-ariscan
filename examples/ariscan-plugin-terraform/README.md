# ariscan-plugin-terraform

Reference plugin for [Prontiq ARI](https://github.com/prontiq/ariscan) demonstrating the plugin API.

## What it checks

| Code | Pillar | Severity | Description |
|------|--------|----------|-------------|
| ARI-BLD-901 | P6 (Build Determinism) | medium | Missing `.terraform.lock.hcl` |
| ARI-BLD-902 | P6 (Build Determinism) | low | No remote backend configured |
| ARI-DOC-901 | P5 (Doc Readability) | low | Terraform modules without documentation |

## Installation

### Local plugin (recommended for trying it out)

```bash
cp -r examples/ariscan-plugin-terraform .ariscan/plugins/terraform
ariscan .
```

### npm package (when published)

```bash
npm install ariscan-plugin-terraform
```

Add to `.ariscan.yml`:

```yaml
plugins:
  packages:
    - ariscan-plugin-terraform
```

## Writing your own plugin

A plugin is a module that exports an object implementing the `AriscanPlugin` interface:

```js
export default {
  manifest: {
    name: "ariscan-plugin-my-check",  // Must be unique
    version: "1.0.0",                 // semver
    apiVersion: "1.0",                // Plugin API version
    description: "What this plugin checks",
    pillar: "P6",                     // Optional: primary pillar
    confidence: "medium",             // Optional: analysis confidence
  },

  async analyze(context) {
    // context.files — list of all files in the repo
    // context.readFile(path) — read a file's contents
    // context.fileExists(path) — check if a file exists
    // context.readJson(path) — read and parse JSON

    return {
      findings: [
        {
          code: "ARI-XXX-NNN",       // Finding code (use 9xx range for plugins)
          severity: "medium",         // critical | high | medium | low | info
          pillar: "P6",              // Which pillar this finding relates to
          message: "Description",
          remediation: {
            action: "configure-tool",
            description: "How to fix",
            confidence: "high",
          },
        },
      ],
      summary: "Optional summary text",
    };
  },
};
```

### Plugin conventions

- **Finding codes**: Use the `9xx` range (e.g., `ARI-BLD-901`) to avoid conflicts with core findings
- **Plugin names**: Follow `ariscan-plugin-*` naming for npm discoverability
- **Error handling**: Plugins should not throw — return empty findings if analysis is not applicable
- **Performance**: Limit file reads; sample large file sets rather than scanning everything
- **Isolation**: Plugin findings are attributed separately and don't affect core pillar scores
