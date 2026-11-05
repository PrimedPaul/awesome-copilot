---
issue: 121
title: 'Update migration expert tools for the shared Copilot harness'
scope: agent
status: draft
---

# Plan: issue #121

## Issue summary

- **Tools swap** — replace the `tools` frontmatter in `agents/oracle-to-postgres-migration-expert.agent.md` with exactly `[execute, read, edit, search, todo, web]`.
- **Shell wording** — replace the literal `runInTerminal` in *Your Approach → Act directly* with harness-neutral wording, keeping direct execution.
- **Gate clarification** — make the existing confirmation gates explicit without relying on `vscode/askQuestions`; fall back to asking in chat.
- **Restatement gap** — the issue says "without changing the migration workflow", yet adds new fallback wording; I read that as clarification only, no new phases or gates.

## Grilling

### Ambiguities

- **"Harness-neutral wording"** — the issue gives "use the available shell tool" only as an example; exact text is my choice.
- **Where gate wording lives** — the issue does not say whether to add a new section or edit *Your Approach* bullets; this affects diff size.
- **Verification evidence** — the acceptance criteria require a live VS Code Copilot-harness session, which cannot be run in CI or by this planner.
- **"web" semantics** — the issue does not say whether the body should mention using `web` for documentation lookup; it is only listed in the rationale.

### Scope

- **IN** — `tools:` line in frontmatter.
- **IN** — *Your Approach* bullets "Act directly", "Suggest, don't assume", "One step at a time".
- **IN** — `plugins/oracle-to-postgres-migration-expert/plugin.json` version bump.
- **OUT** — `target`, `model`, `name`, `description` frontmatter.
- **OUT** — MCP servers, skills, memory configuration, migration-content fixes (Phases 1–6 bodies).
- **OUT** — Rewording the phase hand-off lines, except where needed for the fallback; leave them as-is.

### Constraints

- **Version bump** — `plugin.json` is currently `1.1.3`; the plugin version must be bumped for upstream promotion.
- **Frontmatter** — must remain valid YAML with `description`, `model`, `name` unchanged.
- **Docs** — `docs/README.agents.md` may list tools or descriptions; confirm `npm run build` leaves no unintended diff.
- **Line endings** — run `bash eng/fix-line-endings.sh` before commit.
- **Fork-only tooling** — plan files under `.github/fork-only/` are never promoted upstream.

### Assumptions I am making

- **Prose is not enforcement** — the issue states this itself; I add wording, not hooks or permission controls.
- **Memory removal accepted** — dropping `vscode/memory` is intended, and the body does not depend on it (I read the whole agent file and found no memory references).
- **Askquestions not referenced** — the body does not currently mention `vscode/askQuestions` by name, so the change is additive wording only.
- **Patch vs minor** — the change is wording plus tool list, not new capability for users.
- **No docs table of tools** — I have not read `docs/README.agents.md`; assuming it carries no tool list.

## Plan

- **`agents/oracle-to-postgres-migration-expert.agent.md` frontmatter** — change line `tools: [vscode/memory, vscode/runCommand, vscode/askQuestions, execute, read, edit, search, todo]` to `tools: [execute, read, edit, search, todo, web]`.
- **`agents/oracle-to-postgres-migration-expert.agent.md` — *Your Approach → Act directly*** — replace `Use \`edit\`, \`runInTerminal\`, \`read\`, and \`search\` tools` with "Use the available edit, shell, read, search, and web tools"; keep "rather than delegating to subagents".
- **`agents/oracle-to-postgres-migration-expert.agent.md` — *Your Approach*, new bullet "Confirm at gates"** — add after "One step at a time":
  - ask for explicit confirmation before advancing to the next step;
  - use an interactive question tool if one is available, otherwise ask in chat and wait for an explicit reply;
  - never advance automatically when no reply or no question tool is present.
- **`agents/oracle-to-postgres-migration-expert.agent.md` — *Guidelines*, edit the "Never apply database changes directly" bullet** — add that prose is not an enforcement boundary and that the agent must not run database-mutating commands (e.g. `psql`, `sqlplus`) even though shell is enabled.
- **`agents/oracle-to-postgres-migration-expert.agent.md` — Phases 3 and 6 hand-off lines** — leave unchanged; they already say "Do not advance until they confirm results."
- **`plugins/oracle-to-postgres-migration-expert/plugin.json`** — bump `version` from `1.1.3` to `1.1.4` (patch: tool aliases and wording; no new skill or capability).
- **Generated docs** — run `npm run build`; commit only regenerated files that actually change.

## Acceptance criteria

- [ ] `tools` is exactly `[execute, read, edit, search, todo, web]`.
- [ ] No other frontmatter field changed and no `target` added.
- [ ] `grep runInTerminal agents/oracle-to-postgres-migration-expert.agent.md` returns nothing.
- [ ] Body states confirmation before advancing, user-run integration tests, and user-applied DB changes.
- [ ] Body states the chat fallback when no question tool exists.
- [ ] No MCP, skill, model, or memory changes in the diff.
- [ ] `plugin.json` version bumped.
- [ ] Manual check in a VS Code Copilot-harness session: tools resolve, a shell build runs, docs retrieval works, agent stops at a gate.
- [ ] Standard aliases confirmed in Local harness, if available.

## Open questions

- **Q1 — manual harness verification** — options: (a) maintainer runs the VS Code Copilot-harness check before merge; (b) record as untested in the PR body. I would pick (a).
- **Q2 — plugin version level** — options: (a) patch `1.1.4`; (b) minor `1.2.0` because `web` adds documentation retrieval. I would pick (a), since no new skill or workflow is added.
- **Q3 — DB-mutation guardrail wording** — options: (a) add an explicit "do not run database-mutating commands" sentence; (b) only clarify the existing bullet. I would pick (a), because shell is enabled.

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- `git diff --stat` — only the agent file, `plugin.json`, and any regenerated docs.
- `grep -n "runInTerminal\|vscode/" agents/oracle-to-postgres-migration-expert.agent.md` — no matches.
- Manual VS Code Copilot-harness session per the acceptance criteria.
