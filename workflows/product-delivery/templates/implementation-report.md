# Implementation Report — <task title>

Owner: plan owner · Workflow: `product-delivery` 3.1.0

Optional. The Implementation Plan already records coverage, evidence, and the
checkpoint; use this report only when a handoff or review needs more detail
than the plan should hold, and link it from the plan. It never restates or
changes the plan's requirements or acceptance criteria.

| Field | Value |
| :--- | :--- |
| Task id | `<task-id>` |
| Date | `<YYYY-MM-DD>` |
| Implementation Plan | scope revision `r<n>` |
| Repository / branch | `<repo>` / `<branch>` |
| Change | `<base sha>..<head sha>` / working tree on `<sha>` |

## Significant Files And Components Changed

Not an exhaustive diff: list what an independent reviewer needs to understand.

| Path | Change |
| :--- | :--- |
| `<path>` | ... |

## Implementation Coverage Detail

This is the implementer's coverage statement, not the final independent
judgment. Status is one of `implemented`, `not implemented`, `deferred`, or
`self-unverified`.

| ID | Implementation status | Implementer evidence |
| :--- | :--- | :--- |
| AC1 | implemented | `<path / command / observation>` |
| AC2 | self-unverified | why the implementer could not establish it |

## Implementer Self-Verification Detail

A result here remains self-evidence until the Verifier independently evaluates
the exact change.

| Check | Command or observation | Result | Evidence |
| :--- | :--- | :--- | :--- |
| ... | `<command>` | passed / failed / self-unverified / skipped | ... |

## Known Limitations And Deferred Work

- ...

## Verification Handoff

| Field | Value |
| :--- | :--- |
| Independent review status | pending / waived |
| Waiver reason | `none, or the user's explicit waiver and reason` |

Independent review is pending unless the user explicitly waived it for this
change. The Verification Report alone records the final independent passed,
failed, unverified, and skipped judgments or the explicit waiver. This report
must not describe pending or waived verification as complete.
