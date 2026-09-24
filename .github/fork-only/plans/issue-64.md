---
issue: 64
title: 'Update Custom Agent''s Model to GPT 6 Luna'
scope: agent
status: draft
---

## Issue summary

- **Requested behavior** — change the agent's `model:` frontmatter field in `agents/oracle-to-postgres-migration-expert.agent.md` to a value referred to as "GPT 6 Luna".
- **No canonical identifier exists in this repo** — nowhere in `agents/**`, `.github/agents/**`, or the docs does a model literally named "GPT 6 Luna" appear.
- **Closest hit is a fictional example, not a real model** — `website/src/content/docs/learning-hub/copilot-configuration-basics.md` line 458 lists illustrative "current models" for a docs walkthrough, including "**GPT-6 Astra** (OpenAI)" — a different name (**Astra**, not **Luna**) in a page that also invents "Claude Opus 5", "Claude Fable 5.1", "Grok 4.5/4.6", and "Gemini 3.7 Flash" as example filler text, not a real, resolvable model catalog.
- **Issue body is title-only** — `issue_read` returned no body text and zero comments, so there is no further detail, spelling, or source link to confirm "GPT 6 Luna" is real versus a title typo, a confusion with the docs' "GPT-6 Astra" example, or a placeholder for a not-yet-released model.

## Grilling

### Ambiguities

- **Model does not verifiably exist** — "GPT 6 Luna" appears nowhere as a working Copilot model identifier in this codebase; it may be a mishearing/misremembering of "GPT-6 Astra" (the only GPT-6-named string found, itself explicitly illustrative filler in a docs page).
- **Frontmatter format uncertain** — other agents use wildly inconsistent `model:` formats (bare string, quoted string, array of fallbacks, hyphenated slug like `claude-sonnet-5`); the issue gives no format preference.
- **No exchange rationale given** — the issue doesn't say why the current `claude-sonnet-5` (set by the just-closed issue #53) should change, or what capability gap motivates it.

### Scope

- **IN** — if the maintainer confirms a real, resolvable model identifier, update `model:` in `agents/oracle-to-postgres-migration-expert.agent.md` and bump `plugins/oracle-to-postgres-migration-expert/plugin.json` version, mirroring the pattern used for issue #53.
- **OUT** — inventing or guessing a plausible-sounding model string ("gpt-6-luna" or similar) and shipping it; a model change must not go in without maintainer confirmation that the identifier is real and Copilot-resolvable, because an invalid model string breaks the agent at runtime.
- **OUT** — any change to agent instructions, tools, skills, or other plugin metadata beyond the model field and version bump.
- **OUT** — editing the docs example in `copilot-configuration-basics.md`; that file is illustrative sample text elsewhere in the repo, unrelated to this agent, and out of the fork's promotion scope.

### Constraints

- **Upstream promotion rule** — `.github/fork-only/README.md`: `fork-bundle-upstream-pr` "fails hard if ... the version was not bumped," so any accepted model change requires `plugins/oracle-to-postgres-migration-expert/plugin.json` `version` to increase from the current `1.1.2`.
- **Runtime resolvability risk** — an unresolvable `model:` value causes the agent to fail to load or fall back silently in a Copilot client; this is the single biggest risk of proceeding without confirmation.
- **Precedent from issue #53** — that plan's acceptance criteria required "A Copilot client resolves `<value>` without an unsupported-model error" before considering the change done; the same bar applies here.
- **CONTRIBUTING.md / AGENTS.md conventions** — no explicit model-naming convention is documented repo-wide (existing agents use at least six different formatting styles), so format choice is a judgment call, not a hard rule.

### Assumptions I am making

- The issue title is the entire request; no hidden body/comment content exists (confirmed via `issue_read` — body absent, `get_comments` returned `[]`).
- "GPT 6 Luna" is not currently a real, Copilot-resolvable model identifier as far as this repository's own docs and agent files show; the closest real-looking match found is the docs' illustrative "GPT-6 Astra".
- The maintainer wants the same lightweight, single-scalar `model:` field pattern used for `claude-sonnet-5` (issue #53), not a fallback array, if and when a real identifier is confirmed.
- No skill or plugin content beyond `model:` and `version` needs to change for a model-only swap, consistent with the immediately prior issue #53 precedent for this same field.

## Plan

- **Blocked pending identifier confirmation** — no file edits can safely be planned yet because "GPT 6 Luna" is not a verified, resolvable model string; shipping a guess risks breaking the agent (see Constraints).
- **If confirmed real** — `agents/oracle-to-postgres-migration-expert.agent.md` (frontmatter, line 3): change `model: claude-sonnet-5` to the exact canonical identifier the maintainer confirms, using the same bare/unquoted scalar style already in place.
- **If confirmed real** — `plugins/oracle-to-postgres-migration-expert/plugin.json` (`version` field, currently `"1.1.2"`): bump to `"1.1.3"` — a **patch** bump, because a model swap with no new capability, skill, or behavior change is configuration correction, matching the patch-level precedent set by issue #53's `1.1.1` → `1.1.2` bump.
- **If the identifier turns out to be fictional/unavailable** — no code changes; close this plan as not-actionable and ask the maintainer for the real target model instead.

## Acceptance criteria

- [ ] The maintainer has confirmed, on issue #64, the exact real and Copilot-resolvable model identifier string to use (not "GPT 6 Luna" as literally written, unless independently verified to exist).
- [ ] The agent's `model:` field is exactly that confirmed identifier, in the same unquoted-scalar style as the current `claude-sonnet-5` value.
- [ ] The plugin version is bumped by exactly one patch level above the version in place when this change lands.
- [ ] No fields other than the agent model and plugin version differ from the pre-change files.
- [ ] `npm run build`, `npm run plugin:validate`, and `bash eng/fix-line-endings.sh` all pass cleanly.
- [ ] A Copilot client resolves the new model value without an unsupported-model error.

## Open questions

- **Q1 — does "GPT 6 Luna" exist?** — options: (a) it's a real, currently available Copilot model identifier the maintainer has direct access to, (b) it's confusion with the docs' illustrative "GPT-6 Astra" example, (c) it's a placeholder/typo and the maintainer meant a different model entirely. I would pick (b) as most likely, since "GPT-6 Astra" is the only GPT-6-named string anywhere in this repo and it explicitly appears in filler/example text, not a real catalog.
- **Q2 — exact identifier string and format** — if a real model exists, options: (a) a bare hyphenated slug like `claude-sonnet-5` (matches current value and the fork's two custom orchestration agents), (b) a quoted display name like `'Claude Sonnet 4.5'` (matches many other agents in `agents/**`), (c) an array with fallbacks like `dotnet-self-learning-architect.agent.md` uses. I would pick (a), for consistency with the value this exact field held immediately before this issue.
- **Q3 — proceed at all if unconfirmed?** — options: (a) wait for maintainer confirmation before any implementation, (b) implement a best-guess string now and let CI/runtime prove it wrong. I would pick (a); an unresolvable model value silently degrades or breaks the agent, and this plan intentionally ships no file changes until the maintainer confirms.

## Verification

- `npm run build` — regenerates README and marketplace data; confirms the plugin and agent still parse.
- `bash eng/fix-line-endings.sh` — normalizes line endings on any touched file.
- `npm run skill:validate` — no skills are touched by this change, but running it confirms nothing regressed.
- `npm run plugin:validate` — confirms `plugin.json` version bump and structure are valid once a real change is made.
- Manual: load the agent in a Copilot client and confirm the confirmed `model:` value resolves without an unsupported-model error.
