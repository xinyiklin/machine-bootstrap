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

## Pull requests and review

Use `.github/pull_request_template.md`. A PR title should match the intended
squash commit. The body must identify scope, affected owners, verification,
skipped evidence, risks, and rollout or follow-up notes.

Before opening or updating a PR:

1. Confirm worktree, branch, base, and exact changed paths.
2. Run focused owner checks and affected consumer checks.
3. Run `git diff --check` and inspect the complete diff.
4. Complete implementer self-review, then one fresh independent review by a
   reviewer that did not make the change — the installed Verifier role unless
   the user names another. Only the user may waive that review for a change.
   `AGENTS.md` also requires this before local completion, including maintenance.
5. Update affected guidance, engineering, and continuity owners.

Before merge, confirm the PR head is the exact reviewed and verified commit.
Do not merge a red, stale, conflicted, or unresolved PR. The default merge is
squash when repository protection permits it. Re-review after any new commit,
conflict resolution, or material scope change.

## Publication receipt

End publication work with the branch and exact SHA, base, commit/push/PR state,
checks, review status, merge state, and release/deploy state. Missing evidence
is `unverified` or `skipped`, never a pass.
