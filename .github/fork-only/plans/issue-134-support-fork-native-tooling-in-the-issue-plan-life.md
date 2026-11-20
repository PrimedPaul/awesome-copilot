---
issue: 134
title: 'Support fork-native tooling in the issue plan lifecycle'
scope: fork-tooling
status: draft
---

# Plan: Support fork-native tooling in the issue plan lifecycle

## Issue summary

- **Gap to close** — the lifecycle validator has no implementation path for issue-driven changes to fork-native workflows, tests, and docs, so #132 / #133 cannot proceed.
- **Wanted outcome** — an explicit, fail-closed lifecycle where approved tooling implementation is distinguishable from a plan-only PR and may carry a verified `Fixes #N`.
- **Also wanted** — regression tests, trigger/docs/orchestrator updates, and a stated way to review and merge this change itself without circular dependence.
- **Restatement gap** — the issue says "where appropriate, use a verified native issue-closing reference"; I read that as "allow `Fixes #N` on approved tooling implementation PRs", but the issue does not say which paths count as "directly related".

## Grilling

### Ambiguities

- **"Fork-native tooling" boundary** — undefined; it matters because the validator's `fork-only` leak check and maintenance allowlist are both path-based.
- **"Directly related" tests and docs** — no rule for which tests/docs qualify; an open glob would let anything ride along.
- **Binding approved plan to its paths** — nothing says how an approved plan declares the paths it may touch; without this, "approved tooling implementation" is just a path prefix.
- **Maintenance vs. tooling implementation** — today the two overlap (lifecycle files); it is unclear whether lifecycle-gate changes stay under `fork-lifecycle-maintenance` or move to the new mode.
- **Agentic workflow pairs** — a `.md` source plus generated `.lock.yml` must travel together; the issue does not say whether a lone `.lock.yml` change is allowed.

### Scope

- **IN** — new `tooling` implementation mode in `classifyChangedPaths` (`eng/validate-fork-plan-lifecycle.mjs`) for `.github/workflows/fork-*` (`.md`, `.lock.yml`, `.yml`), `eng/fork-*` and tests for them, `.github/fork-only/README.md`, and the matching plan file.
- **IN** — `validateClosingArmed` accepting `Fixes #N` for the new mode under the same approval/`closingIssuesReferences`/single-closer rules.
- **IN** — regression tests in `eng/validate-fork-plan-lifecycle.test.mjs`, including the #132 case (plan + `fork-bundle-upstream-pr.yml` + its test + fork README).
- **IN** — trigger `paths:` in `.github/workflows/fork-plan-lifecycle-check.yml`, docs in `.github/fork-only/README.md` and `.github/fork-only/plans/README.md`, and guidance in `.github/agents/dev-orchestrator.agent.md`.
- **OUT** — any change to the agent, plugin, skills, or upstream promotion paths.
- **OUT** — broadening `MAINTENANCE_PATHS` or the `fork-lifecycle-maintenance` label bypass.
- **OUT** — implementing #132's normalization fix itself.
- **OUT** — weakening plan review, owner `Approve plan`, plan hash, or single-closer checks.

### Constraints

- **Never promoted upstream** — every touched file is fork-only; the plugin `version` must not change, and no `plugins/` or `skills/` file is edited.
- **Lock files** — editing a `.md` agentic workflow requires recompiling its `.lock.yml` (`gh aw compile`); the planner workflow's `allowed-files` policy still limits the planner to `issue-*.md`.
- **Fail closed** — unknown paths must keep producing errors; the new mode must not make mixed PRs (plan + agent + tooling) pass silently.
- **Trigger filter** — `paths:` filters mean a PR touching a newly covered path without the filter updated would skip the check; the filter must list every path the validator classifies.
- **Pre-existing test file** — `eng/validate-fork-plan-lifecycle.test.mjs` runs via `npm run fork:lifecycle:test`.
- **Line endings** — run `bash eng/fix-line-endings.sh` before committing.

### Assumptions I am making

- **Mode name** — I assume a third implementation mode named `tooling` is clearer than overloading `implementation`.
- **Plan-declared paths** — I assume the approved plan lists its allowed tooling paths in a `## Plan` bullet list and the validator only checks the path class (not parsed plan content), to keep the validator simple.
- **Path class, not label** — I assume classification stays purely path-based; the `fork-lifecycle-maintenance` label is not consulted for tooling mode.
- **Mixed PRs rejected** — I assume tooling mode may not be combined with agent/plugin/skill changes or maintenance-allowlist files, mirroring the existing leak rules.
- **Bootstrap** — I assume this very issue's PR is reviewed under the existing `fork-lifecycle-maintenance` path (all touched files except the plan are already allowlisted), with the plan file merged in a separate plan-only PR.
- **Line references** — the issue's line numbers match the current validator; I read the file and confirmed `IMPLEMENTATION_PATH_PATTERNS` and `MAINTENANCE_PATHS` near lines 38–58.

## Plan

- **Add tooling path patterns** — `eng/validate-fork-plan-lifecycle.mjs`, next to `IMPLEMENTATION_PATH_PATTERNS`: add `TOOLING_PATH_PATTERNS` covering `^\.github/workflows/fork-[a-z0-9-]+\.(md|lock\.yml|yml)$`, `^eng/fork-[a-z0-9-]+(\.test)?\.mjs$`, and `^\.github/fork-only/README\.md$`; exclude paths already in `MAINTENANCE_PATHS`.
- **Classify the new mode** — same file, `classifyChangedPaths`: after the maintenance-only check, return `mode: "tooling"` when a matching plan file plus tooling paths are changed and no agent/plugin/skill or maintenance-only file is present; push errors for mixed PRs; plan-only still returns `planning`.
- **Pair check** — same function: error if a fork agentic workflow `.md` changes without its `.lock.yml` (and vice versa).
- **Closing rule** — `validateClosingArmed`: treat `tooling` like `implementation` (approved plan, GitHub `closingIssuesReferences`, no other open closing PR); keep `planning` rejecting `Fixes`.
- **Main flow** — `main()`: route `tooling` through the same plan, approval, and closing validation as `implementation`.
- **Exports/doc comments** — update the `@returns` mode union in the JSDoc.
- **Regression tests** — `eng/validate-fork-plan-lifecycle.test.mjs`: add cases for (a) #132 shape (plan + `.github/workflows/fork-bundle-upstream-pr.yml` + `eng/fork-bundle-upstream-pr.test.mjs` + `.github/fork-only/README.md`) → `tooling`, (b) plan-only → `planning`, (c) plan + agent + tooling → error, (d) out-of-scope path (e.g. `docs/x.md`) with tooling → error, (e) lone `.lock.yml` → error, (f) `validateClosingArmed` accepts `Fixes` for approved `tooling`, rejects draft / planning / missing GitHub reference / second closer.
- **Trigger paths** — `.github/workflows/fork-plan-lifecycle-check.yml`: add `.github/workflows/fork-*.md`, `.github/workflows/fork-*.yml`, `.github/workflows/fork-*.lock.yml`, and `eng/fork-*`; update the failure-comment bullet list to describe the tooling mode.
- **Plans README** — `.github/fork-only/plans/README.md`: add a *Tooling implementation PRs* subsection after *Lifecycle tooling maintenance* defining the path class, pairing rule, and bootstrap/review path.
- **Fork README** — `.github/fork-only/README.md`: update the `fork-plan-lifecycle-check.yml` table row and the plan-lifecycle paragraph to mention tooling mode.
- **Orchestrator guidance** — `.github/agents/dev-orchestrator.agent.md`: extend *Context*, Phase 5 (implement tooling paths without a plugin bump), the Phase 6 checklist line "Nothing changed outside…", the Phase 7 "implementation change under the agent/plugin/skill paths" check, and the closing *Notes* bullet that forbids touching fork tooling.
- **Plugin version** — no change; no agent, plugin, or skill file is touched, so no semver bump (nothing is promoted upstream).
- **Bootstrap review** — split into two PRs: this plan-only PR (`Refs #134`), then one tooling PR containing only already-allowlisted lifecycle files plus the label `fork-lifecycle-maintenance`; the new mode applies from the next PR (#132) onward.

## Acceptance criteria

- [ ] The #132 file set classifies as `tooling` and may carry `Fixes #132` only with approved plan and verified GitHub closing reference.
- [ ] Plan-only PRs still classify as `planning` and reject `Fixes`.
- [ ] Mixed agent/plugin/skill + tooling PRs, and tooling PRs with out-of-scope paths, fail.
- [ ] Agentic `.md` / `.lock.yml` pair mismatch fails.
- [ ] `MAINTENANCE_PATHS` and the maintenance label rules are unchanged in effect.
- [ ] The lifecycle workflow's `paths:` triggers on every path the validator classifies.
- [ ] Both READMEs and the orchestrator describe the tooling mode consistently.
- [ ] No file under `agents/`, `plugins/`, or `skills/` changes.
- [ ] `npm run fork:lifecycle:test` passes with the new cases.

## Open questions

- **Q1 — tooling path scope** — options: (a) `fork-*` workflows plus `eng/fork-*` tests plus fork README only; (b) also any `.github/fork-only/**`; (c) per-plan declared paths enforced by the validator. I would pick (a).
- **Q2 — mode naming and closing** — options: (a) new `tooling` mode with its own rules; (b) extend `implementation` to include tooling paths. I would pick (a) for clearer fail-closed separation.
- **Q3 — lifecycle-gate files** — options: (a) keep the maintenance label path for validator/lifecycle-workflow/orchestrator changes; (b) move them into approved tooling mode too. I would pick (a), since the issue says not to broaden the bypass.
- **Q4 — bootstrap** — options: (a) two PRs as described, with the tooling PR under the maintenance label; (b) a single PR labelled maintenance with the plan merged earlier. I would pick (a).
- **Q5 — pair enforcement** — options: (a) hard error when a fork agentic `.md`/`.lock.yml` pair is split; (b) warning only. I would pick (a).

## Verification

- `npm run fork:lifecycle:test`
- `npm run fork:lifecycle` (needs PR event env; otherwise rely on CI)
- `npm run fork:plan-hash -- .github/fork-only/plans/issue-134-support-fork-native-tooling-in-the-issue-plan-life.md`
- `gh aw compile --validate` if any agentic workflow source changes
- `bash eng/fix-line-endings.sh`
- `npm run build`
- `npm run skill:validate`
- `npm run plugin:validate`
- Confirm `git diff --name-only main` lists nothing under `agents/`, `plugins/`, or `skills/`.
