#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  accessSync,
  chmodSync,
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = resolve(scriptDir, "..");
const failures = [];
const skipped = [];

const manifestSkills = JSON.parse(
  readFileSync(join(bootstrapRoot, "skills.json"), "utf8")
).skills;

// Some checks read the machine's own installed roster. Before the first
// install there is nothing to read, so they are skipped rather than failing
// the documented verification command with confusing ENOENT errors.
const rosterInstalled = manifestSkills.every((skill) =>
  existsSync(join(homedir(), ".agents", "skills", skill.name, "SKILL.md"))
);

// Other checks need a host capability rather than installed state: creating a
// symbolic link, or POSIX permission bits that actually deny reads. Probing for
// them keeps the documented verification command honest on a host that lacks
// one, instead of reporting an environment limit as a bootstrap failure.
function detectCapabilities() {
  const probe = mkdtempSync(join(tmpdir(), "machine-bootstrap-capability-"));
  const capabilities = { symlinks: false, posixPermissions: false };
  try {
    writeFileSync(join(probe, "target.txt"), "probe\n");
    try {
      symlinkSync(join(probe, "target.txt"), join(probe, "link.txt"));
      capabilities.symlinks = true;
    } catch {
      capabilities.symlinks = false;
    }

    const guarded = join(probe, "guarded");
    mkdirSync(guarded);
    try {
      chmodSync(guarded, 0o000);
      try {
        accessSync(guarded, constants.R_OK);
      } catch {
        capabilities.posixPermissions = true;
      }
    } finally {
      chmodSync(guarded, 0o755);
    }
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
  return capabilities;
}

const capabilities = detectCapabilities();

// Test workspaces need the repository's source and fixtures, not ignored local
// caches or generated output. Copying those directories can turn a small test
// fixture into gigabytes and make every integration test repeat that cost.
const fixtureRootLocalDirectoryNames = new Set([
  ".agents",
  ".claude",
  ".codex",
  ".idea",
  ".vscode"
]);

const fixtureExcludedDirectoryNames = new Set([
  ".git",
  ".cache",
  "coverage",
  "dist",
  "node_modules",
  "tmp"
]);

const fixtureExcludedFileNames = new Set([
  ".env",
  ".npmrc",
  ".skill-lock.json",
  ".DS_Store",
  "CLAUDE.local.md",
  "MACHINE.md",
  "Thumbs.db"
]);

function includeInTestFixture(source) {
  if (source === bootstrapRoot) return true;

  const pathParts = source.slice(bootstrapRoot.length + 1).split(sep);
  if (fixtureRootLocalDirectoryNames.has(pathParts[0])) {
    return false;
  }
  if (pathParts.some((part) => fixtureExcludedDirectoryNames.has(part))) {
    return false;
  }

  const name = pathParts.at(-1);
  if (fixtureExcludedFileNames.has(name)) return false;
  if (name.startsWith(".env.") && name !== ".env.example") return false;
  if (
    name.endsWith(".log") ||
    name.endsWith(".swp") ||
    name.includes(".backup-")
  ) return false;
  return true;
}

function createTestWorkspace() {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-test-"));
  const workspaceRoot = join(testRoot, "Workspace");
  const checkoutRoot = join(workspaceRoot, "machine-bootstrap");
  mkdirSync(checkoutRoot, { recursive: true });
  cpSync(bootstrapRoot, checkoutRoot, {
    recursive: true,
    filter: includeInTestFixture
  });
  const gitResult = spawnSync("git", ["init", "-q"], {
    cwd: checkoutRoot,
    encoding: "utf8",
    shell: false
  });
  assert.equal(gitResult.status, 0, gitResult.stderr);
  return { testRoot, workspaceRoot, checkoutRoot };
}

function createTestHome(prefix) {
  return mkdtempSync(join(tmpdir(), `machine-bootstrap-${prefix}-`));
}

function isolatedEnvironment(testHome, overrides = {}) {
  const environment = {
    ...process.env,
    HOME: testHome,
    USERPROFILE: testHome
  };
  delete environment.CLAUDE_CONFIG_DIR;
  delete environment.CODEX_HOME;
  return { ...environment, ...overrides };
}

function runScript(script, scriptArgs, testHome, environmentOverrides = {}) {
  const isolatedHome = testHome ?? createTestHome("subprocess-home");
  let result;
  try {
    result = spawnSync(process.execPath, [join(scriptDir, script), ...scriptArgs], {
      encoding: "utf8",
      env: isolatedEnvironment(isolatedHome, environmentOverrides),
      shell: false
    });
  } finally {
    if (!testHome) rmSync(isolatedHome, { recursive: true, force: true });
  }
  return result;
}

async function createSkillInstallerFixture() {
  const testHome = createTestHome("skill-provider-roots");
  const checkout = join(testHome, "installer");
  const fixtureScriptDir = join(checkout, "scripts");
  mkdirSync(fixtureScriptDir, { recursive: true });
  copyFileSync(
    join(scriptDir, "install-skills.mjs"),
    join(fixtureScriptDir, "install-skills.mjs")
  );
  cpSync(join(scriptDir, "lib"), join(fixtureScriptDir, "lib"), {
    recursive: true
  });
  const name = "fixture-skill";
  const canonical = join(testHome, ".agents", "skills", name);
  mkdirSync(canonical, { recursive: true });
  writeFileSync(join(canonical, "SKILL.md"), "# Disposable test skill\n");
  const { hashDirectory } = await import("./lib/skill-integrity.mjs");
  writeFileSync(join(checkout, "skills.json"), JSON.stringify({
    schemaVersion: 4,
    skills: [{
      name,
      repository: "https://github.com/example/fixture.git",
      sourcePath: "skills/fixture-skill",
      sourceRevision: "a".repeat(40),
      contentSha256: hashDirectory(canonical)
    }]
  }));
  return {
    testHome,
    name,
    canonical,
    run(args = [], overrides = {}) {
      return spawnSync(process.execPath, [
        join(fixtureScriptDir, "install-skills.mjs"), ...args
      ], {
        cwd: testHome,
        encoding: "utf8",
        env: isolatedEnvironment(testHome, { PATH: "", ...overrides }),
        shell: false
      });
    }
  };
}

async function test(
  name,
  callback,
  {
    needsInstalledRoster = false,
    needsSymlinks = false,
    needsPosixPermissions = false
  } = {}
) {
  const missing =
    (needsInstalledRoster && !rosterInstalled &&
      "shared skills are not installed yet") ||
    (needsSymlinks && !capabilities.symlinks &&
      "this host cannot create symbolic links") ||
    (needsPosixPermissions && !capabilities.posixPermissions &&
      "this host does not enforce POSIX permission bits");

  if (missing) {
    skipped.push({ name, reason: missing });
    console.log(`SKIP ${name}: ${missing}`);
    return;
  }

  try {
    await callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

await test("manifest pins direct Git sources and skill content", async () => {
  const manifest = JSON.parse(
    readFileSync(join(bootstrapRoot, "skills.json"), "utf8")
  );
  const { hashDirectory } = await import("./lib/skill-integrity.mjs");

  assert.equal(manifest.schemaVersion, 4);
  assert.equal(manifest.installers, undefined);

  for (const skill of manifest.skills) {
    if (skill.localPath !== undefined) {
      // First-party skills live in this checkout and pin their exact bytes, so
      // an edit must update the manifest in the same reviewed change.
      assert.match(skill.localPath, /^skills\/[a-z0-9-]+$/);
      assert.equal(skill.repository, undefined);
      const sourceHash = hashDirectory(join(bootstrapRoot, ...skill.localPath.split("/")));
      assert.equal(
        sourceHash,
        skill.contentSha256,
        `${skill.name}: after editing ${skill.localPath}, set its skills.json ` +
          `contentSha256 to ${sourceHash}`
      );
      continue;
    }
    assert.match(
      skill.repository ?? "",
      /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/
    );
    assert.match(skill.sourcePath ?? "", /^(?!\/)(?!.*\.\.)(?!.*\\).+$/);
    assert.match(skill.sourceRevision ?? "", /^[a-f0-9]{40}$/);
    assert.match(skill.contentSha256 ?? "", /^[a-f0-9]{64}$/);
  }
});

await test("skill acquisition does not execute package runners", () => {
  const installer = readFileSync(
    join(scriptDir, "install-skills.mjs"),
    "utf8"
  );
  const skillSource = readFileSync(
    join(scriptDir, "lib", "skill-source.mjs"),
    "utf8"
  );
  assert.doesNotMatch(installer, /\bnpx\b|\bnpm\b/);
  assert.match(installer, /fetchReviewedSource/);
  assert.match(skillSource, /delete gitEnvironment\.GIT_ASKPASS/);
  assert.match(skillSource, /delete gitEnvironment\.SSH_ASKPASS/);
  assert.match(skillSource, /credential\.helper=/);
});

await test("the continuity skill is portable and invocable both ways", () => {
  const skill = readFileSync(join(bootstrapRoot, "skills", "continuity", "SKILL.md"), "utf8");
  const frontmatter = skill.match(/^---\n([^]*?)\n---\n/)?.[1] ?? "";
  assert.match(frontmatter, /^name: continuity$/m);
  const description = frontmatter.match(/^description: (.+)$/m)?.[1] ?? "";
  // The description is what lets either provider invoke the skill by itself.
  assert.match(description, /cap/);
  assert.match(description, /user asks to update, compact, or rotate/);
  assert.ok(description.length <= 1024, "description stays within listing budgets");
  assert.doesNotMatch(frontmatter, /disable-model-invocation|allow_implicit_invocation/);
  const body = skill.replace(/\s+/g, " ");
  assert.match(body, /Move resolved entries verbatim/);
  assert.match(body, /When the user invokes this skill, compact even below that threshold/);
  assert.match(body, /never an ignored local file/);
  // The optional decisions log is created on demand, never seeded empty.
  assert.match(body, /## Decisions log \(optional\)/);
  assert.match(body, /numbered in order and never renumbered/);
  assert.match(body, /Do not create an empty log/);
  const starterAgents = readNormalized(bootstrapRoot, "project-templates/AGENTS.md");
  assert.match(starterAgents, /optional `docs\/decisions\.md`/);
  assert.equal(
    existsSync(join(bootstrapRoot, "project-templates", "docs", "decisions.md")),
    false
  );
  assert.ok(skill.split("\n").length <= 120, "SKILL.md stays short");
  assert.equal(readdirSync(join(bootstrapRoot, "skills", "continuity")).join(), "SKILL.md");
  assert.match(
    readFileSync(join(bootstrapRoot, ".gitattributes"), "utf8"),
    /^skills\/\*\* text=auto eol=lf$/m
  );
});

await test("first-party skills are listed, portable, and call real scripts", () => {
  const manifest = JSON.parse(readFileSync(join(bootstrapRoot, "skills.json"), "utf8"));
  const local = manifest.skills.filter((skill) => skill.localPath !== undefined);
  // Every skills/ directory is pinned, so none ships unreviewed.
  assert.deepEqual(
    readdirSync(join(bootstrapRoot, "skills")).sort(),
    local.map((skill) => skill.name).sort()
  );
  for (const skill of local) {
    const text = readFileSync(join(bootstrapRoot, "skills", skill.name, "SKILL.md"), "utf8");
    const frontmatter = text.match(/^---\n([^]*?)\n---\n/)?.[1] ?? "";
    assert.match(frontmatter, new RegExp(`^name: ${skill.name}$`, "m"), skill.name);
    const description = frontmatter.match(/^description: (.+)$/m)?.[1] ?? "";
    assert.ok(description.length >= 80 && description.length <= 1024, `${skill.name} description length`);
    assert.match(description, /Use when/, `${skill.name} says when to use it`);
    assert.doesNotMatch(frontmatter, /disable-model-invocation|allow_implicit_invocation/, skill.name);
    assert.ok(text.split("\n").length <= 120, `${skill.name} stays short`);
    assert.equal(readdirSync(join(bootstrapRoot, "skills", skill.name)).join(), "SKILL.md");
    // Skills drive the audited scripts; each one they name must exist.
    for (const match of text.matchAll(/scripts\/([a-z-]+\.mjs)/g)) {
      assert.equal(existsSync(join(scriptDir, match[1])), true, `${skill.name}: ${match[0]}`);
    }
  }

  const read = (name) =>
    readFileSync(join(bootstrapRoot, "skills", name, "SKILL.md"), "utf8").replace(/\s+/g, " ");
  const setup = read("workspace-setup");
  assert.match(setup, /follow the checkout's `INIT\.md` instead/);
  assert.match(setup, /With the user's approval, run `node scripts\/install-workflows\.mjs --replace`/);
  assert.match(setup, /never overwrite/);
  const init = read("project-init");
  assert.match(init, /never guess/);
  assert.match(init, /A machine-bootstrap session never becomes a project's coding session/);
  const sync = read("project-sync");
  assert.match(sync, /it never replaces a customized file/);
  assert.match(sync, /Never weaken a project rule to match the starter/);
  // Ignore rules go through the initializer's ordered, fail-closed handling.
  assert.match(sync, /never reorder `\.env`, `\.env\.\*`, and `!\.env\.example` by hand/);
  assert.match(sync, /`git check-ignore -v \.env\.example` must report none/);
  assert.doesNotMatch(sync, /starter can replace it|Missing `\.gitignore` rules:\*\* add them/);
  assert.match(setup, /with the user's go-ahead, unless they asked for the update/);
  const audit = read("guidance-audit");
  assert.match(audit, /Never drop a hard invariant or an authorization, review, or safety rule silently/);
  assert.match(audit, /Edit a repository's guidance only in a session started in that repository/);
});

await test("starter diff reports upstream changes without writing", () => {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-starter-diff-"));
  try {
    const workspace = join(testRoot, "Workspace");
    const checkout = join(workspace, "machine-bootstrap");
    const project = join(workspace, "project-a");
    mkdirSync(join(checkout, "scripts"), { recursive: true });
    copyFileSync(join(scriptDir, "starter-diff.mjs"), join(checkout, "scripts", "starter-diff.mjs"));
    const starter = {
      "AGENTS.md": "# Guide\n\n- rule one\n",
      "CLAUDE.md": "# Adapter\n\n@AGENTS.md\n",
      "docs/engineering/git-workflow.md": "# Git\n",
      ".github/pull_request_template.md": "## Summary\n",
      ".gitignore": ".env\nCLAUDE.local.md\n"
    };
    const write = (root, files) => {
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, ...path.split("/"))), { recursive: true });
        writeFileSync(join(root, ...path.split("/")), text);
      }
    };
    const commitAt = (root, date, message) => {
      const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
      for (const gitArgs of [
        ["add", "-A"],
        ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "-q", "-m", message]
      ]) {
        const result = spawnSync("git", ["-C", root, ...gitArgs], { encoding: "utf8", env, shell: false });
        assert.equal(result.status, 0, result.stderr);
      }
      return spawnSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    };
    for (const root of [checkout, project]) {
      mkdirSync(root, { recursive: true });
      assert.equal(spawnSync("git", ["init", "-q", root]).status, 0);
    }
    write(join(checkout, "project-templates"), starter);
    const first = commitAt(checkout, "2026-01-01T00:00:00Z", "starters v1");
    // The project seeds v1, customizes AGENTS.md, and skips the Git contract.
    write(project, {
      "AGENTS.md": "# Guide\n\n- rule one\n- project fact\n",
      "CLAUDE.md": starter["CLAUDE.md"],
      ".github/pull_request_template.md": starter[".github/pull_request_template.md"],
      ".gitignore": ".env\n"
    });
    commitAt(project, "2026-02-01T00:00:00Z", "seed");
    write(join(checkout, "project-templates"), {
      "AGENTS.md": "# Guide\n\n- rule one\n- upstream rule two\n",
      ".github/pull_request_template.md": "## Summary\n\n## Verification\n"
    });
    const second = commitAt(checkout, "2026-03-01T00:00:00Z", "starters v2");

    const before = snapshotTree(project);
    const run = (args) =>
      spawnSync(process.execPath, [join(checkout, "scripts", "starter-diff.mjs"), ...args], {
        encoding: "utf8",
        shell: false
      });
    const report = run([project]);
    assert.equal(report.status, 0, report.stderr);
    assert.match(report.stdout, new RegExp(`Base starters: ${first.slice(0, 12)}, estimated`));
    assert.match(report.stdout, /## AGENTS\.md: customized/);
    assert.match(report.stdout, /\+- upstream rule two/);
    assert.doesNotMatch(report.stdout, /\+- project fact/);
    assert.match(report.stdout, /## CLAUDE\.md: matches the current starter/);
    assert.match(report.stdout, /## docs\/engineering\/git-workflow\.md: missing/);
    assert.match(report.stdout, /pull_request_template\.md: unchanged since its base/);
    assert.match(report.stdout, /## \.gitignore: missing starter rules: CLAUDE\.local\.md/);
    assert.deepEqual(snapshotTree(project), before, "the report writes nothing");
    // Comparisons are commit to commit, so no working-tree diff can refresh
    // the checkout's index; uncommitted starter edits are named, not reported.
    const source = readFileSync(join(scriptDir, "starter-diff.mjs"), "utf8");
    assert.match(source, /"diff", "--no-color", "--no-ext-diff", base, "HEAD", "--", templatePath/);
    assert.match(source, /\["show", `HEAD:\$\{templatePath\}`\]/);
    writeFileSync(join(checkout, "project-templates", "CLAUDE.md"), "# Edited locally\n");
    const dirty = run([project]);
    assert.match(dirty.stdout, /uncommitted edits to project-templates\/CLAUDE\.md are not part of this report/);
    assert.match(dirty.stdout, /## CLAUDE\.md: matches the current starter/);

    const synced = run([project, "--since", second]);
    assert.equal(synced.status, 0, synced.stderr);
    assert.match(synced.stdout, /No upstream starter changes since the base/);

    for (const args of [[checkout], [testRoot], [project, "--since", "no-such-revision"], []]) {
      const refused = run(args);
      assert.notEqual(refused.status, 0, args.join(" "));
      assert.match(refused.stderr, /Starter diff failed:/);
    }
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("starter diff and project initialization seed the same files", () => {
  const listed = (path, name) => {
    const source = readFileSync(join(scriptDir, path), "utf8");
    const block = source.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))?.[1] ?? "";
    return [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  };
  const seeded = listed("init-project.mjs", "seedFiles");
  assert.ok(seeded.length > 0);
  assert.deepEqual(listed("starter-diff.mjs", "starterFiles"), seeded);
});

await test("first-party skills install from the checkout with their reviewed hash", async () => {
  const fixture = await createSkillInstallerFixture();
  const { hashDirectory } = await import("./lib/skill-integrity.mjs");
  try {
    const checkout = join(fixture.testHome, "installer");
    const source = join(checkout, "skills", "local-skill");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "SKILL.md"), "---\nname: local-skill\n---\n");
    const manifest = JSON.parse(readFileSync(join(checkout, "skills.json"), "utf8"));
    const local = {
      name: "local-skill",
      localPath: "skills/local-skill",
      contentSha256: hashDirectory(source)
    };
    manifest.skills.push(local);
    writeFileSync(join(checkout, "skills.json"), JSON.stringify(manifest));

    const installed = fixture.run();
    assert.equal(installed.status, 0, installed.stderr);
    assert.match(installed.stdout, /Staging first-party skill local-skill/);
    const canonical = join(fixture.testHome, ".agents", "skills", "local-skill");
    assert.equal(hashDirectory(canonical), local.contentSha256);
    assert.equal(fixture.run(["--check"]).status, 0);

    // A source that no longer matches its pin installs nothing.
    rmSync(canonical, { recursive: true, force: true });
    rmSync(join(fixture.testHome, ".claude", "skills", "local-skill"), { force: true });
    writeFileSync(join(source, "SKILL.md"), "---\nname: local-skill\n---\nchanged\n");
    for (const args of [["--preflight"], []]) {
      const drifted = fixture.run(args);
      assert.notEqual(drifted.status, 0, args.join(" "));
      assert.match(drifted.stderr, /local-skill: first-party content hash [a-f0-9]{64} does not match reviewed/);
      assert.equal(existsSync(canonical), false);
    }
    // Ignored OS metadata is invisible to `git status`, so the failure names it.
    writeFileSync(join(source, ".DS_Store"), "finder\n");
    const withMetadata = fixture.run(["--preflight"]);
    assert.notEqual(withMetadata.status, 0);
    assert.match(
      withMetadata.stderr,
      /remove stray OS metadata from skills\/local-skill first \(\.DS_Store\)/
    );

    // One entry names exactly one source, and a first-party source is always
    // the skill's own `skills/<name>` directory.
    for (const invalid of [
      { ...local, repository: "https://github.com/example/fixture.git" },
      { ...local, localPath: "skills/other-skill" },
      { ...local, localPath: ".git" }
    ]) {
      manifest.skills[manifest.skills.length - 1] = invalid;
      writeFileSync(join(checkout, "skills.json"), JSON.stringify(manifest));
      const rejected = fixture.run(["--check"]);
      assert.notEqual(rejected.status, 0, JSON.stringify(invalid));
      assert.match(rejected.stderr, /Invalid skill entry/);
    }
  } finally {
    rmSync(fixture.testHome, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("a linked first-party skill source is refused", async () => {
  const fixture = await createSkillInstallerFixture();
  const { hashDirectory } = await import("./lib/skill-integrity.mjs");
  try {
    const checkout = join(fixture.testHome, "installer");
    const outside = join(fixture.testHome, "outside-skill");
    mkdirSync(outside);
    writeFileSync(join(outside, "SKILL.md"), "outside\n");
    mkdirSync(join(checkout, "skills"));
    symlinkSync(outside, join(checkout, "skills", "local-skill"), "junction");
    const manifest = JSON.parse(readFileSync(join(checkout, "skills.json"), "utf8"));
    manifest.skills.push({
      name: "local-skill",
      localPath: "skills/local-skill",
      contentSha256: hashDirectory(outside)
    });
    writeFileSync(join(checkout, "skills.json"), JSON.stringify(manifest));
    const refused = fixture.run();
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /first-party source must be a real directory inside this checkout/);
    assert.equal(existsSync(join(fixture.testHome, ".agents", "skills", "local-skill")), false);
  } finally {
    rmSync(fixture.testHome, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("skill hashes are byte-ordered and cover OS metadata", async () => {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-hash-test-"));
  try {
    writeFileSync(join(testRoot, "Z.txt"), "upper\n");
    writeFileSync(join(testRoot, "a.txt"), "lower\n");

    const expected = createHash("sha256");
    for (const [name, contents] of [
      ["Z.txt", "upper\n"],
      ["a.txt", "lower\n"]
    ]) {
      expected.update("file\0");
      expected.update(name);
      expected.update("\0");
      expected.update(contents);
      expected.update("\0");
    }

    const { hashDirectory } = await import("./lib/skill-integrity.mjs");
    const initialHash = hashDirectory(testRoot);
    assert.equal(initialHash, expected.digest("hex"));

    writeFileSync(join(testRoot, ".DS_Store"), "unexpected\n");
    assert.notEqual(hashDirectory(testRoot), initialHash);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("skill hashes cover injected empty directories", async () => {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-empty-test-"));
  try {
    const { hashDirectory } = await import("./lib/skill-integrity.mjs");
    writeFileSync(join(testRoot, "SKILL.md"), "# fixture\n");
    const initialHash = hashDirectory(testRoot);

    mkdirSync(join(testRoot, "injected"));
    const withEmptyDirectory = hashDirectory(testRoot);
    assert.notEqual(withEmptyDirectory, initialHash);

    mkdirSync(join(testRoot, "injected", "nested"));
    assert.notEqual(hashDirectory(testRoot), withEmptyDirectory);

    rmSync(join(testRoot, "injected"), { recursive: true, force: true });
    assert.equal(hashDirectory(testRoot), initialHash);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

// Fails the same way offline ("could not resolve host"), so this stays green
// without network access; the point is that it returns instead of prompting.
await test("an unreachable repository fails fast instead of prompting", async () => {
  const { fetchReviewedSource } = await import("./lib/skill-source.mjs");
  assert.throws(
    () =>
      fetchReviewedSource(
        "https://github.com/machine-bootstrap-absent-probe/private.git",
        "0".repeat(40)
      ),
    (error) => {
      assert.match(error.message, /^git fetch exited with status \d+: /);
      return true;
    }
  );
});

await test("reviewed skill trees materialize from Git objects only", async () => {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-git-test-"));
  const repositoryRoot = join(testRoot, "source");
  const sourceRoot = join(repositoryRoot, "skills", "fixture");
  const destination = join(testRoot, "materialized");

  try {
    mkdirSync(join(sourceRoot, "references"), { recursive: true });
    writeFileSync(join(sourceRoot, "SKILL.md"), "# Fixture\n");
    writeFileSync(join(sourceRoot, "references", "guide.md"), "Reviewed.\n");

    for (const gitArgs of [
      ["init", "--quiet", repositoryRoot],
      ["-C", repositoryRoot, "add", "skills/fixture"],
      [
        "-C",
        repositoryRoot,
        "-c",
        "user.name=Bootstrap Test",
        "-c",
        "user.email=bootstrap@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "fixture"
      ]
    ]) {
      const result = spawnSync("git", gitArgs, {
        encoding: "utf8",
        shell: false
      });
      assert.equal(result.status, 0, result.stderr);
    }

    const revisionResult = spawnSync(
      "git",
      ["-C", repositoryRoot, "rev-parse", "HEAD"],
      { encoding: "utf8", shell: false }
    );
    assert.equal(revisionResult.status, 0, revisionResult.stderr);

    const { materializeReviewedSkill } = await import("./lib/skill-source.mjs");
    const { hashDirectory } = await import("./lib/skill-integrity.mjs");
    materializeReviewedSkill(
      repositoryRoot,
      revisionResult.stdout.trim(),
      "skills/fixture",
      destination
    );

    assert.equal(hashDirectory(destination), hashDirectory(sourceRoot));
    assert.equal(existsSync(join(destination, ".git")), false);

    const linkObject = spawnSync(
      "git",
      ["-C", repositoryRoot, "hash-object", "-w", "--stdin"],
      { encoding: "utf8", input: "../../../outside", shell: false }
    );
    assert.equal(linkObject.status, 0, linkObject.stderr);
    const indexResult = spawnSync(
      "git",
      [
        "-C",
        repositoryRoot,
        "update-index",
        "--add",
        "--cacheinfo",
        `120000,${linkObject.stdout.trim()},skills/fixture/escape`
      ],
      { encoding: "utf8", shell: false }
    );
    assert.equal(indexResult.status, 0, indexResult.stderr);
    const linkCommit = spawnSync(
      "git",
      [
        "-C",
        repositoryRoot,
        "-c",
        "user.name=Bootstrap Test",
        "-c",
        "user.email=bootstrap@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "escaping link fixture"
      ],
      { encoding: "utf8", shell: false }
    );
    assert.equal(linkCommit.status, 0, linkCommit.stderr);
    const linkRevision = spawnSync(
      "git",
      ["-C", repositoryRoot, "rev-parse", "HEAD"],
      { encoding: "utf8", shell: false }
    );
    assert.equal(linkRevision.status, 0, linkRevision.stderr);

    // Windows rejects any reviewed symbolic link before the escape check, so
    // both refusals are correct; the point is that the escaping link is never
    // materialized.
    assert.throws(
      () =>
        materializeReviewedSkill(
          repositoryRoot,
          linkRevision.stdout.trim(),
          "skills/fixture",
          join(testRoot, "unsafe-materialized")
        ),
      process.platform === "win32"
        ? /symbolic link (escapes reviewed skill|unsupported on Windows)/
        : /symbolic link escapes reviewed skill/
    );
    assert.equal(existsSync(join(testRoot, "unsafe-materialized")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test(
  "installed skills match pinned content hashes",
  async () => {
    const { hashDirectory } = await import("./lib/skill-integrity.mjs");

    for (const skill of manifestSkills) {
      const actual = hashDirectory(
        join(homedir(), ".agents", "skills", skill.name)
      );
      assert.equal(actual, skill.contentSha256, `${skill.name} content drift`);
    }
  },
  { needsInstalledRoster: true }
);

await test("incompatible Claude state fails before skill installation", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-home-test-"));
  try {
    const claudeRoot = join(testHome, ".claude", "skills");
    mkdirSync(claudeRoot, { recursive: true });
    writeFileSync(join(claudeRoot, "find-skills"), "not a symlink\n");

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs")],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Claude destination exists but is not a symlink/);
    assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
    assert.equal(existsSync(join(testHome, ".agents", "skills")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("skill links and checks use custom provider roots without changing defaults", async () => {
  const fixture = await createSkillInstallerFixture();
  const { testHome, name, canonical } = fixture;
  try {
    // Relative overrides resolve from the invocation directory, as workflows do.
    const overrides = {
      CLAUDE_CONFIG_DIR: "providers/claude config",
      CODEX_HOME: "providers/codex config"
    };
    const customClaude = join(testHome, overrides.CLAUDE_CONFIG_DIR, "skills");
    const defaultClaude = join(testHome, ".claude", "skills");
    const defaultCodex = join(testHome, ".codex", "skills", name);
    mkdirSync(defaultClaude, { recursive: true });
    symlinkSync(canonical, join(defaultClaude, name),
      process.platform === "win32" ? "junction" : "dir");
    const originalLink = readlinkSync(join(defaultClaude, name));
    mkdirSync(customClaude, { recursive: true });
    writeFileSync(join(customClaude, "keep.txt"), "unrelated Claude entry\n");

    const missing = fixture.run(["--check"], overrides);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /fixture-skill: Claude symlink is missing/);
    assert.doesNotMatch(missing.stderr, /redundant Codex-specific copy/);
    assert.equal(existsSync(join(customClaude, name)), false);

    mkdirSync(defaultCodex, { recursive: true });
    writeFileSync(join(defaultCodex, "keep.txt"), "unrelated inactive copy\n");
    const installed = fixture.run([], overrides);
    assert.equal(installed.status, 0, installed.stderr);
    const destination = join(customClaude, name);
    assert.equal(lstatSync(destination).isSymbolicLink(), true);
    assert.equal(readFileSync(join(destination, "SKILL.md"), "utf8"),
      readFileSync(join(canonical, "SKILL.md"), "utf8"));
    const checked = fixture.run(["--check"], overrides);
    assert.equal(checked.status, 0, checked.stderr);
    assert.equal(readlinkSync(join(defaultClaude, name)), originalLink);
    assert.deepEqual(readdirSync(defaultClaude), [name]);
    assert.equal(readFileSync(join(defaultCodex, "keep.txt"), "utf8"),
      "unrelated inactive copy\n");
    assert.equal(readFileSync(join(customClaude, "keep.txt"), "utf8"),
      "unrelated Claude entry\n");
    assert.equal(existsSync(join(testHome, overrides.CODEX_HOME)), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("skill checks report unmanaged shared skills without owning them", async () => {
  const fixture = await createSkillInstallerFixture();
  const { testHome, name } = fixture;
  try {
    const sharedRoot = join(testHome, ".agents", "skills");
    const unmanaged = join(sharedRoot, "local-extra");
    mkdirSync(unmanaged);
    writeFileSync(join(unmanaged, "SKILL.md"), "# Unreviewed local skill\n");
    writeFileSync(join(sharedRoot, ".hidden-state"), "ignored\n");
    writeFileSync(join(sharedRoot, "stray-note.txt"), "not a skill\n");
    const before = snapshotTree(unmanaged);

    const installed = fixture.run();
    assert.equal(installed.status, 0, installed.stderr);
    const checked = fixture.run(["--check"]);
    assert.equal(checked.status, 0, checked.stderr);
    for (const result of [installed, checked]) {
      assert.match(result.stdout, /1 shared skill\(s\) .* not in skills\.json: local-extra\./);
      assert.match(result.stdout, /Codex discovers them; Claude has no bootstrap link/);
      assert.doesNotMatch(result.stdout, new RegExp(`not in skills\\.json:.*${name}`));
      assert.doesNotMatch(result.stdout, /\.hidden-state|stray-note/);
    }
    assert.deepEqual(snapshotTree(unmanaged), before);
    assert.equal(existsSync(join(testHome, ".claude", "skills", "local-extra")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("unset and empty provider overrides retain default skill roots", async () => {
  for (const overrides of [{}, { CLAUDE_CONFIG_DIR: "", CODEX_HOME: "" }]) {
    const fixture = await createSkillInstallerFixture();
    const { testHome, name } = fixture;
    try {
      const installed = fixture.run([], overrides);
      assert.equal(installed.status, 0, installed.stderr);
      assert.equal(lstatSync(join(testHome, ".claude", "skills", name))
        .isSymbolicLink(), true);
      const checked = fixture.run(["--check"], overrides);
      assert.equal(checked.status, 0, checked.stderr);
      const duplicate = join(testHome, ".codex", "skills", name);
      mkdirSync(duplicate, { recursive: true });
      const rejected = fixture.run(["--check"], overrides);
      assert.notEqual(rejected.status, 0);
      assert.match(rejected.stderr, /redundant Codex-specific copy exists/);
    } finally {
      rmSync(testHome, { recursive: true, force: true });
    }
  }
}, { needsSymlinks: true });

await test("relocated Claude roots create readable links and reject broken lexical links", async () => {
  for (const relocatedPart of ["configuration", "skills"]) {
    const fixture = await createSkillInstallerFixture();
    const { testHome, name, canonical } = fixture;
    try {
      const config = join(testHome, "config");
      const effectiveRoot = join(testHome, "deeper", "relocated", relocatedPart);
      mkdirSync(effectiveRoot, { recursive: true });
      const relocated = relocatedPart === "configuration" ? config : join(config, "skills");
      mkdirSync(dirname(relocated), { recursive: true });
      symlinkSync(effectiveRoot, relocated,
        process.platform === "win32" ? "junction" : "dir");
      const overrides = { CLAUDE_CONFIG_DIR: config };
      const result = fixture.run([], overrides);
      assert.equal(result.status, 0, result.stderr);
      const link = join(config, "skills", name);
      assert.equal(readFileSync(join(link, "SKILL.md"), "utf8"),
        readFileSync(join(canonical, "SKILL.md"), "utf8"));
      const checked = fixture.run(["--check"], overrides);
      assert.equal(checked.status, 0, checked.stderr);

      // Reproduce the previously accepted link based on the lexical root depth.
      rmSync(link);
      symlinkSync("../../.agents/skills/fixture-skill", link, "dir");
      const broken = fixture.run(["--check"], overrides);
      assert.notEqual(broken.status, 0);
      assert.match(broken.stderr, /Claude symlink cannot resolve to its canonical skill/);
      assert.doesNotMatch(broken.stderr, /node:internal|file:\/\//);
    } finally {
      rmSync(testHome, { recursive: true, force: true });
    }
  }
}, { needsSymlinks: true });

await test("a correct Claude link can await its missing canonical skill", async () => {
  const fixture = await createSkillInstallerFixture();
  const { testHome, name, canonical } = fixture;
  try {
    const claudeRoot = join(testHome, "custom-claude", "skills");
    mkdirSync(claudeRoot, { recursive: true });
    symlinkSync(canonical, join(claudeRoot, name),
      process.platform === "win32" ? "junction" : "dir");
    rmSync(canonical, { recursive: true });
    const overrides = { CLAUDE_CONFIG_DIR: dirname(claudeRoot) };
    const preflight = fixture.run(["--preflight"], overrides);
    assert.equal(preflight.status, 0, preflight.stderr);
    const checked = fixture.run(["--check"], overrides);
    assert.notEqual(checked.status, 0);
    assert.match(checked.stderr, /canonical skill is missing/);
    assert.doesNotMatch(checked.stderr, /Claude symlink/);
    const install = fixture.run([], overrides);
    assert.notEqual(install.status, 0);
    assert.match(install.stdout, /Fetching reviewed source/);
    assert.doesNotMatch(install.stderr, /Claude symlink/);
    assert.equal(existsSync(canonical), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("provider roots beneath files fail preflight before acquisition", async () => {
  for (const variable of ["CLAUDE_CONFIG_DIR", "CODEX_HOME"]) {
    const fixture = await createSkillInstallerFixture();
    const { testHome, canonical } = fixture;
    try {
      const ancestor = join(testHome, "ancestor");
      writeFileSync(ancestor, "preserve ancestor\n");
      rmSync(canonical, { recursive: true });
      for (const args of [[], ["--check"], ["--preflight"]]) {
        const result = fixture.run(args, { [variable]: join(ancestor, "nested") });
        assert.notEqual(result.status, 0);
        // Windows can report ENOENT for the child and reach the file ancestor;
        // POSIX reports ENOTDIR immediately. Both must reject before fetching.
        assert.match(result.stderr, /configuration root (?:cannot be read as|must be) a directory/);
        assert.doesNotMatch(result.stderr, /ENOTDIR|node:internal/);
        assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
        assert.equal(existsSync(canonical), false);
        assert.equal(readFileSync(ancestor, "utf8"), "preserve ancestor\n");
      }
    } finally {
      rmSync(testHome, { recursive: true, force: true });
    }
  }
});

await test("dangling provider roots and ancestors fail before acquisition", async () => {
  for (const variable of ["CLAUDE_CONFIG_DIR", "CODEX_HOME"]) {
    const fixture = await createSkillInstallerFixture();
    const { testHome, canonical } = fixture;
    try {
      const dangling = join(testHome, "dangling");
      const missing = join(testHome, "missing");
      symlinkSync(missing, dangling, "dir");
      rmSync(canonical, { recursive: true });
      for (const configRoot of [dangling, join(dangling, "nested")]) {
        for (const args of [[], ["--check"], ["--preflight"]]) {
          const result = fixture.run(args, { [variable]: configRoot });
          assert.notEqual(result.status, 0);
          assert.match(result.stderr, /configuration root cannot be read as a directory/);
          assert.doesNotMatch(result.stderr, /node:internal/);
          assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
          assert.equal(existsSync(canonical), false);
          assert.equal(existsSync(missing), false);
          assert.equal(readlinkSync(dangling), missing);
        }
      }
    } finally {
      rmSync(testHome, { recursive: true, force: true });
    }
  }
}, { needsSymlinks: true });

await test("custom Codex duplicates fail all setup modes before skill acquisition", async () => {
  const fixture = await createSkillInstallerFixture();
  const { testHome, name, canonical } = fixture;
  try {
    const codexHome = join(testHome, "custom-codex");
    const duplicate = join(codexHome, "skills", name);
    mkdirSync(duplicate, { recursive: true });
    writeFileSync(join(duplicate, "keep.txt"), "preserve duplicate\n");
    rmSync(canonical, { recursive: true });
    for (const args of [[], ["--check"], ["--preflight"]]) {
      const result = fixture.run(args, { CODEX_HOME: codexHome });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /redundant Codex-specific copy exists/);
      assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
      assert.equal(existsSync(canonical), false);
      assert.equal(existsSync(join(testHome, ".claude")), false);
      assert.equal(existsSync(join(testHome, ".codex")), false);
      assert.equal(readFileSync(join(duplicate, "keep.txt"), "utf8"),
        "preserve duplicate\n");
    }
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("incompatible custom Claude destination stops before skill acquisition", async () => {
  const fixture = await createSkillInstallerFixture();
  const { testHome, name, canonical } = fixture;
  try {
    const claudeConfig = join(testHome, "custom-claude");
    const destination = join(claudeConfig, "skills", name);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, "preserve existing destination\n");
    rmSync(canonical, { recursive: true });
    for (const args of [[], ["--preflight"]]) {
      const result = fixture.run(args, { CLAUDE_CONFIG_DIR: claudeConfig });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Claude destination exists but is not a symlink/);
      assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
      assert.equal(existsSync(canonical), false);
      assert.equal(existsSync(join(testHome, ".claude")), false);
      assert.equal(readFileSync(destination, "utf8"),
        "preserve existing destination\n");
    }
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("malformed custom provider roots stop before skill acquisition", async () => {
  for (const [variable, provider] of [
    ["CLAUDE_CONFIG_DIR", "Claude"], ["CODEX_HOME", "Codex"]
  ]) {
    for (const leaf of ["configuration", "skill"]) {
      const fixture = await createSkillInstallerFixture();
      const { testHome, canonical } = fixture;
      try {
        const configRoot = join(testHome, "custom-provider");
        const invalid = leaf === "configuration" ? configRoot : join(configRoot, "skills");
        mkdirSync(dirname(invalid), { recursive: true });
        writeFileSync(invalid, "preserve root file\n");
        rmSync(canonical, { recursive: true });
        const result = fixture.run([], { [variable]: configRoot });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`${provider} ${leaf} root must be a directory`));
        assert.doesNotMatch(result.stderr, /ENOTDIR|node:internal/);
        assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
        assert.equal(existsSync(canonical), false);
        assert.equal(readFileSync(invalid, "utf8"), "preserve root file\n");
      } finally {
        rmSync(testHome, { recursive: true, force: true });
      }
    }
  }
});

await test("stray OS metadata fails verification with a named remedy", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-metadata-test-"));
  try {
    const [firstSkill] = manifestSkills;
    const installed = join(testHome, ".agents", "skills", firstSkill.name);
    mkdirSync(dirname(installed), { recursive: true });
    cpSync(join(homedir(), ".agents", "skills", firstSkill.name), installed, {
      recursive: true,
      verbatimSymlinks: true
    });
    writeFileSync(join(installed, ".DS_Store"), "os metadata\n");

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--check"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      new RegExp(`${firstSkill.name}: content hash [a-f0-9]{64} does not match`)
    );
    assert.match(result.stderr, /remove stray OS metadata first \(\.DS_Store\)/);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}, { needsInstalledRoster: true });

await test("a relocated skill root reached through a symlink stays supported", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-symlink-test-"));
  try {
    const [firstSkill] = manifestSkills;
    const relocated = join(testHome, "shared-skills");
    mkdirSync(join(testHome, ".agents"), { recursive: true });
    mkdirSync(relocated, { recursive: true });
    symlinkSync(relocated, join(testHome, ".agents", "skills"));
    cpSync(
      join(homedir(), ".agents", "skills", firstSkill.name),
      join(relocated, firstSkill.name),
      { recursive: true, verbatimSymlinks: true }
    );

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--check"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.doesNotMatch(result.stderr, /skill root must be a directory/);
    assert.doesNotMatch(
      result.stderr,
      new RegExp(`${firstSkill.name}: (canonical skill is missing|skill)`)
    );
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}, { needsInstalledRoster: true, needsSymlinks: true });

await test("a skill reached through a symlink verifies by content", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-skilllink-test-"));
  try {
    const [firstSkill] = manifestSkills;
    const checkout = join(testHome, "dev", firstSkill.name);
    mkdirSync(join(testHome, ".agents", "skills"), { recursive: true });
    mkdirSync(dirname(checkout), { recursive: true });
    cpSync(join(homedir(), ".agents", "skills", firstSkill.name), checkout, {
      recursive: true,
      verbatimSymlinks: true
    });
    symlinkSync(checkout, join(testHome, ".agents", "skills", firstSkill.name));

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--check"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.doesNotMatch(
      result.stderr,
      new RegExp(`${firstSkill.name}: skill directory is missing`)
    );
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}, { needsInstalledRoster: true, needsSymlinks: true });

await test("a malformed skill root is reported instead of crashing", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-root-test-"));
  try {
    mkdirSync(join(testHome, ".claude"), { recursive: true });
    writeFileSync(join(testHome, ".claude", "skills"), "not a directory\n");

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs")],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Claude skill root must be a directory/);
    assert.doesNotMatch(result.stderr, /ENOTDIR|node:internal/);
    assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
    assert.equal(existsSync(join(testHome, ".agents", "skills")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("a partial skill directory fails before any network fetch", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-partial-test-"));
  try {
    const partial = join(testHome, ".agents", "skills", "find-skills");
    mkdirSync(partial, { recursive: true });
    writeFileSync(join(partial, "notes.md"), "leftover\n");

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs")],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exists without SKILL\.md/);
    assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
    assert.equal(existsSync(join(partial, "notes.md")), true);
    assert.equal(
      readdirSync(join(testHome, ".agents", "skills")).length,
      1,
      "no other skill was installed"
    );
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("skill acquisition failures are concise and leave no partial install", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-fetch-test-"));
  try {
    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs")],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome, { PATH: "" }),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    // A drifted first-party source stops in verification, before acquisition.
    assert.match(result.stderr, /Skill (setup|verification) failed:/);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/);
    assert.equal(existsSync(join(testHome, ".agents", "skills")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test(
  "hash report is read-only and covers the complete roster",
  () => {
    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--print-hashes"],
      { encoding: "utf8", shell: false }
    );
    assert.equal(result.status, 0, result.stderr);
    const lines = result.stdout.trim().split("\n");
    assert.equal(lines.length, manifestSkills.length);
    for (const line of lines) {
      assert.match(line, /^[a-z0-9-]+ [a-f0-9]{64}$/);
    }
  },
  { needsInstalledRoster: true }
);

await test("hash report fails concisely when a skill is not installed", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-hash-report-"));
  try {
    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--print-hashes"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Skill setup failed:/);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/);
    assert.equal(result.stdout.trim(), "");
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("setup scripts reject bad arguments without stack traces", () => {
  for (const [script, scriptArgs] of [
    ["install-skills.mjs", ["--bogus"]],
    ["init-workspace.mjs", ["--bogus"]],
    ["init-workspace.mjs", ["--check", "--migrate-legacy-layout"]],
    ["init-project.mjs", []],
    ["init-project.mjs", ["../project-a", "--bogus"]]
  ]) {
    const result = runScript(script, scriptArgs);
    const label = `${script} ${scriptArgs.join(" ")}`;
    assert.notEqual(result.status, 0, label);
    assert.match(result.stderr, /failed:/, label);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/, label);
  }
});

await test("an invalid skill manifest fails before workspace writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    writeFileSync(join(checkoutRoot, "skills.json"), "{ invalid json\n");
    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs")],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /skills\.json must contain valid JSON/);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal|SyntaxError/);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
    for (const name of ["AGENTS.md", "CLAUDE.md", "_templates"]) {
      assert.equal(existsSync(join(workspaceRoot, name)), false);
    }
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a wrong-typed machine template fails before workspace writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const source = join(checkoutRoot, "machine-templates", "MACHINE.example.md");
    rmSync(source);
    mkdirSync(source);
    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /machine-templates\/MACHINE\.example\.md must be a readable regular file/);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a symlinked machine template fails before workspace writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const source = join(checkoutRoot, "machine-templates", "MACHINE.example.md");
    const externalSource = join(testRoot, "external-machine-notes.md");
    writeFileSync(externalSource, "external private machine bytes\n");
    rmSync(source);
    symlinkSync(externalSource, source);

    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /machine-templates\/MACHINE\.example\.md must be a readable regular file/
    );
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
    assert.equal(
      readFileSync(externalSource, "utf8"),
      "external private machine bytes\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project template keeps local-state safety exclusions trackable", () => {
  const ignore = readFileSync(
    join(bootstrapRoot, "project-templates", ".gitignore"),
    "utf8"
  );
  for (const pattern of [
    "CLAUDE.local.md",
    ".claude/settings.local.json",
    ".agent-work/",
    ".env",
    ".env.*",
    "!.env.example",
    ".DS_Store",
    "Thumbs.db"
  ]) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(ignore, new RegExp(`^${escaped}$`, "m"));
  }
  assert.doesNotMatch(ignore, /^\.claude\/?$/m);
  assert.doesNotMatch(ignore, /^\.codex\/?$/m);
});

await test("repository and project guidance are self-contained", () => {
  const rootAgents = readFileSync(join(bootstrapRoot, "AGENTS.md"), "utf8");
  const rootClaude = readFileSync(join(bootstrapRoot, "CLAUDE.md"), "utf8");
  const readme = readFileSync(join(bootstrapRoot, "README.md"), "utf8");
  const init = readFileSync(join(bootstrapRoot, "INIT.md"), "utf8");
  const projectAgents = readFileSync(
    join(bootstrapRoot, "project-templates", "AGENTS.md"),
    "utf8"
  );
  const projectClaude = readFileSync(
    join(bootstrapRoot, "project-templates", "CLAUDE.md"),
    "utf8"
  );
  const usage = readFileSync(
    join(bootstrapRoot, "project-templates", "TEMPLATE-USAGE.md"),
    "utf8"
  );

  assert.match(rootAgents, /Applies only to this repository/);
  assert.match(rootAgents, /workspace root never owns live `AGENTS\.md`, `CLAUDE\.md`, or `_templates\/`/);
  assert.equal((rootClaude.match(/^@AGENTS\.md$/gm) ?? []).length, 1);
  assert.equal((projectClaude.match(/^@AGENTS\.md$/gm) ?? []).length, 1);
  assert.match(projectAgents, /repository may be cloned outside its current workspace/);
  assert.match(usage, /node scripts\/init-project\.mjs <target-project>/);
  assert.match(usage, /not a project README/);
  assert.match(readme, /Agent-assisted setup \(recommended for normal use\)/);
  assert.match(readme, /Set up this workspace using machine-bootstrap/);
  assert.match(readme, /Initialize `\.\.\/project-a` using machine-bootstrap/);
  assert.match(init, /ordinary language without naming any script/);
  assert.match(init, /use the audited scripts/);
  assert.match(usage, /canonical initializer rather than copying/);
  // Claude reads AGENTS.md natively; guidance explains why the adapter stays.
  for (const [label, source] of [
    ["starter AGENTS.md", projectAgents],
    ["starter CLAUDE.md", projectClaude],
    ["template usage", usage],
    ["README", readme]
  ]) {
    assert.doesNotMatch(source, /Claude does not (discover|read|load) (nested )?`?AGENTS\.md/, label);
  }
  for (const source of [usage, readme]) {
    assert.match(source, /2\.1\.277/);
    assert.match(source, /CLAUDE\.local\.md/);
  }
  assert.match(readme, /### Why projects keep `CLAUDE\.md`/);
  // The template note is a block comment, which Claude strips before loading.
  assert.match(projectClaude, /<!-- Template:[^]*?keep this file even though Claude can read\s+AGENTS\.md natively[^]*?-->/);
  // Review is tiered identically in this repository and the project starter.
  for (const [label, source] of [["root AGENTS.md", rootAgents], ["starter AGENTS.md", projectAgents]]) {
    const normalized = source.replace(/\s+/g, " ");
    assert.match(normalized, /After your own verification and before local completion, every change gets one fresh independent review/, label);
    assert.match(
      normalized,
      /confined to typos, broken links, formatting, or comments with no change in meaning, behavior, or configuration; it needs only your own verification, and you state that classification/,
      label
    );
    assert.match(normalized, /Only the user may waive a required review/, label);
  }
  assert.equal(existsSync(join(bootstrapRoot, "project-templates", "README.md")), false);
  const retiredGuides = join(bootstrapRoot, "guides");
  assert.equal(
    existsSync(retiredGuides) && readdirSync(retiredGuides).length > 0,
    false
  );

  const visited = new Set();
  const visiting = new Set();
  function visitImports(path) {
    const canonicalPath = resolve(path);
    assert.equal(visiting.has(canonicalPath), false, `import cycle at ${canonicalPath}`);
    if (visited.has(canonicalPath)) return;
    visiting.add(canonicalPath);
    const markdown = readFileSync(canonicalPath, "utf8");
    for (const match of markdown.matchAll(/^@([^\s]+)\s*$/gm)) {
      const importedPath = resolve(dirname(canonicalPath), match[1]);
      assert.equal(existsSync(importedPath), true, `missing import ${importedPath}`);
      visitImports(importedPath);
    }
    visiting.delete(canonicalPath);
    visited.add(canonicalPath);
  }
  visitImports(join(bootstrapRoot, "CLAUDE.md"));
  visitImports(join(bootstrapRoot, "project-templates", "CLAUDE.md"));
});

await test("test fixtures exclude generated and machine-local state", () => {
  for (const name of [".agents", ".claude", ".codex", ".idea", ".vscode"]) {
    assert.equal(includeInTestFixture(join(bootstrapRoot, name, "artifact")), false);
  }
  for (const name of [".git", ".cache", "coverage", "dist", "node_modules", "tmp"]) {
    assert.equal(includeInTestFixture(join(bootstrapRoot, name, "artifact")), false);
  }
  for (const name of [
    ".env",
    ".env.local",
    ".npmrc",
    ".skill-lock.json",
    ".DS_Store",
    "CLAUDE.local.md",
    "MACHINE.md",
    "Thumbs.db",
    "error.log",
    "notes.swp",
    "AGENTS.md.backup-2026-08-14"
  ]) {
    assert.equal(includeInTestFixture(join(bootstrapRoot, name)), false);
  }
  assert.equal(includeInTestFixture(join(bootstrapRoot, ".env.example")), true);
  assert.equal(
    includeInTestFixture(join(bootstrapRoot, "machine-templates", "MACHINE.example.md")),
    true
  );
});

await test("modeled provider scenarios isolate sibling repositories", () => {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-guidance-model-"));
  try {
    const workspace = join(testRoot, "Workspace");
    const bootstrap = join(workspace, "machine-bootstrap");
    const projectA = join(workspace, "project-a");
    const projectB = join(workspace, "project-b");
    const scratch = join(workspace, "scratch");
    for (const root of [bootstrap, projectA, projectB]) {
      mkdirSync(join(root, ".git"), { recursive: true });
    }
    mkdirSync(scratch);
    writeFileSync(join(workspace, "MACHINE.md"), "INERT_MACHINE_REGISTRY\n");
    writeFileSync(join(bootstrap, "AGENTS.md"), "BOOTSTRAP_ROOT\n");
    writeFileSync(join(bootstrap, "CLAUDE.md"), "@AGENTS.md\n");
    writeFileSync(join(projectA, "AGENTS.md"), "PROJECT_A_ROOT\n");
    writeFileSync(join(projectA, "CLAUDE.md"), "@AGENTS.md\n");
    writeFileSync(join(projectB, "AGENTS.md"), "PROJECT_B_ROOT\n");
    writeFileSync(join(projectB, "CLAUDE.md"), "@AGENTS.md\n");

    function modeledCodexFiles(projectRoot, cwd) {
      if (!projectRoot) {
        const local = join(cwd, "AGENTS.md");
        return existsSync(local) ? [local] : [];
      }
      const files = [];
      let current = resolve(cwd);
      const root = resolve(projectRoot);
      while (true) {
        const guide = join(current, "AGENTS.md");
        if (existsSync(guide)) files.unshift(guide);
        if (current === root) return files;
        current = dirname(current);
      }
    }
    // Claude (2.1.277+, default setting) loads CLAUDE.md files and their
    // imports from the start directory and every folder above it, and reads
    // AGENTS.md natively only when no CLAUDE.md file exists on that path.
    // The walk stops at the disposable root it does not control.
    function modeledClaudeFiles(cwd) {
      const folders = [];
      for (let current = resolve(cwd); ; current = dirname(current)) {
        folders.unshift(current);
        if (current === testRoot) break;
      }
      const claudeNames = ["CLAUDE.md", join(".claude", "CLAUDE.md"), "CLAUDE.local.md"];
      const files = [];
      for (const folder of folders) {
        for (const name of claudeNames) {
          const file = join(folder, name);
          if (!existsSync(file)) continue;
          files.push(file);
          for (const match of readFileSync(file, "utf8").matchAll(/^@([^\s]+)\s*$/gm)) {
            files.push(resolve(dirname(file), match[1]));
          }
        }
      }
      if (files.length) return files;
      return folders
        .map((folder) => join(folder, "AGENTS.md"))
        .filter((file) => existsSync(file));
    }

    assert.deepEqual(modeledCodexFiles(bootstrap, bootstrap), [join(bootstrap, "AGENTS.md")]);
    assert.deepEqual(modeledCodexFiles(projectA, projectA), [join(projectA, "AGENTS.md")]);
    assert.deepEqual(modeledCodexFiles(projectB, projectB), [join(projectB, "AGENTS.md")]);
    assert.deepEqual(modeledCodexFiles(null, workspace), []);
    assert.deepEqual(modeledCodexFiles(null, scratch), []);
    assert.deepEqual(modeledClaudeFiles(projectA), [
      join(projectA, "CLAUDE.md"),
      join(projectA, "AGENTS.md")
    ]);
    assert.equal(modeledClaudeFiles(projectA).includes(join(bootstrap, "AGENTS.md")), false);
    assert.equal(modeledClaudeFiles(projectB).includes(join(projectA, "AGENTS.md")), false);
    assert.deepEqual(modeledClaudeFiles(workspace), []);
    assert.deepEqual(modeledClaudeFiles(scratch), []);

    // Without the adapter Claude reads AGENTS.md natively, until any personal
    // CLAUDE.local.md switches that off; the adapter's import survives both.
    rmSync(join(projectB, "CLAUDE.md"));
    assert.deepEqual(modeledClaudeFiles(projectB), [join(projectB, "AGENTS.md")]);
    writeFileSync(join(projectB, "CLAUDE.local.md"), "personal notes\n");
    assert.deepEqual(modeledClaudeFiles(projectB), [join(projectB, "CLAUDE.local.md")]);
    writeFileSync(join(projectB, "CLAUDE.md"), "@AGENTS.md\n");
    assert.deepEqual(modeledClaudeFiles(projectB), [
      join(projectB, "CLAUDE.md"),
      join(projectB, "AGENTS.md"),
      join(projectB, "CLAUDE.local.md")
    ]);

    // Guidance anywhere above the workspace would reach every sibling, which
    // is why initialization stops on it.
    writeFileSync(join(testRoot, "CLAUDE.md"), "ANCESTOR\n");
    for (const root of [bootstrap, projectA, projectB, workspace, scratch]) {
      assert.equal(modeledClaudeFiles(root)[0], join(testRoot, "CLAUDE.md"));
    }
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("automatically loaded guidance stays within byte budgets", () => {
  for (const [relativePath, budget] of [
    ["AGENTS.md", 8 * 1024],
    ["CLAUDE.md", 2 * 1024],
    ["project-templates/AGENTS.md", 8 * 1024],
    ["project-templates/CLAUDE.md", 2 * 1024]
  ]) {
    const bytes = readFileSync(join(bootstrapRoot, ...relativePath.split("/"))).byteLength;
    assert.ok(bytes <= budget, `${relativePath} is ${bytes} bytes (budget ${budget})`);
  }
  const projectChain =
    readFileSync(join(bootstrapRoot, "project-templates", "AGENTS.md")).byteLength +
    readFileSync(join(bootstrapRoot, "project-templates", "CLAUDE.md")).byteLength;
  assert.ok(projectChain < 28 * 1024);
});

await test("continuity stays bounded and preserves archived history", () => {
  const continuity = readFileSync(join(bootstrapRoot, "CONTINUITY.md"), "utf8");
  assert.ok(Buffer.byteLength(continuity, "utf8") <= 12 * 1024);
  assert.ok(continuity.split(/\r?\n/).length <= 160);
  // The ledger holds current state; decisions and history are read on demand.
  assert.doesNotMatch(continuity, /^## Decisions/m);
  assert.match(continuity, /`docs\/decisions\.md`/);
  assert.match(continuity, /`docs\/continuity\/YYYY-MM\.md`/);
  for (const name of ["2026-07.md", "2026-10.md"]) {
    assert.equal(existsSync(join(bootstrapRoot, "docs", "continuity", name)), true);
  }
  // Decision numbers are unique and sequential, and each carries a status.
  const decisions = readFileSync(join(bootstrapRoot, "docs", "decisions.md"), "utf8");
  const numbers = [
    ...decisions.matchAll(
      /^- \d{4}-\d{2}-\d{2} \[[A-Z+-]+\] D(\d{3}) (ACTIVE|AMENDED by D\d{3}|(PARTLY )?SUPERSEDED by D\d{3}):/gm
    )
  ].map((match) => Number(match[1]));
  assert.equal(numbers.length, (decisions.match(/^- \d{4}-/gm) ?? []).length);
  assert.deepEqual(numbers, numbers.map((_, index) => index + 1));
});

await test("PR size counts the Git contract's lines and enforces its gate", () => {
  const repo = mkdtempSync(join(tmpdir(), "machine-bootstrap-pr-size-"));
  try {
    const run = (gitArgs) => {
      const result = spawnSync("git", ["-C", repo, ...gitArgs], { encoding: "utf8", shell: false });
      assert.equal(result.status, 0, result.stderr);
    };
    const lines = (count, word) => Array.from({ length: count }, (_, i) => `${word} ${i}\n`).join("");
    const commit = (message) => {
      run(["add", "-A"]);
      run(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "-q", "-m", message]);
    };
    run(["init", "-q"]);
    writeFileSync(join(repo, "app.js"), lines(10, "app"));
    writeFileSync(join(repo, "gone.md"), lines(5, "gone"));
    writeFileSync(join(repo, "package-lock.json"), lines(10, "lock"));
    writeFileSync(join(repo, "image.bin"), Buffer.from([0, 1, 2, 3, 0, 255]));
    writeFileSync(join(repo, "moved.md"), lines(20, "moved"));
    writeFileSync(join(repo, "renamed.md"), lines(20, "renamed"));
    commit("base");
    run(["branch", "base"]);
    // 3 added + 2 removed in app.js, 5 removed with gone.md, and 1 changed line
    // in a renamed file count; the lockfile, binary, pure rename, and excluded
    // generated output do not.
    writeFileSync(join(repo, "app.js"), lines(8, "app") + lines(3, "new"));
    rmSync(join(repo, "gone.md"));
    writeFileSync(join(repo, "package-lock.json"), lines(60, "lock"));
    writeFileSync(join(repo, "image.bin"), Buffer.from([0, 9, 9, 9, 0, 255]));
    renameSync(join(repo, "moved.md"), join(repo, "moved-to.md"));
    renameSync(join(repo, "renamed.md"), join(repo, "renamed-to.md"));
    writeFileSync(join(repo, "renamed-to.md"), lines(19, "renamed") + "renamed edited\n");
    mkdirSync(join(repo, "gen"));
    writeFileSync(join(repo, "gen", "out.js"), lines(7, "generated"));
    commit("change");

    const size = (args) =>
      spawnSync(process.execPath, [join(scriptDir, "pr-size.mjs"), "base", ...args], {
        cwd: repo,
        encoding: "utf8",
        shell: false
      });
    const report = size(["--exclude", "gen/"]);
    assert.equal(report.status, 0, report.stderr);
    assert.match(report.stdout, /: 12 counted \(\+4 −8 in 3 files\)/);
    assert.match(report.stdout, /Band: up to 500/);
    for (const reason of [
      /package-lock\.json \(lockfile\)/,
      /image\.bin \(binary\)/,
      /moved\.md → moved-to\.md \(pure rename\)/,
      /gen\/out\.js \(excluded by --exclude\)/
    ]) {
      assert.match(report.stdout, reason);
    }
    assert.match(size([]).stdout, /: 19 counted/, "unexcluded generated output counts");
    assert.equal(size(["--exclude", "gen/", "--fail-over", "12"]).status, 0);
    const over = size(["--exclude", "gen/", "--fail-over", "11"]);
    assert.equal(over.status, 1);
    assert.match(over.stderr, /12 counted lines exceed 11/);
    assert.equal(size(["--bogus"]).status, 2);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

await test("CI enforces the PR size gate and the push hook runs the suite", () => {
  const workflow = readFileSync(join(bootstrapRoot, ".github", "workflows", "pr-size.yml"), "utf8");
  assert.match(workflow, /types: \[opened, synchronize, reopened, edited\]/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  // Event data reaches the shell only through environment variables.
  assert.match(workflow, /PR_BODY: \$\{\{ github\.event\.pull_request\.body \}\}/);
  assert.doesNotMatch(workflow.slice(workflow.indexOf("run: |")), /\$\{\{/);
  // The base branch's script measures the PR, and an exception names the head.
  assert.match(workflow, /git show "origin\/\$BASE_REF:scripts\/pr-size\.mjs"/);
  assert.match(workflow, /size-exception: \*\\\(\[0-9a-f\]\\\{7,40\\\}\\\)/);
  assert.match(workflow, /node "\$script" "origin\/\$BASE_REF" --fail-over 1000/);
  const hook = join(scriptDir, "hooks", "pre-push");
  assert.match(readFileSync(hook, "utf8"), /^#!\/bin\/sh\n[^]*exec node scripts\/test-bootstrap\.mjs/);
  if (process.platform !== "win32") {
    assert.ok(statSync(hook).mode & 0o111, "pre-push is executable");
  }
});

await test("provider smoke harness judges loading without calling providers", async () => {
  const smoke = await import("./smoke-providers.mjs");
  const root = mkdtempSync(join(tmpdir(), "machine-bootstrap-smoke-test-"));
  try {
    const fixture = smoke.buildFixture(root, "abc123");
    const at = (...parts) => join(fixture.workspace, ...parts);
    assert.match(readFileSync(at("project-a", "CLAUDE.md"), "utf8"), /^@AGENTS\.md$/m);
    assert.equal(existsSync(at("project-b", "CLAUDE.md")), false);
    assert.match(readFileSync(at("project-c", "CLAUDE.local.md"), "utf8"), /SMOKE_L_abc123/);
    assert.deepEqual(readdirSync(at("scratch")), []);

    assert.deepEqual(
      smoke.parseReply('Result:\n```json\n{"markers":["SMOKE_A_x"],"skills":["continuity"],"agents":[]}\n```'),
      { markers: ["SMOKE_A_x"], skills: ["continuity"], agents: [] }
    );
    assert.equal(smoke.parseReply("no structured reply"), null);

    // A fake provider that loads exactly what each provider documents.
    const expectations = { skills: ["continuity"], agents: { claude: ["mb-verifier"], codex: ["mb_verifier"] } };
    const markersIn = (dir, names) =>
      names
        .filter((name) => existsSync(join(dir, name)))
        .flatMap((name) => readFileSync(join(dir, name), "utf8").match(/SMOKE_[A-Z]+_[0-9a-f]+/g) ?? []);
    const documented = (scenario) => {
      const claudeFiles = ["CLAUDE.md", "CLAUDE.local.md"].filter((name) => existsSync(join(scenario.cwd, name)));
      let markers;
      if (scenario.provider === "codex") markers = markersIn(scenario.cwd, ["AGENTS.md"]);
      else if (claudeFiles.length) {
        const imports = claudeFiles.some((name) => /^@AGENTS\.md$/m.test(readFileSync(join(scenario.cwd, name), "utf8")));
        markers = markersIn(scenario.cwd, [...claudeFiles, ...(imports ? ["AGENTS.md"] : [])]);
      } else markers = markersIn(scenario.cwd, ["AGENTS.md"]);
      const agent = scenario.provider === "claude" ? "mb-verifier" : "mb_verifier";
      return { text: JSON.stringify({ markers, skills: ["plugin:continuity"], agents: [agent] }) };
    };
    const passing = smoke.runSmoke({ run: documented, available: {}, expectations, root: join(root, "pass") });
    assert.equal(passing.length, 7);
    assert.deepEqual([...new Set(passing.map((result) => result.outcome))], ["passed"]);

    // Claude ignoring native AGENTS.md, a tool-using reply, a missing skill,
    // and an unavailable CLI each land in their own outcome.
    const flawed = (scenario) => {
      if (scenario.provider === "claude" && scenario.dir === "project-b") return { text: '{"markers":[]}' };
      if (scenario.provider === "codex" && scenario.dir === "project-c") return { ...documented(scenario), usedTools: true };
      if (scenario.provider === "codex" && scenario.dir === "project-a") return { text: '{"markers":["SMOKE_A_' + scenario.cwd.length + '"]}' };
      if (scenario.provider === "codex") return { skipped: "codex CLI not found" };
      return documented(scenario);
    };
    const outcomes = Object.fromEntries(
      smoke.runSmoke({ run: flawed, available: {}, expectations, root: join(root, "flawed") })
        .map((result) => [`${result.scenario.provider}/${result.scenario.dir}`, result])
    );
    assert.equal(outcomes["claude/project-b"].outcome, "failed");
    assert.match(outcomes["claude/project-b"].detail, /missing SMOKE_B_/);
    assert.equal(outcomes["codex/project-c"].outcome, "unverified");
    assert.equal(outcomes["codex/project-a"].outcome, "failed");
    assert.match(outcomes["codex/project-a"].detail, /not discovered: continuity, mb_verifier/);
    assert.equal(outcomes["codex/scratch"].outcome, "skipped");
    assert.equal(outcomes["claude/scratch"].outcome, "passed");
    assert.match(smoke.prompt, /Do not run commands or read files/);
    // Claude's event stream exposes tool use the same way Codex's does.
    const events = [
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Agent" }] } }),
      "progress text",
      JSON.stringify({ type: "result", result: '{"markers":[]}' })
    ].join("\n");
    const parsed = [...smoke.jsonLines(events)];
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].message.content[0].type, "tool_use");
    const source = readFileSync(join(scriptDir, "smoke-providers.mjs"), "utf8");
    assert.match(source, /"--output-format", "stream-json", "--verbose"/);
    assert.match(source, /realpathSync\.native\(resolve\(process\.argv\[1\]\)\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test("CI covers the full bootstrap suite on Linux, Windows, and macOS", () => {
  const workflow = readFileSync(
    join(bootstrapRoot, ".github", "workflows", "bootstrap.yml"),
    "utf8"
  );
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v7/);
  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /node scripts\/test-bootstrap\.mjs/);

  for (const relativePath of [
    "README.md",
    "INIT.md",
    "scripts/init-workspace.mjs",
    "scripts/init-project.mjs"
  ]) {
    const contents = readFileSync(
      join(bootstrapRoot, ...relativePath.split("/")),
      "utf8"
    );
    assert.match(contents, /Node\.js 24\s+or newer/, relativePath);
    assert.doesNotMatch(contents, /Node\.js 18\s+or newer/, relativePath);
  }
});

await test("clean workspace initialization creates only the machine registry", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const command = [
      join(checkoutRoot, "scripts", "init-workspace.mjs"),
      "--skip-skills",
      "--skip-workflows"
    ];
    const result = spawnSync(process.execPath, command, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(workspaceRoot, "MACHINE.md"), "utf8"),
      readFileSync(
        join(checkoutRoot, "machine-templates", "MACHINE.example.md"),
        "utf8"
      )
    );
    for (const name of ["AGENTS.md", "CLAUDE.md", "_templates"]) {
      assert.equal(existsSync(join(workspaceRoot, name)), false, name);
    }

    writeFileSync(join(workspaceRoot, "MACHINE.md"), "verified local facts\n");
    const second = spawnSync(process.execPath, command, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(
      readFileSync(join(workspaceRoot, "MACHINE.md"), "utf8"),
      "verified local facts\n"
    );

    const check = spawnSync(process.execPath, [...command, "--check"], {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(check.status, 0, check.stderr);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("workspace check is read-only and allows an absent registry", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const args = [
      join(checkoutRoot, "scripts", "init-workspace.mjs"),
      "--check",
      "--skip-skills",
      "--skip-workflows"
    ];
    const absent = spawnSync(process.execPath, args, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(absent.status, 0, absent.stderr);
    assert.match(absent.stdout, /Optional machine registry is not present/);
    assert.equal(readdirSync(workspaceRoot).sort().join(","), "machine-bootstrap");

    copyFileSync(
      join(checkoutRoot, "machine-templates", "MACHINE.example.md"),
      join(workspaceRoot, "MACHINE.md")
    );
    const incomplete = spawnSync(process.execPath, args, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stderr, /TODO placeholder/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("malformed MACHINE.md and Git-owned workspaces fail before writes", () => {
  for (const kind of ["machine-directory", "git-workspace"]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      if (kind === "machine-directory") mkdirSync(join(workspaceRoot, "MACHINE.md"));
      else {
        const gitResult = spawnSync("git", ["init", "-q"], {
          cwd: workspaceRoot,
          encoding: "utf8",
          shell: false
        });
        assert.equal(gitResult.status, 0, gitResult.stderr);
      }
      const result = spawnSync(
        process.execPath,
        [
          join(checkoutRoot, "scripts", "init-workspace.mjs"),
          "--skip-skills",
          "--skip-workflows"
        ],
        {
          encoding: "utf8",
          env: isolatedEnvironment(testRoot),
          shell: false
        }
      );
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        kind === "machine-directory"
          ? /MACHINE\.md must be a readable regular file/
          : /Workspace root must stay outside Git/
      );
      for (const name of ["AGENTS.md", "CLAUDE.md", "_templates"]) {
        assert.equal(existsSync(join(workspaceRoot, name)), false);
      }
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("a missing Git prerequisite is reported plainly before writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot, { PATH: join(testRoot, "no-tools") }),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Git is required on PATH/);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a checkout directly under the user home is rejected before writes", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-home-root-test-"));
  const checkoutRoot = join(testHome, "machine-bootstrap");
  try {
    mkdirSync(checkoutRoot);
    cpSync(bootstrapRoot, checkoutRoot, {
      recursive: true,
      filter: includeInTestFixture
    });
    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workspace root cannot be the user home/);
    assert.equal(existsSync(join(testHome, "MACHINE.md")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("legacy workspace entries stop for manual review without writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const legacyTemplates = join(workspaceRoot, "_templates");
    mkdirSync(legacyTemplates);
    writeFileSync(join(workspaceRoot, "AGENTS.md"), "existing workspace policy\n");
    writeFileSync(join(workspaceRoot, "CLAUDE.md"), "existing Claude policy\n");
    writeFileSync(join(legacyTemplates, "README.md"), "existing templates\n");
    writeFileSync(join(workspaceRoot, "MACHINE.md"), "verified local facts\n");
    const sibling = join(workspaceRoot, "project-b");
    mkdirSync(sibling);
    writeFileSync(join(sibling, "owned.txt"), "sibling bytes\n");
    const siblingBefore = readFileSync(join(sibling, "owned.txt"));

    const normal = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(normal.status, 0);
    assert.match(normal.stderr, /Legacy workspace layout detected/);
    assert.match(normal.stderr, /automatic migration is not supported/i);
    assert.match(normal.stderr, /move .* manually/i);
    assert.equal(existsSync(legacyTemplates), true);
    assert.equal(
      readFileSync(join(workspaceRoot, "AGENTS.md"), "utf8"),
      "existing workspace policy\n"
    );
    assert.equal(existsSync(join(workspaceRoot, ".machine-bootstrap-backup")), false);
    assert.equal(
      readFileSync(join(workspaceRoot, "MACHINE.md"), "utf8"),
      "verified local facts\n"
    );
    assert.deepEqual(readFileSync(join(sibling, "owned.txt")), siblingBefore);

    const removedOption = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--migrate-legacy-layout",
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(removedOption.status, 0);
    assert.match(removedOption.stderr, /Unknown argument.*--migrate-legacy-layout/);
    assert.equal(existsSync(legacyTemplates), true);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("every root instruction file Claude or Codex would load stops setup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  const command = [
    join(checkoutRoot, "scripts", "init-workspace.mjs"),
    "--skip-skills",
    "--skip-workflows"
  ];
  const run = (extraArgs = []) =>
    spawnSync(process.execPath, [...command, ...extraArgs], {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
  try {
    // Non-instruction provider files at the root, such as a launch config,
    // are not shared policy.
    mkdirSync(join(workspaceRoot, ".claude"));
    writeFileSync(join(workspaceRoot, ".claude", "launch.json"), "{}\n");
    const clean = run();
    assert.equal(clean.status, 0, clean.stderr);
    rmSync(join(workspaceRoot, "MACHINE.md"));

    for (const [entry, kind] of [
      ["AGENTS.override.md", "file"],
      ["CLAUDE.local.md", "file"],
      [".claude/AGENTS.md", "file"],
      [".claude/CLAUDE.md", "file"],
      [".claude/rules", "directory"]
    ]) {
      const path = join(workspaceRoot, ...entry.split("/"));
      if (kind === "directory") mkdirSync(path);
      else writeFileSync(path, "workspace policy\n");
      for (const extraArgs of [[], ["--check"]]) {
        const result = run(extraArgs);
        assert.notEqual(result.status, 0, `${entry} ${extraArgs}`);
        assert.ok(result.stderr.includes(entry), `${entry} named`);
        assert.match(result.stderr, /move .* manually/i);
        assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false, entry);
      }
      rmSync(path, { recursive: true, force: true });
    }
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("guidance paths that cannot be inspected stop setup cleanly", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  const otherHome = createTestHome("unsearchable-home");
  const guarded = [join(workspaceRoot, ".claude"), join(testRoot, ".claude")];
  try {
    for (const directory of guarded) {
      mkdirSync(directory);
      chmodSync(directory, 0o000);
      const result = spawnSync(
        process.execPath,
        [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills", "--skip-workflows"],
        { encoding: "utf8", env: isolatedEnvironment(otherHome), shell: false }
      );
      chmodSync(directory, 0o755);
      assert.notEqual(result.status, 0, directory);
      assert.match(result.stderr, /Could not inspect agent guidance path .*\(EACCES\)/);
      assert.doesNotMatch(result.stderr, /node:internal|\n\s+at /);
      assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
      rmSync(directory, { recursive: true, force: true });
    }
  } finally {
    for (const directory of guarded) {
      if (existsSync(directory)) chmodSync(directory, 0o755);
    }
    rmSync(otherHome, { recursive: true, force: true });
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsPosixPermissions: true });

await test("guidance above the workspace stops setup; a home .claude stays user config", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  const command = [
    join(checkoutRoot, "scripts", "init-workspace.mjs"),
    "--skip-skills",
    "--skip-workflows"
  ];
  const run = (home, extraArgs = [], overrides = {}) =>
    spawnSync(process.execPath, [...command, ...extraArgs], {
      encoding: "utf8",
      env: isolatedEnvironment(home, overrides),
      shell: false
    });
  const otherHome = createTestHome("ancestor-home");
  try {
    // testRoot is both the workspace's parent and the isolated home.
    mkdirSync(join(testRoot, ".claude"));
    writeFileSync(join(testRoot, ".claude", "CLAUDE.md"), "user memory\n");
    const asHome = run(testRoot);
    assert.equal(asHome.status, 0, asHome.stderr);
    rmSync(join(workspaceRoot, "MACHINE.md"));

    // A selected CLAUDE_CONFIG_DIR's CLAUDE.md is user memory too.
    const asConfig = run(otherHome, ["--check"], {
      CLAUDE_CONFIG_DIR: join(testRoot, ".claude")
    });
    assert.equal(asConfig.status, 0, asConfig.stderr);

    // Only CLAUDE.md is user memory: native AGENTS.md reading loads a
    // .claude/AGENTS.md from above the working directory, even at home.
    writeFileSync(join(testRoot, ".claude", "AGENTS.md"), "home agents\n");
    const homeAgents = run(testRoot, ["--check"]);
    assert.notEqual(homeAgents.status, 0);
    assert.match(homeAgents.stderr, /above the workspace/);
    assert.ok(homeAgents.stderr.includes(join(".claude", "AGENTS.md")));
    assert.ok(!homeAgents.stderr.includes(join(".claude", "CLAUDE.md")));
    rmSync(join(testRoot, ".claude", "AGENTS.md"));

    // The same folder is an ordinary ancestor when it is not the home.
    for (const extraArgs of [[], ["--check"]]) {
      const asAncestor = run(otherHome, extraArgs);
      assert.notEqual(asAncestor.status, 0);
      assert.match(asAncestor.stderr, /above the workspace/);
      assert.ok(asAncestor.stderr.includes(join(".claude", "CLAUDE.md")));
      assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
    }
    rmSync(join(testRoot, ".claude"), { recursive: true, force: true });

    for (const name of ["AGENTS.md", "CLAUDE.md", "CLAUDE.local.md"]) {
      writeFileSync(join(testRoot, name), "ancestor policy\n");
      const result = run(testRoot);
      assert.notEqual(result.status, 0, name);
      assert.match(result.stderr, /above the workspace/);
      assert.ok(result.stderr.includes(name), `${name} named`);
      assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false, name);
      rmSync(join(testRoot, name));
    }
  } finally {
    rmSync(otherHome, { recursive: true, force: true });
    rmSync(testRoot, { recursive: true, force: true });
  }
});

function runProjectInitializer(
  checkoutRoot,
  target,
  testHome,
  extraArgs = [],
  environmentOverrides = {}
) {
  return spawnSync(
    process.execPath,
    [join(checkoutRoot, "scripts", "init-project.mjs"), target, ...extraArgs],
    {
      cwd: checkoutRoot,
      encoding: "utf8",
      env: isolatedEnvironment(testHome, environmentOverrides),
      shell: false
    }
  );
}

await test("Git boundary probes ignore inherited path overrides", () => {
  for (const initializer of ["workspace", "project"]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const overrides = {
        GIT_DIR: join(testRoot, "spoof.git"),
        GIT_WORK_TREE: join(testRoot, "spoof-worktree"),
        GIT_COMMON_DIR: join(testRoot, "spoof-common.git"),
        GIT_INDEX_FILE: join(testRoot, "spoof.index"),
        GIT_CEILING_DIRECTORIES: workspaceRoot
      };
      let result;
      if (initializer === "workspace") {
        result = spawnSync(
          process.execPath,
          [
            join(checkoutRoot, "scripts", "init-workspace.mjs"),
            "--skip-skills",
            "--skip-workflows"
          ],
          {
            encoding: "utf8",
            env: isolatedEnvironment(testRoot, overrides),
            shell: false
          }
        );
        assert.equal(result.status, 0, result.stderr);
        assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), true);
      } else {
        const project = join(workspaceRoot, "project-a");
        result = runProjectInitializer(
          checkoutRoot,
          project,
          testRoot,
          ["--create"],
          overrides
        );
        assert.equal(result.status, 0, result.stderr);
        assert.equal(existsSync(join(project, "AGENTS.md")), true);
      }
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

function gitCheckIgnore(project, relativePath) {
  return spawnSync(
    "git",
    ["-C", project, "check-ignore", "--quiet", "--no-index", "--", relativePath],
    { encoding: "utf8", shell: false }
  );
}

function directoryByteHash(root) {
  const hash = createHash("sha256");
  function visit(directory, prefix = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      hash.update(relativePath);
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, relativePath);
      else hash.update(readFileSync(absolutePath));
    }
  }
  visit(root);
  return hash.digest("hex");
}

await test("workspace audit reports sibling guidance budgets without writing", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const oversized = join(workspaceRoot, "project-a");
    mkdirSync(join(oversized, ".git"), { recursive: true });
    writeFileSync(join(oversized, "AGENTS.md"), `# A\n${"x".repeat(9 * 1024)}\nTODO\n`);
    writeFileSync(join(oversized, "CLAUDE.md"), "# A\n\nRead AGENTS.md first.\n");
    writeFileSync(
      join(oversized, "CONTINUITY.md"),
      Array.from({ length: 200 }, (_, index) => `- entry ${index}`).join("\n") + "\n"
    );
    const agentsOnly = join(workspaceRoot, "project-b");
    mkdirSync(agentsOnly);
    writeFileSync(join(agentsOnly, "AGENTS.md"), "# B\n");
    const healthy = join(workspaceRoot, "project-c");
    mkdirSync(healthy);
    writeFileSync(join(healthy, "AGENTS.md"), "# C\n");
    writeFileSync(join(healthy, "CLAUDE.md"), "# C\n\n@AGENTS.md\n");
    writeFileSync(join(healthy, "CONTINUITY.md"), "- current\n");
    mkdirSync(join(workspaceRoot, "scratch"));
    writeFileSync(join(workspaceRoot, "scratch", "AGENTS.md"), "scratch\n");
    mkdirSync(join(workspaceRoot, ".hidden"));
    writeFileSync(join(workspaceRoot, "MACHINE.md"), "TODO private registry\n");
    if (capabilities.symlinks) {
      symlinkSync(healthy, join(workspaceRoot, "linked-project"),
        process.platform === "win32" ? "junction" : "dir");
    }
    const linkedGuide = join(workspaceRoot, "project-d");
    mkdirSync(linkedGuide);
    writeFileSync(join(linkedGuide, "AGENTS.md"), "# D\n");
    if (capabilities.symlinks) {
      symlinkSync(join(healthy, "CLAUDE.md"), join(linkedGuide, "CLAUDE.md"));
    }
    if (capabilities.posixPermissions) {
      writeFileSync(join(linkedGuide, "CONTINUITY.md"), "- private\n");
      chmodSync(join(linkedGuide, "CONTINUITY.md"), 0o000);
    }
    const before = [oversized, agentsOnly, healthy].map(directoryByteHash);
    const machineBefore = readFileSync(join(workspaceRoot, "MACHINE.md"));

    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "audit-workspace.mjs")],
      { encoding: "utf8", env: isolatedEnvironment(testRoot), shell: false }
    );
    assert.equal(result.status, 0, result.stderr);
    const out = result.stdout;
    assert.match(out, /project-a: AGENTS\.md is 9\.\d KiB, over the 8\.0 KiB target/);
    assert.match(out, /project-a: CLAUDE\.md imports AGENTS\.md 0 time\(s\)/);
    assert.match(out, /project-a: 1 TODO marker\(s\)/);
    assert.match(out, /project-a: CONTINUITY\.md is 200 lines .* over the default 160-line cap/);
    assert.match(out, /project-b: no CLAUDE\.md: Claude Code 2\.1\.277\+ reads AGENTS\.md natively/);
    assert.doesNotMatch(out, /project-c:/);
    assert.match(out, /^project-c\s+no\s+0\.0 KiB\s+0\.0 KiB\s+1\s+1 lines$/m);
    assert.doesNotMatch(out, /scratch|\.hidden|linked-project|machine-bootstrap\s/);
    if (capabilities.symlinks) {
      assert.match(out, /project-d: CLAUDE\.md is a symbolic link; not followed/);
      assert.doesNotMatch(out, /project-d: no CLAUDE\.md/);
    }
    if (capabilities.posixPermissions) {
      assert.match(out, /project-d: CONTINUITY\.md could not be read \(EACCES\)/);
      chmodSync(join(linkedGuide, "CONTINUITY.md"), 0o644);
    }
    assert.doesNotMatch(out, /private registry/);
    assert.deepEqual([oversized, agentsOnly, healthy].map(directoryByteHash), before);
    assert.deepEqual(readFileSync(join(workspaceRoot, "MACHINE.md")), machineBefore);

    const bad = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "audit-workspace.mjs"), "--fix"],
      { encoding: "utf8", env: isolatedEnvironment(testRoot), shell: false }
    );
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /Unknown argument\(s\): --fix/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization changes only its explicit target", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const projectA = join(workspaceRoot, "project-a");
    const projectB = join(workspaceRoot, "project-b");
    mkdirSync(projectB);
    writeFileSync(join(projectB, "owned.txt"), "project b\n");
    const siblingBefore = directoryByteHash(projectB);

    const result = runProjectInitializer(
      checkoutRoot,
      projectA,
      testRoot,
      ["--create"]
    );
    assert.equal(result.status, 0, result.stderr);
    for (const path of [
      "AGENTS.md",
      "CLAUDE.md",
      ".gitignore",
      "docs/engineering/git-workflow.md",
      ".github/pull_request_template.md"
    ]) {
      assert.equal(existsSync(join(projectA, ...path.split("/"))), true, path);
    }
    assert.equal(existsSync(join(projectA, "README.md")), false);
    assert.equal(existsSync(join(projectA, "TEMPLATE-USAGE.md")), false);
    assert.equal(directoryByteHash(projectB), siblingBefore);
    for (const name of ["AGENTS.md", "CLAUDE.md", "_templates", "MACHINE.md"]) {
      assert.equal(existsSync(join(workspaceRoot, name)), false, name);
    }
    const claude = readFileSync(join(projectA, "CLAUDE.md"), "utf8");
    assert.equal((claude.match(/^@AGENTS\.md$/gm) ?? []).length, 1);
    assert.match(result.stdout, /Remaining template placeholders:/);
    assert.match(result.stdout, /Start a new Codex or Claude session/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization reports a dangling target link cleanly", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const target = join(workspaceRoot, "project-a");
    symlinkSync(join(workspaceRoot, "missing-project"), target, "dir");

    const result = runProjectInitializer(checkoutRoot, target, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Project initialization failed: Target must resolve to an existing directory/
    );
    assert.doesNotMatch(result.stderr, /\n\s+at canonicalCandidate/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project initialization reports a dangling target parent cleanly", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const parent = join(workspaceRoot, "dangling-parent");
    const target = join(parent, "project-a");
    symlinkSync(join(workspaceRoot, "missing-parent"), parent, "dir");

    const result = runProjectInitializer(
      checkoutRoot,
      target,
      testRoot,
      ["--create"]
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Project initialization failed: Target parent must resolve to an existing directory/
    );
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal|at canonicalCandidate/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project initialization rejects a symlinked template source", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const externalSource = join(testRoot, "external-agent-policy.md");
    const templateSource = join(
      checkoutRoot,
      "project-templates",
      "AGENTS.md"
    );
    writeFileSync(externalSource, "external private policy bytes\n");
    rmSync(templateSource);
    symlinkSync(externalSource, templateSource);

    const result = runProjectInitializer(
      checkoutRoot,
      project,
      testRoot,
      ["--create"]
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Template must be a regular file: AGENTS\.md/);
    assert.equal(existsSync(project), false);
    assert.equal(
      readFileSync(externalSource, "utf8"),
      "external private policy bytes\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test(
  "project initialization rejects a starter symlink that appears mid-run",
  () => {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const project = join(workspaceRoot, "project-a");
      const externalTarget = join(testRoot, "external-private.txt");
      mkdirSync(project);
      writeFileSync(externalTarget, "external private bytes\n");

      const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
      const initializer = readFileSync(initializerPath, "utf8");
      const needle = "    const destination = join(canonicalTarget, ...parts);";
      assert.ok(initializer.includes(needle), "starter injection point must exist");
      assert.equal(
        initializer.indexOf(needle),
        initializer.lastIndexOf(needle),
        "starter injection point must be unique"
      );
      writeFileSync(
        initializerPath,
        initializer.replace(
          needle,
          needle +
            `\n` +
            `    if (relativePath === "AGENTS.md") {\n` +
            `      symlinkSync(${JSON.stringify(externalTarget)}, destination);\n` +
            `    }`
        )
      );

      const result = runProjectInitializer(checkoutRoot, project, testRoot);
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /(?:appeared during initialization|Managed project path must be a real file)/
      );
      assert.equal(
        readFileSync(externalTarget, "utf8"),
        "external private bytes\n"
      );
      assert.equal(lstatSync(join(project, "AGENTS.md")).isSymbolicLink(), true);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  },
  { needsSymlinks: true }
);

await test("project initialization does not follow a replaced managed parent", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const externalParent = join(testRoot, "external-parent");
    mkdirSync(project);
    mkdirSync(externalParent);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle =
      "    copyTrackedFile(templateContents.get(relativePath), destination);";
    assert.ok(initializer.includes(needle), "parent injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `    if (relativePath === "docs/engineering/git-workflow.md") {\n` +
          `      const managedParent = join(canonicalTarget, "docs", "engineering");\n` +
          `      renameSync(managedParent, managedParent + ".original");\n` +
          `      symlinkSync(${JSON.stringify(externalParent)}, managedParent, "dir");\n` +
          `    }\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Managed parent (?:changed during initialization|must be a real directory)/
    );
    assert.equal(existsSync(join(externalParent, "git-workflow.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project initialization pins the original target directory", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const originalProject = `${project}.original`;
    mkdirSync(project);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "    const destination = join(canonicalTarget, ...parts);";
    assert.ok(initializer.includes(needle), "target injection point must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "target injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        needle +
          `\n` +
          `    if (relativePath === "CLAUDE.md") {\n` +
          `      renameSync(canonicalTarget, ${JSON.stringify(originalProject)});\n` +
          `      mkdirSync(canonicalTarget);\n` +
          `    }`
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Managed parent changed during initialization/);
    assert.equal(existsSync(join(project, "CLAUDE.md")), false);
    assert.equal(existsSync(join(originalProject, "AGENTS.md")), true);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization never replaces a late directory arrival", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "    mkdirSync(leaf);";
    assert.ok(initializer.includes(needle), "directory claim injection point must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "directory claim injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "    mkdirSync(leaf);\n" +
          needle
      )
    );

    const result = runProjectInitializer(
      checkoutRoot,
      project,
      testRoot,
      ["--create"]
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EEXIST|file already exists/i);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
    assert.deepEqual(readdirSync(project), []);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization fails before rewriting a vanished starter", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, "AGENTS.md"), "project-owned policy\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "    const expected = managedFileAnchors.get(destination);";
    assert.ok(initializer.includes(needle), "starter disappearance injection must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "starter disappearance injection must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `    if (relativePath === "AGENTS.md") rmSync(destination);\n` + needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AGENTS\.md disappeared during initialization/);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
    assert.equal(existsSync(join(project, "CLAUDE.md")), false);
    assert.equal(existsSync(join(project, ".gitignore")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization preflights parents before starter writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const writeMarker = join(testRoot, "starter-write-attempted.txt");
    mkdirSync(project);
    writeFileSync(join(project, "docs"), "user-owned file\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "function copyTrackedFile(expectedContents, destination) {";
    assert.ok(initializer.includes(needle), "copy marker injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        needle +
          `\n  writeFileSync(${JSON.stringify(writeMarker)}, destination + "\\n", { flag: "a" });`
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Managed parent must be a real directory/);
    assert.equal(existsSync(writeMarker), false);
    assert.deepEqual(readdirSync(project), ["docs"]);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("existing project guidance is preserved and gitignore entries merge", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    const gitResult = spawnSync("git", ["init", "-q"], {
      cwd: project,
      encoding: "utf8",
      shell: false
    });
    assert.equal(gitResult.status, 0, gitResult.stderr);
    writeFileSync(join(project, "AGENTS.md"), "custom project policy\n");
    writeFileSync(join(project, "CLAUDE.md"), "@AGENTS.md\ncustom adapter\n");
    writeFileSync(join(project, ".gitignore"), "dist/\n");
    writeFileSync(join(project, ".env.example"), "SAFE=value\n");

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "custom project policy\n"
    );
    assert.equal(
      readFileSync(join(project, "CLAUDE.md"), "utf8"),
      "@AGENTS.md\ncustom adapter\n"
    );
    const ignore = readFileSync(join(project, ".gitignore"), "utf8");
    assert.match(ignore, /^dist\/$/m);
    for (const entry of [
      "CLAUDE.local.md",
      ".claude/settings.local.json",
      ".agent-work/",
      ".env",
      ".env.*",
      "!.env.example",
      ".DS_Store",
      "Thumbs.db"
    ]) {
      const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(ignore, new RegExp(`^${escaped}$`, "m"));
    }
    assert.ok(ignore.indexOf(".env\n.env.*\n!.env.example") >= 0);
    assert.equal(gitCheckIgnore(project, ".env.example").status, 1);
    assert.equal(gitCheckIgnore(project, ".env.local").status, 0);
    assert.equal(gitCheckIgnore(project, ".env.production").status, 0);
    assert.match(result.stdout, /Preserved: AGENTS\.md, CLAUDE\.md/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("ambiguous existing environment ignore policy is preserved for review", () => {
  for (const original of [
    ".env\n!.env.example\n",
    ".env.*\n!.env.example\n"
  ]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const project = join(workspaceRoot, "project-a");
      mkdirSync(project);
      const gitResult = spawnSync("git", ["init", "-q"], {
        cwd: project,
        encoding: "utf8",
        shell: false
      });
      assert.equal(gitResult.status, 0, gitResult.stderr);
      writeFileSync(join(project, ".gitignore"), original);

      const result = runProjectInitializer(checkoutRoot, project, testRoot);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /environment rules.*manual review/i);
      assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), original);
      assert.equal(existsSync(join(project, "AGENTS.md")), false);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("ineffective env example exception is preserved for review", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    const gitResult = spawnSync("git", ["init", "-q"], {
      cwd: project,
      encoding: "utf8",
      shell: false
    });
    assert.equal(gitResult.status, 0, gitResult.stderr);
    const original = ".env\n.env.*\n!.env.example\n*.example\n";
    writeFileSync(join(project, ".gitignore"), original);

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /environment rules.*manual review/i);
    assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), original);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("environment variant exceptions are preserved for review", () => {
  for (const exception of ["!*.production", "!*.development"]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const project = join(workspaceRoot, "project-a");
      mkdirSync(project);
      const original = `.env\n.env.*\n!.env.example\n${exception}\n`;
      writeFileSync(join(project, ".gitignore"), original);

      const result = runProjectInitializer(checkoutRoot, project, testRoot);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /environment rules.*manual review/i);
      assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), original);
      assert.equal(existsSync(join(project, "AGENTS.md")), false);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("project rollback preserves a concurrent gitignore and its original backup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );
    writeFileSync(join(project, ".gitignore"), "dist/\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "          descriptor = openSync(";
    assert.ok(initializer.includes(needle), "rollback injection point must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "rollback injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "          writeFileSync(basename(gitignorePath), \"concurrent ignore\\n\", { flag: \"wx\" });\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.equal(
      readFileSync(join(project, ".gitignore"), "utf8"),
      "concurrent ignore\n"
    );
    const backups = readdirSync(project).filter((name) =>
      name.startsWith(".gitignore.machine-bootstrap-") && name.endsWith(".backup")
    );
    assert.equal(backups.length, 1);
    assert.equal(readFileSync(join(project, backups[0]), "utf8"), "dist/\n");
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.match(result.stderr, /original preserved at/);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project cleanup preserves a replaced gitignore backup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, ".gitignore"), "dist/\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  if (gitignoreBackup) {";
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "backup cleanup injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `  const displacedBackup = gitignoreBackup + ".original";\n` +
          `  renameSync(gitignoreBackup, displacedBackup);\n` +
          `  writeFileSync(gitignoreBackup, "concurrent backup\\n");\n\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /backup remains.*changed concurrently/i);
    const backups = readdirSync(project).filter((name) =>
      name.startsWith(".gitignore.machine-bootstrap-")
    );
    assert.equal(backups.length, 2);
    const concurrentBackup = backups.find((name) => !name.endsWith(".original"));
    const originalBackup = backups.find((name) => name.endsWith(".original"));
    assert.equal(readFileSync(join(project, concurrentBackup), "utf8"), "concurrent backup\n");
    assert.equal(readFileSync(join(project, originalBackup), "utf8"), "dist/\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback never restores a replaced gitignore backup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, ".gitignore"), "dist/\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "          descriptor = openSync(";
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "backup replacement injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `          renameSync(gitignoreBackup, gitignoreBackup + ".original");\n` +
          `          writeFileSync(gitignoreBackup, "replacement backup\\n");\n` +
          `          throw new Error("injected backup replacement");\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /backup changed concurrently.*manual recovery/i);
    assert.equal(existsSync(join(project, ".gitignore")), false);
    const backups = readdirSync(project).filter((name) =>
      name.startsWith(".gitignore.machine-bootstrap-")
    );
    assert.equal(backups.length, 2);
    const replacement = backups.find((name) => !name.endsWith(".original"));
    const original = backups.find((name) => name.endsWith(".original"));
    assert.equal(readFileSync(join(project, replacement), "utf8"), "replacement backup\n");
    assert.equal(readFileSync(join(project, original), "utf8"), "dist/\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization revalidates a preserved gitignore", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    const canonicalIgnore = readFileSync(
      join(checkoutRoot, "project-templates", ".gitignore")
    );
    writeFileSync(join(project, ".gitignore"), canonicalIgnore);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  if (!entryExists(gitignorePath)) {";
    assert.ok(initializer.includes(needle), "gitignore injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `  renameSync(gitignorePath, gitignorePath + ".original");\n` +
          `  writeFileSync(gitignorePath, "dist/\\n");\n\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /.gitignore changed during initialization/);
    assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), "dist/\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization revalidates every seeded file", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "seed verification injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  renameSync(join(canonicalTarget, \"AGENTS.md\"), join(canonicalTarget, \"AGENTS.md.original\"));\n" +
          "  writeFileSync(join(canonicalTarget, \"AGENTS.md\"), \"concurrent replacement policy\\n\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AGENTS\.md changed during initialization/);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "concurrent replacement policy\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization revalidates every preserved starter file", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, "AGENTS.md"), "original project policy\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "preserved verification injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  renameSync(join(canonicalTarget, \"AGENTS.md\"), join(canonicalTarget, \"AGENTS.md.original\"));\n" +
          "  writeFileSync(join(canonicalTarget, \"AGENTS.md\"), \"concurrent preserved policy\\n\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AGENTS\.md changed during initialization/);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "concurrent preserved policy\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback preserves a file changed after ownership review", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    let initializer = readFileSync(initializerPath, "utf8");
    const ownershipNeedle =
      "          if (isOwnedFile(transaction, quarantineLeaf)) {";
    const failureNeedle =
      "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(ownershipNeedle), "ownership injection point must exist");
    assert.ok(initializer.includes(failureNeedle), "failure injection point must exist");
    initializer = initializer.replace(
      ownershipNeedle,
      ownershipNeedle +
        `\n            if (transaction.destination.endsWith("AGENTS.md")) {` +
        ` writeFileSync(quarantineLeaf, "concurrent after review\\n"); }`
    );
    initializer = initializer.replace(
      failureNeedle,
      `  throw new Error("injected rollback failure");\n\n` + failureNeedle
    );
    writeFileSync(initializerPath, initializer);

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    const quarantines = readdirSync(project).filter((name) =>
      name.startsWith("AGENTS.md.rollback-")
    );
    assert.equal(quarantines.length, 1);
    assert.equal(
      readFileSync(join(project, quarantines[0]), "utf8"),
      "concurrent after review\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback preserves a concurrently changed starter file", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "late rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  writeFileSync(join(canonicalTarget, \"AGENTS.md\"), \"concurrent user policy\\n\");\n" +
          "  throw new Error(\"injected late failure\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected late failure/);
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "concurrent user policy\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback preserves a concurrent starter directory in place", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "directory rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  const concurrentStarter = join(canonicalTarget, \"AGENTS.md\");\n" +
          "  rmSync(concurrentStarter);\n" +
          "  mkdirSync(concurrentStarter);\n" +
          "  writeFileSync(join(concurrentStarter, \"keep.txt\"), \"keep me\\n\");\n" +
          "  throw new Error(\"injected starter directory replacement\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected starter directory replacement/);
    const starter = join(project, "AGENTS.md");
    assert.equal(lstatSync(starter).isDirectory(), true);
    assert.equal(readFileSync(join(starter, "keep.txt"), "utf8"), "keep me\n");
    assert.equal(
      readdirSync(project).some((name) => name.startsWith("AGENTS.md.rollback-")),
      false
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback never dereferences a concurrent starter symlink", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const externalTarget = join(testRoot, "external-private.txt");
    mkdirSync(project);
    writeFileSync(externalTarget, "external private bytes\n");
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "symlink rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `  const concurrentStarter = join(canonicalTarget, "AGENTS.md");\n` +
          `  const linkResult = spawnSync(process.execPath, [\n` +
          `    "-e",\n` +
          `    "const { symlinkSync, unlinkSync } = require('node:fs'); " +\n` +
          `      "unlinkSync(process.argv[1]); symlinkSync(process.argv[2], process.argv[1]);",\n` +
          `    concurrentStarter,\n` +
          `    ${JSON.stringify(externalTarget)}\n` +
          `  ], { encoding: "utf8", shell: false });\n` +
          `  if (linkResult.status !== 0) throw new Error(linkResult.stderr);\n` +
          `  throw new Error("injected symlink replacement");\n\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected symlink replacement/);
    const restoredStarter = join(project, "AGENTS.md");
    assert.equal(lstatSync(restoredStarter).isSymbolicLink(), true);
    assert.equal(readlinkSync(restoredStarter), externalTarget);
    assert.equal(readFileSync(externalTarget, "utf8"), "external private bytes\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project rollback preserves a concurrently replaced empty directory", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "directory rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  const concurrentDirectory = join(canonicalTarget, \"docs\", \"engineering\");\n" +
          "  renameSync(concurrentDirectory, `${concurrentDirectory}.concurrent-original`);\n" +
          "  mkdirSync(concurrentDirectory);\n" +
          "  throw new Error(\"injected directory replacement\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected directory replacement/);
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.match(result.stderr, /docs.*engineering.*not removed.*manually/i);
    assert.equal(existsSync(join(project, "docs", "engineering")), true);
    assert.equal(
      existsSync(join(project, "docs", "engineering.concurrent-original")),
      true
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback reports a run-created directory with concurrent content", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "directory content injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  writeFileSync(join(canonicalTarget, \".github\", \"concurrent.txt\"), \"keep me\\n\");\n" +
          "  throw new Error(\"injected concurrent directory content\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected concurrent directory content/);
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.match(result.stderr, /\.github.*not removed.*manually/i);
    assert.equal(
      readFileSync(join(project, ".github", "concurrent.txt"), "utf8"),
      "keep me\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback never deletes directories by pathname", () => {
  const initializer = readFileSync(
    join(bootstrapRoot, "scripts", "init-project.mjs"),
    "utf8"
  );
  assert.doesNotMatch(initializer, /\brmdirSync\b/);
  assert.doesNotMatch(initializer, /unlinkSync\(quarantineLeaf\)/);
  assert.match(initializer, /review directory cleanup manually/);
  assert.match(initializer, /review target cleanup manually/);
  assert.match(initializer, /run-owned entry preserved at/);
});

await test("project initialization rejects a Git-owned workspace", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    for (const root of [project, workspaceRoot]) {
      const gitResult = spawnSync("git", ["init", "-q"], {
        cwd: root,
        encoding: "utf8",
        shell: false
      });
      assert.equal(gitResult.status, 0, gitResult.stderr);
    }

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workspace root must stay outside Git/);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project target boundaries reject unsafe or ambiguous roots", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const outside = join(testRoot, "outside");
    mkdirSync(outside);
    const outsideResult = runProjectInitializer(checkoutRoot, outside, testRoot);
    assert.notEqual(outsideResult.status, 0);
    assert.match(outsideResult.stderr, /inside the workspace/);

    const bootstrapResult = runProjectInitializer(checkoutRoot, checkoutRoot, testRoot);
    assert.notEqual(bootstrapResult.status, 0);
    assert.match(bootstrapResult.stderr, /cannot be machine-bootstrap/);

    const project = join(workspaceRoot, "project-a");
    const nested = join(project, "nested");
    mkdirSync(nested, { recursive: true });
    const gitResult = spawnSync("git", ["init", "-q"], {
      cwd: project,
      encoding: "utf8",
      shell: false
    });
    assert.equal(gitResult.status, 0, gitResult.stderr);
    const nestedResult = runProjectInitializer(checkoutRoot, nested, testRoot);
    assert.notEqual(nestedResult.status, 0);
    assert.match(nestedResult.stderr, /must be its Git root/);
    assert.equal(existsSync(join(nested, "AGENTS.md")), false);

    const missingNested = join(project, "new-nested");
    const missingNestedResult = runProjectInitializer(
      checkoutRoot,
      missingNested,
      testRoot,
      ["--create"]
    );
    assert.notEqual(missingNestedResult.status, 0);
    assert.match(
      missingNestedResult.stderr,
      /cannot be created inside existing Git repository/
    );
    assert.equal(existsSync(missingNested), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

// --- Workflow foundation ------------------------------------------------
// These checks never make a model or API call and never need Claude Code or
// Codex authentication: they read canonical files and generated bytes only.

const workflowSourceRoot = join(bootstrapRoot, "workflows", "product-delivery");
const workflowManifest = JSON.parse(
  readFileSync(join(workflowSourceRoot, "manifest.json"), "utf8")
);

// Guidance assertions match prose regardless of line wrapping.
function readNormalized(root, relativePath) {
  return readFileSync(join(root, ...relativePath.split("/")), "utf8")
    .replace(/\s+/g, " ");
}

function readWorkflowSource(relativePath) {
  return readNormalized(workflowSourceRoot, relativePath);
}

await test("implementation reporting preserves waiver and status ownership", () => {
  const report = readWorkflowSource("templates/implementation-report.md");
  const plan = readWorkflowSource("templates/implementation-plan.md");
  const deliveryLead = readWorkflowSource("roles/delivery-lead.md");
  assert.match(report, /Independent review status.*pending.*waived/i);
  assert.match(report, /Waiver reason/i);
  assert.match(report, /pending unless.*waived/i);
  for (const source of [plan, deliveryLead]) {
    assert.match(
      source,
      /`implemented`, `not implemented`, `deferred`, or `self-unverified`|implemented \/ not implemented \/ deferred \/ self-unverified/
    );
  }
  assert.match(
    deliveryLead,
    /Verifier and Verification Report alone use final `passed`, `failed`, `unverified`, and `skipped`/
  );
  assert.match(plan, /Independent results belong only in the Verification Report/);
  assert.doesNotMatch(deliveryLead, /check you did not run is `unverified`/);
});

await test("one living Implementation Plan replaces the brief and plan gates", () => {
  const workflow = readWorkflowSource("WORKFLOW.md");
  const deliveryLead = readWorkflowSource("roles/delivery-lead.md");
  const productPartner = readWorkflowSource("roles/product-partner.md");
  const plan = readWorkflowSource("templates/implementation-plan.md");

  // The plan carries every section the consolidated contract requires.
  for (const heading of [
    "Request And Outcome",
    "Authorized Scope",
    "Proposed Changes Awaiting Decision",
    "Findings And Approach",
    "Phases",
    "Deferred Work And Deviations",
    "Questions, Assumptions, And Decisions",
    "Verification",
    "Checkpoint"
  ]) {
    assert.match(plan, new RegExp(`## ${heading}`), `plan section ${heading}`);
  }
  assert.match(plan, /\| AC1 \|/);
  assert.match(plan, /Scope revision \| r1/);
  assert.match(plan, /Status is bookkeeping, never approval/);
  assert.match(plan, /plan-only request does not authorize implementation/i);
  for (const item of [
    "Done",
    "Current",
    "Blockers \\/ open questions",
    "Next action",
    "Repository state",
    "Pending review findings"
  ]) {
    assert.match(plan, new RegExp(`\\*\\*${item}:\\*\\*`), `checkpoint ${item}`);
  }

  // The retired gates and plan-change invalidation are gone.
  for (const source of [workflow, deliveryLead, productPartner]) {
    assert.doesNotMatch(source, /Two Approval Gates|never merged/);
    assert.doesNotMatch(source, /invalidates (its previous|dependent)/);
    assert.doesNotMatch(source, /re-request approval/);
    assert.doesNotMatch(source, /need an approved Product Brief/);
  }

  // Authorized scope is separate from routine progress.
  assert.match(workflow, /\*\*Authorized scope\*\*/);
  assert.match(workflow, /\*\*Execution record\*\*/);
  assert.match(workflow, /Routine updates to it never invalidate authorization and never trigger another approval request/);
  assert.match(workflow, /Honor authorization already present in the conversation/);
  assert.match(workflow, /does not require the user to approve the same work again/);
  assert.match(workflow, /A request to plan first, or for a plan alone, does not authorize implementation/);
  assert.match(workflow, /never split it into separate approvals of different sections/);
  assert.match(workflow, /obtain the user's decision before the affected action/);
  assert.match(workflow, /Pause dependent work; continue independent work that remains authorized/);
  assert.match(workflow, /keep the prior criterion wording readable/);
  assert.match(workflow, /Silence, an artifact status, a checked box, or an agent's assertion is never user approval/);
  assert.match(workflow, /A plan-only request never authorizes implementation/);

  // Delivery Lead is the default owner; Product Partner is optional.
  assert.match(workflow, /\*\*Delivery Lead\*\* \| The default entry point and accountable owner/);
  assert.match(workflow, /\*\*Product Partner\*\* \| Optional specialist/);
  assert.match(workflow, /exactly one active owner/);
  assert.match(deliveryLead, /Ask the user directly/);
  assert.match(deliveryLead, /you need no Product Partner handoff first/);
  assert.match(productPartner, /create `implementation-plan\.md` and own it/);
  assert.match(productPartner, /Hand ownership to the Delivery Lead/);
  assert.match(productPartner, /Alignment review does not replace the independent Verifier/);

  // Clarification and resumption are explicit.
  assert.match(workflow, /Do not repeat a question the user already answered or reliable repository evidence settles/);
  assert.match(workflow, /Consult the plan before starting a new phase, before delegating, when resuming interrupted work, and before final self-review and independent verification/);
  assert.match(workflow, /inspect the actual branch, commit, and working diff/);
  assert.match(workflow, /Do not restart discovery automatically/);
  assert.match(workflow, /A checked box is a claim, not proof of completion/);
  assert.match(deliveryLead, /Consult the plan before each new phase, before delegating, when resuming/);

  // Authorization covers what the user described, nothing the agent adds.
  assert.match(workflow, /Authorization covers what the user described and the non-material detail needed to deliver it/);
  assert.match(workflow, /work may proceed on them/);
  assert.match(deliveryLead, /proceed, without asking the user to confirm each one/);
  // The guard half: material additions never ride in as assumptions.
  assert.match(workflow, /material change is a proposal, not part of the baseline, until the user decides/);
  assert.match(deliveryLead, /A material addition is a proposal until the user decides/);
  assert.match(plan, /Change user-confirmed items only through a recorded user decision/);
  assert.match(plan, /Material additions belong under Proposed Changes/);

  // No live guidance or template reintroduces the retired gates.
  const liveGuidance = [
    "README.md",
    "INIT.md",
    "docs/guidance-loading-smoke.md",
    "project-templates/AGENTS.md",
    "project-templates/TEMPLATE-USAGE.md"
  ].map((relativePath) => [relativePath, readNormalized(bootstrapRoot, relativePath)]);
  for (const template of workflowManifest.templates) {
    liveGuidance.push([template.source, readWorkflowSource(template.source)]);
  }
  liveGuidance.push(["WORKFLOW.md", workflow], ["delivery-lead", deliveryLead], ["product-partner", productPartner]);
  for (const [label, source] of liveGuidance) {
    assert.doesNotMatch(source, /approval gates?|separate (brief|plan) approval/i, `${label} gate wording`);
    assert.doesNotMatch(source, /(product brief|delivery plan|brief|plan) approval/i, `${label} artifact approval`);
    assert.doesNotMatch(source, /approv\w* (of )?(the|an?|this) exact\b/i, `${label} exact-version approval`);
    assert.doesNotMatch(
      source,
      /(approval|sign-?off) (of|on|for) (it|(the|this|that) (plan|brief|version))\b|approve (the |this |that )?(plan|brief|it)\b|(before|until) (the user|you) (approves?|signs? off)/i,
      `${label} rephrased plan approval`
    );
    assert.doesNotMatch(source, /begin Product Partner discovery/i, `${label} mandatory discovery`);
  }
  const starter = readNormalized(bootstrapRoot, "project-templates/AGENTS.md");
  assert.match(starter, /continues an active Implementation Plan/);
  assert.match(starter, /Additional material-change triggers/);

  // Workflow 3.0.0 retired 1.x support: no live source keeps the old
  // artifacts, their activation clause, or consolidation rules.
  assert.match(workflow, /3\. The task continues an active Implementation Plan\. 4\./);
  for (const [label, source] of [...liveGuidance, ["verifier", readWorkflowSource("roles/verifier.md")]]) {
    assert.doesNotMatch(source, /\b1\.x\b|Product Brief|Delivery Plan/, `${label} legacy support`);
  }
});

await test("task artifacts are local working records deleted on completion", () => {
  const workflow = readWorkflowSource("WORKFLOW.md");
  const deliveryLead = readWorkflowSource("roles/delivery-lead.md");
  assert.match(workflow, /They are working records, never committed/);
  assert.match(workflow, /carry the durable outcome .* into the PR body/);
  assert.match(workflow, /delete the task folder, preferring a recoverable trash/);
  assert.match(workflow, /cite the PR or commit, never a task folder/);
  assert.match(deliveryLead, /delete its task folder/);
  for (const relativePath of [
    "README.md",
    "project-templates/AGENTS.md",
    "project-templates/TEMPLATE-USAGE.md"
  ]) {
    const source = readNormalized(bootstrapRoot, relativePath);
    assert.doesNotMatch(source, /\[TASK |tracks? (each )?completed/, `${relativePath} artifact tracking`);
  }
  const starterIgnore = readFileSync(
    join(bootstrapRoot, "project-templates", ".gitignore"),
    "utf8"
  );
  assert.match(starterIgnore, /^\.agent-work\/$/m);
});

await test("independent review semantics survive the consolidation", () => {
  const workflow = readWorkflowSource("WORKFLOW.md");
  const deliveryLead = readWorkflowSource("roles/delivery-lead.md");
  const verifier = readWorkflowSource("roles/verifier.md");
  const report = readWorkflowSource("templates/verification-report.md");

  assert.match(workflow, /Only the user may waive that review for a specific change/);
  assert.match(deliveryLead, /Only the user may waive independent review for a specific change/);
  assert.match(workflow, /The independent reviewer must not have implemented the change/);
  assert.match(workflow, /implementer claims, which never establish an independent pass/);
  assert.match(workflow, /an earlier pass does not cover a new diff/);
  assert.match(workflow, /Product Partner alignment review never replaces technical verification/);
  assert.match(workflow, /After the first independent review, the plan owner gives a firm recommendation/);
  assert.match(workflow, /Honor the user's request/);
  assert.match(workflow, /records it in the Verification Report/);
  assert.match(deliveryLead, /fresh independent Verifier that did not implement the change/);
  assert.match(deliveryLead, /an earlier pass does not cover it/);
  assert.match(verifier, /You did not implement the change you review/);
  assert.match(verifier, /never count them as an independent pass/);
  assert.match(verifier, /Record the repository state you reviewed/);
  assert.match(verifier, /decision history/);
  for (const outcome of ["Passed", "Failed", "Unverified", "Skipped"]) {
    assert.match(verifier, new RegExp(`\\*\\*${outcome}\\*\\* —`));
  }
  assert.match(verifier, /Missing evidence is never a pass/);
  assert.match(report, /## Repository State Reviewed/);
  assert.match(report, /covers only this state/);
  assert.match(report, /Additional review recommendation/);
  assert.match(report, /sole owner of final independent passed, failed, unverified, and skipped judgments/);
});

await test("workflow package versions, names, and templates stay consistent", () => {
  const version = workflowManifest.workflowVersion;
  assert.match(
    readFileSync(join(workflowSourceRoot, "WORKFLOW.md"), "utf8"),
    new RegExp(`version \`${version.replaceAll(".", "\\.")}\``)
  );

  // Existing role ids, provider agent names, and profiles remain supported.
  assert.deepEqual(
    workflowManifest.roles.map((role) => [
      role.id,
      role.claude.name,
      role.claude.primarySession,
      role.codex.name,
      role.codex.profile ?? null
    ]),
    [
      ["product-partner", "mb-product-partner", true, "mb_product_partner", "mb-product-partner"],
      ["delivery-lead", "mb-delivery-lead", true, "mb_delivery_lead", "mb-delivery-lead"],
      ["verifier", "mb-verifier", false, "mb_verifier", null]
    ]
  );
  // Only the Verifier, which never edits the change it reviews, loses Claude's
  // file-editing tools; it keeps the shell to run the project's checks.
  assert.deepEqual(
    workflowManifest.roles.map((role) => [role.id, role.claude.disallowedTools ?? null]),
    [
      ["product-partner", null],
      ["delivery-lead", null],
      ["verifier", ["Edit", "Write", "NotebookEdit"]]
    ]
  );

  // Every template file is declared, so none can be left unowned.
  const declared = workflowManifest.templates.map((template) => template.source).sort();
  const present = readdirSync(join(workflowSourceRoot, "templates"))
    .map((name) => `templates/${name}`)
    .sort();
  assert.deepEqual(declared, present);
  const templateIds = workflowManifest.templates.map((template) => template.id);
  for (const id of ["implementation-plan", "verification-report"]) {
    assert.ok(templateIds.includes(id), `normal artifact ${id} is declared`);
  }

  for (const source of declared) {
    const template = readFileSync(join(workflowSourceRoot, ...source.split("/")), "utf8");
    assert.match(
      template,
      new RegExp(`Workflow: \`product-delivery\` ${version.replaceAll(".", "\\.")}`),
      `${source} names the current workflow version`
    );
  }

  for (const retired of ["product-brief", "delivery-plan"]) {
    assert.equal(templateIds.includes(retired), false, `${retired} is retired`);
  }
  for (const optional of ["implementation-report", "alignment-review", "decision-log", "change-request"]) {
    const template = readWorkflowSource(`templates/${optional}.md`);
    assert.match(template, /Optional\./, `${optional} is marked optional`);
    assert.match(template, /plan/i);
  }
  const workflow = readWorkflowSource("WORKFLOW.md");
  assert.match(workflow, /normally creates only the Implementation Plan and the Verification Report/);
  assert.match(workflow, /never restates or overrides the plan's requirements/);
});

function workflowRelativePaths(manifest) {
  return [
    "manifest.json",
    manifest.workflowDocument,
    ...manifest.roles.map((role) => role.source),
    ...manifest.templates.map((template) => template.source)
  ];
}

function defaultAdapterPath(home, adapter) {
  const providerRoot = join(
    home,
    adapter.provider === "claude" ? ".claude" : ".codex"
  );
  return join(providerRoot, ...adapter.segments);
}

function snapshotTree(root) {
  const entries = [];
  const walk = (directory, prefix) => {
    const found = readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name)
    );
    for (const entry of found) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(directory, entry.name), relativePath);
      } else {
        const digest = createHash("sha256")
          .update(readFileSync(join(directory, entry.name)))
          .digest("hex");
        entries.push(`${relativePath}:${digest}`);
      }
    }
  };
  walk(root, "");
  return entries;
}

await test("workflow manifests and sources fail closed when invalid", async () => {
  const { loadWorkflowPackages } = await import("./lib/workflow-manifest.mjs");
  const testRoot = createTestHome("workflow-manifest");
  try {
    const workflowsRoot = join(testRoot, "workflows");
    cpSync(join(bootstrapRoot, "workflows"), workflowsRoot, {
      recursive: true
    });

    const { packages } = loadWorkflowPackages(workflowsRoot);
    assert.equal(packages.length, 1);
    assert.equal(packages[0].workflowId, "product-delivery");
    assert.equal(packages[0].manifest.roles.length, 3);

    const manifestPath = join(
      workflowsRoot,
      "product-delivery",
      "manifest.json"
    );
    const registryPath = join(workflowsRoot, "registry.json");
    const originalManifest = readFileSync(manifestPath, "utf8");
    const originalRegistry = readFileSync(registryPath, "utf8");

    const mutateManifest = (change) => {
      const manifest = JSON.parse(originalManifest);
      change(manifest);
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    };

    for (const [label, change, pattern] of [
      [
        "unsupported schema",
        (m) => { m.schemaVersion = 2; },
        /Unsupported workflow manifest/
      ],
      [
        "id does not match its directory",
        (m) => { m.workflowId = "somewhere-else"; },
        /does not match its directory/
      ],
      [
        "non-semver version",
        (m) => { m.workflowVersion = "1.0"; },
        /Invalid workflow version/
      ],
      [
        "traversing role source",
        (m) => { m.roles[0].source = "../escape.md"; },
        /unsafe source path/
      ],
      [
        "absent role source",
        (m) => { m.roles[0].source = "roles/absent.md"; },
        /must be a readable regular file/
      ],
      [
        "absent template source",
        (m) => { m.templates[0].source = "templates/absent.md"; },
        /must be a readable regular file/
      ],
      [
        "plugin-scoped Claude name",
        (m) => { m.roles[0].claude.name = "plugin:partner"; },
        /invalid Claude adapter/
      ],
      [
        "hyphenated Codex agent name",
        (m) => { m.roles[0].codex.name = "mb-product-partner"; },
        /invalid Codex adapter/
      ],
      [
        "empty Claude tool restriction",
        (m) => { m.roles[0].claude.disallowedTools = []; },
        /invalid Claude adapter/
      ],
      [
        "Claude tool restriction with a specifier",
        (m) => { m.roles[0].claude.disallowedTools = ["Bash(git push *)"]; },
        /invalid Claude adapter/
      ],
      [
        "Claude tool restriction that breaks YAML",
        (m) => { m.roles[0].claude.disallowedTools = ["Edit\nmodel: opus"]; },
        /invalid Claude adapter/
      ],
      [
        "duplicate Claude tool restriction",
        (m) => { m.roles[0].claude.disallowedTools = ["Edit", "Edit"]; },
        /invalid Claude adapter/
      ],
      [
        "duplicate Claude name",
        (m) => { m.roles[1].claude.name = m.roles[0].claude.name; },
        /Duplicate Claude agent name/
      ],
      [
        "duplicate Codex profile",
        (m) => { m.roles[1].codex.profile = m.roles[0].codex.profile; },
        /Duplicate Codex profile name/
      ],
      [
        "multi-line summary",
        (m) => { m.roles[0].summary = "first line\nsecond line"; },
        /single-line summary/
      ],
      [
        "no roles",
        (m) => { m.roles = []; },
        /declares no roles/
      ],
      [
        "no templates",
        (m) => { m.templates = []; },
        /declares no templates/
      ]
    ]) {
      mutateManifest(change);
      assert.throws(
        () => loadWorkflowPackages(workflowsRoot),
        pattern,
        `${label} must be rejected`
      );
    }

    writeFileSync(manifestPath, originalManifest);
    assert.equal(loadWorkflowPackages(workflowsRoot).packages.length, 1);

    for (const [label, contents, pattern] of [
      ["invalid JSON", "{ not json\n", /must contain valid JSON/],
      [
        "unsupported registry schema",
        '{ "schemaVersion": 9, "workflows": ["product-delivery"] }\n',
        /Unsupported workflow registry/
      ],
      [
        "empty roster",
        '{ "schemaVersion": 1, "workflows": [] }\n',
        /Unsupported workflow registry/
      ],
      [
        "traversing workflow id",
        '{ "schemaVersion": 1, "workflows": ["../escape"] }\n',
        /Invalid workflow id/
      ],
      [
        "unknown workflow",
        '{ "schemaVersion": 1, "workflows": ["absent-workflow"] }\n',
        /must be a readable regular file/
      ]
    ]) {
      writeFileSync(registryPath, contents);
      assert.throws(
        () => loadWorkflowPackages(workflowsRoot),
        pattern,
        `${label} must be rejected`
      );
    }

    writeFileSync(registryPath, originalRegistry);
    assert.equal(loadWorkflowPackages(workflowsRoot).packages.length, 1);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test(
  "absent provider overrides use the default configuration roots",
  () => {
  const testHome = createTestHome("workflow-install");
  try {
    const result = runScript("install-workflows.mjs", [], testHome);
    assert.equal(result.status, 0, result.stderr);

    const installedRoot = join(
      testHome,
      ".agents",
      "workflows",
      "product-delivery"
    );
    for (const relativePath of workflowRelativePaths(workflowManifest)) {
      const segments = relativePath.split("/");
      assert.deepEqual(
        readFileSync(join(installedRoot, ...segments)),
        readFileSync(join(workflowSourceRoot, ...segments)),
        `${relativePath} must install byte-identically`
      );
    }

    for (const role of workflowManifest.roles) {
      assert.equal(
        existsSync(join(testHome, ".claude", "agents", `${role.claude.name}.md`)),
        true,
        `${role.id} Claude agent`
      );
      assert.equal(
        existsSync(join(testHome, ".codex", "agents", `${role.codex.name}.toml`)),
        true,
        `${role.id} Codex agent`
      );
      assert.equal(
        existsSync(
          join(testHome, ".codex", `${role.codex.profile ?? "absent"}.config.toml`)
        ),
        Boolean(role.codex.profile),
        `${role.id} Codex profile`
      );
    }

    // Provider settings and agent teams are never created or enabled.
    assert.equal(existsSync(join(testHome, ".claude", "settings.json")), false);
    assert.equal(existsSync(join(testHome, ".codex", "config.toml")), false);

    const verify = runScript("install-workflows.mjs", ["--check"], testHome);
    assert.equal(verify.status, 0, verify.stderr);
    assert.match(verify.stdout, /Verified 1 workflow\(s\)/);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
  }
);

await test("custom provider configuration roots receive only their adapters", () => {
  const testHome = createTestHome("workflow-custom-provider-roots");
  const claudeConfigRoot = join(testHome, "provider-roots", "claude");
  const codexHome = join(testHome, "provider-roots", "codex");
  const preserved = [
    [join(claudeConfigRoot, "settings.json"), '{ "custom": "claude" }\n'],
    [join(claudeConfigRoot, "agents", "mine.md"), "# mine\n"],
    [join(codexHome, "config.toml"), 'custom = "codex"\n'],
    [join(codexHome, "agents", "mine.toml"), 'name = "mine"\n'],
    [
      join(testHome, ".claude", "settings.json"),
      '{ "inactiveDefault": "claude" }\n'
    ],
    [
      join(testHome, ".codex", "config.toml"),
      'inactive_default = "codex"\n'
    ]
  ];
  try {
    for (const [path, contents] of preserved) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }

    const overrides = {
      CLAUDE_CONFIG_DIR: claudeConfigRoot,
      CODEX_HOME: codexHome
    };
    const result = runScript("install-workflows.mjs", [], testHome, overrides);
    assert.equal(result.status, 0, result.stderr);

    for (const role of workflowManifest.roles) {
      assert.equal(
        existsSync(join(claudeConfigRoot, "agents", `${role.claude.name}.md`)),
        true,
        `${role.id} Claude agent uses CLAUDE_CONFIG_DIR`
      );
      assert.equal(
        existsSync(join(codexHome, "agents", `${role.codex.name}.toml`)),
        true,
        `${role.id} Codex agent uses CODEX_HOME`
      );
      if (role.codex.profile) {
        assert.equal(
          existsSync(join(codexHome, `${role.codex.profile}.config.toml`)),
          true,
          `${role.id} Codex profile uses CODEX_HOME`
        );
      }
      assert.equal(
        existsSync(join(testHome, ".claude", "agents", `${role.claude.name}.md`)),
        false,
        "the default Claude root is not used when overridden"
      );
      assert.equal(
        existsSync(join(testHome, ".codex", "agents", `${role.codex.name}.toml`)),
        false,
        "the default Codex root is not used when overridden"
      );
    }

    for (const [path, contents] of preserved) {
      assert.equal(readFileSync(path, "utf8"), contents, path);
    }
    assert.equal(
      existsSync(
        join(testHome, ".agents", "workflows", "product-delivery", "WORKFLOW.md")
      ),
      true,
      "the provider-neutral package remains under the isolated home"
    );

    const verify = runScript(
      "install-workflows.mjs",
      ["--check"],
      testHome,
      overrides
    );
    assert.equal(verify.status, 0, verify.stderr);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("provider adapters generate deterministically", async () => {
  const { loadWorkflowPackages } = await import("./lib/workflow-manifest.mjs");
  const { generateProviderAdapters } = await import(
    "./lib/workflow-adapters.mjs"
  );
  const { packages } = loadWorkflowPackages(join(bootstrapRoot, "workflows"));

  const first = generateProviderAdapters(packages[0]);
  const second = generateProviderAdapters(packages[0]);
  assert.deepEqual(second, first);
  assert.equal(first.length, 8);

  const homeA = createTestHome("workflow-determinism-a");
  const homeB = createTestHome("workflow-determinism-b");
  try {
    for (const home of [homeA, homeB]) {
      const result = runScript("install-workflows.mjs", [], home);
      assert.equal(result.status, 0, result.stderr);
    }
    for (const adapter of first) {
      const relativePath = `${adapter.provider}/${adapter.segments.join("/")}`;
      assert.deepEqual(
        readFileSync(defaultAdapterPath(homeA, adapter)),
        readFileSync(defaultAdapterPath(homeB, adapter)),
        `${relativePath} must be identical across installs`
      );
      assert.equal(
        readFileSync(defaultAdapterPath(homeA, adapter), "utf8"),
        adapter.contents,
        `${relativePath} must match its generated bytes`
      );
    }
  } finally {
    rmSync(homeA, { recursive: true, force: true });
    rmSync(homeB, { recursive: true, force: true });
  }
});

await test("Codex TOML encoding round-trips adversarial Markdown contracts", async () => {
  const testRoot = createTestHome("workflow-toml-fixture");
  const source = join(testRoot, "role.md");
  const fixture =
    "  leading whitespace\r\n" +
    'Double quotes: "quoted" and triple: """\r\n' +
    "Single delimiter too: '''\r\n" +
    "Windows path: C:\\Users\\Example\\workflow.md\r\n" +
    "\r\n```powershell\r\n" +
    'Write-Output "héllo 世界"\r\n' +
    "```\r\n" +
    "TOML controls: " +
    Array.from({ length: 0x20 }, (_, index) => String.fromCharCode(index)).join("") +
    String.fromCharCode(0x7f) +
    "\r\n" +
    "trailing whitespace   ";
  const normalizedFixture = fixture
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n") + "\n";
  try {
    writeFileSync(source, fixture);
    const role = {
      id: "adversarial",
      summary: 'Quotes " and path C:\\docs\\role',
      source: "role.md",
      claude: { name: "adversarial", primarySession: true },
      codex: { name: "adversarial", profile: "adversarial" }
    };
    const pkg = {
      root: testRoot,
      manifest: {
        workflowId: "fixture",
        workflowVersion: "1.0.0",
        schemaVersion: 1
      }
    };
    const { generateCodexAgent, generateCodexProfile } = await import(
      "./lib/workflow-adapters.mjs"
    );

    const externalParser = process.env.MACHINE_BOOTSTRAP_TOML_PYTHON;
    let externallyParsed = 0;
    for (const generated of [
      generateCodexAgent(pkg, role),
      generateCodexProfile(pkg, role)
    ]) {
      const encoded =
        generated.match(/^developer_instructions = (.+)$/m)?.[1] ?? "null";
      assert.equal(JSON.parse(encoded), normalizedFixture);
      assert.equal(
        encoded,
        JSON.stringify(normalizedFixture).replaceAll("\u007f", "\\u007F")
      );
      assert.match(generated, /\\"\\"\\"/);
      assert.match(generated, /C:\\\\Users\\\\Example/);
      assert.match(generated, /héllo 世界/);
      assert.doesNotMatch(generated, /\u007f/);
      assert.match(generated, /\\u007F/);
      assert.doesNotMatch(generated, /^developer_instructions = '''/m);

      if (externalParser) {
        const parsed = spawnSync(
          externalParser,
          [
            "-c",
            "import sys, tomllib; tomllib.loads(sys.stdin.read())"
          ],
          {
            encoding: "utf8",
            env: { ...process.env, PYTHONUTF8: "1" },
            input: generated,
            shell: false
          }
        );
        assert.equal(parsed.status, 0, parsed.stderr || parsed.error?.message);
        externallyParsed += 1;
      }
    }
    if (externalParser) {
      console.log(
        `TOML parser validation: Python tomllib parsed ${externallyParsed} ` +
        "adversarial fixture(s)"
      );
    } else {
      console.log(
        "TOML parser validation: not run; set " +
        "MACHINE_BOOTSTRAP_TOML_PYTHON to an available Python 3.11+ executable"
      );
    }
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("adapters carry provenance and the canonical role contract", () => {
  const testHome = createTestHome("workflow-provenance");
  try {
    assert.equal(runScript("install-workflows.mjs", [], testHome).status, 0);
    const version = workflowManifest.workflowVersion.replaceAll(".", "\\.");

    for (const role of workflowManifest.roles) {
      const contract = readFileSync(
        join(workflowSourceRoot, ...role.source.split("/")),
        "utf8"
      )
        .replaceAll("\r\n", "\n")
        .replaceAll("\r", "\n");
      const normalizedContract = contract.endsWith("\n")
        ? contract
        : `${contract}\n`;

      const claudeFile = readFileSync(
        join(testHome, ".claude", "agents", `${role.claude.name}.md`),
        "utf8"
      );
      assert.match(claudeFile, new RegExp(`^---\\nname: ${role.claude.name}\\n`));
      assert.match(claudeFile, /^description: "/m);
      const frontmatter = claudeFile.split("\n---\n")[0];
      if (role.claude.disallowedTools) {
        assert.match(
          frontmatter,
          new RegExp(`^disallowedTools: ${role.claude.disallowedTools.join(", ")}$`, "m")
        );
      } else {
        assert.doesNotMatch(frontmatter, /disallowedTools/);
      }
      assert.match(claudeFile, /Generated by machine-bootstrap/);
      assert.match(
        claudeFile,
        new RegExp(`workflow: product-delivery ${version} \\(schema 1\\)`)
      );
      assert.match(claudeFile, new RegExp(`role: ${role.id}\\b`));
      assert.match(
        claudeFile,
        new RegExp(`source: workflows/product-delivery/${role.source}`)
      );
      assert.ok(
        claudeFile.includes(normalizedContract),
        `${role.id} Claude adapter must carry the canonical contract`
      );

      const codexFile = readFileSync(
        join(testHome, ".codex", "agents", `${role.codex.name}.toml`),
        "utf8"
      );
      assert.match(codexFile, /^# Generated by machine-bootstrap/);
      assert.match(codexFile, new RegExp(`^name = "${role.codex.name}"$`, "m"));
      assert.match(codexFile, /^description = "/m);
      const codexInstructions = JSON.parse(
        codexFile.match(/^developer_instructions = (.+)$/m)?.[1] ?? "null"
      );
      assert.equal(
        codexInstructions,
        normalizedContract,
        `${role.id} Codex adapter must carry the canonical contract`
      );

      if (!role.codex.profile) continue;
      const profile = readFileSync(
        join(testHome, ".codex", `${role.codex.profile}.config.toml`),
        "utf8"
      );
      assert.match(
        profile,
        new RegExp(`Launch: codex --profile ${role.codex.profile}`)
      );
      const profileInstructions = JSON.parse(
        profile.match(/^developer_instructions = (.+)$/m)?.[1] ?? "null"
      );
      assert.equal(profileInstructions, normalizedContract);
      // Profiles are separate files with top-level keys, not [profiles.x]
      // tables inside config.toml.
      assert.doesNotMatch(profile, /^\[profiles\./m);
    }
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("generated adapters pin no model", () => {
  const testHome = createTestHome("workflow-model");
  try {
    assert.equal(runScript("install-workflows.mjs", [], testHome).status, 0);

    const claudeAgents = join(testHome, ".claude", "agents");
    const codexAgents = join(testHome, ".codex", "agents");
    const codexHome = join(testHome, ".codex");
    const generated = [
      ...readdirSync(claudeAgents).map((name) => join(claudeAgents, name)),
      ...readdirSync(codexAgents).map((name) => join(codexAgents, name)),
      ...readdirSync(codexHome)
        .filter((name) => name.endsWith(".config.toml"))
        .map((name) => join(codexHome, name))
    ];
    assert.equal(generated.length, 8);

    for (const file of generated) {
      const contents = readFileSync(file, "utf8");
      assert.doesNotMatch(contents, /^\s*model\s*[:=]/m, file);
      assert.doesNotMatch(contents, /^\s*model_reasoning_effort\s*=/m, file);
      assert.doesNotMatch(
        contents,
        /claude-(opus|sonnet|haiku|fable)|gpt-\d|\bo\d-(mini|preview)\b/i,
        file
      );
    }
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("workflow installation leaves unrelated provider files untouched", () => {
  const testHome = createTestHome("workflow-untouched");
  try {
    const preserved = [
      [join(testHome, ".claude", "settings.json"), '{ "theme": "dark" }\n'],
      [
        join(testHome, ".claude", "agents", "my-own-agent.md"),
        "---\nname: my-own-agent\ndescription: mine\n---\n\nMine.\n"
      ],
      [join(testHome, ".codex", "config.toml"), 'approval_policy = "on-request"\n'],
      [
        join(testHome, ".codex", "agents", "my_own_agent.toml"),
        'name = "my_own_agent"\n'
      ],
      [join(testHome, ".codex", "my-own.config.toml"), 'sandbox_mode = "read-only"\n'],
      [join(testHome, ".agents", "skills", "keep", "SKILL.md"), "# keep\n"]
    ];
    for (const [path, contents] of preserved) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }

    const result = runScript("install-workflows.mjs", [], testHome);
    assert.equal(result.status, 0, result.stderr);

    for (const [path, contents] of preserved) {
      assert.equal(readFileSync(path, "utf8"), contents, path);
    }
    for (const directory of [
      join(testHome, ".claude"),
      join(testHome, ".claude", "agents"),
      join(testHome, ".codex"),
      join(testHome, ".codex", "agents")
    ]) {
      assert.equal(
        readdirSync(directory).some((name) => name.includes(".backup-")),
        false,
        `${directory} must have no backups`
      );
    }
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("workflow installation is missing-only by default", () => {
  const testHome = createTestHome("workflow-missing-only");
  try {
    assert.equal(runScript("install-workflows.mjs", [], testHome).status, 0);

    const adapterPath = join(testHome, ".claude", "agents", "mb-verifier.md");
    const workflowDocument = join(
      testHome,
      ".agents",
      "workflows",
      "product-delivery",
      "WORKFLOW.md"
    );
    const documentBefore = readFileSync(workflowDocument);
    rmSync(adapterPath);

    const second = runScript("install-workflows.mjs", [], testHome);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /Placed .*mb-verifier\.md/);
    assert.equal(
      (second.stdout.match(/^Placed /gm) ?? []).length,
      1,
      "only the missing adapter is written"
    );
    assert.match(second.stdout, /Current: .*WORKFLOW\.md/);
    assert.deepEqual(readFileSync(workflowDocument), documentBefore);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("a differing workflow destination is rejected before any write", () => {
  const testHome = createTestHome("workflow-drift");
  try {
    const adapterPath = join(testHome, ".claude", "agents", "mb-verifier.md");
    mkdirSync(dirname(adapterPath), { recursive: true });
    writeFileSync(adapterPath, "my own verifier\n");

    const result = runScript("install-workflows.mjs", [], testHome);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires review before making changes/);
    assert.match(result.stderr, /use --replace if approved/);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/);

    assert.equal(readFileSync(adapterPath, "utf8"), "my own verifier\n");
    assert.equal(existsSync(join(testHome, ".agents")), false);
    assert.equal(existsSync(join(testHome, ".codex")), false);
    assert.deepEqual(readdirSync(join(testHome, ".claude", "agents")), [
      "mb-verifier.md"
    ]);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("reviewed workflow replacement preserves recoverable backups", () => {
  const testHome = createTestHome("workflow-replace");
  try {
    const adapterPath = join(testHome, ".claude", "agents", "mb-verifier.md");
    const documentPath = join(
      testHome,
      ".agents",
      "workflows",
      "product-delivery",
      "WORKFLOW.md"
    );
    for (const [path, contents] of [
      [adapterPath, "customized verifier\n"],
      [documentPath, "customized workflow\n"]
    ]) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }

    const result = runScript("install-workflows.mjs", ["--replace"], testHome);
    assert.equal(result.status, 0, result.stderr);

    assert.match(readFileSync(adapterPath, "utf8"), /^---\nname: mb-verifier\n/);
    assert.deepEqual(
      readFileSync(documentPath),
      readFileSync(join(workflowSourceRoot, "WORKFLOW.md"))
    );

    for (const [path, contents] of [
      [adapterPath, "customized verifier\n"],
      [documentPath, "customized workflow\n"]
    ]) {
      const backupName = readdirSync(dirname(path)).find((name) =>
        name.startsWith(`${path.split(sep).pop()}.backup-`)
      );
      assert.ok(backupName, `${path} was preserved as a backup`);
      assert.equal(
        readFileSync(join(dirname(path), backupName), "utf8"),
        contents
      );
    }

    const verify = runScript("install-workflows.mjs", ["--check"], testHome);
    assert.equal(verify.status, 0, verify.stderr);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("an older workflow installation upgrades only through reviewed replacement", () => {
  const testHome = createTestHome("workflow-upgrade");
  try {
    assert.equal(runScript("install-workflows.mjs", [], testHome).status, 0);
    const installedRoot = join(testHome, ".agents", "workflows", "product-delivery");
    const planTemplate = join(installedRoot, "templates", "implementation-plan.md");
    const leadAdapter = join(testHome, ".claude", "agents", "mb-delivery-lead.md");

    // Model an older installation: every bootstrap-owned file differs, the
    // manifest declares the old version, and the Implementation Plan template
    // does not exist yet. A template the new version no longer declares is
    // left untouched, because the installer never deletes undeclared files.
    const legacy = new Map();
    for (const relativePath of workflowRelativePaths(workflowManifest)) {
      if (relativePath === "templates/implementation-plan.md") continue;
      legacy.set(
        join(installedRoot, ...relativePath.split("/")),
        `older ${relativePath}\n`
      );
    }
    legacy.set(
      join(installedRoot, "manifest.json"),
      `${JSON.stringify({ ...workflowManifest, workflowVersion: "2.1.0" }, null, 2)}\n`
    );
    const undeclared = join(installedRoot, "templates", "product-brief.md");
    const undeclaredContents = "# Product Brief — deprecated\n";
    for (const role of workflowManifest.roles) {
      legacy.set(
        join(testHome, ".claude", "agents", `${role.claude.name}.md`),
        `---\nname: ${role.claude.name}\n---\n\nolder ${role.id}\n`
      );
      legacy.set(
        join(testHome, ".codex", "agents", `${role.codex.name}.toml`),
        `name = "${role.codex.name}"\ndeveloper_instructions = "legacy"\n`
      );
      if (role.codex.profile) {
        legacy.set(
          join(testHome, ".codex", `${role.codex.profile}.config.toml`),
          'developer_instructions = "legacy"\n'
        );
      }
    }
    for (const [path, contents] of legacy) writeFileSync(path, contents);
    writeFileSync(undeclared, undeclaredContents);
    rmSync(planTemplate);
    const legacySnapshot = snapshotTree(testHome);

    // Default installation names every conflict and writes nothing, including
    // the missing Implementation Plan template.
    const refused = runScript("install-workflows.mjs", [], testHome);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /requires review before making changes/);
    for (const path of legacy.keys()) {
      assert.ok(refused.stderr.includes(path), `${path} is reported for review`);
    }
    assert.deepEqual(snapshotTree(testHome), legacySnapshot);
    assert.equal(refused.stderr.includes(undeclared), false);

    const replaced = runScript("install-workflows.mjs", ["--replace"], testHome);
    assert.equal(replaced.status, 0, replaced.stderr);
    assert.equal(
      (replaced.stdout.match(/^Backed up /gm) ?? []).length,
      legacy.size,
      "every legacy file is backed up exactly once"
    );
    assert.match(replaced.stdout, /^Placed .*implementation-plan\.md$/m);
    for (const relativePath of workflowRelativePaths(workflowManifest)) {
      const segments = relativePath.split("/");
      assert.deepEqual(
        readFileSync(join(installedRoot, ...segments)),
        readFileSync(join(workflowSourceRoot, ...segments)),
        `${relativePath} upgraded byte-identically`
      );
    }
    const upgradedLead = readFileSync(leadAdapter, "utf8");
    const version = workflowManifest.workflowVersion.replaceAll(".", "\\.");
    assert.match(upgradedLead, new RegExp(`workflow: product-delivery ${version} \\(schema 1\\)`));
    assert.match(upgradedLead, /own the living Implementation Plan/);

    // Each legacy file is recoverable from exactly one backup.
    for (const [path, contents] of legacy) {
      const backups = readdirSync(dirname(path)).filter((name) =>
        name.startsWith(`${path.split(sep).pop()}.backup-`)
      );
      assert.equal(backups.length, 1, `${path} has one backup`);
      assert.equal(readFileSync(join(dirname(path), backups[0]), "utf8"), contents);
    }

    assert.equal(readFileSync(undeclared, "utf8"), undeclaredContents);

    // Repeating the reviewed replacement is idempotent: no writes, no backups.
    const upgradedSnapshot = snapshotTree(testHome);
    const repeated = runScript("install-workflows.mjs", ["--replace"], testHome);
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.doesNotMatch(repeated.stdout, /^(Placed|Backed up) /m);
    assert.deepEqual(snapshotTree(testHome), upgradedSnapshot);

    const verify = runScript("install-workflows.mjs", ["--check"], testHome);
    assert.equal(verify.status, 0, verify.stderr);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("a later workflow failure restores replacements and removes partial writes", () => {
  const testHome = createTestHome("workflow-rollback");
  const installedRoot = join(
    testHome,
    ".agents",
    "workflows",
    "product-delivery"
  );
  const manifestPath = join(installedRoot, "manifest.json");
  const claudeRoot = join(testHome, "custom-claude");
  const adapterPath = join(claudeRoot, "agents", "mb-product-partner.md");
  // This is absent during root validation but becomes a regular workflow file
  // before the Codex phase, forcing a deterministic late ENOTDIR failure.
  const codexHome = join(installedRoot, "WORKFLOW.md");
  try {
    mkdirSync(dirname(manifestPath), { recursive: true });
    mkdirSync(dirname(adapterPath), { recursive: true });
    writeFileSync(manifestPath, "original manifest\n");
    writeFileSync(adapterPath, "original Claude adapter\n");

    const result = runScript(
      "install-workflows.mjs",
      ["--replace"],
      testHome,
      { CLAUDE_CONFIG_DIR: claudeRoot, CODEX_HOME: codexHome }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workflow setup failed:/);
    assert.equal(readFileSync(manifestPath, "utf8"), "original manifest\n");
    assert.equal(
      readFileSync(adapterPath, "utf8"),
      "original Claude adapter\n"
    );
    assert.deepEqual(readdirSync(installedRoot), ["manifest.json"]);
    assert.deepEqual(readdirSync(join(claudeRoot, "agents")), [
      "mb-product-partner.md"
    ]);
    assert.equal(
      snapshotTree(testHome).some((entry) => entry.includes(".backup-")),
      false,
      "restored originals leave no orphan backup"
    );
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("workflow check mode is read-only", () => {
  const testHome = createTestHome("workflow-check");
  try {
    const missing = runScript("install-workflows.mjs", ["--check"], testHome);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Workflow verification failed:/);
    assert.match(missing.stderr, /is missing/);
    assert.doesNotMatch(missing.stderr, /file:\/\/|node:internal/);
    assert.deepEqual(readdirSync(testHome), [], "check mode wrote nothing");

    assert.equal(runScript("install-workflows.mjs", [], testHome).status, 0);
    const before = snapshotTree(testHome);

    const verify = runScript("install-workflows.mjs", ["--check"], testHome);
    assert.equal(verify.status, 0, verify.stderr);
    assert.doesNotMatch(verify.stdout, /^Placed /m);
    assert.deepEqual(snapshotTree(testHome), before);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("workspace initialization installs and verifies workflows", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), true);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "_templates")), false);
    assert.equal(
      existsSync(
        join(testRoot, ".agents", "workflows", "product-delivery", "WORKFLOW.md")
      ),
      true
    );
    assert.equal(
      existsSync(join(testRoot, ".claude", "agents", "mb-delivery-lead.md")),
      true
    );
    assert.equal(
      existsSync(join(testRoot, ".codex", "agents", "mb_verifier.toml")),
      true
    );
    assert.equal(
      existsSync(join(testRoot, ".codex", "mb-product-partner.config.toml")),
      true
    );
    assert.match(result.stdout, /Verified 1 workflow\(s\)/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("workspace initialization preflights workflow conflicts before writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  const conflict = join(testRoot, ".claude", "agents", "mb-verifier.md");
  try {
    mkdirSync(dirname(conflict), { recursive: true });
    writeFileSync(conflict, "my verifier\n");

    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workflow preflight failed:/);
    assert.match(result.stderr, /mb-verifier\.md/);
    assert.equal(readFileSync(conflict, "utf8"), "my verifier\n");
    for (const path of ["AGENTS.md", "CLAUDE.md", "MACHINE.md", "_templates"]) {
      assert.equal(existsSync(join(workspaceRoot, path)), false, path);
    }
    assert.equal(existsSync(join(testRoot, ".agents")), false);
    assert.equal(existsSync(join(testRoot, ".codex")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("--skip-workflows performs no workflow writes or verification", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Workflow foundation: skipped by request/);
    assert.doesNotMatch(result.stdout, /Verified 1 workflow\(s\)/);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), true);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "_templates")), false);
    assert.equal(existsSync(join(testRoot, ".agents")), false);
    assert.equal(existsSync(join(testRoot, ".claude")), false);
    assert.equal(existsSync(join(testRoot, ".codex")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("malformed workflow data fails before workspace writes", () => {
  for (const [label, relativePath, contents, pattern] of [
    [
      "invalid manifest JSON",
      join("workflows", "product-delivery", "manifest.json"),
      "{ invalid json\n",
      /Workflow manifest must contain valid JSON/
    ],
    [
      "invalid registry roster",
      join("workflows", "registry.json"),
      '{ "schemaVersion": 1, "workflows": ["../escape"] }\n',
      /Invalid workflow id/
    ]
  ]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      writeFileSync(join(checkoutRoot, relativePath), contents);

      const result = spawnSync(
        process.execPath,
        [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
        {
          encoding: "utf8",
          env: isolatedEnvironment(testRoot),
          shell: false
        }
      );

      assert.notEqual(result.status, 0, label);
      assert.match(result.stderr, pattern, label);
      assert.doesNotMatch(
        result.stderr,
        /file:\/\/|node:internal|SyntaxError/,
        label
      );
      assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false, label);
      assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false, label);
      assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false, label);
      assert.equal(existsSync(join(workspaceRoot, "_templates")), false, label);
      assert.equal(existsSync(join(testRoot, ".agents")), false, label);
      assert.equal(existsSync(join(testRoot, ".claude")), false, label);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("a missing role contract fails before any workflow write", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    rmSync(
      join(checkoutRoot, "workflows", "product-delivery", "roles", "verifier.md")
    );

    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must be a readable regular file/);
    assert.doesNotMatch(result.stderr, /ENOENT|file:\/\/|node:internal/);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(testRoot, ".agents")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("workflow setup rejects bad arguments without stack traces", () => {
  for (const scriptArgs of [["--bogus"], ["--check", "--replace"]]) {
    const result = runScript("install-workflows.mjs", scriptArgs);
    const label = `install-workflows.mjs ${scriptArgs.join(" ")}`;
    assert.notEqual(result.status, 0, label);
    assert.match(result.stderr, /Workflow setup failed:/, label);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/, label);
  }

  const skipped = runScript("init-workspace.mjs", ["--skip-workflow"]);
  assert.notEqual(skipped.status, 0);
  assert.match(skipped.stderr, /Unknown argument\(s\): --skip-workflow/);
  assert.doesNotMatch(skipped.stderr, /file:\/\/|node:internal/);
});

if (failures.length) {
  console.error(`\n${failures.length} bootstrap test(s) failed:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (skipped.length) {
  const byReason = new Map();
  for (const entry of skipped) {
    if (!byReason.has(entry.reason)) byReason.set(entry.reason, []);
    byReason.get(entry.reason).push(entry.name);
  }

  console.log(`\n${skipped.length} test(s) skipped:`);
  for (const [reason, names] of byReason) {
    console.log(`\n${reason}:`);
    for (const name of names) console.log(`- ${name}`);
  }
  if (!rosterInstalled) {
    console.log(
      "\nRun node scripts/init-workspace.mjs, then rerun to cover the roster " +
      "checks."
    );
  }
}

console.log(
  `\nAll executed bootstrap tests passed${skipped.length ? ` (${skipped.length} skipped)` : ""}.`
);
