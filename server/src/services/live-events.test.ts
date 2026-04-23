import { afterEach, describe, expect, it, vi } from "vitest";
import {
  publishGlobalLiveEvent,
  publishLiveEvent,
  subscribeCompanyLiveEvents,
  subscribeGlobalLiveEvents,
} from "./live-events.js";

// All subscriptions created in tests are cleaned up in afterEach so
// module-level emitter state does not leak between tests.
const cleanupFns: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanupFns.splice(0)) {
    cleanup();
  }
  vi.clearAllMocks();
});

// ============================================================================
// publishLiveEvent — basic delivery
// ============================================================================

describe("publishLiveEvent — event delivery", () => {
  it("delivers the event to a subscribed listener", () => {
    const listener = vi.fn();
    cleanupFns.push(subscribeCompanyLiveEvents("company-1", listener));

    publishLiveEvent({ companyId: "company-1", type: "issue.updated" });

    expect(listener).toHaveBeenCalledOnce();
  });

  it("does not deliver to a listener for a different company", () => {
    const listener = vi.fn();
    cleanupFns.push(subscribeCompanyLiveEvents("company-B", listener));

    publishLiveEvent({ companyId: "company-A", type: "issue.updated" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not deliver company events to global subscribers", () => {
    const listener = vi.fn();
    cleanupFns.push(subscribeGlobalLiveEvents(listener));

    publishLiveEvent({ companyId: "company-1", type: "issue.updated" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("delivers to multiple subscribers of the same company", () => {
    const a = vi.fn();
    const b = vi.fn();
    cleanupFns.push(subscribeCompanyLiveEvents("co", a));
    cleanupFns.push(subscribeCompanyLiveEvents("co", b));

    publishLiveEvent({ companyId: "co", type: "agent.updated" });

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// publishLiveEvent — returned event shape
// ============================================================================

describe("publishLiveEvent — returned event shape", () => {
  it("returns an event with the correct companyId", () => {
    const event = publishLiveEvent({ companyId: "co-42", type: "issue.created" });
    expect(event.companyId).toBe("co-42");
  });

  it("returns an event with the correct type", () => {
    const event = publishLiveEvent({ companyId: "co", type: "agent.updated" });
    expect(event.type).toBe("agent.updated");
  });

  it("returns an event with a numeric id", () => {
    const event = publishLiveEvent({ companyId: "co", type: "issue.updated" });
    expect(typeof event.id).toBe("number");
    expect(event.id).toBeGreaterThan(0);
  });

  it("returns incremented id on successive calls", () => {
    const e1 = publishLiveEvent({ companyId: "co", type: "issue.updated" });
    const e2 = publishLiveEvent({ companyId: "co", type: "issue.updated" });
    expect(e2.id).toBe(e1.id + 1);
  });

  it("returns an event with a createdAt ISO string", () => {
    const event = publishLiveEvent({ companyId: "co", type: "issue.created" });
    expect(() => new Date(event.createdAt)).not.toThrow();
    expect(new Date(event.createdAt).toISOString()).toBe(event.createdAt);
  });

  it("returns an event with the provided payload", () => {
    const payload = { issueId: "issue-1", title: "Fix bug" };
    const event = publishLiveEvent({ companyId: "co", type: "issue.updated", payload });
    expect(event.payload).toEqual(payload);
  });

  it("defaults payload to empty object when not provided", () => {
    const event = publishLiveEvent({ companyId: "co", type: "issue.created" });
    expect(event.payload).toEqual({});
  });
});

// ============================================================================
// publishGlobalLiveEvent — delivery
// ============================================================================

describe("publishGlobalLiveEvent — event delivery", () => {
  it("delivers to a global subscriber", () => {
    const listener = vi.fn();
    cleanupFns.push(subscribeGlobalLiveEvents(listener));

    publishGlobalLiveEvent({ type: "agent.updated" });

    expect(listener).toHaveBeenCalledOnce();
  });

  it("does not deliver global events to company subscribers", () => {
    const listener = vi.fn();
    cleanupFns.push(subscribeCompanyLiveEvents("company-1", listener));

    publishGlobalLiveEvent({ type: "agent.updated" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("sets companyId to '*' on global events", () => {
    const event = publishGlobalLiveEvent({ type: "agent.updated" });
    expect(event.companyId).toBe("*");
  });

  it("delivers to multiple global subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    cleanupFns.push(subscribeGlobalLiveEvents(a));
    cleanupFns.push(subscribeGlobalLiveEvents(b));

    publishGlobalLiveEvent({ type: "agent.updated" });

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// subscribeCompanyLiveEvents / subscribeGlobalLiveEvents — unsubscribe
// ============================================================================

describe("live-events — unsubscribe", () => {
  it("unsubscribe stops company event delivery", () => {
    const listener = vi.fn();
    const unsub = subscribeCompanyLiveEvents("co", listener);

    unsub();
    publishLiveEvent({ companyId: "co", type: "issue.updated" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("unsubscribe stops global event delivery", () => {
    const listener = vi.fn();
    const unsub = subscribeGlobalLiveEvents(listener);

    unsub();
    publishGlobalLiveEvent({ type: "agent.updated" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("unsubscribing one listener does not affect others on the same company", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeCompanyLiveEvents("co", a);
    cleanupFns.push(subscribeCompanyLiveEvents("co", b));

    unsubA();
    publishLiveEvent({ companyId: "co", type: "issue.updated" });

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });
});
