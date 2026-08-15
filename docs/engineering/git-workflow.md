# Git And GitHub Workflow

This repository's history and publication contract. Project starter guidance
has its own project-owned copy under `project-templates/`.

## Authorization and scope

- Run Git from this repository root and inspect `git status --short --branch`
  before changing or staging anything.
- Commit, push, PR creation, merge, branch deletion, release, and deployment are
  separate actions. Perform only the actions the user authorized.
- Preserve unrelated dirty files, commits, branches, refs, and stashes. Stage
  exact paths; never use broad staging or cleanup as a shortcut.
- Before a remote write, state the branch, changed scope, checks, and intended
  publication state when the user's request has not already made them clear.

## Branches and commits

Use the repository's established lowercase typed branch naming:

```text
<type>/<short-kebab-task>
```

Common types are `feature`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`,
`build`, and `release`. Do not rename an existing branch merely for style.

Use Conventional Commit subjects:

```text
<type>(<optional-scope>): <imperative summary>
```

Keep commits coherent and reviewable. Inspect the complete staged diff and run
the relevant local checks before committing. Never bypass hooks unless the user
explicitly authorizes the exception.

## Pull requests and review

Use `.github/pull_request_template.md`. A PR title should match the intended
squash commit. The body must identify scope, affected owners, verification,
skipped evidence, risks, and rollout or follow-up notes.

Before opening or updating a PR:

1. Confirm worktree, branch, base, and exact changed paths.
2. Run focused owner checks and affected consumer checks.
3. Run `git diff --check` and inspect the complete diff.
4. Complete implementer self-review and one fresh independent review unless the
   user explicitly waives it for this change.
5. Update affected guidance, engineering, and continuity owners.

Before merge, confirm the PR head is the exact reviewed and verified commit.
Do not merge a red, stale, conflicted, or unresolved PR. The default merge is
squash when repository protection permits it. Re-review after any new commit,
conflict resolution, or material scope change.

## Publication receipt

End publication work with the branch and exact SHA, base, commit/push/PR state,
checks, review status, merge state, and release/deploy state. Missing evidence
is `unverified` or `skipped`, never a pass.
