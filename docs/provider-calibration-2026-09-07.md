# Codex and Claude setup calibration

Date: 2026-09-07. Scope: machine-bootstrap and its canonical project starters.
This receipt contains portable source facts only, not machine inventory.

## Authorization and workflow accounting

The user requested a Codex-first review retaining Claude support, then said
"go with your recommendation" after receiving the prioritized findings.
That session authorization covers the recommended implementation. Existing
dirty guidance changes were preserved and integrated into this calibration.
The user subsequently authorized final setup polish, push, and merge when ready.
Sibling propagation remains outside scope.

This change activates the full workflow under both the original path triggers
and the new contract triggers: it changes provider discovery and review policy.
The formal separate exact-version Product Brief and Delivery Plan approval
gates were not run. Execution followed the user's direct authorization and the
active session requirement to continue already-authorized work. This is a
recorded process deviation, not a claim that those two artifact approvals
occurred or that future tasks can omit them. The independent Verifier must
report that limitation. No waiver of independent review was requested.

## Implementation and acceptance evidence

| Recommendation | Result and evidence |
| :--- | :--- |
| Correct provider configuration roots | Skill installer uses `CLAUDE_CONFIG_DIR` and `CODEX_HOME` consistently with workflow installer; canonical content remains under the user's `.agents/skills/` |
| Prevent false successful verification | Disposable tests require missing custom Claude links to fail even when default links exist; selected Codex duplicates and malformed roots fail before acquisition |
| Preserve unrelated configuration | Tests cover inactive defaults, unrelated entries, relative paths with spaces, unset/empty fallback, relocated symlinks, and obstructed ancestors |
| Calibrate workflow activation | Root guidance names contract changes; mechanical maintenance preserving those contracts remains outside the full flow |
| Keep independent review for ordinary work | Root and starter completion guidance require self-verification and a fresh reviewer before local completion, including work without a PR |
| Avoid repeat permission loops | Starter respects instruction precedence and existing user authorization; unresolved decisions and new scope still require questions |
| Prioritize Codex desktop; retain Claude | README adds desktop task prompts and distinguishes CLI profile activation; Claude native roles and the single `@AGENTS.md` import remain |
| Expand runtime verification coverage | Smoke guide covers nested roots, overrides, custom provider directories, desktop delegation, and worktree scenarios; documented scenarios are not runtime passes |
| Reconcile Impeccable | Reviewed 4.0.2 restored with user authorization; the complete 4.0.4 copy remains recoverable outside skill discovery |

The portable Product Delivery package and generated adapters remain at 1.3.0;
their source contracts did not change. These are project trigger and starter
changes, not a generated adapter format update. Seeded sibling guidance remains
project-owned and is not synchronized.

## Impeccable source review and change request

The existing manifest pins 4.0.2 at
`fc2e694afca1ac0cc384b4fe56bab3335fea7912`, content hash
`c882be322c5f25047191b0675f0dcd6000b0b0ac7a9ce3d7fba649bf58f6abe5`.
Materializing that public Git revision through the audited acquisition helper
reproduced its hash without executing upstream code.

The previously installed 4.0.4 files match upstream commit
`e2761cae80ec90986c642739c7b42bc387e2d580` exactly by Git blob identities and
independent materialization through the audited acquisition helper. Both yield
the content hash
`1a05c01f46f896e103d2a9c9197ba8407cb82e15dc9deeb2b95ff7160b40ed6e`.
It is not the `skill-v4.0.4` tag (`9a949fb543d44cfb406f61bcab99d95d7f12cf1d`),
whose materialized hash is
`682acbf4650aefc64987290653b3eb0e467c27fb879c7bce991b7f98e355207b`.
Changing only the expected version or accepting an arbitrary local hash would
not provide reproducible acquisition.

Independent static review found a new optional live-edit journal cleanup
boundary defect in `scripts/live/frameworks/journal.mjs`: lexical containment
does not reject an intermediate symlink leading outside the project. A crafted
created-file entry with a matching marker can remove a file outside the project;
patched entries can rewrite one. The tag and installed 4.0.4 share this code.
No upstream helper was executed to test the finding. Hooks remain opt-in.

The user explicitly authorized restoring reviewed 4.0.2 on 2026-09-08 and
retaining it until a later reviewed upgrade recommendation. The audited Git
acquisition helper freshly reproduced the pinned hash without upstream code
execution. The complete 4.0.4 directory was moved to a recoverable backup
outside skill discovery, then replaced with verified 4.0.2. Both hashes were
verified afterward. The manifest and unrelated provider configuration remain
unchanged. This avoids the newly added helper; it does not certify all 4.0.2
behavior. Recommending an upgrade requires fresh review of the cleanup fix and
any changed acquisition or runtime behavior.

On 2026-09-08, the user asked whether a newer release addresses the finding.
The latest skill release is 4.2.2 at
`f64da20b07271b760e4e3133eef3b87942860f11`, using engine 0.1.3. Its launcher can
download and execute a platform binary on first use. Static review of
`crates/live/src/journal.rs` and `crates/live/src/util.rs` found the cleanup path
still uses lexical containment before file removal or rewriting. Current main
has no changes to those files relative to the release. The separate live-server
`/source` symlink fix does not establish that journal cleanup is fixed.
Independent review confirmed the same cleanup implementation in engine 0.1.3
at `2abca8b472afa15dd5f0430ea5c5f86911a14806`, including reachable removal and
orphan-healing callers. Released binary correspondence and an end-to-end
reproduction remain unverified; no upstream executable was run. The user chose
restoration after this comparison.

Public evidence: [4.0.2 source](https://github.com/pbakaus/impeccable/tree/fc2e694afca1ac0cc384b4fe56bab3335fea7912/.agents/skills/impeccable),
[matching 4.0.4 source](https://github.com/pbakaus/impeccable/tree/e2761cae80ec90986c642739c7b42bc387e2d580/.agents/skills/impeccable).
[4.2.2 release](https://github.com/pbakaus/impeccable/releases/tag/skill-v4.2.2)
and [cleanup source](https://github.com/pbakaus/impeccable/blob/f64da20b07271b760e4e3133eef3b87942860f11/crates/live/src/journal.rs).
Provider documentation sources are linked in README.

## Verification

- Full Node 24.19.0 regression suite after restoration: all 92 tests passed,
  with no skips. This includes all nine provider-root groups and guidance
  path/import, byte, and newline-inclusive continuity budget checks. Earlier
  runs failed only on the now-reconciled installed Impeccable drift.
- Workspace check after restoration: passed for all eight shared skills and
  the Product Delivery workflow with both providers' adapters.
- Workflow installation check: passed; installed package/adapters match source.
- Whitespace check: passed.
- External TOML parser: the 2026-09-08 full suite used bundled Python 3.12.14;
  `tomllib` parsed both adversarial generated-adapter fixtures successfully.
- Codex desktop: installed `mb_verifier` successfully delegated during review.
  Other desktop/CLI profile and nested-loading scenarios were not run.
- Claude: native runtime loading/delegation was not exercised.
- Initial Linux/macOS CI passed. Windows rejected an obstructed root correctly
  but exposed a platform-specific error-message assertion. The maintenance fix
  accepts both valid rejection diagnostics while retaining acquisition and
  preservation assertions. Final cross-platform results are recorded in the PR.
- Independent review found and retested fixes for unreadable links through
  relocated Claude directories and file-obstructed ancestors. The final full
  diff review found no unresolved implementation or guidance defect. Its only
  failed setup gate was the subsequently reconciled Impeccable drift.
- Separate brief/plan approval evidence remains absent as recorded above;
  runtime discovery and CI claims require their own evidence.

## 2026-09-08 follow-up: PR size policy

The user approved the proposed 500-line target and 1,000-line review gate,
allowing the numbers to be adjusted if needed. Both defaults were retained.
This changes required review policy and therefore activates the full workflow.
As with the calibration above, execution follows direct session authorization;
separate exact-version brief/plan approval gates were not run. That deviation
is recorded, not treated as artifact approval or a future exemption.

Both Git contracts now define additions-plus-deletions counting against the
actual PR base's merge base, with handwritten tests/docs included and generated
output, lockfiles, pure renames and binaries reported separately. Changes above
500 lines need an explanation; above 1,000 need a split or explicit fresh
reviewer exception for the reviewed head. A user waiver of independent review
does not itself grant a size exception. Both PR templates collect the evidence.
README and starter usage explain the policy and project-owned adjustments.
No size CI automation or sibling propagation was added.

Verification of this follow-up: both policy sections and both PR templates
match exactly; continuity's 160-line budget and `git diff --check` pass.
A fresh independent Verifier reviewed the actual policy diff, counting and exception
semantics, matching copies, and continuity budget, and found no material defect.
Final publication review must cover any subsequent edits and the exact head.
The separate brief/plan approval limitation remains recorded above.
