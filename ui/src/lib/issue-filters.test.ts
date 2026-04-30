// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { Issue } from "@paperclipai/shared";
import {
  applyIssueFilters,
  countActiveIssueFilters,
  defaultIssueFilterState,
  issueFilterLabel,
  issueFilterArraysEqual,
  toggleIssueFilterValue,
  resolveIssueFilterWorkspaceId,
  shouldIncludeIssueFilterWorkspaceOption,
  issueStatusOrder,
  issuePriorityOrder,
} from "./issue-filters.js";

// ============================================================================
// issueFilterLabel
// ============================================================================

describe("issueFilterLabel", () => {
  it("converts underscore-separated string to Title Case", () => {
    expect(issueFilterLabel("in_progress")).toBe("In Progress");
  });

  it("capitalizes single-word status", () => {
    expect(issueFilterLabel("backlog")).toBe("Backlog");
  });

  it("handles 'done' and 'cancelled'", () => {
    expect(issueFilterLabel("done")).toBe("Done");
    expect(issueFilterLabel("cancelled")).toBe("Cancelled");
  });

  it("handles 'in_review'", () => {
    expect(issueFilterLabel("in_review")).toBe("In Review");
  });
});

// ============================================================================
// issueFilterArraysEqual
// ============================================================================

describe("issueFilterArraysEqual", () => {
  it("returns true for two empty arrays", () => {
    expect(issueFilterArraysEqual([], [])).toBe(true);
  });

  it("returns true for identical arrays", () => {
    expect(issueFilterArraysEqual(["a", "b"], ["a", "b"])).toBe(true);
  });

  it("returns true for same elements in different order", () => {
    expect(issueFilterArraysEqual(["b", "a"], ["a", "b"])).toBe(true);
  });

  it("returns false for arrays of different lengths", () => {
    expect(issueFilterArraysEqual(["a"], ["a", "b"])).toBe(false);
  });

  it("returns false for arrays with different elements", () => {
    expect(issueFilterArraysEqual(["a", "c"], ["a", "b"])).toBe(false);
  });
});

// ============================================================================
// toggleIssueFilterValue
// ============================================================================

describe("toggleIssueFilterValue", () => {
  it("adds value when not present", () => {
    const result = toggleIssueFilterValue(["a", "b"], "c");
    expect(result).toContain("c");
    expect(result).toHaveLength(3);
  });

  it("removes value when already present", () => {
    const result = toggleIssueFilterValue(["a", "b", "c"], "b");
    expect(result).not.toContain("b");
    expect(result).toHaveLength(2);
  });

  it("returns new array (does not mutate input)", () => {
    const original = ["a", "b"];
    const result = toggleIssueFilterValue(original, "c");
    expect(original).toHaveLength(2);
    expect(result).not.toBe(original);
  });

  it("adds to empty array", () => {
    expect(toggleIssueFilterValue([], "x")).toEqual(["x"]);
  });

  it("removes last item leaving empty array", () => {
    expect(toggleIssueFilterValue(["x"], "x")).toEqual([]);
  });
});

// ============================================================================
// resolveIssueFilterWorkspaceId
// ============================================================================

describe("resolveIssueFilterWorkspaceId", () => {
  it("returns executionWorkspaceId when present", () => {
    const issue = { executionWorkspaceId: "exec-1", projectWorkspaceId: "proj-1" };
    expect(resolveIssueFilterWorkspaceId(issue)).toBe("exec-1");
  });

  it("falls back to projectWorkspaceId when executionWorkspaceId is null", () => {
    const issue = { executionWorkspaceId: null, projectWorkspaceId: "proj-2" };
    expect(resolveIssueFilterWorkspaceId(issue)).toBe("proj-2");
  });

  it("returns null when both are null", () => {
    const issue = { executionWorkspaceId: null, projectWorkspaceId: null };
    expect(resolveIssueFilterWorkspaceId(issue)).toBeNull();
  });

  it("returns null when both are null (fallback to null)", () => {
    // undefined resolves to null via the nullish coalescing chain
    const issue = { executionWorkspaceId: null as null, projectWorkspaceId: null as null };
    expect(resolveIssueFilterWorkspaceId(issue)).toBeNull();
  });
});

// ============================================================================
// makeIssue helper
// ============================================================================

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: overrides.id ?? "issue-1",
    companyId: "company-1",
    projectId: null,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Issue",
    description: null,
    status: "todo",
    priority: "medium",
    assigneeAgentId: null,
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: 1,
    identifier: "PAP-1",
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    labels: [],
    labelIds: [],
    originKind: "manual",
    createdAt: new Date("2026-04-15T00:00:00.000Z"),
    updatedAt: new Date("2026-04-15T00:00:00.000Z"),
    ...overrides,
  };
}

// ============================================================================
// applyIssueFilters
// ============================================================================

describe("applyIssueFilters", () => {
  it("returns all issues when all filters are empty", () => {
    const issues = [makeIssue({ id: "1" }), makeIssue({ id: "2" })];
    const result = applyIssueFilters(issues, defaultIssueFilterState);
    expect(result).toHaveLength(2);
  });

  it("filters by status", () => {
    const issues = [
      makeIssue({ id: "1", status: "todo" }),
      makeIssue({ id: "2", status: "done" }),
      makeIssue({ id: "3", status: "in_progress" }),
    ];
    const result = applyIssueFilters(issues, { ...defaultIssueFilterState, statuses: ["todo"] });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("filters by priority", () => {
    const issues = [
      makeIssue({ id: "1", priority: "high" }),
      makeIssue({ id: "2", priority: "low" }),
    ];
    const result = applyIssueFilters(issues, { ...defaultIssueFilterState, priorities: ["high"] });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("filters by assignee agent ID", () => {
    const issues = [
      makeIssue({ id: "1", assigneeAgentId: "agent-1" }),
      makeIssue({ id: "2", assigneeAgentId: "agent-2" }),
    ];
    const result = applyIssueFilters(issues, { ...defaultIssueFilterState, assignees: ["agent-1"] });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("filters unassigned issues with __unassigned sentinel", () => {
    const issues = [
      makeIssue({ id: "1", assigneeAgentId: null, assigneeUserId: null }),
      makeIssue({ id: "2", assigneeAgentId: "agent-1" }),
    ];
    const result = applyIssueFilters(issues, { ...defaultIssueFilterState, assignees: ["__unassigned"] });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("filters by current user with __me sentinel", () => {
    const issues = [
      makeIssue({ id: "1", assigneeUserId: "user-123" }),
      makeIssue({ id: "2", assigneeUserId: "user-456" }),
    ];
    const result = applyIssueFilters(
      issues,
      { ...defaultIssueFilterState, assignees: ["__me"] },
      "user-123",
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("filters by projectId", () => {
    const issues = [
      makeIssue({ id: "1", projectId: "proj-a" }),
      makeIssue({ id: "2", projectId: "proj-b" }),
      makeIssue({ id: "3", projectId: null }),
    ];
    const result = applyIssueFilters(issues, { ...defaultIssueFilterState, projects: ["proj-a"] });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("filters routine executions when hideRoutineExecutions is true", () => {
    const issues = [
      makeIssue({ id: "1", originKind: "manual" }),
      makeIssue({ id: "2", originKind: "routine_execution" }),
    ];
    const result = applyIssueFilters(
      issues,
      { ...defaultIssueFilterState, hideRoutineExecutions: true },
      undefined,
      true,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("shows routine executions when hideRoutineExecutions is false", () => {
    const issues = [
      makeIssue({ id: "1", originKind: "manual" }),
      makeIssue({ id: "2", originKind: "routine_execution" }),
    ];
    const result = applyIssueFilters(
      issues,
      { ...defaultIssueFilterState, hideRoutineExecutions: false },
      undefined,
      true,
    );
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no issues match", () => {
    const issues = [makeIssue({ status: "done" })];
    const result = applyIssueFilters(issues, { ...defaultIssueFilterState, statuses: ["todo"] });
    expect(result).toEqual([]);
  });
});

// ============================================================================
// countActiveIssueFilters
// ============================================================================

describe("countActiveIssueFilters", () => {
  it("returns 0 for default empty state", () => {
    expect(countActiveIssueFilters(defaultIssueFilterState)).toBe(0);
  });

  it("counts each non-empty filter array as 1", () => {
    const state = {
      ...defaultIssueFilterState,
      statuses: ["todo"],
      priorities: ["high"],
    };
    expect(countActiveIssueFilters(state)).toBe(2);
  });

  it("counts all 7 dimensions when all set", () => {
    const state = {
      statuses: ["todo"],
      priorities: ["high"],
      assignees: ["agent-1"],
      creators: ["user-1"],
      labels: ["label-1"],
      projects: ["proj-1"],
      workspaces: ["ws-1"],
      hideRoutineExecutions: false,
    };
    expect(countActiveIssueFilters(state)).toBe(7);
  });

  it("counts hideRoutineExecutions when flag is enabled and true", () => {
    const state = {
      ...defaultIssueFilterState,
      hideRoutineExecutions: true,
    };
    expect(countActiveIssueFilters(state, true)).toBe(1);
  });

  it("does not count hideRoutineExecutions when enableRoutineVisibilityFilter is false", () => {
    const state = {
      ...defaultIssueFilterState,
      hideRoutineExecutions: true,
    };
    expect(countActiveIssueFilters(state, false)).toBe(0);
  });
});

// ============================================================================
// Constant exports
// ============================================================================

describe("issueStatusOrder", () => {
  it("starts with in_progress", () => {
    expect(issueStatusOrder[0]).toBe("in_progress");
  });

  it("includes all expected statuses", () => {
    expect(issueStatusOrder).toContain("todo");
    expect(issueStatusOrder).toContain("backlog");
    expect(issueStatusOrder).toContain("done");
    expect(issueStatusOrder).toContain("cancelled");
    expect(issueStatusOrder).toContain("blocked");
  });
});

describe("issuePriorityOrder", () => {
  it("starts with critical", () => {
    expect(issuePriorityOrder[0]).toBe("critical");
  });

  it("ends with low", () => {
    expect(issuePriorityOrder[issuePriorityOrder.length - 1]).toBe("low");
  });
});

// ============================================================================
// issue filters (upstream additions)
// ============================================================================

describe("issue filters", () => {
  it("filters issues by creator across agents and users", () => {
    const issues = [
      makeIssue({ id: "agent-match", createdByAgentId: "agent-1" }),
      makeIssue({ id: "user-match", createdByUserId: "user-1" }),
      makeIssue({ id: "excluded", createdByAgentId: "agent-2", createdByUserId: "user-2" }),
    ];

    const filtered = applyIssueFilters(issues, {
      ...defaultIssueFilterState,
      creators: ["agent:agent-1", "user:user-1"],
    });

    expect(filtered.map((issue) => issue.id)).toEqual(["agent-match", "user-match"]);
  });

  it("counts creator filters as an active filter group", () => {
    expect(countActiveIssueFilters({
      ...defaultIssueFilterState,
      creators: ["user:user-1"],
    })).toBe(1);
  });

  it("filters issues to live issue ids when live-only is enabled", () => {
    const issues = [
      makeIssue({ id: "live-issue" }),
      makeIssue({ id: "idle-issue" }),
    ];

    const filtered = applyIssueFilters(
      issues,
      { ...defaultIssueFilterState, liveOnly: true },
      null,
      false,
      new Set(["live-issue"]),
    );

    expect(filtered.map((issue) => issue.id)).toEqual(["live-issue"]);
  });

  it("counts the live-only filter as an active filter group", () => {
    expect(countActiveIssueFilters({
      ...defaultIssueFilterState,
      liveOnly: true,
    })).toBe(1);
  });

  it("does not treat default project workspaces as workspace filter matches", () => {
    const issue = makeIssue({
      id: "default-workspace-issue",
      projectId: "project-1",
      projectWorkspaceId: "workspace-default",
    });
    const workspaceContext = {
      defaultProjectWorkspaceIdByProjectId: new Map([["project-1", "workspace-default"]]),
    };

    expect(resolveIssueFilterWorkspaceId(issue, workspaceContext)).toBeNull();
    expect(applyIssueFilters(
      [issue],
      { ...defaultIssueFilterState, workspaces: ["workspace-default"] },
      null,
      false,
      undefined,
      workspaceContext,
    )).toEqual([]);
  });

  it("does not treat shared default execution workspaces as workspace filter matches", () => {
    const issue = makeIssue({
      id: "shared-default-issue",
      projectId: "project-1",
      projectWorkspaceId: "workspace-default",
      executionWorkspaceId: "execution-shared-default",
    });
    const workspaceContext = {
      executionWorkspaceById: new Map([[
        "execution-shared-default",
        { mode: "shared_workspace", projectWorkspaceId: "workspace-default" },
      ]]),
      defaultProjectWorkspaceIdByProjectId: new Map([["project-1", "workspace-default"]]),
    };

    expect(resolveIssueFilterWorkspaceId(issue, workspaceContext)).toBeNull();
    expect(shouldIncludeIssueFilterWorkspaceOption(
      { id: "execution-shared-default", mode: "shared_workspace", projectWorkspaceId: "workspace-default" },
      new Set(["workspace-default"]),
    )).toBe(false);
  });

  it("keeps non-default project and isolated execution workspaces filterable", () => {
    const featureIssue = makeIssue({
      id: "feature-issue",
      projectId: "project-1",
      projectWorkspaceId: "workspace-feature",
    });
    const executionIssue = makeIssue({
      id: "execution-issue",
      projectId: "project-1",
      projectWorkspaceId: "workspace-default",
      executionWorkspaceId: "execution-isolated",
    });
    const workspaceContext = {
      executionWorkspaceById: new Map([[
        "execution-isolated",
        { mode: "isolated_workspace", projectWorkspaceId: "workspace-default" },
      ]]),
      defaultProjectWorkspaceIdByProjectId: new Map([["project-1", "workspace-default"]]),
    };

    expect(resolveIssueFilterWorkspaceId(featureIssue, workspaceContext)).toBe("workspace-feature");
    expect(resolveIssueFilterWorkspaceId(executionIssue, workspaceContext)).toBe("execution-isolated");
    expect(shouldIncludeIssueFilterWorkspaceOption({ id: "workspace-feature" }, new Set(["workspace-default"]))).toBe(true);
    expect(shouldIncludeIssueFilterWorkspaceOption(
      { id: "execution-isolated", mode: "isolated_workspace", projectWorkspaceId: "workspace-default" },
      new Set(["workspace-default"]),
    )).toBe(true);
  });
});
