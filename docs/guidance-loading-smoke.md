# Provider Guidance Loading Smoke Checks

These manual checks establish runtime loading behavior. The deterministic Node
suite validates only the repository's static topology and modeled contracts.

Run smoke checks in a disposable directory with unique, non-secret markers:

```text
Workspace/
├── AGENTS.md                 # marker: WORKSPACE_CODEX
├── CLAUDE.md                 # marker: WORKSPACE_CLAUDE; no AGENTS import
├── scratch/
│   └── local/AGENTS.md       # marker: NONGIT_LOCAL
└── child/.git/
    ├── AGENTS.md             # marker: CHILD_ROOT
    ├── CLAUDE.md             # @AGENTS.md; marker: CHILD_CLAUDE
    └── scoped/
        ├── AGENTS.md         # marker: CHILD_SCOPED
        └── CLAUDE.md         # @AGENTS.md
```

Do not reuse real projects, credentials, personal data, or machine guidance.

## Codex

Start a fresh run for each directory; navigating after startup is not a new
discovery run.

```bash
codex --cd <Workspace> --sandbox read-only --ask-for-approval never "List active instruction markers."
codex --cd <Workspace/child> --sandbox read-only --ask-for-approval never "List active instruction markers."
codex --cd <Workspace/child/scoped> --sandbox read-only --ask-for-approval never "List active instruction markers."
codex --cd <Workspace/scratch/local> --sandbox read-only --ask-for-approval never "List active instruction markers."
```

Expected project markers:

| Start directory | Expected | Must be absent |
| :--- | :--- | :--- |
| Workspace root | `WORKSPACE_CODEX` | `CHILD_ROOT`, `CHILD_SCOPED` |
| Child Git root | `CHILD_ROOT` | `WORKSPACE_CODEX`, `CHILD_SCOPED` |
| Child scoped directory | `CHILD_ROOT`, `CHILD_SCOPED` | `WORKSPACE_CODEX` |
| Non-Git local directory | `NONGIT_LOCAL` | `WORKSPACE_CODEX` |

For file-level evidence, enable a disposable plaintext Codex log directory or
inspect enabled session logging. Record the Codex version, date, starting
directory, exact command, observed sources, and any ambiguity.

## Claude Code

Start Claude in the child root and scoped directory. Run `/context` to inspect
live context composition. Configure a temporary `InstructionsLoaded` hook when
exact file-level load events and reasons are required.

Expected project markers:

| Start/access scope | Expected |
| :--- | :--- |
| Child root | `WORKSPACE_CLAUDE`, `CHILD_CLAUDE`, `CHILD_ROOT` once |
| Scoped directory | root markers plus `CHILD_SCOPED` through scoped adapter |

Confirm that `WORKSPACE_CODEX` is absent because the workspace Claude adapter
does not import its sibling `AGENTS.md`. Record the Claude Code version, date,
starting directory, `/context` observation, hook events, and any lazy-load or
compaction behavior.

## Reporting

Runtime loading is `verified` only for the provider version and scenario that
was actually observed. Otherwise report it as `unverified`; do not promote the
static Node suite to runtime evidence. Remove the disposable directory and any
logs after recording a non-sensitive summary.
