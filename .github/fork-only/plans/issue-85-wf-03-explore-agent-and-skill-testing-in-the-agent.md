---
issue: 85
title: '[WF-03] Explore agent and skill testing in the agentic workflow'
scope: fork-tooling
status: draft
---

## Issue summary

- **Exploration only** — the issue asks for a written investigation, not a shipped evaluation harness; it says "This is exploratory, not approved or prioritized."
- **Per-resource focus** — test the behaviour of the individual agent (`agents/oracle-to-postgres-migration-expert.agent.md`) and its skills, not repository-level outcomes.
- **Three deliverables** — representative scenarios, meaningful pass/fail criteria, and how checks could be run, plus how this complements WF-01.
- **Restatement gap** — the issue says "in the agentic workflow"; I read that as the fork's gh-aw/Copilot CLI lifecycle (`.github/fork-only/README.md`), which the issue never defines.

## Grilling

### Ambiguities

- **"Agentic workflow" undefined** — could mean the fork's `fork-*` gh-aw workflows, the dev-orchestrator interactive flow, or upstream's catalog `workflows/`. It determines where checks run.
- **"Testing" undefined** — could be LLM-output evaluations, static structural lint, or scripted scenario transcripts. They differ hugely in cost and determinism.
- **Where findings live** — the issue does not say if the output is a doc, a follow-up issue set, or a prototype.
- **WF-01 not yet explored** — WF-01 ("Repository-level evaluations") has no defined goals, so "complements WF-01" can only be stated tentatively.

### Scope

- **IN** — a single exploration document under `.github/fork-only/` covering scenarios, pass/fail criteria, run options, and the WF-01 relationship.
- **IN** — a candidate scenario catalogue per skill folder listed in `plugins/oracle-to-postgres-migration-expert/plugin.json`.
- **IN** — a cost, determinism, and secrets assessment of run options (Actions, Copilot CLI locally, existing `skill-check` vally lint).
- **OUT** — implementing any eval workflow, harness, or fixtures.
- **OUT** — changing the agent, plugin, or skills; no `plugin.json` bump is needed unless a later issue does.
- **OUT** — repository-level evaluation design (WF-01).

### Constraints

- **Never promoted upstream** — all output lives under `.github/fork-only/`; the bundler must not include it.
- **Plugin version untouched** — no agent-path change, so no semver bump; any later implementation touching agent paths needs a bump above upstream's version.
- **No PAT for agents** — per the fork README, `FORK_AUTOMATION_PAT` is never available to gh-aw agent jobs; any eval run must work without it.
- **LLM nondeterminism** — pass/fail criteria must tolerate variation, so prefer rubric/assertion checks over exact-match.
- **No Oracle/Postgres runtime in CI** — the skills reference integration tests against real databases; scenarios must be checkable on text artefacts.
- **Repo conventions** — LF line endings, bullet-style docs.

### Assumptions I am making

- **Scope label** — I classify this as fork tooling because it is about the fork's workflow, not agent behaviour changes.
- **Doc deliverable** — the exploration output is a Markdown document, not code.
- **Skills not deeply read** — I did not read every skill's `SKILL.md` for this seed; scenario examples below must be validated against them.
- **Existing coverage** — upstream's `skill-check.yml` (vally lint) already gives static skill checks; I have not inspected its exact rules.
- **No existing eval tooling** — `.github/fork-only/` contains only `README.md`, `change-brainstorming.md`, and `plans/`.
- **WF-01 relationship is a hypothesis** — WF-01 asks "is the repo delivering outcomes", WF-03 asks "does resource X behave as specified".

## Plan

- **Create exploration doc** — `.github/fork-only/agent-skill-testing-exploration.md` with these `##` sections:
  - *Testing layers* — static (frontmatter/structure, already covered by `npm run skill:validate` and vally), prompt-level scenario evals, and integration-level behaviour.
  - *Representative scenarios* — one to three per skill in `plugin.json`'s `skills` array, e.g. for `migrating-oracle-to-postgres-stored-procedures`: given a PL/SQL procedure with `NVL`/`SYSDATE`, the output must use `COALESCE`/`CURRENT_TIMESTAMP`; for `creating-oracle-to-postgres-migration-bug-report`: output follows the skill's bug report template.
  - *Pass/fail criteria* — assertion types: required/forbidden strings, required file structure, rubric scored by an LLM judge with a threshold, and a tolerance policy for nondeterminism.
  - *Run options* — compare (a) a scheduled or `workflow_dispatch` gh-aw workflow, (b) local Copilot CLI runs by the maintainer, (c) extending vally; rate each on cost, determinism, secrets, and PR-blocking suitability.
  - *Relationship to WF-01* — WF-03 gives per-resource signals that can feed WF-01's repository-level goals; list the signals.
  - *Recommendation and follow-ups* — pick one option and list follow-up issues, without implementing.
- **Update brainstorm link** — in `.github/fork-only/change-brainstorming.md`, under `### WF-03: Agent and skill testing in the agentic workflow`, add one bullet pointing to the new doc.
- **No other files** — no `plugin.json`, agent, skill, or workflow edits; plugin `version` stays `1.1.3` (no bump: no promoted-path change).

## Acceptance criteria

- [ ] Exploration doc exists under `.github/fork-only/` and is not referenced by any promoted path.
- [ ] At least one scenario per skill listed in `plugin.json`, plus at least one for the agent itself.
- [ ] Each scenario has explicit, checkable pass/fail criteria and a stated nondeterminism tolerance.
- [ ] At least three run options compared on cost, determinism, secrets, and gating suitability.
- [ ] A section explains how WF-03 complements WF-01 and names the dependency.
- [ ] A clear recommendation and a list of follow-up issues exist.
- [ ] No changes to the agent, plugin, or skills.

## Open questions

- **Q1 — meaning of "agentic workflow"** — options: (a) the fork's gh-aw `fork-*` workflows in Actions, (b) the interactive dev-orchestrator flow, (c) both; I would pick (c), with Actions as the primary run venue.
- **Q2 — deliverable form** — options: (a) a Markdown exploration doc only, (b) doc plus a small prototype eval for one skill, (c) doc plus follow-up issues; I would pick (a) with follow-up issues listed inside it.
- **Q3 — judging approach** — options: (a) deterministic assertions only, (b) assertions plus LLM-as-judge rubric, (c) human review only; I would pick (b).
- **Q4 — sequencing against WF-01** — options: (a) wait for WF-01 goals first, (b) proceed now and mark the WF-01 link provisional; I would pick (b).

## Verification

- `bash eng/fix-line-endings.sh` — normalise line endings.
- `npm run build` — confirm nothing regenerated unexpectedly (expect no diff in promoted files).
- `npm run skill:validate` and `npm run plugin:validate` — confirm the agent paths are untouched and still valid.
- `git diff --name-only origin/main` — confirm only files under `.github/fork-only/` changed.
