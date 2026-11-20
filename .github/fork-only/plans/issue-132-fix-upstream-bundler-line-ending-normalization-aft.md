---
issue: 132
title: 'Fix upstream bundler line-ending normalization after upstream checkout'
scope: fork-tooling
status: draft
---

# Plan: issue #132

## Issue summary

- **Failing step** — `Regenerate README and marketplace (npm run build)` in `.github/workflows/fork-bundle-upstream-pr.yml` runs `bash eng/fix-line-endings.sh` after `git checkout --quiet -B "$PROMOTION_BRANCH" upstream/main`, and the script is missing there (exit 127).
- **Requested outcome** — LF normalization must work on an upstream-based checkout without adding fork-only files to the promotion or loosening the path guards.
- **Requested extras** — regression coverage for the missing-script case (including fail-closed out-of-allowlist paths), docs/PR-checklist updates if the command changes, and verified dry-run and non-dry-run preparation.
- **Restatement gap** — the issue says the script "exists on fork `main`", but `git log` shows it only at the fork's head commit; whether `github/awesome-copilot` `main` has it is not stated and I did not verify it.

## Grilling

### Ambiguities

- **Upstream script presence** — the issue says it was "absent from the upstream-based checkout"; if upstream deleted or never had it, the root cause is upstream drift, which affects whether to inline or fetch.
- **"Same normalization"** — the current script is `find . -name "*.md" -type f -exec sed -i 's/\r$//' {} \;`; unclear whether normalization should cover all `*.md` or only generated/promoted files.
- **Checklist wording** — the PR body claims `bash eng/fix-line-endings.sh` executed; unclear whether that literal text must remain if upstream has no such script.

### Scope

- **IN** — change only the normalization step in `.github/workflows/fork-bundle-upstream-pr.yml` (Build step, ~line 284) and the PR body checklist (~line 355).
- **IN** — a new test `eng/fork-bundle-upstream-pr.test.mjs` following the `eng/fork-sync-watchdog.test.mjs` pattern (extract step scripts from the workflow, run in temp git fixtures).
- **IN** — update the `fork-bundle-upstream-pr.yml` row in `.github/fork-only/README.md` (mentions `eng/fix-line-endings.sh`).
- **OUT** — `eng/fix-line-endings.sh` itself, other workflows that call it (`publish.yml`, `external-plugin-*`), the agent, plugin, skills.
- **OUT** — any change to the allowlist or the path guard logic beyond tests exercising it.

### Constraints

- **Fork-only** — workflow, test, and README edits are fork tooling and must never be promoted upstream; the promotion path allowlist already excludes them.
- **No plugin bump** — nothing under `plugins/oracle-to-postgres-migration-expert/` changes, so `plugin.json` `version` stays as is.
- **Guard order** — the final `/tmp/validate-promotion-paths.sh upstream/main` call must still run after normalization and `git add -A`.
- **Fork test location** — `eng/` also holds upstream-shared files; a fork-only test there is a promotion-path risk only if the allowlist widens (it does not).
- **Untracked check** — the guard fails on untracked files, so a script copied from fork `main` into the work tree must not be left behind.

### Assumptions I am making

- **Upstream may lack script** — I assume upstream `main` can lack `eng/fix-line-endings.sh` now or later, so the workflow should not depend on it.
- **Inline is preferable** — I assume an inline normalization in the workflow beats fetching the script from `origin/main` (no fork-file dependence, no untracked leftovers).
- **Scope of sed** — I assume normalizing only the files the build step stages (`README.md`, `docs/`, `.github/plugin/marketplace.json`, plus the promoted paths' `*.md`) is sufficient and safer than `find . -name "*.md"`.
- **Test approach** — I assume the existing text-extraction test pattern is acceptable instead of running the workflow with `act`.
- **No CRLF binary risk** — I assume the promoted `*.md` files are text, so `sed -i 's/\r$//'` is safe.

## Plan

- **Edit `.github/workflows/fork-bundle-upstream-pr.yml`, step "Regenerate README and marketplace"** — replace `bash eng/fix-line-endings.sh` with an inline block that lists staged/tracked `*.md` files via `git ls-files -z -- '*.md'` (after the build `git add`) and strips trailing `\r` with `sed -i 's/\r$//'`, then `git add -A` and the final guard call as today.
- **Edit same workflow, PR body checklist (~line 355)** — change the line to "Line endings normalized to LF (inline in the bundler; upstream checkout has no `eng/fix-line-endings.sh`)" or equivalent, matching Q1.
- **Edit `.github/fork-only/README.md`, bundler table row (~line 43)** — replace "`eng/fix-line-endings.sh`" with "an inline LF normalization".
- **Add `eng/fork-bundle-upstream-pr.test.mjs`** — extract the "Regenerate…" step script (as `stepScript` in `eng/fork-sync-watchdog.test.mjs`) and run it in a temp repo based on a fixture "upstream" without `eng/fix-line-endings.sh`, with stubbed `npm`:
  - **Success case** — a CRLF `*.md` in an allowed path is converted to LF, staged, and the guard passes.
  - **Fail-closed case** — a changed path outside the allowlist (e.g. `.github/fork-only/x.md`) makes the guard exit non-zero.
  - **No fork-script dependence** — the step succeeds with `eng/fix-line-endings.sh` absent.
  - **Workflow assertions** — the workflow no longer references `eng/fix-line-endings.sh`, and the "Push" and "Open or refresh" steps keep `if: ${{ !inputs.dry_run }}`.
- **Version bump** — none; no `plugin.json` change (fork tooling only).
- **Verification run** — after merge to fork `main`, dispatch the workflow with `dry_run: true` and confirm it reaches "Verify committed promotion paths" with no push.

## Acceptance criteria

- [ ] Dry run completes through Commit, "Verify committed promotion paths", and the diff summary, with no branch pushed and no PR opened.
- [ ] The workflow no longer requires `eng/fix-line-endings.sh` to exist on the upstream-based checkout.
- [ ] CRLF in promoted markdown and generated outputs is converted to LF.
- [ ] Out-of-allowlist paths still fail closed (test proves it).
- [ ] The non-dry-run path uses the identical preparation steps; only the `if: ${{ !inputs.dry_run }}` steps differ.
- [ ] `.github/fork-only/README.md` and the PR checklist text match the new command.
- [ ] No file outside the fork-only tooling set is changed; `plugin.json` version unchanged.

## Open questions

- **Q1 — checklist wording** — options: (a) keep the literal `bash eng/fix-line-endings.sh` line; (b) reword to describe inline LF normalization; I would pick (b), since the command is no longer run.
- **Q2 — normalization approach** — options: (a) inline `sed` in the workflow; (b) `git show origin/main:eng/fix-line-endings.sh` into `/tmp` and run it; (c) fall back to the script only if present; I would pick (a).
- **Q3 — normalization breadth** — options: (a) all tracked `*.md`; (b) only promoted and generated paths; I would pick (a) for parity with the old script, since the guard already limits what can be committed.
- **Q4 — test depth** — options: (a) extracted-step unit tests in `eng/`; (b) also a one-off real dry run on fork `main`; I would pick both.

## Verification

- `node --test eng/fork-bundle-upstream-pr.test.mjs`
- `node --test eng/fork-sync-watchdog.test.mjs eng/validate-fork-plan-lifecycle.test.mjs` (neighbouring tests still pass)
- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- **Workflow dry run** — dispatch Fork Bundle Upstream PR with `dry_run: true` and check the job summary shows the promotion diff and that no branch or PR appears.
