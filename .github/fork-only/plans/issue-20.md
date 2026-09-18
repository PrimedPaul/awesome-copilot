---
issue: 20
title: 'Replace Model of the Oracle-to-Postgres Custom Agent'
scope: agent
status: draft
---

## Issue summary

- **Model deprecated** — the issue states the current agent model is "no longer supported."
- **Requested replacement** — switch to "Claude Sonnet 5.0 with its default reasoning setting."
- **No reasoning override implied** — "default reasoning setting" means: do not add any special reasoning/effort tuning, just use the model's normal behavior.
- **Single-field change as stated** — the issue names only the `model` field; it does not ask for prompt, tool, or behavior changes.

## Grilling

### Ambiguities

- **Exact model string unresolved** — the issue says "Claude Sonnet 5.0" but the current frontmatter uses `'Claude Sonnet 4.6 (copilot)'` (a display-style label with a `(copilot)` suffix), while `.github/fork-only/agents/dev-orchestrator.agent.md` uses the bare identifier `claude-sonnet-5`. No single canonical string format is enforced repo-wide — other agents use inconsistent styles (`'Claude Sonnet 4.6'`, `claude-sonnet-4-6`, `"claude-sonnet-4.6"`, `Claude Sonnet 4.5 (copilot)`).
- **"No longer supported" is unverified** — the issue asserts this but gives no error message, deprecation notice, or link. I cannot confirm whether Claude Sonnet 4.6 is actually deprecated in this environment or whether this is a preference change.
- **"Default reasoning setting" phrasing** — no agent file in this repo currently sets an explicit reasoning/effort frontmatter field (grepped `agents/*.agent.md` for `reasoning:`/`reasoning_effort:` — zero matches), so there is nothing to remove; the instruction is likely just clarifying "do not add reasoning tuning," not asking me to add or strip a field.

### Scope

- **IN** — updating the `model:` frontmatter field in `agents/oracle-to-postgres-migration-expert.agent.md` (line 3) to reference Claude Sonnet 5.
- **IN** — bumping `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` (currently `1.1.0`) per upstream promotion rules, since the agent file changes.
- **OUT** — any change to the agent's instructions, tools, phases, or working-directory conventions; the issue does not ask for behavioral changes.
- **OUT** — changes to any `skills/*oracle-to-postgres*/` folder; none are named in the issue and none reference the model.
- **OUT** — changes to `.github/fork-only/agents/dev-orchestrator.agent.md`'s own `model: claude-sonnet-5` field; it is fork-only tooling, never promoted upstream, and the issue is about the promotable agent, not the orchestrator.

### Constraints

- **Upstream promotion rule** — per `.github/fork-only/README.md`, the plugin `version` must be bumped whenever the agent file changes, or `fork-agent-reviewer`'s `version_check` job will fail.
- **CONTRIBUTING.md convention** — `model` field is "strongly recommended" for agent files (per repo AGENTS.md); no repo-wide enforced string format exists, so I default to matching this repo's most common convention for this exact agent (quoted, human-readable label).
- **Compatibility** — `tools:` array (`vscode/memory, vscode/runCommand, vscode/askQuestions, execute, read, edit, search, todo`) is model-agnostic; no downstream impact expected from a model-string-only change.
- **No functional regression risk** — since only the `model:` value changes, the agent's documented Migration Phases, guidelines, and working-directory conventions are unaffected.

### Assumptions I am making

- **Target string is `'Claude Sonnet 5.0 (copilot)'`** — following this exact agent's existing style (quoted, `(copilot)` suffix) rather than the bare `claude-sonnet-5` seen in the fork-only orchestrator, since the orchestrator's style is fork-tooling convention, not the promotable-agent convention.
- **"Default reasoning setting" requires no frontmatter change** — I am not adding a `reasoning:`/`reasoning_effort:` field, since no such field exists in this agent or its peers today, and the issue is asking me to *not* deviate from default, not to add an explicit setting.
- **This is a patch-level semver bump** — a model-string swap with no capability, skill, or behavior change is treated as a patch fix per the plan's own semver rule (see Plan section), not a minor/major bump.
- **The literal model name "Claude Sonnet 5.0"** in the issue is treated as equivalent to "Claude Sonnet 5" — the ".0" is assumed to be informal phrasing, not a distinct point-release identifier.

## Plan

- **File**: `agents/oracle-to-postgres-migration-expert.agent.md`
  - **Change**: line 3, frontmatter `model:` field.
  - **From**: `model: 'Claude Sonnet 4.6 (copilot)'`
  - **To**: `model: 'Claude Sonnet 5.0 (copilot)'`
  - **No other lines change** — description, tools, name, and body remain untouched.
- **File**: `plugins/oracle-to-postgres-migration-expert/plugin.json`
  - **Change**: `version` field.
  - **From**: `"1.1.0"`
  - **To**: `"1.1.1"`
  - **Semver level**: patch — a model swap is a maintenance/compatibility change, not a new capability (would be minor) or a behavior-breaking change (would be major). The agent's documented behavior, phases, and guidelines are unchanged.

## Acceptance criteria

- [ ] `agents/oracle-to-postgres-migration-expert.agent.md` frontmatter `model:` references Claude Sonnet 5 (exact string confirmed with maintainer — see Open Questions).
- [ ] No other frontmatter field or body content in the agent file changed.
- [ ] `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` bumped from `1.1.0` to `1.1.1` (patch).
- [ ] No skill folder under `skills/*oracle-to-postgres*/` modified.
- [ ] `npm run build`, `npm run plugin:validate`, and `bash eng/fix-line-endings.sh` all pass cleanly.
- [ ] PR diff touches exactly two files: the agent file and `plugin.json`.

## Skeptic's report

### Strengths

- **Minimal, surgical diff** — the plan touches exactly the field named in the issue plus the mandatory version bump; no scope creep into instructions or tools.
- **Traceable to repo convention** — the replacement string format matches this exact agent's pre-existing style rather than inventing a new convention.
- **Semver reasoning is explicit** — patch-level justification is stated and defensible against the "new capability" and "breaking change" thresholds.

### Concerns

- **Issue**: The exact target model string is a guess, not a verified fact.
  - **Why it matters**: If the maintainer's actual intended string is `claude-sonnet-5` (bare, matching the orchestrator) or some other exact identifier the platform expects, a wrong string could silently fail to resolve to the intended model at runtime, or could pass review only to be corrected later — wasted cycles either way.
  - **Suggested fix**: Confirm the exact string with the maintainer before implementing (see Open Questions) rather than the orchestrator guessing further.
- **Issue**: "No longer supported" is unverified — I have not confirmed Claude Sonnet 4.6 is actually deprecated in this environment.
  - **Why it matters**: If this is simply a preference and not a hard deprecation, the fork-agent-reviewer's domain review may reasonably ask "why now" — worth being ready with the issue's own justification rather than independently re-verifying model availability, which this planner cannot check.
  - **Suggested fix**: Treat the issue text as sufficient justification (owner-authored, first-party fork) and do not gate implementation on independent verification.
- **Issue**: Patch-vs-minor semver judgment call could be disputed.
  - **Why it matters**: Some maintainers treat any agent-file edit that changes runtime behavior (a different model can meaningfully change output quality/behavior) as at least a minor bump, even without new "capability" in the plugin-manifest sense.
  - **Suggested fix**: Flagged as an open question below; either level is defensible, but the maintainer should confirm before the orchestrator commits to one.

### Confidence

**High** — the requested change is narrow, unambiguous in intent, and the only real open item (exact model string) is a small, easily-answered detail that does not change the shape of the plan.

## Open questions

- **Exact model identifier string?** — Options: (a) `'Claude Sonnet 5.0 (copilot)'` (matches this agent's existing style), (b) `claude-sonnet-5` (bare, matches the fork-only orchestrator's style), (c) some other exact string the maintainer has seen work in their Copilot CLI/IDE model picker. **I would pick (a)** — consistency with this file's own pre-existing convention.
- **Patch or minor version bump?** — Options: (a) patch `1.1.1` (model swap, no behavior/capability change), (b) minor `1.2.0` (model change is treated as a meaningful behavioral shift). **I would pick (a)** — patch, per the reasoning in the Plan section.
- **Is "no longer supported" a hard deprecation or a preference?** — Options: (a) hard deprecation, no further action needed beyond the swap, (b) preference/quality upgrade, same action needed but worth noting in the PR body for the domain reviewer. **I would pick (a)** treat it as stated and proceed either way — the resulting file change is identical.

## Verification

- `npm run build` — regenerates README.md; confirms the agent still appears correctly listed.
- `bash eng/fix-line-endings.sh` — normalizes line endings on the two changed files.
- `npm run plugin:validate` — validates `plugin.json` schema and version field.
- `npm run skill:validate` — confirms no skill folders were inadvertently affected (should be a no-op here).
- Manual diff review — confirm exactly two files changed: the agent file (one line) and `plugin.json` (one line).
