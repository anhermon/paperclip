# Agent Process Protocol

This document defines the full **worktree discipline** and **PR workflow protocol** for all agents working in the Anvil (Claude Code fork) repository.

Referenced by: AGENTS.md (Worktree Discipline — ANGA-533)  
Related: [ANGA-533](/ANGA/issues/ANGA-533), [ANGA-558](/ANGA/issues/ANGA-558), [ANGA-809](/ANGA/issues/ANGA-809)

---

## 1. Worktree Discipline

**Board directive (ANGA-533):** Every agent feature branch must live in an isolated git worktree. Never work on the main workspace. Never collect unrelated changes from a dirty working directory.

### 1.1 Golden Rule

> **One issue = one worktree = one branch = one PR. No exceptions. No scope creep.**

### 1.2 Creating a Worktree

Before starting any issue, run these commands from the **main workspace**:

```bash
# 1. Bring master up to date
git fetch origin
git checkout master
git pull --ff-only

# 2. Create the isolated worktree
git worktree add ../worktree-anga-<N>-<slug> -b <type>/anga-<N>-<slug>

# 3. Move into it — ALL work happens here
cd ../worktree-anga-<N>-<slug>
```

Where:
- `<N>` is the numeric issue number (e.g. `533`)
- `<slug>` is a short, lowercase, hyphen-separated summary of the issue title (≤ 40 chars)
- `<type>` follows the branch naming convention in `doc/AGENT-GIT-WORKFLOW.md`:  
  `feature`, `fix`, `chore`, `docs`, or `hotfix`

**Example:**
```bash
git worktree add ../worktree-anga-533-worktree-discipline -b feature/anga-533-worktree-discipline
cd ../worktree-anga-533-worktree-discipline
```

### 1.3 Working in the Worktree

- Do ALL file edits, test runs, and commits inside the worktree directory.
- The **main workspace is read-only** for agents. Use it only for: `git fetch`, `git pull --ff-only`, `git worktree add`, and `git worktree list`.
- Never `git add` or `git commit` from the main workspace.

### 1.4 Scope Discipline

| Rule | Why |
|------|-----|
| Work only on the assigned issue. | Unrelated changes pollute the PR and make review harder. |
| If you discover a new bug, **file a new Paperclip issue** first. | Then create a separate worktree for that bug — do NOT fix it in the current worktree. |
| Never cherry-pick unrelated commits into your worktree. | Each branch must have a clean, single-purpose history. |
| Do not import uncommitted changes from the main workspace. | Dirty state causes silent regressions. |

### 1.5 Cleaning Up

After your PR is **merged**, remove the worktree:

```bash
# From the main workspace:
git worktree remove ../worktree-anga-<N>-<slug>
# or, if the worktree has already been deleted on disk:
git worktree prune
```

Also delete the remote tracking branch if it was squash-merged:

```bash
git push origin --delete <type>/anga-<N>-<slug>
```

### 1.6 Worktree Checklist (run before every `git push`)

- [ ] I am inside the worktree directory, not the main workspace
- [ ] `git status` shows only changes relevant to the assigned issue
- [ ] No untracked files from other work are staged
- [ ] Branch name matches `<type>/anga-<N>-<slug>` pattern
- [ ] All commits reference the issue: `(ANGA-N)` in the subject line

---

## 2. Issue Work Protocol

### 2.1 Before Starting Work

1. **Verify auth:**
   ```bash
   curl -sf -H "Authorization: Bearer $PAPERCLIP_API_KEY" "$PAPERCLIP_API_URL/api/agents/me"
   ```
2. **Checkout the issue:**
   ```bash
   curl -sf -X POST \
     -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
     -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
     -H "Content-Type: application/json" \
     -d "{\"agentId\": \"$PAPERCLIP_AGENT_ID\", \"expectedStatuses\": [\"todo\",\"in_progress\",\"blocked\"]}" \
     "$PAPERCLIP_API_URL/api/issues/{issueId}/checkout"
   ```
   - A **409** response means another agent owns it — **exit immediately**.
3. **Read context:** `GET /api/issues/{issueId}/heartbeat-context`
4. **Create worktree** (see §1.2).

### 2.2 During Work

- Commit regularly with meaningful messages (see `doc/AGENT-GIT-WORKFLOW.md`).
- Each commit must include `(ANGA-N)` in the subject and the `Co-Authored-By: Paperclip <noreply@paperclip.ing>` trailer.
- If you get blocked, immediately update the issue:
  ```bash
  curl -sf -X PATCH \
    -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
    -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
    -H "Content-Type: application/json" \
    -d '{"status": "blocked", "comment": "Blocked on X — need Y from Z"}' \
    "$PAPERCLIP_API_URL/api/issues/{issueId}"
  ```

### 2.3 After Work

1. Run the pre-PR bootstrap check (see §3.1).
2. Open a PR (see §3).
3. Mark the issue done **only after User Agent LGTM**:
   ```bash
   curl -sf -X PATCH \
     -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
     -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
     -H "Content-Type: application/json" \
     -d '{"status": "done", "comment": "PR: <url>, what changed"}' \
     "$PAPERCLIP_API_URL/api/issues/{issueId}"
   ```

---

## 3. PR Workflow Protocol

Born from systemic failures in [ANGA-809](/ANGA/issues/ANGA-809). **All PRs must follow this lifecycle — no exceptions.**

> Any PR merged without User Agent LGTM will be rolled back by the Engineering Manager.

### 3.1 Pre-PR Bootstrap Check

Run this before creating ANY pull request:

```bash
# Governance docs must exist and be linked in AGENTS.md
test -f doc/AGENT-GIT-WORKFLOW.md && grep -q "doc/AGENT-GIT-WORKFLOW.md" AGENTS.md || {
  echo "PROTOCOL VIOLATION: Git workflow governance missing"
  echo "Action: File governance issue, resolve it, then resume work"
  exit 1
}

test -f doc/PROCESS.md && grep -q "doc/PROCESS.md" AGENTS.md || {
  echo "PROTOCOL VIOLATION: PROCESS.md not referenced in AGENTS.md"
  exit 1
}
```

If governance docs are missing:
1. **STOP** all PR-producing work immediately.
2. **FILE** a new issue: `[GOVERNANCE] Missing <protocol-name> documentation`.
3. **CREATE** the missing governance docs with Engineering Manager approval.
4. **UPDATE** AGENTS.md to reference the new docs.
5. **VERIFY** bootstrap check passes.
6. **RESUME** original task only after governance is in place.

### 3.2 PR Lifecycle (in order)

| Step | Action | Gate |
|------|--------|------|
| 1 | Feature branch created from latest `master` | Worktree discipline §1 |
| 2 | Implementation complete + tests written | — |
| 3 | Local test pass: `pnpm -r typecheck && pnpm test:run && pnpm build` | Must be green |
| 4 | PR opened with description linking to Paperclip issue | — |
| 5 | Respond to ALL automated reviews (Greptile, Codex) | Do NOT ignore any comment |
| 6 | CI green | All checks must pass; do NOT request review with failing CI |
| 7 | All code review comments addressed | Respond to every comment before requesting re-review |
| 8 | User Agent handoff (see §3.3) | Do NOT mark task done until LGTM received |
| 9 | Merge | Only after User Agent LGTM |

### 3.3 User Agent Handoff

After CI is green and all review comments are addressed, wake User Agent for final validation using the **rich link format** (plain `@User-Agent` text does NOT trigger wakeOnDemand):

```
[@User Agent](agent://ca658f6a-0af8-4e75-9a9a-b26cee51742b) — please validate this PR. CI is green, all review comments addressed.
```

Do NOT mark the Paperclip issue `done` until User Agent posts an LGTM.

### 3.4 PR Description Template

```markdown
## Summary

<1–3 bullet points describing what changed and why>

## Thinking Path

<Top-down explanation of your approach and design decisions>

## What Changed

- `path/to/file.ts` — <why>
- `doc/PROCESS.md` — <why>

## Verification

```bash
pnpm -r typecheck  # output
pnpm test:run      # output
```

Closes ANGA-N

## Checklist

- [ ] Branch created from latest master
- [ ] All tests pass locally
- [ ] PR description links to Paperclip issue
- [ ] All Greptile review comments addressed
- [ ] All Codex review comments addressed
- [ ] All CI checks green
- [ ] All human/manager review comments addressed
- [ ] User Agent LGTM received
- [ ] No temporary debugging code left in
```

### 3.5 Responding to Review Comments

- **Greptile / Codex automated comments:** Must all be addressed. If a suggestion is incorrect, respond explaining why and close the comment.
- **Human/manager comments:** Respond and re-request review after addressing.
- **Never merge with unresolved comments.** If you're unsure how to address a comment, ask in a reply — don't silently dismiss it.
- **Never skip CI.** If checks are failing, investigate and fix before requesting review.

### 3.6 PR Anti-Patterns (do not do these)

| Anti-Pattern | Why it's wrong |
|---|---|
| Opening a PR with failing CI | Wastes reviewer time; signals incomplete work |
| Ignoring Greptile/Codex comments | Automated reviews exist for a reason — engagement is mandatory |
| Marking issue `done` before User Agent LGTM | Bypasses the final validation gate; PRs will be rolled back |
| Squashing governance into unrelated PRs | Makes it impossible to revert governance changes cleanly |
| Scope creep in a single PR | Violates the one-issue/one-PR rule; creates wide blast radius on reverts |

---

## 4. ADR Gate (ANGA-559)

Before starting implementation on any task that introduces a new database schema, API surface touching agent configuration/execution policy, or a new platform abstraction — verify an ADR issue exists and is approved.

### ADR Required Criteria

An ADR **MUST** be filed and marked `accepted` before writing any code when the task involves:

| Trigger | Examples |
|---|---|
| New DB relation/table | New schema in `packages/db/src/schema/`, new migration file |
| New API for agent config/policy | Routes touching `/agents/*/policies`, `/agents/*/config` |
| New API for execution state | Routes touching locks, run state, adapter config |
| Abstraction overlap | Adding policy-as-DB when policy-as-config exists |
| Fork divergence | Different model from upstream for the same concept |

### ADR Process

1. **Stop** — do NOT start schema/API implementation.
2. **Check** for an existing ADR issue with `[ADR]` prefix and `accepted` status linked in the task.
3. If none exists, **comment** on the issue: "ADR required per ANGA-559. Filing ADR issue per `doc/ADR-TEMPLATE.md`."
4. **Create** an ADR issue using the template in `doc/ADR-TEMPLATE.md`.
5. **Wait** for Engineering Manager to approve (mark ADR `accepted`).
6. **Then** resume implementation, linking the ADR in your PR description.

**Template:** `doc/ADR-TEMPLATE.md`

---

## 5. OS-Specific Bug Triage (ANGA-557)

Before filing or patching any OS-specific (Windows, Linux, macOS) bug:

1. **Search first** — look for existing issues with the relevant OS label before opening a new one.
2. **Cross-reference** — if related issues exist, post a comment on each linking to your new issue.
3. **Label the new issue** — apply the correct OS label (`os:windows`, `os:linux`, or `os:macos`).
4. **Link the umbrella** — for Windows issues, include a link to [ANGA-1009](/ANGA/issues/ANGA-1009) in the description.
5. **Check upstream** — if the fix touches behavior that exists in upstream Claude Code, verify whether upstream has a related fix.

### OS Label IDs

| Label      | ID                                     |
|------------|----------------------------------------|
| os:windows | `2f56f014-5b48-42c5-92cd-c448c82420ec` |
| os:linux   | `f051c647-102d-403b-916d-cc6e52b7876e` |
| os:macos   | `21f608be-d32d-4a09-91fd-3fc5e563fa28` |

---

## 6. Quick Reference: Start-of-Issue Checklist

Run through this at the beginning of every issue assignment:

- [ ] Auth verified (`/api/agents/me` returns my identity)
- [ ] Issue checked out (no 409)
- [ ] Heartbeat context read
- [ ] Master is up to date (`git pull --ff-only`)
- [ ] Worktree created (`git worktree add`)
- [ ] Working inside the worktree (not main workspace)
- [ ] ADR gate checked (if schema/API work)
- [ ] OS triage done (if OS-specific bug)
- [ ] Pre-PR bootstrap check will pass (governance docs exist)
