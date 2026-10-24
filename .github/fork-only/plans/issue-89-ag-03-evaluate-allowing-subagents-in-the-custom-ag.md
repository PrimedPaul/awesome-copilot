---
issue: 89
title: '[AG-03] Evaluate allowing subagents in the custom agent'
scope: agent
status: draft
---

## Issue summary

- **Core ask** — evaluate removing directives like "act directly" / "execute tasks yourself" so the agent can parallelise integration-test creation via subagents.
- **Deliverable is a recommendation** — the issue says "record risks and a recommendation"; it is exploratory, "not approved or prioritized".
- **Restatement gap** — the issue says "evaluate"; I read the deliverable as an evaluation report, not an agent edit. Any edit is conditional on the recommendation.
- **Related work** — WF-04 (progress visibility with subagents) depends on this outcome.

## Grilling

### Ambiguities

- **"Compare behavior with and without"** — no harness exists; a real comparison needs live Copilot runs against a sample .NET/Oracle solution, which this repo does not contain.
- **Which phase parallelises** — the issue names integration-test creation (Phase 3, skill `creating-oracle-to-postgres-migration-integration-tests`), but Phase 6 and per-project work could also fan out.
- **Where the report lives** — the issue does not say; the fork-only tree is the only place that never goes upstream.
- **Success metric** — "parallelism, coordination, context retention" have no defined pass/fail.

### Scope

- **IN** — audit the full body of `agents/oracle-to-postgres-migration-expert.agent.md` for delegation-conflicting text.
- **IN** — audit `skills/*oracle-to-postgres*/SKILL.md` files for delegation-conflicting text.
- **IN** — a written evaluation with risks and a recommendation.
- **OUT** — changing the agent, skills, or plugin unless the maintainer accepts the recommendation (see Q1).
- **OUT** — implementing the WF-04 progress hook.
- **OUT** — building an automated eval harness (WF-03).

### Constraints

- **Upstream promotion** — if the agent changes, bump the `version` in `plugins/oracle-to-postgres-migration-expert/plugin.json` (currently `1.1.3`).
- **Fork-only report** — the evaluation file under `.github/fork-only/` must never be promoted upstream.
- **Tool availability** — the agent frontmatter `tools` is `[vscode/memory, vscode/runCommand, vscode/askQuestions, execute, read, edit, search, todo]`, with no `agent` tool, so removing wording alone cannot enable subagents.
- **Conflicting instructions** — "One step at a time", "Do not chain tasks automatically", and the user hand-off gates in Phases 3, 4, 6 also resist autonomous fan-out.
- **Gated phases** — Phase gates are ordered; parallelism is only safe within a phase (e.g. per test class).
- **Naming drift** — line 17 says `runInTerminal` while `tools` lists `execute`; a clean-up candidate if the line is touched.

### Assumptions I am making

- **Report location** — I assume `.github/fork-only/evaluations/ag-03-subagents.md` (new file) is acceptable.
- **No live testing** — I assume the first round is a static analysis; empirical runs are a follow-up.
- **Only one directive found** — grep of the agent and skills found "delegating to subagents" only at agent line 17 ("Act directly"); I did not review other skills' full text for implicit serial assumptions.
- **Skill 3 steps** — I assume the integration-tests skill is the unit to parallelise (66 lines; I did not read it in full).
- **Agent is run in VS Code / Copilot CLI** — the subagent tool name differs (`agent` vs `runSubagent`), which affects the proposed change.

## Plan

- **Create evaluation report** — `.github/fork-only/evaluations/ag-03-subagents.md` (fork-only, new), with sections: *Conflicting directives* (inventory with line refs), *Tooling prerequisite*, *Parallelism opportunity*, *Coordination and context-retention risks*, *Test method*, *Recommendation*.
- **Inventory step** — list `## Your Approach` bullets "Act directly", "One step at a time", "Suggest, don't assume", plus the Phase 3 hand-off note, and classify each as blocking / compatible / needs rewording.
- **Risk section** — cover lost context from delegated work, inconsistent edits across parallel workers (shared base class and seed manager from the scaffolding skill), DB/test-run side effects, and the "never apply DDL" rule not propagating to subagents.
- **Test method** — define a with/without comparison on a small sample solution: metrics = wall-clock, number of test files completed, plan-adherence, and whether the main session can summarise the work.
- **Conditional agent edit (only if Q1 = yes)** — in `agents/oracle-to-postgres-migration-expert.agent.md`:
  - Reword the **Act directly** bullet under `## Your Approach` to permit subagents for independent test-file creation in Phase 3, keeping the main agent responsible for the plan and summary.
  - Add the subagent tool (`agent`) to frontmatter `tools`.
  - Add a guideline that subagents inherit the DDL/schema-immutability rules.
- **Plugin bump (only with agent edit)** — `plugins/oracle-to-postgres-migration-expert/plugin.json` `1.1.3` → `1.2.0` (minor: new capability); patch if only wording changes.

## Acceptance criteria

- [ ] Evaluation report exists and lists every delegation-conflicting instruction with its location.
- [ ] Report records the tooling prerequisite (no subagent tool in `tools`).
- [ ] Report records risks for coordination and context retention.
- [ ] Report gives a clear recommendation: adopt, adopt narrowly, or reject.
- [ ] If adopted, agent edit and plugin version bump are made and validated.
- [ ] WF-04 dependency noted in the report.

## Open questions

- **Q1 — evaluation vs implementation** — options: (a) report only; (b) report plus agent change if recommended; (c) agent change now. I would pick (a), since the issue is exploratory.
- **Q2 — report location** — options: (a) `.github/fork-only/evaluations/ag-03-subagents.md`; (b) a section appended to `change-brainstorming.md`; (c) issue comment only. I would pick (a).
- **Q3 — empirical comparison** — options: (a) static analysis only; (b) also run live with/without trials on a sample solution you provide. I would pick (a) now, (b) as a follow-up.
- **Q4 — parallelism scope** — options: (a) Phase 3 test creation only; (b) also Phase 6 and per-project fan-out. I would pick (a).

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- `git diff --stat main -- agents plugins skills` — empty if the outcome is report-only.
- Domain-specific: run the agent on a sample solution with and without the directive and record the metrics listed under Plan.
