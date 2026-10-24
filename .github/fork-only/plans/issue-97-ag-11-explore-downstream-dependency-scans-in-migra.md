---
issue: 97
title: '[AG-11] Explore downstream dependency scans in migration planning'
scope: agent
status: draft
---

## Issue summary

- **Core ask** — while building `Reports/MasterMigrationPlan.md`, explore scanning for downstream dependencies (things that consume the project being migrated).
- **Ordering caveat** — a dependency "might need migration first", but real ordering must be investigated, not inferred.
- **Done when** — a way to identify and present dependencies is assessed, unresolved ordering questions are visible, and migration order is not assumed from scan results alone.
- **Restatement gap** — the issue says "explore/assess", so the deliverable may be an assessment rather than a shipped feature; this plan assumes a small shipped feature plus the assessment recorded in the plan.

## Grilling

### Ambiguities

- **"Downstream" undefined** — could mean project-reference consumers (`.csproj` `ProjectReference`), other solutions/services calling the app, or DB-level consumers (views, procs, jobs); each needs a different scan.
- **Direction of ordering** — "downstream might need migration first" contradicts the current skill rule "Order projects so that shared/foundational libraries are migrated before their dependents."; the issue wants this made a question, not a rule.
- **Exploratory vs. deliverable** — unclear whether a written assessment alone satisfies "Done when", or whether skill/agent text must change.
- **Scan depth** — no statement on whether scanning is solution-local or extends beyond the solution.

### Scope

- **IN** — `skills/creating-oracle-to-postgres-master-migration-plan/SKILL.md`: add a dependency-scan step based on `ProjectReference` edges (and optionally Oracle-related shared config/DDL cross-references) within the solution.
- **IN** — extend the plan template with a dependency section and an "Unresolved ordering questions" section.
- **IN** — a short note in the agent's Phase 1 description pointing at the new section.
- **IN** — plugin version bump.
- **OUT** — scanning outside the solution (other repos, services, runtime callers).
- **OUT** — automated topological sorting or auto-reordering of `Migration Order`.
- **OUT** — other brainstorm items (AG-12, AG-13, etc.).
- **OUT** — fork-only tooling changes.

### Constraints

- **Template is parsed** — the skill says "downstream consumers depend on the structure"; existing headings and columns must stay intact, only additions are safe.
- **User confirmation step** — Step 3 already lets the user adjust ordering; new questions should feed into that step.
- **Upstream promotion** — plugin `version` in `plugins/oracle-to-postgres-migration-expert/plugin.json` (currently `1.1.3`) must be bumped.
- **Agent gating** — agent Phase 1 success criteria are checked by the agent; do not add criteria that block on unanswerable questions.
- **Conventions** — skill `description` stays single-quoted; LF line endings.

### Assumptions I am making

- **Scope limited to solution** — dependency scan covers `.sln`/`.slnx` projects only.
- **Dependency means project reference** — primary signal is `ProjectReference` in `.csproj`, plus assembly references in `packages.config`-style projects if present.
- **Scan is evidence, not order** — results appear as a dependency table with a "confidence/evidence" note and never directly set `Migration Order`.
- **No new files** — no scripts are bundled; the agent performs the scan with existing `read`/`search` tools.
- **Edge direction** — "downstream" = projects that depend on a migration candidate.
- **Other fork-only docs unaffected** — brainstorm file is not edited by this plan.

## Plan

- **Edit `skills/creating-oracle-to-postgres-master-migration-plan/SKILL.md` — workflow checklist** — add `Step 2b: Scan dependencies` to the `Progress` list and step headings.
- **Edit same file — new "Step 2b: Scan dependencies" after "Step 2: Classify each project"** — for each MIGRATE project, list projects that reference it (and that it references) from `.csproj` `ProjectReference` entries; mark each edge with evidence; note that a dependent might require migration first, but this is not assumed.
- **Edit same file — Step 3** — require presenting dependency edges and open ordering questions to the user alongside the classification.
- **Edit same file — template** — add `## Project Dependencies` (table: Project, Depends On, Depended On By, Evidence) and `## Unresolved Ordering Questions` (bullets, `None` if empty) between `Project Inventory` and `Migration Order`.
- **Edit same file — final line** — soften "Order projects so that shared/foundational libraries are migrated before their dependents." to say that it is a default heuristic subject to the user's resolution of ordering questions, and that `Migration Order` rationale should cite resolved questions.
- **Edit `agents/oracle-to-postgres-migration-expert.agent.md` — Phase 1** — one added bullet: "Record project dependency edges and any unresolved ordering questions in `Reports/MasterMigrationPlan.md`; do not infer migration order from the scan alone." Success criteria unchanged except to include the new sections existing.
- **Edit `plugins/oracle-to-postgres-migration-expert/plugin.json`** — `version` `1.1.3` → `1.2.0` (minor: new capability in the planning skill; template additions are backward compatible).
- **Record assessment** — summarize in the PR description the limits of a `ProjectReference` scan (no runtime/DB-level callers).

## Acceptance criteria

- [ ] Skill workflow includes a dependency scan step covering `ProjectReference` edges.
- [ ] Template includes `Project Dependencies` and `Unresolved Ordering Questions` sections without altering existing sections.
- [ ] Skill text states that scan results do not by themselves determine migration order.
- [ ] Agent Phase 1 mentions recording dependencies and open ordering questions.
- [ ] Step 3 asks the user to resolve ordering questions.
- [ ] `plugin.json` version bumped.
- [ ] Validation commands pass.

## Open questions

- **Q1 — deliverable form** — options: (a) ship skill/agent changes now; (b) assessment document only, no behaviour change. I would pick (a), since "Done when" says to "present" dependencies.
- **Q2 — dependency definition** — options: (a) `ProjectReference` only; (b) also DB-level consumers (views/procs/triggers from DDL); (c) also external callers the user names. I would pick (a), with (c) captured as a user-supplied question.
- **Q3 — default ordering heuristic** — options: (a) keep "foundational first" as a labelled default; (b) remove the heuristic entirely and require the user to decide. I would pick (a).
- **Q4 — version bump level** — options: minor `1.2.0` vs patch `1.1.4`. I would pick minor.

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- **Manual dry run** — read the updated skill and confirm the template renders with both new sections and the original headings unchanged.
