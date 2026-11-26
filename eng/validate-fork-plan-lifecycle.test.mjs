import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyChangedPaths,
  entriesFromPullRequestFiles,
  changedPathsFromEntries,
  validateWorkflowSourceLockPairs,
  pullRequestsForIssue,
  isRelevantCategoryLabel,
  computePlanHash,
  extractIssueLink,
  parseApprovalComment,
  parsePlanContent,
  planHasOpenQuestions,
  validateMaintenanceLabel,
  validateApprovalEvidence,
  validatePlanningPullRequestBinding,
  validateClosingArmed,
  validatePlanDocument,
  validateCategoryLabels,
  categoryForPlanScope,
  buildCheckRunRequest,
  runGhJson,
  processPullRequests,
  validateToolingPlanStatus,
  shouldSkipLifecycleCheck,
  issueNumberFromEvent,
} from "./validate-fork-plan-lifecycle.mjs";

const APPROVED_HEADER = `---
issue: 66
title: 'Sample'
scope: agent
status: approved
lifecycle:
  schema: 1
  planHash: 'PLACEHOLDER'
  requirements:
    status: answered
  review:
    status: completed
    verdict: no-material-concerns
    evidence: 'https://example.com/review'
  approval:
    status: approved
    approver: 'maintainer'
    evidence: 'https://example.com/approve-comment'
---
`;

const APPROVED_BODY = `
## Open questions

**All questions are answered.**

- Q1 — answered.

## Decision record

| Question | Decision | Evidence |
|---|---|---|
| Q1 | Yes | link |

## Verification

- npm run build
`;

function buildApprovedPlan(overrides = {}) {
  const body = overrides.body ?? APPROVED_BODY;
  const hash = computePlanHash(body);
  const header = APPROVED_HEADER.replace("PLACEHOLDER", overrides.hash ?? hash);
  return header + body;
}

test("computePlanHash normalizes CRLF but preserves trailing bytes", () => {
  assert.equal(computePlanHash("body\r\n\r\n"), computePlanHash("body\n\n"));
  assert.notEqual(computePlanHash("body"), computePlanHash("body\n"));
  assert.notEqual(computePlanHash("body\n"), computePlanHash("body\n\n"));
  assert.notEqual(computePlanHash("body\n"), computePlanHash("body \n"));
});

// --- extractIssueLink ---

test("extractIssueLink accepts a native Refs issue link without a hidden marker", () => {
  const result = extractIssueLink("Some description.\n\nRefs #66\n");
  assert.deepEqual(result, { keyword: "Refs", issue: 66, errors: [] });
});

test("extractIssueLink accepts a Fixes marker", () => {
  const result = extractIssueLink("Fixes #66\n");
  assert.deepEqual(result, { keyword: "Fixes", issue: 66, errors: [] });
});

test("extractIssueLink rejects a body with neither marker", () => {
  const result = extractIssueLink("No marker here.");
  assert.equal(result.issue, null);
  assert.equal(result.errors.length, 1);
});

test("extractIssueLink rejects a body with both Refs and Fixes", () => {
  const result = extractIssueLink("Refs #66\nFixes #66\n");
  assert.equal(result.issue, null);
  assert.match(result.errors[0], /must not contain both/);
});

// --- classifyChangedPaths ---

test("classifyChangedPaths detects a planning-only PR", () => {
  const result = classifyChangedPaths([".github/fork-only/plans/issue-66-update-agent.md"], 66);
  assert.equal(result.mode, "planning");
  assert.deepEqual(result.errors, []);
});

test("classifyChangedPaths accepts a slugged plan filename", () => {
  const plan = ".github/fork-only/plans/issue-66-update-custom-agent-model.md";
  const result = classifyChangedPaths([plan], 66);
  assert.equal(result.mode, "planning");
  assert.equal(result.planFile, plan);
  assert.deepEqual(result.errors, []);
});

test("classifyChangedPaths resolves an unchanged slugged plan for an implementation PR", () => {
  const plan = ".github/fork-only/plans/issue-66-update-custom-agent-model.md";
  const result = classifyChangedPaths(
    ["agents/oracle-to-postgres-migration-expert.agent.md"],
    66,
    [plan]
  );
  assert.equal(result.mode, "implementation");
  assert.equal(result.planFile, plan);
  assert.deepEqual(result.errors, []);
});

test("classifyChangedPaths rejects multiple plan files for one issue", () => {
  const result = classifyChangedPaths(
    [".github/fork-only/plans/issue-66-update-model.md"],
    66,
    [
      ".github/fork-only/plans/issue-66-update-agent.md",
      ".github/fork-only/plans/issue-66-update-model.md",
    ]
  );
  assert.equal(result.mode, "planning");
  assert.ok(result.errors.some((error) => /multiple plan files for issue #66/.test(error)));
});

test("classifyChangedPaths counts repeated plan paths only once", () => {
  const plan = ".github/fork-only/plans/issue-66-update-agent.md";
  for (const changedFiles of [[plan], [plan, "eng/fork-example.mjs"]]) {
    const result = classifyChangedPaths(changedFiles, 66, [plan, plan.replace(/\//g, "\\")]);
    assert.deepEqual(result.errors, []);
    assert.equal(result.planFile, plan);
  }
});

test("classifyChangedPaths detects an implementation PR", () => {
  const result = classifyChangedPaths(
    ["agents/oracle-to-postgres-migration-expert.agent.md", ".github/fork-only/plans/issue-66-update-agent.md"],
    66
  );
  assert.equal(result.mode, "implementation");
  assert.deepEqual(result.errors, []);
});

test("classifyChangedPaths detects a tooling implementation PR with a matching plan", () => {
  const plan = ".github/fork-only/plans/issue-132-upstream-bundler.md";
  const result = classifyChangedPaths(
    [
      plan,
      ".github/workflows/fork-bundle-upstream-pr.yml",
      "eng/fork-bundle-upstream-pr.test.mjs",
      ".github/fork-only/README.md",
    ],
    132
  );
  assert.equal(result.mode, "tooling");
  assert.equal(result.planFile, plan);
  assert.deepEqual(result.errors, []);
});

test("classifyChangedPaths rejects unsupported paths bundled with tooling", () => {
  const result = classifyChangedPaths(
    [
      ".github/fork-only/plans/issue-132-upstream-bundler.md",
      ".github/workflows/fork-bundle-upstream-pr.yml",
      "docs/other.md",
    ],
    132
  );
  assert.equal(result.mode, "tooling");
  assert.ok(result.errors.some((error) => /approved tooling paths/.test(error)));
});

test("classifyChangedPaths keeps lifecycle-maintenance files out of tooling PRs", () => {
  const result = classifyChangedPaths(
    [
      ".github/fork-only/plans/issue-132-upstream-bundler.md",
      ".github/workflows/fork-bundle-upstream-pr.yml",
      ".github/workflows/fork-plan-lifecycle-check.yml",
      ".github/fork-only/README.md",
    ],
    132
  );
  assert.equal(result.mode, "tooling");
  assert.ok(result.errors.some((error) => /must not bundle lifecycle-maintenance paths/.test(error)));
});

test("classifyChangedPaths rejects implementation changes mixed with tooling", () => {
  const result = classifyChangedPaths(
    [
      "agents/oracle-to-postgres-migration-expert.agent.md",
      ".github/workflows/fork-bundle-upstream-pr.yml",
    ],
    132,
    [".github/fork-only/plans/issue-132-upstream-bundler.md"]
  );
  assert.equal(result.mode, "implementation");
  assert.ok(result.errors.some((error) => /must not bundle lifecycle tooling/.test(error)));
});

test("classifyChangedPaths leaves a README-only change in maintenance mode", () => {
  const result = classifyChangedPaths([".github/fork-only/README.md"], 132);
  assert.equal(result.mode, "maintenance");
  assert.deepEqual(result.errors, []);
});

test("classifyChangedPaths rejects fork-tooling leaks on an implementation PR", () => {
  const result = classifyChangedPaths(
    ["agents/oracle-to-postgres-migration-expert.agent.md", ".github/fork-only/README.md"],
    66
  );
  assert.equal(result.mode, "implementation");
  assert.ok(result.errors.some((error) => /may only touch the matching plan file/.test(error)));
});

test("pull request file entries retain both paths for renamed files", () => {
  const entries = entriesFromPullRequestFiles([
    {
      status: "renamed",
      previous_filename: ".github/workflows/fork-old.md",
      filename: ".github/workflows/fork-new.md",
    },
    { status: "modified", filename: "README.md" },
  ]);
  assert.deepEqual(entries, [
    { status: "R100", oldPath: ".github/workflows/fork-old.md", newPath: ".github/workflows/fork-new.md" },
    { status: "modified", path: "README.md" },
  ]);
  assert.deepEqual(changedPathsFromEntries(entries), [
    ".github/workflows/fork-old.md",
    ".github/workflows/fork-new.md",
    "README.md",
  ]);
});

test("workflow source and lock pair validation requires both changed paths", () => {
  assert.equal(
    validateWorkflowSourceLockPairs([
      { status: "M", path: ".github/workflows/fork-agent.md" },
      { status: "M", path: ".github/workflows/fork-agent.lock.yml" },
    ]).length,
    0
  );
  assert.equal(
    validateWorkflowSourceLockPairs([
      { status: "R100", oldPath: ".github/workflows/fork-old.md", newPath: ".github/workflows/fork-new.md" },
      { status: "R100", oldPath: ".github/workflows/fork-old.lock.yml", newPath: ".github/workflows/fork-new.lock.yml" },
    ]).length,
    0
  );
  assert.equal(
    validateWorkflowSourceLockPairs([{ status: "M", path: ".github/workflows/fork-agent.md" }]).length,
    1
  );
  assert.equal(
    validateWorkflowSourceLockPairs([{ status: "M", path: ".github/workflows/fork-agent.lock.yml" }]).length,
    1
  );
});

test("classifyChangedPaths flags unrelated changes", () => {
  const result = classifyChangedPaths(["README.md"], 66);
  assert.equal(result.mode, "unrelated");
  assert.deepEqual(result.errors, []);
});

test("classifyChangedPaths allows only lifecycle-maintenance paths in maintenance mode", () => {
  const result = classifyChangedPaths(
    [
      "eng/validate-fork-plan-lifecycle.mjs",
      ".github/workflows/fork-plan-lifecycle-check.yml",
      ".github/fork-only/plans/README.md",
    ],
    null
  );
  assert.equal(result.mode, "maintenance");
  assert.deepEqual(result.errors, []);
});

test("classifyChangedPaths treats planner source and compiled workflow as maintenance paths", () => {
  const result = classifyChangedPaths(
    [
      ".github/workflows/fork-issue-planner.md",
      ".github/workflows/fork-issue-planner.lock.yml",
    ],
    null
  );
  assert.equal(result.mode, "maintenance");
  assert.deepEqual(result.errors, []);
});

test("classifyChangedPaths rejects non-allowlisted files bundled with maintenance changes", () => {
  const result = classifyChangedPaths(
    ["eng/validate-fork-plan-lifecycle.mjs", "README.md"],
    null
  );
  assert.equal(result.mode, "maintenance");
  assert.ok(result.errors.some((error) => /explicit lifecycle maintenance allowlist/.test(error)));
});

test("classifyChangedPaths does not permit implementation changes through maintenance mode", () => {
  const result = classifyChangedPaths(
    [
      "eng/validate-fork-plan-lifecycle.mjs",
      "agents/oracle-to-postgres-migration-expert.agent.md",
    ],
    null
  );
  assert.equal(result.mode, "implementation");
  assert.ok(result.errors.some((error) => /must not bundle lifecycle tooling changes/.test(error)));
});

test("validateMaintenanceLabel requires the dedicated label only in maintenance mode", () => {
  assert.equal(validateMaintenanceLabel({ mode: "maintenance", labels: [] }).length, 1);
  assert.deepEqual(
    validateMaintenanceLabel({
      mode: "maintenance",
      labels: ["fork-lifecycle-maintenance"],
    }),
    []
  );
  assert.deepEqual(validateMaintenanceLabel({ mode: "implementation", labels: [] }), []);
});

test("categoryForPlanScope maps only supported in-scope categories", () => {
  assert.equal(categoryForPlanScope("fork-tooling"), "fork-workflow");
  assert.equal(categoryForPlanScope("agent"), "o2p-plugin-enhancements");
  assert.equal(categoryForPlanScope("out-of-scope"), null);
});

test("validateCategoryLabels requires exactly one matching issue and PR category", () => {
  assert.deepEqual(
    validateCategoryLabels({
      mode: "planning",
      scope: "fork-tooling",
      issueLabels: ["fork-workflow"],
      pullRequestLabels: ["fork-workflow", "fork-automation"],
    }),
    []
  );
  assert.deepEqual(
    validateCategoryLabels({
      mode: "tooling",
      scope: "fork-tooling",
      issueLabels: ["fork-workflow"],
      pullRequestLabels: ["fork-workflow", "fork-lifecycle-maintenance"],
    }),
    []
  );
  assert.deepEqual(
    validateCategoryLabels({
      mode: "maintenance",
      issueLabels: ["fork-workflow"],
      pullRequestLabels: ["fork-workflow", "fork-lifecycle-maintenance"],
    }),
    []
  );
  assert.ok(
    validateCategoryLabels({
      mode: "implementation",
      scope: "agent",
      issueLabels: ["fork-workflow", "o2p-plugin-enhancements"],
      pullRequestLabels: ["o2p-plugin-enhancements"],
    }).some((error) => /Issue must have exactly/.test(error))
  );
  assert.ok(
    validateCategoryLabels({
      mode: "implementation",
      scope: "agent",
      issueLabels: ["o2p-plugin-enhancements"],
      pullRequestLabels: ["fork-workflow"],
    }).some((error) => /Pull request must have exactly/.test(error))
  );
});

test("out-of-scope plans require no fork category labels", () => {
  assert.deepEqual(
    validateCategoryLabels({
      mode: "planning",
      scope: "out-of-scope",
      issueLabels: ["fork-automation"],
      pullRequestLabels: ["fork-automation"],
    }),
    []
  );
  assert.ok(
    validateCategoryLabels({
      mode: "planning",
      scope: "out-of-scope",
      issueLabels: ["fork-workflow"],
      pullRequestLabels: [],
    }).some((error) => /must not carry fork category/.test(error))
  );
});

test("issue-link selection and planner label revalidation are narrowly scoped", () => {
  const linked = pullRequestsForIssue([
    { number: 1, body: "Refs #66" },
    { number: 2, body: "Fixes #67" },
    { number: 3, body: "Refs #66 and Fixes #68" },
    { number: 4, body: "Refs #66\nFixes #66" },
  ], 66);
  assert.deepEqual(linked.map((pr) => pr.number), [1]);
  assert.equal(isRelevantCategoryLabel("fork-workflow"), true);
  assert.equal(isRelevantCategoryLabel("o2p-plugin-enhancements"), true);
  assert.equal(isRelevantCategoryLabel("fork-workflow"), true);
  assert.equal(isRelevantCategoryLabel("fork-lifecycle-maintenance"), false);
  assert.equal(isRelevantCategoryLabel("documentation"), false);
  assert.equal(issueNumberFromEvent("issues", { issue: { number: 66 } }), 66);
  assert.equal(issueNumberFromEvent("workflow_dispatch", { inputs: { issue_number: "67" } }), 67);
  assert.equal(shouldSkipLifecycleCheck("pull_request", ["fork-sync"]), true);
  assert.equal(shouldSkipLifecycleCheck("pull_request", ["fork-workflow"]), false);
  assert.equal(shouldSkipLifecycleCheck("issues", ["fork-sync"]), false);
});

test("check-run requests target each linked PR head and update existing runs safely", () => {
  const first = buildCheckRunRequest({
    owner: "owner",
    repo: "repo",
    pullRequest: { number: 12, headRefOid: "sha-12", url: "https://github.com/owner/repo/pull/12" },
    errors: [],
    completedAt: "2025-01-01T00:00:00.000Z",
  });
  const second = buildCheckRunRequest({
    owner: "owner",
    repo: "repo",
    pullRequest: { number: 13, headRefOid: "sha-13", url: "https://github.com/owner/repo/pull/13" },
    errors: ["bad labels"],
    completedAt: "2025-01-01T00:00:00.000Z",
  });
  assert.equal(first.method, "POST");
  assert.equal(first.endpoint, "repos/owner/repo/check-runs");
  assert.equal(first.payload.head_sha, "sha-12");
  assert.equal(first.payload.conclusion, "success");
  assert.equal(first.payload.completed_at, "2025-01-01T00:00:00.000Z");
  assert.equal(second.endpoint, "repos/owner/repo/check-runs");
  assert.equal(second.payload.head_sha, "sha-13");
  assert.equal(second.payload.conclusion, "failure");
  assert.match(second.payload.output.summary, /bad labels/);

  const update = buildCheckRunRequest({
    owner: "owner",
    repo: "repo",
    pullRequest: { number: 12, headRefOid: "sha-12", url: "https://github.com/owner/repo/pull/12" },
    existing: { id: 99 },
    errors: [],
    completedAt: "2025-01-01T00:00:00.000Z",
  });
  assert.equal(update.method, "PATCH");
  assert.equal(update.endpoint, "repos/owner/repo/check-runs/99");
  assert.equal("head_sha" in update.payload, false);
});

test("GitHub API reads remain GET when query fields are present", () => {
  for (const args of [
    ["repos/owner/repo/contents/plan.md", "-f", "ref=sha"],
    ["repos/owner/repo/commits/sha/check-runs", "--paginate", "--slurp", "-F", "per_page=100"],
  ]) {
    const output = runGhJson(args, (command, actualArgs) => {
      assert.equal(command, "gh");
      assert.deepEqual(actualArgs, ["api", "--method", "GET", ...args]);
      return '{"ok":true}';
    });
    assert.deepEqual(output, { ok: true });
  }
});

test("tooling requires an approved plan even with Refs, unlike maintenance", () => {
  assert.match(validateToolingPlanStatus("tooling", "draft")[0], /approved plan/);
  assert.deepEqual(validateToolingPlanStatus("tooling", "approved"), []);
  assert.deepEqual(validateToolingPlanStatus("maintenance", "draft"), []);
});

test("revalidation publishes read failures and continues after publishing failures", async () => {
  const checks = [];
  const comments = [];
  const result = await processPullRequests({
    owner: "owner",
    repo: "repo",
    pullRequests: [{ number: 1 }, { number: 2 }, { number: 3 }],
    validate: async ({ pullRequest }) => {
      if (pullRequest.number === 1) throw new Error("issue labels unavailable");
      return { errors: [] };
    },
    publishCheck: async ({ pullRequest, errors }) => {
      checks.push({ number: pullRequest.number, errors });
      if (pullRequest.number === 2) throw new Error("check lookup failed");
      return [];
    },
    publishComment: async ({ pullRequest, errors }) => {
      comments.push({ number: pullRequest.number, errors });
      return [];
    },
  });
  assert.match(checks[0].errors[0], /issue labels unavailable/);
  assert.deepEqual(checks.map(({ number }) => number), [1, 2, 3]);
  assert.deepEqual(comments.map(({ number }) => number), [1, 2, 3]);
  assert.ok(result.some((error) => /PR #1:.*issue labels unavailable/.test(error)));
  assert.ok(result.some((error) => /PR #2: check lookup failed/.test(error)));
});

// --- planHasOpenQuestions ---

test("planHasOpenQuestions detects Q markers", () => {
  assert.equal(planHasOpenQuestions("## Open questions\n\n- Q1 — foo\n\n## Plan\n"), true);
});

test("planHasOpenQuestions returns false when there are none", () => {
  assert.equal(planHasOpenQuestions("## Open questions\n\nNone.\n\n## Plan\n"), false);
});

// --- validatePlanDocument ---

test("validatePlanDocument accepts a fully-populated approved plan", () => {
  const { frontmatter, body } = parsePlanContent(buildApprovedPlan());
  const errors = validatePlanDocument({ frontmatter, body, issueNumber: 66 });
  assert.deepEqual(errors, []);
});

test("validatePlanDocument accepts a draft plan with no lifecycle block", () => {
  const content = `---
issue: 66
title: 'Sample'
scope: agent
status: draft
---

## Open questions

None.
`;
  const { frontmatter, body } = parsePlanContent(content);
  const errors = validatePlanDocument({ frontmatter, body, issueNumber: 66 });
  assert.deepEqual(errors, []);
});

test("validatePlanDocument rejects a draft plan whose lifecycle claims approval", () => {
  const content = `---
issue: 66
title: 'Sample'
scope: agent
status: draft
lifecycle:
  approval:
    status: approved
---
Body.
`;
  const { frontmatter, body } = parsePlanContent(content);
  const errors = validatePlanDocument({ frontmatter, body, issueNumber: 66 });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /must be consistent/);
});

test("validatePlanDocument rejects an approved plan with no lifecycle block", () => {
  const content = `---
issue: 66
title: 'Sample'
scope: agent
status: approved
---
Body.
`;
  const { frontmatter, body } = parsePlanContent(content);
  const errors = validatePlanDocument({ frontmatter, body, issueNumber: 66 });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no "lifecycle" frontmatter block/);
});

test("validatePlanDocument rejects a plan-hash mismatch after edits", () => {
  const { frontmatter, body } = parsePlanContent(buildApprovedPlan({ hash: "sha256:deadbeef" }));
  const errors = validatePlanDocument({ frontmatter, body, issueNumber: 66 });
  assert.ok(errors.some((e) => /does not match the plan's current content/.test(e)));
});

test("validatePlanDocument rejects missing Verification section", () => {
  const bodyWithoutVerification = APPROVED_BODY.replace(/## Verification[\s\S]*$/, "");
  const { frontmatter, body } = parsePlanContent(buildApprovedPlan({ body: bodyWithoutVerification }));
  const errors = validatePlanDocument({ frontmatter, body, issueNumber: 66 });
  assert.ok(errors.some((e) => /must have a "## Verification" section/.test(e)));
});

test("validatePlanDocument rejects unanswered open questions without a decision record", () => {
  const bodyWithoutDecisionRecord = `
## Open questions

- Q1 — still open.

## Verification

- npm run build
`;
  const { frontmatter, body } = parsePlanContent(buildApprovedPlan({ body: bodyWithoutDecisionRecord }));
  const errors = validatePlanDocument({ frontmatter, body, issueNumber: 66 });
  assert.ok(errors.some((e) => /Decision record/.test(e)));
});

test("validatePlanDocument rejects a mismatched issue number", () => {
  const { frontmatter, body } = parsePlanContent(buildApprovedPlan());
  const errors = validatePlanDocument({ frontmatter, body, issueNumber: 999 });
  assert.ok(errors.some((e) => /does not match the tracking issue/.test(e)));
});

// --- parseApprovalComment ---

test("parseApprovalComment accepts only the exact short phrase", () => {
  assert.deepEqual(parseApprovalComment("  Approve plan \n"), { approved: true });
  assert.deepEqual(parseApprovalComment("APPROVE PLAN"), { approved: true });
  assert.equal(parseApprovalComment("Approve plan #66"), null);
  assert.equal(parseApprovalComment("/approve-plan\nIssue: #66"), null);
  assert.equal(parseApprovalComment("Looks good to me!"), null);
});

// --- validateApprovalEvidence ---

test("validateApprovalEvidence accepts the linked exact owner comment on the PR", () => {
  const errors = validateApprovalEvidence({
    lifecycle: {
      approval: {
        status: "approved",
        approver: "maintainer",
        evidence: "https://github.com/owner/repo/pull/66#issuecomment-1",
      },
      review: { status: "completed" },
    },
    issueNumber: 66,
    comments: [
      {
        author: "maintainer",
        body: "Approve plan",
        url: "https://github.com/owner/repo/pull/66#issuecomment-1",
      },
    ],
    ownerLogin: "maintainer",
  });
  assert.deepEqual(errors, []);
});

test("validateApprovalEvidence rejects a comment from a non-owner", () => {
  const errors = validateApprovalEvidence({
    lifecycle: {
      approval: {
        status: "approved",
        approver: "maintainer",
        evidence: "https://github.com/owner/repo/pull/66#issuecomment-1",
      },
      review: { status: "completed" },
    },
    issueNumber: 66,
    comments: [
      {
        author: "rando",
        body: "Approve plan",
        url: "https://github.com/owner/repo/pull/66#issuecomment-1",
      },
    ],
    ownerLogin: "maintainer",
  });
  assert.ok(errors.some((error) => /No exact "Approve plan" comment/.test(error)));
});

test("validateApprovalEvidence requires the evidence URL to identify the exact comment", () => {
  const errors = validateApprovalEvidence({
    lifecycle: {
      approval: {
        status: "approved",
        approver: "maintainer",
        evidence: "https://github.com/owner/repo/pull/66#issuecomment-2",
      },
      review: { status: "completed" },
    },
    issueNumber: 66,
    comments: [
      {
        author: "maintainer",
        body: "Approve plan",
        url: "https://github.com/owner/repo/pull/66#issuecomment-1",
      },
    ],
    ownerLogin: "maintainer",
  });
  assert.ok(errors.some((error) => /No exact "Approve plan" comment/.test(error)));
});

test("validateApprovalEvidence is a no-op when the plan is not approved", () => {
  const errors = validateApprovalEvidence({
    lifecycle: { approval: { status: "pending" } },
    issueNumber: 66,
    comments: [],
    ownerLogin: "maintainer",
  });
  assert.deepEqual(errors, []);
});

test("validateApprovalEvidence rejects approval when the recorded approver is not the owner", () => {
  const errors = validateApprovalEvidence({
    lifecycle: {
      approval: {
        status: "approved",
        approver: "rando",
        evidence: "https://github.com/owner/repo/pull/66#issuecomment-1",
      },
      review: { status: "completed" },
    },
    issueNumber: 66,
    comments: [],
    ownerLogin: "maintainer",
  });
  assert.ok(errors.some((error) => /approver must match the repository owner/.test(error)));
});

test("validatePlanningPullRequestBinding requires the matching merged planning PR", () => {
  const lifecycle = {
    approval: {
      status: "approved",
      evidence: "https://github.com/owner/repo/pull/12#issuecomment-99",
    },
  };
  assert.deepEqual(validatePlanningPullRequestBinding({
    lifecycle,
    issueNumber: 66,
    planFile: ".github/fork-only/plans/issue-66-sample.md",
    planningPullRequest: {
      number: 12,
      baseRefName: "main",
      mergedAt: "2026-01-01T00:00:00Z",
      body: "Plan\n\nRefs #66\n",
      files: [".github/fork-only/plans/issue-66-sample.md"],
    },
  }), []);
  assert.ok(validatePlanningPullRequestBinding({
    lifecycle,
    issueNumber: 66,
    planFile: ".github/fork-only/plans/issue-66-sample.md",
    planningPullRequest: {
      number: 12,
      baseRefName: "main",
      mergedAt: null,
      body: "Plan\n\nRefs #67\n",
      files: [],
    },
  }).length >= 3);
});

test("an open planning PR may validate its own approval, but cannot approve other PRs", () => {
  const lifecycle = {
    approval: { status: "approved", evidence: "https://github.com/owner/repo/pull/12#issuecomment-99" },
  };
  const params = {
    lifecycle,
    issueNumber: 66,
    planFile: ".github/fork-only/plans/issue-66-sample.md",
    planningPullRequest: {
      number: 12,
      baseRefName: "main",
      mergedAt: null,
      body: "Refs #66",
      files: [".github/fork-only/plans/issue-66-sample.md"],
    },
  };
  assert.deepEqual(validatePlanningPullRequestBinding({ ...params, mode: "planning", pullRequestNumber: 12 }), []);
  for (const [mode, pullRequestNumber] of [
    ["planning", 13],
    ["implementation", 12],
    ["tooling", 13],
    ["maintenance", 13],
  ]) {
    assert.ok(validatePlanningPullRequestBinding({ ...params, mode, pullRequestNumber })
      .some((error) => /must be merged/.test(error)));
  }
  assert.ok(validatePlanningPullRequestBinding({
    ...params,
    mode: "planning",
    pullRequestNumber: 12,
    planningPullRequest: { ...params.planningPullRequest, body: "Refs #67" },
  }).some((error) => /Refs #66/.test(error)));
});

// --- validateClosingArmed ---

test("validateClosingArmed rejects Fixes on a planning-only PR", () => {
  const errors = validateClosingArmed({
    mode: "planning",
    keyword: "Fixes",
    planStatus: "approved",
    closingIssuesReferences: null,
    issueNumber: 66,
    otherOpenClosingPrNumbers: [],
  });
  assert.ok(errors.some((e) => /Planning-only PRs/.test(e)));
});

test("validateClosingArmed rejects Fixes before plan approval", () => {
  const errors = validateClosingArmed({
    mode: "implementation",
    keyword: "Fixes",
    planStatus: "draft",
    closingIssuesReferences: [66],
    issueNumber: 66,
    otherOpenClosingPrNumbers: [],
  });
  assert.ok(errors.some((e) => /only be used once the linked plan/.test(e)));
});

test("validateClosingArmed rejects Fixes when GitHub does not report the closing reference", () => {
  const errors = validateClosingArmed({
    mode: "implementation",
    keyword: "Fixes",
    planStatus: "approved",
    closingIssuesReferences: [999],
    issueNumber: 66,
    otherOpenClosingPrNumbers: [],
  });
  assert.ok(errors.some((e) => /does not report this PR as closing/.test(e)));
});

test("validateClosingArmed rejects Fixes when another open PR already closes the issue", () => {
  const errors = validateClosingArmed({
    mode: "implementation",
    keyword: "Fixes",
    planStatus: "approved",
    closingIssuesReferences: [66],
    issueNumber: 66,
    otherOpenClosingPrNumbers: [12],
  });
  assert.ok(errors.some((e) => /already armed to close/.test(e)));
});

test("validateClosingArmed accepts a fully valid Fixes on an approved implementation PR", () => {
  const errors = validateClosingArmed({
    mode: "implementation",
    keyword: "Fixes",
    planStatus: "approved",
    closingIssuesReferences: [66],
    issueNumber: 66,
    otherOpenClosingPrNumbers: [],
  });
  assert.deepEqual(errors, []);
});

test("validateClosingArmed applies the approved-plan checks to maintenance Fixes", () => {
  const errors = validateClosingArmed({
    mode: "maintenance",
    keyword: "Fixes",
    planStatus: "approved",
    closingIssuesReferences: [66],
    issueNumber: 66,
    otherOpenClosingPrNumbers: [],
  });
  assert.deepEqual(errors, []);
  assert.ok(validateClosingArmed({
    mode: "maintenance",
    keyword: "Fixes",
    planStatus: "draft",
    closingIssuesReferences: [66],
    issueNumber: 66,
    otherOpenClosingPrNumbers: [],
  }).some((error) => /only be used once/.test(error)));
});

test("validateClosingArmed fails closed if closing references could not be verified", () => {
  const errors = validateClosingArmed({
    mode: "tooling",
    keyword: "Fixes",
    planStatus: "approved",
    closingIssuesReferences: null,
    issueNumber: 66,
    otherOpenClosingPrNumbers: null,
  });
  assert.ok(errors.some((error) => /Could not verify whether GitHub/.test(error)));
  assert.ok(errors.some((error) => /Could not verify whether another open PR/.test(error)));
});

test("validateClosingArmed accepts Refs on an implementation PR regardless of plan status", () => {
  const errors = validateClosingArmed({
    mode: "implementation",
    keyword: "Refs",
    planStatus: "draft",
    closingIssuesReferences: null,
    issueNumber: 66,
    otherOpenClosingPrNumbers: [],
  });
  assert.deepEqual(errors, []);
});
