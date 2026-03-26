#!/usr/bin/env node
/**
 * Generate the ARI Open Benchmark Leaderboard from scan results.
 *
 * Reads per-repo JSON results from benchmarks/results/ and produces:
 *   1. benchmarks/leaderboard.json — machine-readable leaderboard with filters
 *   2. benchmarks/LEADERBOARD.md — human-readable leaderboard with analysis
 *
 * Usage:
 *   node benchmarks/generate-leaderboard.cjs [--json-only]
 */

"use strict";

const fs = require("fs");
const path = require("path");

const RESULTS_DIR = path.join(__dirname, "results");
const REVISIONS_PATH = path.join(__dirname, "revisions.json");
const LEADERBOARD_JSON_PATH = path.join(__dirname, "leaderboard.json");
const LEADERBOARD_MD_PATH = path.join(__dirname, "LEADERBOARD.md");

const LEVEL_NAMES = {
  L1: "Hostile",
  L2: "Fragile",
  L3: "Capable",
  L4: "Productive",
  L5: "Autonomous",
};

const PILLAR_NAMES = {
  P1: "Agent Context Quality",
  P2: "Feedback Loop Speed",
  P3: "Test Isolation",
  P4: "Dev Environment",
  P5: "Doc Machine-Readability",
  P6: "Build Determinism & Type Safety",
  P7: "Code Navigability",
  P8: "Security & Governance",
};

// Size categories based on typical repo sizes
function categorizeSize(fileCount) {
  if (fileCount === undefined || fileCount === null) return "unknown";
  if (fileCount < 500) return "small";
  if (fileCount < 5000) return "medium";
  return "large";
}

function computeStats(scores) {
  if (scores.length === 0) return { mean: 0, median: 0, min: 0, max: 0, stddev: 0 };
  const sorted = [...scores].sort((a, b) => a - b);
  const mean = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const median =
    sorted.length % 2 === 0
      ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
      : sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
  const stddev = Math.round(Math.sqrt(variance) * 10) / 10;
  return { mean, median, min, max, stddev };
}

// --- Main ---

const revisions = JSON.parse(fs.readFileSync(REVISIONS_PATH, "utf8"));
const entries = [];

for (const repo of revisions.repos) {
  const resultFile = path.join(RESULTS_DIR, `${repo.name}.json`);
  if (!fs.existsSync(resultFile)) continue;

  const scan = JSON.parse(fs.readFileSync(resultFile, "utf8"));
  const pillarScores = {};
  for (const p of scan.pillars || []) {
    pillarScores[p.pillar] = {
      score: p.score,
      weight: p.weight,
      confidence: p.confidence,
      findingCount: (p.findings || []).length,
    };
  }

  entries.push({
    rank: 0, // filled after sort
    name: repo.name,
    repo: repo.repo,
    ref: repo.ref,
    language: repo.language,
    description: repo.description,
    score: scan.score,
    level: scan.level,
    levelName: LEVEL_NAMES[scan.level] || "Unknown",
    securityGateTriggered: scan.securityGateTriggered || false,
    duration: scan.metadata?.duration || null,
    pillars: pillarScores,
    findingCount: (scan.findings || []).length,
    scannedAt: scan.metadata?.timestamp || null,
  });
}

// Sort by score descending, then alphabetically
entries.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
entries.forEach((e, i) => {
  e.rank = i + 1;
});

// Compute statistics
const allScores = entries.map((e) => e.score);
const overallStats = computeStats(allScores);

// By language
const byLanguage = {};
for (const e of entries) {
  if (!byLanguage[e.language]) byLanguage[e.language] = [];
  byLanguage[e.language].push(e);
}
const languageStats = {};
for (const [lang, repos] of Object.entries(byLanguage)) {
  const scores = repos.map((r) => r.score);
  languageStats[lang] = { ...computeStats(scores), count: repos.length };
}

// By level
const byLevel = {};
for (const e of entries) {
  const key = `${e.level} ${e.levelName}`;
  byLevel[key] = (byLevel[key] || 0) + 1;
}

// By pillar (average scores across all repos)
const pillarAverages = {};
for (const pid of Object.keys(PILLAR_NAMES)) {
  const scores = entries.map((e) => e.pillars[pid]?.score).filter((s) => s !== undefined);
  if (scores.length > 0) {
    pillarAverages[pid] = {
      name: PILLAR_NAMES[pid],
      ...computeStats(scores),
    };
  }
}

// Build leaderboard JSON
const leaderboard = {
  $schema: "https://prontiq.dev/schemas/ari-leaderboard/v1.json",
  version: "1.0.0",
  scoringVersion: revisions.scoring_version,
  rubricVersion: revisions.rubric_version,
  generatedAt: new Date().toISOString(),
  methodology: {
    description:
      "ARI (Agent Readiness Index) scores for open-source repositories. Each repo is scanned at a pinned commit SHA using the ariscan CLI with default rubric weights.",
    rubricPillars: Object.entries(PILLAR_NAMES).map(([id, name]) => ({ id, name })),
    reproducibility:
      "All refs pinned to commit SHAs in revisions.json. Scanner is deterministic (no network, no randomness). Re-running produces identical scores.",
    updateCadence: "Monthly minimum, with ad-hoc updates for rubric changes.",
    versionPolicy: "Scores are only comparable within the same rubric version.",
  },
  summary: {
    totalRepos: entries.length,
    overall: overallStats,
    byLevel,
    byLanguage: languageStats,
    byPillar: pillarAverages,
  },
  entries,
};

fs.writeFileSync(LEADERBOARD_JSON_PATH, JSON.stringify(leaderboard, null, 2) + "\n");
console.log(`Leaderboard JSON: ${entries.length} repos → ${LEADERBOARD_JSON_PATH}`);

if (process.argv.includes("--json-only")) {
  process.exit(0);
}

// --- Generate Markdown ---

const levelEmoji = { L1: "🔴", L2: "🟠", L3: "🟡", L4: "🟢", L5: "🏆" };

let md = `# ARI Open Benchmark Leaderboard

> Agent Readiness Index scores for well-known open-source repositories.
>
> **Scoring version:** ${revisions.scoring_version} | **Rubric:** ${revisions.rubric_version} | **Generated:** ${new Date().toISOString().split("T")[0]} | **Repos:** ${entries.length}

## Leaderboard

| # | Repository | Language | Score | Level | Description |
|---|-----------|----------|-------|-------|-------------|
`;

for (const e of entries) {
  const emoji = levelEmoji[e.level] || "";
  md += `| ${e.rank} | [${formatName(e.name)}](https://github.com/${e.repo}) | ${e.language} | **${e.score}** | ${emoji} ${e.level} ${e.levelName} | ${e.description} |\n`;
}

md += `
## Summary Statistics

| Metric | Value |
|--------|-------|
| Repos scanned | ${entries.length} |
| Mean score | ${overallStats.mean} |
| Median score | ${overallStats.median} |
| Std deviation | ${overallStats.stddev} |
| Range | ${overallStats.min}–${overallStats.max} |

### Level Distribution

| Level | Count | % |
|-------|-------|---|
`;

for (const [level, count] of Object.entries(byLevel).sort()) {
  md += `| ${level} | ${count} | ${Math.round((count / entries.length) * 100)}% |\n`;
}

md += `
### By Language

| Language | Repos | Mean | Median | Range |
|----------|-------|------|--------|-------|
`;

const sortedLangs = Object.entries(languageStats).sort((a, b) => b[1].mean - a[1].mean);
for (const [lang, stats] of sortedLangs) {
  md += `| ${lang} | ${stats.count} | ${stats.mean} | ${stats.median} | ${stats.min}–${stats.max} |\n`;
}

md += `
### By Pillar (Average Across All Repos)

| Pillar | Mean | Median | Range |
|--------|------|--------|-------|
`;

for (const [pid, stats] of Object.entries(pillarAverages)) {
  md += `| ${pid}: ${stats.name} | ${stats.mean} | ${stats.median} | ${stats.min}–${stats.max} |\n`;
}

md += `
## Key Findings

- **No repo reaches L4 (Productive)** — even the best OSS repos lack agent-specific context (AGENTS.md), .agentignore, and dev environment configuration.
- **TypeScript repos lead** (mean: ${languageStats.TypeScript?.mean || "N/A"}) — strong type systems, test infrastructure, and build tooling align with the ARI rubric.
- **Most repos are L2 (Fragile)** — agents can work with these repos but struggle significantly.
- **Agent Context Quality and Dev Environment are the weakest pillars** — very few OSS repos have agent-specific documentation or devcontainer configuration.

## Methodology

See [METHODOLOGY.md](METHODOLOGY.md) for full details on:
- Repo selection criteria
- Scanning process and reproducibility
- Scoring rubric (8 pillars, research-calibrated weights)
- Maturity level definitions
- Caveats and limitations

## Filtering

The machine-readable leaderboard is available at [\`leaderboard.json\`](leaderboard.json) with full pillar-level data. Filter by:
- **Language:** \`entries[].language\`
- **Level:** \`entries[].level\`
- **Score range:** \`entries[].score\`
- **Pillar scores:** \`entries[].pillars.P1.score\`, etc.

## How to Run

\`\`\`bash
# Reproduce the leaderboard from existing benchmark data
node benchmarks/generate-leaderboard.cjs

# Re-scan all repos (requires cloning ~21 repos)
node benchmarks/run-benchmark.cjs
node benchmarks/generate-leaderboard.cjs
\`\`\`
`;

fs.writeFileSync(LEADERBOARD_MD_PATH, md);
console.log(`Leaderboard Markdown → ${LEADERBOARD_MD_PATH}`);

function formatName(name) {
  // Capitalize first letter of each word, handle special cases
  const special = {
    "next.js": "Next.js",
    vscode: "VS Code",
    fastapi: "FastAPI",
    langchain: "LangChain",
    "spring-boot": "Spring Boot",
  };
  return special[name] || name.charAt(0).toUpperCase() + name.slice(1);
}
