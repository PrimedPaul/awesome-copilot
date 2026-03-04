# Closed-Loop Test Validation Workflow

Read this reference when the user goal involves integration testing. It defines the sequencing, decision logic, and loop control for the test validation cycle.

## Per-Project Scoping

The closed-loop **targets one project at a time**. When a solution contains multiple projects, the router runs a complete closed-loop cycle for each project sequentially — finishing all iterations (including retries) for project A before starting the cycle for project B.

Every testing subagent in the flow receives a `TARGET_PROJECT` parameter (absolute path to the single project under test) in its handoff payload. This ensures:

- **o2p-dbmigration-plan-integration-testing** scopes the plan to artifacts from the target project only.
- **o2p-dbmigration-scaffold-test-project** creates the test project for the target project only.
- **o2p-dbmigration-create-integration-tests** generates tests for the target project's data access layer only.
- **o2p-dbmigration-run-integration-tests** discovers and executes tests for the target project's test project only.
- **o2p-dbmigration-validate-test-results** analyzes results for the target project only.
- **o2p-dbmigration-create-bug-reports** scopes bug reports to the target project only.

The loop state file is also per-project (see State Serialization below).

## Flow

```
plan → scaffold → create → run → validate
                                    ↑     │
                                    │     ▼
                                    │  ┌─────────────────┐
                                    │  │  Decision?      │
                                    │  └────────┬────────┘
                                    │    EXIT   │  LOOP
                                    │     ↓     │    ↓
                                    │   report  │  report bugs
                                    │           │    │
                                    └───────────┴────┘
                                      (fix issues, re-run)
```

**Step mapping:**

- `plan` = `o2p-dbmigration-plan-integration-testing`
- `scaffold` = `o2p-dbmigration-scaffold-test-project`
- `create` = `o2p-dbmigration-create-integration-tests`
- `run` = `o2p-dbmigration-run-integration-tests`
- `validate` = `o2p-dbmigration-validate-test-results`
- `report bugs` = `o2p-dbmigration-create-bug-reports`
- `report` = `generateApplicationMigrationReport`

## Validation Decision Logic

- **EXIT: SUCCESS** (100% pass + skill checklist complete) → Invoke `generateApplicationMigrationReport`, summarize success, end workflow.
- **EXIT: CONDITIONAL** (>90% pass, minor gaps) → Document known issues, invoke `generateApplicationMigrationReport`, note limitations.
- **LOOP: RETRY** (<90% pass OR critical checklist failures) → Invoke `o2p-dbmigration-create-bug-reports` for failures → prompt user/agent to fix → re-invoke `o2p-dbmigration-run-integration-tests` → `o2p-dbmigration-validate-test-results`.
- **BLOCKED** (infrastructure failures, no DB connection) → Halt workflow, report blocking issues, request user intervention.

## Loop Control

- Track iteration count; if >3 iterations without progress, escalate to user with summary of persistent failures.
- After each loop iteration, compare failed test count to previous iteration; if unchanged, escalate.
- Maintain loop state: `iteration: {n}, previous_failures: {count}, current_failures: {count}, blocking_issues: {list}`.
- After each `o2p-dbmigration-validate-test-results` return, write/overwrite the per-project state file with current data.
- After writing/updating the state file, construct the `LOOP_CONTEXT` payload (see LOOP_CONTEXT Payload section below) from the state file for use in subsequent handoffs.

## State Serialization

After each loop iteration (after `o2p-dbmigration-validate-test-results` returns), write the current loop state to a **per-project** state file:
`{REPOSITORY_ROOT}/.github/o2p-dbmigration/Reports/.loop-state-{ProjectName}.md`

where `{ProjectName}` is derived from the `TARGET_PROJECT` folder name. This avoids conflicts when multiple projects are tested in sequence and allows each project's loop to be resumed independently.

This file allows the loop to resume from last-known state if the conversation context is lost or trimmed.

State file format:

```markdown
# Loop State

**Target Project:** {TARGET_PROJECT}
**Updated:** {timestamp}
**Iteration:** {n}
**Decision:** {EXIT: SUCCESS | EXIT: CONDITIONAL | LOOP: RETRY | BLOCKED}

## Test Counts

| Metric | Previous | Current |
|--------|----------|---------|
| Total  | {n}      | {n}     |
| Passed | {n}      | {n}     |
| Failed | {n}      | {n}     |

## Failed Tests

| Test Name | Error Category | Matched Reference |
|-----------|----------------|-------------------|
| {FullyQualifiedTestName} | {category} | {reference filename} |

## Bug Reports Created

- {BUG_REPORT_*.md filename}: {status}

## Blocking Issues

- {issue description, or "None"}
```

Router behavior:

- **Before first handoff in a testing goal:** check if `.loop-state-{ProjectName}.md` exists for the current `TARGET_PROJECT`. If it does, read it and resume from the recorded iteration rather than starting from scratch.
- **On EXIT (SUCCESS or CONDITIONAL):** keep the state file for audit trail; do not delete it.

## Reference Narrowing on Loop Iterations

On the **first iteration**, `o2p-dbmigration-validate-test-results` should cross-reference all skill references to establish baseline failure categories.

On **iteration 2+**, the router should narrow the context passed to `o2p-dbmigration-validate-test-results` and `o2p-dbmigration-create-bug-reports` by including only the references that matched failure categories in the previous iteration. Use the `relevant_references` field in the handoff payload.

Reference-to-category mapping:

| Error Category | Reference File |
|----------------|----------------|
| NULL/empty string mismatch | `empty-strings-handling.md` |
| Missing NOT FOUND exception | `no-data-found-exceptions.md` |
| FROM clause syntax error | `oracle-parentheses-from-clause.md` |
| Sort order difference | `oracle-to-postgres-sorting.md` |
| TO_CHAR numeric format error | `oracle-to-postgres-to-char-numeric.md` |
| Type comparison mismatch | `oracle-to-postgres-type-coercion.md` |
| Cursor/result set issue | `postgres-refcursor-handling.md` |
| Concurrent transaction error | `postgres-concurrent-transactions.md` |
| Timestamp/timezone mismatch | `oracle-to-postgres-timestamp-timezone.md` |

If a **new failure category** appears in a later iteration that was not present before, add its reference back into the narrowed list for subsequent passes.

## LOOP_CONTEXT Payload

On **iteration 2+**, the router must include a `LOOP_CONTEXT` block in the handoff payload for every subagent invoked during the retry cycle (`o2p-dbmigration-create-integration-tests`, `o2p-dbmigration-run-integration-tests`, `o2p-dbmigration-validate-test-results`, `o2p-dbmigration-create-bug-reports`). This block is the bridge between the persisted loop state file and the subagent's working context.

### Structure

```
LOOP_CONTEXT:
  iteration: <n>                      # Current loop iteration (2, 3, …)
  state_file: <path>                  # Absolute path to .loop-state-{ProjectName}.md
  decision: <previous decision>       # EXIT: SUCCESS | EXIT: CONDITIONAL | LOOP: RETRY | BLOCKED
  previous_failures: <count>          # Failed test count from the prior iteration
  current_failures: <count>           # Failed test count from the most recent run
  failed_tests:                       # Tests still failing (from state file Failed Tests table)
    - name: <FullyQualifiedTestName>
      error_category: <category>      # Matched error category
      matched_reference: <file.md>    # Reference file that matched the failure
  relevant_references:                # Narrowed list of reference filenames for this iteration
    - <reference-filename.md>
  bug_reports_created:                # Bug reports produced in prior iterations
    - <BUG_REPORT_*.md filename>
  blocking_issues:                    # Infrastructure or environment blockers
    - <issue description, or empty>
```

### Rules

- On **iteration 1** (the first run through `plan → scaffold → create → run → validate`), `LOOP_CONTEXT` is **not** included in the handoff payload.
- On **iteration 2+**, every subagent in the retry path receives `LOOP_CONTEXT` populated from the latest `.loop-state-{ProjectName}.md` file.
- The `relevant_references` list is narrowed from the full set based on the error categories observed in the prior iteration (see Reference Narrowing above).
- Each subagent should document in its own instructions how it uses `LOOP_CONTEXT` fields — see the individual agent files for details.
