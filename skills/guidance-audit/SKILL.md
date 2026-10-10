---
name: guidance-audit
description: Audit and calibrate a repository's agent guidance (AGENTS.md, CLAUDE.md, CONTINUITY.md, rules, skills, subagents) for size, stale facts, duplication, contradictions, and instructions current models do not need. Use when the user asks to review, audit, trim, or calibrate agent instructions, when guidance budgets are exceeded, or when provider loading behavior may have changed.
---

# Guidance audit

Specific, short guidance is followed more reliably, and every always-loaded
line costs every session. The goal is the least guidance that still carries
every rule an agent cannot infer, without silently losing one.

## Measure

- Run `node ../machine-bootstrap/scripts/audit-workspace.mjs` (read-only) and
  read the repository's row: guide sizes, the Claude import, and continuity
  length.
- List what loads when: always (root `CLAUDE.md` with its imports, the
  `AGENTS.md` chain, unscoped rules, skill and subagent descriptions), on a
  path match (scoped rules, nested guides), and on demand (skills, docs).

## Check each always-loaded rule

- **Inferable?** Layouts, dependency lists, and generic coding advice can be
  read from the repository or are default behavior: cut them.
- **True?** Verify every path, command, version, and provider claim.
- **Stated once?** Keep a rule in its owner and link to it elsewhere.
- **Plain?** Replace emphatic or loophole-closing phrasing with one specific
  rule; strong emphasis makes current models over-apply it.
- **Needed every session?** Move procedures to a skill, path-specific rules to
  a scoped rule or nested guide, and reference material to an owning document.
- **Enforceable?** Prefer a test, CI check, hook, or permission rule to prose.

## Check provider currency

Compare loading and configuration claims with current official docs (Claude
Code memory, skills, subagents, and settings; Codex `AGENTS.md`, skills, and
configuration) and note the date checked. In Claude Code 2.1.283 or later,
suggest the user run `/doctor prompt-audit`, which is interactive.

## Report, then apply

Edit a repository's guidance only in a session started in that repository; from
anywhere else, report the findings and route them there. List findings with file
and line, the proposed edit, bytes saved, and risk. Apply only what the user
approves. Never drop a hard invariant or an authorization, review, or safety
rule silently: name each removed rule and where it now lives. Afterward rerun
the audit and the project's checks, and follow the project's review rules.