---
issue: 87
title: '[AG-01] Review agent instructions for appropriate specificity'
scope: agent
status: draft
---

## Issue summary

- **Review instructions** — assess `agents/oracle-to-postgres-migration-expert.agent.md` for whether its constraints are generic enough to bind behaviour while keeping their intent.
- **Test missing DDL** — check that the agent asks for a required DDL artifact instead of proceeding.
- **Deliverable is findings** — "document findings and proposed instruction changes"; the issue does not literally ask for edits (my reading: findings first, edits only after the maintainer picks).
- **Exploratory** — the issue says it is "not approved or prioritized".

## Grilling

### Ambiguities

- **"Generic enough"** — could mean less project-specific wording or less brittle rules; the agent hard-codes phase numbers, paths and `.Postgres` suffixes, so the reading changes the findings.
- **"Test" method** — no harness exists for agents; the test is likely a manual or scripted scenario with a transcript.
- **"Required DDL artifact"** — Oracle DDL, Postgres DDL, or either depending on phase; the agent treats these differently.
- **Which model** — frontmatter says `model: 'Claude Sonnet 5'`; behaviour may differ on other models.

### Scope

- **IN** — written review of the agent file's constraints, grouped as phase-specific vs generic.
- **IN** — missing-DDL scenario analysis against Phase 1, 2 and 4 text and the skills' DDL references.
- **IN** — a findings document plus proposed wording changes.
- **OUT** — applying instruction edits (guess: a follow-up issue once approved).
- **OUT** — changing skills' technical content, or fork tooling.

### Constraints

- **Version bump** — any later agent wording change needs a `plugin.json` bump (currently `1.1.3`); a findings-only change needs none.
- **Upstream rules** — the agent `description` must stay in single quotes; `CONTRIBUTING.md` conventions apply.
- **Plugin coupling** — `plugin.json` lists `./agents/oracle-to-postgres-migration-expert.md`, which differs from the source file name `.agent.md`; materialization handles it, but verify.
- **Fork-only files** — this plan and the findings doc must never be promoted upstream.

### Assumptions I am making

- **Findings location** — the findings go in `.github/fork-only/` (fork-only), not in the agent.
- **Missing DDL means Oracle DDL** — Phase 1 says "Oracle DDL artifacts are confirmed present ... If DDL artifacts are missing, stop and ask the user".
- **Static reading suffices first** — an actual agent run is a stretch step.
- **Findings below are from reading only** — I have not run the agent.

## Plan

- **Review document** — create `.github/fork-only/ag-01-instruction-review.md` with a table: instruction, location, generic vs phase-specific, risk, proposed change.
- **Missing-DDL analysis — Phase 1** — the success criteria already say stop and ask; note it is gated only at the end of Phase 1, so Phase 1 steps could still run.
- **Missing-DDL analysis — Phase 2** — "Scan `DDL/Oracle/{ProjectName}/` as supplemental context" is worded as optional; propose an explicit stop-and-ask if the per-project folder is missing, even when the global folder exists.
- **Missing-DDL analysis — Phase 4** — no stated behaviour when Oracle DDL for a project is missing or when `DDL/Postgres/` is absent but the external-tool flag is true; propose a check.
- **Missing-DDL analysis — skills** — `skills/migrating-oracle-to-postgres-stored-procedures/SKILL.md` reads from `DDL/Oracle/Procedures and Functions/` with no missing-file guidance; propose a stop-and-ask line.
- **Consistency finding** — the Working Directory section says "if not, ask the user" while Phase 1 says "stop and ask"; propose one wording.
- **Test scenarios** — document three manual prompts: no DDL folder, DDL folder empty, DDL present for other projects only; record expected vs observed.
- **Proposed edits** — list each as old text → new text; do not apply them.
- **No plugin bump now** — findings-only; if edits are later approved, patch bump (`1.1.3` → `1.1.4`) for wording clarifications.

## Acceptance criteria

- [ ] Every constraint in the agent's *Guidelines* section is classified generic vs phase-specific.
- [ ] Missing-DDL behaviour is assessed for Phases 1, 2 and 4 and the stored-procedures skill.
- [ ] At least three missing-DDL test scenarios are written with expected agent behaviour.
- [ ] Proposed instruction changes are listed as concrete old → new wording.
- [ ] No agent, plugin or skill file is modified in this issue.

## Open questions

- **Q1 — meaning of "generic enough"** — options: (a) reduce hard-coded paths/phase numbers, (b) keep rules but make them testable, (c) both; I would pick (b).
- **Q2 — test depth** — options: (a) static reading only, (b) also run the agent in Copilot CLI with transcripts; I would pick (a) first, then (b) for missing-DDL only.
- **Q3 — apply edits in this issue** — options: (a) findings only, (b) findings plus a patch-level agent edit; I would pick (a).
- **Q4 — findings location** — options: (a) fork-only doc, (b) comment on the issue; I would pick (a).

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- **Manual** — run the three missing-DDL scenarios and confirm the agent asks for the artifact before advancing.
