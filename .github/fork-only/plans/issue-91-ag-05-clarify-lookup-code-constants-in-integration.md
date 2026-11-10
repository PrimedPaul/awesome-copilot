---
issue: 91
title: '[AG-05] Clarify lookup/code constants in integration scaffolding'
scope: agent
status: draft
---

## Issue summary

- **Core ask** — make `skills/scaffolding-oracle-to-postgres-migration-test-project/SKILL.md` say that Lookup/Code table values are encoded as enums or structs of constants, used in test assertions and FK-safe seeding.
- **Anti-pattern** — runtime lookup of reference data is not equivalent; assuming it exists makes tests flaky.
- **Restatement gap** — the issue names `scaffolding-integration-project`, which does not exist; I read it as the `scaffolding-oracle-to-postgres-migration-test-project` skill.
- **Status** — the issue says "exploratory, not approved or prioritized"; source is `.github/fork-only/change-brainstorming.md` AG-05.

## Grilling

### Ambiguities

- **Target skill name** — `scaffolding-integration-project` is a shorthand; the real folder is `scaffolding-oracle-to-postgres-migration-test-project`.
- **Where constants come from** — the issue does not say whether the agent derives values by querying the Oracle lookup tables at scaffold time or the user supplies them.
- **Enum vs struct** — enums suit integer IDs; string codes need `const string` in a static class or struct. The issue does not choose.
- **Missing reference data** — "foreign-key-safe seeding" is unclear when the lookup row is absent in an environment: seed it in-transaction, or fail fast?
- **"Test the generated approach"** — this repo has no way to run generated C#; the check can only be a documented manual procedure.

### Scope

- **IN** — Step 4 wording in the scaffolding SKILL.md, plus a lookup-constants bullet/Key Constraint.
- **IN** — Aligning `skills/creating-oracle-to-postgres-migration-integration-tests/SKILL.md` Step 3 wording so it does not contradict the scaffolding skill.
- **IN** — Plugin patch version bump.
- **OUT** — AG-06 (identifier collisions), which is a separate brainstorm item.
- **OUT** — Edits to the agent file, unless the line-60 summary of the scaffolding skill needs a mention (guess: not needed).
- **OUT** — Any fork-only tooling changes.

### Constraints

- **Version bump** — `plugins/oracle-to-postgres-migration-expert/plugin.json` is at `1.1.3`; it must be bumped for upstream promotion.
- **Existing contradiction** — creating-tests Step 3 currently says "Assume existing business rows and lookup rows are already present" while also requiring a `LookupConstants` class; this is the likely source of the observed confusion.
- **Skill rules** — front-matter `description` stays single-quoted, 10–1024 chars; run `npm run skill:validate`.
- **Phase boundary** — scaffolding is Oracle-only, Phase 3; constants must not introduce PostgreSQL-specific content.
- **Style** — keep to existing .NET/C# versions; no newer language features.

### Assumptions I am making

- **Skill mapping** — the issue targets `scaffolding-oracle-to-postgres-migration-test-project`.
- **Scaffolding owns the shape** — scaffolding creates the empty constants file (an empty-but-compilable `LookupConstants` placeholder with enum/struct convention); test creation populates it.
- **Output remains empty** — the "no test cases" constraint is preserved; the constants file is infrastructure, not a test.
- **Values are static** — constants are captured from Oracle at authoring time, and are not read at test runtime.
- **Missing rows** — tests seed any required lookup row inside the rolled-back transaction rather than assuming presence.
- **Verification is manual** — no automated harness exists for generated C#.
- **Patch bump** — wording clarification only.

## Plan

- **`skills/scaffolding-oracle-to-postgres-migration-test-project/SKILL.md` — Step 4** — add a sub-bullet group *Lookup/Code constants*: encode Lookup/Code table values as enums (numeric IDs) or static structs/classes of `const` values (string codes) in a single test-project file, e.g. `LookupConstants`, following the same location convention as the seed files.
- **Same file, Step 4** — state that the constants are used in assertions and when seeding rows that reference lookup tables (FK-safe), and must not be resolved by runtime queries.
- **Same file, Step 4** — state that when a required lookup row may be absent in an environment, the seed manager inserts it inside the transaction scope (never committed, no `TRUNCATE`), instead of assuming it exists.
- **Same file, Workflow Step 5** — extend the compile check to cover the constants file; keep the "no test cases" constraint.
- **Same file, Key Constraints** — add a bullet *No runtime lookup substitution*.
- **`skills/creating-oracle-to-postgres-migration-integration-tests/SKILL.md` — Step 3 (lines ~38–42)** — reword "Assume existing business rows and lookup rows are already present" to: reuse existing business rows; reference lookup values via the scaffolded constants, and seed missing lookup rows in-transaction. Keep the `LookupConstants` bullet, referencing the scaffolded file.
- **`plugins/oracle-to-postgres-migration-expert/plugin.json`** — bump `1.1.3` → `1.1.4`, patch: clarifying wording in existing skills, no new capability.
- **Manual validation note** — in the PR description (not a repo file), record a walkthrough against a lookup table with rows present vs. absent.

## Acceptance criteria

- [ ] Scaffolding SKILL.md states lookup/code values are encoded as enums or structs of constants.
- [ ] It states these are used for assertions and FK-safe seeding.
- [ ] It states runtime lookup is not a substitute and explains the flakiness risk.
- [ ] It states how absent reference data is handled without committing or truncating.
- [ ] The creating-tests skill no longer contradicts the scaffolding skill.
- [ ] `plugin.json` version is bumped to `1.1.4`.
- [ ] All verification commands pass.

## Open questions

- **Q1 — missing lookup rows** — options: (a) seed the row in-transaction when absent; (b) fail fast with a clear error; (c) assume present. I would pick (a).
- **Q2 — constants shape** — options: (a) enums for numeric IDs and `const` structs for string codes; (b) static classes of `const` only; (c) leave to the agent. I would pick (a).
- **Q3 — who populates constants** — options: (a) scaffolding creates a placeholder, test creation fills it; (b) scaffolding populates from the Oracle schema up front. I would pick (a).
- **Q4 — alignment scope** — options: (a) also edit the creating-tests skill; (b) scaffolding skill only. I would pick (a).

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- **Manual** — dry-run the updated skills against a sample .NET/Oracle project with lookup rows present and absent; confirm no runtime lookups are generated.
