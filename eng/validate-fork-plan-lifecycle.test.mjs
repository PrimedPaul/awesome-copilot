import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyChangedPaths,
  computePlanHash,
  extractIssueLink,
  parseApprovalComment,
  parsePlanContent,
  planHasOpenQuestions,
  validateMaintenanceLabel,
  validateApprovalEvidence,
  validateClosingArmed,
  validatePlanDocument,
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

test("classifyChangedPaths detects an implementation PR", () => {
  const result = classifyChangedPaths(
    ["agents/oracle-to-postgres-migration-expert.agent.md", ".github/fork-only/plans/issue-66-update-agent.md"],
    66
  );
  assert.equal(result.mode, "implementation");
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
