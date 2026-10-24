---
issue: 92
title: '[AG-06] Reduce seeded-data identifier collisions'
scope: agent
status: draft
---

## Issue summary

- **Add ID guidance** — when no ID heuristic is provided, scaffolding should consider top-range identifiers for seed data.
- **Unlikely test IDs** — test creation should use unlikely identifiers (near-maximum values, unlikely strings) to reduce collision risk.
- **Validate, don't guarantee** — identifiers must be checked against DB types, ranges, and constraints; wording must not claim collisions are impossible.
- **Name mismatch** — the issue says `scaffolding-integration-project` and `creating-integration-tests`; the real folders are `skills/scaffolding-oracle-to-postgres-migration-test-project/` and `skills/creating-oracle-to-postgres-migration-integration-tests/`.

## Grilling

### Ambiguities

- **"ID heuristic" undefined** — nothing in either SKILL.md defines one; it could be a user-supplied rule or a repo convention. Matters because the fallback only applies when it is absent.
- **"Top-range" meaning** — max of the column type, or a reserved band below the max? Oracle `NUMBER(p)` max is `10^p - 1`, and sequences may eventually reach it.
- **Unlikely strings** — length limits, charset, and unique/check constraints are unspecified.
- **"Assess both skills"** — unclear if this means only a written assessment or edits; the "Done when" implies edits plus caveated wording.

### Scope

- **IN** — `## Workflow` Step 4 (seed data manager) of the scaffolding SKILL.md.
- **IN** — Step 3 (Create seed data) of the creating-tests SKILL.md.
- **IN** — validation guidance: column type/precision, range, PK/unique/check/FK constraints, sequence/identity interplay.
- **IN** — caveat wording that this reduces, not eliminates, collision risk.
- **OUT** — the agent file (it only references the skill at line 60) and the other six skills.
- **OUT** — new scripts or tooling to inspect schemas.

### Constraints

- **Plugin version bump** — `plugins/oracle-to-postgres-migration-expert/plugin.json` is at `1.1.3`; skills affect behaviour so bump.
- **Existing rules preserved** — no `TRUNCATE TABLE`, no committed seed data, preserve existing rows, Phase 3 / Oracle-only.
- **Portability** — seed IDs must survive Phase 6 migration to PostgreSQL (`integer` vs `bigint`, `NUMBER` mapping), so values must fit both types.
- **Repo conventions** — SKILL.md frontmatter unchanged apart from need; LF line endings; `CONTRIBUTING.md` conventions.

### Assumptions I am making

- **Folder mapping** — the issue's skill names map to the two folders named above.
- **Text-only change** — the skills are pure markdown, so only wording changes.
- **Source brainstorm** — `.github/fork-only/change-brainstorming.md` AG-06 is the intended spec.
- **Minor bump** — new guidance is a small capability addition, not a wording fix.
- **Sequence collisions** — the real risk is overlap with sequence/identity-generated values in shared databases.

## Plan

- **`skills/scaffolding-oracle-to-postgres-migration-test-project/SKILL.md`** — in Step 4 "Implement seed data manager", add bullets: if no ID-generation heuristic is supplied, default to a reserved top-range band (e.g. near the column's maximum, away from sequence-generated values); inspect column type/precision and constraints first; centralise ID allocation in the seed manager.
- **Same file, `## Key Constraints`** — add a bullet stating that unlikely IDs reduce collision risk but do not guarantee it.
- **`skills/creating-oracle-to-postgres-migration-integration-tests/SKILL.md`** — in Step 3 "Create seed data", replace "collision-safe" bullet detail: use unlikely identifiers (near-maximum numerics, unlikely strings) obtained from the seed manager / `LookupConstants`; validate each against type, range, length, and PK/unique/check/FK constraints; keep values valid for PostgreSQL types.
- **Same file, Step 5 "Review determinism"** — add a check that seed IDs are unique across tests and still within constraints.
- **`plugins/oracle-to-postgres-migration-expert/plugin.json`** — bump `version` `1.1.3` → `1.2.0` (minor: new guidance/capability; not a pure wording fix, not breaking).

## Acceptance criteria

- [ ] Scaffolding skill has a fallback to top-range IDs when no heuristic is provided.
- [ ] Test-creation skill instructs unlikely identifiers (near-max values / unlikely strings).
- [ ] Both skills require validating IDs against types, ranges, and constraints.
- [ ] Wording says risk is reduced, never guaranteed.
- [ ] Existing constraints (no `TRUNCATE`, no commits, preserve data) intact.
- [ ] `plugin.json` version bumped.
- [ ] Verification commands pass.

## Open questions

- **Q1 — top-range definition** — options: (a) column maximum, (b) reserved band just below maximum, (c) leave to the model. I would pick (b), since the exact maximum may be consumed by edge-case tests.
- **Q2 — string identifiers** — options: (a) prefix such as `ZZ_TEST_`, (b) random suffix, (c) both. I would pick (a) with length-checked truncation.
- **Q3 — version bump** — options: patch, minor. I would pick minor (`1.2.0`).
- **Q4 — assess-only vs edit** — options: edit both skills, or only write an assessment. I would pick edit both.

## Verification

- `npm run skill:validate`
- `npm run plugin:validate`
- `npm run build`
- `bash eng/fix-line-endings.sh`
- `git diff --stat` — confirm only the two SKILL.md files and `plugin.json` changed.
