# Change Request — <task title>

Raised by: plan owner · Product assessment: Product Partner, when involved · Decided by: the user · Workflow: `product-delivery` 3.0.0

Optional. A material change is normally recorded as a proposal in the
Implementation Plan. Use this template only when the choice needs more room,
and link it from that proposal. It proposes; it never changes the authorized
scope by itself.

| Field | Value |
| :--- | :--- |
| Task id | `<task-id>` |
| Change request | CR001 (plan proposal `P<n>`) |
| Date | `<YYYY-MM-DD>` |
| Scope revision in force | `r<n>` |
| Trigger | changed agreed behavior / weakened criterion / expanded scope / destructive migration risk / security or privacy implication |

## Discovery

What was found, with evidence: files, lines, commands, output. State the fact
before the interpretation.

## Affected Acceptance Criteria

| ID | Effect |
| :--- | :--- |
| AC… | cannot be met as written / would be weakened / needs reinterpretation |

## Work Paused And Work Continuing

Which dependent work waits for the decision, and which independent authorized
work continues.

## Options

Real options, including deferring. Each with its consequence for the user, not
only for the code.

| Option | What it does | User-visible effect | Cost / risk |
| :--- | :--- | :--- | :--- |
| A | … | … | … |
| B | … | … | … |
| Defer | ship the authorized scope without this | … | … |

## Recommendation

Which option and why. Add the Product Partner's product assessment when it is
involved.

## Decision Required From The User

> **Decision needed:** …

After the decision, the plan owner updates the plan's authorized scope,
increments its scope revision, keeps the prior criterion wording readable, and
records the decision with its source. Routine execution updates never require
this process.
