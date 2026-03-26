# ariscan-preset-express

Community preset for [Prontiq ARI](https://github.com/prontiq/ariscan) — scaffolds an Express.js API project with agent readiness essentials.

## Usage

### From local directory

Place this preset in `.ariscan/presets/express/` in any repo, then:

```bash
ariscan init --preset community/express --name my-api
```

### From npm

```bash
npm install -D ariscan-preset-express
ariscan init --preset community/express --name my-api
```

## What it generates

- Express.js + TypeScript server with health route
- Provider interfaces (storage) with in-memory test doubles
- AGENTS.md with architecture overview and commands
- `.agentignore` tuned to Express/Node stack
- Vitest configuration
- TypeScript strict mode

## Writing your own preset

A community preset is a directory or npm package that exports a `ScaffolderPreset`:

### Directory structure

```
my-preset/
├── manifest.json   # Required: preset metadata
├── index.js        # Required: default export of ScaffolderPreset
├── package.json    # For npm distribution
└── README.md       # Documentation
```

### manifest.json

```json
{
  "id": "my-preset",
  "name": "My Preset",
  "description": "Description of what this preset scaffolds",
  "version": "0.1.0",
  "author": "Your Name"
}
```

### index.js

```js
/** @type {import('@prontiq/ariscan').ScaffolderPreset} */
export default {
  manifest: {
    id: "my-preset",
    name: "My Preset",
    description: "Description",
    version: "0.1.0",
  },
  generate(options) {
    const { name } = options;
    return [
      { path: "package.json", content: JSON.stringify({ name }, null, 2) },
      // ... more files
    ];
  },
};
```

### Discovery

Community presets are discovered from:

1. **Local directory:** `.ariscan/presets/<name>/` — must contain `manifest.json` and `index.js`
2. **npm package:** `ariscan-preset-<name>` — must default-export a `ScaffolderPreset`

### Dogfood gate

All community presets pass through the same dogfood gate as built-in presets. The scaffolded output must score >= L3 (46/100) on `ariscan .` or the init command fails.

### npm naming convention

Publish as `ariscan-preset-<name>` on npm. Users reference it as `community/<name>`:

```bash
# User installs your preset
npm install -D ariscan-preset-express

# User scaffolds with it
ariscan init --preset community/express --name my-api
```
