---
name: guidance-capture
description: Turn a repeated mistake, review finding, or correction into the smallest durable guidance in the right place (an AGENTS.md rule, a nested or path-scoped rule, a skill, a hook or permission rule, or a test). Use when an agent made the same mistake twice, a review caught something the guidance should have said, the user repeats a correction, or the user asks to remember a rule for future sessions.
---

# Guidance capture

Guidance grows one earned rule at a time. One mistake is noise; the same
mistake twice, a review comment that recurs, or a correction the user typed in
two sessions is a signal. Capture the rule where it is cheapest to hold and
most likely to be followed.

## Decide whether it is a rule

- A one-off: note it in the task and stop.
- Inferable from the repository (layout, dependencies, existing patterns, the
  README): not guidance. Fix the repository if it misleads, otherwise nothing.
- Already stated somewhere: the fix is phrasing, placement, or a
  contradiction, not a new line. Find the owner and repair it there.

## Choose the place

| The rule is | Put it in |
| :--- | :--- |
| Needed in every session and not inferable: a command, a convention that differs from defaults, an authorization boundary, a gotcha | The root `AGENTS.md`, under its existing section |
| True only for one part of the tree | A nested `AGENTS.md` there; a Claude `.claude/rules/*.md` with `paths` only for Claude-only mechanics |
| A procedure or checklist followed on demand | A skill, described by its use case |
| Something that must happen every time, or never | A hook, permission rule, CI check, or test, with at most a one-line pointer in guidance |
| A personal preference | The user's own memory file or `CLAUDE.local.md`, never the shared guide |
| A decision with its rationale | `docs/decisions.md` or the continuity ledger, plus a one-line rule in the guide only if every session needs it |

Shared policy stays provider-neutral in `AGENTS.md`; `CLAUDE.md` holds only
Claude mechanics. Project-owned guidance changes only in a session started in
that project; from elsewhere, hand the proposed line to such a session.

## Write it

- One line, imperative, concrete enough to verify, with the reason when it is
  not obvious. Match the file's existing voice; no emphasis.
- Replace a stale or contradicting line rather than appending beside it.
- Keep the guide within its budget: if the line does not fit, remove a line
  that earns less, and say which.
- A rule that changes a hard invariant, authorization, review, safety, or an
  activating condition is the user's decision; propose the wording and wait.

## Verify

- Read the result in place: the rule is stated once and the file stays within
  its budget. `node <checkout>/scripts/audit-workspace.mjs` reports the
  budgets, where `<checkout>` is `../machine-bootstrap` from a project root
  or, from a Git worktree,
  `"$(git rev-parse --path-format=absolute --git-common-dir)/../../machine-bootstrap"`.
- Run the project's guidance tests if it has them.
- Record the capture in the continuity ledger when the project keeps one,
  citing the mistake or review it came from.

Periodic trimming is the `guidance-audit` skill.
