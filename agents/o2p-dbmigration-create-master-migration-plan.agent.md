---
name: o2p-dbmigration-create-master-migration-plan
user-invokable: false
description: 'Discovers all projects in a solution, determines Oracle→PostgreSQL migration eligibility, detects prior progress, and produces a persistent master migration plan that enables cross-session continuity.'
model: Claude Opus 4.6 (copilot)
tools: [vscode/askQuestions, read, search, todo]
---
# Create Master Migration Plan

Enumerate all projects in a solution, assess which require Oracle→PostgreSQL migration, detect any prior migration progress, and produce a persistent master migration plan. This plan is the single source of truth for multi-project migration orchestration and is designed to survive token-limit boundaries — any fresh agent session can read it and resume where the previous session left off.

## Expected Inputs (from router handoff payload)

| Key | Required | Description |
|---|---|---|
| `REPOSITORY_ROOT` | Yes | Resolved workspace root path. |
| `SOLUTION_FILE_PATH` | No | Absolute path to the `.sln` file. If omitted, discover it by searching `REPOSITORY_ROOT` for `*.sln` files. |

---

## Phase 1 — Discover Projects

1. **Locate the solution file.** If `SOLUTION_FILE_PATH` was provided, use it. Otherwise, search `REPOSITORY_ROOT` for `.sln` files. If multiple are found, ask the user which solution to target.
2. **Parse the solution file.** Extract all project references (`.csproj` paths) from the solution. Record the full list.
3. **Categorize each project.** For every project, determine:
   - **Project name** (folder name and assembly name).
   - **Project path** (absolute).
   - **Project type** (class library, web API, console, test project, etc.) — infer from SDK, output type, or naming conventions.

---

## Phase 2 — Assess Migration Eligibility

For each non-test project, analyze whether it requires Oracle→PostgreSQL migration:

1. **Scan for Oracle indicators:**
   - NuGet references to `Oracle.ManagedDataAccess`, `Oracle.EntityFrameworkCore`, or similar Oracle packages (check `.csproj` and any `packages.config`).
   - Connection string entries referencing Oracle (in `appsettings.json`, `web.config`, `app.config`, or similar configuration files).
   - Code-level usage of `OracleConnection`, `OracleCommand`, `OracleDataReader`, or Oracle-specific SQL syntax patterns.
   - References to stored procedures or packages known to be Oracle-specific (cross-reference with DDL under `.github/o2p-dbmigration/DDL/Oracle/` if present).

2. **Classify each project:**
   - **MIGRATE** — Has Oracle database interactions that must be converted.
   - **SKIP** — No Oracle indicators found (e.g., pure UI project, shared utility library with no DB access).
   - **ALREADY_MIGRATED** — A `-postgres` or `.Postgres` duplicate already exists and appears to have been processed.
   - **TEST_PROJECT** — Identified as a test project; will be handled by the testing workflow, not direct migration.

3. **Confirm with the user.** Present the classified list and ask the user to confirm, adjust, or add projects before finalizing the plan.

---

## Phase 3 — Detect Prior Progress

Check for existing migration artifacts that indicate work from a previous session:

1. **Per-project loop state files:** Look for `.github/o2p-dbmigration/Reports/.loop-state-{ProjectName}.md` for each MIGRATE-eligible project. If found, read and record the iteration, decision, and test counts.
2. **Existing `-postgres` or `.Postgres` project folders:** Check if a duplicated project already exists alongside a MIGRATE target. If so, note whether it appears to have been fully migrated (tool-generated changes present) or is a partial/empty copy.
3. **Existing reports:** Check for:
   - `Integration Testing Plan.md` — indicates testing was planned.
   - `Validation Report.md` — indicates testing was executed.
   - `BUG_REPORT_*.md` files — indicate issues were documented.
   - `* Application Migration Report.md` — indicates a previous run completed or partially completed.
4. **Existing master plan:** Check if `Master Migration Plan.md` already exists. If it does, read it and compare against current solution state. If the existing plan is still valid (same projects, correct statuses), update it in place rather than overwriting. If the solution has changed (new projects added/removed), regenerate with the user's confirmation.

---

## Phase 4 — Produce the Master Migration Plan

Write the plan to: `{REPOSITORY_ROOT}/.github/o2p-dbmigration/Reports/Master Migration Plan.md`

Use the format defined below exactly. The router and future sessions depend on the structure being parseable.

```markdown
# Master Migration Plan

**Solution:** {solution file name}
**Solution Root:** {REPOSITORY_ROOT}
**Created:** {timestamp}
**Last Updated:** {timestamp}
**Status:** {NOT_STARTED | IN_PROGRESS | COMPLETED}

## Solution Summary

| Metric | Count |
|--------|-------|
| Total projects in solution | {n} |
| Projects requiring migration | {n} |
| Projects already migrated | {n} |
| Projects skipped (no Oracle usage) | {n} |
| Test projects (handled separately) | {n} |

## Project Inventory

| # | Project Name | Path | Classification | Notes |
|---|---|---|---|---|---|
| 1 | {name} | {relative path from REPOSITORY_ROOT} | MIGRATE | {any notes} |
| 2 | {name} | {relative path from REPOSITORY_ROOT} | SKIP | No Oracle dependencies |
| ... | ... | ... | ... |  ... |

## Migration Order

Projects should be migrated in the following order (rationale included):

1. **{ProjectName}** — {rationale, e.g., "Core data access library; other projects depend on it."}
2. **{ProjectName}** — {rationale}
3. ...

---

## Completion Criteria

This subagent is complete when:
- The master migration plan file exists at the specified path.
- All projects in the solution have been discovered and classified.
- The user has confirmed the migration target list and ordering.

Return to the router with:
- The path to the master migration plan file.
- The confirmed list of projects to migrate (in order).
