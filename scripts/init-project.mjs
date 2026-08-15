#!/usr/bin/env node

import {
  accessSync,
  constants,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  sep
} from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(bootstrapRoot, "..");
const canonicalBootstrapRoot = realpathSync.native(bootstrapRoot);
const canonicalWorkspaceRoot = realpathSync.native(workspaceRoot);
const rawArgs = process.argv.slice(2);
const createTarget = rawArgs.includes("--create");
const positional = rawArgs.filter((arg) => !arg.startsWith("--"));
const unknownOptions = rawArgs.filter(
  (arg) => arg.startsWith("--") && arg !== "--create"
);

function fail(message) {
  console.error(`\nProject initialization failed: ${message}`);
  process.exit(1);
}

if (unknownOptions.length) {
  fail(`Unknown argument(s): ${unknownOptions.join(", ")}`);
}
if (positional.length !== 1) {
  fail(
    "Provide exactly one target: " +
      "node scripts/init-project.mjs <target> [--create]"
  );
}

const [nodeMajor] = process.versions.node
  .split(".")
  .map((part) => Number.parseInt(part, 10));
if (!Number.isInteger(nodeMajor) || nodeMajor < 24) {
  fail(`Node.js 24 or newer is required; found ${process.versions.node}`);
}

const homeCandidates = [homedir(), process.env.HOME, process.env.USERPROFILE]
  .filter(Boolean)
  .map((candidate) => {
    try {
      return realpathSync.native(resolve(candidate));
    } catch {
      return resolve(candidate);
    }
  });
if (canonicalWorkspaceRoot === parse(canonicalWorkspaceRoot).root) {
  fail("Workspace root cannot be the filesystem root");
}
if (homeCandidates.includes(canonicalWorkspaceRoot)) {
  fail("Workspace root cannot be the user home; use a dedicated workspace folder");
}
if (dirname(canonicalBootstrapRoot) !== canonicalWorkspaceRoot) {
  fail("machine-bootstrap must resolve as a direct child of the workspace root");
}

const bootstrapGit = gitProbe(bootstrapRoot);
if (bootstrapGit.error) {
  fail(
    bootstrapGit.error.code === "ENOENT"
      ? "Git is required on PATH"
      : bootstrapGit.error.message
  );
}
if (bootstrapGit.status !== 0) {
  fail(`machine-bootstrap must be a Git repository: ${bootstrapGit.stderr.trim()}`);
}
const canonicalBootstrapGitRoot = realpathSync.native(
  bootstrapGit.stdout.trim()
);
if (canonicalBootstrapGitRoot !== canonicalBootstrapRoot) {
  fail(
    `machine-bootstrap checkout must be its Git root; found ${canonicalBootstrapGitRoot}`
  );
}

const workspaceGit = gitProbe(workspaceRoot);
if (workspaceGit.status === 0) {
  fail(
    `Workspace root must stay outside Git; found worktree ${workspaceGit.stdout.trim()}`
  );
}
if (!workspaceGit.stderr.includes("not a git repository")) {
  fail(`Could not verify the workspace Git boundary: ${workspaceGit.stderr.trim()}`);
}

function entryExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw error;
  }
}

function isInside(parent, child) {
  const path = relative(parent, child);
  return (
    Boolean(path) &&
    !path.startsWith(`..${sep}`) &&
    path !== ".." &&
    !isAbsolute(path)
  );
}

function canonicalCandidate(path) {
  if (entryExists(path)) return realpathSync.native(path);
  const parent = dirname(path);
  if (!entryExists(parent)) {
    fail("Only the final target directory may be missing; create its parent first");
  }
  const canonicalParent = realpathSync.native(parent);
  return join(canonicalParent, basename(path));
}

const requestedTarget = resolve(process.cwd(), positional[0]);
const targetExisted = entryExists(requestedTarget);
const canonicalTarget = canonicalCandidate(requestedTarget);
if (canonicalTarget === parse(canonicalTarget).root) {
  fail("Target cannot be the filesystem root");
}
if (homeCandidates.includes(canonicalTarget)) fail("Target cannot be the user home");
if (canonicalTarget === canonicalWorkspaceRoot) {
  fail("Target cannot be the workspace root");
}
if (!isInside(canonicalWorkspaceRoot, canonicalTarget)) {
  fail(`Target must resolve inside the workspace: ${canonicalWorkspaceRoot}`);
}
if (
  canonicalTarget === canonicalBootstrapRoot ||
  isInside(canonicalBootstrapRoot, canonicalTarget)
) {
  fail("Target cannot be machine-bootstrap or a path inside it");
}

if (targetExisted) {
  const targetLstat = lstatSync(requestedTarget);
  if (!targetLstat.isDirectory() && !targetLstat.isSymbolicLink()) {
    fail("Existing target must be a directory");
  }
  if (!statSync(requestedTarget).isDirectory()) {
    fail("Existing target must resolve to a directory");
  }
} else if (!createTarget) {
  fail("Target does not exist; rerun with --create to create the directory");
}

function gitProbe(path) {
  return spawnSync("git", ["-C", path, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    env: { ...process.env, LANG: "C", LC_ALL: "C" },
    shell: false
  });
}

let gitRoot = null;
const probe = gitProbe(targetExisted ? requestedTarget : dirname(requestedTarget));
if (probe.error) {
  fail(
    probe.error.code === "ENOENT" ? "Git is required on PATH" : probe.error.message
  );
}
if (probe.status === 0) {
  gitRoot = realpathSync.native(probe.stdout.trim());
  if (!targetExisted) {
    fail(`New target cannot be created inside existing Git repository ${gitRoot}`);
  }
  if (gitRoot !== canonicalTarget) {
    fail(`Existing repository target must be its Git root; found ${gitRoot}`);
  }
} else if (!probe.stderr.includes("not a git repository")) {
  fail(`Could not verify the target Git boundary: ${probe.stderr.trim()}`);
}

const templateRoot = join(bootstrapRoot, "project-templates");
const seedFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "docs/engineering/git-workflow.md",
  ".github/pull_request_template.md"
];
for (const relativePath of [...seedFiles, ".gitignore"]) {
  const source = join(templateRoot, ...relativePath.split("/"));
  try {
    if (!statSync(source).isFile()) {
      fail(`Template must be a regular file: ${relativePath}`);
    }
    accessSync(source, constants.R_OK);
  } catch (error) {
    if (error?.message?.startsWith("Project initialization failed:")) throw error;
    fail(`Template must be readable: ${relativePath}`);
  }
}

const safetyEntries = readFileSync(join(templateRoot, ".gitignore"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const environmentSafetyEntries = [".env", ".env.*", "!.env.example"];
if (!environmentSafetyEntries.every((entry) => safetyEntries.includes(entry))) {
  fail("Project .gitignore template must contain the complete environment policy");
}
const simpleSafetyEntries = safetyEntries.filter(
  (entry) => !environmentSafetyEntries.includes(entry)
);

// Existing managed paths and the order-sensitive ignore policy are preflighted
// before the first write, so review-required state never leaves partial seeds.
if (targetExisted) {
  for (const relativePath of [...seedFiles, ".gitignore"]) {
    const destination = join(canonicalTarget, ...relativePath.split("/"));
    if (!entryExists(destination)) continue;
    const stat = lstatSync(destination);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      fail(`Managed project path must be a real file: ${destination}`);
    }
    try {
      accessSync(destination, constants.R_OK);
    } catch {
      fail(`Managed project path must be readable: ${destination}`);
    }
  }
}

const gitignorePath = join(canonicalTarget, ".gitignore");
let plannedGitignoreOriginal = null;
let plannedGitignoreAdditions = [...safetyEntries];
if (targetExisted && entryExists(gitignorePath)) {
  plannedGitignoreOriginal = readFileSync(gitignorePath);
  const presentEntries = plannedGitignoreOriginal
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const presentEntrySet = new Set(presentEntries);
  const presentEnvironmentEntries = presentEntries.filter((entry) =>
    entry.includes(".env")
  );
  if (presentEnvironmentEntries.length) {
    const hasCanonicalEnvironmentPolicy =
      presentEnvironmentEntries.length === environmentSafetyEntries.length &&
      presentEnvironmentEntries.every(
        (entry, index) => entry === environmentSafetyEntries[index]
      );
    if (!hasCanonicalEnvironmentPolicy) {
      fail(
        "Existing .gitignore environment rules require manual review before " +
          `initialization: ${presentEnvironmentEntries.join(", ")}`
      );
    }
    plannedGitignoreAdditions = simpleSafetyEntries.filter(
      (entry) => !presentEntrySet.has(entry)
    );
  } else {
    plannedGitignoreAdditions = safetyEntries.filter(
      (entry) => !presentEntrySet.has(entry)
    );
  }
}

const createdFiles = [];
const createdDirectories = [];
const preservedFiles = [];
const transactions = [];
let createdTarget = null;
let gitignoreBackup = null;
let gitignoreTransaction = null;
let gitignoreAdded = [];

function fileIdentity(path) {
  const stat = lstatSync(path, { bigint: true });
  return { dev: stat.dev, ino: stat.ino, birthtimeNs: stat.birthtimeNs };
}

function isOwnedFile(transaction, path) {
  if (!transaction.identity || !entryExists(path)) return false;
  try {
    const identity = fileIdentity(path);
    return (
      identity.dev === transaction.identity.dev &&
      identity.ino === transaction.identity.ino &&
      identity.birthtimeNs === transaction.identity.birthtimeNs &&
      readFileSync(path).equals(transaction.expectedContents)
    );
  } catch {
    return false;
  }
}

function restoreNoClobber(source, destination, warnings, label) {
  if (entryExists(destination)) {
    warnings.push(`${label} preserved at ${source}; ${destination} is occupied`);
    return false;
  }

  let stat;
  try {
    stat = lstatSync(source);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      warnings.push(`${label} missing from ${source}; recovery is not available`);
    } else {
      warnings.push(`${label} could not be inspected at ${source}: ${error.message}`);
    }
    return false;
  }

  try {
    if (stat.isFile()) {
      copyFileSync(source, destination, constants.COPYFILE_EXCL);
    } else if (stat.isSymbolicLink()) {
      symlinkSync(readlinkSync(source), destination);
    } else {
      const entryType = stat.isDirectory() ? "directory" : "unsupported entry type";
      warnings.push(
        `${label} preserved at ${source}; ${entryType} requires manual recovery`
      );
      return false;
    }
    try {
      unlinkSync(source);
    } catch (error) {
      warnings.push(`${label} also remains at ${source}: ${error.message}`);
    }
    return true;
  } catch (error) {
    warnings.push(`${label} preserved at ${source}: ${error.message}`);
    return false;
  }
}

function rollback() {
  const warnings = [];
  for (const transaction of [...transactions].reverse()) {
    if (transaction.identity && entryExists(transaction.destination)) {
      const quarantine =
        `${transaction.destination}.rollback-${process.pid}-${randomUUID()}`;
      try {
        // Rename first so identity/content cannot change between verification
        // and removal. Unknown content is copied back without clobbering.
        renameSync(transaction.destination, quarantine);
        if (isOwnedFile(transaction, quarantine)) {
          unlinkSync(quarantine);
        } else {
          warnings.push(`${transaction.destination} changed concurrently`);
          restoreNoClobber(
            quarantine,
            transaction.destination,
            warnings,
            "concurrent entry"
          );
        }
      } catch (error) {
        if (error?.code !== "ENOENT") {
          warnings.push(
            `could not quarantine ${transaction.destination}: ${error.message}`
          );
        }
      }
    } else if (transaction.writeCompleted && entryExists(transaction.destination)) {
      warnings.push(
        `${transaction.destination} was written but ownership could not be verified`
      );
    }

    if (transaction.backupPath) {
      restoreNoClobber(
        transaction.backupPath,
        transaction.destination,
        warnings,
        "original"
      );
    }
  }
  transactions.length = 0;

  // Node does not expose a portable atomic "remove this directory only if it
  // is still the same directory" operation. Never delete a directory during
  // rollback: even an identity check followed by rmdir has a replacement race.
  for (const path of [...createdDirectories].reverse()) {
    if (entryExists(path)) {
      warnings.push(
        `${path} was not removed during rollback; review directory cleanup manually`
      );
    }
  }
  createdDirectories.length = 0;
  if (createdTarget && entryExists(createdTarget)) {
    warnings.push(
      `${createdTarget} was not removed during rollback; review target cleanup manually`
    );
  }
  createdTarget = null;

  if (warnings.length) {
    console.error("\nRollback requires attention:");
    for (const warning of warnings) console.error(`- ${warning}`);
  }
}

function copyTrackedFile(source, destination) {
  const transaction = {
    destination,
    expectedContents: readFileSync(source),
    backupPath: null,
    identity: null,
    writeCompleted: false
  };
  transactions.push(transaction);
  copyFileSync(source, destination, constants.COPYFILE_EXCL);
  transaction.writeCompleted = true;
  transaction.identity = fileIdentity(destination);
  createdFiles.push(destination);
}

function ensureDirectory(path) {
  if (entryExists(path)) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Managed parent must be a real directory: ${path}`);
    }
    return;
  }
  mkdirSync(path);
  createdDirectories.push(path);
}

try {
  if (!targetExisted) {
    mkdirSync(canonicalTarget);
    createdTarget = canonicalTarget;
  }

  for (const relativePath of seedFiles) {
    const parts = relativePath.split("/");
    let parent = canonicalTarget;
    for (const part of parts.slice(0, -1)) {
      parent = join(parent, part);
      ensureDirectory(parent);
    }
    const destination = join(canonicalTarget, ...parts);
    if (entryExists(destination)) {
      preservedFiles.push(relativePath);
      continue;
    }
    copyTrackedFile(join(templateRoot, ...parts), destination);
  }

  if (!entryExists(gitignorePath)) {
    if (plannedGitignoreOriginal !== null) {
      throw new Error(`${gitignorePath} disappeared during initialization`);
    }
    copyTrackedFile(join(templateRoot, ".gitignore"), gitignorePath);
    gitignoreAdded = [...safetyEntries];
  } else {
    if (plannedGitignoreOriginal === null) {
      throw new Error(`${gitignorePath} appeared during initialization; rerun`);
    }
    preservedFiles.push(".gitignore");
    const currentStat = lstatSync(gitignorePath);
    if (currentStat.isSymbolicLink() || !currentStat.isFile()) {
      throw new Error(`Managed project path must be a real file: ${gitignorePath}`);
    }
    gitignoreAdded = [...plannedGitignoreAdditions];
    if (gitignoreAdded.length) {
      const current = readFileSync(gitignorePath);
      if (!current.equals(plannedGitignoreOriginal)) {
        throw new Error(`${gitignorePath} changed during initialization`);
      }
      gitignoreBackup = join(
        canonicalTarget,
        `.gitignore.machine-bootstrap-${process.pid}-${randomUUID()}.backup`
      );
      const originalText = plannedGitignoreOriginal.toString("utf8");
      const newline = originalText.includes("\r\n") ? "\r\n" : "\n";
      const separator =
        originalText.length && !originalText.endsWith("\n") ? newline : "";
      const addition =
        `${separator}${newline}# Added by machine-bootstrap project initializer${newline}` +
        `${gitignoreAdded.join(newline)}${newline}`;
      const updatedContents = Buffer.from(originalText + addition, "utf8");
      gitignoreTransaction = {
        destination: gitignorePath,
        expectedContents: updatedContents,
        backupPath: gitignoreBackup,
        identity: null,
        writeCompleted: false
      };
      transactions.push(gitignoreTransaction);
      renameSync(gitignorePath, gitignoreBackup);
      writeFileSync(gitignorePath, updatedContents, {
        encoding: "utf8",
        flag: "wx"
      });
      gitignoreTransaction.writeCompleted = true;
      gitignoreTransaction.identity = fileIdentity(gitignorePath);
    }
  }

  const placeholderFiles = [...seedFiles, ".gitignore"];
  let placeholderCount = 0;
  for (const relativePath of placeholderFiles) {
    const path = join(canonicalTarget, ...relativePath.split("/"));
    if (!entryExists(path)) continue;
    const contents = readFileSync(path, "utf8");
    placeholderCount += contents.match(/\bTODO\b|<Project>/g)?.length ?? 0;
  }

  if (gitignoreBackup) {
    try {
      unlinkSync(gitignoreBackup);
    } catch (error) {
      console.error(
        `Project initialization warning: .gitignore backup remains at ` +
          `${gitignoreBackup}: ${error.message}`
      );
    }
    if (gitignoreTransaction) gitignoreTransaction.backupPath = null;
    gitignoreBackup = null;
  }
  transactions.length = 0;

  console.log(`\nProject initialized: ${canonicalTarget}`);
  console.log(
    `Repository root: ${gitRoot ?? `${canonicalTarget} (Git not initialized)`}`
  );
  const created = createdFiles.map((path) => relative(canonicalTarget, path));
  console.log(`Created: ${created.length ? created.join(", ") : "none"}`);
  console.log(
    `Preserved: ${preservedFiles.length ? preservedFiles.join(", ") : "none"}`
  );
  console.log(
    `.gitignore entries added: ${gitignoreAdded.length ? gitignoreAdded.join(", ") : "none"}`
  );
  console.log(`Remaining template placeholders: ${placeholderCount}`);
  console.log(
    "Start a new Codex or Claude session in this project before normal project work."
  );
} catch (error) {
  rollback();
  fail(error instanceof Error ? error.message : String(error));
}
