# Git And GitHub Workflow

This is the portable baseline for repository history and GitHub delivery. A
project may strengthen it with its own engineering guide, CI policy, release
process, or branch protection rules, but it must not weaken the safety and
verification requirements here.

## Ownership and authorization

- Run Git from the actual repository root and inspect `git status --short`
  before changing or staging anything.
- The nearest current project guide and its `docs/engineering/git-workflow.md`
  are authoritative for project-specific commands, scopes, CI, deployment, and
  release naming. If that document is absent, use this baseline.
- Work is local by default. Treat commit, push, PR creation, PR review replies,
  merge, branch deletion, tag, release, and deployment as separate remote or
  publication actions. Do not infer authority for a later action from an
  earlier one.
- An explicit request may authorize a bounded sequence such as “push, open a PR,
  and merge.” State the branch, exact file scope, checks, and publication plan
  before remote writes unless the request already makes that sequence clear.
- Preserve unrelated dirty files, local branches, remote refs, stashes, and
  user-authored commits. Never use broad staging or cleanup as a shortcut.

## Branches

Use lowercase kebab-case with a type prefix:

```text
<type>/<short-kebab-task>
```

Preferred types are:

- `feature/` — new product or workflow capability.
- `fix/` — bug or regression correction.
- `refactor/` — behavior-preserving structure change.
- `docs/` — documentation-only change.
- `test/` — test-only change.
- `chore/` — maintenance that does not change product behavior.
- `ci/` — automation or repository checks.
- `build/` — packaging or build-system change.
- `release/` — versioned release preparation.

Keep the name specific enough to scan in a branch list. Use the project's
existing prefix when it has a documented convention; do not rename a branch
merely for style. Never commit directly to a protected `main`/`master` branch
when the project uses pull requests.

Examples:

```text
feature/application-detail-history
fix/document-save-race
docs/git-workflow
ci/pin-action-revisions
```

## Commits

Use Conventional Commit subjects for normal commits:

```text
<type>(<optional-scope>): <imperative summary>
```

Rules:

- Use a lowercase type such as `feat`, `fix`, `docs`, `refactor`, `test`,
  `chore`, `ci`, `build`, `perf`, or `revert`.
- Add a scope when it improves scanning, for example `editor`, `server`,
  `frontend`, `backend`, `docs`, or `deps`.
- Use imperative mood (`preserve`, `add`, `remove`), keep the subject concise,
  and do not end it with a period.
- Keep each commit a coherent, reviewable unit. A shared-package change and
  required consumer updates belong together when splitting them would leave
  the branch broken.
- Put rationale, tradeoffs, migration notes, or important verification detail
  in the body when the subject cannot carry it.
- Do not leave WIP, fixup, unrelated, generated-private, or secret material in
  a merge-ready commit.
- Run the relevant local check and inspect the complete staged diff before
  committing. Stage exact paths.
- Never bypass hooks with `--no-verify` or `--no-gpg-sign` unless the user
  explicitly authorizes the exception and the reason is recorded.

Examples:

```text
feat(editor): preserve selection after format change
fix(server): reject stale document writes
docs(workflow): add exact-head merge receipt
```

## Pull requests

When GitHub delivery is requested, open a PR for every repository change,
including documentation and configuration. Do not commit directly to the
protected base branch. Use the repository's `.github/pull_request_template.md`
and keep the body factual and reviewable.

The PR title should use the same Conventional Commit form as the intended
squash commit:

```text
fix(editor): preserve selection after format change
```

The PR body must identify:

1. What changed, why, and which ownership boundary changed.
2. The important files, packages, or consumers affected.
3. Focused checks and broader consumer checks that passed.
4. Visual, live, deployment, or release checks that were skipped and why.
5. Risks, migrations, rollout notes, follow-ups, and any breaking change.

Prefer a reviewable behavior slice. Aim for no more than 500 changed lines;
treat 1,000 lines as a hard review cap unless the project documents why the
change cannot be split. Ship an enabling refactor separately from a feature
when that keeps both diffs understandable.

For stacked PRs, state the dependency and base branch clearly. Merge the base
PR first, update the dependent branch onto the new base, rerun affected checks,
and then continue. Do not silently retarget a dependent PR.

## Review and verification gates

Before opening or updating a PR:

1. Confirm the worktree, current branch, base branch, and exact changed paths.
2. Run the narrowest project-owned checks for the changed surface.
3. Run affected consumer checks for shared packages or cross-project contracts.
4. Run `git diff --check` and inspect the complete diff for correctness,
   regressions, unintended scope, stale paths, and secrets.
5. Complete the implementer's self-review, then obtain one fresh independent
   review by default. The portable Product Delivery workflow defines this
   review requirement; only the user may waive it for a specific change.
6. Update affected product, engineering, guidance, and continuity docs when
   behavior, ownership, commands, or durable state changed.

CI is a backstop, not a substitute for local evidence. Report every check as
passed, failed, unverified, or skipped; missing evidence is not a pass.

Before merge, confirm the PR's current head is the exact commit that was
reviewed and verified. Re-review after any new commit, conflict resolution, or
meaningful scope change. Do not merge a red, stale, conflicted, or unresolved
PR merely because an earlier commit was green.

## Merge and post-merge

Default to squash merge so one coherent PR becomes one revertable commit on
the base branch:

```text
gh pr merge <number> --squash --delete-branch
```

Use rebase merge only for a small set of independently useful, atomic commits
with no WIP or fixup noise. Avoid merge commits for a solo, single-slice PR.
Follow the project's branch-protection and required-check settings over any
example command here.

Do not merge until all applicable gates are true:

- The PR head SHA matches the exact reviewed head.
- Required CI is green and no required check is skipped or pending.
- Requested changes and unresolved review threads are handled.
- The base is current enough for the project's protection rules.
- The PR body and template accurately describe the final diff.

After merge:

1. Verify the merge or squash commit and the final base-branch tree.
2. Check out the base branch and update it fast-forward-only.
3. Confirm the merged PR's change is present locally.
4. Remove the local feature branch only when it is safe and authorized; the
   remote branch may be deleted by the merge action.
5. For versioned, deployable, or published changes, wait for the required tag,
   release, deployment, or live-health receipt and record its outcome.

If CI fails, branch protection blocks merge, or a conflict appears, report the
exact failure and stop for a fix or user direction. Never retry blindly. Never
force-push `main`; `--force-with-lease` on an unshared feature branch is only
appropriate when history rewriting is explicitly authorized.

## Publication receipt

End a GitHub delivery with an explicit state, not just “done”:

```text
Branch: <name> @ <sha>
Base: <branch> @ <sha>
Local commit: yes/no
Remote push: yes/no
PR: #<number> / not opened
Checks: passed / failed / pending / skipped (with names)
Review: self / independent / waived by user
Merge: squash/rebase/not merged
Post-merge sync: verified / not run
Release or deploy: verified / not applicable / not run
```

Keep historical SHAs, PR numbers, ports, PIDs, and check receipts tied to the
date or task. A later branch state supersedes an older receipt.

## Source basis

- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [Git SubmittingPatches](https://git-scm.com/docs/SubmittingPatches)
