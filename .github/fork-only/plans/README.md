# Plans

One file per issue: `issue-<N>-<short-slug>.md`, written by the **Fork Issue Planner** workflow (`.github/workflows/fork-issue-planner.md`) when the repository owner opens an issue. The issue number is the stable identifier; the short lowercase hyphenated slug is for readability.

Each plan is an **advisory seed** — a first-round grilling, implementation plan, acceptance criteria, `Q<n>`-numbered open questions, and verification steps produced without human input. The questions also appear in the draft PR body. The seed is not a contract, and it is always written with `status: draft`.

Run the Development Orchestrator agent (`/agent` → `.github/agents/dev-orchestrator.agent.md`) on the matching `plan/issue-<N>-<short-slug>` branch. It reads the issue, plan, and PR; asks unresolved questions interactively; records your answers in a `## Decision record`; updates the plan on the PR; and dispatches `.github/agents/plan-reviewer.agent.md` for a concrete review verdict. If the reviewer cannot run or return a valid verdict, you choose whether to retry or proceed without review.

`status` goes to `approved` only after all three gates pass: every question answered, the review completed or explicitly waived, and your approval given. Answering the questions is not approval, and neither is a clean reviewer verdict.

The draft plan PR starts with a native `Refs #<N>` reference, so merging or abandoning an advisory plan cannot close the issue accidentally. After approval, implementation, validation, and self-review, the Development Orchestrator changes that line to `Fixes #<N>` (or adds the native reference if missing) and verifies GitHub's `closingIssuesReferences`. No hidden marker is required. GitHub closes the issue as completed only if that PR merges into `main`; closing the PR without merging leaves the issue open.

## Enforcing `status: approved`

The **Fork Plan Lifecycle Check** workflow (`.github/workflows/fork-plan-lifecycle-check.yml`, backed by `eng/validate-fork-plan-lifecycle.mjs`) validates every plan touched by a PR and fails the PR unless an `approved` claim is backed by machine-checkable evidence. The plan does not drive behavior on its own; the orchestrator determines what to do, while the check verifies the approval evidence.

An approved plan's frontmatter must include a `lifecycle` block:

```yaml
status: approved
lifecycle:
  schema: 1
  planHash: 'sha256:<hash of the plan body below this frontmatter>'
  requirements:
    status: answered
  review:
    status: completed        # or "waived"
    verdict: no-material-concerns   # or "material-concerns-resolved"; omit when waived
    evidence: '<link to the Plan Reviewer's verdict, e.g. a session/PR comment URL>'
  approval:
    status: approved
    approver: '<your GitHub login>'
    evidence: '<link to your exact "Approve plan" comment on the PR>'
```

`planHash` is the sha256 of the plan body (everything after the closing `---`), with CRLF line endings converted to LF and no other bytes changed. This preserves trailing blank lines, spaces, and whether the file ends with a newline. Generate the value with:

```sh
npm run fork:plan-hash -- .github/fork-only/plans/issue-<N>-<short-slug>.md
```

The orchestrator records the printed `sha256:<hex>` value in `lifecycle.planHash`; it is not part of the approval comment. It pins approval to the plan body shown for approval: if the plan changes while approval is pending or afterward, the hash no longer matches and the check fails until you re-review and re-approve.

Your approval itself must be posted as a comment on the **planning PR** (not just an in-session confirmation), because that is the durable, attributable record the CI check can verify. The entire trimmed comment body is:

```text
Approve plan
```

The orchestrator records the plan hash and your GitHub login in the lifecycle metadata; you do not copy hashes or fill in a command template. The check only accepts the exact phrase from the repository owner on the matching PR and still verifies the plan hash against its current body. If the plan body changes after approval, it must be reviewed and approved again. Reviewer waivers remain recorded with a reason in the lifecycle metadata.

The check also governs `Refs #<N>` → `Fixes #<N>`: an implementation PR may only carry `Fixes #<N>` once the linked plan is `approved` with valid lifecycle evidence, and only if GitHub's own `closingIssuesReferences` for that PR agrees and no other open PR already closes the same issue.

Pull requests labelled `fork-sync` skip this check. The Fork Sync Watchdog applies that label to its upstream sync PRs, which contain no plans but carry upstream's `package.json` without the fork's lifecycle scripts.

Plans are fork-only and are never promoted upstream.

## Lifecycle tooling maintenance

Changes limited to the lifecycle validator, its tests, its workflow, the planner workflow and compiled lock file, the related agents and documentation, and `package.json` use the focused tooling-maintenance path. A maintainer must apply the `fork-lifecycle-maintenance` label. The validator checks every changed path against an explicit allowlist; adding any implementation-agent, plugin, skill, or active issue-plan change takes the PR out of maintenance mode and restores the normal issue/approval gates. The workflow runs the lifecycle regression tests on every applicable PR and reruns when the maintenance label is added or removed.

The planner may only ever write `issue-*.md` in this directory — the workflow's `allowed-files` policy enforces it, so this README is out of its reach. When rerunning, it reuses the existing filename and branch; if multiple plan files match an issue, it stops rather than choosing one.
