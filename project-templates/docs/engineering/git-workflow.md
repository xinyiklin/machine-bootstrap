# Git And GitHub Workflow

This project follows the portable Git/GitHub baseline from the workspace
bootstrap. Project-specific commands, CI jobs, deployment triggers, release
tags, and branch-protection settings belong here when they differ.

Work is local by default. Treat commit, push, PR creation, review replies,
merge, branch deletion, tag, release, and deployment as separate publication
actions. An explicit request may authorize a bounded sequence, but do not infer
authority for later actions. Preserve unrelated dirty files, branches, remote
refs, stashes, and user-authored commits.

## Branches

Use lowercase kebab-case with a type prefix:

```text
<type>/<short-kebab-task>
```

Use the project's existing documented prefix when one exists. Otherwise prefer
`feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, `ci/`, `build/`, or
`release/`. Keep the task specific and do not commit directly to a protected
base branch when the project uses pull requests.

## Commits

Use Conventional Commit subjects:

```text
<type>(<optional-scope>): <imperative summary>
```

Use lowercase types such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`,
`ci`, `build`, `perf`, or `revert`. Keep commits coherent, concise, and
reviewable; include required consumer updates in the same commit when splitting
would leave the branch broken. Put rationale or migration notes in the body.
Do not leave WIP, fixup, unrelated, private-generated, or secret material in a
merge-ready commit. Stage exact paths and never bypass hooks.

Examples:

```text
feat(editor): preserve selection after format change
fix(server): reject stale document writes
docs(workflow): add exact-head merge receipt
```

## Pull requests

When GitHub delivery is requested, open a PR for every repository change,
including documentation and configuration. Use `.github/pull_request_template.md`
and keep its summary, scope, verification, risks, and skipped-checks sections
accurate.

If the project squash-merges by default, use the Conventional Commit subject as
the PR title so the resulting base-branch commit remains consistent. Prefer a
reviewable behavior slice; aim for 500 changed lines or fewer and document why
an exception cannot be split.

For stacked PRs, state the dependency and base branch. Merge the base PR first,
update the dependent branch onto the new base, and rerun affected checks.

## Verification and review

Before opening or updating a PR:

1. Inspect status, branch, base, and exact changed paths.
2. Run the narrowest checks for the changed surface and affected consumers.
3. Run `git diff --check` and inspect the complete diff for scope, regressions,
   stale paths, and secrets.
4. Complete self-review and obtain one fresh independent review by default.
   Only the user may waive that review for a specific change.
5. Update product, engineering, guidance, and continuity docs when behavior,
   ownership, commands, or durable state changed.

Report passed, failed, unverified, and skipped checks honestly. Before merge,
confirm the PR head SHA is the exact reviewed head, required CI is green, and
requested changes and unresolved threads are handled. A new commit or conflict
resolution requires a fresh review of the new head.

## Merge and post-merge

Default to squash merge with remote feature-branch deletion. Use rebase merge
only for a small set of independently useful atomic commits with no WIP/fixup
noise. Avoid solo merge commits. Follow project branch protection over example
commands.

After merge, verify the final merge/squash commit and tree, update the local
base branch with fast-forward-only synchronization, confirm the change is
present, and remove the local feature branch only when safe and authorized.
For versioned or deployable changes, record the required tag, release,
deployment, or live-health receipt.

If CI fails, protection blocks merge, or conflicts appear, report the exact
failure and stop for a fix or direction. Never force-push the base branch or
retry a blocked merge blindly. Preserve unrelated dirty work and remote refs.

## Publication receipt

Report the final state explicitly: branch and SHA, base and SHA, local commit,
push, PR number, check status, review status, merge strategy, post-merge sync,
and release/deploy status. Historical SHAs and check receipts are time-specific.

See the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
and [Git SubmittingPatches](https://git-scm.com/docs/SubmittingPatches) sources.
