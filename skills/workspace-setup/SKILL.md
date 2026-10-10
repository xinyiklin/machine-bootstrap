---
name: workspace-setup
description: Check, update, or repair this machine's shared agent setup (skills, the product-delivery workflow, Claude and Codex adapters) through the machine-bootstrap checkout. Use when the user asks to update or verify the workspace setup, after pulling machine-bootstrap changes, or when a bootstrap check reports a missing skill, differing content, or a workflow version change.
---

# Workspace setup

The machine-bootstrap scripts make every change; this skill decides which to
run and what the user must decide. On a machine with nothing installed yet the
skill does not exist; follow the checkout's `INIT.md` instead.

## Locate the checkout

`machine-bootstrap` is a direct child of the workspace folder, so from any
project root it is `../machine-bootstrap`. Confirm that
`scripts/init-workspace.mjs` exists there, or ask the user for the path. Run
every command from that checkout, and read its `AGENTS.md` first.

## Check, then act on what it reports

Start with the read-only check:

```bash
node scripts/init-workspace.mjs --check
```

- **Passes:** report the state; nothing to do.
- **A skill is missing:** with the user's go-ahead, unless they asked for the
  update, run `node scripts/install-skills.mjs`. It installs only missing
  skills, verifies pinned hashes, and runs no upstream code.
- **A skill's content differs from its pin:** never overwrite. Tell the user
  whether the pin changed upstream or the local copy was edited. With their
  approval, move the installed copy out of `~/.agents/skills/` (to the trash),
  then rerun the installer.
- **Workflow files differ:** usually a new workflow version. Show the version
  change and the files the check lists. With the user's approval, run
  `node scripts/install-workflows.mjs --replace`, which backs up every replaced
  file. Then move files the new version retired, as the "Updating a workflow"
  section of `docs/product-delivery.md` names them, to the trash.
- **An unmanaged skill is reported:** report it; never delete it.
- **Legacy or ancestor guidance stops setup:** stop and list the paths. Cleanup
  is manual; never move `MACHINE.md` or a project's guidance.
- **`MACHINE.md` placeholders remain:** fill them only with verified local
  facts, never credentials, private documents, or secret file names.

## Finish

Rerun the check until it passes. Report what changed, every backup created,
and anything left for the user. Tell the user to start a new provider session
so new skills and agents are discovered. Installers never edit provider
settings; offer the README's recommended permission rules instead.
