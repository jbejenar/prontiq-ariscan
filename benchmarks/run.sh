#!/usr/bin/env bash
# Benchmark runner for ARI scoring of well-known OSS repos.
# Usage: ./benchmarks/run.sh [--clean] [--pin-refs]
#
# Clones repos at pinned refs, runs ariscan on each, collects JSON results.
# Results are written to benchmarks/results/ as individual JSON files
# and a summary is written to benchmarks/results/summary.json.
#
# --pin-refs  After cloning, update revisions.json with the resolved commit
#             SHAs so future runs are fully reproducible.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REVISIONS_FILE="$SCRIPT_DIR/revisions.json"
RESULTS_DIR="$SCRIPT_DIR/results"
CLONE_DIR="${ARI_BENCH_CLONE_DIR:-/tmp/ari-benchmark-repos}"
ARISCAN="$REPO_ROOT/packages/cli/dist/cli.js"
HELPERS_DIR="$SCRIPT_DIR/helpers"
PIN_REFS=false

# Check prerequisites
if [ ! -f "$REVISIONS_FILE" ]; then
  echo "ERROR: revisions.json not found at $REVISIONS_FILE"
  exit 1
fi

if [ ! -f "$ARISCAN" ]; then
  echo "ERROR: ariscan CLI not built. Run 'pnpm build' first."
  exit 1
fi

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --clean)
      echo "Cleaning clone and results directories..."
      rm -rf "$CLONE_DIR" "$RESULTS_DIR"
      echo "Done."
      exit 0
      ;;
    --pin-refs)
      PIN_REFS=true
      ;;
    *)
      echo "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

# Create directories
mkdir -p "$RESULTS_DIR" "$CLONE_DIR"

# Parse metadata once (single node invocation)
META=$(node "$HELPERS_DIR/parse-revisions.js" "$REVISIONS_FILE" meta)
SCORING_VERSION=$(echo "$META" | cut -f1)
RUBRIC_VERSION=$(echo "$META" | cut -f2)
REPO_COUNT=$(echo "$META" | cut -f3)

echo "═══════════════════════════════════════════════════════════"
echo "  ARI Benchmark Runner"
echo "  Scoring version: $SCORING_VERSION | Rubric: $RUBRIC_VERSION"
echo "  Repos: $REPO_COUNT"
echo "═══════════════════════════════════════════════════════════"
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Collect resolved SHAs for --pin-refs
declare -a PINNED_SHAS=()

for i in $(seq 0 $((REPO_COUNT - 1))); do
  # Parse repo fields once (single node invocation per repo)
  REPO_LINE=$(node "$HELPERS_DIR/parse-revisions.js" "$REVISIONS_FILE" repo "$i")
  NAME=$(echo "$REPO_LINE" | cut -f1)
  REPO=$(echo "$REPO_LINE" | cut -f2)
  REF=$(echo "$REPO_LINE" | cut -f3)
  LANG=$(echo "$REPO_LINE" | cut -f4)
  DESC=$(echo "$REPO_LINE" | cut -f5)

  CLONE_PATH="$CLONE_DIR/$NAME"

  echo "[$((i + 1))/$REPO_COUNT] $NAME ($REPO @ $REF)"

  # Clone if not already present
  if [ ! -d "$CLONE_PATH" ]; then
    echo "  Cloning (shallow)..."
    git clone --depth 1 --branch "$REF" "https://github.com/$REPO.git" "$CLONE_PATH" 2>/dev/null || {
      echo "  WARNING: Failed to clone $REPO. Skipping."
      FAIL_COUNT=$((FAIL_COUNT + 1))
      # Write error metadata for build-summary.js
      echo "{\"commit\":null,\"error\":\"clone failed\"}" > "$RESULTS_DIR/$NAME.meta.json"
      PINNED_SHAS+=("")
      continue
    }
  else
    echo "  Using cached clone."
  fi

  # Get the actual commit SHA
  COMMIT_SHA=$(cd "$CLONE_PATH" && git rev-parse HEAD)
  PINNED_SHAS+=("$COMMIT_SHA")

  # Run ariscan
  echo "  Scanning..."
  RESULT_FILE="$RESULTS_DIR/$NAME.json"
  if node "$ARISCAN" "$CLONE_PATH" --format json > "$RESULT_FILE" 2>/dev/null; then
    # Read score/level from result file (single node invocation)
    SCORE=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(r.composite.score)" "$RESULT_FILE")
    LEVEL=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(r.composite.level)" "$RESULT_FILE")
    echo "  Score: $SCORE/100 ($LEVEL)"
    PASS_COUNT=$((PASS_COUNT + 1))
    # Write success metadata
    echo "{\"commit\":\"$COMMIT_SHA\"}" > "$RESULTS_DIR/$NAME.meta.json"
  else
    echo "  WARNING: Scan failed for $NAME."
    FAIL_COUNT=$((FAIL_COUNT + 1))
    # Write error metadata
    echo "{\"commit\":\"$COMMIT_SHA\",\"error\":\"scan failed\"}" > "$RESULTS_DIR/$NAME.meta.json"
    rm -f "$RESULT_FILE"
  fi

  echo ""
done

# Build summary.json using Node.js (proper JSON.stringify, no bash interpolation)
node "$HELPERS_DIR/build-summary.js" "$REVISIONS_FILE" "$RESULTS_DIR" "$RESULTS_DIR/summary.json"

echo "═══════════════════════════════════════════════════════════"
echo "  Summary: $PASS_COUNT scanned, $FAIL_COUNT failed"
echo "  Results: $RESULTS_DIR/"
echo "  Summary: $RESULTS_DIR/summary.json"
echo "═══════════════════════════════════════════════════════════"

# --pin-refs: update revisions.json with resolved commit SHAs
if [ "$PIN_REFS" = true ]; then
  echo ""
  echo "Pinning refs to resolved commit SHAs..."
  node -e "
    const fs = require('fs');
    const filePath = process.argv[1];
    const shas = process.argv.slice(2);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.repos.forEach((repo, i) => {
      if (shas[i] && shas[i] !== '') {
        repo.ref = shas[i];
      }
    });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log('Updated ' + shas.filter(s => s !== '').length + ' refs in ' + filePath);
  " "$REVISIONS_FILE" "${PINNED_SHAS[@]}"
fi
