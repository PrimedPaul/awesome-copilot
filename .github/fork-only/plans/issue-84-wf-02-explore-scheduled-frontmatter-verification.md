---
issue: 84
title: '[WF-02] Explore scheduled frontmatter verification'
scope: fork-tooling
status: draft
---

## Scope classification

- **Fork tooling change** — a scheduled workflow would live under `.github/workflows/fork-*` and must **never** be promoted upstream.
- **Exploratory only** — the issue says "This is exploratory, not approved or prioritized."; the deliverable is a decision record, not a workflow.

## Issue summary

- **Explore, don't build** — evaluate a scheduled workflow that verifies resource frontmatter.
- **Decide behaviour** — choose between reporting issues, proposing reviewable updates, or making changes.
- **Assess model automation** — judge whether the `model:` field can be kept current automatically, and with what safeguards.
- **Restatement gap** — the issue's "Done when" asks for definitions and decisions, so I read the output as a written design, not code.

## Grilling

### Ambiguities

- **"Resource" undefined** — agents, instructions, skills, hooks, workflows, plugins all have different frontmatter; coverage drives cost.
- **Fork vs upstream resources** — unclear whether to check only the Oracle-to-PostgreSQL agent/skills or all resources synced from upstream.
- **"Verify" undefined** — could mean schema validity, required fields, style (single-quoted `description`), or semantic correctness.
- **"Model maintenance" undefined** — retired models, preferred-model drift, or missing `model:` fields all differ.
- **Source of truth for models** — no authoritative list of valid model identifiers is named; `agents/*.agent.md` use mixed forms (`GPT-4.1`, `'Claude Sonnet 4.5'`, `claude-3.5-sonnet`, `"gpt-4.1"`).
- **Overlap with existing checks** — `eng/validate-skills.mjs`, `eng/validate-plugins.mjs`, and `eng/yaml-parser.mjs` already validate parts of frontmatter; the gap is not stated.

### Scope

- **IN: decision record** — a document answering the three "Done when" items.
- **IN: coverage matrix** — resource type × field × existing validator × proposed check.
- **IN: model-field assessment** — data sources, risks, and safeguards.
- **IN (guess): fork-owned files first** — recommend starting with `agents/oracle-to-postgres-migration-expert.agent.md`, `plugins/oracle-to-postgres-migration-expert/plugin.json` and its skills.
- **OUT: implementation** — no workflow file, script, or `.lock.yml` in this issue.
- **OUT: editing resources** — the agent, plugin and skills are not changed here.
- **OUT: upstream promotion** — nothing here goes to `github/awesome-copilot`.

### Constraints

- **Fork-only** — new tooling goes in `.github/fork-only/` and `.github/workflows/fork-*` only; excluded from upstream bundles.
- **No plugin bump** — no agent, plugin, or skill change, so `plugin.json` `version` (currently `1.1.3`) stays unchanged.
- **gh-aw rules** — a future workflow needs `.md` source compiled to `.lock.yml` with `gh aw compile --validate`, least-privilege permissions and safe outputs.
- **Model volatility** — the agent currently has `model: 'Claude Sonnet 5'`; automatic changes could set models unavailable to the user's plan.
- **Upstream conventions** — `CONTRIBUTING.md`/`AGENTS.md` require single-quoted `description`, and `name`/`model` recommended on agents.
- **Sync noise** — `fork-sync-watchdog` pulls upstream resources; a check on all files would flag upstream-owned content the fork shouldn't edit.

### Assumptions I am making

- **Classification** — scheduled-workflow work is fork tooling, not an agent change.
- **Output is a doc** — I assume the exploration result is committed as a Markdown decision record under `.github/fork-only/`.
- **No live access to a model catalogue** — I have not verified any API listing valid Copilot model identifiers.
- **Existing validators are a baseline** — I did not read every validator in full; the coverage matrix must start by reading them.
- **Reporting is safest default** — recommendation (a guess) is report-only first, then reviewable PRs.
- **`.github/fork-only/change-brainstorming.md` WF-02** — it states "No automation behavior has been decided." and I treat that as binding.

## Plan

- **`.github/fork-only/frontmatter-verification-exploration.md` (new)** — decision record with these sections:
  - *Coverage matrix* — table of resource types (agents, instructions, skills, hooks, workflows, plugins) × required/recommended fields × existing validator (`eng/validate-skills.mjs`, `eng/validate-plugins.mjs`, `eng/yaml-parser.mjs`) × gap.
  - *Behaviour options* — compare **report issues** (tracking issue via `create_issue`), **propose updates** (draft PR via `create_pull_request`), **make changes** (direct push); give a recommendation and a rejected-options rationale.
  - *Model-field automation* — compare candidate sources of truth (a maintained allow-list file in the fork, upstream docs, a model API), failure modes (hallucinated or retired IDs, format drift) and safeguards (allow-list file, deterministic script rather than LLM guess, PR-only, human approval, no auto-merge).
  - *Schedule and cost* — cadence (weekly alongside `fork-sync-watchdog`), run-cost, noise control (dedupe existing open issue/PR).
  - *Follow-up issue sketch* — scope, files, acceptance criteria for an implementation issue, if the decision is to proceed.
- **`.github/fork-only/change-brainstorming.md` (edit, small)** — under `### WF-02`, link to the decision record and record the decision. Skip if Q3 is answered "no".
- **No other files** — no `plugin.json` change; **semver: none** (no shipped content changes).

## Acceptance criteria

- [ ] Coverage matrix names every resource type and field checked, plus fields explicitly excluded.
- [ ] Decision made and justified: report, propose, or change.
- [ ] Model-field automation assessed with named source of truth and safeguards, or a reasoned "not recommended".
- [ ] Gaps versus existing validators identified.
- [ ] Follow-up implementation issue drafted or explicitly declined.
- [ ] No agent, plugin, skill, or workflow file changed; plugin `version` unchanged.

## Open questions

- **Q1 — resource coverage** — options: (a) fork-owned agent/plugin/skills only; (b) all resources in the repo; (c) fork-owned plus resources changed by sync PRs. I would pick (a), widening later.
- **Q2 — default behaviour** — options: (a) report via issue; (b) open a draft PR with proposed fixes; (c) push changes. I would pick (a) for structural checks and (b) for model-field changes.
- **Q3 — model-field automation** — options: (a) not at all, report only; (b) PR suggestions from a maintained allow-list file; (c) LLM picks the "best current model". I would pick (b), with (c) rejected.
- **Q4 — deliverable location** — options: (a) new decision record in `.github/fork-only/`; (b) comment on this issue only. I would pick (a).
- **Q5 — duplication with upstream CI** — options: (a) reuse the existing `eng/` validators; (b) write a fork-only checker. I would pick (a).

## Verification

- `bash eng/fix-line-endings.sh`
- `npm run build`
- `npm run skill:validate`
- `npm run plugin:validate`
- `git diff --name-only main` — confirm only `.github/fork-only/` files changed.
- `gh aw compile --validate` — only if a follow-up implements the workflow.
