---
issue: 95
title: '[AG-09] Assert expected entity values in successful GetById tests'
scope: agent
status: draft
---

## Issue summary

- **Core ask** — successful `GetById()` tests must assert returned entity fields against seeded/expected values, not only non-null.
- **Target skill** — issue says "creating-integration-tests"; the actual folder is `skills/creating-oracle-to-postgres-migration-integration-tests/` (differs from literal text).
- **Status** — issue calls itself "exploratory, not approved or prioritized".

## Grilling

### Ambiguities

- **Skill name mismatch** — "creating-integration-tests" does not exist; assumed to mean the folder above, which is in `plugin.json`'s `skills` array.
- **Already partly covered** — Step 4 already says "Assert specific expected values — never assert that a value is merely non-null or non-empty when a concrete value is available from seed data."
- **Real gap** — the rule is generic; nothing names the `GetById` happy path or says to assert every seeded field.
- **"Fields" breadth** — all fields vs. meaningful ones is unspecified; matters for brittleness (e.g. audit timestamps).

### Scope

- **IN** — a GetById-specific bullet in Step 4 and a matching check in Step 5 of the integration-tests SKILL.md.
- **IN** — `plugin.json` patch version bump.
- **OUT** — the agent file, other skills, and the other brainstorm items (AG-10, AG-11).
- **OUT** — `.github/fork-only/change-brainstorming.md` edits.

### Constraints

- **Upstream rule** — `plugin.json` `version` (currently `1.1.3`) must be bumped.
- **Portability** — assertions must stay Phase 6 portable (no Oracle-specific syntax), per Key Constraints.
- **Determinism** — expected values must come from seed data, not DB state outside the test (Step 5).
- **Conventions** — SKILL.md frontmatter must remain valid; run line-ending fix.

### Assumptions I am making

- **Folder mapping** — "creating-integration-tests" = `creating-oracle-to-postgres-migration-integration-tests`.
- **Wording-only change** — no new capability, so patch bump.
- **Placement** — Step 4 holds the rule; Step 5 gets a reinforcing check; no new section.
- **Generic naming** — `GetById` is used as an example of any single-record lookup by key.

## Plan

- **Edit Step 4 of the skill** — in `skills/creating-oracle-to-postgres-migration-integration-tests/SKILL.md`, after the bullet "Assert specific expected values — never assert…", add a bullet: for successful `GetById()` (or equivalent lookup-by-key) tests that return a record, assert the returned entity's key and seeded business fields equal the values defined in the seed data (via seed builder / `LookupConstants`), and do not stop at `Assert.NotNull(entity)` or non-null field checks.
- **Add exclusion note in same bullet** — fields not controlled by the seed (DB-generated timestamps, sequences) may be asserted by type/range instead, to keep determinism.
- **Edit Step 5** — extend "Re-examine every assertion against non-null values" to say any `GetById` happy-path test must assert concrete seeded values for returned fields.
- **Edit `plugins/oracle-to-postgres-migration-expert/plugin.json`** — bump `version` `1.1.3` → `1.1.4` (patch: wording-only guidance refinement).

## Acceptance criteria

- [ ] SKILL.md Step 4 explicitly requires value assertions for successful `GetById` tests.
- [ ] Guidance ties expected values to seed data.
- [ ] Step 5 review covers the GetById case.
- [ ] No other files changed besides `plugin.json` version.
- [ ] `plugin.json` version is `1.1.4`.
- [ ] Validation commands pass.

## Open questions

- **Q1 — skill target** — options: (a) `creating-oracle-to-postgres-migration-integration-tests` (only match); (b) different skill. I would pick (a).
- **Q2 — field breadth** — options: (a) assert all seeded fields; (b) key plus business-meaningful fields, excluding DB-generated ones. I would pick (b).
- **Q3 — version bump** — options: (a) patch `1.1.4`; (b) minor. I would pick (a).

## Verification

- `npm run skill:validate`
- `npm run plugin:validate`
- `npm run build`
- `bash eng/fix-line-endings.sh`
- `git diff --stat` — confirm only SKILL.md and `plugin.json` changed.
