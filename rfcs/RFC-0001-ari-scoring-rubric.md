# RFC-0001: ARI Scoring Rubric v1

**Author:** John Bejenariu
**Date:** 2026-03-06
**Status:** Draft
**Relates to:** P1.13, all pillar scoring
**Repo:** `prontiq/ariscan`

---

## Summary
Defines the 8-pillar, research-calibrated ARI scoring rubric that produces a 0-100 composite score and L1-L5 maturity level.

## Motivation
No open standard exists for codebase agent-readiness. Traditional tools measure code quality and security, not agent effectiveness. 80+ papers provide empirical grounding for the ARI rubric.

## Design

### Pillar Weights

| Pillar | Weight | Justification |
|---|---|---|
| P1: Agent Context Quality | 15% | 2-4% swing in success rates |
| P2: Feedback Loop Speed | 15% | Primary cost multiplier for agent loops |
| P3: Test Isolation | 18% | Flakiness transfer compounds |
| P4: Dev Environment | 10% | 94-96% drop-off on manual setup |
| P5: Doc Machine-Readability | 10% | 3x token costs on unstructured parsing |
| P6: Build Determinism & Type Safety | 15% | 94% of LLM errors are type failures |
| P7: Code Navigability | 12% | Agent interface matters as much as model |
| P8: Security & Governance | 5% (gate) | Below 40% caps at L2 |

### Security Gate
P8 < 40% → overall level capped at L2 regardless of composite. Rationale: 37.6% vulnerability increase over 5 iterations.

### Versioning
Rubric is versioned (v1, v2...). New research → new version. Old versions remain for comparison.

## Open Questions
1. ~~Should per-criterion weights be configurable in v1?~~ **Resolved:** Yes, via `.ariscan.yml` profiles with weight overrides (P3.01).
2. ~~How to handle languages without type systems?~~ **Resolved:** P3.06 (Language Rubric Profiles) will adjust weights per language. Go/Rust get reduced P6 weight due to inherent type safety.
3. Should simulation results feed into ARI score? **Open.**
4. How should scoring adapt to project scale? Enterprise-ceremony findings on solo projects erode credibility. **Addressed by P2.16.**
5. Should pillars with insufficient data be excluded from composite rather than scored? **Addressed by P2.15.**
6. How should pillar weights be empirically validated? Current weights are expert-informed. End-to-end agent performance study planned. **Open — research gap.**

## Decision
[Pending — blocked on P2.15/P2.16 implementation and end-to-end validation study]
