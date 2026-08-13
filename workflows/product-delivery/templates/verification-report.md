# Verification Report — <task title>

Drafted by: Verifier · Recorded by: Delivery Lead · Workflow: `product-delivery` 1.2.0

| Field | Value |
| :--- | :--- |
| Task id | `<task-id>` |
| Date | `<YYYY-MM-DD>` |
| Implementer verification | `<commands and evidence>` |
| Independent review | completed / explicitly waived by user |
| Reviewer(s) | `<identity or waiver reason>` |
| Additional review recommendation | required / optional — `<risk and coverage rationale>` / not applicable — independent review waived |

When independent review is completed, the Delivery Lead records this
recommendation after reviewing the first Verifier's evidence, then honors any
user request for more reviewers. If the user waived independent review, record
the recommendation as not applicable.

## Artifacts Reviewed

| Artifact | Version | Note |
| :--- | :--- | :--- |
| Product Brief | v1 (approved `<YYYY-MM-DD>`) | … |
| Delivery Plan | v1 (approved `<YYYY-MM-DD>`) | … |
| Implementation Report | `<date>` | … |

Note any artifact that was missing or whose version was ambiguous, and what you
verified against instead.

## Repository State Reviewed

| Field | Value |
| :--- | :--- |
| Repository | `<path or remote>` |
| Branch | `<branch>` |
| Commit | `<full sha>` |
| Diff reviewed | `<base sha>..<head sha>` |

## Checks Performed

Every check lands in exactly one bucket. Missing evidence is never a pass.

| Check | Command or observation | Result | Evidence |
| :--- | :--- | :--- | :--- |
| … | `<command>` | passed | `<relevant output>` |
| … | `<command>` | failed | `<exact failure>` |
| … | … | unverified | why it could not be established |
| … | … | skipped | why it was not run |

## Acceptance Criteria

| # | Criterion | Result | Evidence |
| :--- | :--- | :--- | :--- |
| 1 | … | passed | … |
| 2 | … | failed | … |
| 3 | … | unverified | … |

## Regressions Found

Behavior that worked before and does not now, or preserved-behavior guarantees
from the brief that no longer hold. Cite the file, line, and reproduction.

- …

Write "none found" — not "none" — because absence of a found regression is not
proof of absence.

## Unsupported Scope

Changes present in the diff that no approved artifact covers.

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
