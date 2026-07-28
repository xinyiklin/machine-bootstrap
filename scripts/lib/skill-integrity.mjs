import {
  readdirSync,
  readFileSync,
  readlinkSync,
  statSync
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

function compareNamesByUtf8(left, right) {
  return Buffer.compare(Buffer.from(left.name, "utf8"), Buffer.from(right.name, "utf8"));
}

export function hashDirectory(root) {
  // The root is followed so a skill may be reached through a symlink; entries
  // inside are still recorded as links rather than as their targets.
  let rootStat;
  try {
    rootStat = statSync(root);
  } catch {
    throw new Error(`skill directory is missing: ${root}`);
  }
  if (!rootStat.isDirectory()) {
    throw new Error(`skill path is not a directory: ${root}`);
  }

  const hash = createHash("sha256");

  function visit(directory, relativeDirectory = "") {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort(compareNamesByUtf8);

    for (const entry of entries) {
      const relativePath = join(relativeDirectory, entry.name).replaceAll("\\", "/");
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        // A reviewed Git tree cannot carry an empty directory, so recording
        // only empty ones covers every entry without changing pinned hashes.
        if (visit(absolutePath, relativePath) === 0) {
          hash.update("emptydir\0");
          hash.update(relativePath);
          hash.update("\0");
        }
        continue;
      }

      if (entry.isFile()) {
        hash.update("file\0");
        hash.update(relativePath);
        hash.update("\0");
        hash.update(readFileSync(absolutePath));
        hash.update("\0");
        continue;
      }

      if (entry.isSymbolicLink()) {
        hash.update("link\0");
        hash.update(relativePath);
        hash.update("\0");
        hash.update(readlinkSync(absolutePath).replaceAll("\\", "/"));
        hash.update("\0");
        continue;
      }

      throw new Error(`unsupported entry in skill directory: ${absolutePath}`);
    }

    return entries.length;
  }

  visit(root);
  return hash.digest("hex");
}
