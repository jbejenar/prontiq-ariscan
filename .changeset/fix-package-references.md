---
"@prontiq/ariscan-schema": minor
"@prontiq/ariscan-engine": minor
"@prontiq/ariscan-cli": minor
---

Fix incorrect package name references in published READMEs and documentation.

All three published npm READMEs contained wrong package names (e.g., `npx ariscan .` instead of `npx @prontiq/ariscan-cli .`, `@prontiq/schema` instead of `@prontiq/ariscan-schema`). This release corrects all references and adds significant new features: streaming progress output, --fix generators, agentignore categories, and provider patterns.
