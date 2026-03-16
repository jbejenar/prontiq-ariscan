#!/bin/bash
# Restore deleted test files from git HEAD
set -e

files=(
  "packages/engine/src/__tests__/agentignore/parser.test.ts"
  "packages/engine/src/__tests__/analyzers/build-determinism.test.ts"
  "packages/engine/src/__tests__/analyzers/context-quality.test.ts"
  "packages/engine/src/__tests__/analyzers/dev-environment.test.ts"
  "packages/engine/src/__tests__/analyzers/doc-readability.test.ts"
  "packages/engine/src/__tests__/analyzers/feedback-loop.test.ts"
  "packages/engine/src/__tests__/analyzers/navigability.test.ts"
  "packages/engine/src/__tests__/analyzers/registry.test.ts"
  "packages/engine/src/__tests__/analyzers/security-governance.test.ts"
  "packages/engine/src/__tests__/analyzers/shared.test.ts"
  "packages/engine/src/__tests__/analyzers/test-isolation.test.ts"
  "packages/engine/src/__tests__/budget/budget-analyzer.test.ts"
  "packages/engine/src/__tests__/budget/token-estimator.test.ts"
  "packages/engine/src/__tests__/context/repo-context.test.ts"
  "packages/engine/src/__tests__/detection/detection-index.test.ts"
  "packages/engine/src/__tests__/detection/frameworks.test.ts"
  "packages/engine/src/__tests__/detection/languages.test.ts"
  "packages/engine/src/__tests__/detection/monorepo.test.ts"
  "packages/engine/src/__tests__/fix/generators.test.ts"
  "packages/engine/src/__tests__/telemetry/consent.test.ts"
  "packages/engine/src/__tests__/telemetry/payload.test.ts"
  "packages/engine/src/__tests__/telemetry/sender.test.ts"
  "packages/engine/src/scoring/__tests__/composite.test.ts"
)

for f in "${files[@]}"; do
  dir=$(dirname "$f")
  mkdir -p "$dir"
  git show "HEAD:$f" > "$f"
  echo "Restored: $f"
done

echo "All files restored."
