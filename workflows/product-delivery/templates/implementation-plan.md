# Implementation Plan — <task title>

Owner: `<Delivery Lead | Product Partner until handoff>` · Workflow: `product-delivery` 3.2.0

The authoritative living record for task `<task-id>`. Keep it in proportion to
the task: omit sections that do not apply, link detailed evidence rather than
copying it, and keep exactly one requirements list here. Other agents return
findings to the owner, who integrates them.

| Field | Value |
| :--- | :--- |
| Task id | `<task-id>` |
| Status | planning / awaiting decision / in progress / verifying / complete |
| Scope revision | r1 |
| Authorization | `<none yet | quote or cite the user's message, with date>` |
| Repository | `<path or remote>` · branch `<branch>` · base `<sha>` |
| Ownership history | `<date: role — reason>` |

Status is bookkeeping, never approval. Authorization comes only from the user.
A plan-only request does not authorize implementation.

## Request And Outcome

The user's request in their own terms, and what is true once it is done.

## Authorized Scope

The agreed baseline. Change user-confirmed items only through a recorded user
decision; then increment the scope revision and keep the prior wording
readable. Non-material detail the plan adds beyond the user's request is marked
`assumption`; adding it is not a scope change, and work may proceed on it
without separate confirmation. Material additions belong under Proposed
Changes, not here, until the user decides.

**Required behavior**

- …

**Constraints** — platform, privacy, performance, dependency, compatibility.

- …

**Preserved behavior** — what must keep working exactly as it does now.

- …

**Non-goals**

- …

**Acceptance criteria** — stable IDs, observable results, never renumbered.

| ID | Criterion | Implementation | Verification | Coverage |
| :--- | :--- | :--- | :--- | :--- |
| AC1 | … | `<where>` | `<command or observation>` | implemented / not implemented / deferred / self-unverified |
| AC2 | ~~superseded wording~~ → current wording (D002, r2) | … | … | … |

## Proposed Changes Awaiting Decision

Material changes not yet in the baseline: changed behavior, a weakened or
reinterpreted criterion, expanded scope, destructive migration risk, or a new
security or privacy implication. Dependent work pauses; independent authorized
work continues.

- **P1** `<discovery and evidence>` — options and consequences:
  `<A / B / defer>` — recommendation: `<option and why>` — affects: `<AC IDs>`
  — decision needed: `<exact question>`

Write `none` when nothing is pending.

## Findings And Approach

Repository facts with file and line references, then the technical approach
and why it fits. Include meaningful tradeoffs, the rejected alternative,
compatibility and migration effects, regression, security, privacy, and
data-loss risks with their treatment, and rollout or rollback where they
apply.

- …

## Phases

| Phase | Owner | Done when | Progress |
| :--- | :--- | :--- | :--- |
| 1 `<name>` | `<role or agent>` | `<completion signal>` | not started / in progress / done — `<evidence link>` |

A checked or `done` phase is a claim; confirm it against the repository when
resuming.

## Deferred Work And Deviations

In-scope work deliberately left out, and departures from the recorded approach,
each with its reason and the decision that settled it. Write `none` when there
are none, so a gap is never mistaken for an oversight.

- `<item>` — `<reason>` — `<decision ID or user message>`

## Questions, Assumptions, And Decisions

Source is one of `user`, `repo`, `assumption`, or `open`. Never rewrite a
decision in place; supersede it.

| ID | Item | Source | Status |
| :--- | :--- | :--- | :--- |
| Q1 | `<question that materially affects the work>` | open | asked `<date>` |
| A1 | `<reversible working assumption>` | assumption | active |
| D001 | `<decision and its reason>` | user `<date, message>` / repo `<path>` | active / superseded by D00n |

## Verification

Implementer self-verification uses `passed`, `failed`, `self-unverified`, or
`skipped`. Independent results belong only in the Verification Report.

| Check | Command or observation | Result | Evidence |
| :--- | :--- | :--- | :--- |
| … | `<command>` | passed / failed / self-unverified / skipped | … |

- Self-review of complete diff: `<done at sha/working state, findings>`
- Independent review: pending / `<report link and reviewed state>` / waived by
  user `<date, reason>`
- Additional reviewer recommendation: recorded in the Verification Report
  `<link>`

## Checkpoint

Update after meaningful discoveries or milestones and before a handoff or known
context reset.

- **Done:** `<work and its evidence>`
- **Current:** `<work in progress>`
- **Blockers / open questions:** `<or none>`
- **Next action:** `<one concrete step>`
- **Repository state:** `<branch, commit, working-diff summary>`
- **Pending review findings:** `<or none>`
