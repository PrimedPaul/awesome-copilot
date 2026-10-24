# Change brainstorming

This document is fork-only and is not promoted upstream. It is kept outside
`plans/`, which is reserved for issue-linked plans governed by the fork's plan
approval lifecycle. Ideas here do not enter that lifecycle until they are taken
forward through the documented issue and planning process.

This is a working canvas for potential changes, not an approved roadmap or
implementation plan. **All ideas are subject to review, validation, and
prioritization.** Inclusion does not imply approval, feasibility, or a commitment
to implement.

The two workstreams below separate fork/repository automation from custom
agent, skill, and plugin behavior. Placement of the previously uncategorized
ideas is provisional. Cross-workstream dependencies are noted where relevant.

## Maintaining this document

- Add new ideas under the closest workstream, using a stable ID for references.
- Record evidence, open questions, and dependencies before proposing a priority.
- Keep status and priority explicit. All entries start as **Unreviewed**, with
  priority **Not set**, unless an entry states otherwise.
- Record review outcomes on the relevant entry. Approval must be an explicit
  decision; investigation or experimentation alone is not approval.

## 1. Fork and agentic workflow development

### WF-01: Repository-level evaluations

Previously uncategorized.

- Explore evaluations that determine whether repository goals are being met.
- Define the goals and measurable success signals before choosing evaluations.
- Open question: What evidence would demonstrate that the repository is
  delivering the intended outcomes?

### WF-02: Scheduled frontmatter verification

Previously uncategorized.

- Explore a scheduled workflow to verify resource frontmatter.
- Investigate model-field maintenance, including whether model changes could be
  automated.
- Open question: Should the workflow report issues, propose updates for review,
  or make changes? No automation behavior has been decided.

### WF-03: Agent and skill testing in the agentic workflow

- Explore adding agent/skill testing, such as evaluations, to the agentic
  workflow.
- Relates to WF-01, but focuses on individual resource behavior rather than
  repository-level outcomes.
- Validation needed: Identify representative scenarios and meaningful pass/fail
  criteria before choosing how to run them.

### WF-04: Progress visibility when using subagents

- Consider a hook that updates progress after every phase if subagents are
  allowed.
- Concern: The main session could lose context of delegated work.
- Depends on the investigation in AG-03; a hook is a possibility, not a decided
  implementation.

## 2. Custom agent, skill, and plugin development

### AG-01: Ongoing review of agent instructions

- Current focus: Review tooling.
- Review whether instructions are generic enough to constrain the agent while
  retaining their intent.
- Proposed test case: If a DDL artifact is missing, does the agent ask for it?
  DDL artifacts are essential for correct migration.

### AG-02: Verify logging before debugging test cases

- Consider instructing the custom agent to verify that logging statements are
  functioning properly before proceeding with further test-case debugging.
- Validation needed: Define how the agent should establish that logging works.

### AG-03: Evaluate allowing subagents

- Evaluate the effects of removing directives such as "act directly" or
  "execute tasks yourself" from the custom agent instructions.
- Desired outcome: Parallelism when creating integration tests.
- Review the full custom agent body for instructions that would conflict with
  delegation.
- Concern: The main session could lose context of delegated work.
- Related workflow idea: WF-04.
- Validation needed: Compare behavior with and without these directives,
  including task coordination and context retention.

### AG-04: Verify integration tests against their plan

- Explore a new skill that verifies implemented integration test cases against
  the integration testing plan.
- Reference to locate and review: The existing prompt in the `pcoc-uploader`
  solution.
- Consider invoking this verification through a hook; this is not yet decided.

### AG-05: Clarify lookup/code constants in integration scaffolding

Target: `scaffolding-integration-project`.

- Observed issue: The agent created a class to look up constants but appears to
  have misunderstood the intent.
- Intended behavior: Encode values from Lookup/Code tables into enums or
  structs containing constants for use in test classes, especially assertions
  and foreign-key-safe record seeding.
- Avoid treating runtime lookup of existing reference data as a substitute for
  this intent. Tests that assume such data is omnipresent can become flaky when
  those values are absent from an environment.
- Validation needed: Check the generated approach against environments with
  different reference-data availability.

### AG-06: Reduce seeded-data identifier collisions

Targets: `scaffolding-integration-project` and `creating-integration-tests`.

- For scaffolding, when no ID-generation heuristic is provided, consider
  seeding with top-range values that are unlikely to collide.
- For test creation, use unlikely record identifiers, such as near-maximum
  values or unlikely strings, to minimize collision risk.
- Validation needed: Confirm that proposed identifiers respect database types
  and constraints. Unlikely identifiers reduce risk; they do not guarantee that
  collisions cannot occur.

### AG-07: Cover database touchpoints in integration test planning

Target: `planning-integration-tests`.

- Proposed minimum: At least one test case per database touchpoint.
- Validation needed: Define what counts as a touchpoint and how coverage will
  be checked against the application.

### AG-08: Adapt integration testing to application type

Target: `planning-integration-tests`.

- For unmanaged code such as Classic ASP, explore scripted testing with
  Playwright to surface errors.
- Consider breaking down the skill by application type, potentially using a
  reference table to select the appropriate guidance.
- Open question: Is application-specific reference guidance sufficient, or are
  separate skills warranted?

### AG-09: Assert expected entity values in successful GetById tests

Target: `creating-integration-tests`.

- For `GetById()` tests returning a valid record, assert returned entity fields
  against seeded/expected values.
- Do not rely only on assertions that field values are non-null.

### AG-10: Strengthen codebase migration guidance

Target: Codebase migration skill.

- Use appropriate call syntax.
- Match procedure types against DDL.
- Investigate Entity Framework and Npgsql version compatibility, including
  whether their major versions must align for the versions in use.
- Validation needed: Verify compatibility requirements rather than assuming
  that matching major versions is always the correct rule.

### AG-11: Scan downstream dependencies in the master migration plan

Previously uncategorized.

- Explore scanning for downstream dependencies while preparing the master
  migration plan.
- A downstream dependency might need to be migrated beforehand; the user must
  investigate the actual ordering requirements.
- Validation needed: Make dependencies and unresolved ordering questions
  visible rather than assuming migration order from the scan alone.

### AG-12: Explore local database MCP integration

- Consider adding local MCP integration to the plugin for Oracle and
  PostgreSQL.
- Open questions: Which integrations are suitable, and what access and
  configuration would they require?

### AG-13: Research comparable agents and skills

- Explore marketplaces, including `skills.sh`, for comparable or useful agents
  and skills.
- Capture what is reusable or meaningfully different before proposing
  adoption or changes.

## Review and prioritization record

No approvals or priorities have been recorded yet. Add decisions here as ideas
are reviewed, and update the relevant entry when its status changes.

| Idea ID | Review date | Decision / status | Evidence or rationale | Priority | Dependencies / next validation |
| --- | --- | --- | --- | --- | --- |
