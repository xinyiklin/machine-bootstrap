# Implementation Report — <task title>

Owner: Delivery Lead · Workflow: `product-delivery` 1.2.0

| Field | Value |
| :--- | :--- |
| Task id | `<task-id>` |
| Date | `<YYYY-MM-DD>` |
| Product Brief | v1 (approved `<YYYY-MM-DD>`) |
| Delivery Plan | v1 (approved `<YYYY-MM-DD>`) |
| Repository / branch | `<repo>` / `<branch>` |
| Commit range | `<base sha>..<head sha>` |

## Implemented Scope

What was actually built, in the terms the brief used.

## Significant Files And Components Changed

Not an exhaustive diff — the changes a reviewer needs to understand.

| Path | Change |
| :--- | :--- |
| `<path>` | … |

## Acceptance-Criteria Status

Every criterion from the approved brief. Status is one of `met`, `not met`,
`unverified`, or `deferred`.

| # | Criterion | Status | Evidence |
| :--- | :--- | :--- | :--- |
| 1 | … | met | `<command / file / output>` |
| 2 | … | unverified | why it could not be established |

## Tests And Verification Performed

The commands actually run and what each demonstrated. Include the ones that
failed first and how they were resolved.

| Check | Command | Result |
| :--- | :--- | :--- |
| … | `<command>` | passed / failed / unverified / skipped |

State the implementer's verification and the mandatory independent review
separately. If the user explicitly waived independent review for this change,
record the waiver and reason. The final recommendation on additional reviewers
belongs in the Verification Report after the first independent review.

## Deviations From The Approved Plan

Where execution differed from the approved plan, and whether each deviation was
an ordinary internal technical decision or went through a Change Request.

| Deviation | Kind | Reference |
| :--- | :--- | :--- |
| … | internal decision / change request | CR001 |

Write "none" when execution followed the plan.

## Known Limitations

What is true but imperfect about the delivered result.

- …

## Explicitly Deferred

Work intentionally not done, so it is not read as an oversight.

- …
