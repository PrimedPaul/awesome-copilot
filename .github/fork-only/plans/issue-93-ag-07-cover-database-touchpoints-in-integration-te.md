---
issue: 93
title: '[AG-07] Cover database touchpoints in integration test planning'
scope: agent
status: draft
---

## Issue summary

- **Define touchpoint** — the issue wants "database touchpoint" defined so the minimum "at least one test case per touchpoint" is testable.
- **Coverage check** — it wants a defined way to check plan coverage against the application.
- **Gap vs literal text** — the issue says target `planning-integration-tests`; no such folder exists. The real skill is `skills/planning-oracle-to-postgres-migration-integration-testing/`.
- **Already partly present** — Step 3 of that SKILL.md already says "Coverage mapping that ensures every database touchpoint has at least one test case (or a justified set of cases for high-risk methods)". The term is undefined and unverifiable.

## Grilling

### Ambiguities

- **Touchpoint unit** — method, SQL statement, stored procedure call, table, or call site? Each yields very different test counts.
- **Direct vs transitive** — Step 1 says "interact directly with the database"; service layers calling repositories may or may not count.
- **Verification mechanism** — "checked against the application" could mean a scripted grep/inventory or an agent self-check in the plan; the skill has no scripts.
- **Exemption rule** — "justified set of cases for high-risk methods" is unclear; can a touchpoint be exempt with a stated reason?
- **Dynamic SQL** — ORM/LINQ and string-built SQL are hard to enumerate; it matters for completeness.

### Scope

- **IN** — define "database touchpoint" in the planning SKILL.md.
- **IN** — add an enumerated touchpoint inventory step and a coverage table (touchpoint → test case IDs) to the plan format.
- **IN** — add a completeness check: every inventory row has at least one test case or a stated exemption.
- **OUT** — changes to the other seven skills, the agent file, or test-writing/scaffolding behaviour.
- **OUT** — adding scripts or tooling to the skill; guess: instructions-only.
- **OUT** — fixing the output path discrepancy (agent: `Reports/{ProjectName}/Integration Testing Plan.md` vs skill: `.github/oracle-to-postgres-migration/Reports/{TARGET_PROJECT} Integration Testing Plan.md`); flag only.

### Constraints

- **Upstream bump** — `plugins/oracle-to-postgres-migration-expert/plugin.json` version must be bumped from `1.1.3`.
- **SKILL.md rules** — keep `name` matching folder, description in single quotes, 10–1024 chars.
- **Single-project scope** — must keep "Single project scope" and "Database interactions only" constraints.
- **Downstream consumer** — `creating-oracle-to-postgres-migration-integration-tests` is driven by the plan; format changes must remain readable for it.
- **Line endings** — run `bash eng/fix-line-endings.sh` before commit.

### Assumptions I am making

- **Skill target** — "planning-integration-tests" means `planning-oracle-to-postgres-migration-integration-testing`.
- **Instructions only** — no bundled scripts; coverage is checked by the agent through an inventory table in the plan.
- **Touchpoint definition** — one distinct database operation invoked from the project: each SQL statement, stored procedure/function call, or ORM query/command, identified by its enclosing method.
- **Transitive callers** — callers that only delegate to a touchpoint are not touchpoints themselves.
- **Exemptions allowed** — a touchpoint may have zero tests only with a written justification.
- **Exploratory** — the issue is marked exploratory, so the change is small and wording-focused.

## Plan

- **`skills/planning-oracle-to-postgres-migration-integration-testing/SKILL.md` — Step 1** — add a definition of "database touchpoint" (SQL statement, stored procedure/function call, ORM query/command, each tied to `Class.Method` and file:line) and what is not one (pure delegating callers).
- **Same file — Step 1** — require building a numbered touchpoint inventory (ID, location, operation type, Oracle-specific features) by searching the project for data-access APIs.
- **Same file — Step 3** — replace the vague coverage bullet with a coverage table (touchpoint ID → test case IDs, or exemption with reason).
- **Same file — Step 3** — add a completeness check: re-scan the project and confirm no unlisted touchpoints; every row has at least one test case or justified exemption; high-risk rows have multiple cases.
- **Same file — Progress checklist** — add a "Verify coverage" step.
- **`plugins/oracle-to-postgres-migration-expert/plugin.json`** — bump `1.1.3` → `1.1.4` (patch: wording/process refinement, no new capability or skill).

## Acceptance criteria

- [ ] SKILL.md defines "database touchpoint" with inclusion and exclusion rules.
- [ ] The plan format includes a touchpoint inventory and a touchpoint → test case coverage table.
- [ ] The minimum (at least one test per touchpoint, or a justified exemption) is stated and checkable from the plan alone.
- [ ] A re-scan completeness check is described.
- [ ] Existing constraints and Oracle/PostgreSQL case requirements are unchanged.
- [ ] `plugin.json` version bumped.
- [ ] Validation commands pass.

## Open questions

- **Q1 — touchpoint granularity** — options: (a) per method, (b) per SQL statement/call, (c) per table; I would pick (b), identified by enclosing method.
- **Q2 — exemptions** — options: (a) allow justified exemptions, (b) strict at least one test with no exceptions; I would pick (a).
- **Q3 — enforcement mechanism** — options: (a) instructions-only inventory and table, (b) bundle a search script; I would pick (a).
- **Q4 — output path mismatch** — options: (a) leave out of scope, (b) fix here; I would pick (a) and file a separate issue.

## Verification

- `npm run skill:validate`
- `npm run plugin:validate`
- `npm run build`
- `bash eng/fix-line-endings.sh`
- **Manual check** — dry-run the updated skill on a sample .NET repository and confirm every touchpoint appears in the coverage table.
