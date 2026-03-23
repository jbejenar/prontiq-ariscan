# Research Evidence Base

> Empirical foundation for ARI scoring criteria. Every default scoring rule must trace to at least one entry in this registry.
>
> **Confidence levels:** High (peer-reviewed, replicated), Medium (peer-reviewed or strong industry data, not yet replicated), Low (preliminary, single-source, or internal study).

---

## Methodology

### Evidence Selection Criteria
1. **Relevance:** Direct bearing on at least one ARI pillar or scoring criterion
2. **Recency:** Preference for 2022+ publications; foundational work accepted regardless of age
3. **Quality:** Peer-reviewed publications preferred; high-quality industry reports accepted with confidence downgrade
4. **Reproducibility:** Studies with published methodology and data preferred

### Confidence Grading
- **High:** Peer-reviewed, methodology is reproducible, findings replicated or consistent across multiple studies
- **Medium:** Peer-reviewed or strong industry data, single study or limited replication
- **Low:** Preliminary findings, internal study, or single industry report without peer review

### Review Cadence
- Quarterly review of new publications per pillar
- Annual comprehensive sweep across all pillars
- Ad-hoc review when calibration benchmarks show drift

---

## Pillar 1: Agent Context Quality (Weight: 15%)

### Thesis
Human-authored, additive context files materially improve agent task success. However, poor-quality or auto-generated context degrades performance and wastes tokens.

| # | Paper | Year | Finding | Confidence | Product Implication |
|---|---|---|---|---|---|
| 1.1 | Evaluating AGENTS.md (Gloaguen et al., ETH Zurich) | 2026 | LLM-generated AGENTS.md files decrease success rates by 2-3%; human-authored files help only on niche/complex repos | High | Score additionality over presence; penalize generated boilerplate |
| 1.2 | Impact of AGENTS.md (Lulla et al.) | 2026 | 28.6% time reduction and 16.6% token savings when quality AGENTS.md present | High | Context quality has measurable ROI; justify remediation investment |
| 1.3 | Lost in the Middle (Liu et al.) | 2024 | >30% performance degradation when relevant information placed in middle of long contexts | High | Context placement and structure matter; optimize for retrieval position |
| 1.4 | Context Length Hurts (various) | 2025 | Volume alone degrades reasoning quality regardless of relevance | Medium | Context budget analysis is essential; penalize bloated context files |
| 1.5 | Information Gain per Turn (various) | 2025 | 30-40% performance drop from redundant information across turns | Medium | Deduplicate context across files; score redundancy as negative |

### Known Limits
- AGENTS.md research is early-stage (2026); sample sizes are moderate
- "Quality" of context is hard to define objectively — current proxy is additionality vs existing docs
- Optimal context length thresholds are model-dependent and will shift

---

## Pillar 2: Feedback Loop Speed (Weight: 15%)

### Thesis
Fast, reliable feedback loops (test, lint, typecheck, CI) are the primary cost multiplier for agent iteration cycles. Slow loops increase token spend, wall-clock time, and failure cascades.

| # | Paper | Year | Finding | Confidence | Product Implication |
|---|---|---|---|---|---|
| 2.1 | DORA 2024 Report (Google) | 2024 | AI adoption correlated with 1.5% throughput decrease and 7.2% stability decrease; elite performers maintain <1hr lead time | High | Fast feedback is more important than AI adoption itself |
| 2.2 | Accelerate (Forsgren et al.) | 2018 | Throughput and stability are not trade-offs — elite teams achieve both | High | Don't sacrifice quality for speed; measure both dimensions |
| 2.3 | Developer Experience and Productivity (DX/ACM) | 2024 | Developer inner loop speed is the strongest predictor of perceived productivity | Medium | Feedback loop proxy should weight local execution over CI-only |

### Known Limits
- DORA data is self-reported and correlational, not causal
- Agent-specific feedback loop research is limited; most data extrapolates from human developer studies
- CI duration proxy may miss local-only feedback loops

---

## Pillar 3: Test Isolation (Weight: 18%)

### Thesis
Test flakiness is the single largest reliability tax on agent workflows. Flaky tests cause false failures, wasted retries, and eroded trust in agent output. Isolation from external dependencies is the primary mitigation.

| # | Paper | Year | Finding | Confidence | Product Implication |
|---|---|---|---|---|---|
| 3.1 | Google-Scale Testing (Memon et al.) | 2017 | 41% of intermittent test failures at Google are flaky (not real bugs) | High | Flakiness is systemic, not anecdotal; treat as first-class scoring dimension |
| 3.2 | Flaky Tests (Luo et al.) | 2014 | 10-category root cause taxonomy for flaky tests; async waits and concurrency dominate | High | Detection rules should target known root cause categories |
| 3.3 | Systemic Flakiness (various) | 2025 | External dependencies (network, cloud services, time) are the predominant systemic cause | Medium | Isolation checks should prioritize external dependency detection |
| 3.4 | LLM-Generated Test Flakiness (Berndt et al.) | 2026 | 63% of LLM-generated flaky tests stem from unordered collection assertions; flakiness transfers from training data | High | Agent-generated tests amplify existing flakiness; isolation is even more critical with AI |
| 3.5 | iFixFlakies (Shi et al.) | 2019 | Automated flaky test repair achieves 77% fix rate for order-dependent tests | Medium | Automated remediation for test isolation is feasible |

### Known Limits
- Google-scale flakiness data may not generalize to smaller codebases
- LLM-generated test flakiness research is early (2026); patterns may shift with model improvements
- Flakiness detection has inherent false-positive risk; confidence labels are essential

---

## Pillar 4: Dev Environment (Weight: 10%)

### Thesis
Reproducible development environments dramatically reduce agent setup failures. Manual setup instructions have catastrophic drop-off rates.

| # | Paper | Year | Finding | Confidence | Product Implication |
|---|---|---|---|---|---|
| 4.1 | Tutorial Problem (VS Code Blog) | 2022 | 94-96% drop-off rate when users must follow manual setup steps | High | Devcontainer/bootstrap presence is a strong proxy for agent success |
| 4.2 | SWE-bench Setup Analysis (various) | 2025 | Agent task failure frequently traces to environment setup, not task complexity | Medium | Time-to-first-test is a meaningful readiness signal |
| 4.3 | Reproducible Builds Survey (ACM) | 2023 | Reproducibility reduces debugging time by 40-60% across team sizes | Medium | Environment parity checks have clear ROI justification |

### Known Limits
- VS Code tutorial data is user-facing, not agent-facing; agent setup may differ
- Devcontainer quality varies widely; presence alone is insufficient
- Environment complexity varies by language/framework; universal thresholds are difficult

---

## Pillar 5: Doc Machine-Readability (Weight: 10%)

### Thesis
Machine-readable documentation formats (OpenAPI schemas, JSON Schema, structured ADRs) improve agent accuracy and reduce hallucination compared to narrative-only documentation.

| # | Paper | Year | Finding | Confidence | Product Implication |
|---|---|---|---|---|---|
| 5.1 | Machine-Readable Science (bioRxiv) | 2026 | Machine-readable formats significantly reduce hallucination in LLM extraction tasks | Medium | Score schema presence and quality, not just doc presence |
| 5.2 | Literate Programming + LLMs (Chalmers) | 2026 | Semantic structure outperforms narrative prose for LLM task accuracy | Medium | Structured docs > README walls of text for agent consumption |
| 5.3 | OpenAPI Adoption Impact (SmartBear) | 2024 | Teams with OpenAPI specs report 35% fewer integration bugs | Medium | API schema presence is a meaningful quality signal |

### Known Limits
- Machine-readability research for LLMs is nascent; most evidence extrapolates from RAG studies
- "Quality" of machine-readable docs is subjective; schema presence is a proxy, not a guarantee
- Different agents may parse different formats with varying effectiveness

---

## Pillar 6: Build Determinism & Type Safety (Weight: 15%)

### Thesis
Type systems and deterministic builds dramatically reduce the error rate of AI-generated code. Type errors are the dominant failure mode for LLM-generated programs.

| # | Paper | Year | Finding | Confidence | Product Implication |
|---|---|---|---|---|---|
| 6.1 | TyFlow (Huang et al.) | 2025 | 33.6% of failed LLM-generated programs fail due to type errors | High | Type strictness is a first-order readiness signal |
| 6.2 | Type-Constrained Code Gen (ETH Zurich) | 2025 | Constrained decoding with type information reduces compilation errors significantly | High | Strict type systems amplify agent effectiveness |
| 6.3 | TypeScript at Scale (Bloomberg) | 2024 | Strict mode is essential for reliability at scale; partial adoption creates false confidence | Medium | Score strict mode specifically, not just TS presence |
| 6.4 | GitHub Octoverse | 2025 | 94% of LLM compilation errors are type-related failures | High | Type safety is the highest-leverage single intervention |
| 6.5 | Reproducible Builds (Lamb & Zacchiroli) | 2022 | Non-deterministic builds mask real errors and create debugging overhead | Medium | Lockfile presence and build determinism are meaningful signals |

### Known Limits
- Type system research is TypeScript-heavy; other language evidence is thinner
- "Strict mode" definitions vary by language; scoring must be language-aware
- Build determinism is hard to verify without actually running builds

---

## Pillar 7: Code Navigability (Weight: 12%)

### Thesis
The interface between agents and codebases matters as much as the underlying model. AST-based navigation and clean module boundaries improve agent accuracy significantly.

| # | Paper | Year | Finding | Confidence | Product Implication |
|---|---|---|---|---|---|
| 7.1 | Graph-RAG for Codebases (various) | 2025 | AST-based graph representations are 3.4x more accurate than vector-only RAG for code navigation | High | Navigability is a structural property, not just a size metric |
| 7.2 | SWE-agent (Yang et al.) | 2024 | Agent-codebase interface design is as important as model capability for task success | High | Navigability scoring captures a real effectiveness dimension |
| 7.3 | Cyclomatic Complexity and Defects (various) | 2020 | High cyclomatic complexity correlates with increased defect rates and maintenance burden | High | Complexity hotspots are meaningful signals for agent difficulty |
| 7.4 | Module Coupling and Cohesion (Briand et al.) | 1999 | Loose coupling and high cohesion predict lower defect density | High | Module boundary quality is a durable navigability signal |

### Known Limits
- Graph-RAG research is recent; long-term replication is pending
- Navigability heuristics (directory depth, naming) are proxies; actual agent navigation patterns vary by tool
- Complexity thresholds are language-dependent

---

## Pillar 8: Security & Governance (Weight: 5%, Gate)

### Thesis
AI-assisted code introduces concentrated security risk that compounds over iterations without governance controls. Security acts as a gate — below threshold, overall readiness is capped.

| # | Paper | Year | Finding | Confidence | Product Implication |
|---|---|---|---|---|---|
| 8.1 | AI Code Vulnerabilities (Pearce et al.) | 2021 | ~40% of GitHub Copilot-generated programs contain CWE Top 25 vulnerabilities | High | AI code needs governance controls; absence is a material risk |
| 8.2 | Security Degradation (IEEE-ISTAS) | 2025 | 37.6% vulnerability increase after 5 AI-assisted iteration cycles | High | Iterative AI edits compound security risk; gate behavior justified |
| 8.3 | Veracode Report (Wysopal et al.) | 2025 | AI hardcodes credentials at 2x the rate of human developers | Medium | Secrets scanning presence is a critical governance signal |
| 8.4 | CodeRabbit AI Code Review | 2025 | AI-generated PRs have 1.7x the issue rate of human-authored PRs | Medium | Code review controls are even more important with AI-assisted workflows |

### Known Limits
- Security research is rapidly evolving; vulnerability rates may improve with newer models
- Gate threshold (40% cap at L2) is calibrated against current research; may need adjustment
- Governance control presence is a proxy; actual effectiveness varies by implementation

---

## Cross-Cutting Research

### Agent Evaluation Benchmarks

| # | Paper | Year | Finding | Confidence | Product Implication |
|---|---|---|---|---|---|
| C.1 | SWE-bench (Jimenez et al.) | 2024 | Gold standard for agent evaluation; establishes baseline difficulty | High | Calibration benchmark for ARI scoring validation |
| C.2 | SWE-bench Pro (Scale AI) | 2025 | <25% success on production-grade issues vs 75%+ on Verified set | High | Complex codebases are fundamentally harder; readiness matters more at scale |
| C.3 | SWE-EVO | 2026 | 21% success on evolving codebases vs 65% on static snapshots | High | Codebase evolution degrades agent performance; continuous monitoring justified |
| C.4 | CooperBench | 2026 | 30% decreased success in multi-agent coordination; 36.9% failure rate | Medium | Multi-agent readiness is an emerging dimension (Phase 4 scope) |
| C.5 | Vibe Coding Survey (various) | 2025 | System-level optimization framework for AI coding effectiveness | Medium | Holistic readiness approach validated by practitioner research |
| C.6 | Multi-SWE-bench | 2026 | Cross-repository tasks have significantly lower success rates | Medium | Cross-repo readiness is a relevant dimension for multi-repo setups |

---

## Key Thresholds (Quick Reference)

| Metric | Value | Source | Pillar |
|---|---|---|---|
| Test flakiness at Google scale | 41% | Memon 2017 | P3 |
| LLM errors that are type errors | 94% | Octoverse 2025 | P6 |
| Context file cost increase (poor quality) | >20% | Gloaguen 2026 | P1 |
| Mid-context performance degradation | >30% | Liu 2024 | P1 |
| Security increase per 5 AI iterations | 37.6% | IEEE-ISTAS 2025 | P8 |
| AI PR issue rate vs human | 1.7x | CodeRabbit 2025 | P8 |
| Multi-agent coordination failure rate | 36.9% | CooperBench 2026 | Cross |
| DORA Elite lead time | <1 hour | DORA 2024 | P2 |
| Manual setup drop-off rate | 94-96% | VS Code 2022 | P4 |
| Agent time savings with quality AGENTS.md | 28.6% | Lulla 2026 | P1 |
| Agent token savings with quality AGENTS.md | 16.6% | Lulla 2026 | P1 |
| LLM flaky tests from unordered collections | 63% | Berndt 2026 | P3 |
| Failed LLM programs due to type errors | 33.6% | TyFlow 2025 | P6 |
| Graph-RAG accuracy vs vector RAG | 3.4x | Various 2025 | P7 |
| AI credential hardcoding vs human | 2x | Veracode 2025 | P8 |
| SWE-bench success on evolving codebases | 21% vs 65% | SWE-EVO 2026 | Cross |

---

## Research Gaps and Study Backlog

| Gap | Priority | Pillar | Status |
|---|---|---|---|
| Credentialed vs isolated environment impact on agent success | High | P3, P4 | Planned |
| Devcontainer impact on time-to-first-success | High | P4 | Planned |
| Schema-first vs narrative docs for agent accuracy | Medium | P5 | Planned |
| Multi-agent handoff readiness signals | Medium | Cross | Planned |
| Optimal context budget thresholds by repo size | Medium | P1 | Not started |
| Language-specific type safety impact beyond TypeScript | Medium | P6 | Not started |
| CI speed thresholds for agent effectiveness | Low | P2 | Not started |
| Navigability metric validation against agent task success | Low | P7 | Not started |
