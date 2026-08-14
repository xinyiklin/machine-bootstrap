# Decision Log — <task title>

Owner: Product Partner · Workflow: `product-delivery` 1.3.0

Durable product decisions for task `<task-id>`. One entry per decision. Never
rewrite a decision in place: supersede it and leave the original readable.

Status is one of `ACTIVE`, `SUPERSEDED`, or `WITHDRAWN`. Source is one of
`user`, `code`, `tool`, or `assumption`.

## Decisions

### D001 — <short decision title>

| Field | Value |
| :--- | :--- |
| Date | `<YYYY-MM-DD>` |
| Source | user / code / tool / assumption |
| Status | ACTIVE |
| Superseded by | — |

**Decided:** what was decided, in one or two sentences.

**Reason:** why this rather than the alternatives. Name the alternative that
was rejected and what it would have cost.

---

### D002 — <short decision title>

| Field | Value |
| :--- | :--- |
| Date | `<YYYY-MM-DD>` |
| Source | user / code / tool / assumption |
| Status | SUPERSEDED |
| Superseded by | D005 |

**Decided:** …

**Reason:** …

---

<!-- Copy an entry block for each new decision. Keep them in numeric order and
leave superseded entries in place. -->
