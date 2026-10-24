---
issue: 98
title: '[AG-12] Explore local database MCP integration'
scope: agent
status: draft
---

## Issue summary

- **Exploration only** — the issue asks for an assessment of local MCP integrations for Oracle and PostgreSQL in the plugin.
- **Deliverable is a recommendation** — "Done when" says to "record a recommendation before adding an integration"; no integration is shipped by this issue.
- **Gap from literal text** — the issue says "added to the plugin", but the real output is a written assessment, so no `plugin.json`/`mcp.json` change is planned.
- **Source** — `.github/fork-only/change-brainstorming.md` AG-12, marked "exploratory, not approved or prioritized".

## Grilling

### Ambiguities

- **Where the recommendation lives** — the issue does not say where to record it; options are the plan PR, a doc under `.github/fork-only/`, or the plugin `README.md`.
- **"Local" meaning** — unclear whether it means a stdio server on the developer machine or a server against a local Docker database.
- **Which databases to connect** — Oracle source, PostgreSQL target, or both; this drives the risk profile.
- **Read-only vs read-write** — not stated; matters because of the agent's DB-change rules.

### Scope

- **IN** — survey candidate Oracle and PostgreSQL MCP servers (maintenance, license, auth model, read-only support, transport).
- **IN** — document required DB access, credentials handling, and configuration.
- **IN** — document operational implications (Docker/runtime prerequisites, secrets, network exposure, prompt-injection via DB content).
- **IN** — state a recommendation (adopt, adopt optionally, or do not adopt) with rationale.
- **OUT** — editing `agents/oracle-to-postgres-migration-expert.agent.md`, `plugin.json`, any `mcp.json`, or skills.
- **OUT** — shipping any MCP configuration; that needs a follow-up issue after the recommendation is approved.

### Constraints

- **Agent rule conflict** — the agent file says "Never apply database changes directly on behalf of the user" and that PostgreSQL schema is immutable during Phases 5 and 6; any integration must be read-only to honour this.
- **MCP placement** — per `AGENTS.md`, MCP servers go in a root `mcp.json` in the plugin folder, not in `plugin.json` and not `.mcp.json`.
- **Tools allowlist** — the agent `tools:` frontmatter would need MCP tool entries if ever adopted.
- **Upstream promotion** — any eventual change to the plugin requires bumping `version` (currently `1.1.3`); a docs-only recommendation under `.github/fork-only/` does not and is never promoted upstream.
- **Environment limits** — Docker may be needed for upstream-style MCP servers; the research here cannot run databases.
- **Secrets** — no connection strings or credentials may be committed.

### Assumptions I am making

- **Output is a document** — the recommendation is a Markdown file, not code.
- **Fork-only location** — it lives in `.github/fork-only/` so it is not promoted upstream.
- **Read-only default** — any recommended integration must support or be configured read-only.
- **Both databases in scope** — Oracle and PostgreSQL are assessed equally.
- **Web research available** — candidate servers can be assessed from their public repos and docs; I have not verified specific servers yet.
- **No existing MCP config** — I did not find `mcp.json` in `plugins/oracle-to-postgres-migration-expert/` (directory contains `README.md` and `plugin.json`).

## Plan

- **Create `.github/fork-only/mcp-integration-assessment.md`** — new fork-only doc with sections: *Candidates*, *Access and configuration*, *Operational implications*, *Fit with agent rules*, *Recommendation*.
- **Candidates section** — table comparing at least: Oracle SQLcl MCP server, a community Oracle MCP server, the PostgreSQL MCP server options (e.g. `postgres-mcp`/Postgres MCP Pro, the reference Postgres server); columns for maintainer, license, transport, read-only support, auth.
- **Access and configuration section** — required DB roles (read-only user, catalog views such as `ALL_TAB_COLUMNS`, `information_schema`), connection config via env vars, local-only network binding.
- **Operational implications section** — runtime prerequisites (Java for SQLcl, Docker/Python), secret handling, audit/logging, risk of untrusted DB content reaching the model.
- **Fit with agent rules section** — map each candidate against "Never apply database changes directly" and Phase 4 "generate scripts for the user to apply".
- **Recommendation section** — one of adopt / optional / do not adopt, plus a follow-up issue outline if adopted (new `plugins/oracle-to-postgres-migration-expert/mcp.json`, `tools:` additions in the agent file, minor version bump to `1.2.0`).
- **No `plugin.json` change in this issue** — no version bump now; future adoption would be minor (new capability).

## Acceptance criteria

- [ ] Assessment document exists at `.github/fork-only/mcp-integration-assessment.md`.
- [ ] At least one Oracle and one PostgreSQL candidate are compared with sourced facts.
- [ ] Required DB access and configuration are documented per candidate.
- [ ] Operational implications are documented.
- [ ] Fit against the agent's no-direct-DB-changes rules is stated.
- [ ] A clear recommendation is recorded.
- [ ] No agent, plugin, or skill files are modified.

## Open questions

- **Q1 — recommendation location** — options: (a) `.github/fork-only/mcp-integration-assessment.md`; (b) plugin `README.md`; (c) comment on this issue. I would pick (a).
- **Q2 — access mode** — options: (a) strictly read-only introspection; (b) allow read-write against local scratch DBs. I would pick (a).
- **Q3 — databases in scope** — options: (a) both Oracle and PostgreSQL; (b) PostgreSQL only first. I would pick (a).
- **Q4 — follow-up on adopt** — options: (a) open a separate implementation issue; (b) extend this issue. I would pick (a).

## Verification

- `npm run build`
- `bash eng/fix-line-endings.sh`
- `npm run skill:validate`
- `npm run plugin:validate`
- `git diff --stat main` — confirm only the assessment file changed and no agent, plugin, or skill files were touched.
