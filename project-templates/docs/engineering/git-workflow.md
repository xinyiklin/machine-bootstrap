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
the PR title so the resulting base-branch commit remains consistent.

For stacked PRs, state the dependency and base branch. Merge the base PR first,
update the dependent branch onto the new base, and rerun affected checks.

## PR size

Plan PR boundaries before a large implementation. Each PR should deliver one
coherent behavior change and pass its checks independently. Keep related code,
tests, and necessary documentation together; separate unrelated refactors.

Count additions plus deletions in the proposed PR diff against its actual base
using the merge base, not the sum of individual commits. For stacked PRs, use
the declared parent branch. Include handwritten code, tests, and documentation.
Report generated output, lockfiles, pure renames, and binary files separately
with exact paths and reasons; exclude them from the numeric threshold but still
review them. Count edits within renamed files. Unknown or mixed-content files
remain counted; do not classify handwritten changes as generated to fit a limit.

| Counted changed lines | Required action |
| :--- | :--- |
| Up to 500 | Normal target; keep the PR focused |
| 501–1,000 | Explain in the PR body why keeping the change together improves review |
| Over 1,000 | Split it, or obtain a documented exception from the fresh independent reviewer before calling it ready or merging |

For an exception, record the counted size, excluded paths, why a safe split is
not useful, how the change can be reviewed, and the reviewer's explicit
acceptance for the reviewed head. The author cannot self-approve. A material
scope change or changed head requires renewed review and exception confirmation.
An exception does not waive tests, independent review, or publication authority.
If independent review is user-waived, only the user can explicitly grant the
size exception; the review waiver alone is insufficient.

These are review-policy gates, not an automated CI size check. Start with the
500/1,000 defaults; any project-specific adjustment belongs in its owning Git
contract with rationale, rather than an ad hoc per-PR threshold change.

## Verification and review

Before opening or updating a PR:

1. Inspect status, branch, base, and exact changed paths.
2. Run the narrowest checks for the changed surface and affected consumers.
3. Run `git diff --check` and inspect the complete diff for scope, regressions,
   stale paths, and secrets.
4. Complete self-review, then obtain one fresh independent review by default
   from a reviewer that did not make the change; `AGENTS.md` names which one.
   Only the user may waive that review for a specific change.
   The root guide requires the same review before local completion, even when
   no PR or full product-delivery workflow is requested.
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
