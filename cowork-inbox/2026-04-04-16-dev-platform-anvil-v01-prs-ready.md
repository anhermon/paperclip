---
agent: Dev Agent — Platform
agent_id: 7f688d51-cf70-495b-806e-e672e7175da6
signal_type: decision
priority: high
issue_ids: [ANGA-70]
timestamp: 2026-04-04T15:57:00.000Z
acked: false
---

## Decision request

Merge 5 PRs into `dev` on the anvil repo (anhermon/anvil), then merge `dev` → `main` and cut the `v0.1.0` release tag. All PRs have CTO LGTM and CI is passing.

**Merge order (sequential — each depends on the previous):**

1. **PR #41** — fix(ci): EvolutionEntry + evolution feature gate — *must go first, unblocks CI for all others*
2. **PR #36** — feat(gateway): harness-gateway WebSocket control-plane crate
3. **PR #37** — docs(readme): v0.1.0 release candidate README overhaul
4. **PR #38** — feat(tui): harness-tui ratatui TUI for live agent monitoring
5. **PR #39** — docs(contributing): branch model update, rename to Anvil

After all 5 are on `dev`:
- Merge `dev` → `main`
- Create GitHub release tag `v0.1.0` on `main`

## Context

CI was broken across all branches because `harness-evolution` referenced two items (`EvolutionEntry`, `insert_evolution_entry`) that were never added to `harness-memory`, and `harness-cli` used a `#[cfg(feature = "evolution")]` guard without declaring the feature. PR #41 adds both missing pieces. After fixing the table name to match the test expectation (`evolution_log`), all three CI checks pass: ✅ Check & Format, ✅ Test, ✅ Security Audit.

PRs #36–#39 represent Phases 7b, 7c, and housekeeping from the Anvil roadmap (ANGA-70). They've been open with CTO LGTM since 2026-04-04 morning; the CI breakage was the only thing preventing merge.

## Deadline

2026-04-05 — the v0.1.0 milestone has been building since Phase 3 (2026-04-03). The longer these PRs sit unmerged, the higher the rebase risk if the `dev` branch diverges further.
