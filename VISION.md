# Vision

## The Platform Thesis

```
CLI (Score)                              ← Year 1
  → SaaS (Monitor + Fix)                 ← Year 1-2
    → Data Platform (Predict + Optimise)  ← Year 2-3
      → API Infrastructure (Ecosystem)    ← Year 3+
        → Industry Standard (Category)    ← Year 4+
```

**Year 1:** The `ariscan` CLI becomes the standard rubric for agent-readiness — the ESLint of the agent era. Teams add it to CI without thinking.

**Year 2:** The SaaS layer monetises fleet governance, continuous monitoring, and automated remediation. The data layer begins accumulating the only dataset mapping codebases to agent performance.

**Year 3:** The API becomes infrastructure. Other tools build on it. The Agent Performance Index (ARI Index) becomes the industry authority. The data business and compliance modules open enterprise doors the CLI alone couldn't.

**Year 4+:** Prontiq is the readiness layer of the AI development ecosystem. Every agent, every IDE, every CI pipeline, every engineering dashboard touches it.

**The scoring tool is the wedge. The data is the moat. The API is the platform. The ARI Index is the brand.**

---

## The ARI Score

ARI stands for **Agent Readiness Index**. It is a composite score (0-100) derived from 8 research-calibrated pillars:

| Pillar | Weight | What It Measures |
|---|---|---|
| Agent Context Quality | 15% | AGENTS.md quality, information additionality, conciseness |
| Feedback Loop Speed | 15% | Local test/lint/typecheck speed, CI duration |
| Test Isolation | 18% | Cloud credential independence, DI patterns, determinism |
| Dev Environment | 10% | Devcontainer, bootstrap scripts, time-to-first-test |
| Doc Machine-Readability | 10% | OpenAPI schemas, error taxonomy, env var validation |
| Build Determinism & Type Safety | 15% | TypeScript strict, lockfiles, reproducible builds |
| Code Navigability | 12% | Module boundaries, import graph, dead code, complexity |
| Security & Governance | 5% (gate) | Branch protection, CODEOWNERS, secrets scanning, SAST |

Maturity levels:

| Level | Name | Score | What Agents Can Achieve |
|---|---|---|---|
| L1 | Hostile | 0-25 | Almost nothing — agents thrash, hallucinate, waste tokens |
| L2 | Fragile | 26-45 | Simple single-file edits with heavy supervision |
| L3 | Capable | 46-65 | Routine tasks with moderate supervision |
| L4 | Productive | 66-80 | Multi-file features and refactoring with light supervision |
| L5 | Autonomous | 81-100 | Complex cross-service tasks, agent self-verifies |

Security acts as a **gate**: below 40% on Pillar 8 caps the overall level at L2 regardless of other scores.

---

## Why Prontiq Wins

1. **Evidence-based rubric.** 80+ peer-reviewed papers ground every criterion.
2. **Agent-agnostic is permanent.** Agent vendors build for themselves, not competitors. Prontiq is Switzerland.
3. **Open-source standard.** If `ariscan` becomes what teams add to CI, the rubric is the standard.
4. **Remediation > reporting.** A score without fixes is a guilt trip. Prontiq generates PRs.
5. **Data flywheel compounds.** More repos → better correlation → better recommendations → more repos.
6. **.agentignore as a file format.** First-mover on a standard that could become as universal as .gitignore.
