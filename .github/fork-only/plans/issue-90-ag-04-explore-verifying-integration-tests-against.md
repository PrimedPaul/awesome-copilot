---
issue: 90
title: '[AG-04] Explore verifying integration tests against their plan'
scope: agent
status: draft
---

# Plan: issue #90 — verify integration tests against their plan

## Issue summary

- **Skill exploration** — evaluate a new skill that checks implemented integration tests against the `Integration Testing Plan.md`.
- **Reference prompt** — locate and review the existing prompt in the `pcoc-uploader` solution.
- **Hook is separate** — a hook is "only a possible invocation mechanism"; assess it independently of the skill.
- **Deliverable is an assessment** — "Done when" asks to assess, define inputs/criteria/outputs, and evaluate the hook; it does not demand a shipped skill.
- **Gap from literal text** — the issue is labelled "exploratory, not approved or prioritized", so I read the output as a design document, not an implementation.

## Grilling

### Ambiguities

- **Prompt inaccessible** — `pcoc-uploader` is not in this repo (grep for `pcoc` finds only `.github/fork-only/change-brainstorming.md`); the prompt cannot be reviewed without the maintainer supplying it.
- **Deliverable form** — "explore" could mean a findings doc, a draft skill, or both; it changes the scope of the PR.
- **"Verify" meaning** — could be plan-to-test coverage (every planned case has a test), test-to-plan drift (tests not in the plan), or assertion quality.
- **Verification mode** — static (read plan and test source) versus executing tests; running needs Oracle access the agent does not have.
- **Hook trigger** — unclear whether a hook would fire on commit, on test-file edit, or at phase handoff.

### Scope

- **IN: assessment** — a written assessment of the `pcoc-uploader` prompt (once supplied), covering reusable parts and gaps.
- **IN: skill contract** — inputs, comparison criteria, and output format for a candidate skill.
- **IN: hook evaluation** — a separate section on whether and how a hook would invoke the skill.
- **IN: draft skill (guess)** — a draft `skills/verifying-oracle-to-postgres-migration-integration-tests/SKILL.md` only if the maintainer chooses Q2 option (b).
- **OUT: agent wiring** — no change to Phase 3 of `agents/oracle-to-postgres-migration-expert.agent.md` unless a skill is accepted.
- **OUT: upstream hook** — no new hook under `hooks/`; hook work stays an evaluation.
- **OUT: test execution** — the skill does not run tests against Oracle.

### Constraints

- **Version bump** — adding a skill to the plugin needs a **minor** bump of `plugins/oracle-to-postgres-migration-expert/plugin.json` (currently `1.1.3` → `1.2.0`).
- **Skill conventions** — `name` must match the folder, lowercase hyphenated; `description` single-quoted, 10–1024 chars; see `AGENTS.md`.
- **Plugin registration** — a new skill must be added to the `skills` array under `extensions.com.github.awesome-copilot`, kept sorted.
- **Phase 3 contract** — the existing planning skill writes `.github/oracle-to-postgres-migration/Reports/{TARGET_PROJECT} Integration Testing Plan.md`, while the agent file says `Reports/{ProjectName}/Integration Testing Plan.md`; a verifier must handle this path mismatch.
- **Oracle golden source** — verification must not suggest PostgreSQL-specific assertions (see `creating-oracle-to-postgres-migration-integration-tests` "Assertion portability").
- **Fork-only files** — the assessment document must not be promoted upstream.

### Assumptions I am making

- **Prompt is unavailable** — I cannot read `pcoc-uploader`, so the plan does not describe its contents.
- **Exploration first** — the first deliverable is a fork-only assessment, not a promoted skill.
- **Static verification** — the skill compares plan against test source by reading; it does not execute tests.
- **Plan format** — it follows the "Write the testing plan" bullets in `planning-oracle-to-postgres-migration-integration-testing/SKILL.md` (artifacts, cases, seed data, differences, coverage mapping).
- **Hook feasibility** — existing hooks in `hooks/` (e.g. `tool-guardian`, `session-auto-commit`) show the pattern, but I have not verified that a hook can reliably invoke a skill.
- **Classification** — this is an agent change because it targets a skill and plugin.

## Plan

- **Obtain reference prompt** — maintainer supplies the `pcoc-uploader` prompt text (Q1); nothing else proceeds without it.
- **Write assessment** — create `.github/fork-only/assessments/ag-04-test-vs-plan-verification.md` (fork-only) with sections: *Reference prompt review*, *Skill contract*, *Hook evaluation*, *Recommendation*.
- **Define skill inputs** — target project name, path to the plan file, path to the Oracle test project.
- **Define comparison criteria** — each plan test case maps to a test method; each planned artifact has at least one test; empty-string and `NULL` text cases present; datetime round-trip cases present; assertions use concrete values; no tests absent from the plan.
- **Define outputs** — a coverage matrix (plan case → test → status), a list of gaps and unplanned tests, and a pass/fail summary written to `Reports/{ProjectName}/`.
- **Evaluate hook** — compare trigger options, whether a hook can invoke a skill, noise and cost, and the alternative of a manual Phase 3 step.
- **If Q2 = (b), draft skill** — create `skills/verifying-oracle-to-postgres-migration-integration-tests/SKILL.md` with a Workflow checklist, Key Constraints, and an Output section.
- **If Q2 = (b), register skill** — add `./skills/verifying-oracle-to-postgres-migration-integration-tests/` to `plugins/oracle-to-postgres-migration-expert/plugin.json` in sorted position, and bump `version` to `1.2.0` (minor: new skill).
- **If Q2 = (b), reference in agent** — add one bullet to Phase 3 of `agents/oracle-to-postgres-migration-expert.agent.md` after the `creating-oracle-to-postgres-migration-integration-tests` bullet.
- **If Q2 = (a)** — no plugin, agent, or skill changes and no version bump.

## Acceptance criteria

- [ ] The `pcoc-uploader` prompt has been reviewed and findings recorded.
- [ ] Skill inputs, comparison criteria, and outputs are defined.
- [ ] Hook invocation is evaluated in its own section, separate from the skill.
- [ ] A recommendation states whether to build the skill, the hook, both, or neither.
- [ ] If a skill is drafted: `npm run skill:validate` and `npm run plugin:validate` pass and the plugin version is bumped to `1.2.0`.
- [ ] No fork-only files are included in any upstream-promoted change.

## Open questions

- **Q1 — reference prompt source** — options: (a) paste the `pcoc-uploader` prompt into this issue; (b) add it under `.github/fork-only/`; (c) proceed without it. I would pick (a).
- **Q2 — deliverable form** — options: (a) assessment document only; (b) assessment plus a draft skill and plugin registration. I would pick (a), since the issue says "exploratory, not approved".
- **Q3 — verification meaning** — options: (a) plan-to-test coverage only; (b) coverage plus assertion quality against the creating-tests skill rules. I would pick (b).
- **Q4 — hook trigger** — options: (a) no hook, manual Phase 3 step; (b) hook on test-file changes; (c) hook at session end. I would pick (a) pending evaluation.
- **Q5 — plan path** — options: (a) `Reports/{ProjectName}/Integration Testing Plan.md` as in the agent; (b) `Reports/{TARGET_PROJECT} Integration Testing Plan.md` as in the planning skill. I would pick (a) and note the mismatch as a separate issue.

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- `git diff --stat` — confirm only intended files changed and the assessment stays under `.github/fork-only/`.
