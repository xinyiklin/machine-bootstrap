#!/usr/bin/env node

// Read-only report of how one sibling project's seeded starter files relate to
// the canonical starters in this checkout, so a session in that project can
// adopt upstream improvements without overwriting project-owned content. It
// reads only the starter files named below, never follows symbolic links, and
// never writes.

import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = realpathSync.native(resolve(scriptDir, ".."));
const workspaceRoot = dirname(bootstrapRoot);

// The files scripts/init-project.mjs seeds; the suite keeps both lists equal.
const starterFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "docs/engineering/git-workflow.md",
  ".github/pull_request_template.md"
];

function fail(message) {
  console.error(`\nStarter diff failed: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
let target;
let since;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--since") {
    since = args[index + 1];
    index += 1;
    if (!since) fail("--since needs a machine-bootstrap revision");
  } else if (!target && !args[index].startsWith("-")) {
    target = args[index];
  } else {
    fail(`Unknown argument: ${args[index]}`);
  }
}
if (!target) {
  fail("Usage: node scripts/starter-diff.mjs <project> [--since <revision>]");
}

function comparablePath(path) {
  return process.platform === "win32" ? path.toLowerCase() : path;
}

// A project is a real directory directly inside the workspace, never this
// checkout, so the report cannot wander into an unrelated tree.
let projectRoot;
try {
  const requested = resolve(target);
  if (!lstatSync(requested).isDirectory()) throw new Error("not a directory");
  projectRoot = realpathSync.native(requested);
} catch {
  fail(`Project must be a real directory: ${target}`);
}
if (
  comparablePath(dirname(projectRoot)) !== comparablePath(workspaceRoot) ||
  comparablePath(projectRoot) === comparablePath(bootstrapRoot)
) {
  fail(`Project must be a sibling of machine-bootstrap inside ${workspaceRoot}`);
}

// Inherited repository overrides could point Git at another repository, and
// optional locks would let read-only commands refresh an index.
const gitEnvironment = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C"
};
for (const name of [
  "GIT_CEILING_DIRECTORIES",
  "GIT_DISCOVERY_ACROSS_FILESYSTEM",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_NAMESPACE"
]) {
  delete gitEnvironment[name];
}

function git(root, gitArgs) {
  const result = spawnSync("git", ["-C", root, ...gitArgs], {
    encoding: "utf8",
    env: gitEnvironment,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  if (result.error) fail(`git is required: ${result.error.message}`);
  return { ok: result.status === 0, stdout: result.stdout };
}

// Reads a regular file only when no component of its path is a link.
function readProjectFile(relativePath) {
  const path = join(projectRoot, ...relativePath.split("/"));
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return { state: "link" };
    if (!stat.isFile() || comparablePath(realpathSync.native(path)) !== comparablePath(path)) {
      return { state: "unreadable" };
    }
    return { state: "file", text: readFileSync(path, "utf8") };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return { state: "missing" };
    }
    return { state: "unreadable" };
  }
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

// The base is the starter revision the project was seeded or last synced from.
let base = null;
let baseSource = "";
if (since) {
  const verified = git(bootstrapRoot, ["rev-parse", "--verify", "--quiet", `${since}^{commit}`]);
  if (!verified.ok) fail(`Unknown machine-bootstrap revision: ${since}`);
  base = verified.stdout.trim();
  baseSource = `--since ${since}`;
} else {
  const added = git(projectRoot, [
    "log", "--diff-filter=A", "--format=%cI", "--", "AGENTS.md"
  ]);
  const seededAt = added.ok ? added.stdout.trim().split("\n").filter(Boolean).pop() : "";
  if (seededAt) {
    const starter = git(bootstrapRoot, [
      "rev-list", "-1", `--before=${seededAt}`, "HEAD", "--", "project-templates"
    ]);
    if (starter.ok && starter.stdout.trim()) {
      base = starter.stdout.trim();
      baseSource = `estimated from the project's first AGENTS.md commit (${seededAt})`;
    }
  }
}

const head = git(bootstrapRoot, ["rev-parse", "--short", "HEAD"]);
console.log(`Starter diff for ${parse(projectRoot).base}`);
console.log(`Current starters: machine-bootstrap ${head.ok ? head.stdout.trim() : "(unknown)"}`);
console.log(
  base
    ? `Base starters: ${base.slice(0, 12)}, ${baseSource}`
    : "Base starters: unknown; pass --since <revision> when the project records it"
);

// Current starters come from this checkout's HEAD, and every comparison is
// commit to commit, so Git never consults (or refreshes) a working-tree index.
const uncommitted = [];
for (const relativePath of starterFiles) {
  const templatePath = `project-templates/${relativePath}`;
  const committed = git(bootstrapRoot, ["show", `HEAD:${templatePath}`]);
  if (!committed.ok) fail(`HEAD has no ${templatePath}`);
  const current = normalize(committed.stdout);
  if (normalize(readFileSync(join(bootstrapRoot, ...templatePath.split("/")), "utf8")) !== current) {
    uncommitted.push(templatePath);
  }
  const project = readProjectFile(relativePath);
  const baseText = base ? git(bootstrapRoot, ["show", `${base}:${templatePath}`]) : null;

  let status;
  if (project.state === "missing") {
    status = "missing; scripts/init-project.mjs can add it";
  } else if (project.state === "link") {
    status = "is a symbolic link; not read";
  } else if (project.state === "unreadable") {
    status = "could not be read as a regular file";
  } else if (normalize(project.text) === current) {
    status = "matches the current starter";
  } else if (baseText?.ok && normalize(project.text) === normalize(baseText.stdout)) {
    status = "unchanged since its base; the current starter can replace it";
  } else {
    status = "customized; adopt upstream changes hunk by hunk";
  }
  console.log(`\n## ${relativePath}: ${status}`);

  if (project.state !== "file" || normalize(project.text) === current) continue;
  if (baseText?.ok) {
    const upstream = git(bootstrapRoot, [
      "diff", "--no-color", "--no-ext-diff", base, "HEAD", "--", templatePath
    ]);
    console.log(
      upstream.stdout.trim()
        ? `Upstream starter changes since the base:\n${upstream.stdout.trimEnd()}`
        : "No upstream starter changes since the base."
    );
  } else {
    // Without a base, project facts and upstream changes are mixed together.
    const twoWay = git(workspaceRoot, [
      "diff", "--no-index", "--no-color", "--no-ext-diff",
      `${parse(bootstrapRoot).base}/${templatePath}`,
      `${parse(projectRoot).base}/${relativePath}`
    ]);
    console.log(
      `${base ? "This starter did not exist at the base." : "No base."} ` +
      "Current starter versus the project file (project facts and upstream " +
      `changes are mixed):\n${twoWay.stdout.trimEnd()}`
    );
  }
}

if (uncommitted.length) {
  console.log(
    `\nNote: uncommitted edits to ${uncommitted.join(", ")} are not part of this ` +
      "report, which compares committed starters only."
  );
}

// .gitignore is merged rather than copied, so report only missing rules.
const starterIgnore = normalize(readFileSync(join(bootstrapRoot, "project-templates", ".gitignore"), "utf8"));
const projectIgnore = readProjectFile(".gitignore");
const present = new Set(
  projectIgnore.state === "file" ? normalize(projectIgnore.text).split("\n").map((line) => line.trim()) : []
);
const missingRules = starterIgnore
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && !present.has(line));
console.log(
  `\n## .gitignore: ${
    projectIgnore.state === "file" || projectIgnore.state === "missing"
      ? missingRules.length
        ? `missing starter rules: ${missingRules.join(", ")}`
        : "has every starter rule"
      : "could not be read as a regular file"
  }`
);
