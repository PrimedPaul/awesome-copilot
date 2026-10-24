---
issue: 96
title: '[AG-10] Strengthen codebase migration guidance'
scope: agent
status: draft
---

## Issue summary

- **Review call syntax** - check `skills/migrating-oracle-to-postgres-data-access-code/SKILL.md` Step 5 guidance on how procedures/functions are invoked.
- **Match procedure types to DDL** - the migrated code should call a routine the way the DDL declares it (`FUNCTION` vs `PROCEDURE`).
- **Establish EF/Npgsql compatibility** - define version requirements for the versions in use, without assuming major versions must always align.
- **Restatement gap** - the issue says "Codebase migration skill"; I read that as `migrating-oracle-to-postgres-data-access-code` (the "Migrating .NET Data Access Code" skill), which is an assumption.

## Grilling

### Ambiguities

- **Which skill** - "Codebase migration skill" is not a folder name; the stored-procedures skill (`migrating-oracle-to-postgres-stored-procedures`) is the DDL side and could also be meant.
- **"Appropriate call syntax"** - undefined; Step 5 currently says `CommandType.StoredProcedure` for functions and `CALL proc_name(...)` "in some versions of Npgsql", which is vague.
- **"Versions in use"** - which versions? Not stated; the skill has no way to know them except by reading the target `.csproj`.
- **Evidence standard** - "do not assume ... without evidence" does not say what counts as evidence (docs, release notes, a build/test).

### Scope

- **IN** - `skills/migrating-oracle-to-postgres-data-access-code/SKILL.md`: Step 1 (packages), Step 5 (invocation), "EF Core projects" section.
- **IN** - a rule to read the DDL (Phase 4 output) to decide function vs procedure per routine.
- **IN** - an instruction to discover versions from the `.csproj` and verify EF Core provider/Npgsql compatibility from authoritative sources.
- **OUT** - changes to the agent file, other skills, and test/review skills (guess; revisit if Q1 says otherwise).
- **OUT** - hardcoding a compatibility table, since the issue forbids assuming a rule without evidence.

### Constraints

- **Version bump** - `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` must be bumped from `1.1.3` for upstream promotion.
- **Existing rule** - Step 1 says "do not introduce newer package versions than what the solution already uses"; the new text must not contradict it.
- **Existing rule** - "Keep to existing .NET and C# versions" in Key Constraints still applies.
- **Conventions** - `CONTRIBUTING.md` conventions; skill `description` stays single-quoted and 10-1024 chars.
- **Fork tooling** - nothing under `.github/fork-only/` is promoted upstream.

### Assumptions I am making

- **Target skill** - the data-access-code skill is the one meant.
- **Do not guess facts** - I have not verified Npgsql/EF Core compatibility rules; the plan makes the skill instruct the agent to verify, rather than stating rules.
- **Routine kind source** - the DDL scripts from the stored-procedures phase are available to the code-migration phase.
- **Wording-level change** - no new bundled assets or scripts are needed.

## Plan

- **Edit Step 1** - `skills/migrating-oracle-to-postgres-data-access-code/SKILL.md`, "Step 1: Replace NuGet packages": add a bullet to record the target .NET version, Npgsql version and (if EF Core) `Npgsql.EntityFrameworkCore.PostgreSQL` version from the `.csproj`.
- **Add compatibility check** - same step: add a bullet saying to confirm the EF Core provider and Npgsql versions are compatible with each other and the target .NET version using official package docs/release notes, and to record the source and the finding in `MigrationChecklist.md`; state that matching major versions is not assumed to be required or sufficient.
- **Rewrite Command type bullet** - "Step 5: Migrate stored procedure invocation": replace the vague "in some versions of Npgsql" bullet with a rule: look up each routine's kind in the DDL; `FUNCTION` is invoked via `SELECT fn(...)` or `CommandType.StoredProcedure`; `PROCEDURE` is invoked via `CALL proc(...)` with `CommandType.Text`; verify the chosen form against the target Npgsql version.
- **Add DDL matching bullet** - Step 5: add a bullet requiring parameter modes (`IN`/`OUT`/`INOUT`) and return type to be checked against the DDL, and mismatches to be logged rather than silently adapted.
- **Extend EF Core section** - "EF Core projects": add a bullet for stored routine calls via `FromSql`/`ExecuteSql` using the same function/procedure rule, and a bullet referencing the Step 1 compatibility check.
- **Bump plugin** - `plugins/oracle-to-postgres-migration-expert/plugin.json`: `1.1.3` -> `1.1.4` (patch) because this is wording/guidance refinement with no new skill or capability.

## Acceptance criteria

- [ ] Step 5 states the call form for functions vs procedures and tells the agent to confirm each against the DDL.
- [ ] The skill tells the agent to read versions from the `.csproj` rather than assuming them.
- [ ] The skill requires verifying EF Core provider/Npgsql compatibility from evidence and does not assert that major versions must match.
- [ ] No contradiction with the existing Step 1 and Key Constraints rules.
- [ ] `plugin.json` version bumped.
- [ ] All validation commands below pass.

## Open questions

- **Q1 - target skill** - options: (a) only `migrating-oracle-to-postgres-data-access-code`; (b) also `migrating-oracle-to-postgres-stored-procedures`. I would pick (a).
- **Q2 - evidence standard** - options: (a) cite official package docs/release notes; (b) require a successful build plus integration test; (c) both. I would pick (a), with (b) recommended where tests exist.
- **Q3 - version bump level** - options: (a) patch `1.1.4`; (b) minor `1.2.0`. I would pick (a).
- **Q4 - EF Core raw SQL coverage** - options: (a) include `FromSql`/`ExecuteSql` guidance; (b) ADO.NET only. I would pick (a).

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- **Manual read** - confirm Step 1, Step 5 and "EF Core projects" in the edited SKILL.md do not contradict each other.
