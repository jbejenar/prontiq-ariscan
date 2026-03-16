# @prontiq/ariscan-cli

## 0.7.0

### Minor Changes

- - fix: strip HTML tag names properly in normalizeForComparison
  - fix: resolve all remaining CodeQL alerts across codebase
  - fix: eliminate CodeQL incomplete-multi-character-sanitization alerts
  - fix: address review — resolve nested AGENTS.md against nearest package root
  - fix: address review — resolve nested AGENTS.md against nearest package root
  - fix: address review — include package-local docs in nested AGENTS.md additionality corpus
  - fix: address review — make additionality corpus comprehensive for monorepos
  - fix: address review — broaden config corpus and fix short-command line annotations
  - fix: address review — normalize config files into comparable text for additionality scoring
  - fix: address review — expand additionality reference corpus and include nested AGENTS.md
  - fix: address review — restore single-directory path extraction in stale-path detection
  - fix: address review — recognize path-like launchers in additionality short-segment gate
  - fix: flatten path-extraction regex to avoid nested quantified group
  - fix: simplify bold/italic regex to eliminate CodeQL polynomial-redos flag
  - fix: address review — recognize config/assignment syntax in additionality short-segment gate
  - fix: address review — replace command whitelist with syntax-based detection in additionality
  - fix: address CodeQL findings — non-greedy quantifiers and remove useless escapes
  - fix: address review — lower word threshold for command-like segments in additionality
  - fix: address review — preserve code block content in additionality comparison
  - fix: harden regexes to resolve CodeQL security-and-quality findings
  - fix: address review — emit finding for moderate redundancy, handle zero-segment additionality
  - fix: address review — preserve line boundaries in segmentation, use Jaccard for line matching, harden test assertion
  - fix: address review — harden HTML tag stripping in normalizeForComparison
  - feat(engine): add context additionality analysis for P1.04
  - feat: adhoc-task (#59)
  - feat: adhoc-task (#58)
  - feat: adhoc-task (#56)
  - fix(ci): route version bumps through PR to respect branch protection
  - fix: address review — separate confidence from accuracy, add pillar-level finding counts
  - docs: check P1 telemetry items and P2.06 DoD, advance 8 tickets to done
  - test(P2.06): add pillar coverage test for fix generator templates
  - feat(telemetry): add extended telemetry fields for P1 consolidation
  - fix: address review — check both TS and JS config paths in env schema preflight
  - fix: address review — check JS config paths in env schema preflight
  - fix: address review — JS-safe env schema, comment out Zod when absent
  - feat(P2.06): add guided remediation metadata, monorepo disclosure, env var schema
  - fix: address review — remove 10-file cap on provider-named abstraction scan
  - fix: address review — narrow abstraction pattern, broaden script latency scan
  - fix: address review — narrow abstraction pattern, broaden script latency scan
  - fix: address review — bound abstraction fallback scan to 50 reads with path prioritization
  - fix: address review — wire script latency inference, remove SDK scan cap
  - fix: address review — remove positional cap on abstraction fallback scan
  - fix: address review — decouple abstraction detection from filename prefilter
  - fix: address review — move telemetry after badge write, remove unused fix_types
  - fix: address review — wire telemetry options, tighten abstraction detection, fix session notes
  - fix: address review — uncheck P1.03 discovery perf item lacking e2e evidence
  - fix: address review — rename misleading benchmark, guard latency overwrite
  - docs(roadmap): check P1.03/P1.05/P1.06 items, update session notes
  - feat(schema,engine): expand telemetry payload with per-pillar distributions
  - test(engine): add 100k-file discovery benchmark (P1.03)
  - feat(engine): add structural provider pattern detection (P1.06)
  - feat(engine): enhance feedback latency inference (P1.05)
  - feat(engine,cli): add type coverage detection (P1.10), NDJSON streaming (P1.14), monorepo evidence (P1.02), badge validation (P1.16)
  - docs(roadmap): check P1.09-P1.15 items, remove REVIEW flags, update session notes
  - feat(engine): add branch protection/SAST findings, schema version export, and structured remediation data
  - docs: add versioning policy with semver impact rules (P1.14)
  - feat(engine): add research citations, structural clarity metric, and confidence verification
  - style(roadmap): normalize P1 ticket formatting to match P2+ conventions
  - refactor(roadmap): migrate all 63 tickets to agent-optimised format
  - docs: update CHANGELOG, NEXT-SESSION, and README for session 22
  - refactor(engine): extract shared analyzer utilities to reduce code duplication
  - test(engine,schema): add test files to improve P3 test-to-source ratio (80→85)
  - feat(engine): add P5 doc criteria (ARI-DOC-005/006) and P6 pre-commit hooks (ARI-BLD-012)
  - chore(deps-dev): bump the dev-dependencies group with 5 updates
  - docs: update CHANGELOG, NEXT-SESSION, and ROADMAP for session 21
  - feat(engine): improve P6 build determinism (85→95) and P4 dev environment (95→100)
  - docs: update CHANGELOG.md and NEXT-SESSION.md for session 20
  - fix(engine): fix typecheck error in integration.test.ts
  - refactor(cli): reduce dispatchCommand complexity for P7 score improvement
  - docs: improve P5 doc readability score from 60 to 70
  - fix(engine): improve P3 test isolation score from 65 to 80
  - docs: update NEXT-SESSION.md and CHANGELOG.md for session 19
  - test: add 13 test files to improve P3 test-isolation score
  - docs: update AGENTS.md file structure to match actual codebase
  - refactor(cli): reduce cognitive complexity across 9 functions for P7 navigability
  - docs: fix README stale paths, add error taxonomy, update planning artifacts
  - fix(engine): fix regex source matching bug in P3 test-isolation analyzer
  - chore: add license field to root package.json
  - fix(engine): unref telemetry timeout so it cannot delay CLI exit
  - fix(engine): reduce false positives in P3 test-isolation analyzer
  - chore(claude-loop): auto-commit uncommitted build changes
  - feat: add anonymous opt-in telemetry (P2.13)

### Patch Changes

- Updated dependencies
  - @prontiq/ariscan-schema@0.7.0
  - @prontiq/ariscan-engine@0.7.0

## 0.6.0

### Minor Changes

- - feat: adhoc-task (#59)
  - feat: adhoc-task (#58)
  - feat: adhoc-task (#56)
  - fix(ci): route version bumps through PR to respect branch protection
  - fix: address review — separate confidence from accuracy, add pillar-level finding counts
  - docs: check P1 telemetry items and P2.06 DoD, advance 8 tickets to done
  - test(P2.06): add pillar coverage test for fix generator templates
  - feat(telemetry): add extended telemetry fields for P1 consolidation
  - fix: address review — check both TS and JS config paths in env schema preflight
  - fix: address review — check JS config paths in env schema preflight
  - fix: address review — JS-safe env schema, comment out Zod when absent
  - feat(P2.06): add guided remediation metadata, monorepo disclosure, env var schema
  - fix: address review — remove 10-file cap on provider-named abstraction scan
  - fix: address review — narrow abstraction pattern, broaden script latency scan
  - fix: address review — narrow abstraction pattern, broaden script latency scan
  - fix: address review — bound abstraction fallback scan to 50 reads with path prioritization
  - fix: address review — wire script latency inference, remove SDK scan cap
  - fix: address review — remove positional cap on abstraction fallback scan
  - fix: address review — decouple abstraction detection from filename prefilter
  - fix: address review — move telemetry after badge write, remove unused fix_types
  - fix: address review — wire telemetry options, tighten abstraction detection, fix session notes
  - fix: address review — uncheck P1.03 discovery perf item lacking e2e evidence
  - fix: address review — rename misleading benchmark, guard latency overwrite
  - docs(roadmap): check P1.03/P1.05/P1.06 items, update session notes
  - feat(schema,engine): expand telemetry payload with per-pillar distributions
  - test(engine): add 100k-file discovery benchmark (P1.03)
  - feat(engine): add structural provider pattern detection (P1.06)
  - feat(engine): enhance feedback latency inference (P1.05)
  - feat(engine,cli): add type coverage detection (P1.10), NDJSON streaming (P1.14), monorepo evidence (P1.02), badge validation (P1.16)
  - docs(roadmap): check P1.09-P1.15 items, remove REVIEW flags, update session notes
  - feat(engine): add branch protection/SAST findings, schema version export, and structured remediation data
  - docs: add versioning policy with semver impact rules (P1.14)
  - feat(engine): add research citations, structural clarity metric, and confidence verification
  - style(roadmap): normalize P1 ticket formatting to match P2+ conventions
  - refactor(roadmap): migrate all 63 tickets to agent-optimised format
  - docs: update CHANGELOG, NEXT-SESSION, and README for session 22
  - refactor(engine): extract shared analyzer utilities to reduce code duplication
  - test(engine,schema): add test files to improve P3 test-to-source ratio (80→85)
  - feat(engine): add P5 doc criteria (ARI-DOC-005/006) and P6 pre-commit hooks (ARI-BLD-012)
  - chore(deps-dev): bump the dev-dependencies group with 5 updates
  - docs: update CHANGELOG, NEXT-SESSION, and ROADMAP for session 21
  - feat(engine): improve P6 build determinism (85→95) and P4 dev environment (95→100)
  - docs: update CHANGELOG.md and NEXT-SESSION.md for session 20
  - fix(engine): fix typecheck error in integration.test.ts
  - refactor(cli): reduce dispatchCommand complexity for P7 score improvement
  - docs: improve P5 doc readability score from 60 to 70
  - fix(engine): improve P3 test isolation score from 65 to 80
  - docs: update NEXT-SESSION.md and CHANGELOG.md for session 19
  - test: add 13 test files to improve P3 test-isolation score
  - docs: update AGENTS.md file structure to match actual codebase
  - refactor(cli): reduce cognitive complexity across 9 functions for P7 navigability
  - docs: fix README stale paths, add error taxonomy, update planning artifacts
  - fix(engine): fix regex source matching bug in P3 test-isolation analyzer
  - chore: add license field to root package.json
  - fix(engine): unref telemetry timeout so it cannot delay CLI exit
  - fix(engine): reduce false positives in P3 test-isolation analyzer
  - chore(claude-loop): auto-commit uncommitted build changes
  - feat: add anonymous opt-in telemetry (P2.13)

### Patch Changes

- Updated dependencies
  - @prontiq/ariscan-schema@0.6.0
  - @prontiq/ariscan-engine@0.6.0

## 0.5.0

### Minor Changes

- - feat: adhoc-task (#56)
  - fix(ci): route version bumps through PR to respect branch protection
  - fix: address review — separate confidence from accuracy, add pillar-level finding counts
  - docs: check P1 telemetry items and P2.06 DoD, advance 8 tickets to done
  - test(P2.06): add pillar coverage test for fix generator templates
  - feat(telemetry): add extended telemetry fields for P1 consolidation
  - fix: address review — check both TS and JS config paths in env schema preflight
  - fix: address review — check JS config paths in env schema preflight
  - fix: address review — JS-safe env schema, comment out Zod when absent
  - feat(P2.06): add guided remediation metadata, monorepo disclosure, env var schema
  - fix: address review — remove 10-file cap on provider-named abstraction scan
  - fix: address review — narrow abstraction pattern, broaden script latency scan
  - fix: address review — narrow abstraction pattern, broaden script latency scan
  - fix: address review — bound abstraction fallback scan to 50 reads with path prioritization
  - fix: address review — wire script latency inference, remove SDK scan cap
  - fix: address review — remove positional cap on abstraction fallback scan
  - fix: address review — decouple abstraction detection from filename prefilter
  - fix: address review — move telemetry after badge write, remove unused fix_types
  - fix: address review — wire telemetry options, tighten abstraction detection, fix session notes
  - fix: address review — uncheck P1.03 discovery perf item lacking e2e evidence
  - fix: address review — rename misleading benchmark, guard latency overwrite
  - docs(roadmap): check P1.03/P1.05/P1.06 items, update session notes
  - feat(schema,engine): expand telemetry payload with per-pillar distributions
  - test(engine): add 100k-file discovery benchmark (P1.03)
  - feat(engine): add structural provider pattern detection (P1.06)
  - feat(engine): enhance feedback latency inference (P1.05)
  - feat(engine,cli): add type coverage detection (P1.10), NDJSON streaming (P1.14), monorepo evidence (P1.02), badge validation (P1.16)
  - docs(roadmap): check P1.09-P1.15 items, remove REVIEW flags, update session notes
  - feat(engine): add branch protection/SAST findings, schema version export, and structured remediation data
  - docs: add versioning policy with semver impact rules (P1.14)
  - feat(engine): add research citations, structural clarity metric, and confidence verification
  - style(roadmap): normalize P1 ticket formatting to match P2+ conventions
  - refactor(roadmap): migrate all 63 tickets to agent-optimised format
  - docs: update CHANGELOG, NEXT-SESSION, and README for session 22
  - refactor(engine): extract shared analyzer utilities to reduce code duplication
  - test(engine,schema): add test files to improve P3 test-to-source ratio (80→85)
  - feat(engine): add P5 doc criteria (ARI-DOC-005/006) and P6 pre-commit hooks (ARI-BLD-012)
  - chore(deps-dev): bump the dev-dependencies group with 5 updates
  - docs: update CHANGELOG, NEXT-SESSION, and ROADMAP for session 21
  - feat(engine): improve P6 build determinism (85→95) and P4 dev environment (95→100)
  - docs: update CHANGELOG.md and NEXT-SESSION.md for session 20
  - fix(engine): fix typecheck error in integration.test.ts
  - refactor(cli): reduce dispatchCommand complexity for P7 score improvement
  - docs: improve P5 doc readability score from 60 to 70
  - fix(engine): improve P3 test isolation score from 65 to 80
  - docs: update NEXT-SESSION.md and CHANGELOG.md for session 19
  - test: add 13 test files to improve P3 test-isolation score
  - docs: update AGENTS.md file structure to match actual codebase
  - refactor(cli): reduce cognitive complexity across 9 functions for P7 navigability
  - docs: fix README stale paths, add error taxonomy, update planning artifacts
  - fix(engine): fix regex source matching bug in P3 test-isolation analyzer
  - chore: add license field to root package.json
  - fix(engine): unref telemetry timeout so it cannot delay CLI exit
  - fix(engine): reduce false positives in P3 test-isolation analyzer
  - chore(claude-loop): auto-commit uncommitted build changes
  - feat: add anonymous opt-in telemetry (P2.13)

### Patch Changes

- Updated dependencies
  - @prontiq/ariscan-schema@0.5.0
  - @prontiq/ariscan-engine@0.5.0

## 0.4.0

### Minor Changes

- - fix(ci): route version bumps through PR to respect branch protection
  - fix: address review — separate confidence from accuracy, add pillar-level finding counts
  - docs: check P1 telemetry items and P2.06 DoD, advance 8 tickets to done
  - test(P2.06): add pillar coverage test for fix generator templates
  - feat(telemetry): add extended telemetry fields for P1 consolidation
  - fix: address review — check both TS and JS config paths in env schema preflight
  - fix: address review — check JS config paths in env schema preflight
  - fix: address review — JS-safe env schema, comment out Zod when absent
  - feat(P2.06): add guided remediation metadata, monorepo disclosure, env var schema
  - fix: address review — remove 10-file cap on provider-named abstraction scan
  - fix: address review — narrow abstraction pattern, broaden script latency scan
  - fix: address review — narrow abstraction pattern, broaden script latency scan
  - fix: address review — bound abstraction fallback scan to 50 reads with path prioritization
  - fix: address review — wire script latency inference, remove SDK scan cap
  - fix: address review — remove positional cap on abstraction fallback scan
  - fix: address review — decouple abstraction detection from filename prefilter
  - fix: address review — move telemetry after badge write, remove unused fix_types
  - fix: address review — wire telemetry options, tighten abstraction detection, fix session notes
  - fix: address review — uncheck P1.03 discovery perf item lacking e2e evidence
  - fix: address review — rename misleading benchmark, guard latency overwrite
  - docs(roadmap): check P1.03/P1.05/P1.06 items, update session notes
  - feat(schema,engine): expand telemetry payload with per-pillar distributions
  - test(engine): add 100k-file discovery benchmark (P1.03)
  - feat(engine): add structural provider pattern detection (P1.06)
  - feat(engine): enhance feedback latency inference (P1.05)
  - feat(engine,cli): add type coverage detection (P1.10), NDJSON streaming (P1.14), monorepo evidence (P1.02), badge validation (P1.16)
  - docs(roadmap): check P1.09-P1.15 items, remove REVIEW flags, update session notes
  - feat(engine): add branch protection/SAST findings, schema version export, and structured remediation data
  - docs: add versioning policy with semver impact rules (P1.14)
  - feat(engine): add research citations, structural clarity metric, and confidence verification
  - style(roadmap): normalize P1 ticket formatting to match P2+ conventions
  - refactor(roadmap): migrate all 63 tickets to agent-optimised format
  - docs: update CHANGELOG, NEXT-SESSION, and README for session 22
  - refactor(engine): extract shared analyzer utilities to reduce code duplication
  - test(engine,schema): add test files to improve P3 test-to-source ratio (80→85)
  - feat(engine): add P5 doc criteria (ARI-DOC-005/006) and P6 pre-commit hooks (ARI-BLD-012)
  - chore(deps-dev): bump the dev-dependencies group with 5 updates
  - docs: update CHANGELOG, NEXT-SESSION, and ROADMAP for session 21
  - feat(engine): improve P6 build determinism (85→95) and P4 dev environment (95→100)
  - docs: update CHANGELOG.md and NEXT-SESSION.md for session 20
  - fix(engine): fix typecheck error in integration.test.ts
  - refactor(cli): reduce dispatchCommand complexity for P7 score improvement
  - docs: improve P5 doc readability score from 60 to 70
  - fix(engine): improve P3 test isolation score from 65 to 80
  - docs: update NEXT-SESSION.md and CHANGELOG.md for session 19
  - test: add 13 test files to improve P3 test-isolation score
  - docs: update AGENTS.md file structure to match actual codebase
  - refactor(cli): reduce cognitive complexity across 9 functions for P7 navigability
  - docs: fix README stale paths, add error taxonomy, update planning artifacts
  - fix(engine): fix regex source matching bug in P3 test-isolation analyzer
  - chore: add license field to root package.json
  - fix(engine): unref telemetry timeout so it cannot delay CLI exit
  - fix(engine): reduce false positives in P3 test-isolation analyzer
  - chore(claude-loop): auto-commit uncommitted build changes
  - feat: add anonymous opt-in telemetry (P2.13)

### Patch Changes

- Updated dependencies
  - @prontiq/ariscan-schema@0.4.0
  - @prontiq/ariscan-engine@0.4.0

## 0.3.0

### Minor Changes

- 5c752b6: Fix incorrect package name references in published READMEs and documentation.

  All three published npm READMEs contained wrong package names (e.g., `npx ariscan .` instead of `npx @prontiq/ariscan-cli .`, `@prontiq/schema` instead of `@prontiq/ariscan-schema`). This release corrects all references and adds significant new features: streaming progress output, --fix generators, agentignore categories, and provider patterns.

### Patch Changes

- Updated dependencies [5c752b6]
  - @prontiq/ariscan-schema@0.3.0
  - @prontiq/ariscan-engine@0.3.0

## 0.2.0

### Minor Changes

- 61bb964: Initial public release of all packages

### Patch Changes

- Updated dependencies [61bb964]
  - @prontiq/ariscan-schema@0.2.0
  - @prontiq/ariscan-engine@0.2.0
