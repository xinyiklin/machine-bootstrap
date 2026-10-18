---
name: continuity
description: Update or compact a repository's CONTINUITY.md handoff ledger. Use when a finished task changed durable project state, when the ledger is past its compaction trigger (128 lines, 80% of a 160-line default cap), or when the user asks to update, compact, or rotate continuity.
---

# Continuity

`CONTINUITY.md` is a bounded handoff ledger: current state, compact active
decisions, next actions, and open questions. History lives in append-only
archives under `docs/continuity/`, read only when a task needs it.

## Find the contract

The project's own guidance overrides these defaults:

- cap: 160 lines;
- compaction trigger: 80% of the cap (128 lines by default);
- compaction target: at most 60% of the cap (96 lines by default), so the
  next few updates do not trigger it again;
- archives: `docs/continuity/YYYY-MM.md`, named for the month of rotation;
- decisions: in the ledger, or in an optional `docs/decisions.md` when the
  project keeps one.

If the project has no `CONTINUITY.md`, do not create one unless the user asks.

## Update after a task

Record only what the next session needs and cannot get from the code, Git
history, or the PR: current state, decisions with their source (`[USER]`,
`[CODE]`), next actions, and open questions. Cite a PR or commit, never an
ignored local file such as `.agent-work/`. Replace stale lines rather than
appending near-duplicates. Then count the ledger's lines
(for example `wc -l CONTINUITY.md`); past the trigger, compact now rather than waiting
for the cap.

## Compact

When the user invokes this skill, compact even below the trigger. Rotate until
the ledger is at or below the target; if current entries alone exceed it,
shorten them as step 2 allows and report the remaining size.

1. Classify each entry as **current** (still true and needed for handoff),
   **resolved** (done, superseded, or only historical), or **decision** (a rule
   still in force). A superseded decision stays a decision; see step 4.
2. Keep current entries. Shorten one only when its detail already lives in an
   owning document you cite.
3. Move resolved entries verbatim — wording, dates, and tags unchanged — to the
   archive for the current month. Create it with a one-paragraph header if it
   is missing; otherwise append under a dated heading. Never edit or reorder
   existing archive text.
4. Keep decisions in force where the project keeps decisions; mark a
   superseded one in place, naming what replaced it.
5. Never carry secrets, credentials, or machine-local data into either file.

## Decisions log (optional)

Keep active decisions in the ledger while they are few. When they crowd out
current state, or the user asks, move them verbatim to `docs/decisions.md`:

- a short header: read on demand before changing a rule, plus the tag legend;
- one entry per decision, `- YYYY-MM-DD [USER] D001 ACTIVE: <rule and why>`,
  numbered in order and never renumbered;
- statuses change in place (`AMENDED by D00n`, `SUPERSEDED by D00n`) so the
  replaced wording stays readable; resolved decisions are not rotated out.

Then point the ledger's header at it. Do not create an empty log.

## Verify

- After a compaction the ledger is at or below the target, or you report its
  remaining size; it is always within its cap.
- Every line removed from the ledger appears in the archive or the decisions
  log, or was a stale duplicate you replaced: compare the removals in
  `git diff -U0 CONTINUITY.md` against them.
- Paths and links in the ledger resolve.
- The project's own checks pass if it tests the ledger.

Report which entries moved and where, and the ledger's new line count.
