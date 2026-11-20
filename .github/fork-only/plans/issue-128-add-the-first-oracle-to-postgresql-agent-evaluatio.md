---
issue: 128
title: 'Add the first Oracle-to-PostgreSQL agent evaluation for missing DDL'
scope: fork-tooling
status: draft
---

# Plan: first missing-DDL behavioral evaluation

## Scope classification

- **Fork tooling change** — an evaluation harness is not part of the agent, plugin, or skills; it lives under `.github/fork-only/` and must **never** be promoted upstream.
- **Agent untouched by default** — the evaluation observes `agents/oracle-to-postgres-migration-expert.agent.md`; it only changes it if the observed result is a failure and the maintainer chooses to fix it (see Q4).

## Issue summary

- **Ask** — write a repeatable behavioral evaluation that checks the agent asks for missing Oracle DDL before schema-dependent work.
- **Cases** — default DDL directory absent, directory present but empty, directory containing DDL for another project only.
- **Failure definition** — proceeding with schema-dependent analysis, or claiming the prerequisite is satisfied without artifacts.
- **Deliverable** — the evaluation, plus a recorded observed result.
- **Gap from literal text** — "evaluation" does not say what runner to use; the repo has no existing agent evaluation tooling (`.github/fork-only/change-brainstorming.md` WF-03 only lists it as an unexplored idea).

## Grilling

### Ambiguities

- **Runner unspecified** — no eval framework exists in the repo; the choice (shell script driving Copilot CLI vs. a Node test) shapes everything else.
- **"Repeatable" undefined** — LLM output is non-deterministic; one run proves little, so a trial count and pass threshold matter.
- **Pass/fail judge unspecified** — keyword matching is brittle; an LLM judge adds a second non-deterministic layer.
- **Entry point unspecified** — the agent's gate lives in Phase 1 success criteria; the user prompt (e.g. "start Phase 2 for project X" vs. "begin the migration") changes which path is exercised.
- **Where results live** — "records the observed result" could mean a committed file, PR comment, or CI artifact.

### Scope

- **IN** — a fork-only eval with three fixtures (absent, empty, other-project DDL), a runner, a pass/fail grader, and one recorded run.
- **IN** — a short README for the eval explaining how to run it and how results are judged.
- **OUT** — the broader instruction-specificity review (issue says it is tracked separately, split from #87).
- **OUT** — evaluating other agent behaviors (gates, schema immutability, etc.) and repository-level evals (WF-01).
- **OUT** — CI wiring; first eval is run manually (guess, labelled as such).
- **OUT** — changing agent wording; failures are recorded, not fixed, unless Q4 says otherwise.

### Constraints

- **Never promoted upstream** — all files go under `.github/fork-only/`; nothing in `agents/`, `skills/`, or `plugins/` changes, so no `plugin.json` bump is needed.
- **Bump rule if agent is later fixed** — a wording fix to the agent would be a patch bump of `plugins/oracle-to-postgres-migration-expert/plugin.json` (currently `1.1.4`).
- **Agent must not mutate** — fixtures run in throwaway temp workspaces; the agent has `execute` and `edit` tools, so the eval must run in a disposable directory and with non-interactive prompts.
- **Gate behavior** — the agent is told to ask and wait; in non-interactive mode, "asks" shows up as a final message containing a request rather than a tool call, so grading is on the transcript.
- **Model drift** — the agent frontmatter pins `model: 'Claude Sonnet 5'`; results are only valid for the model recorded.
- **Repo conventions** — LF line endings (`bash eng/fix-line-endings.sh`), lower-case hyphenated names.

### Assumptions I am making

- **Copilot CLI available** — the eval can invoke `copilot` non-interactively with the agent loaded (the planner environment has it at version 1.0.103).
- **Eval location** — `.github/fork-only/evals/oracle-to-postgres-missing-ddl/`; there is no existing convention, so this is a guess.
- **Node ES module runner** — follows the `eng/` convention (`.mjs`) and avoids new dependencies.
- **Grader is deterministic** — rule-based checks over the transcript plus workspace state; no LLM judge in v1.
- **Tool-use is observable** — the transcript or workspace diff reveals whether the agent created `Reports/MasterMigrationPlan.md` or `OracleRiskAnalysis.md` anyway.
- **Prompt starts at Phase 2** — a user request like "Run pre-migration risk analysis for project `Contoso.Data`" in a workspace with a minimal .NET project.
- **Several trials per case** — 3 trials per fixture to expose variance.
- **Results are committed** — a dated results file records model, CLI version, per-trial verdicts.

## Plan

- **Create `.github/fork-only/evals/oracle-to-postgres-missing-ddl/README.md`** — purpose, the three cases, failure definition from the issue, how to run, how results are recorded, and the "fork-only, never upstream" notice.
- **Create `.../fixtures/absent/`** — minimal workspace: a tiny .NET `.csproj` plus one C# data-access class using `OracleConnection`; no `.github/oracle-to-postgres-migration/` directory.
- **Create `.../fixtures/empty/`** — same, with `.github/oracle-to-postgres-migration/DDL/Oracle/.gitkeep` only (no DDL files).
- **Create `.../fixtures/other-project/`** — same, with `DDL/Oracle/OtherProject/*.sql` while the project under analysis is `Contoso.Data`.
- **Create `.../run-eval.mjs`** — copies each fixture to a temp dir, runs `copilot -p "<prompt>" --agent oracle-to-postgres-migration-expert` (exact flags to confirm against `copilot --help`) with a timeout, captures output, and invokes the grader.
- **Create `.../grade.mjs`** — pass requires the final response to request the DDL or its location; fail if `Reports/{ProjectName}/OracleRiskAnalysis.md` or `MigrationChecklist.md` was created, or the response asserts DDL is present/confirmed.
- **Create `.../grade.test.mjs`** — unit tests for the grader using canned pass/fail transcripts so the grader itself is verified without a model call.
- **Create `.../results/<date>-sonnet-5.md`** — the first observed run: model, CLI version, per-fixture trial verdicts, and notable transcript excerpts.
- **Update `.github/fork-only/README.md`** — add a pointer to the evals directory (only if it lists fork-only components; confirm when implementing).
- **Do not edit** `agents/`, `skills/`, `plugins/`, or workflows.
- **No `plugin.json` bump** — no agent behavior changes. If Q4 chooses to fix the agent, bump patch (`1.1.5`) since it is wording only.

## Acceptance criteria

- [ ] Three fixtures exist: absent, empty, other-project DDL.
- [ ] One command runs all fixtures and prints a per-case, per-trial pass/fail.
- [ ] Failure is defined exactly per the issue: schema-dependent work proceeds, or the prerequisite is claimed satisfied without artifacts.
- [ ] Grader has unit tests with passing and failing transcripts.
- [ ] A recorded result file states model, CLI version, date, and verdicts.
- [ ] Runs happen in temp copies; fixtures are never mutated.
- [ ] All new files are under `.github/fork-only/`.
- [ ] No changes to `agents/`, `skills/`, or `plugins/` unless Q4 says to fix.

## Open questions

- **Q1 — eval runner** — options: (a) Node `.mjs` driving `copilot -p`; (b) shell script; (c) a third-party eval framework. I would pick (a).
- **Q2 — trials and threshold** — options: (a) 3 trials, all must pass; (b) 5 trials, ≥4 pass; (c) single run. I would pick (a).
- **Q3 — grader type** — options: (a) rule-based on transcript and workspace; (b) LLM judge; (c) both. I would pick (a) for v1.
- **Q4 — failure handling** — if the agent fails a case, options: (a) record only and file a follow-up issue; (b) fix the agent in this PR with a patch bump. I would pick (a).
- **Q5 — result location** — options: (a) committed under `evals/.../results/`; (b) PR comment only. I would pick (a).
- **Q6 — non-interactive gate** — options: (a) treat any ask-for-DDL final message as a pass; (b) require it to also stop without file creation. I would pick (b).

## Verification

- `node --test .github/fork-only/evals/oracle-to-postgres-missing-ddl/grade.test.mjs`
- `node .github/fork-only/evals/oracle-to-postgres-missing-ddl/run-eval.mjs` — produces the recorded result.
- `bash eng/fix-line-endings.sh`
- `npm run build`
- `npm run skill:validate`
- `npm run plugin:validate`
- `git diff --stat main` — confirm only `.github/fork-only/` paths changed.
