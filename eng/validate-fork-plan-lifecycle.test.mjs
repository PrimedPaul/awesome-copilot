import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyChangedPaths,
  computePlanHash,
  extractIssueLink,
  parseApprovalComment,
  parsePlanContent,
  planHasOpenQuestions,
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

// --- extractIssueLink ---

test("extractIssueLink accepts a Refs marker", () => {
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
  const result = classifyChangedPaths([".github/fork-only/plans/issue-66.md"], 66);
  assert.equal(result.mode, "planning");
  assert.deepEqual(result.errors, []);
});

test("classifyChangedPaths detects an implementation PR", () => {
  const result = classifyChangedPaths(
    ["agents/oracle-to-postgres-migration-expert.agent.md", ".github/fork-only/plans/issue-66.md"],
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
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /may only touch the matching plan file/);
});

test("classifyChangedPaths flags unrelated changes", () => {
  const result = classifyChangedPaths(["README.md"], 66);
  assert.equal(result.mode, "unrelated");
  assert.equal(result.errors.length, 1);
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

test("parseApprovalComment ignores unrelated comments", () => {
  assert.equal(parseApprovalComment("Looks good to me!"), null);
});

test("parseApprovalComment parses a completed-review approval", () => {
  const parsed = parseApprovalComment(
    "/approve-plan\nIssue: #66\nPlan-Hash: sha256:abc123\nReview: completed\n"
  );
  assert.deepEqual(parsed, { issue: 66, hash: "sha256:abc123", review: "completed", reason: null });
});

test("parseApprovalComment parses a waived-review approval with a reason", () => {
  const parsed = parseApprovalComment(
    "/approve-plan\nIssue: #66\nPlan-Hash: sha256:abc123\nReview: waived\nReason: trivial doc fix\n"
  );
  assert.equal(parsed.review, "waived");
  assert.equal(parsed.reason, "trivial doc fix");
});

test("parseApprovalComment throws on a waived review with no reason", () => {
  assert.throws(
    () => parseApprovalComment("/approve-plan\nIssue: #66\nPlan-Hash: sha256:abc123\nReview: waived\n"),
    /must include a "Reason:"/
  );
});

test("parseApprovalComment throws when the issue line is missing", () => {
  assert.throws(
    () => parseApprovalComment("/approve-plan\nPlan-Hash: sha256:abc123\nReview: completed\n"),
    /Issue: #N/
  );
});

// --- validateApprovalEvidence ---

test("validateApprovalEvidence accepts a matching owner comment", () => {
  const errors = validateApprovalEvidence({
    lifecycle: { approval: { status: "approved" } },
    planHash: "sha256:abc123",
    issueNumber: 66,
    comments: [
      { author: "maintainer", body: "/approve-plan\nIssue: #66\nPlan-Hash: sha256:abc123\nReview: completed\n" },
    ],
    ownerLogin: "maintainer",
  });
  assert.deepEqual(errors, []);
});

test("validateApprovalEvidence rejects an approval comment from a non-owner", () => {
  const errors = validateApprovalEvidence({
    lifecycle: { approval: { status: "approved" } },
    planHash: "sha256:abc123",
    issueNumber: 66,
    comments: [
      { author: "rando", body: "/approve-plan\nIssue: #66\nPlan-Hash: sha256:abc123\nReview: completed\n" },
    ],
    ownerLogin: "maintainer",
  });
  assert.equal(errors.length >= 1, true);
});

test("validateApprovalEvidence rejects a hash mismatch", () => {
  const errors = validateApprovalEvidence({
    lifecycle: { approval: { status: "approved" } },
    planHash: "sha256:current",
    issueNumber: 66,
    comments: [
      { author: "maintainer", body: "/approve-plan\nIssue: #66\nPlan-Hash: sha256:stale\nReview: completed\n" },
    ],
    ownerLogin: "maintainer",
  });
  assert.equal(errors.length >= 1, true);
});

test("validateApprovalEvidence is a no-op when the plan is not approved", () => {
  const errors = validateApprovalEvidence({
    lifecycle: { approval: { status: "pending" } },
    planHash: "sha256:abc123",
    issueNumber: 66,
    comments: [],
    ownerLogin: "maintainer",
  });
  assert.deepEqual(errors, []);
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
