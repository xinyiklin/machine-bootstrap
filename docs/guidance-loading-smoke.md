# Provider Guidance Loading Smoke Checks

These manual checks establish runtime loading behavior. The deterministic Node
suite validates only static topology and modeled contracts.

Use a disposable directory with non-secret markers:

```text
Workspace/
|-- MACHINE.md
|-- machine-bootstrap/
|   |-- .git/
|   |-- AGENTS.md       # BOOTSTRAP_ROOT
|   `-- CLAUDE.md       # @AGENTS.md
|-- project-a/
|   |-- .git/
|   |-- AGENTS.md       # PROJECT_A_ROOT
|   `-- CLAUDE.md       # @AGENTS.md
|-- project-b/
|   |-- .git/
|   |-- AGENTS.md       # PROJECT_B_ROOT
|   `-- CLAUDE.md       # @AGENTS.md
`-- scratch/
```

The workspace root has no `AGENTS.md` or `CLAUDE.md`. Do not reuse real
projects, credentials, personal data, or machine guidance.

## Codex

Start a fresh run for each directory; navigating after startup is not a new
discovery run.

```bash
codex --cd <Workspace/machine-bootstrap> --sandbox read-only --ask-for-approval never "List active instruction markers."
codex --cd <Workspace/project-a> --sandbox read-only --ask-for-approval never "List active instruction markers."
codex --cd <Workspace/project-b> --sandbox read-only --ask-for-approval never "List active instruction markers."
codex --cd <Workspace> --sandbox read-only --ask-for-approval never "List active instruction markers."
codex --cd <Workspace/scratch> --sandbox read-only --ask-for-approval never "List active instruction markers."
```

| Start directory | Expected project marker | Must be absent |
| :--- | :--- | :--- |
| `machine-bootstrap/` | `BOOTSTRAP_ROOT` | both project markers |
| `project-a/` | `PROJECT_A_ROOT` | bootstrap and project B |
| `project-b/` | `PROJECT_B_ROOT` | bootstrap and project A |
| `Workspace/` | none | all three repository markers |
| `Workspace/scratch/` | none | all three repository markers |

Codex discovers project guidance from the detected project root down to the
launch directory. With no detected project root it checks only the launch
directory. Do not rely on sibling filesystem access to load or switch project
instructions.

## Claude Code

Start separate Claude sessions at each repository root and inspect `/context`.
Use a temporary `InstructionsLoaded` hook when exact file-level evidence is
required. Each session should contain only its repository marker through that
repository's `CLAUDE.md` adapter and single `@AGENTS.md` import. The workspace
and scratch sessions should contain none of the three repository markers.

## Reporting

Runtime loading is `verified` only for the provider version and scenario
actually observed. Otherwise report it as `unverified`; do not promote the
static Node suite to runtime evidence. Record provider version, date, launch
directory, exact command, observed sources, and ambiguity. Remove the fixture
and logs after recording a non-sensitive summary.
