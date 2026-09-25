#!/usr/bin/env node
// Enforces the fork-only plan approval lifecycle described in
// .github/fork-only/plans/README.md: a plan must carry machine-readable
// evidence that requirements were answered, the plan was reviewed, and a
// maintainer approved it before an implementation PR is allowed to arm
// `Fixes #N`. See .github/fork-only/README.md for the full contract.
//
// This module is split in two layers on purpose:
//   - Pure functions (exported) that only look at already-fetched data
//     (plan text, PR body, comment lists). These are unit tested with
//     node:test and never touch git/GitHub.
//   - `main()` (not exported, only runs when this file is executed
//     directly) which gathers that data via `git` and the `gh` CLI, then
//     calls the pure functions and reports failures as GitHub Actions
//     `::error::` annotations.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import * as yaml from "js-yaml";
import { ROOT_FOLDER } from "./constants.mjs";

const FORK_ONLY_DIR = path.join(ROOT_FOLDER, ".github", "fork-only");
const PLANS_DIR = path.join(FORK_ONLY_DIR, "plans");
const LIFECYCLE_SCHEMA_VERSION = 1;

const VALID_STATUSES = new Set(["draft", "approved"]);
const VALID_REQUIREMENTS_STATUSES = new Set(["answered", "unanswered"]);
const VALID_REVIEW_STATUSES = new Set(["completed", "waived", "pending"]);
const VALID_REVIEW_VERDICTS = new Set([
  "no-material-concerns",
  "material-concerns-resolved",
]);
const VALID_APPROVAL_STATUSES = new Set(["approved", "pending"]);

// Implementation surface for the one agent this fork develops. Anything
// under these prefixes is "implementation"; anything else under
// .github/fork-only/ (other than the matching plan file) is "fork tooling".
const IMPLEMENTATION_PATH_PATTERNS = [
  /^agents\/oracle-to-postgres-migration-expert\.agent\.md$/,
  /^plugins\/oracle-to-postgres-migration-expert\//,
  /^skills\/[^/]*oracle-to-postgres[^/]*\//,
];

/**
 * Split a plan file's raw content into frontmatter text and body text.
 * @param {string} content - Raw file contents.
 * @returns {{frontmatterText: string, body: string}|null} Null if no frontmatter block is found.
 */
function splitFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { frontmatterText: match[1], body: match[2] };
}

/**
 * Compute the deterministic hash of a plan's body (everything after the
 * frontmatter). Line endings are normalized so the hash is stable across
 * checkouts with different `core.autocrlf` settings.
 * @param {string} body - Plan body text (no frontmatter).
 * @returns {string} Hash string prefixed with "sha256:".
 */
function computePlanHash(body) {
  const normalized = body.replace(/\r\n/g, "\n").replace(/\s+$/, "\n");
  const digest = crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
  return `sha256:${digest}`;
}

/**
 * Parse a plan file (path optional; content required) into frontmatter + body.
 * @param {string} content - Raw plan file contents.
 * @returns {{frontmatter: object, body: string}} Parsed plan.
 */
function parsePlanContent(content) {
  const split = splitFrontmatter(content);
  if (!split) {
    return { frontmatter: null, body: content };
  }
  let frontmatter;
  try {
    frontmatter = yaml.load(split.frontmatterText) || {};
  } catch (error) {
    throw new Error(`plan frontmatter is not valid YAML: ${error.message}`);
  }
  return { frontmatter, body: split.body };
}

/**
 * Extract the "Refs #N" / "Fixes #N" issue-closing marker from a PR body.
 * @param {string} prBody - Pull request description text.
 * @returns {{keyword: ("Refs"|"Fixes"|null), issue: (number|null), errors: string[]}}
 */
function extractIssueLink(prBody) {
  const errors = [];
  const body = prBody || "";
  const refsMatches = [...body.matchAll(/^\s*Refs #(\d+)\s*$/gim)];
  const fixesMatches = [...body.matchAll(/^\s*Fixes #(\d+)\s*$/gim)];

  if (refsMatches.length === 0 && fixesMatches.length === 0) {
    errors.push('PR body must contain a "Refs #N" or "Fixes #N" line linking the tracking issue.');
    return { keyword: null, issue: null, errors };
  }
  if (refsMatches.length > 0 && fixesMatches.length > 0) {
    errors.push('PR body must not contain both a "Refs #N" line and a "Fixes #N" line.');
    return { keyword: null, issue: null, errors };
  }
  const matches = fixesMatches.length > 0 ? fixesMatches : refsMatches;
  const keyword = fixesMatches.length > 0 ? "Fixes" : "Refs";
  const issues = new Set(matches.map((m) => Number(m[1])));
  if (issues.size > 1) {
    errors.push(`PR body must reference exactly one issue, found: ${[...issues].join(", ")}.`);
    return { keyword, issue: null, errors };
  }
  return { keyword, issue: [...issues][0], errors };
}

/**
 * Classify the changed files of a PR relative to the fork's plan lifecycle.
 * @param {string[]} changedFiles - Repo-relative changed file paths (forward slashes).
 * @param {number} issueNumber - Tracking issue number from the PR body marker.
 * @returns {{mode: ("planning"|"implementation"|"unrelated"), planFile: string, errors: string[]}}
 */
function classifyChangedPaths(changedFiles, issueNumber) {
  const errors = [];
  const planRelative = `.github/fork-only/plans/issue-${issueNumber}.md`;
  const normalized = changedFiles.map((f) => f.replace(/\\/g, "/"));

  const hasPlanChange = normalized.includes(planRelative);
  const hasImplementationChange = normalized.some((f) =>
    IMPLEMENTATION_PATH_PATTERNS.some((pattern) => pattern.test(f))
  );
  const forkToolingLeaks = normalized.filter(
    (f) => f.startsWith(".github/fork-only/") && f !== planRelative
  );

  let mode = "unrelated";
  if (hasImplementationChange) {
    mode = "implementation";
  } else if (hasPlanChange) {
    mode = "planning";
  }

  if (mode === "implementation" && forkToolingLeaks.length > 0) {
    errors.push(
      `Implementation PRs may only touch the matching plan file under .github/fork-only/plans/; ` +
        `also found changes to: ${forkToolingLeaks.join(", ")}.`
    );
  }
  if (mode === "unrelated") {
    errors.push(
      `No changes found under the implementation surface or ${planRelative}; nothing for the lifecycle check to validate.`
    );
  }

  return { mode, planFile: planRelative, errors };
}

/**
 * Detect whether a plan's "## Open questions" section lists real questions
 * (as opposed to declaring there are none).
 * @param {string} body - Plan body text.
 * @returns {boolean}
 */
function planHasOpenQuestions(body) {
  const match = body.match(/##\s*Open questions\s*\r?\n([\s\S]*?)(?:\r?\n##\s|$)/i);
  if (!match) return false;
  return /\bQ\d+\b/.test(match[1]);
}

/**
 * Validate the lifecycle frontmatter block and required plan sections.
 * @param {object} params
 * @param {object|null} params.frontmatter - Parsed plan frontmatter.
 * @param {string} params.body - Plan body text (no frontmatter).
 * @param {number} params.issueNumber - Expected `issue:` value.
 * @returns {string[]} Validation errors (empty when valid).
 */
function validatePlanDocument({ frontmatter, body, issueNumber }) {
  const errors = [];
  if (!frontmatter) {
    errors.push("Plan file has no YAML frontmatter block.");
    return errors;
  }
  if (frontmatter.issue !== issueNumber) {
    errors.push(`Plan frontmatter "issue" (${frontmatter.issue}) does not match the tracking issue (#${issueNumber}).`);
  }
  if (!VALID_STATUSES.has(frontmatter.status)) {
    errors.push(`Plan frontmatter "status" must be one of: ${[...VALID_STATUSES].join(", ")}.`);
  }

  const lifecycle = frontmatter.lifecycle;

  if (frontmatter.status === "draft") {
    if (lifecycle?.approval?.status === "approved") {
      errors.push('Plan "status" is draft but lifecycle.approval.status is "approved"; these must be consistent.');
    }
    return errors;
  }

  if (frontmatter.status !== "approved") {
    // Already reported above; nothing further to validate against an
    // unrecognized status.
    return errors;
  }

  if (!lifecycle || typeof lifecycle !== "object") {
    errors.push('Plan "status" is approved but no "lifecycle" frontmatter block is present.');
    return errors;
  }
  if (lifecycle.schema !== LIFECYCLE_SCHEMA_VERSION) {
    errors.push(`lifecycle.schema must be ${LIFECYCLE_SCHEMA_VERSION}.`);
  }

  const requirementsStatus = lifecycle.requirements?.status;
  if (!VALID_REQUIREMENTS_STATUSES.has(requirementsStatus)) {
    errors.push(`lifecycle.requirements.status must be one of: ${[...VALID_REQUIREMENTS_STATUSES].join(", ")}.`);
  } else if (requirementsStatus !== "answered") {
    errors.push('An approved plan must have lifecycle.requirements.status set to "answered".');
  }

  const reviewStatus = lifecycle.review?.status;
  if (!VALID_REVIEW_STATUSES.has(reviewStatus)) {
    errors.push(`lifecycle.review.status must be one of: ${[...VALID_REVIEW_STATUSES].join(", ")}.`);
  } else if (reviewStatus === "pending") {
    errors.push('An approved plan must have lifecycle.review.status of "completed" or "waived", not "pending".');
  } else if (reviewStatus === "completed") {
    if (!VALID_REVIEW_VERDICTS.has(lifecycle.review?.verdict)) {
      errors.push(`lifecycle.review.verdict must be one of: ${[...VALID_REVIEW_VERDICTS].join(", ")} when review.status is "completed".`);
    }
    if (!lifecycle.review?.evidence) {
      errors.push('lifecycle.review.evidence is required when review.status is "completed".');
    }
  } else if (reviewStatus === "waived" && !lifecycle.review?.evidence) {
    errors.push('lifecycle.review.evidence (reason) is required when review.status is "waived".');
  }

  if (!VALID_APPROVAL_STATUSES.has(lifecycle.approval?.status)) {
    errors.push(`lifecycle.approval.status must be one of: ${[...VALID_APPROVAL_STATUSES].join(", ")}.`);
  } else if (lifecycle.approval.status !== "approved") {
    errors.push('An approved plan must have lifecycle.approval.status set to "approved".');
  } else {
    if (!lifecycle.approval.approver || typeof lifecycle.approval.approver !== "string") {
      errors.push("lifecycle.approval.approver is required and must be the maintainer's GitHub login.");
    }
    if (!lifecycle.approval.evidence) {
      errors.push("lifecycle.approval.evidence (link to the /approve-plan comment) is required.");
    }
  }

  if (!lifecycle.planHash || typeof lifecycle.planHash !== "string") {
    errors.push("lifecycle.planHash is required on an approved plan.");
  } else {
    const actualHash = computePlanHash(body);
    if (lifecycle.planHash !== actualHash) {
      errors.push(
        `lifecycle.planHash (${lifecycle.planHash}) does not match the plan's current content (${actualHash}); ` +
          "the plan changed after approval and must be re-approved with a fresh hash."
      );
    }
  }

  if (!/^##\s*Verification/im.test(body)) {
    errors.push('An approved plan must have a "## Verification" section.');
  }
  if (planHasOpenQuestions(body) && !/^##\s*Decision record/im.test(body)) {
    errors.push('Plan has open questions (Q1, Q2, ...) but no "## Decision record" section reconciling them.');
  }

  return errors;
}

/**
 * Parse a `/approve-plan` maintainer comment.
 * @param {string} commentBody - Raw comment text.
 * @returns {{issue: number, hash: string, review: string, reason: (string|null)}|null}
 *   Null when the comment is not an /approve-plan command at all (so callers
 *   can ignore unrelated comments without treating them as malformed).
 * @throws {Error} When the comment starts with /approve-plan but is missing required fields.
 */
function parseApprovalComment(commentBody) {
  const lines = (commentBody || "").split(/\r?\n/).map((l) => l.trim());
  const firstNonEmpty = lines.find((l) => l.length > 0);
  if (firstNonEmpty !== "/approve-plan") {
    return null;
  }

  const fields = {};
  for (const line of lines) {
    const match = line.match(/^([A-Za-z-]+):\s*(.+)$/);
    if (match) {
      fields[match[1].toLowerCase()] = match[2].trim();
    }
  }

  const issueMatch = fields.issue?.match(/#?(\d+)/);
  if (!issueMatch) {
    throw new Error('/approve-plan comment is missing a valid "Issue: #N" line.');
  }
  if (!fields["plan-hash"]) {
    throw new Error('/approve-plan comment is missing a "Plan-Hash: sha256:<hash>" line.');
  }
  const hash = fields["plan-hash"].startsWith("sha256:") ? fields["plan-hash"] : `sha256:${fields["plan-hash"]}`;

  const review = (fields.review || "").toLowerCase();
  if (!VALID_REVIEW_STATUSES.has(review) || review === "pending") {
    throw new Error('/approve-plan comment must include "Review: completed" or "Review: waived".');
  }
  if (review === "waived" && !fields.reason) {
    throw new Error('/approve-plan comment with "Review: waived" must include a "Reason:" line.');
  }

  return {
    issue: Number(issueMatch[1]),
    hash,
    review,
    reason: fields.reason || null,
  };
}

/**
 * Verify that a valid, matching /approve-plan comment from the repository
 * owner exists among the fetched comments.
 * @param {object} params
 * @param {object} params.lifecycle - Plan frontmatter lifecycle block.
 * @param {string} params.planHash - Freshly computed hash of the current plan body.
 * @param {number} params.issueNumber - Tracking issue number.
 * @param {{author: string, body: string}[]} params.comments - Comments fetched from the issue and/or PR.
 * @param {string} params.ownerLogin - Repository owner's GitHub login (the only accepted approver).
 * @returns {string[]} Validation errors (empty when a valid approval is found).
 */
function validateApprovalEvidence({ lifecycle, planHash, issueNumber, comments, ownerLogin }) {
  if (lifecycle?.approval?.status !== "approved") {
    return [];
  }

  const matching = [];
  const malformed = [];
  for (const comment of comments) {
    let parsed;
    try {
      parsed = parseApprovalComment(comment.body);
    } catch (error) {
      malformed.push(`${comment.author}: ${error.message}`);
      continue;
    }
    if (!parsed) continue;
    if (comment.author !== ownerLogin) continue;
    if (parsed.issue === issueNumber && parsed.hash === planHash) {
      matching.push(parsed);
    }
  }

  if (matching.length > 0) {
    return [];
  }

  const errors = [
    `No valid /approve-plan comment from "${ownerLogin}" matching issue #${issueNumber} and plan hash ${planHash} was found.`,
  ];
  errors.push(...malformed.map((m) => `Malformed /approve-plan comment (ignored): ${m}`));
  return errors;
}

/**
 * Validate the rules around arming "Fixes #N" on an implementation PR.
 * @param {object} params
 * @param {("planning"|"implementation")} params.mode
 * @param {("Refs"|"Fixes")} params.keyword
 * @param {("draft"|"approved")} params.planStatus
 * @param {number[]|null} params.closingIssuesReferences - Issue numbers GitHub resolves this PR to close, or null if not checked.
 * @param {number} params.issueNumber
 * @param {number[]} params.otherOpenClosingPrNumbers - Other open PR numbers that also close this issue.
 * @returns {string[]} Validation errors.
 */
function validateClosingArmed({
  mode,
  keyword,
  planStatus,
  closingIssuesReferences,
  issueNumber,
  otherOpenClosingPrNumbers,
}) {
  const errors = [];
  if (mode === "planning" && keyword === "Fixes") {
    errors.push('Planning-only PRs must use "Refs #N", not "Fixes #N"; the issue is not resolved until implementation is approved and merged.');
  }
  if (mode === "implementation" && keyword === "Fixes") {
    if (planStatus !== "approved") {
      errors.push('"Fixes #N" may only be used once the linked plan\'s status is "approved".');
    }
    if (Array.isArray(closingIssuesReferences) && !closingIssuesReferences.includes(issueNumber)) {
      errors.push(`PR body says "Fixes #${issueNumber}" but GitHub does not report this PR as closing issue #${issueNumber}.`);
    }
    if (otherOpenClosingPrNumbers && otherOpenClosingPrNumbers.length > 0) {
      errors.push(`Issue #${issueNumber} is already armed to close by other open PR(s): ${otherOpenClosingPrNumbers.join(", ")}.`);
    }
  }
  return errors;
}

async function main() {
  const errors = [];
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    console.error("::error::GITHUB_EVENT_PATH is not set; this script must run inside a pull_request workflow.");
    process.exit(1);
  }
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const pr = event.pull_request;
  if (!pr) {
    console.error("::error::No pull_request payload found on the triggering event.");
    process.exit(1);
  }

  const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
  const prNumber = pr.number;
  const prBody = pr.body || "";
  const baseSha = pr.base?.sha;
  const headSha = pr.head?.sha;

  let changedFiles = [];
  try {
    const output = execFileSync("git", ["diff", "--name-only", `${baseSha}...${headSha}`], {
      cwd: ROOT_FOLDER,
      encoding: "utf8",
    });
    changedFiles = output.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch (error) {
    errors.push(`Failed to compute changed files via git diff: ${error.message}`);
  }

  const { keyword, issue: issueNumber, errors: linkErrors } = extractIssueLink(prBody);
  errors.push(...linkErrors);

  if (issueNumber === null) {
    reportAndExit(errors);
    return;
  }

  const { mode, planFile, errors: classifyErrors } = classifyChangedPaths(changedFiles, issueNumber);
  errors.push(...classifyErrors);

  const planPath = path.join(ROOT_FOLDER, planFile);
  if (!fs.existsSync(planPath)) {
    errors.push(`Expected plan file not found: ${planFile}.`);
    reportAndExit(errors);
    return;
  }

  const planContent = fs.readFileSync(planPath, "utf8");
  let frontmatter;
  let body;
  try {
    ({ frontmatter, body } = parsePlanContent(planContent));
  } catch (error) {
    errors.push(error.message);
    reportAndExit(errors);
    return;
  }

  errors.push(...validatePlanDocument({ frontmatter, body, issueNumber }));

  const planHash = computePlanHash(body);
  const planStatus = frontmatter?.status;
  const lifecycle = frontmatter?.lifecycle;

  if (lifecycle?.approval?.status === "approved" && owner && repo) {
    try {
      const comments = fetchComments({ owner, repo, issueNumber, prNumber });
      errors.push(
        ...validateApprovalEvidence({
          lifecycle,
          planHash,
          issueNumber,
          comments,
          ownerLogin: owner,
        })
      );
    } catch (error) {
      errors.push(`Failed to verify /approve-plan evidence via GitHub API: ${error.message}`);
    }
  }

  let closingIssuesReferences = null;
  let otherOpenClosingPrNumbers = [];
  if (mode === "implementation" && keyword === "Fixes" && owner && repo) {
    try {
      closingIssuesReferences = fetchClosingIssuesReferences({ owner, repo, prNumber });
      otherOpenClosingPrNumbers = fetchOtherOpenPrsClosingIssue({ owner, repo, issueNumber, prNumber });
    } catch (error) {
      errors.push(`Failed to verify issue-closing references via GitHub API: ${error.message}`);
    }
  }

  errors.push(
    ...validateClosingArmed({
      mode,
      keyword,
      planStatus,
      closingIssuesReferences,
      issueNumber,
      otherOpenClosingPrNumbers,
    })
  );

  reportAndExit(errors);
}

function reportAndExit(errors) {
  if (errors.length > 0) {
    console.error(`\n❌ Fork plan lifecycle check failed with ${errors.length} error(s):`);
    for (const error of errors) {
      console.error(`::error::${error}`);
    }
    process.exit(1);
  }
  console.log("✅ Fork plan lifecycle check passed");
}

function fetchComments({ owner, repo, issueNumber, prNumber }) {
  const results = [];
  const numbers = new Set([issueNumber, prNumber].filter((n) => typeof n === "number"));
  for (const number of numbers) {
    // --paginate --slurp merges all pages into a single JSON array, even for
    // multi-page comment threads.
    const output = execFileSync(
      "gh",
      ["api", `repos/${owner}/${repo}/issues/${number}/comments`, "--paginate", "--slurp"],
      { encoding: "utf8" }
    );
    const pages = JSON.parse(output);
    const flat = pages.flat();
    for (const comment of flat) {
      results.push({ author: comment.user?.login, body: comment.body });
    }
  }
  return results;
}

function fetchClosingIssuesReferences({ owner, repo, prNumber }) {
  const output = execFileSync(
    "gh",
    ["pr", "view", String(prNumber), "--repo", `${owner}/${repo}`, "--json", "closingIssuesReferences"],
    { encoding: "utf8" }
  );
  const parsed = JSON.parse(output);
  return (parsed.closingIssuesReferences || []).map((ref) => ref.number);
}

function fetchOtherOpenPrsClosingIssue({ owner, repo, issueNumber, prNumber }) {
  const output = execFileSync(
    "gh",
    ["pr", "list", "--repo", `${owner}/${repo}`, "--state", "open", "--json", "number,closingIssuesReferences"],
    { encoding: "utf8" }
  );
  const parsed = JSON.parse(output);
  return parsed
    .filter((p) => p.number !== prNumber)
    .filter((p) => (p.closingIssuesReferences || []).some((ref) => ref.number === issueNumber))
    .map((p) => p.number);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`::error::Unexpected failure in fork plan lifecycle check: ${error.message}`);
    process.exit(1);
  });
}

export {
  PLANS_DIR,
  LIFECYCLE_SCHEMA_VERSION,
  splitFrontmatter,
  computePlanHash,
  parsePlanContent,
  extractIssueLink,
  classifyChangedPaths,
  planHasOpenQuestions,
  validatePlanDocument,
  parseApprovalComment,
  validateApprovalEvidence,
  validateClosingArmed,
};
