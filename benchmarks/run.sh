#!/usr/bin/env bash
# Benchmark runner for ARI scoring of well-known OSS repos.
# Usage: ./benchmarks/run.sh [--clean]
#
# Clones repos at pinned refs, runs ariscan on each, collects JSON results.
# Results are written to benchmarks/results/ as individual JSON files
# and a summary is written to benchmarks/results/summary.json.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REVISIONS_FILE="$SCRIPT_DIR/revisions.json"
RESULTS_DIR="$SCRIPT_DIR/results"
CLONE_DIR="${ARI_BENCH_CLONE_DIR:-/tmp/ari-benchmark-repos}"
ARISCAN="$REPO_ROOT/packages/cli/dist/cli.js"

# Check prerequisites
if [ ! -f "$REVISIONS_FILE" ]; then
  echo "ERROR: revisions.json not found at $REVISIONS_FILE"
  exit 1
fi

if [ ! -f "$ARISCAN" ]; then
  echo "ERROR: ariscan CLI not built. Run 'pnpm build' first."
  exit 1
fi

# Handle --clean flag
if [ "${1:-}" = "--clean" ]; then
  echo "Cleaning clone and results directories..."
  rm -rf "$CLONE_DIR" "$RESULTS_DIR"
  echo "Done."
  exit 0
fi

# Create directories
mkdir -p "$RESULTS_DIR" "$CLONE_DIR"

# Parse revisions.json
SCORING_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REVISIONS_FILE','utf8')).scoring_version)")
RUBRIC_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REVISIONS_FILE','utf8')).rubric_version)")
REPO_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REVISIONS_FILE','utf8')).repos.length)")

echo "═══════════════════════════════════════════════════════════"
echo "  ARI Benchmark Runner"
echo "  Scoring version: $SCORING_VERSION | Rubric: $RUBRIC_VERSION"
echo "  Repos: $REPO_COUNT"
echo "═══════════════════════════════════════════════════════════"
echo ""

PASS_COUNT=0
FAIL_COUNT=0
RESULTS_JSON="["

for i in $(seq 0 $((REPO_COUNT - 1))); do
  NAME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REVISIONS_FILE','utf8')).repos[$i].name)")
  REPO=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REVISIONS_FILE','utf8')).repos[$i].repo)")
  REF=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REVISIONS_FILE','utf8')).repos[$i].ref)")
  LANG=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REVISIONS_FILE','utf8')).repos[$i].language)")
  DESC=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REVISIONS_FILE','utf8')).repos[$i].description)")

  CLONE_PATH="$CLONE_DIR/$NAME"

  echo "[$((i + 1))/$REPO_COUNT] $NAME ($REPO @ $REF)"

  # Clone if not already present
  if [ ! -d "$CLONE_PATH" ]; then
    echo "  Cloning (shallow)..."
    git clone --depth 1 --branch "$REF" "https://github.com/$REPO.git" "$CLONE_PATH" 2>/dev/null || {
      echo "  WARNING: Failed to clone $REPO. Skipping."
      FAIL_COUNT=$((FAIL_COUNT + 1))
      continue
    }
  else
    echo "  Using cached clone."
  fi

  # Get the actual commit SHA
  COMMIT_SHA=$(cd "$CLONE_PATH" && git rev-parse HEAD)

  # Run ariscan
  echo "  Scanning..."
  RESULT_FILE="$RESULTS_DIR/$NAME.json"
  if node "$ARISCAN" "$CLONE_PATH" --format json > "$RESULT_FILE" 2>/dev/null; then
    SCORE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$RESULT_FILE','utf8')).composite.score)")
    LEVEL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$RESULT_FILE','utf8')).composite.level)")
    echo "  Score: $SCORE/100 ($LEVEL)"
    PASS_COUNT=$((PASS_COUNT + 1))

    # Add to summary
    if [ $i -gt 0 ]; then RESULTS_JSON="$RESULTS_JSON,"; fi
    RESULTS_JSON="$RESULTS_JSON{\"name\":\"$NAME\",\"repo\":\"$REPO\",\"ref\":\"$REF\",\"commit\":\"$COMMIT_SHA\",\"language\":\"$LANG\",\"description\":\"$DESC\",\"score\":$SCORE,\"level\":\"$LEVEL\"}"
  else
    echo "  WARNING: Scan failed for $NAME."
    FAIL_COUNT=$((FAIL_COUNT + 1))
    if [ $i -gt 0 ]; then RESULTS_JSON="$RESULTS_JSON,"; fi
    RESULTS_JSON="$RESULTS_JSON{\"name\":\"$NAME\",\"repo\":\"$REPO\",\"ref\":\"$REF\",\"commit\":\"$COMMIT_SHA\",\"language\":\"$LANG\",\"description\":\"$DESC\",\"score\":null,\"level\":null,\"error\":\"scan failed\"}"
  fi

  echo ""
done

RESULTS_JSON="$RESULTS_JSON]"

# Write summary
SUMMARY_FILE="$RESULTS_DIR/summary.json"
echo "{
  \"date\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"scoring_version\": \"$SCORING_VERSION\",
  \"rubric_version\": \"$RUBRIC_VERSION\",
  \"total\": $REPO_COUNT,
  \"scanned\": $PASS_COUNT,
  \"failed\": $FAIL_COUNT,
  \"results\": $RESULTS_JSON
}" > "$SUMMARY_FILE"

echo "═══════════════════════════════════════════════════════════"
echo "  Summary: $PASS_COUNT scanned, $FAIL_COUNT failed"
echo "  Results: $RESULTS_DIR/"
echo "  Summary: $SUMMARY_FILE"
echo "═══════════════════════════════════════════════════════════"
