---
issue: 88
title: '[AG-02] Verify logging before debugging test cases'
scope: agent
status: draft
---

## Issue summary

- **Core ask** — instruct the agent to confirm logging statements work before it debugs failing test cases.
- **Deliverable is analysis** — "Done when" asks to define observable evidence of working logging, how to tell logging failures from test failures, and to assess instruction scope and debugging impact.
- **Gap vs. literal text** — the issue is labelled exploratory ("not approved or prioritized"), so it may want a decision, not an edit; I plan an edit proposal anyway.
- **Source** — `.github/fork-only/change-brainstorming.md` AG-02.

## Grilling

### Ambiguities

- **Which logging** — application logging in migrated code, test-output logging (xUnit `ITestOutputHelper`), or logging the agent adds itself while debugging; each has a different check.
- **Which phase** — test debugging happens in Phase 6 (fix loop) and, less so, Phase 3 baseline runs; the issue does not say.
- **Who runs tests** — the agent hands tests to the user ("ask them to run all integration tests and report back"), so the agent can't observe log output itself; the check must be user-mediated.
- **Mandatory or conditional** — always verifying adds a round trip per failure; matters for debugging speed.

### Scope

- **IN** — a short "Verify logging before debugging" rule in the Phase 6 failure-diagnosis loop of the agent file.
- **IN** — a definition of observable evidence: a known marker line emitted from a code path that is certain to run (e.g. test setup) appears in the user-reported test output.
- **IN** — a triage rule: marker absent means logging failure (fix config/sink first); marker present but expected log absent means code path not reached or a real test failure.
- **OUT** — new skill, new plugin items, and edits to existing skills (no `logging` mentions found in skills' `SKILL.md` files).
- **OUT** — Phases 1, 2, 4, 5 changes; those do not debug tests.
- **OUT** — mandating a specific logging framework (guess: keep it framework-neutral).

### Constraints

- **Upstream rule** — `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` is `1.1.3` and must be bumped.
- **Existing style** — the agent says "Suggest, don't assume" and "Minimize changes"; the check must be a proposed step, not an automatic chain.
- **Schema immutability** — Phase 6 forbids schema changes; any logging aid must not alter DB objects (stored-procedure logging like `RAISE NOTICE` is allowed only as a stored-procedure fix kept in sync with `DDL/Postgres/{ProjectName}/`).
- **Fork-only** — nothing under `.github/fork-only/` is promoted upstream.
- **Description quoting** — keep frontmatter untouched.

### Assumptions I am making

- **Phase 6 only** — the check belongs in the Phase 6 failure loop.
- **User-mediated evidence** — the agent asks the user to include a marker line in the test output.
- **Agent may add temporary logging** — only in the `.Postgres` copy, and removed afterwards (consistent with "Preserve comments and application logic").
- **Wording-level change** — no new capability, so a patch bump.
- **Oracle project untouched** — the rule never touches the original Oracle test project.

## Plan

- **Edit agent file** — `agents/oracle-to-postgres-migration-expert.agent.md`, Phase 6, under "For each failure the user reports, diagnose and fix."; insert a sub-bullet block *Verify logging first* before the "most common issues" list.
  - Ask the user to confirm a marker log line (e.g. `LOGGING-CHECK <test name>`) from test setup of the `.Postgres` test project appears in test output.
  - If marker missing: classify as a logging failure (sink/level/`ITestOutputHelper` wiring/filter), fix that first, do not alter test or application logic.
  - If marker present but expected diagnostic lines are missing: treat as a code path or test failure and proceed to normal diagnosis.
  - Only add temporary logging in the `.Postgres` copies and note it for removal.
- **Edit success criteria** — no change; logging verification is a diagnostic step, not a gate.
- **Bump plugin version** — `plugins/oracle-to-postgres-migration-expert/plugin.json` `1.1.3` → `1.1.4` (**patch**: instruction wording only, no new capability or behaviour break).
- **Rebuild** — run build to regenerate any docs derived from the agent description (expected none).

## Acceptance criteria

- [ ] Agent Phase 6 failure loop states a logging-verification step before debugging.
- [ ] The step defines observable evidence (marker line in user-reported output).
- [ ] The step distinguishes logging failure from test failure with explicit rules.
- [ ] Step is framed as a suggestion/handoff consistent with "one step at a time".
- [ ] No other phase, skill, or workflow is changed.
- [ ] `plugin.json` version bumped to `1.1.4`.
- [ ] Validation commands pass.

## Open questions

- **Q1 — phase scope** — options: (a) Phase 6 only, (b) Phases 3 and 6, (c) all debugging; I would pick (a).
- **Q2 — mandatory vs. conditional** — options: (a) always verify once per test session, (b) verify only when a failure lacks diagnosable output, (c) every failure; I would pick (a).
- **Q3 — agent-added logging** — options: (a) allow temporary logging in `.Postgres` copies, (b) forbid agent-added logging and only verify existing; I would pick (a).
- **Q4 — approve or close** — options: (a) implement, (b) close as not worthwhile given the added round trip; I would pick (a).

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- `git diff --stat` — confirm only the agent file and `plugin.json` changed.
