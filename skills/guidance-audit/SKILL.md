---
name: guidance-audit
description: Audit and calibrate a repository's agent guidance (AGENTS.md, CLAUDE.md, CONTINUITY.md, rules, skills, subagents) for size, stale facts, duplication, contradictions, and instructions current models do not need. Use when the user asks to review, audit, trim, or calibrate agent instructions, when guidance budgets are exceeded, or when provider loading behavior may have changed.
---

# Guidance audit

Always-loaded guidance costs every session and is followed less reliably as
it grows. Short, developer-written context files help agents; padded or
generated ones cost more and help less. The goal is the least guidance that
still carries every rule an agent cannot infer, without silently losing one.

## Measure

- Run `node <checkout>/scripts/audit-workspace.mjs` (read-only), where
  `<checkout>` is `../machine-bootstrap` from a project root or, from a Git
  worktree,
  `"$(git rev-parse --path-format=absolute --git-common-dir)/../../machine-bootstrap"`.
  Read the repository's row: guide sizes, the Claude import, and continuity
  length.
- List what loads when: always (root `CLAUDE.md` with its imports, the
  `AGENTS.md` chain, unscoped rules, skill and subagent descriptions), on a
  path match (scoped rules, nested guides), and on demand (skills, docs).
- Targets: under 200 lines per always-loaded guide, the `AGENTS.md` chain
  within the budgets the audit prints, and every skill or subagent
  description short with its use case first (`docs/provider-contracts.md`
  in the checkout owns the provider limits).

## Check each always-loaded line

Ask of every line: would removing it cause an agent to make a mistake? If
not, cut it.

- **Inferable?** Layouts, dependency lists, framework conventions, and generic
  coding advice can be read from the repository or are default behavior: cut
  them. Keep commands, conventions that differ from defaults, repository
  etiquette, gotchas, and decisions no file explains.
- **True?** Verify every path, command, version, and provider claim.
- **Stated once?** Keep a rule in its owner and link to it elsewhere; two
  wordings of one rule drift and then contradict.
- **Plain?** One specific rule per line, concrete enough to check: "run
  `npm test` before committing", not "test your changes". Replace emphatic or
  loophole-closing phrasing; emphasis works only on a line that stands alone.
- **Needed every session?** Move a procedure or checklist to a skill, a rule
  for one part of the tree to a nested guide or path-scoped rule, and
  reference material to its owning document.
- **Enforceable?** A rule that must hold every time belongs in a test, CI
  check, hook, or permission rule; prose is advisory.
- **Still earning its place?** A rule added for a mistake current models no
  longer make goes, with its history kept in the ledger or decisions log.

## Check skills, subagents, and rules

- A skill description leads with its use case and says when it applies; the
  body is imperative, short, and names the scripts it runs.
- A subagent description says when to delegate; detail lives in its body,
  which loads only when it runs.
- An unscoped rule costs the same as the root guide; scope it with `paths`.

## Check provider currency

Compare loading and configuration claims with current official docs (Claude
Code memory, skills, subagents, and settings; Codex `AGENTS.md`, skills, and
configuration) and note the date checked. In Claude Code, also suggest the
user run `/doctor prompt-audit`, which is interactive and proposes cuts.

## Report, then apply

Edit a repository's guidance only in a session started in that repository; from
anywhere else, report the findings and route them there. List findings with file
and line, the proposed edit, bytes saved, and risk. Apply only what the user
approves. Never drop a hard invariant or an authorization, review, or safety
rule silently: name each removed rule and where it now lives. Afterward rerun
the audit and the project's checks, and follow the project's review rules.
A rule that recurs as a correction is added through the `guidance-capture`
skill, not during the trim.
