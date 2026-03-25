#!/usr/bin/env bash
# Generates benchmarks/RESULTS.md from benchmarks/results/summary.json.
# Usage: ./benchmarks/generate-results.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SUMMARY_FILE="$SCRIPT_DIR/results/summary.json"
RESULTS_FILE="$SCRIPT_DIR/RESULTS.md"

if [ ! -f "$SUMMARY_FILE" ]; then
  echo "ERROR: summary.json not found. Run ./benchmarks/run.sh first."
  exit 1
fi

node -e "
const fs = require('fs');
const summary = JSON.parse(fs.readFileSync('$SUMMARY_FILE', 'utf8'));
const results = summary.results.filter(r => r.score !== null).sort((a, b) => b.score - a.score);
const failed = summary.results.filter(r => r.score === null);
const languages = [...new Set(results.map(r => r.language))].sort();
const avgScore = results.length > 0 ? (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(1) : 'N/A';

const levelCounts = {};
results.forEach(r => { levelCounts[r.level] = (levelCounts[r.level] || 0) + 1; });

let md = '# ARI Benchmark Results\n\n';
md += '> Agent Readiness Index scores for well-known open-source repositories.\n';
md += '>\n';
md += '> **Scoring version:** ' + summary.scoring_version + ' | **Rubric:** ' + summary.rubric_version + ' | **Date:** ' + summary.date.split('T')[0] + '\n\n';

md += '## Summary\n\n';
md += '| Metric | Value |\n|--------|-------|\n';
md += '| Repos scanned | ' + results.length + ' |\n';
md += '| Languages covered | ' + languages.length + ' (' + languages.join(', ') + ') |\n';
md += '| Average score | ' + avgScore + '/100 |\n';
Object.entries(levelCounts).sort().forEach(([level, count]) => {
  md += '| ' + level + ' | ' + count + ' repos |\n';
});
md += '\n';

md += '## Results\n\n';
md += '| Rank | Repository | Language | Score | Level |\n';
md += '|------|-----------|----------|-------|-------|\n';
results.forEach((r, i) => {
  md += '| ' + (i + 1) + ' | [' + r.name + '](https://github.com/' + r.repo + ') | ' + r.language + ' | ' + r.score + '/100 | ' + r.level + ' |\n';
});
md += '\n';

if (failed.length > 0) {
  md += '## Scan Failures\n\n';
  md += '| Repository | Reason |\n|-----------|--------|\n';
  failed.forEach(r => {
    md += '| [' + r.name + '](https://github.com/' + r.repo + ') | ' + (r.error || 'unknown') + ' |\n';
  });
  md += '\n';
}

md += '## Methodology\n\n';
md += '### Scoring\n\n';
md += 'Each repository is scored using the ARI (Agent Readiness Index) rubric, which evaluates 8 pillars:\n\n';
md += '1. **Agent Context Quality** (15%) - AGENTS.md, CLAUDE.md, .cursorrules quality\n';
md += '2. **Feedback Loop Speed** (15%) - Test/lint/typecheck speed and configuration\n';
md += '3. **Test Isolation** (18%) - Cloud deps, flakiness patterns, ordering issues\n';
md += '4. **Dev Environment** (10%) - Devcontainer, bootstrap scripts, time-to-first-test\n';
md += '5. **Doc Machine-Readability** (10%) - OpenAPI, error taxonomy, env schema\n';
md += '6. **Build Determinism & Type Safety** (15%) - Strict types, lockfiles, build tools\n';
md += '7. **Code Navigability** (12%) - Directory depth, imports, complexity\n';
md += '8. **Security & Governance** (5%) - Branch protection, CODEOWNERS, secrets\n\n';

md += '### Maturity Levels\n\n';
md += '| Level | Range | Meaning |\n|-------|-------|--------|\n';
md += '| L1 Hostile | 0-25 | Actively blocks AI agents |\n';
md += '| L2 Fragile | 26-45 | Agents struggle significantly |\n';
md += '| L3 Capable | 46-65 | Agents can work with guidance |\n';
md += '| L4 Productive | 66-80 | Agents work effectively |\n';
md += '| L5 Autonomous | 81-100 | Agents can operate independently |\n\n';

md += '### Reproducibility\n\n';
md += 'Results are reproducible by running:\n\n';
md += '\`\`\`bash\n';
md += 'pnpm build\n';
md += 'bash benchmarks/run.sh\n';
md += 'bash benchmarks/generate-results.sh\n';
md += '\`\`\`\n\n';
md += 'Repos are cloned at the refs specified in \`benchmarks/revisions.json\`.\n';
md += 'The ARI scanner is deterministic: same input produces same scores (no network calls, no randomness, no time-dependent logic).\n\n';

md += '### Caveats\n\n';
md += '- Scores reflect the state of each repo at the time of scanning (see commit SHAs in per-repo JSON files).\n';
md += '- ARI measures *agent readiness* — how well a repo supports AI coding agents. It is not a quality or popularity metric.\n';
md += '- Repos without test infrastructure, type checking, or agent context files will score lower, even if they are excellent projects.\n';
md += '- Monorepo scanning analyzes the root-level structure; per-package analysis may vary.\n';

fs.writeFileSync('$RESULTS_FILE', md);
console.log('Generated: $RESULTS_FILE');
console.log('  ' + results.length + ' repos, ' + languages.length + ' languages, avg score: ' + avgScore);
"
