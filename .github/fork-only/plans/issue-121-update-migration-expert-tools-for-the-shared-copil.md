---
issue: 121
title: 'Update migration expert tools for the shared Copilot harness'
scope: agent
status: approved
lifecycle:
  schema: 1
  planHash: 'sha256:30320d9ea773080e956f9b0f8025f47f04dca96aa5ae20b0cdcbea83a7ef002c'
  requirements:
    status: answered
  review:
    status: completed
    verdict: no-material-concerns
    evidence: 'https://github.com/PrimedPaul/awesome-copilot/issues/121#issuecomment-6750497174'
  approval:
    status: approved
    approver: PrimedPaul
    evidence: 'https://github.com/PrimedPaul/awesome-copilot/issues/121#issuecomment-6750458773'
---

# Plan: issue #121

## Decision record

1. **Manual harness verification** — the maintainer chose option (a): run the VS Code Copilot-harness check before merge. The check covers tool availability, a shell build operation, documentation retrieval, and stopping at a user-confirmation gate. [Issue comment](https://github.com/PrimedPaul/awesome-copilot/issues/121#issuecomment-6667804743)
2. **Plugin version** — the maintainer chose option (a): bump `1.1.3` to `1.1.4`. [Issue comment](https://github.com/PrimedPaul/awesome-copilot/issues/121#issuecomment-6667804743)
3. **Database guardrail** — the maintainer chose option (a): explicitly prohibit database-mutating commands. [Issue comment](https://github.com/PrimedPaul/awesome-copilot/issues/121#issuecomment-6667804743)
4. **Database command boundary** — allow read-only database inspection only when needed and authorized; prohibit direct database mutations. Source: maintainer confirmed the recommended answer in this session on 2026-11-09.
5. **Confirmation gates** — require explicit user confirmation before every phase transition, while preserving existing handoffs and waiting for user-run integration-test results; use chat when no interactive question tool is available. Source: maintainer confirmed the recommended answer in this session on 2026-11-09.
6. **Documentation lookup** — direct the agent to consult authoritative documentation when version-specific Oracle, PostgreSQL, Npgsql, or .NET guidance is needed. Source: maintainer confirmed the recommended answer in this session on 2026-11-09.

## Scope and constraints

- Update only the Oracle-to-PostgreSQL agent, its plugin version, and generated build outputs that actually change.
- Preserve the migration phases, existing test handoffs, and all unrelated migration content.
- Change only the `tools` frontmatter field; keep `description`, `model`, and `name` unchanged, and do not add `target`.
- Do not add MCP servers, skills, memory configuration, hooks, enforcement code, or workflow changes.
- Keep the confirmation and database restrictions explicit as agent instructions; they are not technical enforcement boundaries.
- Plugin version is currently `1.1.3`; use the agreed patch version `1.1.4`.
- Run the repository build and validators and normalize line endings.
- Seed plan file is fork-only and is not promoted upstream.

## Implementation plan

1. In `agents/oracle-to-postgres-migration-expert.agent.md` (frontmatter at line 4), replace the `tools` list with exactly `[execute, read, edit, search, todo, web]`. Leave other frontmatter fields unchanged.
2. In **Your Approach → Act directly** (currently line 17), remove the `runInTerminal` requirement and describe using the available shell/`execute` tool to run commands, while retaining direct execution rather than subagent delegation.
3. Clarify the approach instructions so the agent:
   - requests explicit confirmation before each phase transition and waits for an affirmative reply;
   - preserves the current integration-test handoffs and does not proceed until the user reports results;
   - asks in chat and waits if no interactive question tool is available;
   - consults authoritative documentation when version-specific Oracle, PostgreSQL, Npgsql, or .NET guidance is needed.
4. Clarify the existing **Never apply database changes directly** guideline: generate scripts and instructions for the user to apply; do not execute database-mutating commands (including via shell). Read-only database inspection is allowed only when needed and authorized. Do not change the migration phases or schema policy.
5. In `plugins/oracle-to-postgres-migration-expert/plugin.json` (currently line 5), bump version `1.1.3` to `1.1.4`.
6. Run `npm run build` and include its generated README, category README, and marketplace outputs in the change where they differ. Run `bash eng/fix-line-endings.sh`, `npm run skill:validate`, and `npm run plugin:validate`.
7. Leave the live VS Code Copilot-harness verification for the maintainer before merge; record results, including any Local-harness alias check if available.

## Acceptance criteria

- `tools` is exactly `[execute, read, edit, search, todo, web]`; no other frontmatter field changes and no `target` is added.
- The agent body contains no `runInTerminal` reference and still directs direct execution.
- Instructions require explicit confirmation before every phase transition, with a chat fallback and no automatic advancement; the existing integration-test handoffs remain.
- The agent explicitly prohibits database-mutating commands, says the user applies generated database scripts, and limits read-only inspection to cases that are needed and authorized.
- The agent advises consulting authoritative documentation for version-specific guidance.
- `plugin.json` version is `1.1.4`; no MCP, skill, model, memory, hook, workflow, or unrelated migration-content change is introduced.
- `npm run build`, `npm run skill:validate`, and `npm run plugin:validate` pass; generated outputs are included if changed, and line endings are normalized.
- Before merge, the maintainer verifies the VS Code Copilot harness can resolve the aliases, run a shell build, retrieve documentation, and stop at a confirmation gate; confirm Local compatibility if available.

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- Inspect the diff to confirm only the planned agent/plugin/generated-output paths and this resolved plan changed.
- Confirm no `runInTerminal` reference remains and the frontmatter tool list is exact.
- The maintainer performs the VS Code Copilot-harness check before merge; do not claim it passed until its result is available.
