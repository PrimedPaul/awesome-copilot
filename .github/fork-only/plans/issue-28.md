---
issue: 28
title: 'Replace Model of the Oracle-to-Postgres Custom Agent'
scope: agent
status: draft
---

## Issue summary

- **Current model unsupported** — issue states the agent's current model ("Claude Sonnet 4.6 (copilot)") is no longer supported.
- **Requested replacement** — switch to "Claude Sonnet 5.0" per the issue text.
- **Reasoning setting** — use its "default reasoning setting" (i.e. no explicit reasoning-effort override in the frontmatter).
- **Single-field change implied** — the issue only names the model swap; no other agent behavior change is requested.

## Grilling

### Ambiguities

- **Exact model string** — the issue says "Claude Sonnet 5.0" but no agent file in this repo currently uses that exact string; the closest precedent is `.github/fork-only/agents/plan-skeptic.agent.md`, which uses the bare identifier `claude-sonnet-5` (no "5.0", no version-style dot, no "(copilot)" suffix). The target agent's current frontmatter uses the `'Claude Sonnet 4.6 (copilot)'` display-name style instead. It is unclear whether the maintainer wants the display-name style (`'Claude Sonnet 5 (copilot)'`) or the bare identifier style (`claude-sonnet-5`) used elsewhere in this fork.
- **"Default reasoning setting"** — no agent file in `agents/` currently sets any reasoning-effort field on `model:`, and there is no separate `reasoning:` frontmatter key anywhere in the repo. It's ambiguous whether "default reasoning setting" just means "don't add anything beyond the model name" (i.e., status quo) or whether the maintainer expects some explicit marker.
- **Is "5.0" a typo for "5"?** — GitHub Copilot's actual model catalog uses "Claude Sonnet 4.5" / "Claude Sonnet 4.6" (no trailing ".0"); a hypothetical "Claude Sonnet 5" would likely follow the same style without ".0".

### Scope

- **IN**: editing the `model:` frontmatter field in `agents/oracle-to-postgres-migration-expert.agent.md` only.
- **IN**: bumping `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` (patch-level — see Plan).
- **OUT**: any change to the agent's instructions, phases, guidelines, or working-directory conventions — the issue does not ask for behavioral changes.
- **OUT**: changes to any of the 8 skills under `skills/*oracle-to-postgres*/` — none reference a model directly.
- **OUT**: changes to `.github/fork-only/agents/*.agent.md` (dev-orchestrator, plan-skeptic) — these are fork-only tooling, never promoted upstream, and not what the issue is about (the issue explicitly says "the current agent," i.e., the promotable one).

### Constraints

- **Upstream promotion rule** — per `.github/fork-only/README.md`, `plugin.json` version must be bumped whenever the agent changes, so the fork's `fork-agent-reviewer` version-check job (which fails if `plugin.json` version equals upstream) will pass.
- **CONTRIBUTING.md convention** — `version` must remain a valid semver (`CONTRIBUTING.md` line ~239).
- **No behavior change** — a pure model swap is metadata-only; nothing else in the frontmatter (`description`, `tools`, `name`) should move.
- **Frontmatter quoting style** — existing file quotes `model:` with single quotes (`'Claude Sonnet 4.6 (copilot)'`); replacement should follow the same quoting convention for consistency within the file.

### Assumptions I am making

- **Model string to use**: I assume the maintainer means the display-name form `'Claude Sonnet 5 (copilot)'` (dropping ".0", matching the existing `(copilot)` suffix convention already in this file) rather than the bare `claude-sonnet-5` identifier used in `plan-skeptic.agent.md`. This is a guess — flagged as the first open question.
- **"Default reasoning" = no extra field**: I assume this means simply not appending any reasoning-effort qualifier to the model string (e.g., not `'Claude Sonnet 5 (high reasoning)'`), since no other agent in the repo does this and there's no established frontmatter key for it.
- **No other frontmatter fields change**: `description`, `tools`, and `name` stay exactly as-is.
- **Patch-level plugin bump is sufficient**: a model swap doesn't change agent capability or behavior, so it's a patch, not a minor/major bump.
- **Skills are untouched**: none of the 8 skill folders reference a model or mention Claude Sonnet 4.6, so no skill file needs editing (not independently verified against all 8 skill file contents — only checked the plugin.json skills list and the agent file itself).

## Plan

- **File**: `agents/oracle-to-postgres-migration-expert.agent.md`
  - **Change**: line 2 of the frontmatter block, `model: 'Claude Sonnet 4.6 (copilot)'` → `model: 'Claude Sonnet 5 (copilot)'` (pending answer to Open Question 1 — could instead become `model: claude-sonnet-5` to match `plan-skeptic.agent.md`'s style).
  - **Where**: YAML frontmatter, second field, between `description:` and `tools:`.
- **File**: `plugins/oracle-to-postgres-migration-expert/plugin.json`
  - **Change**: `"version": "1.1.0"` → `"version": "1.1.1"`.
  - **Where**: top-level `version` key.
  - **Semver level**: **patch** — this is a metadata-only model update with no change to agent capability, instructions, tools, or skills; nothing about what the agent does or how a user interacts with it changes.

## Acceptance criteria

- [ ] `agents/oracle-to-postgres-migration-expert.agent.md` frontmatter `model:` field reflects the agreed model string (see Open Question 1).
- [ ] No other frontmatter fields (`description`, `tools`, `name`) or agent body content changed.
- [ ] `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` bumped (patch level, e.g. `1.1.0` → `1.1.1`).
- [ ] No skill files under `skills/*oracle-to-postgres*/` modified (unless a keyword search on merge turns up a stale model reference).
- [ ] `npm run build`, `npm run plugin:validate`, `npm run skill:validate`, and `bash eng/fix-line-endings.sh` all pass cleanly.

## Skeptic's report

### Strengths

- **Correctly minimal scope** — resisting the urge to also "improve" the agent's instructions while touching the file; the issue asks for exactly one thing.
- **Version-bump reasoning is sound** — patch-level is the right call per the fork's own semver policy since there's no capability change.

### Concerns

- **Issue**: The exact target model string is unverified against GitHub Copilot's real model catalog.
  - **Why it matters**: If "Claude Sonnet 5" (or "5.0") does not actually exist as a selectable Copilot model at merge time, the change will silently produce an agent with an invalid/rejected `model:` value, and the agent may fail to load or fall back to a default model unexpectedly.
  - **Suggested fix**: Before merging, the maintainer should confirm the exact accepted model identifier string in the current Copilot CLI/VS Code model picker (this plan cannot verify that from the repo alone).
- **Issue**: "Default reasoning setting" has no established convention in this repo to map onto.
  - **Why it matters**: If the actual Copilot model UI exposes a reasoning-effort control that's normally paired with the model string in frontmatter (some ecosystems use a suffix or separate key), simply reusing the old string-only format could silently pick a non-default effort level, or the maintainer's intent could require a new frontmatter key this plan doesn't add.
  - **Suggested fix**: Maintainer confirms in Open Question 2 whether "default" requires any explicit marker at all.
- **Issue**: I have not grepped all 8 skill files' full content for embedded model-name mentions, only inferred it's unlikely.
  - **Why it matters**: If a skill file has an example transcript or instruction referencing "Claude Sonnet 4.6," it would go stale.
  - **Suggested fix**: Maintainer or orchestrator agent should `grep -rn "Claude Sonnet 4.6\|Sonnet 4.6" skills/` during implementation before declaring done.

### Confidence

**Medium** — the file/field/version-bump mechanics are simple and low-risk, but the plan hinges entirely on an unverified model-string guess that could be wrong in a way only the maintainer (with access to the live Copilot model list) can resolve.

## Open questions

1. **Which model string format?** — Options: (a) display-name style matching the current file, `'Claude Sonnet 5 (copilot)'`; (b) bare identifier style matching `.github/fork-only/agents/plan-skeptic.agent.md`, `claude-sonnet-5`; (c) something else entirely if "Claude Sonnet 5.0" is the literal exact string Copilot expects. I would pick **(a)**, `'Claude Sonnet 5 (copilot)'`, since it's the minimal edit consistent with this specific file's existing convention — but only the maintainer can confirm against the live Copilot model picker.
2. **Does "default reasoning setting" need an explicit frontmatter marker?** — Options: (a) no extra field, just the model string (status quo for every other agent file in the repo); (b) some new reasoning-effort key/suffix if Copilot's frontmatter schema supports one. I would pick **(a)** — no other agent in this repo sets one, and inventing a new convention for one agent would be inconsistent.

## Verification

- `npm run build` — regenerates README.md, confirm no diff drift beyond expected.
- `bash eng/fix-line-endings.sh` — normalize line endings before commit.
- `npm run skill:validate` — confirm the 8 oracle-to-postgres skills remain valid (unaffected by this change, but cheap to re-check).
- `npm run plugin:validate` — confirm `plugin.json` version bump is well-formed semver and the manifest still validates.
- Manual: `grep -n "model:" agents/oracle-to-postgres-migration-expert.agent.md` to confirm exactly one field changed.
- Manual: `git diff --stat` to confirm only the two intended files changed.
