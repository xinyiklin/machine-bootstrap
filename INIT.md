# Initialize This Workspace

This is the agent-facing entry point for a fresh checkout.

Prerequisites: Git and Node.js 18 or newer.

## Instruction for an AI agent

Read this file and `README.md`, then run from this repository:

```bash
node scripts/init-workspace.mjs
```

Before running it, confirm this checkout is a direct child of the intended
dedicated workspace folder. The script treats its parent as the workspace root
and refuses to use the filesystem root or user home.

After the command succeeds:

1. Inspect the generated workspace-root `MACHINE.md`.
2. Replace its `TODO` placeholders only with facts verified on this machine.
   Never add credentials, tokens, private documents, or secret filenames.
3. Run the read-only verification:

   ```bash
   node scripts/init-workspace.mjs --check
   ```

4. Report installed guidance, skill verification, remaining `MACHINE.md`
   placeholders, and anything that requires review. Do not initialize Git at
   the workspace root and do not stage, commit, publish, or overwrite differing
   files unless the user explicitly asks.

If initialization reports differing workspace guides or templates, stop and
show the differences. Use `--replace` only after the user reviews them; the
replacement is recoverable because the existing files are renamed to
timestamped backups.

Use `--skip-skills` only when the user explicitly wants workspace files without
installing or verifying shared skills.
