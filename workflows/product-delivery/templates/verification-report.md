# Verification Report — <task title>

Drafted by: Verifier · Recorded by: plan owner · Workflow: `product-delivery` 2.0.0

| Field | Value |
| :--- | :--- |
| Task id | `<task-id>` |
| Date | `<YYYY-MM-DD>` |
| Implementer verification | `<plan section or commands and evidence>` |
| Independent review | completed / explicitly waived by user |
| Reviewer(s) | `<identity, confirmation it did not implement the change, or waiver reason>` |
| Additional review recommendation | recommended / not recommended — `<remaining risk or coverage gap>` / not applicable — independent review waived |

When independent review is completed, the plan owner records the additional
review recommendation after reading the first Verifier's evidence, then honors
any user request for more reviewers. If the user waived independent review,
record the recommendation as not applicable.

This report is the sole owner of final independent passed, failed, unverified,
and skipped judgments. Implementer coverage and evidence in the Implementation
Plan are claims to check, not results.

## Plan Reviewed

| Item | Value |
| :--- | :--- |
| Implementation Plan | scope revision `r<n>`, authorization `<source>` |
| Decisions checked | `<IDs, including superseded criteria and the decisions that changed them>` |
| Optional artifacts | `<links, or none>` |

Note anything missing, stale, or ambiguous, and what you verified against
instead.

## Repository State Reviewed

| Field | Value |
| :--- | :--- |
| Repository | `<path or remote>` |
| Branch | `<branch>` |
| Commit | `<full sha>` |
| Change reviewed | `<base sha>..<head sha>` / working tree on `<sha>`: `<diff summary or hash>` |

This result covers only this state. A later change needs follow-up checks and
review.

## Checks Performed

Every check lands in exactly one bucket. Missing evidence is never a pass.

| Check | Command or observation | Result | Evidence |
| :--- | :--- | :--- | :--- |
| … | `<command>` | passed | `<relevant output>` |
| … | `<command>` | failed | `<exact failure>` |
| … | … | unverified | why it could not be established |
| … | … | skipped | why it was not run |

## Acceptance Criteria

| ID | Criterion | Result | Evidence |
| :--- | :--- | :--- | :--- |
| AC1 | … | passed | … |
| AC2 | … | failed | … |
| AC3 | … | unverified | … |

## Regressions Found

Behavior that worked before and does not now, or preserved-behavior guarantees
from the plan that no longer hold. Cite the file, line, and reproduction.

- …

Write "none found" — not "none" — because absence of a found regression is not
proof of absence.

## Unsupported Scope

Changes present in the diff that the authorized scope does not cover, and any
criterion weakened without a recorded user decision.

- …

## Skipped Checks

Each with its reason. This section is never empty by default; if genuinely
nothing was skipped, say so explicitly.

- …

## Residual Risks

What could still be wrong after this verification, and what would establish it.

- …

## Overall Result

One of **passed**, **failed**, or **incomplete verification**.

The result reflects the weakest link: a single failed criterion means failed,
and outstanding unverified criteria mean incomplete verification rather than a
pass. State the result plainly, then the one-line reason.

**Result:** …
