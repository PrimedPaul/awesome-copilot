#!/usr/bin/env node
// Enforces the fork-only plan approval lifecycle described in
// .github/fork-only/plans/README.md: a plan must carry machine-readable
// evidence that requirements were answered, the plan was reviewed, and the
// maintainer approved it on the planning PR before an implementation, tooling,
// or maintenance PR may arm `Fixes #N`. See .github/fork-only/README.md for the full contract.
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
const MAINTENANCE_LABEL = "fork-lifecycle-maintenance";
const CATEGORY_LABELS = ["fork-workflow", "o2p-plugin-enhancements"];
const LIFECYCLE_COMMENT_MARKER = "<!-- fork-plan-lifecycle-check -->";
const LIFECYCLE_CHECK_NAME = "Fork Plan Lifecycle Validation";

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

const TOOLING_PATH_PATTERNS = [
  /^\.github\/workflows\/fork-[a-z0-9-]+\.md$/,
  /^\.github\/workflows\/fork-[a-z0-9-]+\.lock\.yml$/,
  /^\.github\/workflows\/fork-[a-z0-9-]+\.yml$/,
  /^eng\/fork-[a-z0-9-]+(?:\.test)?\.mjs$/,
  /^\.github\/fork-only\/README\.md$/,
];

const MAINTENANCE_PATHS = new Set([
  ".github/agents/dev-orchestrator.agent.md",
  ".github/agents/plan-reviewer.agent.md",
  ".github/fork-only/README.md",
  ".github/fork-only/plans/README.md",
  ".github/workflows/fork-issue-planner.md",
  ".github/workflows/fork-issue-planner.lock.yml",
  ".github/workflows/fork-plan-lifecycle-check.yml",
  "eng/validate-fork-plan-lifecycle.mjs",
  "eng/validate-fork-plan-lifecycle.test.mjs",
  "package.json",
]);
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
  const normalized = body.replace(/\r\n/g, "\n");
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

function entriesFromPullRequestFiles(files) {
  return files.map((file) => file.status === "renamed"
    ? { status: "R100", oldPath: file.previous_filename, newPath: file.filename }
    : { status: file.status, path: file.filename });
}

function changedPathsFromEntries(entries) {
  return entries.flatMap((entry) =>
    entry.oldPath && entry.newPath
      ? [entry.oldPath, entry.newPath]
      : [entry.path]
  ).filter(Boolean);
}

function validateWorkflowSourceLockPairs(entries) {
  const changedPaths = new Set(changedPathsFromEntries(entries).map((file) => file.replace(/\\/g, "/")));
  const errors = [];
  for (const file of changedPaths) {
    const source = file.match(/^\.github\/workflows\/(fork-[a-z0-9-]+)\.md$/);
    const lock = file.match(/^\.github\/workflows\/(fork-[a-z0-9-]+)\.lock\.yml$/);
    if (source && !changedPaths.has(`.github/workflows/${source[1]}.lock.yml`)) {
      errors.push(`Fork agentic workflow source "${file}" changed without its matching ".github/workflows/${source[1]}.lock.yml".`);
    }
    if (lock && !changedPaths.has(`.github/workflows/${lock[1]}.md`)) {
      errors.push(`Fork agentic workflow lock "${file}" changed without its matching ".github/workflows/${lock[1]}.md".`);
    }
  }
  return errors;
}

function pullRequestsForIssue(pullRequests, issueNumber) {
  return pullRequests.filter((pullRequest) =>
    extractIssueLink(pullRequest.body).issue === issueNumber
  );
}

function isRelevantCategoryLabel(labelName) {
  return [...CATEGORY_LABELS, "fork-maintenance"].includes(labelName);
}

function shouldSkipLifecycleCheck(eventName, pullRequestLabels = []) {
  return eventName === "pull_request" && pullRequestLabels.includes("fork-sync");
}

function issueNumberFromEvent(eventName, event) {
  if (eventName === "issues") return event.issue?.number;
  if (eventName === "workflow_dispatch") return Number(event.inputs?.issue_number);
  return null;
}

/**
 * Classify the changed files of a PR relative to the fork's plan lifecycle.
 * @param {string[]} changedFiles - Repo-relative changed file paths (forward slashes).
 * @param {number} issueNumber - Tracking issue number from the PR body marker.
 * @returns {{mode: ("planning"|"implementation"|"tooling"|"maintenance"|"unrelated"), planFile: string|null, errors: string[]}}
 */
function classifyChangedPaths(changedFiles, issueNumber, planFiles = changedFiles) {
  const errors = [];
  const normalized = changedFiles.map((f) => f.replace(/\\/g, "/"));
  const normalizedPlanFiles = planFiles.map((f) => f.replace(/\\/g, "/"));

  const issuePlanPattern = issueNumber === null
    ? /^\.github\/fork-only\/plans\/issue-\d+-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
    : new RegExp(`^\\.github/fork-only/plans/issue-${issueNumber}-[a-z0-9]+(?:-[a-z0-9]+)*\\.md$`);
  const matchingPlanFiles = issueNumber === null
    ? []
    : normalizedPlanFiles.filter((f) => issuePlanPattern.test(f));
  if (matchingPlanFiles.length > 1) {
    errors.push(
      `Found multiple plan files for issue #${issueNumber}: ${matchingPlanFiles.join(", ")}. Keep exactly one plan file per issue.`
    );
  }
  const changedPlanFiles = normalized.filter((f) => issuePlanPattern.test(f));
  const planRelative = issueNumber === null
    ? null
    : matchingPlanFiles[0] ?? changedPlanFiles[0] ?? null;
  const hasPlanChange = changedPlanFiles.length > 0;
  const hasImplementationChange = normalized.some((f) =>
    IMPLEMENTATION_PATH_PATTERNS.some((pattern) => pattern.test(f))
  );
  const hasToolingChange = normalized.some((f) =>
    TOOLING_PATH_PATTERNS.some((pattern) => pattern.test(f))
  );
  const hasMaintenancePath = normalized.some((f) => MAINTENANCE_PATHS.has(f));
  const isMaintenanceOnly =
    normalized.length > 0 &&
    normalized.every((f) => MAINTENANCE_PATHS.has(f));
  const forkToolingLeaks = normalized.filter(
    (f) => f.startsWith(".github/fork-only/") && f !== planRelative
  );

  let mode = "unrelated";
  if (isMaintenanceOnly) {
    mode = "maintenance";
  } else if (hasImplementationChange) {
    mode = "implementation";
  } else if (hasToolingChange) {
    mode = "tooling";
  } else if (hasPlanChange) {
    mode = "planning";
  } else if (hasMaintenancePath) {
    mode = "maintenance";
    errors.push(
      "Tooling-maintenance PRs may only change files in the explicit lifecycle maintenance allowlist."
    );
  }

  if (mode === "maintenance") {
    return { mode, planFile: null, errors };
  }

  if (mode === "implementation" && forkToolingLeaks.length > 0) {
    errors.push(
      `Implementation PRs may only touch the matching plan file under .github/fork-only/plans/; ` +
        `also found changes to: ${forkToolingLeaks.join(", ")}.`
    );
  }
  if (mode === "implementation" && (hasToolingChange || hasMaintenancePath)) {
    errors.push(
      "Implementation PRs must not bundle lifecycle tooling changes; split tooling maintenance into a separately labeled PR."
    );
  }
  if (mode === "tooling") {
    const maintenanceLeaks = normalized.filter(
      (file) => MAINTENANCE_PATHS.has(file) && file !== ".github/fork-only/README.md"
    );
    if (maintenanceLeaks.length > 0) {
      errors.push(
        `Tooling implementation PRs must not bundle lifecycle-maintenance paths; also found: ${maintenanceLeaks.join(", ")}.`
      );
    }
    const unsupported = normalized.filter((file) => {
      if (issuePlanPattern.test(file)) return false;
      if (file === ".github/fork-only/README.md") return false;
      return !TOOLING_PATH_PATTERNS.some((pattern) => pattern.test(file));
    });
    if (unsupported.length > 0) {
      errors.push(`Tooling implementation PRs may only change the matching plan and approved tooling paths; also found changes to: ${unsupported.join(", ")}.`);
    }
    if (matchingPlanFiles.length !== 1) {
      errors.push(`Tooling implementation PRs require exactly one matching plan file for issue #${issueNumber}.`);
    }
  }
  if (mode === "planning") {
    const unsupported = normalized.filter((file) => !issuePlanPattern.test(file));
    if (unsupported.length > 0) {
      errors.push(`Planning-only PRs may only change the matching issue plan; also found changes to: ${unsupported.join(", ")}.`);
    }
  }
  if (mode === "planning" && hasMaintenancePath) {
    errors.push(
      "Plan-only PRs must not bundle lifecycle tooling changes; split tooling maintenance into a separately labeled PR."
    );
  }
  if (mode === "unrelated") {
    return { mode, planFile: null, errors };
  }

  return { mode, planFile: planRelative, errors };
}

function validateMaintenanceLabel({ mode, labels }) {
  if (mode !== "maintenance" || labels.includes(MAINTENANCE_LABEL)) {
    return [];
  }
  return [
    `Tooling-only changes require the "${MAINTENANCE_LABEL}" PR label. ` +
      "This label is limited to the lifecycle maintenance allowlist; focused regression tests run in CI.",
  ];
}

function categoryForPlanScope(scope) {
  if (scope === "fork-tooling") return "fork-workflow";
  if (scope === "agent") return "o2p-plugin-enhancements";
  return null;
}

function validateCategoryLabels({ mode, scope, issueLabels, pullRequestLabels }) {
  const errors = [];
  const issueCategories = (issueLabels || []).filter((label) => CATEGORY_LABELS.includes(label));
  const prCategories = (pullRequestLabels || []).filter((label) => CATEGORY_LABELS.includes(label));
  const expected = mode === "maintenance" && !scope
    ? "fork-workflow"
    : categoryForPlanScope(scope);

  if (scope === "out-of-scope") {
    if (issueCategories.length > 0 || prCategories.length > 0) {
      errors.push("Out-of-scope planning PRs and their issues must not carry fork category labels.");
    }
    return errors;
  }
  if (!expected) {
    errors.push(`Cannot determine the expected fork category for lifecycle mode "${mode}"${scope ? ` and plan scope "${scope}"` : ""}.`);
    return errors;
  }
  if (issueCategories.length !== 1 || issueCategories[0] !== expected) {
    errors.push(`Issue must have exactly the "${expected}" category label; found: ${issueCategories.join(", ") || "none"}.`);
  }
  if (prCategories.length !== 1 || prCategories[0] !== expected) {
    errors.push(`Pull request must have exactly the "${expected}" category label; found: ${prCategories.join(", ") || "none"}.`);
  }
  return errors;
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
      errors.push('lifecycle.approval.evidence (link to the exact "Approve plan" PR comment) is required.');
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
 * Parse the exact short approval phrase used on the planning PR.
 * @param {string} commentBody - Raw comment text.
 * @returns {{approved: true}|null} Null for any other comment.
 */
function parseApprovalComment(commentBody) {
  if ((commentBody || "").trim().toLowerCase() !== "approve plan") return null;
  return { approved: true };
}

/**
 * Verify that lifecycle evidence links to an exact approval comment from the
 * repository owner on the planning PR.
 * @param {object} params
 * @param {object} params.lifecycle - Plan frontmatter lifecycle block.
 * @param {number} params.issueNumber - Tracking issue number.
 * @param {{author: string, body: string, url: string}[]} params.comments - Comments fetched from the PR.
 * @param {string} params.ownerLogin - Repository owner's GitHub login (the only accepted approver).
 * @returns {string[]} Validation errors (empty when a valid approval is found).
 */
function validateApprovalEvidence({ lifecycle, issueNumber, comments, ownerLogin }) {
  if (lifecycle?.approval?.status !== "approved") {
    return [];
  }

  const approvalUrl = lifecycle.approval.evidence;
  const matching = comments.some((comment) =>
    comment.author === ownerLogin &&
    comment.url === approvalUrl &&
    parseApprovalComment(comment.body) !== null
  );
  if (lifecycle.approval.approver !== ownerLogin) {
    return [`lifecycle.approval.approver must match the repository owner "${ownerLogin}".`];
  }
  if (matching) {
    return [];
  }

  return [
    `No exact "Approve plan" comment from "${ownerLogin}" matching lifecycle.approval.evidence was found on the planning PR for issue #${issueNumber}.`,
  ];
}

function validatePlanningPullRequestBinding({
  lifecycle,
  issueNumber,
  planFile,
  planningPullRequest,
}) {
  const errors = [];
  const approvalUrl = lifecycle?.approval?.evidence;
  let url;
  try {
    url = new URL(approvalUrl);
  } catch {
    return ["lifecycle.approval.evidence must link to the matching planning PR comment."];
  }
  const match = url.pathname.match(/^\/[^/]+\/[^/]+\/pull\/(\d+)$/);
  if (!match || url.hash.length < 2) {
    errors.push("lifecycle.approval.evidence must identify an exact comment on a planning PR.");
    return errors;
  }
  if (Number(match[1]) !== planningPullRequest?.number) {
    errors.push("lifecycle.approval.evidence must point to the planning PR associated with this issue plan.");
  }
  if (planningPullRequest?.baseRefName !== "main") {
    errors.push("The planning PR linked by lifecycle.approval.evidence must target main.");
  }
  if (!planningPullRequest?.mergedAt) {
    errors.push("The planning PR linked by lifecycle.approval.evidence must be merged before implementation.");
  }
  const { keyword, issue: linkedIssue, errors: linkErrors } = extractIssueLink(planningPullRequest?.body || "");
  if (linkErrors.length > 0 || keyword !== "Refs" || linkedIssue !== issueNumber) {
    errors.push(`The planning PR linked by lifecycle.approval.evidence must contain a standalone "Refs #${issueNumber}" line.`);
  }
  if (!(planningPullRequest?.files || []).includes(planFile)) {
    errors.push(`The planning PR linked by lifecycle.approval.evidence must change the matching plan file "${planFile}".`);
  }
  return errors;
}

/**
 * Validate the rules around arming "Fixes #N" on lifecycle implementation PRs.
 * @param {object} params
 * @param {("planning"|"implementation"|"tooling"|"maintenance")} params.mode
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
  if (["implementation", "tooling", "maintenance"].includes(mode) && keyword === "Fixes") {
    if (planStatus !== "approved") {
      errors.push('"Fixes #N" may only be used once the linked plan\'s status is "approved".');
    }
    if (!Array.isArray(closingIssuesReferences)) {
      errors.push(`Could not verify whether GitHub reports this PR as closing issue #${issueNumber}.`);
    } else if (!closingIssuesReferences.includes(issueNumber)) {
      errors.push(`PR body says "Fixes #${issueNumber}" but GitHub does not report this PR as closing issue #${issueNumber}.`);
    }
    if (!Array.isArray(otherOpenClosingPrNumbers)) {
      errors.push(`Could not verify whether another open PR already closes issue #${issueNumber}.`);
    } else if (otherOpenClosingPrNumbers.length > 0) {
      errors.push(`Issue #${issueNumber} is already armed to close by other open PR(s): ${otherOpenClosingPrNumbers.join(", ")}.`);
    }
  }
  return errors;
}

async function main() {
  if (process.argv[2] === "--hash") {
    const planPath = process.argv[3];
    if (!planPath) {
      console.error("Usage: npm run fork:plan-hash -- <plan-file>");
      process.exit(2);
    }
    const { frontmatter, body } = parsePlanContent(
      fs.readFileSync(path.resolve(ROOT_FOLDER, planPath), "utf8")
    );
    if (!frontmatter) {
      throw new Error(`Plan file has no YAML frontmatter: ${planPath}`);
    }
    console.log(computePlanHash(body));
    return;
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    console.error("::error::GITHUB_EVENT_PATH is not set; this script must run inside a lifecycle workflow.");
    process.exit(1);
  }
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY must be set as owner/repository.");
  }

  const eventName = process.env.GITHUB_EVENT_NAME;
  if (shouldSkipLifecycleCheck(
    eventName,
    (event.pull_request?.labels || []).map((label) => label.name)
  )) {
    console.log("ℹ️ Skipping the lifecycle check for a fork-sync pull request.");
    return;
  }
  let issueNumber;
  let pullRequests = [];
  if (eventName === "pull_request") {
    if (!event.pull_request?.number) {
      throw new Error("No pull_request payload found on the pull_request event.");
    }
    pullRequests = [await fetchPullRequest({ owner, repo, number: event.pull_request.number })];
  } else if (eventName === "issues") {
    const changedLabel = event.label?.name;
    if (!isRelevantCategoryLabel(changedLabel)) {
      if (process.env.FORK_LIFECYCLE_TEST_OUTCOME === "failure") {
        reportAndExit(["Fork plan lifecycle regression tests failed."]);
        return;
      }
      console.log("ℹ️ Issue label change does not affect lifecycle category validation.");
      return;
    }
    issueNumber = issueNumberFromEvent(eventName, event);
  } else if (eventName === "workflow_dispatch") {
    issueNumber = issueNumberFromEvent(eventName, event);
  } else {
    throw new Error(`Unsupported lifecycle workflow event: ${eventName || "unknown"}.`);
  }

  if (eventName !== "pull_request") {
    if (!Number.isInteger(issueNumber) || issueNumber < 1) {
      throw new Error("A valid issue_number is required to revalidate lifecycle labels.");
    }
    pullRequests = fetchOpenPullRequestsForIssue({ owner, repo, issueNumber });
  }

  if (pullRequests.length === 0) {
    if (process.env.FORK_LIFECYCLE_TEST_OUTCOME === "failure") {
      reportAndExit(["Fork plan lifecycle regression tests failed."]);
      return;
    }
    console.log("ℹ️ No open pull requests reference this issue; nothing to revalidate.");
    return;
  }

  const resultErrors = [];
  for (const pr of pullRequests) {
    const result = await validatePullRequestLifecycle({ owner, repo, pullRequest: pr });
    const checkErrors = [...result.errors];
    if (process.env.FORK_LIFECYCLE_TEST_OUTCOME === "failure") {
      checkErrors.push("Fork plan lifecycle regression tests failed.");
    }
    const checkRunErrors = await publishCheckRun({
      owner,
      repo,
      pullRequest: pr,
      errors: checkErrors,
    });
    const commentErrors = await publishLifecycleComment({
      owner,
      repo,
      pullRequest: pr,
      errors: checkErrors,
    });
    resultErrors.push(
      ...checkErrors.map((error) => `PR #${pr.number}: ${error}`),
      ...checkRunErrors,
      ...commentErrors
    );
  }
  reportAndExit(resultErrors);
}

function runGhJson(args) {
  const output = execFileSync("gh", ["api", ...args], { encoding: "utf8" });
  return JSON.parse(output);
}

function runGhJsonWrite(method, endpoint, payload) {
  const output = execFileSync(
    "gh",
    ["api", "--method", method, endpoint, "--input", "-"],
    { encoding: "utf8", input: JSON.stringify(payload) }
  );
  return output ? JSON.parse(output) : null;
}

function fetchPullRequest({ owner, repo, number }) {
  const output = execFileSync(
    "gh",
    ["pr", "view", String(number), "--repo", `${owner}/${repo}`, "--json",
      "number,url,body,labels,baseRefName,baseRefOid,headRefName,headRefOid,closingIssuesReferences,mergedAt"],
    { encoding: "utf8" }
  );
  return JSON.parse(output);
}

function fetchIssueLabels({ owner, repo, issueNumber }) {
  const output = execFileSync(
    "gh",
    ["issue", "view", String(issueNumber), "--repo", `${owner}/${repo}`, "--json", "labels", "--jq", ".labels[].name"],
    { encoding: "utf8" }
  );
  return output.split(/\r?\n/).filter(Boolean);
}

function approvalPullRequestNumber(approvalUrl) {
  let url;
  try {
    url = new URL(approvalUrl);
  } catch {
    throw new Error("lifecycle.approval.evidence is not a valid PR comment URL.");
  }
  const match = url.pathname.match(/^\/[^/]+\/[^/]+\/pull\/(\d+)$/);
  if (url.hostname !== "github.com" || !match || !url.hash.startsWith("#issuecomment-")) {
    throw new Error("lifecycle.approval.evidence must link to an issue comment on a GitHub planning PR.");
  }
  return Number(match[1]);
}

function fetchOpenPullRequestsForIssue({ owner, repo, issueNumber }) {
  const output = execFileSync(
    "gh",
    ["pr", "list", "--repo", `${owner}/${repo}`, "--state", "open", "--limit", "1000", "--json", "number,body"],
    { encoding: "utf8" }
  );
  const candidates = pullRequestsForIssue(JSON.parse(output), issueNumber);
  return candidates.map((pr) => fetchPullRequest({ owner, repo, number: pr.number }));
}

function fetchPullRequestFiles({ owner, repo, number }) {
  const pages = runGhJson([
    `repos/${owner}/${repo}/pulls/${number}/files`,
    "--paginate",
    "--slurp",
  ]);
  return entriesFromPullRequestFiles(pages.flat());
}

function fetchFileAtRef({ owner, repo, filePath, ref }) {
  const result = runGhJson([
    `repos/${owner}/${repo}/contents/${filePath}`,
    "-f",
    `ref=${ref}`,
  ]);
  if (!result.content || result.encoding !== "base64") {
    throw new Error(`Could not read "${filePath}" from PR head ${ref}.`);
  }
  return Buffer.from(result.content.replace(/\s/g, ""), "base64").toString("utf8");
}

async function validatePullRequestLifecycle({ owner, repo, pullRequest }) {
  const errors = [];
  const entries = fetchPullRequestFiles({ owner, repo, number: pullRequest.number });
  errors.push(...validateWorkflowSourceLockPairs(entries));
  const changedFiles = changedPathsFromEntries(entries);
  const { keyword, issue: issueNumber, errors: linkErrors } = extractIssueLink(pullRequest.body);
  const planFiles = fs.readdirSync(PLANS_DIR)
    .filter((file) => /^issue-\d+-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(file))
    .map((file) => `.github/fork-only/plans/${file}`);
  const { mode, planFile: changedPlanFile, errors: classifyErrors } = classifyChangedPaths(
    changedFiles,
    issueNumber,
    [...planFiles, ...changedFiles]
  );
  errors.push(...classifyErrors);
  if (mode === "unrelated") {
    return { mode, errors };
  }
  errors.push(...linkErrors);
  if (issueNumber === null) {
    return { mode, errors };
  }

  const matchingPlanFiles = [...new Set(
    [...planFiles, ...changedFiles]
      .map((file) => file.replace(/\\/g, "/"))
      .filter((file) => new RegExp(`^\\.github/fork-only/plans/issue-${issueNumber}-[a-z0-9]+(?:-[a-z0-9]+)*\\.md$`).test(file))
  )];
  if (matchingPlanFiles.length > 1) {
    errors.push(`Found multiple plan files for issue #${issueNumber}: ${matchingPlanFiles.join(", ")}.`);
  }
  const planFile = changedPlanFile || matchingPlanFiles[0] || null;
  let frontmatter;
  let body;
  if (planFile) {
    try {
      ({ frontmatter, body } = parsePlanContent(fetchFileAtRef({
        owner,
        repo,
        filePath: planFile,
        ref: pullRequest.headRefOid,
      })));
    } catch (error) {
      errors.push(`Failed to read plan "${planFile}" from PR #${pullRequest.number}: ${error.message}`);
    }
  }

  if (planFile && frontmatter) {
    errors.push(...validatePlanDocument({ frontmatter, body, issueNumber }));
  } else if (["implementation", "tooling"].includes(mode) ||
      (mode === "maintenance" && keyword === "Fixes")) {
    errors.push(`Expected an existing plan file for issue #${issueNumber}, but none was found.`);
  }

  const scope = frontmatter?.scope;
  if (mode === "implementation" && scope !== "agent") {
    errors.push(`Implementation PRs require an approved plan with scope "agent"; found "${scope || "none"}".`);
  }
  if (mode === "tooling" && scope !== "fork-tooling") {
    errors.push(`Tooling PRs require a plan with scope "fork-tooling"; found "${scope || "none"}".`);
  }
  if (scope === "out-of-scope" && mode !== "planning") {
    errors.push("An out-of-scope plan cannot authorize implementation or tooling changes.");
  }

  const issueLabels = fetchIssueLabels({ owner, repo, issueNumber });
  errors.push(...validateCategoryLabels({
    mode,
    scope,
    issueLabels,
    pullRequestLabels: (pullRequest.labels || []).map((label) => label.name),
  }));
  if (mode === "maintenance") {
    errors.push(...validateMaintenanceLabel({
      mode,
      labels: (pullRequest.labels || []).map((label) => label.name),
    }));
  }

  const planStatus = frontmatter?.status;
  const lifecycle = frontmatter?.lifecycle;
  if (lifecycle?.approval?.status === "approved" && owner && repo && planFile) {
    try {
      const approvalPrNumber = approvalPullRequestNumber(lifecycle.approval.evidence);
      const planningPullRequest = fetchPullRequest({ owner, repo, number: approvalPrNumber });
      const planningFiles = fetchPullRequestFiles({ owner, repo, number: approvalPrNumber });
      const planningData = {
        number: planningPullRequest.number,
        baseRefName: planningPullRequest.baseRefName,
        mergedAt: planningPullRequest.mergedAt,
        body: planningPullRequest.body,
        files: changedPathsFromEntries(planningFiles),
      };
      errors.push(...validatePlanningPullRequestBinding({
        lifecycle,
        issueNumber,
        planFile,
        planningPullRequest: planningData,
      }));
      const comments = fetchComments({ owner, repo, prNumber: approvalPrNumber });
      errors.push(...validateApprovalEvidence({ lifecycle, issueNumber, comments, ownerLogin: owner }));
    } catch (error) {
      errors.push(`Failed to verify "Approve plan" evidence via its planning PR: ${error.message}`);
    }
  }

  let closingIssuesReferences = null;
  let otherOpenClosingPrNumbers = [];
  if (["implementation", "tooling", "maintenance"].includes(mode) && keyword === "Fixes") {
    try {
      closingIssuesReferences = (pullRequest.closingIssuesReferences || []).map((ref) => ref.number);
      otherOpenClosingPrNumbers = fetchOtherOpenPrsClosingIssue({
        owner,
        repo,
        issueNumber,
        prNumber: pullRequest.number,
      });
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
  return { mode, errors };
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

function fetchComments({ owner, repo, prNumber }) {
  // --paginate --slurp merges all pages into a single JSON array, even for
  // multi-page comment threads.
  const output = execFileSync(
    "gh",
    ["api", `repos/${owner}/${repo}/issues/${prNumber}/comments`, "--paginate", "--slurp"],
    { encoding: "utf8" }
  );
  const pages = JSON.parse(output);
  return pages.flat().map((comment) => ({
    author: comment.user?.login,
    body: comment.body,
    url: comment.html_url,
  }));
}

function fetchOtherOpenPrsClosingIssue({ owner, repo, issueNumber, prNumber }) {
  const output = execFileSync(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      `${owner}/${repo}`,
      "--state",
      "open",
      "--limit",
      "1000",
      "--json",
      "number,closingIssuesReferences",
    ],
    { encoding: "utf8" }
  );
  const parsed = JSON.parse(output);
  return parsed
    .filter((p) => p.number !== prNumber)
    .filter((p) => (p.closingIssuesReferences || []).some((ref) => ref.number === issueNumber))
    .map((p) => p.number);
}

function publishCheckRun({ owner, repo, pullRequest, errors }) {
  const collectionEndpoint = `repos/${owner}/${repo}/commits/${pullRequest.headRefOid}/check-runs`;
  const pages = runGhJson([collectionEndpoint, "--paginate", "--slurp", "-F", "per_page=100"]);
  const existing = pages.flatMap((page) => page.check_runs || [])
    .filter((run) => run.name === LIFECYCLE_CHECK_NAME)
    .sort((left, right) => new Date(right.started_at || right.created_at) - new Date(left.started_at || left.created_at))[0];
  const request = buildCheckRunRequest({
    owner,
    repo,
    pullRequest,
    existing,
    errors,
  });
  try {
    runGhJsonWrite(request.method, request.endpoint, request.payload);
    return [];
  } catch (error) {
    return [`Failed to publish lifecycle check run for PR #${pullRequest.number}: ${error.message}`];
  }
}

function buildCheckRunRequest({ owner, repo, pullRequest, existing, errors, completedAt = new Date().toISOString() }) {
  const passed = errors.length === 0;
  const payload = {
    name: LIFECYCLE_CHECK_NAME,
    head_sha: pullRequest.headRefOid,
    status: "completed",
    conclusion: passed ? "success" : "failure",
    completed_at: completedAt,
    details_url: pullRequest.url,
    output: {
      title: passed ? "Fork plan lifecycle passed" : "Fork plan lifecycle failed",
      summary: passed
        ? `Lifecycle validation passed for PR #${pullRequest.number}.`
        : errors.map((error) => `- ${error}`).join("\n"),
      text: `Validated changed paths and issue/category rules for commit ${pullRequest.headRefOid}.`,
    },
  };
  const collectionEndpoint = `repos/${owner}/${repo}/commits/${pullRequest.headRefOid}/check-runs`;
  if (existing) {
    delete payload.head_sha;
    return {
      method: "PATCH",
      endpoint: `${collectionEndpoint}/${existing.id}`,
      payload,
    };
  }
  return { method: "POST", endpoint: collectionEndpoint, payload };
}

function publishLifecycleComment({ owner, repo, pullRequest, errors }) {
  const comments = fetchComments({ owner, repo, prNumber: pullRequest.number });
  const existing = comments.find((comment) => comment.body.includes(LIFECYCLE_COMMENT_MARKER));
  if (errors.length === 0) {
    if (!existing) return [];
    try {
      const commentId = existing.url.match(/#issuecomment-(\d+)$/)?.[1];
      if (!commentId) throw new Error("Existing lifecycle comment URL does not contain a comment id.");
      execFileSync("gh", [
        "api",
        "--method",
        "DELETE",
        `repos/${owner}/${repo}/issues/comments/${commentId}`,
      ]);
      return [];
    } catch (error) {
      return [`Failed to remove stale lifecycle comment from PR #${pullRequest.number}: ${error.message}`];
    }
  }

  const body = [
    LIFECYCLE_COMMENT_MARKER,
    "🛑 **Plan approval lifecycle check failed**",
    "",
    "This PR does not satisfy the approval lifecycle in `.github/fork-only/plans/README.md`.",
    "",
    ...errors.map((error) => `- ${error}`),
    "",
    "Run `npm run fork:lifecycle` and `npm run fork:lifecycle:test` locally for more detail.",
  ].join("\n");
  try {
    if (existing) {
      const commentId = existing.url.match(/#issuecomment-(\d+)$/)?.[1];
      if (!commentId) throw new Error("Existing lifecycle comment URL does not contain a comment id.");
      runGhJsonWrite("PATCH", `repos/${owner}/${repo}/issues/comments/${commentId}`, { body });
    } else {
      runGhJsonWrite("POST", `repos/${owner}/${repo}/issues/${pullRequest.number}/comments`, { body });
    }
    return [];
  } catch (error) {
    return [`Failed to publish lifecycle summary comment on PR #${pullRequest.number}: ${error.message}`];
  }
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
  MAINTENANCE_LABEL,
  CATEGORY_LABELS,
  splitFrontmatter,
  computePlanHash,
  parsePlanContent,
  extractIssueLink,
  classifyChangedPaths,
  entriesFromPullRequestFiles,
  changedPathsFromEntries,
  validateWorkflowSourceLockPairs,
  pullRequestsForIssue,
  isRelevantCategoryLabel,
  shouldSkipLifecycleCheck,
  issueNumberFromEvent,
  validateMaintenanceLabel,
  categoryForPlanScope,
  validateCategoryLabels,
  planHasOpenQuestions,
  validatePlanDocument,
  parseApprovalComment,
  validateApprovalEvidence,
  validatePlanningPullRequestBinding,
  validateClosingArmed,
  buildCheckRunRequest,
};
