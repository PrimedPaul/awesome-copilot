---
issue: 86
title: '[WF-04] Explore progress visibility when subagents are used'
scope: agent
status: draft
---

# Plan: issue #86 — progress visibility when subagents are used

## Issue summary

- **Exploratory characterisation** — the issue asks for a written analysis, not a shipped hook; "A hook is an option, not a decided implementation."
- **Context-loss concern** — if subagents are allowed, the main session may lose track of delegated work.
- **Phase-level progress** — the proposal is a hook that records progress after each of the six migration phases.
- **Dependency on AG-03** — `.github/fork-only/change-brainstorming.md` says WF-04 "Depends on the investigation in AG-03", which has not been decided.
- **Gap from literal text** — the issue says "Done when: characterize … assess", so the deliverable is an assessment document; the plan does not assume any agent or plugin edit.

## Grilling

### Ambiguities

- **Current state of subagents** — `agents/oracle-to-postgres-migration-expert.agent.md` says "You perform migration tasks yourself rather than delegating to subagents" and has no `agent`/`task` tool in `tools`, so today there is no delegation to lose context on. The problem is hypothetical until AG-03 lands.
- **Which hook event** — Copilot hooks (see `hooks/session-logger/hooks.json`) expose `sessionStart`, `sessionEnd` and `userPromptSubmitted` there; I did not verify whether a subagent-completion or per-phase event exists. A per-phase hook may not be expressible.
- **"Progress" meaning** — could be the phase number, the checked items in `Reports/{ProjectName}/MigrationChecklist.md`, or a log of delegated task results.
- **Hook location** — hooks installed from a plugin vs. the repo's `hooks/` folder; the Oracle plugin's `plugin.json` has no `hooks` array.

### Scope

- **IN** — a characterisation of the context-retention problem, mapped to Phases 1–6 of the agent.
- **IN** — which phases are plausible delegation candidates (Phase 3 test creation per AG-03; Phases 2, 5, 6 are per-project).
- **IN** — comparison of a hook against alternatives, with a recommendation.
- **IN** — the AG-03 interaction (removal of "Act directly" and the "rather than delegating to subagents" sentence).
- **OUT** — implementing a hook, editing the agent, or changing skills or `plugin.json`.
- **OUT** — AG-03 itself (behaviour comparison with and without the directives); only referenced.

### Constraints

- **No upstream promotion of findings doc** — the analysis lives under `.github/fork-only/`, which is never promoted upstream.
- **Version bump only if shipped** — the analysis alone needs no `plugin.json` change; any later agent/hook change bumps the version from `1.1.3` (patch for wording, minor if a hook ships).
- **Existing phase gates** — the agent already hands off to the user after Phases 3, 4 and 6, and uses `Reports/` files as durable state; an alternative must preserve these.
- **Hook conventions** — a shipped hook needs `hooks/<name>/README.md` with frontmatter and `hooks.json`, per `AGENTS.md`.

### Assumptions I am making

- **Deliverable is a document** — one new file under `.github/fork-only/`, since the issue says "Characterize … assess".
- **AG-03 undecided** — I treat subagent use as hypothetical, not current behaviour.
- **Hook capabilities unknown** — I have not confirmed which events Copilot CLI hooks offer; the plan includes verifying this against current docs.
- **Phase list is authoritative** — the six phases in the agent file are the "phases" the issue refers to.

## Plan

- **Create `.github/fork-only/analysis/wf-04-subagent-progress-visibility.md`** — new document (folder is new; the maintainer may prefer another location, see Q1) with these sections:
  - *Problem characterisation* — where context is lost: subagent results not summarised into the main session, loss on context compaction, and resumed sessions.
  - *Phase map* — a table of Phases 1–6 with columns: delegable?, durable artifact already written (e.g. `Reports/MasterMigrationPlan.md`, `OracleRiskAnalysis.md`, `MigrationChecklist.md`, `PostgresTestMigrationPlan.md`), and handoff gate.
  - *AG-03 interaction* — list the directives in the agent body that conflict with delegation: "Act directly.", "You perform migration tasks yourself rather than delegating to subagents", and the Phase 5 sequential checklist loop.
  - *Options* — (A) a per-phase progress hook, (B) an agent-instruction rule that each delegated task must write its result to `Reports/` and the main agent re-reads it, (C) a progress file such as `Reports/{ProjectName}/Progress.md` updated at each phase gate, (D) rely on the `todo` tool, (E) do nothing until AG-03 proves a problem.
  - *Assessment* — feasibility, determinism, upstream-friendliness and cost for each option.
  - *Recommendation* — my pick is (B)+(C) first, with a hook only if the verified hook events can fire on phase or subagent completion.
- **Verify hook events** — read current GitHub Copilot hooks documentation and record the events actually available; if none maps to phase completion, state that option A is not viable as stated.
- **No other files change** — no edits to `agents/`, `skills/`, or `plugins/oracle-to-postgres-migration-expert/plugin.json`; no version bump.

## Acceptance criteria

- [ ] The analysis document exists and describes the context-retention problem concretely.
- [ ] Each of Phases 1–6 is classified for delegation and progress state.
- [ ] AG-03 and its conflicting directives are discussed.
- [ ] At least three alternatives to a hook are compared with a hook.
- [ ] Hook feasibility is stated against verified Copilot hook events.
- [ ] The document gives a recommendation and states that no implementation is decided.
- [ ] No upstream-promotable file (agent, plugin, skill) is modified.

## Open questions

- **Q1 — deliverable location** — options: (a) `.github/fork-only/analysis/wf-04-…md`; (b) append to `.github/fork-only/change-brainstorming.md`; (c) only comment on the issue. I would pick (a).
- **Q2 — wait for AG-03?** — options: (a) analyse now treating subagents as hypothetical; (b) block until AG-03 has results. I would pick (a), flagged as provisional.
- **Q3 — scope of alternatives** — options: (a) include instruction-only and progress-file alternatives; (b) evaluate hooks only. I would pick (a).
- **Q4 — follow-up implementation** — options: (a) open a separate issue if a hook is recommended; (b) extend this issue. I would pick (a).

## Verification

- `bash eng/fix-line-endings.sh`
- `npm run build` — confirms no generated output changes.
- `npm run skill:validate` — confirms skills untouched.
- `npm run plugin:validate` — confirms plugin untouched.
- `git diff --stat main` — confirms only the plan and analysis files changed.
