#!/usr/bin/env node

import {
  accessSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir, tmpdir } from "node:os";
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
  if (entryExists(path)) {
    try {
      return realpathSync.native(path);
    } catch {
      fail(`Target must resolve to an existing directory: ${path}`);
    }
  }
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

const managedDirectoryAnchors = new Map();
const managedFileAnchors = new Map();
try {
  pinManagedDirectory(
    targetExisted ? canonicalTarget : dirname(canonicalTarget)
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

function gitProbe(path) {
  return spawnSync("git", ["-C", path, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    env: { ...process.env, LANG: "C", LC_ALL: "C" },
    shell: false
  });
}

function withGitignoreAdditions(original, additions) {
  if (!additions.length) return original;
  const originalText = original.toString("utf8");
  const newline = originalText.includes("\r\n") ? "\r\n" : "\n";
  const separator = originalText.length && !originalText.endsWith("\n")
    ? newline
    : "";
  const addition =
    `${separator}${newline}# Added by machine-bootstrap project initializer${newline}` +
    `${additions.join(newline)}${newline}`;
  return Buffer.from(originalText + addition, "utf8");
}

function environmentPolicyProblem(contents) {
  const probeRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-gitignore-"));
  try {
    writeFileSync(join(probeRoot, ".gitignore"), contents);
    const environment = {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      HOME: probeRoot,
      USERPROFILE: probeRoot,
      XDG_CONFIG_HOME: probeRoot,
      LANG: "C",
      LC_ALL: "C"
    };
    for (const name of ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"]) {
      delete environment[name];
    }
    const initialized = spawnSync("git", ["init", "-q"], {
      cwd: probeRoot,
      encoding: "utf8",
      env: environment,
      shell: false
    });
    if (initialized.error) return initialized.error.message;
    if (initialized.status !== 0) {
      return `Git could not evaluate the environment rules: ${initialized.stderr.trim()}`;
    }

    for (const [path, shouldBeIgnored] of [
      [".env", true],
      [".env.local", true],
      [".env.production", true],
      [".env.development", true],
      [".env.test", true],
      [".env.staging", true],
      [".env.preview", true],
      [".env.ci", true],
      [".env.example", false]
    ]) {
      const checked = spawnSync(
        "git",
        ["check-ignore", "--quiet", "--no-index", "--", path],
        {
          cwd: probeRoot,
          encoding: "utf8",
          env: environment,
          shell: false
        }
      );
      if (checked.error) return checked.error.message;
      if (checked.status !== 0 && checked.status !== 1) {
        return `Git could not evaluate ${path}: ${checked.stderr.trim()}`;
      }
      const ignored = checked.status === 0;
      if (ignored !== shouldBeIgnored) {
        return shouldBeIgnored
          ? `${path} is not ignored by the resulting policy`
          : `${path} remains ignored by the resulting policy`;
      }
    }
    return null;
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
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
    try {
      preflightManagedParentChain(destination);
      if (entryExists(destination)) {
        managedFileAnchors.set(destination, readManagedFileSnapshot(destination));
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  }
}

const gitignorePath = join(canonicalTarget, ".gitignore");
let plannedGitignoreOriginal = null;
let plannedGitignoreAdditions = [...safetyEntries];
let plannedGitignoreContents = readFileSync(join(templateRoot, ".gitignore"));
if (targetExisted && entryExists(gitignorePath)) {
  try {
    plannedGitignoreOriginal = managedFileAnchors.get(gitignorePath)?.contents;
    if (!plannedGitignoreOriginal) {
      throw new Error(`${gitignorePath} appeared during initialization; rerun`);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
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
  plannedGitignoreContents = withGitignoreAdditions(
    plannedGitignoreOriginal,
    plannedGitignoreAdditions
  );
}
const environmentProblem = environmentPolicyProblem(plannedGitignoreContents);
if (environmentProblem) {
  fail(
    "Existing .gitignore environment rules require manual review before " +
      `initialization: ${environmentProblem}`
  );
}

const createdFiles = [];
const createdDirectories = [];
const preservedFiles = [];
const transactions = [];
let createdTarget = null;
let gitignoreBackup = null;
let gitignoreBackupIdentity = null;
let gitignoreTransaction = null;
let gitignoreAdded = [];

function fileIdentity(path) {
  const stat = lstatSync(path, { bigint: true });
  return identityFromStat(stat);
}

function identityFromStat(stat) {
  return { dev: stat.dev, ino: stat.ino, birthtimeNs: stat.birthtimeNs };
}

function sameFileIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

function sameCanonicalPath(left, right) {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function pinManagedDirectorySnapshot(
  path,
  stat,
  canonical,
  expectedIdentity = null
) {
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Managed parent must be a real directory: ${path}`);
  }
  const candidate = {
    canonical,
    identity: identityFromStat(stat)
  };
  const existing = managedDirectoryAnchors.get(path);
  if (
    !sameCanonicalPath(canonical, path) ||
    (expectedIdentity &&
      !sameFileIdentity(expectedIdentity, candidate.identity)) ||
    (existing &&
      (existing.canonical !== candidate.canonical ||
        !sameFileIdentity(existing.identity, candidate.identity)))
  ) {
    throw new Error(`Managed parent changed during initialization: ${path}`);
  }
  if (!existing) managedDirectoryAnchors.set(path, candidate);
  return existing ?? candidate;
}

function pinManagedDirectory(path) {
  return pinManagedDirectorySnapshot(
    path,
    lstatSync(path, { bigint: true }),
    realpathSync.native(path)
  );
}

function preflightManagedParentChain(filePath) {
  const parentPath = dirname(filePath);
  if (parentPath === canonicalTarget) return;
  if (!isInside(canonicalTarget, parentPath)) {
    throw new Error(`Managed parent must stay inside target: ${parentPath}`);
  }

  let current = canonicalTarget;
  for (const part of relative(canonicalTarget, parentPath).split(sep)) {
    const next = join(current, part);
    let missing = false;
    if (!managedDirectoryAnchors.has(next)) {
      withAnchoredDirectory(current, () => {
        if (!entryExists(part)) {
          missing = true;
          return;
        }
        pinManagedDirectorySnapshot(
          next,
          lstatSync(part, { bigint: true }),
          realpathSync.native(part)
        );
      });
    }
    if (missing) return;
    current = next;
  }
}

// Changing into a verified directory gives each leaf operation a stable
// directory handle. A concurrent pathname replacement can no longer redirect
// that operation through a new symlink. The expected identity is pinned for the
// entire run rather than relearned on each call. Recheck after chdir so a
// replacement that won the race before anchoring fails before any leaf opens.
function withAnchoredDirectory(path, operation) {
  const expected = managedDirectoryAnchors.get(path);
  if (!expected) {
    throw new Error(`Managed parent was not pinned before use: ${path}`);
  }
  const currentStat = lstatSync(path, { bigint: true });
  if (currentStat.isSymbolicLink() || !currentStat.isDirectory()) {
    throw new Error(`Managed parent must be a real directory: ${path}`);
  }
  const currentCanonical = realpathSync.native(path);
  if (
    !sameCanonicalPath(currentCanonical, expected.canonical) ||
    !sameFileIdentity(identityFromStat(currentStat), expected.identity)
  ) {
    throw new Error(`Managed parent changed during initialization: ${path}`);
  }
  const previousDirectory = process.cwd();
  process.chdir(path);
  try {
    const anchoredStat = lstatSync(".", { bigint: true });
    const anchoredCanonical = realpathSync.native(".");
    if (
      !sameFileIdentity(identityFromStat(anchoredStat), expected.identity) ||
      !sameCanonicalPath(anchoredCanonical, expected.canonical)
    ) {
      throw new Error(`Managed parent changed during initialization: ${path}`);
    }
    return operation();
  } finally {
    process.chdir(previousDirectory);
  }
}

function regularLeafSnapshot(leaf, displayPath) {
  const before = lstatSync(leaf, { bigint: true });
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`Managed project path must be a real file: ${displayPath}`);
  }

  let descriptor;
  try {
    descriptor = openSync(
      leaf,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    );
    const opened = fstatSync(descriptor, { bigint: true });
    if (
      !opened.isFile() ||
      !sameFileIdentity(identityFromStat(opened), identityFromStat(before))
    ) {
      throw new Error(
        `Managed project path changed during initialization: ${displayPath}`
      );
    }
    return {
      contents: readFileSync(descriptor),
      identity: identityFromStat(opened)
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Managed project path")
    ) {
      throw error;
    }
    throw new Error(`Managed project path must be readable: ${displayPath}`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readRegularLeaf(leaf, displayPath) {
  return regularLeafSnapshot(leaf, displayPath).contents;
}

function readManagedFile(path) {
  return readManagedFileSnapshot(path).contents;
}

function readManagedFileSnapshot(path) {
  return withAnchoredDirectory(dirname(path), () =>
    regularLeafSnapshot(basename(path), path)
  );
}

function assertManagedFileSnapshot(path, expected) {
  const current = readManagedFileSnapshot(path);
  if (
    !sameFileIdentity(current.identity, expected.identity) ||
    !current.contents.equals(expected.contents)
  ) {
    throw new Error(`${path} changed during initialization`);
  }
  return current.contents;
}

function isOwnedFile(transaction, path) {
  if (!transaction.identity || !entryExists(path)) return false;
  try {
    const snapshot = regularLeafSnapshot(path, transaction.destination);
    return (
      sameFileIdentity(snapshot.identity, transaction.identity) &&
      snapshot.contents.equals(transaction.expectedContents)
    );
  } catch {
    return false;
  }
}

function assertOwnedFile(transaction) {
  return withAnchoredDirectory(dirname(transaction.destination), () => {
    const snapshot = regularLeafSnapshot(
      basename(transaction.destination),
      transaction.destination
    );
    if (
      !transaction.identity ||
      !sameFileIdentity(snapshot.identity, transaction.identity) ||
      !snapshot.contents.equals(transaction.expectedContents)
    ) {
      throw new Error(
        `${transaction.destination} changed during initialization`
      );
    }
    return snapshot.contents;
  });
}

function restoreNoClobberHere(source, destination, warnings, label) {
  const sourceLeaf = basename(source);
  const destinationLeaf = basename(destination);
  if (entryExists(destinationLeaf)) {
    warnings.push(`${label} preserved at ${source}; ${destination} is occupied`);
    return false;
  }

  let stat;
  try {
    stat = lstatSync(sourceLeaf, { bigint: true });
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
      const snapshot = regularLeafSnapshot(sourceLeaf, source);
      if (!sameFileIdentity(snapshot.identity, identityFromStat(stat))) {
        throw new Error("source changed during recovery");
      }
      let descriptor;
      try {
        descriptor = openSync(
          destinationLeaf,
          constants.O_CREAT |
            constants.O_EXCL |
            constants.O_WRONLY |
            (constants.O_NOFOLLOW ?? 0),
          0o666
        );
        writeFileSync(descriptor, snapshot.contents);
      } finally {
        if (descriptor !== undefined) closeSync(descriptor);
      }
    } else if (stat.isSymbolicLink()) {
      symlinkSync(readlinkSync(sourceLeaf), destinationLeaf);
    } else {
      const entryType = stat.isDirectory()
        ? "directory"
        : "unsupported entry type";
      warnings.push(
        `${label} preserved at ${source}; ${entryType} requires manual recovery`
      );
      return false;
    }
    warnings.push(`${label} also remains at ${source}; delete after review`);
    return true;
  } catch (error) {
    warnings.push(`${label} preserved at ${source}: ${error.message}`);
    return false;
  }
}

function restoreTrackedBackup(transaction, warnings) {
  const source = transaction.backupPath;
  const destination = transaction.destination;
  if (
    !source ||
    !transaction.backupIdentity ||
    !Buffer.isBuffer(transaction.backupContents) ||
    dirname(source) !== dirname(destination)
  ) {
    warnings.push(`original backup requires manual recovery at ${source}`);
    return false;
  }

  try {
    return withAnchoredDirectory(dirname(destination), () => {
      const sourceLeaf = basename(source);
      const destinationLeaf = basename(destination);
      if (entryExists(destinationLeaf)) {
        warnings.push(
          `original preserved at ${source}; ${destination} is occupied`
        );
        return false;
      }

      const backup = regularLeafSnapshot(sourceLeaf, source);
      if (
        !sameFileIdentity(backup.identity, transaction.backupIdentity) ||
        !backup.contents.equals(transaction.backupContents)
      ) {
        warnings.push(
          `original backup changed concurrently at ${source}; manual recovery required`
        );
        return false;
      }

      let descriptor;
      try {
        descriptor = openSync(
          destinationLeaf,
          constants.O_CREAT |
            constants.O_EXCL |
            constants.O_WRONLY |
            (constants.O_NOFOLLOW ?? 0),
          0o666
        );
        writeFileSync(descriptor, backup.contents);
      } finally {
        if (descriptor !== undefined) closeSync(descriptor);
      }
      warnings.push(`original restored; backup retained at ${source}`);
      return true;
    });
  } catch (error) {
    warnings.push(`original backup preserved at ${source}: ${error.message}`);
    return false;
  }
}

function rollback() {
  const warnings = [];
  for (const transaction of [...transactions].reverse()) {
    try {
      withAnchoredDirectory(dirname(transaction.destination), () => {
        const destinationLeaf = basename(transaction.destination);
        if (transaction.identity && entryExists(destinationLeaf)) {
          const currentIdentity = fileIdentity(destinationLeaf);
          if (!sameFileIdentity(currentIdentity, transaction.identity)) {
            warnings.push(
              `${transaction.destination} changed concurrently and was preserved in place`
            );
            return;
          }
          const quarantine =
            `${transaction.destination}.rollback-${process.pid}-${randomUUID()}`;
          const quarantineLeaf = basename(quarantine);
          // Rename inside the anchored parent, then preserve the quarantine.
          // Node cannot atomically couple a content check with pathname removal,
          // so even a verified run-owned file remains recoverable for review.
          renameSync(destinationLeaf, quarantineLeaf);
          if (isOwnedFile(transaction, quarantineLeaf)) {
            warnings.push(
              `run-owned entry preserved at ${quarantine}; delete after review`
            );
          } else {
            warnings.push(`${transaction.destination} changed concurrently`);
            restoreNoClobberHere(
              quarantine,
              transaction.destination,
              warnings,
              "concurrent entry"
            );
          }
        } else if (transaction.writeCompleted && entryExists(destinationLeaf)) {
          warnings.push(
            `${transaction.destination} was written but ownership could not be verified`
          );
        }
      });
    } catch (error) {
      warnings.push(
        `could not inspect ${transaction.destination}: ${error.message}`
      );
    }

    if (transaction.backupPath) {
      restoreTrackedBackup(transaction, warnings);
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
  withAnchoredDirectory(dirname(destination), () => {
    const leaf = basename(destination);
    let descriptor;
    try {
      descriptor = openSync(
        leaf,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          (constants.O_NOFOLLOW ?? 0),
        0o666
      );
      transaction.identity = identityFromStat(
        fstatSync(descriptor, { bigint: true })
      );
      transaction.writeCompleted = true;
      writeFileSync(descriptor, transaction.expectedContents);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  });
  createdFiles.push(destination);
}

function createAndPinManagedDirectory(path) {
  withAnchoredDirectory(dirname(path), () => {
    const leaf = basename(path);
    if (entryExists(leaf)) {
      throw new Error(`Managed parent appeared during initialization: ${path}`);
    }

    // Create under an unpredictable private name so this run can capture the
    // directory identity before publishing it at the managed path. The rename
    // and post-rename identity check keep a replaced staging entry from being
    // learned as a trusted parent.
    const stagingLeaf =
      `.${leaf}.machine-bootstrap-${process.pid}-${randomUUID()}.directory`;
    const stagingPath = join(dirname(path), stagingLeaf);
    mkdirSync(stagingLeaf);
    createdDirectories.push(stagingPath);
    const stagingStat = lstatSync(stagingLeaf, { bigint: true });
    if (stagingStat.isSymbolicLink() || !stagingStat.isDirectory()) {
      throw new Error(`Managed parent must be a real directory: ${path}`);
    }
    const stagingIdentity = identityFromStat(stagingStat);
    if (entryExists(leaf)) {
      throw new Error(`Managed parent appeared during initialization: ${path}`);
    }
    renameSync(stagingLeaf, leaf);
    createdDirectories[createdDirectories.length - 1] = path;
    pinManagedDirectorySnapshot(
      path,
      lstatSync(leaf, { bigint: true }),
      realpathSync.native(leaf),
      stagingIdentity
    );
  });
}

function ensureDirectory(path) {
  if (managedDirectoryAnchors.has(path)) {
    withAnchoredDirectory(path, () => {});
    return;
  }
  // Existing parents were pinned during the no-write preflight. An unpinned
  // entry here appeared after that snapshot and must never be learned as ours.
  createAndPinManagedDirectory(path);
}

try {
  if (!targetExisted) {
    createAndPinManagedDirectory(canonicalTarget);
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
      const expected = managedFileAnchors.get(destination);
      if (!expected) {
        throw new Error(`${destination} appeared during initialization; rerun`);
      }
      assertManagedFileSnapshot(destination, expected);
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
    gitignoreAdded = [...plannedGitignoreAdditions];
    if (gitignoreAdded.length) {
      gitignoreBackup = join(
        canonicalTarget,
        `.gitignore.machine-bootstrap-${process.pid}-${randomUUID()}.backup`
      );
      const updatedContents = plannedGitignoreContents;
      gitignoreTransaction = {
        destination: gitignorePath,
        expectedContents: updatedContents,
        backupPath: gitignoreBackup,
        backupContents: plannedGitignoreOriginal,
        backupIdentity: null,
        identity: null,
        writeCompleted: false
      };
      withAnchoredDirectory(canonicalTarget, () => {
        const current = regularLeafSnapshot(
          basename(gitignorePath),
          gitignorePath
        );
        if (!current.contents.equals(plannedGitignoreOriginal)) {
          throw new Error(`${gitignorePath} changed during initialization`);
        }
        const plannedGitignoreSnapshot = managedFileAnchors.get(gitignorePath);
        if (
          !plannedGitignoreSnapshot ||
          !sameFileIdentity(current.identity, plannedGitignoreSnapshot.identity)
        ) {
          throw new Error(`${gitignorePath} changed during initialization`);
        }
        transactions.push(gitignoreTransaction);
        renameSync(basename(gitignorePath), basename(gitignoreBackup));
        if (
          !sameFileIdentity(
            fileIdentity(basename(gitignoreBackup)),
            current.identity
          )
        ) {
          throw new Error(`${gitignoreBackup} changed during initialization`);
        }
        gitignoreBackupIdentity = current.identity;
        gitignoreTransaction.backupIdentity = current.identity;
        managedFileAnchors.delete(gitignorePath);
        let descriptor;
        try {
          descriptor = openSync(
            basename(gitignorePath),
            constants.O_CREAT |
              constants.O_EXCL |
              constants.O_WRONLY |
              (constants.O_NOFOLLOW ?? 0),
            0o666
          );
          gitignoreTransaction.identity = identityFromStat(
            fstatSync(descriptor, { bigint: true })
          );
          gitignoreTransaction.writeCompleted = true;
          writeFileSync(descriptor, updatedContents);
        } finally {
          if (descriptor !== undefined) closeSync(descriptor);
        }
      });
    }
  }

  const placeholderFiles = [...seedFiles, ".gitignore"];
  let placeholderCount = 0;
  for (const relativePath of placeholderFiles) {
    const path = join(canonicalTarget, ...relativePath.split("/"));
    if (!entryExists(path)) continue;
    const contents = readManagedFile(path).toString("utf8");
    placeholderCount += contents.match(/\bTODO\b|<Project>/g)?.length ?? 0;
  }

  const finalGitignore = readManagedFile(gitignorePath);
  const expectedGitignore =
    plannedGitignoreOriginal === null || gitignoreAdded.length
      ? plannedGitignoreContents
      : plannedGitignoreOriginal;
  if (!finalGitignore.equals(expectedGitignore)) {
    throw new Error(`${gitignorePath} changed during initialization`);
  }
  const finalEnvironmentProblem = environmentPolicyProblem(finalGitignore);
  if (finalEnvironmentProblem) {
    throw new Error(
      `${gitignorePath} environment policy changed during initialization: ` +
        finalEnvironmentProblem
    );
  }

  if (gitignoreBackup) {
    try {
      withAnchoredDirectory(canonicalTarget, () => {
        const backupLeaf = basename(gitignoreBackup);
        if (!gitignoreBackupIdentity || !entryExists(backupLeaf)) {
          throw new Error("backup changed concurrently");
        }
        const backup = regularLeafSnapshot(backupLeaf, gitignoreBackup);
        if (
          !sameFileIdentity(backup.identity, gitignoreBackupIdentity) ||
          !backup.contents.equals(plannedGitignoreOriginal)
        ) {
          throw new Error("backup changed concurrently");
        }
      });
      console.log(`Recovery backup retained: ${gitignoreBackup}`);
    } catch (error) {
      console.error(
        `Project initialization warning: .gitignore backup remains at ` +
          `${gitignoreBackup}: ${error.message}`
      );
    }
  }
  for (const [path, expected] of managedFileAnchors) {
    assertManagedFileSnapshot(path, expected);
  }
  for (const transaction of transactions) assertOwnedFile(transaction);
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
