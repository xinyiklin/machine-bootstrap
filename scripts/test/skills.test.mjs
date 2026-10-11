// Skill roster, acquisition integrity, first-party skills, and provider skill roots.
// Runs through scripts/test-bootstrap.mjs; see harness.mjs for shared helpers.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  scriptDir,
  bootstrapRoot,
  failures,
  manifestSkills,
  createTestWorkspace,
  isolatedEnvironment,
  runScript,
  createSkillInstallerFixture,
  test,
  readNormalized,
  snapshotTree
} from "./harness.mjs";

await test("manifest pins direct Git sources and skill content", async () => {
  const manifest = JSON.parse(
    readFileSync(join(bootstrapRoot, "skills.json"), "utf8")
  );
  const { hashDirectory } = await import("../lib/skill-integrity.mjs");

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
  const { hashDirectory } = await import("../lib/skill-integrity.mjs");
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
  const { hashDirectory } = await import("../lib/skill-integrity.mjs");
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

    const { hashDirectory } = await import("../lib/skill-integrity.mjs");
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
    const { hashDirectory } = await import("../lib/skill-integrity.mjs");
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
  const { fetchReviewedSource } = await import("../lib/skill-source.mjs");
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

    const { materializeReviewedSkill } = await import("../lib/skill-source.mjs");
    const { hashDirectory } = await import("../lib/skill-integrity.mjs");
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
    const { hashDirectory } = await import("../lib/skill-integrity.mjs");

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
