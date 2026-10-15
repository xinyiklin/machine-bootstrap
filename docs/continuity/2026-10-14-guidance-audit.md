# Guidance audit against current provider guidance

Date: 2026-10-14. Scope: this repository's agent guidance (`AGENTS.md`,
`CLAUDE.md`, the project starters, `TEMPLATE-USAGE.md`, the first-party
skills, the generated role adapters, and the provider-facts owner), reviewed
against current official Claude Code and Codex documentation and community
experience. This receipt holds portable facts only.

## Authorization and classification

The user asked for a review of the agents files for efficiency, cleanliness,
and effectiveness using internet sources, with improvements applied and
reusable skills extracted as needed. Classification: ordinary change with the
normal review. No activating contract changed: installation ownership,
acquisition integrity, adapter fields, workflow policy, the starter's
authorization and review rules, and the hard invariants keep their meaning;
the new skill ships on the existing first-party acquisition path. The user's
in-progress consolidation of the review-tier rule into the two `AGENTS.md`
owners was preserved and built on.

## Sources checked

Official:

- Claude Code memory, best practices, skills, subagents, and "Extend Claude
  Code" pages (the links in `docs/provider-contracts.md`), plus the Claude
  blog post on steering Claude Code with skills, hooks, rules, and subagents.
- Codex `AGENTS.md`, skills, subagents, and best-practices pages.
- The `AGENTS.md` format site (agents.md).

Research and community (secondary, used for calibration only):

- arXiv 2602.11988, "Evaluating AGENTS.md": developer-written context files
  helped slightly and generated ones hurt slightly; every context file raised
  cost and broadened exploration; the authors recommend minimal requirements.
- HumanLayer, "Writing a good CLAUDE.md"; the Upsun summary of the ETH study;
  the Hacker News thread on Claude Code's native `AGENTS.md` reading; several
  practitioner write-ups on moving procedures out of `CLAUDE.md` into skills
  and must-always rules into hooks.
- Reddit could not be read directly from this session (fetch refused) and no
  search surfaced a Reddit thread; community evidence above is from Hacker
  News and blogs.

## What the sources agree on

- Keep always-loaded guidance short and specific: under about 200 lines, each
  line tested by "would removing it cause a mistake?"; long files make models
  ignore rules rather than filter them.
- Include commands, conventions that differ from defaults, repository
  etiquette, gotchas, and decisions no file explains. Exclude anything
  readable from the repository: layouts, dependency lists, generic advice.
- Procedures go in skills (loaded on demand); subtree rules in nested guides
  or path-scoped rules; anything that must happen every time in a hook,
  permission rule, test, or CI check, because prose is advisory.
- Add a rule only after a repeated mistake or review finding; prune on review.
- Emphasis works on one line, not many. State a rule once in its owner.

## Findings and edits

| File | Finding | Edit |
| :--- | :--- | :--- |
| `AGENTS.md` ownership map | Script purposes and the test layout were readable from the files | Compressed to owner-to-contract mapping (about 330 bytes saved) |
| `AGENTS.md` working method | "Keep changes scoped" is default behavior | Removed |
| `project-templates/AGENTS.md` | The authoring note ("state only what an agent cannot infer; keep under 8 KiB") loaded in every seeded session | Moved into the template blockquote that the `project-init` fill step deletes (the script copies starters verbatim); body now states the `CLAUDE.md` split instead |
| `project-templates/AGENTS.md` verification | "honestly" and "never skip it silently" are loophole-closers | Removed; the rules remain |
| `project-templates/TEMPLATE-USAGE.md` | Restated Claude nested loading, the Project instructions setting, and Codex's byte limit, all owned by `docs/provider-contracts.md` | Shortened to the authoring rule plus a pointer; names the new skill |
| `docs/provider-contracts.md` | Missing: Codex home `AGENTS.md`, Claude never reads `AGENTS.override.md`, subagent model fallback via `CLAUDE_CODE_SUBAGENT_MODEL`, Codex agent required fields and non-overridable sandbox, description budgets, official size guidance | Added, with sources; `providers.json` check date moved to 2026-10-14 |
| `docs/product-delivery.md` | Codex Verifier sandbox rationale read as a choice; current docs say an agent file cannot override it | Reworded |
| `skills/guidance-audit` | Lacked the official include/exclude test, skill and subagent checks, and the "still earning its place" check | Rewritten; 76 lines |
| `skills/guidance-capture` | No skill covered growing guidance correctly after a mistake | New; routes a rule to the root guide, nested guide or scoped rule, skill, hook or test, personal file, or decisions log |
| `README.md`, `INIT.md`, `skills.json` | Roster | New skill listed and pinned |
| `scripts/test/*.mjs` | Enforcement | Tests now require the README table to list every first-party skill, forbid authoring notes in the starter body, and keep the Codex byte limit in its owner |
| Role contracts and `WORKFLOW.md` | 44 emphatic lines across 32 KiB; material-change and review paragraphs restated between `WORKFLOW.md` and `delivery-lead.md`; descriptions already short and use-case first | Reviewed, not edited: the pass needs a workflow version bump and a reviewed reinstall; stays deferred in `CONTINUITY.md` |

Provider versions were not re-smoke-tested; the installed versions equal the
smoke-tested ones. After review, with the user's approval, the installed
`guidance-audit` copy was moved to the Trash and `install-skills.mjs`
installed both skills; `--check` then passed, the suite ran with no roster
skips, and `--check` printed no provider advisory.

## Review

Implementer verification: `node scripts/test-bootstrap.mjs` (110 passed, 5
roster-dependent skips because the new skill is not installed yet),
`git diff --check`, and `node scripts/init-workspace.mjs --check` (the two
expected first-party skill findings only). The TOML parser validation stays
unverified on this host (Python below 3.11); no adapter source changed.

Independent review: `mb-verifier`, first pass passed with no failed check and
no contract change; it confirmed every provider-contracts claim against the
cited pages on 2026-10-14 and recommended adding hard invariants to the
`guidance-capture` user-decision gate, moving its session-ownership sentence
before the writing steps, and three wording fixes, all applied. Its follow-up
review of that diff passed: the gate and ownership sentence are in place, the
nested-loading sentence matches the provider-contracts owner and the Claude
memory page, and the starter-body assertion excludes only the template
blockquote. One later reflow of a wrapped line in `TEMPLATE-USAGE.md` is
formatting-only and carries implementer verification alone (D028).
