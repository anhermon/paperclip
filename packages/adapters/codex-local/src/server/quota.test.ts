import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { secondsToWindowLabel, mapCodexRpcQuota, codexHomeDir } from "./quota.js";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// secondsToWindowLabel
// ---------------------------------------------------------------------------

describe("secondsToWindowLabel", () => {
  it("returns fallback when seconds is null", () => {
    expect(secondsToWindowLabel(null, "N/A")).toBe("N/A");
  });

  it("returns fallback when seconds is undefined", () => {
    expect(secondsToWindowLabel(undefined, "unknown")).toBe("unknown");
  });

  it("returns '5h' for values less than 6 hours", () => {
    expect(secondsToWindowLabel(3600, "N/A")).toBe("5h");    // 1h
    expect(secondsToWindowLabel(18000, "N/A")).toBe("5h");   // 5h exactly
  });

  it("returns '24h' for values between 6 and 24 hours inclusive", () => {
    expect(secondsToWindowLabel(21600, "N/A")).toBe("24h");  // exactly 6h
    expect(secondsToWindowLabel(86400, "N/A")).toBe("24h");  // exactly 24h
  });

  it("returns '7d' for values between 25 and 168 hours inclusive", () => {
    expect(secondsToWindowLabel(90000, "N/A")).toBe("7d");   // 25h
    expect(secondsToWindowLabel(604800, "N/A")).toBe("7d");  // exactly 168h (7d)
  });

  it("returns '{n}d' for values beyond 168 hours", () => {
    expect(secondsToWindowLabel(864000, "N/A")).toBe("10d"); // 240h = 10d
    expect(secondsToWindowLabel(2592000, "N/A")).toBe("30d"); // 720h = 30d
  });
});

// ---------------------------------------------------------------------------
// codexHomeDir
// ---------------------------------------------------------------------------

describe("codexHomeDir", () => {
  let origCodexHome: string | undefined;

  beforeEach(() => {
    origCodexHome = process.env.CODEX_HOME;
  });

  afterEach(() => {
    if (origCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = origCodexHome;
    }
  });

  it("returns CODEX_HOME env value when set", () => {
    process.env.CODEX_HOME = "/custom/codex";
    expect(codexHomeDir()).toBe("/custom/codex");
  });

  it("trims the CODEX_HOME value", () => {
    process.env.CODEX_HOME = "  /custom/codex  ";
    expect(codexHomeDir()).toBe("/custom/codex");
  });

  it("falls back to ~/.codex when CODEX_HOME is not set", () => {
    delete process.env.CODEX_HOME;
    expect(codexHomeDir()).toBe(path.join(os.homedir(), ".codex"));
  });

  it("falls back to ~/.codex when CODEX_HOME is empty string", () => {
    process.env.CODEX_HOME = "";
    expect(codexHomeDir()).toBe(path.join(os.homedir(), ".codex"));
  });

  it("falls back to ~/.codex when CODEX_HOME is whitespace-only", () => {
    process.env.CODEX_HOME = "   ";
    expect(codexHomeDir()).toBe(path.join(os.homedir(), ".codex"));
  });
});

// ---------------------------------------------------------------------------
// mapCodexRpcQuota
// ---------------------------------------------------------------------------

describe("mapCodexRpcQuota", () => {
  it("returns empty windows and null email/planType for empty result", () => {
    const result = mapCodexRpcQuota({});
    expect(result.windows).toEqual([]);
    expect(result.email).toBeNull();
    expect(result.planType).toBeNull();
  });

  it("maps primary window from rateLimits to a 5h window entry", () => {
    const result = mapCodexRpcQuota({
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 50, windowDurationMins: null, resetsAt: null },
      },
    });
    const primary = result.windows.find((w) => w.label === "5h limit");
    expect(primary).toBeDefined();
    expect(primary?.usedPercent).toBe(50);
  });

  it("maps secondary window to a 7d/weekly window entry", () => {
    const result = mapCodexRpcQuota({
      rateLimits: {
        limitId: "codex",
        secondary: { usedPercent: 80, windowDurationMins: null, resetsAt: null },
      },
    });
    const secondary = result.windows.find((w) => w.label === "Weekly limit");
    expect(secondary).toBeDefined();
    expect(secondary?.usedPercent).toBe(80);
  });

  it("normalizes usedPercent: values < 1 are treated as fractions and multiplied by 100", () => {
    const result = mapCodexRpcQuota({
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 0.75, windowDurationMins: null, resetsAt: null },
      },
    });
    const primary = result.windows.find((w) => w.label === "5h limit");
    expect(primary?.usedPercent).toBe(75);
  });

  it("caps usedPercent at 100", () => {
    const result = mapCodexRpcQuota({
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 150, windowDurationMins: null, resetsAt: null },
      },
    });
    const primary = result.windows.find((w) => w.label === "5h limit");
    expect(primary?.usedPercent).toBe(100);
  });

  it("adds a Credits window when credits are present and not unlimited", () => {
    const result = mapCodexRpcQuota({
      rateLimits: {
        limitId: "codex",
        credits: { hasCredits: true, unlimited: false, balance: 5.5 },
      },
    });
    const credits = result.windows.find((w) => w.label === "Credits");
    expect(credits).toBeDefined();
    expect(credits?.valueLabel).toBe("$5.50 remaining");
  });

  it("does not add Credits window when credits are unlimited", () => {
    const result = mapCodexRpcQuota({
      rateLimits: {
        limitId: "codex",
        credits: { unlimited: true, balance: 100 },
      },
    });
    const credits = result.windows.find((w) => w.label === "Credits");
    expect(credits).toBeUndefined();
  });

  it("extracts email from account.account.email", () => {
    const result = mapCodexRpcQuota(
      {},
      { account: { email: "user@example.com", type: "paid", planType: null } },
    );
    expect(result.email).toBe("user@example.com");
  });

  it("extracts planType from account.account.planType", () => {
    const result = mapCodexRpcQuota(
      {},
      { account: { email: null, type: null, planType: "pro" } },
    );
    expect(result.planType).toBe("pro");
  });

  it("falls back to rootLimit planType when account has no planType", () => {
    const result = mapCodexRpcQuota(
      { rateLimits: { limitId: "codex", planType: "plus" } },
      { account: { email: null, planType: null } },
    );
    expect(result.planType).toBe("plus");
  });

  it("converts resetsAt unix seconds to ISO string", () => {
    const unix = 1_700_000_000;
    const result = mapCodexRpcQuota({
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 10, windowDurationMins: null, resetsAt: unix },
      },
    });
    const primary = result.windows.find((w) => w.label === "5h limit");
    expect(primary?.resetsAt).toBe(new Date(unix * 1000).toISOString());
  });
});
