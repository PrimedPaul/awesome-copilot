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

## Plan

- **Add tooling path patterns** — `eng/validate-fork-plan-lifecycle.mjs`, next to `IMPLEMENTATION_PATH_PATTERNS`: add `TOOLING_PATH_PATTERNS` for `^\.github/workflows/fork-[a-z0-9-]+\.md$`, its matching `.lock.yml`, `^\.github/workflows/fork-[a-z0-9-]+\.yml$`, `^eng/fork-[a-z0-9-]+(?:\.test)?\.mjs$`, and `.github/fork-only/README.md`. The workflow `.md`/lock entries form a name-matched pair. Do not classify arbitrary `.github/fork-only/**` files as tooling.
- **Classify the new mode** — same file, `classifyChangedPaths`: preserve maintenance-only classification first; classify a PR as `tooling` only when it has a tooling-path change and exactly one matching issue plan is available. Reject mixed implementation/tooling changes, any non-plan out-of-class path, and maintenance paths bundled with tooling except `.github/fork-only/README.md`, which is explicitly in the agreed tooling set. The README alone continues to classify as maintenance because it is already in `MAINTENANCE_PATHS`. Plan-only PRs remain `planning`.
- **Pair check** — same function: error if a fork agentic workflow `.md` changes without its matching `.lock.yml`, or if a lock changes without its matching `.md`. This includes additions, edits, renames, and deletions represented in the changed-file list.
- **Closing rule** — `validateClosingArmed`: treat `tooling` like `implementation` (approved plan, GitHub `closingIssuesReferences`, no other open closing PR); keep `planning` rejecting `Fixes`.
- **Main flow** — `main()`: route `tooling` through the same plan, approval, and closing validation as `implementation`.
- **Exports/doc comments** — update the `@returns` mode union in the JSDoc.
- **Regression tests** — `eng/validate-fork-plan-lifecycle.test.mjs`: cover (a) #132 shape (existing plan + `.github/workflows/fork-bundle-upstream-pr.yml` + `eng/fork-bundle-upstream-pr.test.mjs` + `.github/fork-only/README.md`) → `tooling`, (b) plan-only → `planning`, (c) mixed implementation/tooling and non-README maintenance/tooling paths → errors, (d) out-of-scope paths → errors, (e) missing workflow source/lock partner in either direction → error, (f) README-only → `maintenance`, (g) `validateClosingArmed` accepts `Fixes` for approved `tooling` and rejects draft plans, missing GitHub references, or a second closer.
- **Trigger paths** — `.github/workflows/fork-plan-lifecycle-check.yml`: add globs covering all `.github/workflows/fork-*` sources, locks, and plain YAML workflows, plus `eng/fork-*`; retain coverage for both fork READMEs through existing paths. Update the failure-comment bullet list to explain tooling-mode path, approval, and pairing requirements.
- **Plans README** — `.github/fork-only/plans/README.md`: add a *Tooling implementation PRs* subsection after *Lifecycle tooling maintenance* defining the path class, pairing rule, and bootstrap/review path.
- **Fork README** — `.github/fork-only/README.md`: update the `fork-plan-lifecycle-check.yml` table row and the plan-lifecycle paragraph to mention tooling mode.
- **Orchestrator guidance** — `.github/agents/dev-orchestrator.agent.md`: extend *Context*, Phase 5 (implement tooling paths without a plugin bump), the Phase 6 checklist line "Nothing changed outside…", the Phase 7 "implementation change under the agent/plugin/skill paths" check, and the closing *Notes* bullet that forbids touching fork tooling.
- **Plugin version** — no change; no agent, plugin, or skill file is touched, so no semver bump (nothing is promoted upstream).
- **Bootstrap review** — split into two PRs: merge this approved plan-only PR (`Refs #134`) first, then submit the lifecycle validator/workflow/docs/orchestrator implementation as a separate PR containing only already-allowlisted maintenance paths and carrying `fork-lifecycle-maintenance`. The new `tooling` mode applies to subsequent issue implementation PRs such as #132.

## Acceptance criteria

- [ ] The #132 file set classifies as `tooling` and may carry `Fixes #132` only with approved plan and verified GitHub closing reference.
- [ ] Plan-only PRs still classify as `planning` and reject `Fixes`.
- [ ] Mixed agent/plugin/skill + tooling PRs, and tooling PRs with out-of-scope paths, fail.
- [ ] Agentic `.md` / `.lock.yml` pair mismatch fails.
- [ ] `.github/fork-only/README.md` can accompany a tooling change, while the planning README and other lifecycle-maintenance files remain on the maintenance route.
- [ ] `MAINTENANCE_PATHS` and the maintenance label rules are unchanged in effect.
- [ ] The lifecycle workflow's `paths:` triggers on every path the validator classifies.
- [ ] Both READMEs and the orchestrator describe the tooling mode consistently.
- [ ] No file under `agents/`, `plugins/`, or `skills/` changes.
- [ ] `npm run fork:lifecycle:test` passes with the new cases.

## Open questions

All questions are answered; see the decision record.

## Decision record

| Question | Decision | Source |
|---|---|---|
| Tooling path scope (seed Q1) | Use the bounded option (a): fork workflow sources and their generated locks (`.github/workflows/fork-*.md`, matching `.lock.yml`, and non-agentic `.yml` workflows), `eng/fork-*.mjs` scripts/tests, and `.github/fork-only/README.md`. Do not allow arbitrary `.github/fork-only/**` paths or per-plan path declarations. The root fork README may accompany a tooling change even though a README-only change remains maintenance. | This interactive session: user selected option (a). |
| Planning README scope | Update `.github/fork-only/plans/README.md` to document the lifecycle, but keep it on the existing maintenance allowlist and out of the new tooling implementation path class. | This interactive session: user asked about the planning README; user agreed to the proposed distinction. |
| Mode naming and closing (seed Q2) | Add a distinct `tooling` mode; permit `Fixes #N` only under the same approved-plan and verified GitHub closing-reference checks as `implementation`. | This interactive session: user agreed with the recommendation. |
| Lifecycle-gate files (seed Q3) | Keep validator, lifecycle workflow, orchestrator guidance, and lifecycle documentation changes on the existing `fork-lifecycle-maintenance` route; do not broaden that route. | This interactive session: user agreed with the recommendation. |
| Bootstrap (seed Q4) | Use two PRs: merge this plan-only PR first, then submit lifecycle tooling changes through the maintenance route with the required label. | This interactive session: user agreed with the recommendation. |
| Workflow source/lock pairing (seed Q5) | Fail validation if a fork agentic workflow source `.md` and its matching generated `.lock.yml` are split across PRs. | This interactive session: user agreed with the recommendation. |

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
