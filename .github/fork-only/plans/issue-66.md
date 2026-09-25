---
issue: 66
title: 'Update Custom Agent''s Model Frontmatter to a supported value'
scope: agent
status: approved
---

## Issue summary

- **Claimed defect** — the issue states the current `model:` value, `claude-sonnet-5`, "is not supported" by some (unnamed) Copilot surface.
- **Requested action** — "Research the supported value and update it," i.e. find whichever model identifier that surface actually accepts and set the agent's frontmatter to it.
- **Gap from literal text** — the issue names `claude-sonnet-5` as the unsupported value and gives no error message, no client name (VS Code / Copilot CLI / Copilot Chat), and no timestamp, so "not supported" cannot be independently confirmed from this repo alone.
- **Historical note** — `claude-sonnet-5` was deliberately set by the prior plan `.github/fork-only/plans/issue-53.md` (issue #53), which itself changed the value **from** `'Claude Sonnet 5.0 (copilot)'` **to** `claude-sonnet-5` on the premise that the display-style string was non-canonical. This issue implies that fix did not hold up in practice.

## Grilling

### Ambiguities

- **Which surface rejects it** — "not supported" could mean the VS Code Copilot Chat model picker, GitHub Copilot CLI (`/model`), or the Copilot coding agent runtime; each may accept different identifier formats (display name vs. slug), and I have no error text or screenshot to disambiguate.
- **No network research was possible in this run** — this planner has no outbound network access, so I could not query GitHub's live list of supported Copilot model identifiers to confirm what "the supported value" actually is. The issue's instruction to "research" cannot be completed by me in this sandbox; it can only be completed by someone (or an agent) with the ability to check a live model picker or current GitHub Copilot documentation.
- **Timing** — the current date context for this run is 2026-09-25; whether a model literally named "Claude Sonnet 5" exists and is GA at that time, and under what exact frontmatter string, is exactly the fact this issue asks to pin down and that I cannot verify here.
- **Scope of "it"** — the issue says "the custom agent's model frontmatter" (singular), which I read as the one agent this fork develops, not every agent file in the repository's broader catalog (which contains many differing model strings already, e.g. `'Claude Sonnet 4.5'`, `'claude-sonnet-4-5'`, `claude-sonnet-4-6`).

### Scope

- **IN** — the `model:` field in `agents/oracle-to-postgres-migration-expert.agent.md` (currently `claude-sonnet-5`).
- **IN** — the corresponding `plugin.json` version bump for the fork-managed plugin.
- **OUT** — `.github/agents/dev-orchestrator.agent.md` and `.github/agents/plan-reviewer.agent.md`, which also currently use `model: claude-sonnet-5`. These are fork-only interactive agents (not promoted upstream, not covered by the plugin), and the issue only names "Custom Agent" (singular) — I read that as the one fork agent under active development, not this fork's own tooling. If the maintainer wants those changed too for consistency, that is a explicit decision, not an inferred one (see Q2).
- **OUT** — every other agent file in `agents/**` with a different model string; this issue does not ask for a repository-wide model audit.
- **OUT** — any change to the agent's tools, instructions, or behavior; this is a frontmatter-value-only fix, same as issue #53's precedent.

### Constraints

- **Upstream promotion rule** — per `.github/fork-only/README.md`, `fork-bundle-upstream-pr` "fails hard if ... the version was not bumped," so `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` (currently `1.1.2`) must increase again.
- **No canonical registry in this repo** — neither `CONTRIBUTING.md` nor any `eng/*.mjs` validator enforces a specific model-string format or maintains an allow-list of valid identifiers; `CONTRIBUTING.md`'s only example is `model: "gpt-5"` in its scaffold template (line 106), which is illustrative, not prescriptive.
- **No local way to confirm client acceptance** — `npm run build` / `npm run plugin:validate` / `npm run skill:validate` check structural/schema validity, not whether a given `model:` string resolves in any live Copilot client; none of them would have caught the issue #53 value being wrong, and none can confirm this issue's fix either.
- **Repository precedent is inconsistent, not authoritative** — other agent files use quoted/unquoted, hyphenated/dotted, and display-name/slug variants interchangeably, so "what other files do" is weak evidence for "what is currently supported."

### Assumptions I am making

- I am assuming the maintainer has (or will obtain, outside this sandbox) a live Copilot client where they can open the model picker and read off the exact accepted identifier string — that is the only reliable source of truth here, and I cannot substitute for it.
- I am assuming this is a patch-level fix (correcting one misconfigured value), not a capability change, so the version bump is a patch, matching the precedent set by issue #53's own patch bump.
- I am assuming "the Custom Agent" means only `oracle-to-postgres-migration-expert.agent.md`, not the fork-only `.github/agents/*` agents, per the Scope section above.
- I am assuming no fallback list (e.g. `model: ["claude-sonnet-5", "gpt-5"]`) is wanted, consistent with issue #53's explicit rejection of a fallback list for this same field.
- I am assuming the maintainer will supply the exact string (or confirm one of the candidates below) as an issue comment answer, because I have no mechanism to verify a value myself.

## Plan

1. **`agents/oracle-to-postgres-migration-expert.agent.md`** (frontmatter, `model:` line):
   - Replace `model: claude-sonnet-5` with `model: 'Claude Sonnet 5'`, the exact display name supplied by the maintainer.
2. **`plugins/oracle-to-postgres-migration-expert/plugin.json`** (`version` field):
   - Bump the version one patch level from this fork's current `1.1.2` to `1.1.3`, preserving monotonic versioning and satisfying the fork promotion workflow. Canonical upstream `github/awesome-copilot` is at `1.1.0`; the fork's existing higher version must not be downgraded.
3. **No other files** — do not change skills, other agent frontmatter fields, `.github/agents/*`, or any workflow.

## Acceptance criteria

- [ ] The agent's `model:` field is exactly `Claude Sonnet 5`, the display name explicitly supplied by the maintainer.
- [ ] The plugin version is exactly `1.1.3`, one patch level above this fork's current `1.1.2` and higher than canonical upstream `github/awesome-copilot` `main`'s `1.1.0`.
- [ ] No files or fields except the agent's `model:` value and plugin version differ from the pre-change files.
- [ ] `npm run build`, `npm run plugin:validate`, and `bash eng/fix-line-endings.sh` all pass cleanly.
- [ ] The maintainer has personally verified, in a live Copilot client, that the new value no longer produces an unsupported-model error (this cannot be verified by any command in this repo).

## Open questions

**All questions are answered.**

- **Q1 — affected surface and failure:** When the maintainer selects the custom agent in VS Code or GitHub Copilot, the model defined canonically in frontmatter is not selected or recognized. Evidence: [issue comment](https://github.com/PrimedPaul/awesome-copilot/issues/66#issuecomment-5825471866).
- **Q2 — replacement value and format:** Use the display name `Claude Sonnet 5`, not the model ID. Evidence: [issue comment](https://github.com/PrimedPaul/awesome-copilot/issues/66#issuecomment-5825471866) and direct maintainer confirmation in session on 2026-09-24.
- **Q3 — scope:** Only change the Oracle-to-PostgreSQL agent's frontmatter model field. Evidence: [issue comment](https://github.com/PrimedPaul/awesome-copilot/issues/66#issuecomment-5825471866).
- **Q4 — required version metadata:** Include the required plugin version bump without downgrading the fork. Canonical upstream `github/awesome-copilot` `main` reports `1.1.0`, while this fork currently has `1.1.2`; the maintainer confirmed the target should be `1.1.3`. Evidence: direct maintainer confirmations in session on 2026-09-24; both upstream and fork `plugin.json` values read from `main`/working tree.

## Decision record

| Question | Decision | Evidence |
|---|---|---|
| Q1 — affected surface and failure | VS Code or GitHub Copilot does not recognize/select the canonical frontmatter model when the custom agent is selected. | [Maintainer issue comment](https://github.com/PrimedPaul/awesome-copilot/issues/66#issuecomment-5825471866) |
| Q2 — replacement value and format | Use the exact display name `Claude Sonnet 5`, not a model ID. | [Maintainer issue comment](https://github.com/PrimedPaul/awesome-copilot/issues/66#issuecomment-5825471866); direct maintainer confirmation in session, 2026-09-24 |
| Q3 — scope | Change only the Oracle-to-PostgreSQL agent's frontmatter `model` field. | [Maintainer issue comment](https://github.com/PrimedPaul/awesome-copilot/issues/66#issuecomment-5825471866) |
| Q4 — version metadata | Bump the fork's current `plugin.json` version `1.1.2` to `1.1.3`; do not downgrade to canonical upstream's `1.1.0`-based `1.1.1`. | Direct maintainer confirmation in session, 2026-09-24; canonical upstream `github/awesome-copilot` `main` is `1.1.0`; fork working tree is `1.1.2` |

## Verification

- `npm run build` — regenerate README/marketplace after edits.
- `bash eng/fix-line-endings.sh` — normalize line endings.
- `npm run plugin:validate` — confirm the version bump and plugin structure are valid.
- `npm run skill:validate` — no skill files touched, but run for completeness since this agent's plugin bundles skills.
- Manual (cannot be automated in this sandbox): open the agent in the actual Copilot client named in Q1's answer and confirm the model picker resolves the new value without falling back or erroring.
