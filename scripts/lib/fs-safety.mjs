// One owner for the bootstrap's "never silently overwrite" placement rules,
// shared by workspace guidance setup and workflow installation.
//
// Symlinks are followed for comparison: what an agent loads at that path is the
// content that matters. Placement always renames an existing entry to a backup
// before writing a real file, so a link target is never written through.

import {
  accessSync,
  constants,
  copyFileSync,
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  statSync
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

const ignoredSnapshotNames = new Set([".DS_Store", "Thumbs.db"]);

export function entryExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    // ENOTDIR means a non-directory ancestor, so the entry cannot exist.
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw error;
  }
}

// Describes why a destination cannot be compared with its portable source, so
// a type mismatch or permission problem is not reported as content drift.
export function destinationProblem(destination, expectedKind) {
  if (!entryExists(destination)) return null;

  let stat;
  try {
    stat = statSync(destination);
  } catch {
    return "is a broken symbolic link";
  }

  if (expectedKind === "file" && !stat.isFile()) {
    return stat.isDirectory()
      ? "is a directory where a file belongs"
      : "is not a regular file";
  }
  if (expectedKind === "directory" && !stat.isDirectory()) {
    return stat.isFile()
      ? "is a file where a directory belongs"
      : "is not a directory";
  }

  try {
    accessSync(destination, constants.R_OK);
  } catch {
    return "is not readable";
  }
  return null;
}

export function sameContents(source, destination) {
  if (destinationProblem(destination, "file")) return false;
  return (
    entryExists(destination) &&
    readFileSync(source).equals(readFileSync(destination))
  );
}

export function isReadableRegularFile(path) {
  return entryExists(path) && !destinationProblem(path, "file");
}

function directorySnapshot(root, relativePath = "", snapshot = new Map()) {
  const directory = join(root, relativePath);
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !ignoredSnapshotNames.has(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const entryPath = join(relativePath, entry.name);
    if (entry.isDirectory()) {
      snapshot.set(`${entryPath}/`, null);
      directorySnapshot(root, entryPath, snapshot);
    } else if (entry.isFile()) {
      snapshot.set(entryPath, readFileSync(join(root, entryPath)));
    } else {
      snapshot.set(entryPath, false);
    }
  }

  return snapshot;
}

export function sameDirectory(source, destination) {
  if (destinationProblem(destination, "directory") || !entryExists(destination)) {
    return false;
  }

  let sourceSnapshot;
  let destinationSnapshot;
  try {
    sourceSnapshot = directorySnapshot(source);
    destinationSnapshot = directorySnapshot(destination);
  } catch {
    return false;
  }
  if (sourceSnapshot.size !== destinationSnapshot.size) return false;

  for (const [path, sourceContents] of sourceSnapshot) {
    if (!destinationSnapshot.has(path)) return false;
    const destinationContents = destinationSnapshot.get(path);
    if (sourceContents === null && destinationContents === null) continue;
    if (
      !Buffer.isBuffer(sourceContents) ||
      !Buffer.isBuffer(destinationContents) ||
      !sourceContents.equals(destinationContents)
    ) {
      return false;
    }
  }

  return true;
}

export function backupEntry(destination, log = console.log) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  // A per-process cryptographic suffix avoids the check-then-rename race that
  // could otherwise overwrite a concurrently created backup on POSIX.
  const backupPath =
    `${destination}.backup-${timestamp}-${process.pid}-${randomUUID()}`;
  renameSync(destination, backupPath);
  log(`Backed up ${destination} to ${backupPath}`);
  return backupPath;
}

// Places one portable source at its destination under the bootstrap's review
// rules. `failures` collects review-required conditions instead of throwing, so
// a caller can report every problem in one pass.
export function placeEntry(
  source,
  destination,
  kind,
  { checkOnly = false, replace = false, failures, log = console.log }
) {
  const current =
    kind === "file"
      ? sameContents(source, destination)
      : sameDirectory(source, destination);
  if (current) {
    log(`Current: ${destination}`);
    return;
  }

  const present = entryExists(destination);
  const problem = destinationProblem(destination, kind);

  if (checkOnly) {
    if (!present) failures.push(`${destination} is missing`);
    else if (problem) failures.push(`${destination} ${problem}`);
    else failures.push(`${destination} differs from its portable source`);
    return;
  }

  if (present && !replace) {
    failures.push(
      `${destination} ${problem ?? "differs"} (review, then use --replace)`
    );
    return;
  }

  if (present) backupEntry(destination, log);
  if (kind === "file") {
    mkdirSync(dirname(destination), { recursive: true });
    try {
      copyFileSync(source, destination, constants.COPYFILE_EXCL);
    } catch (error) {
      if (error?.code === "EEXIST") {
        failures.push(`${destination} appeared during setup; rerun`);
        return;
      }
      throw error;
    }
  } else {
    try {
      mkdirSync(destination);
    } catch (error) {
      if (error?.code === "EEXIST") {
        failures.push(`${destination} appeared during setup; rerun`);
        return;
      }
      throw error;
    }
    try {
      cpSync(source, destination, {
        recursive: true,
        errorOnExist: true,
        force: false,
        verbatimSymlinks: true
      });
    } catch (error) {
      // Another process may have added content after the atomic directory
      // claim. Remove only an empty directory; never recursively delete a
      // shared destination during failure cleanup.
      try {
        rmdirSync(destination);
      } catch (cleanupError) {
        if (
          cleanupError?.code !== "ENOENT" &&
          cleanupError?.code !== "ENOTEMPTY" &&
          cleanupError?.code !== "EEXIST"
        ) {
          throw cleanupError;
        }
      }
      throw error;
    }
  }
  log(`Placed ${destination}`);
}
