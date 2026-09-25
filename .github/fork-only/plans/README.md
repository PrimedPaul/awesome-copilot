# Plans

One file per issue: `issue-<N>.md`, written by the **Fork Issue Planner** workflow (`.github/workflows/fork-issue-planner.md`) when the repository owner opens an issue.

Each plan is an **advisory seed** — a first-round grilling, implementation plan, acceptance criteria, `Q<n>`-numbered open questions, and verification steps produced without human input. It is not a contract, and it is always written with `status: draft`.

Answer the open questions **on the issue** — that is the canonical channel for requirements, and the plan PR is for reviewing the plan and the implementation diff. Then check out the matching `plan/issue-<N>` branch and run the Development Orchestrator agent (`/agent` → `.github/agents/dev-orchestrator.agent.md`). It refuses to continue while any question is unanswered, records the answers in a `## Decision record` section with links to the issue comments, revises the plan, and dispatches `.github/agents/plan-reviewer.agent.md` for a concrete review verdict before asking for approval. If the reviewer cannot run or return a valid verdict, you must choose whether to retry or proceed without review. Older plans may contain a skeptic's report; that is historical context, not a required gate.

`status` goes to `approved` only after all three gates pass: every question answered, the review completed or explicitly waived, and your approval given. Answering the questions is not approval, and neither is a clean reviewer verdict.

The draft plan PR starts with `Refs #<N>`, so merging or abandoning an advisory plan cannot close the issue accidentally. After approval, implementation, validation, and self-review, the Development Orchestrator changes only that marked line to `Fixes #<N>` and verifies GitHub's `closingIssuesReferences`. GitHub then closes the issue as completed only if that implementation PR merges into `main`; closing the PR without merging leaves the issue open.

## Making `status: approved` executable

`status: approved` used to be an unenforced claim in a text file. The **Fork Plan Lifecycle Check** workflow (`.github/workflows/fork-plan-lifecycle-check.yml`, backed by `eng/validate-fork-plan-lifecycle.mjs`) now reads every plan touched by a PR and fails the PR if the claim isn't backed by machine-checkable evidence. A plan is not "read automatically" in the sense of driving behavior on its own — the orchestrator still decides what to do — but its `approved` claim is no longer taken on faith.

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
    evidence: '<link to your /approve-plan comment>'
```

`planHash` is the sha256 of the plan body (everything after the closing `---`), with line endings normalized. It pins the approval to an exact revision: if the plan changes afterward, the hash no longer matches and the check fails until you re-approve.

Your approval itself must be posted as a comment on the issue or the PR (not just an in-session confirmation), because that is the only durable, attributable record the CI check can verify:

```text
/approve-plan
Issue: #<N>
Plan-Hash: sha256:<same hash as lifecycle.planHash>
Review: completed
```

Use `Review: waived` plus a `Reason:` line instead of `completed` if you are explicitly skipping the Plan Reviewer dispatch. The check only accepts this comment from the repository owner and only when its issue number and hash match the plan's current frontmatter — a stale or copy-pasted approval fails closed.

The check also governs `Refs #<N>` → `Fixes #<N>`: an implementation PR may only carry `Fixes #<N>` once the linked plan is `approved` with valid lifecycle evidence, and only if GitHub's own `closingIssuesReferences` for that PR agrees and no other open PR already closes the same issue.

Plans are fork-only and are never promoted upstream.

The planner may only ever write `issue-*.md` in this directory — the workflow's `allowed-files` policy enforces it, so this README is out of its reach.
