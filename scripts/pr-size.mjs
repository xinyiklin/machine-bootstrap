#!/usr/bin/env node

// Counts a pull request's changed lines the way the Git contract does:
// additions plus deletions against the merge base, with renames detected and
// lockfiles, binary files, pure renames, and explicitly excluded generated
// paths reported separately. Read-only; it measures the repository in the
// current directory, so any project can run it.

import { spawnSync } from "node:child_process";

const usage =
  "Usage: node scripts/pr-size.mjs [<base>] [--fail-over <lines>] [--exclude <path>]...";

function fail(message) {
  console.error(`\nPR size failed: ${message}`);
  process.exit(2);
}

const lockfiles = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
  "poetry.lock",
  "uv.lock",
  "Pipfile.lock",
  "Gemfile.lock",
  "composer.lock",
  "go.sum",
  "Package.resolved",
  "flake.lock"
]);

const args = process.argv.slice(2);
let base = "origin/main";
let failOver = null;
const excluded = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--fail-over" || arg === "--exclude") {
    const value = args[index + 1];
    index += 1;
    if (!value) fail(`${arg} needs a value. ${usage}`);
    if (arg === "--exclude") {
      excluded.push(value.replaceAll("\\", "/"));
    } else {
      failOver = Number(value);
      if (!Number.isInteger(failOver) || failOver < 0) fail(`--fail-over needs a whole number`);
    }
  } else if (index === 0 && !arg.startsWith("-")) {
    base = arg;
  } else {
    fail(`Unknown argument: ${arg}. ${usage}`);
  }
}

function git(gitArgs) {
  const result = spawnSync("git", gitArgs, {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  if (result.error) fail(`git is required: ${result.error.message}`);
  if (result.status !== 0) fail(`git ${gitArgs[0]}: ${result.stderr.trim()}`);
  return result.stdout;
}

const mergeBase = git(["merge-base", base, "HEAD"]).trim();
// -z keeps unusual path names intact; a rename lists its old and new paths.
const fields = git(["diff", "-M", "--numstat", "-z", mergeBase, "HEAD"]).split("\0");

const counted = { additions: 0, deletions: 0, files: 0 };
const reported = [];
for (let index = 0; index < fields.length; ) {
  const head = fields[index];
  if (!head) {
    index += 1;
    continue;
  }
  // Split only the two count columns; a path may itself contain a tab.
  const firstTab = head.indexOf("\t");
  const secondTab = head.indexOf("\t", firstTab + 1);
  const added = head.slice(0, firstTab);
  const deleted = head.slice(firstTab + 1, secondTab);
  const inlinePath = head.slice(secondTab + 1);
  let path = inlinePath;
  let renamedFrom = null;
  if (inlinePath === "") {
    renamedFrom = fields[index + 1];
    path = fields[index + 2];
    index += 3;
  } else {
    index += 1;
  }

  const name = path.split("/").pop();
  let reason = null;
  if (added === "-" && deleted === "-") reason = "binary";
  else if (lockfiles.has(name)) reason = "lockfile";
  else if (excluded.some((entry) => path === entry || (entry.endsWith("/") && path.startsWith(entry)))) {
    reason = "excluded by --exclude";
  } else if (renamedFrom && added === "0" && deleted === "0") reason = "pure rename";

  if (reason) {
    reported.push(`${renamedFrom ? `${renamedFrom} → ` : ""}${path} (${reason})`);
    continue;
  }
  counted.additions += Number(added);
  counted.deletions += Number(deleted);
  counted.files += 1;
}

const total = counted.additions + counted.deletions;
const band =
  total <= 500
    ? "up to 500: normal target"
    : total <= 1000
      ? "501–1,000: explain in the PR body why the change stays together"
      : "over 1,000: split it, or record the fresh reviewer's documented exception";
console.log(
  `PR size against ${base} (merge base ${mergeBase.slice(0, 7)}): ${total} counted ` +
    `(+${counted.additions} −${counted.deletions} in ${counted.files} files)`
);
console.log(`Band: ${band}`);
if (reported.length) {
  console.log("Reported separately, not counted:");
  for (const line of reported) console.log(`- ${line}`);
}
if (failOver !== null && total > failOver) {
  console.error(`\n${total} counted lines exceed ${failOver}.`);
  process.exit(1);
}
