---
issue: 129
title: 'Review Oracle-to-PostgreSQL plugin instructions for specificity'
scope: agent
status: draft
---

## Issue summary

- **Review target** — audit `agents/oracle-to-postgres-migration-expert.agent.md` and the eight `skills/*oracle-to-postgres*/SKILL.md` files listed in `plugins/oracle-to-postgres-migration-expert/plugin.json`.
- **Three defect classes** — find instructions that are too vague, too prescriptive, or inconsistent/overlapping/conflicting.
- **Keep real invariants** — specificity is fine where migration correctness or user control depends on it (e.g. "never apply database changes directly", "Oracle is the source of truth").
- **Deliverable is documentation** — "Document where instructions are too vague… with concrete wording proposals". My reading: the issue asks for a findings report, not for the edits themselves.
- **Excluded** — the missing-DDL behavioral evaluation is tracked separately; this is split from #87 (AG-01).

## Grilling

### Ambiguities

- **Where the report lives** — the issue says "document" but names no location; this decides whether the PR touches upstream-promotable files at all.
- **Edits or proposals only** — "wording proposals" could mean proposals in a report, or applying them; the latter requires a plugin `version` bump.
- **Reference files in scope?** — the 14 files in `skills/reviewing-oracle-to-postgres-migration/references/` are "bundled skills" content; I did not read them.
- **Bug-report template** — `skills/creating-oracle-to-postgres-migration-bug-report/references/BUG-REPORT-TEMPLATE.md` is also unread.

### Scope

- **IN** — `SKILL.md` for all eight skills in `plugin.json`, plus the agent file; a findings report with before/after wording per finding.
- **IN** — classifying each finding as plugin-wide invariant vs phase-specific constraint, per the issue's Context section.
- **OUT** — the missing-DDL behavioral evaluation.
- **OUT** — applying the wording changes (unless Q1 says otherwise).
- **OUT** — `references/*.md` behavioral content (technical accuracy), unless Q2 says otherwise.
- **OUT** — the stale `plugin.json` description ("invokes extension tools"), which overlaps the existing `issue-121-*` plan.

### Constraints

- **Upstream promotion** — if any agent/skill/plugin file is edited, bump `version` in `plugins/oracle-to-postgres-migration-expert/plugin.json` (currently `1.1.4`).
- **Fork-only report** — a report under `.github/fork-only/` is never promoted upstream.
- **Intent preservation** — wording proposals must not weaken: "never apply DDL directly", Oracle as source of truth, user confirmation at phase gates, Phase 6 original Oracle test project unmodified.
- **Conventions** — frontmatter of skills must stay valid (`name` matches folder, `description` 10–1024 chars).

### Assumptions I am making

- **Report not edits** — deliverable is a findings report; no agent/skill file is changed in the first pass.
- **Report location** — a fork-only file (see Plan) so nothing leaks upstream.
- **Evidence base** — findings below come from reading the agent file and the `SKILL.md` files; the `scaffolding-*` SKILL.md was only read through its header and first lines.
- **Terms** — "too prescriptive" means dictating paths, names, or steps where workspace context would suffice and correctness does not depend on it.

## Plan

### Change 1 — create the findings report

- **File** — `.github/fork-only/reviews/issue-129-instruction-specificity.md` (new; the one file written in the implementation pass).
- **Structure** — `## Method`, `## Plugin-wide invariants (keep explicit)`, `## Phase-specific constraints (keep explicit)`, `## Findings` as a table: ID, file + section, class (vague/prescriptive/inconsistent), problem, proposed wording, intent preserved.
- **Invariants to list** — agent *Guidelines*: "Never apply database changes directly on behalf of the user"; "Oracle is the source of truth"; "Confirm at gates".
- **Phase-specific to list** — *Phase 5*: edits only in `.Postgres` copy; *Phase 6*: original Oracle test project unmodified; schema immutable in Phases 5–6 with stored-procedure exception; Phase 3-only skills.

### Seed findings to verify and write up

- **F1 Inconsistent: integration-testing-plan path** — agent Phase 3 says `Reports/{ProjectName}/Integration Testing Plan.md`; `planning-oracle-to-postgres-migration-integration-testing` *Output* says `.github/oracle-to-postgres-migration/Reports/{TARGET_PROJECT} Integration Testing Plan.md`. Proposal: align on the agent's per-project folder form.
- **F2 Inconsistent: DDL path layout** — agent Phase 2 scans `DDL/Oracle/{ProjectName}/`; `migrating-oracle-to-postgres-stored-procedures` Step 1 reads `DDL/Oracle/Procedures and Functions/` (no `{ProjectName}`) while its Postgres paths include `{ProjectName}`. Proposal: one layout stated once, others refer to it.
- **F3 Inconsistent: recorded DDL location ignored** — agent Phase 1 says to record the DDL location in `Reports/MasterMigrationPlan.md` and ask if not at the default; skills hardcode `.github/oracle-to-postgres-migration/DDL/...`. Proposal: skills say "the DDL location recorded in `MasterMigrationPlan.md` (default `.github/oracle-to-postgres-migration/DDL/`)".
- **F4 Conflict: signature changes vs. Phase 6 fixes** — stored-procedures skill says "Do not alter method signatures" and "Leave exception handling and rollback logic unchanged"; agent Phase 6 allows in-place procedure corrections. Proposal: scope the skill's rules to Phase 4 translation and state what Phase 6 may change.
- **F5 Dangling reference** — agent Guidelines say stored procedures "may be corrected in Phase 6 per the fix loop instructions"; Phase 6 has no section by that name. Proposal: point to the Phase 6 failure-handling bullets.
- **F6 Conflict: fix vs. document** — `migrating-oracle-to-postgres-data-access-code` *Key Constraints*: behavioral differences "must be documented as bug reports, not silently altered"; agent Phase 5 expects them to be migrated via the checklist. Proposal: clarify that differences are fixed per checklist and only unresolved or deliberate deviations become bug reports.
- **F7 Vague: "distinct local port"** — agent Phase 6 says to use "the distinct local port" but no earlier text defines one. Proposal: "a local port that does not collide with the Oracle instance or other services".
- **F8 Vague: "Minimize changes" / "prioritize well-tested libraries"** — agent Guidelines; no criterion. Proposal: tie to "change only what PostgreSQL compatibility requires" (already used in the data-access skill) and drop or define the library clause.
- **F9 Tension: educate/suggest vs. act directly** — agent *Your Approach* bullets "Suggest, don't assume", "Confirm at gates" and "Act directly" overlap. Proposal: merge into one rule — act within an approved step, never advance phases without confirmation.
- **F10 Overlap: "one step at a time" / "Confirm at gates"** — near-duplicate of "Do not chain tasks automatically". Proposal: consolidate.
- **F11 Too prescriptive: incidental names** — `LookupConstants` class (integration-tests skill Step 3), `{ProjectName}` normalization, `BUG_REPORT_<DescriptiveSlug>.md` PascalCase naming, `.Postgres` suffix. Proposal: keep `.Postgres` suffix and report filenames that other steps resolve by path; relax `LookupConstants` to "reuse the project's existing lookup-constants convention, or create one".
- **F12 Too prescriptive: step caps** — agent Phase 5 "Do not attempt more than one round of self-correction per checklist item" is a user-control rule; keep, but define "round" as one edit-then-build cycle.
- **F13 Vague: "mostly compatible; verify format strings"** — data-access skill Step 6 for `TO_CHAR`/`TO_DATE`. Proposal: point to `references/oracle-to-postgres-to-char-numeric.md` / `oracle-to-postgres-timestamp-timezone.md` via the review skill, or state what to verify.
- **F14 Vague: connection string example** — `Host=localhost;Port=5432;...` in Step 2 conflicts with "do not hardcode credentials"/use existing mechanism. Proposal: show the key shape without values.
- **F15 Vague: skill triggering Phase 4 sequencing** — Phase 4 says check `orafce` "available (or should be added)" without saying who decides. Proposal: ask the user, since extensions change the database.
- **F16 Observation, outside this issue's text** — `plugins/oracle-to-postgres-migration-expert/plugin.json` lists `./agents/oracle-to-postgres-migration-expert.md` while the file is `agents/oracle-to-postgres-migration-expert.agent.md`; verify against how the build resolves it before recording.

### Change 2 — plugin version

- **No bump** — report-only pass changes no promotable file.
- **If Q1 = apply edits** — bump `plugins/oracle-to-postgres-migration-expert/plugin.json` from `1.1.4` to `1.1.5` (patch: wording only, no new capability or behavior change); use minor only if a proposal adds a new rule.

## Acceptance criteria

- [ ] Report exists at the agreed path with the required sections.
- [ ] Every one of the nine files (agent + 8 skills) is covered or explicitly marked "no findings".
- [ ] Each finding has: location, class, problem, concrete replacement wording, and why intent is preserved.
- [ ] Plugin-wide invariants and phase-specific constraints are listed separately and marked as intentionally specific.
- [ ] Seed findings F1–F16 are each confirmed, revised, or dropped with a reason.
- [ ] No finding recommends weakening "never apply DDL directly", Oracle-as-source-of-truth, or phase-gate confirmation.
- [ ] The missing-DDL evaluation is not addressed.
- [ ] `npm run build` and validators pass with no unintended file changes.

## Open questions

- **Q1 — report only or apply edits** — options: (a) report only; (b) report plus applying agreed wording edits in this PR; (c) report now, edits in a follow-up issue. I would pick (c): the issue's "Done when" is documentation, and it keeps the version bump and upstream diff separate.
- **Q2 — include `references/*.md`** — options: (a) exclude, SKILL.md and agent only; (b) include a light pass for consistency with SKILL.md wording. I would pick (a); technical accuracy is a different review.
- **Q3 — report location** — options: (a) `.github/fork-only/reviews/issue-129-instruction-specificity.md`; (b) a comment/section on the PR; (c) a doc inside the plugin. I would pick (a): fork-only, versioned, never promoted.
- **Q4 — F11 naming rules** — options: keep `.Postgres` suffix and report filenames as invariants vs. relax them to defaults. I would keep them: later phases and the user-facing hand-offs resolve artifacts by path.
- **Q5 — F16** — options: include it here, or file a separate issue. I would pick a separate issue after confirming the build's path resolution; it is not an instruction-specificity problem.

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- `git diff --stat main` — confirm only the plan, the report, and (only if Q1 = apply) the intended agent/skill/plugin files changed.
- **Quote check** — every finding's "current wording" must be copy-matched with `grep` against the source file.
