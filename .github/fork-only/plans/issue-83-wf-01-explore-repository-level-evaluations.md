---
issue: 83
title: '[WF-01] Explore repository-level evaluations'
scope: fork-tooling
status: draft
---

# Plan: [WF-01] Explore repository-level evaluations

## Issue summary

- **Exploration, not build** — the issue asks for a written exploration of evaluations that tell whether the repository's goals are being met.
- **Goals first** — goals and measurable success signals must be defined before any evaluation is chosen.
- **Deliverable** — a document with candidate goals, measurable signals, evidence quality, and a recommendation or next step.
- **Gap from literal text** — the issue says "repository goals" but never says which repository (this fork's agent-promotion effort, or upstream's catalogue); I read it as the fork.
- **Source** — `.github/fork-only/change-brainstorming.md` WF-01, which is "exploratory, not approved or prioritized".

## Grilling

### Ambiguities

- **Which goals** — the fork's stated purpose in `.github/fork-only/README.md` is to develop `agents/oracle-to-postgres-migration-expert.agent.md` and promote it upstream; "goals" could mean that, the planning/review automation quality, or both.
- **"Evaluations" meaning** — could mean LLM evals of agent behaviour, repo health metrics, or workflow outcome metrics; matters because it decides the evidence type.
- **Overlap with WF-03** — `change-brainstorming.md` says WF-03 (agent/skill testing) "focuses on individual resource behavior rather than repository-level outcomes"; the boundary must be drawn.
- **Where output lives** — the issue names no file path for the document.
- **"Done when" wording** — "Resolve what evidence demonstrates…" is a question, not a deliverable; the doc can only recommend, not prove.

### Scope

- **IN** — one new Markdown document under `.github/fork-only/` listing candidate goals, signals, evidence-quality ratings, and a recommendation.
- **IN** — signals derivable from data the fork already has (PR/issue history, plan/review workflow outcomes, `skill-check` results, upstream promotion state).
- **OUT** — implementing any evaluation, workflow, or metric collector; that becomes follow-up issues.
- **OUT** — per-agent/skill behavioural evals (WF-03).
- **OUT** — any change to `agents/`, `skills/`, `plugins/`, or `.github/workflows/`.
- **OUT** — upstream promotion; this is fork-only.

### Constraints

- **Fork-only** — nothing under `.github/fork-only/` is ever promoted upstream; no `plugin.json` version bump is needed because no promoted file changes.
- **Planner limits** — this planning run may only write the plan file; the exploration doc is for the implementation step.
- **Docs format** — Markdown with lowercase-hyphen file name; line endings must be LF (`bash eng/fix-line-endings.sh`).
- **No fabricated data** — evidence-quality claims must cite data that actually exists or explicitly say it is not yet collected.

### Assumptions I am making

- **Scope class** — classified as fork tooling because the output lives in `.github/fork-only/`; it touches neither the agent, plugin, nor skills.
- **Repository = this fork** — goals concern the fork's agent development and upstream promotion pipeline.
- **Doc-only deliverable** — no code, workflow, or schema is expected.
- **Single document** — `.github/fork-only/repository-evaluations.md` is enough; no extra files.
- **Recommendation may be "defer"** — a valid outcome is a ranked shortlist plus a next-step issue, not an adopted evaluation.
- **No plan README read** — I did not read `.github/fork-only/plans/README.md` in detail; lifecycle-gate rules for a doc-only PR should be checked at implementation.

## Plan

- **Create `.github/fork-only/repository-evaluations.md`** with these `##` sections:
  - *Purpose and scope* — restate WF-01, link `change-brainstorming.md`, state the WF-03 boundary.
  - *Candidate goals* — table of goals drawn from `.github/fork-only/README.md` (e.g. agent quality ready for upstream, plan→implement workflow reliability, sync with upstream kept current, promotion passes upstream validation).
  - *Measurable signals* — per goal, 1–3 signals with source and how to collect (e.g. share of `plan/*` PRs merged with all `Q<n>` answered; `fork-agent-reviewer` `REQUEST_CHANGES` rate; time from sync PR open to merge; upstream PR validation pass rate).
  - *Evidence quality* — rate each signal (direct/proxy/anecdotal), sample-size caveats, gameability, and what is missing today.
  - *Candidate evaluations* — options (manual retro checklist, scheduled gh-aw report, golden-scenario evals) with cost/benefit; golden-scenario evals flagged as WF-03 territory.
  - *Recommendation and next step* — pick one, name follow-up issue(s) to open.
  - *Open questions* — anything still unresolved.
- **Optionally edit `.github/fork-only/change-brainstorming.md`** — under WF-01, add a one-line link to the new doc; skip if the maintainer prefers the brainstorm left untouched.
- **No `plugin.json` change** — `plugins/oracle-to-postgres-migration-expert/plugin.json` stays at `1.1.3`; semver bump level: none (no promoted file changes).

## Acceptance criteria

- [ ] `.github/fork-only/repository-evaluations.md` exists with all sections above.
- [ ] At least three candidate goals, each with at least one measurable signal.
- [ ] Every signal names its data source and an evidence-quality rating.
- [ ] A clear recommendation or next step is stated.
- [ ] The WF-01 vs WF-03 boundary is explicit.
- [ ] No file outside `.github/fork-only/` is changed.
- [ ] Lint/validation commands below pass.

## Open questions

- **Q1 — which repository's goals** — options: (a) this fork's agent-promotion pipeline, (b) upstream `github/awesome-copilot` catalogue health, (c) both. I would pick (a).
- **Q2 — meaning of "evaluations"** — options: (a) outcome/health metrics only, (b) metrics plus LLM-based evals, (c) only a manual retrospective checklist. I would pick (a), deferring LLM evals to WF-03.
- **Q3 — output location** — options: (a) new `.github/fork-only/repository-evaluations.md`, (b) a new section in `change-brainstorming.md`, (c) a comment on the issue. I would pick (a).
- **Q4 — follow-up issues** — options: (a) the implementation step opens none and only recommends them, (b) it drafts follow-up issue text in the doc. I would pick (b).

## Verification

- `bash eng/fix-line-endings.sh`
- `npm run build` — confirm nothing upstream-facing changes.
- `npm run skill:validate`
- `npm run plugin:validate`
- `git diff --name-only main` — confirm only files under `.github/fork-only/` changed.
