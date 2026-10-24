---
issue: 94
title: '[AG-08] Adapt integration testing guidance to application type'
scope: agent
status: draft
---

## Issue summary

- **Exploratory ask** — Investigate scripted Playwright testing for unmanaged code such as Classic ASP, and whether the planning skill should be split by application type.
- **Deliverable is a recommendation** — "Done when" asks for a comparison, a list of application types and approaches, and a recorded recommendation, not a skill rewrite.
- **Gap vs literal text** — The issue (and `change-brainstorming.md` AG-08) names the target `planning-integration-tests`; no such folder exists. The real skill is `skills/planning-oracle-to-postgres-migration-integration-testing/`.
- **Not approved** — The issue states it is exploratory and not prioritized.

## Grilling

### Ambiguities

- **Target skill name** — `planning-integration-tests` does not exist; I assume it means `planning-oracle-to-postgres-migration-integration-testing`. Matters because the sibling `creating-oracle-to-postgres-migration-integration-tests` skill would also need to change if the approach varies by app type.
- **Where recommendation lives** — Issue says "record a recommendation" without naming a location. Matters because only the plan file path is writable here and the maintainer may want it in the issue or a doc.
- **"Unmanaged code" meaning** — Could mean Classic ASP/VBScript only, or also VB6, COM, PL/SQL-heavy apps. Changes the application-type list.
- **Agent scope mismatch** — The agent and skills are scoped to ".NET solutions" (plugin description). Classic ASP is outside that, so supporting it widens the agent's stated scope.
- **Oracle-to-Postgres fit** — Playwright tests UI behaviour, while the skill's "Key Constraints" demand "Database interactions only" and a single-project scope. UI-driven tests may conflict with these.

### Scope

- **IN** — Research and record a recommendation: application types, test approaches per type, reference-table vs separate-skills comparison.
- **IN** — Minimal edits only if the maintainer chooses an option (see Plan).
- **OUT** — Writing Playwright scripts or a new skill before a decision is made.
- **OUT** — Changes to `skills/creating-oracle-to-postgres-migration-integration-tests/` and `skills/scaffolding-oracle-to-postgres-migration-test-project/` in this issue; flagged as follow-ups.
- **OUT** — Fork-only tooling edits (`.github/fork-only/change-brainstorming.md` status updates).

### Constraints

- **Version bump** — Any change to the skills requires bumping `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` (currently `1.1.3`).
- **New skill registration** — A new skill folder must be added to the `skills` array in `plugin.json` and pass `npm run skill:validate`.
- **Skill format** — `SKILL.md` needs `name` matching the folder and a single-quoted `description` of 10–1024 characters.
- **Existing workflow** — The agent file references the planning skill by name in Phase 3; renaming or splitting must keep that reference valid.
- **Upstream promotion** — Fork-only files (this plan) must not be promoted upstream.

### Assumptions I am making

- **Skill identity** — The target is `planning-oracle-to-postgres-migration-integration-testing`.
- **Current state** — That skill's SKILL.md is a single file with no reference subfolder and no application-type distinction (read in full).
- **Playwright limits** — Playwright is only plausible for apps with a browser-reachable UI; it will not suit class libraries, services, or batch jobs.
- **Recommendation first** — The deliverable is a recommendation; I did not read the actual agent file beyond integration-testing mentions in lines 10–128, and did not read the other skills in full.
- **Default recommendation** — I expect a reference table inside the existing skill to suffice until a second app type is actually supported.

## Plan

- **Step 1: Inventory app types** — Produce a table (in the PR/issue discussion) of types: .NET data-access libraries (current), ASP.NET web apps, Classic ASP/VBScript, batch/console, stored-procedure-only.
- **Step 2: Compare options** — Evaluate (a) a `references/` table in the existing skill vs (b) separate skills per type, on trigger accuracy, maintenance, and plugin size.
- **Step 3: Record recommendation** — Capture the decision in the issue thread; leading option is (a).
- **Step 4 (only if Q1 says implement): edit `skills/planning-oracle-to-postgres-migration-integration-testing/SKILL.md`** — Add an *Application type* step between *Step 1: Identify data access artifacts* and *Step 2: Classify testing priorities*, pointing to a table.
- **Step 5 (only if Q1 says implement): create `skills/planning-oracle-to-postgres-migration-integration-testing/references/application-types.md`** — Table with columns: application type, discovery approach, test technique (e.g. direct DAO tests; Playwright scripted flows for Classic ASP), caveats.
- **Step 6 (only if Q1 says implement): update `SKILL.md` "Key Constraints"** — Qualify "Database interactions only" for UI-driven approaches.
- **Step 7 (only if Q1 says implement): edit `plugins/oracle-to-postgres-migration-expert/plugin.json`** — Bump `1.1.3` to `1.2.0` (minor: new capability); use patch `1.1.4` if only wording changes.

## Acceptance criteria

- [ ] Application types relevant to the agent are listed with suitable testing approaches.
- [ ] Reference-table vs separate-skills comparison is recorded.
- [ ] Recommendation explicitly states where Playwright does and does not fit.
- [ ] If implemented: skill validates and `plugin.json` version is bumped.
- [ ] No references to the non-existent `planning-integration-tests` name remain in new content.

## Open questions

- **Q1 — Research only or implement?** — options: (a) record recommendation only; (b) also implement the reference table; (c) also create a new skill. I would pick (a), since the issue is exploratory.
- **Q2 — Agent scope for non-.NET apps** — options: (a) keep ".NET only" and treat Classic ASP as a documented limitation; (b) widen the agent and plugin description to cover Classic ASP. I would pick (a).
- **Q3 — Where to record the recommendation** — options: (a) issue comment; (b) update AG-08 in `.github/fork-only/change-brainstorming.md`; (c) this plan file. I would pick (a).

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- Confirm `plugin.json` `skills` array lists any new skill folder and the version was bumped.
