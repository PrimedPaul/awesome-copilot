---
name: o2p-dbmigration-validate-test-results
user-invokable: false
description: 'Analyze test results, apply o2p-dbmigration skill checklist, and determine pass/fail/retry status for the migration validation workflow.'
model: Claude Sonnet 4.6 (copilot)
tools: [vscode/askQuestions, read, edit, search, todo]
---
# Validate Integration Test Results

Analyze test execution results, cross-reference with the `o2p-dbmigration` skill verification checklist, and produce a validation report that determines whether the workflow should exit successfully or loop back for fixes. This prompt targets a **single project** identified by `TARGET_PROJECT`.

## Expected Inputs (from router handoff payload)

| Key | Required | Description |
|---|---|---|
| `REPOSITORY_ROOT` | Yes | Resolved workspace root path. |
| `TARGET_PROJECT` | Yes | Absolute path to the single application project whose test results are being validated. |
| `LOOP_CONTEXT` | No | Provided on iteration 2+. Contains `iteration`, `state_file`, `decision`, `previous_failures`, `current_failures`, `failed_tests` (with `name`, `error_category`, `matched_reference`), `relevant_references`, `bug_reports_created`, and `blocking_issues`. See `closed-loop-testing-workflow.md` for the full structure. |

CONTEXT:
- Receives test results from `o2p-dbmigration-run-integration-tests` (TRX file and/or summary) **for `TARGET_PROJECT` only**.
- Must validate both **test pass rate** and **skill checklist compliance**.
- Oracle behavior is the golden source; Postgres must match.

INSTRUCTIONS:

## 1. Parse Test Results
Read the TRX file or summary from:
- `{REPOSITORY_ROOT}/.github/o2p-dbmigration/Reports/TestResults/`

Extract:
- Total tests, passed, failed, skipped counts
- List of failed test names with error messages
- Any timeout or infrastructure errors (connection failures, timeouts)

## 2. Cross-Reference with o2p-dbmigration Skill Checklist
For each failed test, analyze the error against the known Oracle→Postgres migration patterns documented in:
- `{REPOSITORY_ROOT}/.github/skills/o2p-dbmigration/references/`

PATTERN MATCHING TABLE:
| Error Pattern | Likely Cause | Reference File |
|---------------|--------------|----------------|
| `NULL` vs empty string mismatch | Oracle treats '' as NULL | `empty-strings-handling.md` |
| "no rows returned" or silent null | Missing NOT FOUND exception | `no-data-found-exceptions.md` |
| Sort order differs between DBs | Collation mismatch | `oracle-to-postgres-sorting.md` |
| TO_CHAR numeric format error | `TO_CHAR(numeric)` without format string | `oracle-to-postgres-to-char-numeric.md` |
| Type mismatch / comparison error | Implicit coercion difference | `oracle-to-postgres-type-coercion.md` |
| Cursor/result set empty or wrong | Refcursor handling difference | `postgres-refcursor-handling.md` |
| "operation already in progress" or concurrent command error | Single active command per connection | `postgres-concurrent-transactions.md` |
| `DateTime.Kind=Unspecified` or off-by-N-hours timestamp mismatch | CURRENT_TIMESTAMP/NOW() UTC vs session-timezone difference; Npgsql legacy timestamp mode | `oracle-to-postgres-timestamp-timezone.md` |

For each failed test, tag the probable root cause category.

## 2a. Loop Iteration Behavior

- On **iteration 1** (no `LOOP_CONTEXT` provided): cross-reference all skill references from `{REPOSITORY_ROOT}/.github/skills/o2p-dbmigration/references/` to establish baseline failure categories.
- On **iteration 2+** (when `LOOP_CONTEXT` is provided): narrow the cross-reference scope to only the `relevant_references` listed in `LOOP_CONTEXT`, unless a **new failure category** appears that was not present in prior iterations — in that case, add its reference back into scope.
- Compare `current_failures` against `previous_failures` from `LOOP_CONTEXT` to determine whether progress is being made. If the count is unchanged or increasing after 3 iterations, recommend escalation.
- Cross-reference `bug_reports_created` from `LOOP_CONTEXT` against the current failed tests to determine which prior bug reports are still unresolved.

## 2b. Write/Update Loop State File

After completing validation, write or overwrite the per-project loop state file at:
`{REPOSITORY_ROOT}/.github/o2p-dbmigration/Reports/.loop-state-{ProjectName}.md`

Use the format defined in `closed-loop-testing-workflow.md` (State Serialization section). This file enables the router to construct the `LOOP_CONTEXT` payload for subsequent iterations and allows the loop to resume if the conversation context is lost.

## 3. Apply Verification Checklist
Review the `o2p-dbmigration` skill checklist (from `SKILL.md`):

- [ ] Migration artifact review documented with affected components.
- [ ] Each `references/*.md` insight acknowledged and steps taken (including timestamp/timezone handling).
- [ ] Integration tests cover the behaviors mentioned in the insights.
- [ ] Test suite runs cleanly with deterministic results.
- [ ] Notes recorded describing how each insight influenced the fix.

Score each item as: ✅ Complete | ⚠️ Partial | ❌ Incomplete

## 4. Determine Workflow Decision
Based on test results and checklist:

| Condition | Decision | Next Action |
|-----------|----------|-------------|
| 100% tests pass + all checklist ✅ | **EXIT: SUCCESS** | Generate final migration report |
| >90% pass + minor checklist gaps | **EXIT: CONDITIONAL** | Document known issues, generate report |
| <90% pass OR critical checklist ❌ | **LOOP: RETRY** | Create bug reports → fix → re-run tests |
| Infrastructure failures (no DB connection) | **BLOCKED** | Halt, request environment fix |

## 5. Output Validation Report
Write the validation report to:
`{REPOSITORY_ROOT}/.github/o2p-dbmigration/Reports/{TARGET_PROJECT} Validation Report.md`

REPORT TEMPLATE:
```markdown
# Integration Test Validation Report

**Target Project:** {TARGET_PROJECT}
**Generated:** {timestamp}
**Test Run:** {TRX filename or run identifier}

## Test Results Summary

| Metric | Oracle Baseline | Postgres Target |
|--------|-----------------|-----------------|
| Total | {n} | {n} |
| Passed | {n} | {n} |
| Failed | {n} | {n} |
| Skipped | {n} | {n} |
| **Pass Rate** | {%} | {%} |

## Failed Test Analysis

| Test Name | Error Category | Reference | Recommended Fix |
|-----------|----------------|-----------|-----------------|
| {test} | {category} | {file.md} | {brief action} |

## Skill Checklist Status

| Checklist Item | Status | Notes |
|----------------|--------|-------|
| Migration artifact review | {✅/⚠️/❌} | {notes} |
| Reference insights applied | {✅/⚠️/❌} | {notes} |
| Test coverage adequate | {✅/⚠️/❌} | {notes} |
| Test suite deterministic | {✅/⚠️/❌} | {notes} |
| Documentation complete | {✅/⚠️/❌} | {notes} |

## Workflow Decision

**Status:** {EXIT: SUCCESS | EXIT: CONDITIONAL | LOOP: RETRY | BLOCKED}
**Reason:** {brief explanation}

### Next Steps
{Ordered list of actions based on decision}
```

## 6. Handoff Instructions
Return the following to the router:
- **Decision:** EXIT | LOOP | BLOCKED
- **Failed tests count:** {n}
- **Bug reports needed:** {yes/no}
- **Blocking issues:** {list if BLOCKED}

The router will:
- EXIT → Invoke `generateApplicationMigrationReport`
- LOOP → Invoke `createBugReports` for failures, then prompt for fixes, then re-invoke `runIntegrationTests`
- BLOCKED → Halt and request user intervention
