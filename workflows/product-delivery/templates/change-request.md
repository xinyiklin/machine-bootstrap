# Change Request — <task title>

Raised by: Delivery Lead · Assessed by: Product Partner · Decided by: the user · Workflow: `product-delivery` 1.3.0

| Field | Value |
| :--- | :--- |
| Task id | `<task-id>` |
| Change request | CR001 |
| Date | `<YYYY-MM-DD>` |
| Product Brief in force | v1 (approved `<YYYY-MM-DD>`) |
| Delivery Plan in force | v1 (approved `<YYYY-MM-DD>`) |
| Trigger | user-facing behavior / weakened criterion / scope expansion / destructive migration risk / security or privacy implication |

## Discovery

What was found during investigation or execution, with evidence: files, lines,
commands, output. State the fact before the interpretation.

## Affected Acceptance Criteria

| # | Criterion | Effect |
| :--- | :--- | :--- |
| … | … | cannot be met as written / would be weakened / needs reinterpretation |

## Why The Approved Approach Is Insufficient

Why this cannot be handled as an ordinary internal technical decision inside
the approved scope.

## Options

Real options, including doing nothing. Each with its consequence for the user,
not only for the code.

### Option A — <name>

- **What it does:** …
- **User-visible effect:** …
- **Cost / risk:** …

### Option B — <name>

- **What it does:** …
- **User-visible effect:** …
- **Cost / risk:** …

### Option C — Defer

- **What it does:** ship the approved scope without this; …
- **User-visible effect:** …
- **Cost / risk:** …

## Tradeoffs

The comparison in one place: what each option buys and what it costs.

| Option | Buys | Costs |
| :--- | :--- | :--- |
| A | … | … |
| B | … | … |
| C | … | … |

## Delivery Lead Recommendation

Which option and why, in technical terms.

## Product Partner Assessment

Product impact: which criteria change, what the user gains or loses, and
whether this changes the brief or only the plan.

## Decision Required From The User

State the exact question, with the options named. Then wait.

> **Decision needed:** …

After the decision: update the affected artifact, bump its version, mark the
previous version superseded, and re-request approval of the exact new version.
Changing an approved Product Brief invalidates dependent Delivery Plans and
execution authorization; changing an approved Delivery Plan invalidates its
previous execution authorization.
