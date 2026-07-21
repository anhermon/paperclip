import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Test the pure/side-effect-free helpers extracted from budgets.ts.
// These functions are not exported, so we exercise them through the observable
// shapes they produce. Where the helpers are truly private we replicate the
// minimal logic inline so the tests still document intent without coupling to
// internals.
// ---------------------------------------------------------------------------

// ─── Replicated pure helpers (matching budgets.ts exactly) ─────────────────

function currentUtcMonthWindow(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

function resolveWindow(windowKind: "monthly" | "lifetime", now = new Date()) {
  if (windowKind === "lifetime") {
    return {
      start: new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(9999, 0, 1, 0, 0, 0, 0)),
    };
  }
  return currentUtcMonthWindow(now);
}

function budgetStatusFromObserved(
  observedAmount: number,
  amount: number,
  warnPercent: number,
): "ok" | "warning" | "hard_stop" {
  if (amount <= 0) return "ok";
  if (observedAmount >= amount) return "hard_stop";
  if (observedAmount >= Math.ceil((amount * warnPercent) / 100)) return "warning";
  return "ok";
}

function normalizeScopeName(scopeType: "company" | "agent" | "project", name: string) {
  if (scopeType === "company") return name;
  return name.trim().length > 0 ? name : scopeType;
}

// ─── currentUtcMonthWindow ──────────────────────────────────────────────────

describe("currentUtcMonthWindow", () => {
  it("returns start as the first millisecond of the month", () => {
    const { start } = currentUtcMonthWindow(new Date("2024-03-15T12:34:56Z"));
    expect(start.toISOString()).toBe("2024-03-01T00:00:00.000Z");
  });

  it("returns end as the first millisecond of the next month", () => {
    const { end } = currentUtcMonthWindow(new Date("2024-03-15T12:34:56Z"));
    expect(end.toISOString()).toBe("2024-04-01T00:00:00.000Z");
  });

  it("handles December → wraps to January of the next year", () => {
    const { start, end } = currentUtcMonthWindow(new Date("2024-12-25T00:00:00Z"));
    expect(start.toISOString()).toBe("2024-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("handles January correctly", () => {
    const { start, end } = currentUtcMonthWindow(new Date("2024-01-01T00:00:00Z"));
    expect(start.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2024-02-01T00:00:00.000Z");
  });

  it("ignores intra-month time — same window for all days of the month", () => {
    const first = currentUtcMonthWindow(new Date("2024-06-01T00:00:00Z"));
    const mid = currentUtcMonthWindow(new Date("2024-06-15T23:59:59Z"));
    const last = currentUtcMonthWindow(new Date("2024-06-30T23:59:59Z"));
    expect(first.start.getTime()).toBe(mid.start.getTime());
    expect(first.start.getTime()).toBe(last.start.getTime());
    expect(first.end.getTime()).toBe(mid.end.getTime());
    expect(first.end.getTime()).toBe(last.end.getTime());
  });

  it("uses current time when no argument is provided (smoke test)", () => {
    const result = currentUtcMonthWindow();
    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
    expect(result.end.getTime()).toBeGreaterThan(result.start.getTime());
  });
});

// ─── resolveWindow ──────────────────────────────────────────────────────────

describe("resolveWindow", () => {
  it("returns monthly window for 'monthly' kind", () => {
    const now = new Date("2024-05-20T10:00:00Z");
    const { start, end } = resolveWindow("monthly", now);
    expect(start.toISOString()).toBe("2024-05-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2024-06-01T00:00:00.000Z");
  });

  it("returns lifetime window spanning epoch to 9999", () => {
    const { start, end } = resolveWindow("lifetime", new Date());
    expect(start.toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(end.getUTCFullYear()).toBe(9999);
  });

  it("lifetime start is before any plausible observed date", () => {
    const { start } = resolveWindow("lifetime");
    expect(start.getTime()).toBeLessThan(new Date("2000-01-01").getTime());
  });

  it("lifetime end is after any plausible observed date", () => {
    const { end } = resolveWindow("lifetime");
    expect(end.getTime()).toBeGreaterThan(new Date("2100-01-01").getTime());
  });
});

// ─── budgetStatusFromObserved ───────────────────────────────────────────────

describe("budgetStatusFromObserved", () => {
  it("returns 'ok' when amount is zero (disabled policy)", () => {
    expect(budgetStatusFromObserved(9999, 0, 80)).toBe("ok");
  });

  it("returns 'ok' when amount is negative (disabled policy)", () => {
    expect(budgetStatusFromObserved(100, -1, 80)).toBe("ok");
  });

  it("returns 'ok' well below warn threshold", () => {
    expect(budgetStatusFromObserved(0, 100, 80)).toBe("ok");
    expect(budgetStatusFromObserved(50, 100, 80)).toBe("ok");
  });

  it("returns 'warning' at the warn threshold (ceiling boundary)", () => {
    // ceil(100 * 80 / 100) = 80
    expect(budgetStatusFromObserved(80, 100, 80)).toBe("warning");
  });

  it("returns 'warning' between warn threshold and limit", () => {
    expect(budgetStatusFromObserved(85, 100, 80)).toBe("warning");
    expect(budgetStatusFromObserved(99, 100, 80)).toBe("warning");
  });

  it("returns 'hard_stop' at exactly the limit", () => {
    expect(budgetStatusFromObserved(100, 100, 80)).toBe("hard_stop");
  });

  it("returns 'hard_stop' above the limit", () => {
    expect(budgetStatusFromObserved(150, 100, 80)).toBe("hard_stop");
  });

  it("handles fractional warn threshold via ceiling", () => {
    // ceil(10 * 33 / 100) = ceil(3.3) = 4
    expect(budgetStatusFromObserved(3, 10, 33)).toBe("ok");
    expect(budgetStatusFromObserved(4, 10, 33)).toBe("warning");
  });

  it("warn threshold of 100% means warning only kicks in at limit", () => {
    // ceil(100 * 100 / 100) = 100 — same as hard_stop boundary
    expect(budgetStatusFromObserved(99, 100, 100)).toBe("ok");
    expect(budgetStatusFromObserved(100, 100, 100)).toBe("hard_stop");
  });
});

// ─── normalizeScopeName ─────────────────────────────────────────────────────

describe("normalizeScopeName", () => {
  it("returns the name unchanged for 'company' scope", () => {
    expect(normalizeScopeName("company", "Acme Inc")).toBe("Acme Inc");
    expect(normalizeScopeName("company", "")).toBe("");
  });

  it("returns the name for 'agent' scope when non-empty", () => {
    expect(normalizeScopeName("agent", "Claude")).toBe("Claude");
  });

  it("falls back to scope type for 'agent' scope when name is empty", () => {
    expect(normalizeScopeName("agent", "")).toBe("agent");
    expect(normalizeScopeName("agent", "   ")).toBe("agent");
  });

  it("falls back to scope type for 'project' scope when name is empty", () => {
    expect(normalizeScopeName("project", "")).toBe("project");
    expect(normalizeScopeName("project", "  ")).toBe("project");
  });

  it("returns trimmed? — name is returned as-is (no trim on non-empty)", () => {
    // The implementation only trims when checking emptiness, not the return value
    expect(normalizeScopeName("agent", "  My Agent  ")).toBe("  My Agent  ");
  });
});
