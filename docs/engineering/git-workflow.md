# Git And GitHub Workflow

This repository's history and publication contract. Project starter guidance
has its own project-owned copy under `project-templates/`.

## Authorization and scope

- Inspect `git status --short --branch` before changing or staging anything,
  and inspect the complete staged diff and run the relevant checks before
  committing.
- Commit, push, PR creation, merge, branch deletion, release, and deployment are
  separate actions. Perform only the ones the user authorized; an explicit
  request may authorize a bounded sequence, never later actions by inference.
- Preserve unrelated dirty files, commits, branches, refs, and stashes. Stage
  exact paths; never use broad staging or cleanup as a shortcut, and never
  bypass hooks without the user's explicit exception.
- Before a remote write the user's request has not already made clear, state
  the branch, changed scope, checks, and intended publication state.

## Branches and commits

Branches are `<type>/<short-kebab-task>` with types such as `feature`, `fix`,
`refactor`, `docs`, `test`, `chore`, `ci`, `build`, and `release`; do not rename
an existing branch for style. Commit subjects follow Conventional Commits:
`<type>(<optional-scope>): <imperative summary>`.

## PR size

Plan PR boundaries before a large implementation: each PR delivers one coherent
behavior change, passes its checks independently, and keeps related code,
tests, and documentation together.

Count additions plus deletions of handwritten code, tests, and documentation
against the merge base with the PR's actual base (the declared parent for
stacked PRs). Report generated output, lockfiles, pure renames, and binary
files separately with paths and reasons; they are excluded from the count but
still reviewed. Edits inside renamed files and unknown or mixed-content files
count; never classify handwritten changes as generated to fit a limit.

| Counted changed lines | Required action |
| :--- | :--- |
| Up to 500 | Normal target |
| 501–1,000 | Explain in the PR body why keeping the change together improves review |
| Over 1,000 | Split it, or get a documented exception from the fresh independent reviewer for the exact reviewed head |

An exception records the counted size, excluded paths, why a split is not
useful, and how the change can be reviewed. The author cannot self-approve, a
new head needs renewed confirmation, and the exception waives nothing else. If
review was user-waived, only the user can grant a size exception. Adjust these
defaults only in this contract, with rationale.

`node scripts/pr-size.mjs <base>` counts a branch this way; pass
`--exclude <path>` for generated output. The PR size check in CI fails above
1,000 unless the PR body records `size-exception: <head SHA>` for the current
head, added only with the reviewer's documented exception for that head. A
new commit changes the head, so the check fails again until the reviewer
confirms the exception for it. CI runs the base branch's copy of the script,
so a PR cannot loosen its own gate.

## Pull requests and review

Use `.github/pull_request_template.md`; the PR title matches the intended
squash commit. The PR body is the durable receipt for the change: scope,
affected owners, verification, skipped evidence, review result, and risks.

Before opening or updating a PR, confirm the branch, base, and exact changed
paths; run the owner and consumer checks plus `git diff --check`; and inspect
the complete diff. Review follows `AGENTS.md`: implementer verification, then
one fresh independent review unless the change is typo, link, formatting, or
comment-only, or the user waives it.

Merge only the exact reviewed and verified head; never merge a red, stale,
conflicted, or unresolved PR. Squash is the default. A new commit, conflict
resolution, or material scope change needs re-review. When the task's final PR
merges, delete its local `.agent-work/tasks/<task-id>/` folder, preferring the
trash.

## Publication receipt

End publication work with the branch and exact SHA, base, commit/push/PR state,
checks, review status, merge state, and release/deploy state. Missing evidence
is `unverified` or `skipped`, never a pass.
