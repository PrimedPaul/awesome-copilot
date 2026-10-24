import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const workflow = fs.readFileSync(
  new URL("../.github/workflows/fork-sync-watchdog.md", import.meta.url),
  "utf8"
);
function stepScript(name) {
  return workflow
    .split(`      - name: ${name}\n`)[1]
    .split("        run: |\n")[1]
    .split(/\n      - name:|\n  agent:/)[0]
    .replace(/^          /gm, "");
}
const pushScript = stepScript("Safely update upstream sync branch");
const prScript = stepScript("Open or reuse sync PR");
const mirrorRef = "refs/heads/fork-sync/upstream";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-sync-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, "remote.git");
  const local = path.join(root, "local");
  fs.mkdirSync(local);
  const git = (...args) =>
    execFileSync("git", args, { cwd: local, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  git("init", "--bare", remote);
  git("init");
  git("config", "user.name", "Sync Test");
  git("config", "user.email", "sync-test@example.com");
  git("remote", "add", "origin", remote);
  const tree = git("mktree");
  const commit = (message, ...parents) =>
    git("commit-tree", tree, "-m", message, ...parents.flatMap((parent) => ["-p", parent]));
  const base = commit("base");
  const upstream = commit("upstream", base);
  const divergent = commit("divergent", base);
  const resolved = commit("resolve conflicts", upstream, divergent);
  git("update-ref", "refs/remotes/upstream/main", upstream);
  git("push", "origin", `${upstream}:refs/heads/main`, `${resolved}:refs/heads/resolved`);
  const setMirror = (sha) => git("--git-dir", remote, "update-ref", mirrorRef, sha);
  const mirror = () => git("--git-dir", remote, "rev-parse", mirrorRef);
  const outputPath = path.join(root, "output");
  const run = (prefix = "", script = pushScript, env = {}) => {
    fs.writeFileSync(outputPath, "");
    return spawnSync("bash", ["-e", "-c", prefix + script], {
      cwd: local,
      encoding: "utf8",
      env: {
        ...process.env,
        GH_TOKEN: "",
        GITHUB_TOKEN: "",
        FORK_AUTOMATION_PAT: "",
        GITHUB_OUTPUT: outputPath.replaceAll("\\", "/"),
        GITHUB_REPOSITORY: "test/fork",
        UPSTREAM_SHA: upstream,
        BRANCH_CHANGED: "false",
        TMPDIR: root.replaceAll("\\", "/"),
        ...env,
      },
    });
  };
  const outputs = () => Object.fromEntries(
    fs.readFileSync(outputPath, "utf8").trim().split("\n").filter(Boolean).map((line) => line.split("="))
  );
  return { git, remote, base, upstream, divergent, resolved, setMirror, mirror, run, outputs };
}

test("creates a missing mirror branch", (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.mirror(), f.upstream);
  assert.equal(f.outputs().branch_changed, "true");
});

test("fast-forwards an existing mirror branch", (t) => {
  const f = fixture(t);
  f.setMirror(f.base);
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.mirror(), f.upstream);
  assert.equal(f.outputs().branch_changed, "true");
});

test("rejects divergence without overwriting commits", (t) => {
  const f = fixture(t);
  f.setMirror(f.divergent);
  assert.throws(() => f.git("push", "origin", `upstream/main:${mirrorRef}`), /non-fast-forward/);
  const result = f.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /::error::.*has diverged/);
  assert.equal(f.mirror(), f.divergent);
  assert.deepEqual(f.outputs(), {});
});

test("does not push when the sync branch is unchanged", (t) => {
  const f = fixture(t);
  f.setMirror(f.upstream);
  const result = f.run(`
git() {
  if [ "$1" = "push" ]; then
    echo "unexpected push" >&2
    return 1
  fi
  command git "$@"
}
`);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.mirror(), f.upstream);
  assert.equal(f.outputs().branch_changed, "false");
});

test("preserves merge-conflict resolutions that already contain upstream", (t) => {
  const f = fixture(t);
  f.setMirror(f.resolved);
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.mirror(), f.resolved);
  assert.equal(f.outputs().branch_changed, "false");
});

test("stops when upstream advances beyond a resolved sync branch", (t) => {
  const f = fixture(t);
  f.setMirror(f.resolved);
  const tree = f.git("rev-parse", `${f.upstream}^{tree}`);
  const next = f.git("commit-tree", tree, "-m", "next upstream", "-p", f.upstream);
  f.git("update-ref", "refs/remotes/upstream/main", next);
  const result = f.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /::error::.*has diverged/);
  assert.equal(f.mirror(), f.resolved);
  assert.deepEqual(f.outputs(), {});
});

test("rejects a concurrent update after reading the mirror tip", (t) => {
  const f = fixture(t);
  f.setMirror(f.base);
  const result = f.run(`
git() {
  if [ "$1" = "push" ]; then
    command git --git-dir="${f.remote.replaceAll("\\", "/")}" update-ref ${mirrorRef} ${f.divergent}
  fi
  command git "$@"
}
`);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /stale info/);
  assert.equal(f.mirror(), f.divergent);
  assert.deepEqual(f.outputs(), {});
});

test("rejects a concurrently created branch", (t) => {
  const f = fixture(t);
  const result = f.run(`
git() {
  if [ "$1" = "push" ]; then
    command git --git-dir="${f.remote.replaceAll("\\", "/")}" update-ref ${mirrorRef} ${f.divergent}
  fi
  command git "$@"
}
`);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /stale info/);
  assert.equal(f.mirror(), f.divergent);
  assert.deepEqual(f.outputs(), {});
});

test("stops when reading the remote tip fails", (t) => {
  const f = fixture(t);
  f.setMirror(f.base);
  const result = f.run(`
git() {
  if [ "$1" = "ls-remote" ]; then
    return 1
  fi
  command git "$@"
}
`);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(f.mirror(), f.base);
  assert.deepEqual(f.outputs(), {});
});

test("stops when fetching remote history fails", (t) => {
  const f = fixture(t);
  f.setMirror(f.base);
  const result = f.run(`
git() {
  if [ "$1" = "fetch" ]; then
    return 1
  fi
  command git "$@"
}
`);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(f.mirror(), f.base);
  assert.deepEqual(f.outputs(), {});
});

const mockGh = `
gh() {
  case "$1 $2" in
    "pr list") printf '%s' "$EXISTING_PR" ;;
    "pr create") echo "https://github.com/test/fork/pull/81" ;;
    *) echo "Unexpected gh invocation" >&2; return 1 ;;
  esac
}
`;

test("skips summaries for unchanged open sync PRs", (t) => {
  const f = fixture(t);
  f.setMirror(f.resolved);
  const push = f.run();
  assert.equal(push.status, 0, push.stdout + push.stderr);
  const result = f.run(mockGh, prScript, {
    EXISTING_PR: "75",
    BRANCH_CHANGED: f.outputs().branch_changed,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(f.outputs(), { pr_number: "75", summary_needed: "false" });
});

test("summarizes existing PRs after a fast-forward", (t) => {
  const f = fixture(t);
  f.setMirror(f.base);
  const push = f.run();
  assert.equal(push.status, 0, push.stdout + push.stderr);
  const result = f.run(mockGh, prScript, {
    EXISTING_PR: "75",
    BRANCH_CHANGED: f.outputs().branch_changed,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(f.outputs(), { pr_number: "75", summary_needed: "true" });
});

test("summarizes newly created PRs even when the branch is unchanged", (t) => {
  const f = fixture(t);
  const result = f.run(mockGh, prScript, { EXISTING_PR: "", BRANCH_CHANGED: "false" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(f.outputs(), { pr_number: "81", summary_needed: "true" });
});

test("does not continue after a PR lookup failure", (t) => {
  const f = fixture(t);
  const result = f.run("gh() { return 1; }\n", prScript);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.deepEqual(f.outputs(), {});
});

test("only starts the agent when the PR step requests a summary", () => {
  assert.match(workflow, /summary_needed: \$\{\{ steps\.pr\.outputs\.summary_needed \}\}/);
  assert.match(workflow, /BRANCH_CHANGED: \$\{\{ steps\.mirror\.outputs\.branch_changed \}\}/);
  assert.match(workflow, /  agent:\n    needs: \[sync\]\n    if: needs\.sync\.outputs\.summary_needed == 'true'/);
});
