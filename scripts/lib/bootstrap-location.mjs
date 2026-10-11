// One owner for "which workspace does this checkout administer". A linked Git
// worktree of machine-bootstrap, such as an agent session under
// .claude/worktrees/, administers the same workspace as its main checkout:
// that checkout's parent, not the worktree's own parent.

import { realpathSync } from "node:fs";
import { basename, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const gitEnvironmentOverrides = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CEILING_DIRECTORIES",
  "GIT_DISCOVERY_ACROSS_FILESYSTEM"
];

export function sanitizedGitEnvironment() {
  const environment = { ...process.env, LANG: "C", LC_ALL: "C" };
  for (const name of gitEnvironmentOverrides) delete environment[name];
  return environment;
}

// Returns the main checkout for a linked worktree, or null for a main checkout,
// a bare repository, or a path Git cannot inspect; callers keep their own Git
// checks and report those cases themselves.
export function mainCheckoutOf(checkoutRoot) {
  const probe = spawnSync(
    "git",
    ["-C", checkoutRoot, "rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"],
    { encoding: "utf8", env: sanitizedGitEnvironment(), shell: false }
  );
  if (probe.error || probe.status !== 0) return null;
  const [gitDir, commonDir] = probe.stdout.split(/\r?\n/).filter(Boolean);
  if (!gitDir || !commonDir) return null;
  try {
    const canonicalGitDir = realpathSync.native(gitDir);
    const canonicalCommonDir = realpathSync.native(commonDir);
    if (canonicalGitDir === canonicalCommonDir || basename(canonicalCommonDir) !== ".git") {
      return null;
    }
    return realpathSync.native(dirname(canonicalCommonDir));
  } catch {
    return null;
  }
}
