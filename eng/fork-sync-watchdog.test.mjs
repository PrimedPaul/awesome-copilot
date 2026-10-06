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
const pushScript = workflow
  .split("      - name: Push upstream mirror branch\n")[1]
  .split("        run: |\n")[1]
  .split("\n      - name:")[0]
  .replace(/^          /gm, "");
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
  const commit = (message, parent) =>
    git("commit-tree", tree, "-m", message, ...(parent ? ["-p", parent] : []));
  const base = commit("base");
  const upstream = commit("upstream", base);
  const divergent = commit("divergent", base);
  git("update-ref", "refs/remotes/upstream/main", upstream);
  git("push", "origin", `${upstream}:refs/heads/main`, `${divergent}:refs/heads/divergent`);
  const setMirror = (sha) => git("--git-dir", remote, "update-ref", mirrorRef, sha);
  const mirror = () => git("--git-dir", remote, "rev-parse", mirrorRef);
  const run = (prefix = "") =>
    spawnSync("bash", ["-e", "-c", prefix + pushScript], { cwd: local, encoding: "utf8" });
  return { git, remote, base, upstream, divergent, setMirror, mirror, run };
}

test("creates a missing mirror branch", (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.mirror(), f.upstream);
});

test("fast-forwards an existing mirror branch", (t) => {
  const f = fixture(t);
  f.setMirror(f.base);
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.mirror(), f.upstream);
});

test("refreshes a diverged mirror that a normal push rejects", (t) => {
  const f = fixture(t);
  f.setMirror(f.divergent);
  assert.throws(() => f.git("push", "origin", `upstream/main:${mirrorRef}`), /non-fast-forward/);
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.mirror(), f.upstream);
});

test("rejects a concurrent update after reading the mirror tip", (t) => {
  const f = fixture(t);
  f.setMirror(f.base);
  const result = f.run(`
git() {
  if [ "$1" = "push" ]; then
    command git --git-dir="${f.remote}" update-ref ${mirrorRef} ${f.divergent}
  fi
  command git "$@"
}
`);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /stale info/);
  assert.equal(f.mirror(), f.divergent);
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
});
