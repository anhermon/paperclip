import { describe, expect, it } from "vitest";
import {
  defaultAgentPermissions,
  normalizeAgentPermissions,
} from "./agent-permissions.js";

// ============================================================================
// defaultAgentPermissions
// ============================================================================

describe("defaultAgentPermissions", () => {
  it("grants canCreateAgents=true for context 'create' (non-low-trust)", () => {
    const perms = defaultAgentPermissions({ context: "create" });
    expect(perms.canCreateAgents).toBe(true);
  });

  it("grants canCreateAgents=false for context 'create' when lowTrust=true", () => {
    const perms = defaultAgentPermissions({ context: "create", lowTrust: true });
    expect(perms.canCreateAgents).toBe(false);
  });

  it("grants canCreateAgents=false for context 'stored'", () => {
    const perms = defaultAgentPermissions({ context: "stored" });
    expect(perms.canCreateAgents).toBe(false);
  });

  it("grants canCreateAgents=false with no options (defaults to stored)", () => {
    const perms = defaultAgentPermissions();
    expect(perms.canCreateAgents).toBe(false);
  });

  it("returns an object with at least canCreateAgents", () => {
    const perms = defaultAgentPermissions({ context: "create" });
    expect(perms).toHaveProperty("canCreateAgents");
  });
});

// ============================================================================
// normalizeAgentPermissions
// ============================================================================

describe("normalizeAgentPermissions", () => {
  it("uses stored canCreateAgents=true when explicitly set", () => {
    const perms = normalizeAgentPermissions({ canCreateAgents: true }, { context: "stored" });
    expect(perms.canCreateAgents).toBe(true);
  });

  it("uses stored canCreateAgents=false when explicitly set", () => {
    const perms = normalizeAgentPermissions({ canCreateAgents: false }, { context: "create" });
    expect(perms.canCreateAgents).toBe(false);
  });

  it("falls back to create default when canCreateAgents is not in stored object", () => {
    const perms = normalizeAgentPermissions({}, { context: "create" });
    expect(perms.canCreateAgents).toBe(true);
  });

  it("falls back to stored default when field is missing in stored context", () => {
    const perms = normalizeAgentPermissions({}, { context: "stored" });
    expect(perms.canCreateAgents).toBe(false);
  });

  it("falls back to create default when stored permissions is null", () => {
    const perms = normalizeAgentPermissions(null, { context: "create" });
    expect(perms.canCreateAgents).toBe(true);
  });

  it("falls back to create default when stored permissions is undefined", () => {
    const perms = normalizeAgentPermissions(undefined, { context: "create" });
    expect(perms.canCreateAgents).toBe(true);
  });

  it("falls back to create default when stored permissions is an array", () => {
    const perms = normalizeAgentPermissions([], { context: "create" });
    expect(perms.canCreateAgents).toBe(true);
  });

  it("falls back to create default when stored permissions is a string", () => {
    const perms = normalizeAgentPermissions("yes", { context: "create" });
    expect(perms.canCreateAgents).toBe(true);
  });

  it("falls back to stored default when canCreateAgents is a non-boolean value", () => {
    // stored value is string "true" — not a boolean, should use context default
    const perms = normalizeAgentPermissions({ canCreateAgents: "true" }, { context: "stored" });
    expect(perms.canCreateAgents).toBe(false); // stored context default
  });

  it("treats canCreateAgents=0 (non-boolean) as missing and uses create default", () => {
    const perms = normalizeAgentPermissions({ canCreateAgents: 0 }, { context: "create" });
    expect(perms.canCreateAgents).toBe(true); // create context default for non-low-trust
  });
});
