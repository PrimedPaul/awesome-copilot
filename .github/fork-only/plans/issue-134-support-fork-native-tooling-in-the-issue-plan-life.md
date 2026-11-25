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
- **Label consistency** — assign one fork-work category to each in-scope issue and its planning PR, require the same category on linked implementation PRs, and document category labels separately from lifecycle-control labels.
- **Also wanted** — regression tests, trigger/docs/orchestrator updates, and a stated way to review and merge this change itself without circular dependence.
- **Restatement gap** — the issue says "where appropriate, use a verified native issue-closing reference"; I read that as "allow `Fixes #N` on approved tooling implementation PRs", but the issue does not say which paths count as "directly related".

## Grilling

### Ambiguities

- **"Fork-native tooling" boundary** — undefined; it matters because the validator's `fork-only` leak check and maintenance allowlist are both path-based.
- **"Directly related" tests and docs** — no rule for which tests/docs qualify; an open glob would let anything ride along.
- **Binding approved plan to its paths** — nothing says how an approved plan declares the paths it may touch; without this, "approved tooling implementation" is just a path prefix.
- **Maintenance vs. tooling implementation** — today the two overlap (lifecycle files); it is unclear whether lifecycle-gate changes stay under `fork-lifecycle-maintenance` or move to the new mode.
- **Agentic workflow pairs** — a `.md` source plus generated `.lock.yml` must travel together; the issue does not say whether a lone `.lock.yml` change is allowed.
- **Category labels** — issue and PR labels are currently inconsistent, and no existing rule maps the two supported work classes to one category label each.
- **Label authority** — the planner creates a planning PR but not the later implementation PR; its category labels and the lifecycle check's enforcement boundary need to be explicit.
- **Control-label confusion** — `fork-lifecycle-maintenance` and `fork-sync` affect check behavior, unlike issue-category labels; applying them as general category labels could grant the wrong lifecycle path or skip validation.

### Scope

- **IN** — new `tooling` implementation mode in `classifyChangedPaths` (`eng/validate-fork-plan-lifecycle.mjs`) for `.github/workflows/fork-*` (`.md`, `.lock.yml`, `.yml`), `eng/fork-*` and tests for them, `.github/fork-only/README.md`, and the matching plan file.
- **IN** — `validateClosingArmed` accepting `Fixes #N` for the new mode under the same approval/`closingIssuesReferences`/single-closer rules.
- **IN** — update `.github/workflows/fork-issue-planner.md` so the planner applies exactly one category label to an in-scope issue and its planning PR, replacing conflicting fork-category labels while preserving unrelated labels.
- **IN** — lifecycle validation that linked planning, tooling, implementation, and maintenance PRs carry the same category as their issue; category labels do not bypass approval, path, maintenance-label, or skip rules.
- **IN** — document fork-specific issue/PR labels and their distinct purposes in `.github/fork-only/README.md`.
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
- **Label separation** — `fork-workflow` and `o2p-plugin-enhancements` are category labels; `fork-lifecycle-maintenance` authorizes only the explicit maintenance route, and `fork-sync` alone skips the check. The planner must not apply either lifecycle-control label as a category.
- **Path-scoped check** — category consistency is enforced for lifecycle-classified PRs that trigger this workflow; it does not turn the lifecycle workflow into a repository-wide check for unrelated paths. Non-sync PRs in scope run the check; `fork-sync` remains exempt.
- **Planner outputs** — issue-category changes and conditional category labels on the planning PR must use constrained gh-aw safe outputs; `fork-automation` remains the planner marker.
- **Category mapping** — fork workflow/tooling and lifecycle-maintenance work maps to `fork-workflow`; the Oracle-to-PostgreSQL agent, plugin, and its skills map to `o2p-plugin-enhancements`; out-of-scope plans have no category, and mixed-class requests must stop for a split rather than receive an arbitrary category.
- **Approval provenance** — implementation PRs are separate from planning PRs; owner approval must be checked against the exact planning-PR comment URL in the approved plan, not against the implementation PR's comments.
- **Maintenance closing** — maintenance PRs may use `Fixes` only if a matching approved plan and all normal closing evidence pass; otherwise they must use `Refs`.
- **Event coverage** — issue-label changes and planner-created/reused PRs must cause a targeted lifecycle recheck even when GitHub's token does not start a normal pull-request run.
- **Renames** — pair validation must examine both old and new paths from rename entries, before any maintenance early exit.
- **Pre-existing test file** — `eng/validate-fork-plan-lifecycle.test.mjs` runs via `npm run fork:lifecycle:test`.
- **Line endings** — run `bash eng/fix-line-endings.sh` before committing.

## Plan

- **Add tooling path patterns** — `eng/validate-fork-plan-lifecycle.mjs`, next to `IMPLEMENTATION_PATH_PATTERNS`: add `TOOLING_PATH_PATTERNS` for `^\.github/workflows/fork-[a-z0-9-]+\.md$`, its matching `.lock.yml`, `^\.github/workflows/fork-[a-z0-9-]+\.yml$`, `^eng/fork-[a-z0-9-]+(?:\.test)?\.mjs$`, and `.github/fork-only/README.md`. The workflow `.md`/lock entries form a name-matched pair. Do not classify arbitrary `.github/fork-only/**` files as tooling.
- **Classify the new mode** — same file, `classifyChangedPaths`: preserve maintenance-only classification first; classify a PR as `tooling` only when it has a tooling-path change and exactly one matching issue plan is available. Reject mixed implementation/tooling changes, any non-plan out-of-class path, and maintenance paths bundled with tooling except `.github/fork-only/README.md`, which is explicitly in the agreed tooling set. The README alone continues to classify as maintenance because it is already in `MAINTENANCE_PATHS`. Plan-only PRs remain `planning`.
- **Pair check** — same function: error if a fork agentic workflow `.md` changes without its matching `.lock.yml`, or if a lock changes without its matching `.md`. This includes additions, edits, renames, and deletions represented in the changed-file list.
- **Closing rule** — `validateClosingArmed`: treat `tooling` like `implementation` (approved plan, GitHub `closingIssuesReferences`, no other open closing PR); keep `planning` rejecting `Fixes`.
- **Rename-aware diff** — `main()`: retain both source and destination paths from `git diff --name-status`; perform workflow-pair validation before classification or any maintenance return.
- **Approval provenance** — `eng/validate-fork-plan-lifecycle.mjs`: resolve the planning PR identified by `lifecycle.approval.evidence`; verify it targets `main`, references the same issue, and includes the exact plan file in its changed files; then fetch its comments and validate the exact owner-authored `Approve plan` comment there. Do not fetch approval comments from the current implementation PR unless it is itself the planning PR.
- **Maintenance closing** — keep the maintenance path allowlist and maintainer label mandatory. `Refs #N` remains permitted without a plan; `Fixes #N` requires the matching plan to be approved with valid hash/review/owner-approval evidence, GitHub's closing reference, and no competing closer.
- **Main flow** — `main()`: route `tooling` through the same plan, approval, and closing validation as `implementation`; run issue-link/category consistency on all lifecycle modes, including maintenance, without letting that check bypass mode-specific requirements.
- **Exports/doc comments** — update the `@returns` mode union in the JSDoc.
- **Regression tests** — `eng/validate-fork-plan-lifecycle.test.mjs`: cover (a) #132 shape → `tooling`, (b) plan-only → `planning`, (c) mixed/out-of-scope paths → errors, (d) missing workflow source/lock partner in either direction, including renames and maintenance mode, → error, (e) README-only → `maintenance`, (f) category and issue-link consistency in every lifecycle mode, (g) approval evidence fetched from a distinct planning PR that is verified to contain the matching plan and issue, (h) per-head plan loading for multiple linked PRs with distinct revisions, (i) per-PR check-run/summary targeting, and (j) `Fixes` accepted only with approved-plan/GitHub/single-closer evidence in implementation, tooling, and maintenance modes.
- **Trigger paths** — `.github/workflows/fork-plan-lifecycle-check.yml`: add globs covering all `.github/workflows/fork-*` sources, locks, and plain YAML workflows, plus `eng/fork-*`; retain coverage for both fork READMEs through existing paths. Update the failure-comment bullet list to explain tooling-mode path, approval, and pairing requirements.
- **Planner labels** — `.github/workflows/fork-issue-planner.md`: use a bounded mapping from plan scope to one of `fork-workflow` or `o2p-plugin-enhancements`; use safe label outputs restricted to those category labels plus removal of `fork-maintenance` and the opposite category, preserving unrelated labels. Bind issue-label writes to the issue opened or the validated `issue_number` input (never wildcard targets), and reconcile labels on re-plans. Set the matching label on created or reused in-scope planning PRs via the PR output's allowed-label set while retaining `fork-automation`. Make label reconciliation succeed before PR creation/update, then dispatch the lifecycle workflow's `workflow_dispatch` safe output with that `issue_number`, dependent on successful issue-label reconciliation and PR create/update outputs; grant only the needed `actions: write` permission. Failures must not produce a success-shaped plan PR. Mixed-scope requests call `noop` with a split reason. Preserve the existing minimal planning output for out-of-scope requests, with no category on either issue or PR. Recompile the matching `.lock.yml`.
- **Label consistency check** — `eng/validate-fork-plan-lifecycle.mjs`: for each linked PR classified as planning, tooling, implementation, or maintenance, fetch the referenced issue labels. For in-scope plans, require exactly one supported category on the issue and the same category on the PR; for an out-of-scope planning plan, require no supported category on either issue or PR and reject implementation of that plan. Require the normal issue reference on these lifecycle-classified PRs; reject a missing, multiple, or mismatched category with a clear error. Refactor the current maintenance early return so it also checks issue/category consistency while still requiring the maintenance label and exact path allowlist. Do not treat either category as a control label, do not auto-apply `fork-lifecycle-maintenance`, and preserve the `fork-sync` skip behavior.
- **Revalidation events** — `.github/workflows/fork-plan-lifecycle-check.yml`: retain existing pull-request triggers; add issue `labeled`/`unlabeled` handling and a narrowly scoped `workflow_dispatch` input `issue_number`. Refactor `main()` so pull-request events validate their triggering PR, while issue/workflow-dispatch events enumerate open PRs, filter by the exact `Refs #N`/`Fixes #N` body marker, fetch each PR's base/head SHAs, labels, body and changed paths, and read its plan content from that PR's head commit (not from the dispatch workflow checkout). Pass all of this through the same validator used by pull-request events. Publish/update an individual check run on each PR's head SHA and update that PR's validation-summary comment, with the minimal `checks: write` permission. No matching PRs is a successful no-op. Revalidate planner-created/reused PRs via the planner's explicitly dependent `dispatch-workflow` safe output after label reconciliation and PR create/update. Do not add a repository-wide unfiltered PR trigger.
- **Label regression tests** — `eng/validate-fork-plan-lifecycle.test.mjs`: cover both category mappings, preservation of unrelated labels and removal of legacy/conflicting category labels in planner output behavior where testable, matching issue/PR categories in planning, tooling, implementation, and maintenance modes, out-of-scope plan PRs with no categories, rejection of out-of-scope implementation, missing issue references or category labels, multiple categories, mismatch, maintenance-label separation, and `fork-sync` skip preservation. Test issue-label event/manual dispatch selection and PR creation/reuse revalidation paths.
- **Plans README** — `.github/fork-only/plans/README.md`: add a *Tooling implementation PRs* subsection after *Lifecycle tooling maintenance* defining the path class, pairing rule, and bootstrap/review path; clarify that issue category labels do not grant the maintenance route.
- **Fork README** — `.github/fork-only/README.md`: update the `fork-plan-lifecycle-check.yml` table row and plan-lifecycle paragraph to mention tooling mode; add a fork-label reference that distinguishes issue categories (`fork-workflow`, `o2p-plugin-enhancements`), lifecycle PR controls (`fork-lifecycle-maintenance`, `fork-sync`), and the planner marker (`fork-automation`), including who applies each and what the lifecycle check does with it.
- **Orchestrator guidance** — `.github/agents/dev-orchestrator.agent.md`: extend *Context*, Phase 5 (implement tooling paths without a plugin bump), the Phase 6 checklist line "Nothing changed outside…", the Phase 7 "implementation change under the agent/plugin/skill paths" check, and the closing *Notes* bullet that forbids touching fork tooling.
- **Plugin version** — no change; no agent, plugin, or skill file is touched, so no semver bump (nothing is promoted upstream).
- **Bootstrap review** — split into two PRs: merge this approved plan-only PR (`Refs #134`) first, then submit the lifecycle validator/workflow/docs/orchestrator/planner implementation as a separate PR containing only already-allowlisted maintenance paths and carrying the maintainer-applied `fork-lifecycle-maintenance` label. The planner must not apply that label. The new `tooling` mode and category-label consistency checks apply to subsequent issue implementation PRs such as #132.

## Acceptance criteria

- [ ] The #132 file set classifies as `tooling` and may carry `Fixes #132` only with approved plan and verified GitHub closing reference.
- [ ] Plan-only PRs still classify as `planning` and reject `Fixes`.
- [ ] Mixed agent/plugin/skill + tooling PRs, and tooling PRs with out-of-scope paths, fail.
- [ ] Agentic `.md` / `.lock.yml` pair mismatch fails.
- [ ] Workflow pair validation runs before maintenance classification and handles both paths of a rename.
- [ ] An implementation PR verifies owner approval on the exact planning PR cited by lifecycle evidence.
- [ ] Maintenance PRs can use `Fixes` only after the normal approved-plan and native-closing checks; otherwise they use `Refs`.
- [ ] `.github/fork-only/README.md` can accompany a tooling change, while the planning README and other lifecycle-maintenance files remain on the maintenance route.
- [ ] `MAINTENANCE_PATHS` and the maintenance label rules are unchanged in effect.
- [ ] Planner assigns exactly one category label to each in-scope issue and its plan PR; it removes conflicting/legacy category labels without disturbing unrelated labels. Out-of-scope plans have no category on issue or PR; mixed-scope requests produce no plan PR until split.
- [ ] Each in-scope lifecycle-classified non-`fork-sync` PR has an issue reference, and its issue and PR share exactly one matching category label. Out-of-scope planning PRs have neither category; category labels do not substitute for the maintenance label or alter skip behavior.
- [ ] Issue-label changes and planner-created/reused planning PRs cause a targeted revalidation; unrelated PRs remain outside the path-scoped check.
- [ ] Issue-label and workflow-dispatch events enumerate linked open PRs and pass each PR's changed-file context into the same validator used by pull-request events.
- [ ] Mixed-scope requests create no plan PR until split; out-of-scope requests retain the existing minimal, uncategorized plan behavior.
- [ ] The #134 bootstrap issue/plan PR carry matching `fork-workflow` categories; its implementation PR also carries the category plus the manually applied maintenance label.
- [ ] README documents each fork-specific issue/PR label by purpose, scope, and application authority.
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
| Issue category labels | Planner assigns exactly one category label to in-scope issues: `fork-workflow` for fork tooling/workflow changes and `o2p-plugin-enhancements` for custom-agent/plugin/skill changes; out-of-scope issues receive neither. | This interactive session: user accepted the recommendation. |
| Planning and implementation PR labels | Planner mirrors the issue's category on its planning PR; lifecycle validation requires linked planning, tooling, implementation, and maintenance PRs to carry the same category as the issue. | This interactive session: user accepted the recommendation and clarified that PRs should be tied to issues and consistently labeled. |
| Maintenance-label scope | Keep `fork-lifecycle-maintenance` reserved for the allowlisted maintenance route and maintainer-applied; do not auto-apply it to category PRs. `fork-sync` remains the sole skip label. | This interactive session: user accepted the recommendation after clarifying the label's purpose. |
| Label documentation | Document fork-specific issue categories, PR lifecycle controls, and the planner marker separately, with their purpose and authority. | This interactive session: user accepted the recommendation. |
| Legacy `fork-maintenance` label | Replace it with the specific category on in-scope issues; preserve unrelated labels. | This interactive session: user accepted the recommendation. |
| Out-of-scope and mixed-scope planner behavior | Preserve minimal out-of-scope plans without category labels on issue or PR; call `noop` for mixed-scope requests and require the request to be split. | This interactive session: user accepted the recommendation. |
| Maintenance PR closing | Permit `Fixes #N` on a maintenance PR only when the matching plan is approved and hash-valid, owner approval is verified on its planning PR, GitHub confirms the closing reference, and no competing closer exists; otherwise use `Refs #N`. | This interactive session: user accepted the recommendation. |

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
