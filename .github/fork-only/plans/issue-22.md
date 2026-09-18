---
issue: 22
title: 'Replace Model of the Oracle-to-Postgres Custom Agent'
scope: agent
status: draft
---

## Issue summary

- **Model deprecated** — issue states "the current agent is no longer supported," meaning the `model:` value currently pinned in the agent's frontmatter is being retired.
- **Requested replacement** — switch to "Claude Sonnet 5.0."
- **Reasoning setting** — use its "default reasoning setting," i.e. do not add or pin any explicit reasoning-effort override.
- **My restatement gap** — the issue does not say whether "no longer supported" means deprecated-but-working, disabled, or already erroring; I am treating it as a straightforward version bump with no urgency signal beyond "do it."

## Grilling

### Ambiguities

- **Exact model string** — the repo has no single canonical form for model names. Existing examples include `'Claude Sonnet 4.6 (copilot)'` (this agent today), `'Claude Sonnet 4.5'`, `'claude-sonnet-4-5'`, and `claude-sonnet-5` (bare, lowercase-hyphenated, used by the fork-only `dev-orchestrator.agent.md` and `plan-skeptic.agent.md`). The issue says "Claude Sonnet 5.0" but no file in the repo uses a `.0` suffix for any model version.
- **"Default reasoning setting"** — I searched every `agents/*.agent.md` frontmatter block in this repo and found zero uses of a `reasoning:` or `reasoning_effort:` field. There is no existing convention to follow, so "use the default" most plausibly means *do not add such a field at all*, not "add a field explicitly set to a default value."
- **Scope of "no longer supported"** — could mean only the model string needs updating, or could imply the agent's instructions were tuned for 4.6's behavior and need re-validation against 5's behavior. The issue text only asks for a model swap.

### Scope

- **IN** — updating the `model:` frontmatter field in `agents/oracle-to-postgres-migration-expert.agent.md`.
- **IN** — bumping `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` per upstream-promotion rules.
- **OUT** — rewriting agent instructions, tools list, or guidelines sections; the issue does not ask for behavioral changes.
- **OUT** — touching skill files under `skills/*oracle-to-postgres*/`; none reference the model.
- **OUT** — touching `.github/fork-only/agents/dev-orchestrator.agent.md` or `plan-skeptic.agent.md` even though they already use `claude-sonnet-5` — those are fork-only tooling, never promoted upstream, and out of this issue's stated scope.

### Constraints

- **Upstream promotion rule** — `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` (currently `1.1.0`) must be bumped before this change can go upstream; `fork-agent-reviewer.md`'s `version_check` job fails the PR if the fork version equals the upstream version.
- **No schema for `reasoning`** — since no agent in this repo declares a `reasoning` field, adding one would be a novel precedent, not a documented convention; safest path is to omit it entirely and let the model's own default apply.
- **CONTRIBUTING.md** — repo convention favors `model:` as a single quoted string or bare identifier; no strict enum, but consistency with sibling entries is expected during review.
- **Downstream impact** — anyone who copied this agent file or referenced `Claude Sonnet 4.6 (copilot)` in tooling/docs referencing this specific string would need to notice the change, but I found no other references to this exact string outside the agent file itself.

### Assumptions I am making

- **"Claude Sonnet 5.0" means the same as the repo's existing "Claude Sonnet 5" style entries** — I am assuming the issue's ".0" is informal phrasing, not a request for a literal `.0`-suffixed string, since no file anywhere in the repo uses that suffix format.
- **Format to adopt: `'Claude Sonnet 5 (copilot)'`** — I am keeping the existing `(copilot)` suffix and quoting style already used on this exact line, changing only the version number, because it's the most surgical edit and matches the file's pre-existing convention (see `terminal-helper.agent.md`, `technical-content-evaluator.agent.md` which also use `X (copilot)` form).
- **No `reasoning` field is added** — "default reasoning setting" is satisfied by omission, not by adding an explicit field with a "default" value, since the schema has no precedent for it.
- **This is a patch-level plugin bump** — swapping only the `model:` metadata field, with no changes to agent instructions, tools, or skills, is not "new capability" (minor) nor "behavior-breaking" (major) by the plan's own semver rubric; it is a configuration/wording-level change. This is the single most debatable assumption in this plan — see Skeptic's report.
- **No other files reference the old model string** — confirmed by search; no doc, workflow, or skill file mentions `Claude Sonnet 4.6 (copilot)` outside the agent file itself.

## Plan

1. **`agents/oracle-to-postgres-migration-expert.agent.md`** (frontmatter, line 3):
   - Change `model: 'Claude Sonnet 4.6 (copilot)'` → `model: 'Claude Sonnet 5 (copilot)'`.
   - No other frontmatter fields (`description`, `tools`, `name`) change.
   - No body/instruction text changes — this issue is a metadata swap only.
2. **`plugins/oracle-to-postgres-migration-expert/plugin.json`** (`version` field):
   - Bump `"version": "1.1.0"` → `"version": "1.1.1"` (**patch**).
   - Rationale: model reassignment is a configuration change with no new skill, capability, or breaking instruction change — see Assumptions above and Skeptic's report for the counter-argument.

## Acceptance criteria

- [ ] `agents/oracle-to-postgres-migration-expert.agent.md` frontmatter `model:` field no longer references `4.6`.
- [ ] New `model:` value is a form consistent with sibling files in `agents/` (confirm with maintainer which exact string to use — see Open questions).
- [ ] No `reasoning:` field was added unless the maintainer explicitly asks for one after reviewing this plan.
- [ ] `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` is bumped from the current fork value.
- [ ] `npm run build`, `npm run plugin:validate`, and `npm run skill:validate` all pass with no new errors.
- [ ] No other file in the repo was touched.

## Skeptic's report

### Strengths

- **Minimal, low-risk diff** — a one-line frontmatter change plus a version bump is easy to review and easy to revert if Sonnet 5 behaves worse on this domain.
- **No instruction rot** — correctly resists the temptation to rewrite agent guidance "while we're in there"; the issue asked for exactly one thing.
- **Caught the reasoning-field trap** — recognizing that no `reasoning:` field convention exists anywhere in the repo, and choosing omission over inventing one, avoids introducing an unreviewed precedent.

### Concerns

- **Issue: the patch-vs-minor semver call is not obviously right.**
  **Why it matters**: a model swap can materially change the agent's actual behavior — tone, verbosity, tool-calling patterns, and quality of migration advice can all shift meaningfully between model generations, even with identical instructions. Calling this "patch" (wording-level) undersells that the agent's *effective behavior* is changing, which is closer to what "minor" is meant to signal in spirit, even though the plan's own rubric ties minor to "new capability or skill" rather than model swaps. The rubric as written doesn't cleanly cover this case.
  **Suggested fix**: flag this explicitly to the maintainer as an open question (see below) rather than silently picking patch; let them decide with the actual semver rubric intent in mind.
- **Issue: exact model string is a guess, not a verified value.**
  **Why it matters**: if "Claude Sonnet 5 (copilot)" is not a string the Copilot runtime actually recognizes, the agent could silently fall back to a default model or fail to load, and nobody would notice until it's used.
  **Suggested fix**: maintainer should verify the exact accepted model identifier in their Copilot CLI/VS Code model picker before merging, and the orchestrator implementing this plan should double check against any other repo file that's been *recently* updated with a Sonnet 5 reference for consistency.
- **Issue: no validation step confirms the new model string is actually usable.**
  **Why it matters**: `npm run build`/`plugin:validate` check structure and README generation, not whether `model:` resolves to a real, working model — a typo'd string would pass CI silently.
  **Suggested fix**: maintainer should manually invoke the agent once after merging to confirm it loads with the new model before considering the issue closed.

### Confidence

**Medium** — the file-level change is unambiguous and low-risk, but the exact model string and the semver bump level both rest on unverified assumptions that only the maintainer can confirm.

## Open questions

1. **Exact model string to use** — options: (a) `'Claude Sonnet 5 (copilot)'` (keeps existing `(copilot)` suffix style), (b) `'Claude Sonnet 5'` (no suffix, matches `technical-content-evaluator.agent.md`'s bare form... actually that one keeps the suffix too — matches `Claude Sonnet 4.5` used elsewhere), (c) `claude-sonnet-5` (bare lowercase-hyphenated, matching the fork-only `dev-orchestrator.agent.md`). **I would pick (a)** — most surgical, keeps this file's existing style.
2. **Semver bump level for `plugin.json`** — options: (a) patch (`1.1.0` → `1.1.1`, wording/config-only), (b) minor (`1.1.0` → `1.2.0`, treating a model swap as a capability-level change). **I would pick (a) patch**, but flag this is the plan's weakest assumption per the skeptic's top concern.
3. **Should a `reasoning:` field be added at all** — options: (a) omit entirely (my choice, since "default" already means "no override"), (b) add an explicit field naming a specific default value once one becomes a documented convention. **I would pick (a)**.

## Verification

- `npm run build` — regenerates README, confirms the agent still parses.
- `bash eng/fix-line-endings.sh` — normalize line endings before commit.
- `npm run skill:validate` — confirm no skill regressions (none expected, no skill files touched).
- `npm run plugin:validate` — confirm `plugin.json` version bump and structure are valid.
- Manual: load the agent in Copilot CLI/VS Code and confirm it starts under the new model string without falling back silently.
