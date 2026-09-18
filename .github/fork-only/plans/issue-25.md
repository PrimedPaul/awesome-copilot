```yaml
issue: 25
title: 'Replace Model of the Oracle-to-Postgres Custom Agent'
scope: agent
status: draft
```

## Issue summary

- **Model deprecated** — issue states the current agent model is "no longer supported."
- **Requested replacement** — switch to Claude Sonnet 5.0.
- **Reasoning setting** — use its default reasoning setting (no explicit override).
- **Single-field change** — issue body names no other change; this reads as a one-line frontmatter edit, not a behavioral rewrite.

## Grilling

### Ambiguities

- **Exact model string** — issue says "Claude Sonnet 5.0" but the repo's actual frontmatter values for this vendor/version elsewhere are `'Claude Sonnet 4.5'`, `'Claude Sonnet 4.6'`, `'Claude Sonnet 4.6 (copilot)'`, and (in this fork's own tooling, `.github/fork-only/agents/plan-skeptic.agent.md`) the bare lowercase `claude-sonnet-5`. There is no established "5.0" precedent — need to confirm the exact string the maintainer wants.
- **`(copilot)` suffix** — current value is `'Claude Sonnet 4.6 (copilot)'`. Unclear whether the suffix denotes "runs via the Copilot model host" (keep it) or is legacy noise (drop it).
- **"Default reasoning setting"** — no agent file in this repo carries a distinct reasoning-effort frontmatter field; grepping `agents/*.agent.md` found no `reasoning:` key precedent. This phrase most plausibly means "don't add a reasoning override, just set the model" rather than "add a new field."
- **Scope of "no longer supported"** — could mean the exact model ID was deprecated by the provider, or that the picker in the Copilot CLI/IDE no longer lists it. Either way the fix is the same (swap the model string), but it affects urgency framing in the PR description.

### Scope

- **IN** — editing the `model:` line in `agents/oracle-to-postgres-migration-expert.agent.md` frontmatter.
- **IN** — bumping `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` (patch-level; see Plan).
- **OUT** — rewriting agent instructions, tools list, or `description` field.
- **OUT** — touching any skill files under `skills/*oracle-to-postgres*/`; the issue does not mention skill content.
- **OUT** — changing the plugin's `keywords`, `author`, or `extensions` composition arrays.

### Constraints

- **Frontmatter format** — per `CONTRIBUTING.md` and repo-wide convention, `model` values are typically single-quoted strings (`model: 'Claude Sonnet 4.6 (copilot)'` is the current form); keep quoting consistent with the existing line rather than switching styles.
- **Upstream promotion rule** — this agent is the one file in the fork meant to go upstream eventually; the model string chosen here should match what `github/awesome-copilot` itself would accept, so it doesn't need re-editing at promotion time.
- **`plugin.json` version bump** — per repo convention, any change to a shipped agent's metadata should bump `version` in its `plugin.json` even for a wording/config tweak; a bare model swap with no capability change is patch-level (see Plan for the exact bump).
- **Line-ending/validation gates** — `npm run build`, `npm run plugin:validate`, and `bash eng/fix-line-endings.sh` are the standard pre-commit gates for this repo and apply to any agent frontmatter edit.

### Assumptions I am making

- **Model string** — I assume the maintainer wants the plain, unsuffixed value `'Claude Sonnet 4.5'`-style casing but for version 5, i.e. `'Claude Sonnet 5'` (dropping ".0" — no other agent in the repo uses a trailing ".0"). This needs maintainer confirmation (see Open questions).
- **Drop the `(copilot)` suffix** — I assume it should be dropped unless the maintainer says otherwise, since the issue names the model plainly without a host qualifier.
- **No new reasoning field** — I assume "default reasoning setting" means no `reasoning:`-style key is added to frontmatter, since no such key exists elsewhere in this repo's agents.
- **No tools/description change** — I assume the `tools:` list and `description:` remain untouched; the issue is scoped to the model only.
- **Patch-level plugin bump** — I assume this is a patch bump (`1.1.0` → `1.1.1`) since it is a maintenance fix with no new capability, not a minor/major change.

## Plan

- **File**: `agents/oracle-to-postgres-migration-expert.agent.md`
  - **Change**: replace the `model:` frontmatter line.
  - **From**: `model: 'Claude Sonnet 4.6 (copilot)'`
  - **To**: `model: 'Claude Sonnet 5'` (pending maintainer confirmation of exact string — see Open questions).
  - **Where**: frontmatter block, line 3 (between `description:` and `tools:`).
- **File**: `plugins/oracle-to-postgres-migration-expert/plugin.json`
  - **Change**: bump `"version"` from `"1.1.0"` to `"1.1.1"`.
  - **Where**: top-level `version` field.
  - **Semver level**: patch — this is a maintenance/compatibility fix (swapping a deprecated model identifier), not a new capability, skill addition, or behavior-breaking change.

## Acceptance criteria

- [ ] `agents/oracle-to-postgres-migration-expert.agent.md` `model:` field no longer references the deprecated "Claude Sonnet 4.6" identifier.
- [ ] New model value matches the exact string the maintainer confirms in the open questions below.
- [ ] No other frontmatter fields (`description`, `tools`, `name`) or body content changed.
- [ ] `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` bumped (patch).
- [ ] `npm run build`, `npm run plugin:validate`, `npm run skill:validate`, and `bash eng/fix-line-endings.sh` all pass.
- [ ] Agent still loads/parses correctly in the Copilot CLI/IDE model picker (manual spot check if possible).

## Skeptic's report

### Strengths

- **Small blast radius** — a one-line frontmatter change with no logic edits is low-risk and easy to review.
- **Clear trigger** — "model no longer supported" is a concrete, verifiable failure mode, not a vague preference.
- **Upstream-friendly** — since this agent is meant for promotion, fixing its model now avoids carrying a broken reference into the eventual upstream PR.

### Concerns

- **Issue**: the exact model string is unconfirmed and the repo has no single canonical form (`'Claude Sonnet 4.5'` vs `'Claude Sonnet 4.6 (copilot)'` vs bare `claude-sonnet-5`).
  - **Why it matters**: shipping the wrong string re-creates the same "unsupported model" failure the issue is trying to fix, just with different text.
  - **Suggested fix**: maintainer confirms the exact string before implementation; orchestrator should not guess silently.
- **Issue**: "default reasoning setting" has no corresponding frontmatter field anywhere in this repo to hang the requirement on.
  - **Why it matters**: if Copilot's agent format *does* support an explicit reasoning/effort key that I'm not aware of, silently omitting it could mean the issue is only half-addressed.
  - **Suggested fix**: maintainer/orchestrator should check current Copilot CLI agent frontmatter docs for a reasoning-effort key before closing; if none exists, note explicitly in the PR that "default" requires no extra field.
- **Issue**: dropping the `(copilot)` suffix is a guess, not confirmed by the issue text.
  - **Why it matters**: if the suffix is meaningful (routing to a specific model host rather than provider-direct), dropping it could change runtime behavior beyond "just the model name."
  - **Suggested fix**: maintainer confirms whether the suffix should be kept, dropped, or replaced with a `5`-equivalent.
- **Issue**: patch-level plugin version bump is my own convention judgement, not stated in `CONTRIBUTING.md` verbatim for this exact scenario.
  - **Why it matters**: if maintainer considers a model swap a more significant change (e.g., because it can measurably change agent behavior/quality), they may want a minor bump instead.
  - **Suggested fix**: confirm semver level in open questions; default to patch if no objection.

### Confidence

- **Medium** — the mechanical part of this change (edit one line, bump version) is close to certain, but the exact model string and whether "reasoning setting" implies an additional field are both unresolved and could change the diff.

## Open questions

- **Exact model string to use** — options: `'Claude Sonnet 5'`, `'claude-sonnet-5'` (matches `plan-skeptic.agent.md`'s bare form), `'Claude Sonnet 5.0'` (literal issue text), or `'Claude Sonnet 5 (copilot)'` (keeps existing suffix pattern). **I would pick**: `'Claude Sonnet 5'` — matches the title-case, unsuffixed convention most other agents in this repo use, and avoids inventing a ".0" that appears nowhere else in the repo.
- **Keep or drop the `(copilot)` suffix** — options: drop it (matches issue's plain wording), or keep it as `'Claude Sonnet 5 (copilot)'` (matches the outgoing value's host-qualifier pattern). **I would pick**: drop it, since the issue names the model plainly and most other agents in the repo don't use the suffix.
- **Does "default reasoning setting" require a new frontmatter field?** — options: no new field needed (my assumption, since no such key exists anywhere in this repo), or there is a Copilot agent frontmatter key for reasoning effort that should be added/left unset explicitly. **I would pick**: no new field — treat "default" as "don't add an override."
- **Plugin version bump level** — options: patch (`1.1.0` → `1.1.1`, my recommendation for a maintenance fix), or minor (`1.1.0` → `1.2.0`, if a model swap is considered more significant). **I would pick**: patch.

## Verification

- `npm run build` — regenerates README and marketplace.json; confirms no build-time errors from the frontmatter edit.
- `bash eng/fix-line-endings.sh` — normalizes line endings before commit.
- `npm run skill:validate` — sanity check that no skill folders were inadvertently affected.
- `npm run plugin:validate` — confirms `plugin.json` version bump and schema are still valid.
- **Domain-specific**: manually load the agent in the Copilot CLI/IDE agent picker (if available) to confirm the new model string resolves without an "unsupported model" error.
