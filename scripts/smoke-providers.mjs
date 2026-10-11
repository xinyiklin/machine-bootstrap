#!/usr/bin/env node

// Opt-in runtime smoke check: runs the real Claude Code and Codex CLIs against
// a disposable workspace and records which instruction files, skills, and
// agents each provider actually loaded. It costs model calls, needs both CLIs
// signed in, and never runs in the regression suite or CI. The fixture holds
// only random marker strings and is deleted afterwards.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));

export const prompt =
  "This is an automated configuration check. Do not run commands or read " +
  "files. Reply with exactly one line of JSON and nothing else: " +
  '{"markers": [every distinct token beginning with SMOKE_ that appears in ' +
  'your loaded instructions or context], "skills": [names of the skills ' +
  'available to you], "agents": [names of subagents or custom agents you ' +
  "can delegate to]}";

// Builds the fixture and returns the scenarios to run against it.
export function buildFixture(root, id = randomBytes(3).toString("hex")) {
  const marker = (name) => `SMOKE_${name}_${id}`;
  const workspace = join(root, "Workspace");
  const write = (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  // A: adapter imports AGENTS.md. B: no adapter, so Claude must read
  // AGENTS.md natively. C: a personal CLAUDE.local.md turns that off.
  write(join(workspace, "project-a", "AGENTS.md"), `Instruction marker: ${marker("A")}\n`);
  write(join(workspace, "project-a", "CLAUDE.md"), "# Project A\n\n@AGENTS.md\n");
  write(join(workspace, "project-b", "AGENTS.md"), `Instruction marker: ${marker("B")}\n`);
  write(join(workspace, "project-c", "AGENTS.md"), `Instruction marker: ${marker("C")}\n`);
  write(join(workspace, "project-c", "CLAUDE.local.md"), `Local marker: ${marker("L")}\n`);
  mkdirSync(join(workspace, "scratch"), { recursive: true });

  const all = ["A", "B", "C", "L"].map(marker);
  const only = (...names) => ({
    expected: names.map(marker),
    absent: all.filter((value) => !names.map(marker).includes(value))
  });
  return {
    id,
    workspace,
    gitRepositories: ["project-a", "project-b", "project-c"].map((name) => join(workspace, name)),
    scenarios: [
      { provider: "claude", dir: "project-a", label: "adapter imports AGENTS.md", ...only("A"), discovery: true },
      { provider: "claude", dir: "project-b", label: "native AGENTS.md without an adapter", ...only("B") },
      { provider: "claude", dir: "project-c", label: "CLAUDE.local.md turns native reading off", ...only("L") },
      { provider: "claude", dir: "scratch", label: "no project guidance", ...only() },
      { provider: "codex", dir: "project-a", label: "project AGENTS.md", ...only("A"), discovery: true },
      { provider: "codex", dir: "project-c", label: "CLAUDE.local.md is Claude-only", ...only("C") },
      { provider: "codex", dir: "scratch", label: "no project guidance", ...only() }
    ].map((scenario) => ({ ...scenario, cwd: join(workspace, scenario.dir) }))
  };
}

// Pulls the JSON object out of a reply that may carry prose or code fences.
export function parseReply(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    const list = (key) => (Array.isArray(value[key]) ? value[key].map(String) : []);
    return { markers: list("markers"), skills: list("skills"), agents: list("agents") };
  } catch {
    return null;
  }
}

// One check lands in exactly one outcome; a reply after tool use is not
// evidence of what loaded, so it stays unverified.
export function evaluate(scenario, result, expectations = {}) {
  if (result.skipped) return { outcome: "skipped", detail: result.skipped };
  if (result.usedTools) return { outcome: "unverified", detail: "the agent ran a tool or command" };
  const reply = parseReply(result.text ?? "");
  if (!reply) return { outcome: "unverified", detail: "no JSON reply" };
  const seen = new Set(reply.markers);
  const missing = scenario.expected.filter((value) => !seen.has(value));
  const unexpected = scenario.absent.filter((value) => seen.has(value));
  const problems = [];
  if (missing.length) problems.push(`missing ${missing.join(", ")}`);
  if (unexpected.length) problems.push(`unexpected ${unexpected.join(", ")}`);
  if (scenario.discovery) {
    const names = new Set([...reply.skills, ...reply.agents].map((name) => name.replace(/^.*:/, "")));
    const absentNames = [...(expectations.skills ?? []), ...(expectations.agents?.[scenario.provider] ?? [])]
      .filter((name) => !names.has(name));
    if (absentNames.length) problems.push(`not discovered: ${absentNames.join(", ")}`);
  }
  return problems.length
    ? { outcome: "failed", detail: problems.join("; ") }
    : { outcome: "passed", detail: "as expected" };
}

export function* jsonLines(output) {
  for (const line of output.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      yield JSON.parse(line);
    } catch {
      // Provider progress lines that are not JSON carry no evidence.
    }
  }
}

function runProvider(scenario, available) {
  if (!available[scenario.provider]) {
    return { skipped: `${scenario.provider} CLI not found or not selected` };
  }
  if (scenario.provider === "claude") {
    // File and shell tools are off, and the event stream shows any other tool
    // use, so a marker can only count when it came from loading.
    const result = spawnSync(
      "claude",
      ["-p", "--output-format", "stream-json", "--verbose", "--no-session-persistence",
        "--disallowedTools", "Read,Grep,Glob,Bash,LS,WebFetch,WebSearch"],
      { cwd: scenario.cwd, input: prompt, encoding: "utf8", timeout: 240000, shell: false }
    );
    if (result.error || result.status !== 0) {
      return { skipped: `claude exited: ${(result.stderr || result.error?.message || "").trim().slice(0, 200)}` };
    }
    let text = "";
    let usedTools = false;
    for (const event of jsonLines(result.stdout)) {
      const content = Array.isArray(event.message?.content) ? event.message.content : [];
      if (content.some((part) => part?.type === "tool_use")) usedTools = true;
      if (event.type === "result" && typeof event.result === "string") text = event.result;
    }
    return { text, usedTools };
  }
  const result = spawnSync(
    "codex",
    ["exec", "--cd", scenario.cwd, "--sandbox", "read-only", "--skip-git-repo-check",
      "--ephemeral", "--json", "-"],
    { input: prompt, encoding: "utf8", timeout: 240000, shell: false }
  );
  if (result.error || result.status !== 0) {
    return { skipped: `codex exited: ${(result.stderr || result.error?.message || "").trim().slice(0, 200)}` };
  }
  let text = "";
  let usedTools = false;
  for (const event of jsonLines(result.stdout)) {
    const item = event.item ?? {};
    if (/command|exec|tool|file_change|mcp|search/i.test(item.type ?? "")) usedTools = true;
    if (item.type === "agent_message" && typeof item.text === "string") text = item.text;
  }
  return { text, usedTools };
}

export function runSmoke({ run = runProvider, available, expectations, root }) {
  const fixture = buildFixture(root);
  // Inherited repository overrides must not redirect the fixture's git init.
  const gitEnvironment = { ...process.env };
  for (const name of Object.keys(gitEnvironment)) {
    if (name.startsWith("GIT_")) delete gitEnvironment[name];
  }
  for (const repository of fixture.gitRepositories) {
    const initialized = spawnSync("git", ["init", "-q", repository], { env: gitEnvironment, shell: false });
    if (initialized.error || initialized.status !== 0) {
      throw new Error(`git init failed for the smoke fixture: ${repository}`);
    }
  }
  return fixture.scenarios.map((scenario) => ({
    scenario,
    ...evaluate(scenario, run(scenario, available), expectations)
  }));
}

function commandExists(name) {
  const probe = spawnSync(name, ["--version"], { encoding: "utf8", shell: false });
  return !probe.error && probe.status === 0 ? probe.stdout.trim() : null;
}

function main() {
  const args = process.argv.slice(2);
  const selected = args.includes("--claude-only") ? ["claude"] : args.includes("--codex-only") ? ["codex"] : ["claude", "codex"];
  const unknown = args.filter((arg) => !["--claude-only", "--codex-only", "--keep"].includes(arg));
  if (unknown.length) {
    console.error(`Unknown argument(s): ${unknown.join(", ")}`);
    process.exit(2);
  }
  const versions = Object.fromEntries(selected.map((name) => [name, commandExists(name)]));
  const available = Object.fromEntries(selected.map((name) => [name, Boolean(versions[name])]));
  const manifest = JSON.parse(readFileSync(join(scriptDir, "..", "skills.json"), "utf8"));
  const roles = JSON.parse(
    readFileSync(join(scriptDir, "..", "workflows", "product-delivery", "manifest.json"), "utf8")
  ).roles;
  // Discovery is judged only for skills actually installed in the shared root;
  // a pinned skill that is not installed yet is reported, not failed.
  const installed = manifest.skills
    .map((skill) => skill.name)
    .filter((name) => existsSync(join(homedir(), ".agents", "skills", name, "SKILL.md")));
  const notInstalled = manifest.skills.map((skill) => skill.name).filter((name) => !installed.includes(name));
  const expectations = {
    skills: installed,
    agents: {
      claude: roles.map((role) => role.claude.name),
      codex: roles.map((role) => role.codex.name)
    }
  };
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "machine-bootstrap-smoke-")));
  let results;
  try {
    results = runSmoke({ available, expectations, root });
  } finally {
    if (!args.includes("--keep")) rmSync(root, { recursive: true, force: true });
  }

  console.log(`Provider smoke check (${new Date().toISOString().slice(0, 10)})`);
  for (const name of selected) console.log(`- ${name}: ${versions[name] ?? "not available"}`);
  if (notInstalled.length) {
    console.log(`Not installed, so not checked for discovery: ${notInstalled.join(", ")}`);
  }
  for (const { scenario, outcome, detail } of results) {
    console.log(`${outcome.padEnd(10)} ${scenario.provider} ${scenario.dir}: ${scenario.label} — ${detail}`);
  }
  console.log("Results cover only these provider versions and scenarios.");
  console.log("After a full pass, record these versions under smokeTested in providers.json.");
  process.exit(results.some((result) => result.outcome === "failed") ? 1 : 0);
}

// Compare real paths so a symlinked invocation still runs instead of silently
// doing nothing.
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync.native(resolve(process.argv[1])) === realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) main();
