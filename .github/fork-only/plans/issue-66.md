---
issue: 66
title: 'Update Custom Agent''s Model Frontmatter to a supported value'
scope: agent
status: draft
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
   - Replace `model: claude-sonnet-5` with the maintainer-confirmed supported value once known (see Open Questions). Do not guess a new string without confirmation — a wrong guess reproduces this exact bug.
2. **`plugins/oracle-to-postgres-migration-expert/plugin.json`** (`version` field):
   - Bump `"version": "1.1.2"` to `"version": "1.1.3"` — **patch** level, because this only corrects a misconfigured frontmatter value with no new capability, skill, or behavior change (same reasoning class as the `1.1.1` → `1.1.2` bump from issue #53).
3. **No other files** — do not touch skills, other agent frontmatter fields, `.github/agents/*`, or any workflow.

## Acceptance criteria

- [ ] The agent's `model:` field is set to a value the maintainer has explicitly confirmed resolves in their Copilot client (not a guess).
- [ ] The plugin version is exactly `1.1.3`.
- [ ] No fields except the agent's `model:` value and the plugin version differ from the pre-change files.
- [ ] `npm run build`, `npm run plugin:validate`, and `bash eng/fix-line-endings.sh` all pass cleanly.
- [ ] The maintainer has personally verified, in a live Copilot client, that the new value no longer produces an unsupported-model error (this cannot be verified by any command in this repo).

## Open questions

- **Q1 — what does "not supported" mean, exactly** — options: (a) the VS Code Copilot Chat model picker rejects `claude-sonnet-5`, (b) GitHub Copilot CLI's `/model` rejects it, (c) the Copilot coding agent runtime silently falls back to a default, (d) something else entirely (paste the exact error text if you have it). I would pick: none — I have no basis to guess; please paste the exact error message and which surface produced it.
- **Q2 — the confirmed-working replacement value** — options: (a) a corrected slug such as `claude-sonnet-4-5` or `claude-sonnet-4.5` matching other agents already in this repo, (b) a display-name string such as `'Claude Sonnet 4.5'`, (c) a genuinely new `claude-sonnet-5`-family identifier if that model has since become available under a different exact string, (d) something else you found in your own client's picker. I would pick: whichever exact string you can copy directly out of your client's model picker — that is strictly more reliable than any guess I could offer.
- **Q3 — should the two fork-only agents also change** — `.github/agents/dev-orchestrator.agent.md` and `.github/agents/plan-reviewer.agent.md` also currently use `model: claude-sonnet-5` and are outside this issue's stated scope and outside upstream-promoted files. Options: (a) leave them alone, fix only the promoted agent (my default reading of the issue), (b) fix all three for consistency now, (c) file that as a separate follow-up issue. I would pick: (a) — this issue is about "the Custom Agent," and those two files are fork tooling never promoted upstream, so bundling their fix in here would blur the diff this issue is meant to produce.

## Verification

- `npm run build` — regenerate README/marketplace after edits.
- `bash eng/fix-line-endings.sh` — normalize line endings.
- `npm run plugin:validate` — confirm `plugin.json` version bump and structure are valid.
- `npm run skill:validate` — no skill files touched, but run for completeness since this agent's plugin bundles skills.
- Manual (cannot be automated in this sandbox): open the agent in the actual Copilot client named in Q1's answer and confirm the model picker resolves the new value without falling back or erroring.
