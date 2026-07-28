import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const windowsReservedName =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function isPortablePathPart(part) {
  return (
    Boolean(part) &&
    part !== "." &&
    part !== ".." &&
    !/[<>:"\\|?*\u0000-\u001f]/.test(part) &&
    !/[. ]$/.test(part) &&
    !windowsReservedName.test(part)
  );
}

export function isReviewedGitHubRepository(repository) {
  return (
    typeof repository === "string" &&
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(
      repository
    )
  );
}

export function isPortableSkillPath(path) {
  return (
    typeof path === "string" &&
    Boolean(path) &&
    !path.startsWith("/") &&
    path.split("/").every(isPortablePathPart)
  );
}

// Bootstrap runs unattended, so an unreachable or private repository must fail
// instead of blocking on a terminal or GUI credential prompt.
const nonInteractiveGitEnv = {
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
  LANG: "C",
  LC_ALL: "C"
};

function createGitEnvironment() {
  const gitEnvironment = { ...process.env, ...nonInteractiveGitEnv };
  // Askpass programs are executable prompt mechanisms. Do not inherit them
  // into an unattended bootstrap even though terminal prompting is disabled.
  delete gitEnvironment.GIT_ASKPASS;
  delete gitEnvironment.SSH_ASKPASS;
  return gitEnvironment;
}

// Names the subcommand for error messages, skipping leading options such as
// `-C <path>` so a failure reads "git fetch" rather than "git -C".
function gitSubcommand(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-C" || arg === "-c") {
      index += 1;
      continue;
    }
    if (!arg.startsWith("-")) return arg;
  }
  return "command";
}

function runGit(args, { cwd, encoding = "utf8", maxBuffer } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding,
    env: createGitEnvironment(),
    maxBuffer,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    throw new Error(
      `git ${gitSubcommand(args)} exited with status ${result.status}` +
      `${detail ? `: ${detail}` : ""}`
    );
  }

  return result.stdout;
}

export function fetchReviewedSource(repository, revision) {
  if (!isReviewedGitHubRepository(repository)) {
    throw new Error(`unsupported skill repository: ${repository}`);
  }
  if (!/^[a-f0-9]{40}$/.test(revision)) {
    throw new Error(`invalid skill revision: ${revision}`);
  }

  const repositoryRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-git-"));
  try {
    runGit(["init", "--bare", "--quiet", repositoryRoot]);
    runGit([
      "-C",
      repositoryRoot,
      "-c",
      "credential.helper=",
      "-c",
      "core.askPass=",
      "fetch",
      "--quiet",
      "--depth=1",
      "--no-tags",
      repository,
      revision
    ]);
    const actualRevision = runGit([
      "-C",
      repositoryRoot,
      "rev-parse",
      "FETCH_HEAD^{commit}"
    ]).trim();
    if (actualRevision !== revision) {
      throw new Error(
        `fetched revision ${actualRevision} does not match reviewed ${revision}`
      );
    }

    return {
      repositoryRoot,
      cleanup() {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    };
  } catch (error) {
    rmSync(repositoryRoot, { recursive: true, force: true });
    throw error;
  }
}

export function materializeReviewedSkill(
  repositoryRoot,
  revision,
  sourcePath,
  destination
) {
  if (!/^[a-f0-9]{40}$/.test(revision)) {
    throw new Error(`invalid skill revision: ${revision}`);
  }
  if (!isPortableSkillPath(sourcePath)) {
    throw new Error(`invalid skill source path: ${sourcePath}`);
  }
  if (existsSync(destination)) {
    throw new Error(`skill destination already exists: ${destination}`);
  }

  const treeOutput = runGit(
    [
      "-C",
      repositoryRoot,
      "ls-tree",
      "-r",
      "-z",
      revision,
      "--",
      sourcePath
    ],
    { encoding: null, maxBuffer: 64 * 1024 * 1024 }
  );
  const records = treeOutput
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  if (records.length === 0) {
    throw new Error(`reviewed skill path is missing: ${sourcePath}`);
  }

  mkdirSync(destination, { recursive: false });
  const materializedLinks = [];
  try {
    for (const record of records) {
      const match = record.match(/^(\d+) blob ([a-f0-9]+)\t([\s\S]+)$/);
      if (!match) throw new Error(`unsupported Git tree entry: ${record}`);

      const [, mode, objectId, gitPath] = match;
      const prefix = `${sourcePath}/`;
      if (!gitPath.startsWith(prefix)) {
        throw new Error(`skill tree escaped reviewed path: ${gitPath}`);
      }

      const relativePath = gitPath.slice(prefix.length);
      if (!isPortableSkillPath(relativePath)) {
        throw new Error(`unsafe skill path: ${gitPath}`);
      }

      const outputPath = resolve(destination, ...relativePath.split("/"));
      const destinationPrefix = `${resolve(destination)}${sep}`;
      if (!outputPath.startsWith(destinationPrefix)) {
        throw new Error(`skill path escaped destination: ${gitPath}`);
      }
      mkdirSync(dirname(outputPath), { recursive: true });

      const contents = runGit(
        ["-C", repositoryRoot, "cat-file", "blob", objectId],
        { encoding: null, maxBuffer: 64 * 1024 * 1024 }
      );
      if (mode === "120000") {
        if (process.platform === "win32") {
          throw new Error(
            `reviewed skill contains a symbolic link unsupported on Windows: ${gitPath}`
          );
        }
        const linkTarget = contents.toString("utf8");
        if (
          !linkTarget ||
          linkTarget.startsWith("/") ||
          linkTarget.startsWith("\\") ||
          linkTarget.includes("\\") ||
          /^[A-Za-z]:/.test(linkTarget)
        ) {
          throw new Error(`unsafe symbolic link target in ${gitPath}`);
        }
        const resolvedTarget = resolve(dirname(outputPath), linkTarget);
        const destinationRoot = resolve(destination);
        if (
          resolvedTarget !== destinationRoot &&
          !resolvedTarget.startsWith(`${destinationRoot}${sep}`)
        ) {
          throw new Error(`symbolic link escapes reviewed skill: ${gitPath}`);
        }
        symlinkSync(linkTarget, outputPath);
        materializedLinks.push({ gitPath, outputPath });
      } else if (mode === "100644" || mode === "100755") {
        writeFileSync(outputPath, contents);
        if (mode === "100755" && process.platform !== "win32") {
          chmodSync(outputPath, 0o755);
        }
      } else {
        throw new Error(`unsupported Git mode ${mode} for ${gitPath}`);
      }
    }

    for (const link of materializedLinks) {
      if (!existsSync(link.outputPath)) {
        throw new Error(`symbolic link target is missing: ${link.gitPath}`);
      }
    }
  } catch (error) {
    rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}
