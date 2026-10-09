#!/usr/bin/env node

// Read-only report on the agent guidance of each sibling project. It reads only
// the guide and continuity files named below, never follows symbolic links,
// never reads MACHINE.md or project source, and never writes. Fixing a finding
// belongs to a session started in that project.

import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = realpathSync.native(resolve(scriptDir, ".."));
const workspaceRoot = dirname(bootstrapRoot);
const bootstrapName = parse(bootstrapRoot).base;

// Targets come from the project starter guidance and its continuity contract.
const KIB = 1024;
const agentsTarget = 8 * KIB;
const claudeTarget = 1.5 * KIB;
const chainLimit = 28 * KIB;
const continuityLineCap = 160;
const largestReadableFile = 16 * KIB * KIB;

function fail(message) {
  console.error(`\nWorkspace audit failed: ${message}`);
  process.exit(1);
}

const unknownArgs = process.argv.slice(2);
if (unknownArgs.length) fail(`Unknown argument(s): ${unknownArgs.join(", ")}`);
if (workspaceRoot === parse(workspaceRoot).root) {
  fail("Workspace root cannot be the filesystem root");
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
if (homeCandidates.includes(workspaceRoot)) {
  fail("Workspace root cannot be the user home");
}

// Inspects one named file without following a symbolic link. An unreadable
// entry becomes a finding rather than stopping the report.
function readGuide(path) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return { state: "missing" };
    return { state: "error", code: error?.code ?? "unknown" };
  }
  if (stat.isSymbolicLink()) return { state: "link" };
  if (!stat.isFile()) return { state: "other" };
  if (stat.size > largestReadableFile) return { state: "file", size: stat.size, text: null };

  let descriptor;
  try {
    // O_NOFOLLOW refuses a file swapped for a link after inspection.
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor);
    if (!opened.isFile()) return { state: "other" };
    return { state: "file", size: opened.size, text: readFileSync(descriptor, "utf8") };
  } catch (error) {
    return { state: "error", code: error?.code ?? "unknown" };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function kib(bytes) {
  return `${(bytes / KIB).toFixed(1)} KiB`;
}

function describeUnreadable(name, guide) {
  if (guide.state === "link") return `${name} is a symbolic link; not followed`;
  if (guide.state === "error") return `${name} could not be read (${guide.code})`;
  if (guide.state === "other") return `${name} is not a regular file`;
  return null;
}

function auditProject(name) {
  const root = join(workspaceRoot, name);
  const findings = [];
  const row = { name, git: "no", agents: "-", claude: "-", imports: "-", continuity: "-" };
  let todo = 0;

  try {
    lstatSync(join(root, ".git"));
    row.git = "yes";
  } catch {
    row.git = "no";
  }

  const agents = readGuide(join(root, "AGENTS.md"));
  const claude = readGuide(join(root, "CLAUDE.md"));
  let chainBytes = 0;

  for (const [label, guide] of [["AGENTS.md", agents], ["CLAUDE.md", claude]]) {
    const problem = describeUnreadable(label, guide);
    if (problem) findings.push(problem);
  }

  if (agents.state === "file") {
    row.agents = kib(agents.size);
    chainBytes += agents.size;
    if (agents.size > agentsTarget) {
      findings.push(`AGENTS.md is ${kib(agents.size)}, over the ${kib(agentsTarget)} target`);
    }
    todo += agents.text?.match(/\bTODO\b/g)?.length ?? 0;
  } else if (agents.state !== "missing") {
    row.agents = agents.state;
  }

  if (claude.state === "file") {
    row.claude = kib(claude.size);
    chainBytes += claude.size;
    if (claude.size > claudeTarget) {
      findings.push(`CLAUDE.md is ${kib(claude.size)}, over the ${kib(claudeTarget)} target`);
    }
    const text = claude.text ?? "";
    todo += text.match(/\bTODO\b/g)?.length ?? 0;
    const imports = text.match(/^@AGENTS\.md\s*$/gm)?.length ?? 0;
    row.imports = String(imports);
    if (agents.state !== "missing" && imports !== 1) {
      findings.push(
        `CLAUDE.md imports AGENTS.md ${imports} time(s); keep exactly one ` +
          "@AGENTS.md line, because a CLAUDE.md stops Claude reading AGENTS.md on its own"
      );
    }
  } else if (claude.state !== "missing") {
    row.claude = claude.state;
  } else if (agents.state !== "missing") {
    findings.push(
      "no CLAUDE.md: Claude Code 2.1.277+ reads AGENTS.md natively; add the " +
        "starter CLAUDE.md for sessions that cannot"
    );
  } else {
    findings.push("no AGENTS.md or CLAUDE.md");
  }

  if (chainBytes >= chainLimit) {
    findings.push(`root guides total ${kib(chainBytes)}, at or over the ${kib(chainLimit)} chain limit`);
  }
  if (todo > 0) findings.push(`${todo} TODO marker(s) in root guides`);

  const continuity = readGuide(join(root, "CONTINUITY.md"));
  const continuityProblem = describeUnreadable("CONTINUITY.md", continuity);
  if (continuityProblem) {
    findings.push(continuityProblem);
    row.continuity = continuity.state;
  } else if (continuity.state === "file") {
    const text = continuity.text;
    const lines = text === null ? null : text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0);
    row.continuity = lines === null ? kib(continuity.size) : `${lines} lines`;
    if (lines === null || lines > continuityLineCap) {
      findings.push(
        `CONTINUITY.md is ${row.continuity} (${kib(continuity.size)}), over the ` +
          `default ${continuityLineCap}-line cap; rotate resolved entries to ` +
          "docs/continuity/YYYY-MM.md"
      );
    }
  }

  return { row, findings };
}

const projects = readdirSync(workspaceRoot, { withFileTypes: true })
  .filter((entry) =>
    entry.isDirectory() &&
    !entry.name.startsWith(".") &&
    entry.name !== bootstrapName &&
    entry.name !== "scratch"
  )
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

console.log(`Workspace: ${workspaceRoot}`);
console.log(
  `Targets: AGENTS.md ≤ ${kib(agentsTarget)}, CLAUDE.md ≤ ${kib(claudeTarget)}, ` +
    `root guides < ${kib(chainLimit)}, CONTINUITY.md ≤ ${continuityLineCap} lines.\n`
);

const results = projects.map(auditProject);
const header = ["project", "git", "AGENTS.md", "CLAUDE.md", "@imports", "CONTINUITY.md"];
const rows = results.map(({ row }) => [
  row.name, row.git, row.agents, row.claude, row.imports, row.continuity
]);
const widths = header.map((title, column) =>
  Math.max(title.length, ...rows.map((row) => row[column].length))
);
for (const row of [header, ...rows]) {
  console.log(row.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd());
}

const flagged = results.filter(({ findings }) => findings.length);
console.log(flagged.length ? "\nFindings:" : "\nNo findings.");
for (const { row, findings } of flagged) {
  for (const finding of findings) console.log(`- ${row.name}: ${finding}`);
}
console.log(
  "\nAudit only: nothing was changed. Fix project-owned files in a new " +
    "session started in that project."
);
