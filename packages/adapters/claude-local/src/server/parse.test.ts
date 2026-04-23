import { describe, expect, it } from "vitest";
import {
  parseClaudeStreamJson,
  extractClaudeLoginUrl,
  detectClaudeLoginRequired,
  detectClaudeRateLimited,
  describeClaudeFailure,
  isClaudeMaxTurnsResult,
  isClaudeUnknownSessionError,
} from "./parse.js";

// ============================================================================
// parseClaudeStreamJson — empty / no result
// ============================================================================

describe("parseClaudeStreamJson — empty input", () => {
  it("returns nulls for empty stdout", () => {
    const result = parseClaudeStreamJson("");
    expect(result.sessionId).toBeNull();
    expect(result.model).toBe("");
    expect(result.costUsd).toBeNull();
    expect(result.usage).toBeNull();
    expect(result.summary).toBe("");
    expect(result.resultJson).toBeNull();
    expect(result.skillInvocations).toEqual([]);
  });

  it("returns nulls when stdout has only blank lines", () => {
    const result = parseClaudeStreamJson("\n\n   \n");
    expect(result.sessionId).toBeNull();
    expect(result.resultJson).toBeNull();
  });

  it("ignores non-JSON lines", () => {
    const result = parseClaudeStreamJson("not json\nstill not json\n");
    expect(result.sessionId).toBeNull();
    expect(result.resultJson).toBeNull();
  });
});

// ============================================================================
// parseClaudeStreamJson — session / model extraction
// ============================================================================

describe("parseClaudeStreamJson — sessionId and model", () => {
  it("reads sessionId and model from system init event", () => {
    const lines = [
      JSON.stringify({ type: "system", subtype: "init", session_id: "sess-abc", model: "claude-opus-4-6" }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.sessionId).toBe("sess-abc");
    expect(result.model).toBe("claude-opus-4-6");
  });

  it("reads sessionId from assistant event", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "sess-from-assistant",
        message: { content: [{ type: "text", text: "hi" }] },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.sessionId).toBe("sess-from-assistant");
  });

  it("reads sessionId from result event", () => {
    const lines = [
      JSON.stringify({
        type: "result",
        session_id: "sess-result",
        result: "done",
        total_cost_usd: 0,
        usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0 },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.sessionId).toBe("sess-result");
  });

  it("keeps earlier sessionId when later event has empty session_id", () => {
    const lines = [
      JSON.stringify({ type: "system", subtype: "init", session_id: "first", model: "m" }),
      JSON.stringify({
        type: "result",
        session_id: "",
        result: "",
        total_cost_usd: 0,
        usage: {},
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.sessionId).toBe("first");
  });
});

// ============================================================================
// parseClaudeStreamJson — assistant text accumulation
// ============================================================================

describe("parseClaudeStreamJson — assistant text", () => {
  it("collects text from assistant content blocks", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: { content: [{ type: "text", text: "Hello world" }] },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.summary).toContain("Hello world");
  });

  it("joins multiple assistant texts with double newlines", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: { content: [{ type: "text", text: "First" }] },
      }),
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: { content: [{ type: "text", text: "Second" }] },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.summary).toBe("First\n\nSecond");
  });

  it("skips non-text content blocks", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: { content: [{ type: "thinking", thinking: "private" }] },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.summary).toBe("");
  });

  it("uses result.result text as summary when no assistant texts", () => {
    const lines = [
      JSON.stringify({
        type: "result",
        session_id: "s",
        result: "Final answer",
        total_cost_usd: 0.001,
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.summary).toBe("Final answer");
  });

  it("prefers result.result over accumulated assistant texts for summary", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: { content: [{ type: "text", text: "Intermediate" }] },
      }),
      JSON.stringify({
        type: "result",
        session_id: "s",
        result: "Final",
        total_cost_usd: 0,
        usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0 },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.summary).toBe("Final");
  });
});

// ============================================================================
// parseClaudeStreamJson — usage and cost
// ============================================================================

describe("parseClaudeStreamJson — usage and cost", () => {
  it("parses usage tokens and cost from result event", () => {
    const lines = [
      JSON.stringify({
        type: "result",
        session_id: "s",
        result: "ok",
        total_cost_usd: 0.0042,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 20,
        },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.costUsd).toBe(0.0042);
    expect(result.usage).toEqual({
      inputTokens: 100,
      cachedInputTokens: 20,
      outputTokens: 50,
    });
  });

  it("includes cacheCreationInputTokens when non-zero", () => {
    const lines = [
      JSON.stringify({
        type: "result",
        session_id: "s",
        result: "",
        total_cost_usd: 0,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 200,
        },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.usage?.cacheCreationInputTokens).toBe(200);
  });

  it("omits cacheCreationInputTokens when zero", () => {
    const lines = [
      JSON.stringify({
        type: "result",
        session_id: "s",
        result: "",
        total_cost_usd: 0,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.usage).not.toHaveProperty("cacheCreationInputTokens");
  });

  it("returns null costUsd when total_cost_usd is missing", () => {
    const lines = [
      JSON.stringify({
        type: "result",
        session_id: "s",
        result: "",
        usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0 },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.costUsd).toBeNull();
  });

  it("returns null costUsd when total_cost_usd is not a finite number", () => {
    const lines = [
      JSON.stringify({
        type: "result",
        session_id: "s",
        result: "",
        total_cost_usd: "not-a-number",
        usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0 },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.costUsd).toBeNull();
  });
});

// ============================================================================
// parseClaudeStreamJson — skill invocation tracking
// ============================================================================

describe("parseClaudeStreamJson — skill invocations", () => {
  it("records successful skill invocation when tool_result follows tool_use", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: {
          content: [
            { type: "tool_use", id: "tu-1", name: "Skill", input: { skill: "my-skill" } },
          ],
        },
      }),
      JSON.stringify({
        type: "tool_result",
        tool_use_id: "tu-1",
        is_error: false,
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.skillInvocations).toHaveLength(1);
    expect(result.skillInvocations[0]).toMatchObject({
      skillName: "my-skill",
      status: "success",
    });
    expect(result.skillInvocations[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records error skill invocation when is_error is true", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: {
          content: [
            { type: "tool_use", id: "tu-2", name: "Skill", input: { skill: "failing-skill" } },
          ],
        },
      }),
      JSON.stringify({
        type: "tool_result",
        tool_use_id: "tu-2",
        is_error: true,
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.skillInvocations[0]).toMatchObject({
      skillName: "failing-skill",
      status: "error",
    });
  });

  it("records orphaned skill (no tool_result) as error", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: {
          content: [
            { type: "tool_use", id: "tu-orphan", name: "Skill", input: { skill: "orphan-skill" } },
          ],
        },
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.skillInvocations).toHaveLength(1);
    expect(result.skillInvocations[0]).toMatchObject({
      skillName: "orphan-skill",
      status: "error",
    });
  });

  it("does not track non-Skill tool_use blocks", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: {
          content: [
            { type: "tool_use", id: "tu-bash", name: "Bash", input: { command: "ls" } },
          ],
        },
      }),
      JSON.stringify({
        type: "tool_result",
        tool_use_id: "tu-bash",
        is_error: false,
      }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.skillInvocations).toHaveLength(0);
  });

  it("tracks multiple skill invocations independently", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: {
          content: [
            { type: "tool_use", id: "tu-a", name: "Skill", input: { skill: "skill-a" } },
            { type: "tool_use", id: "tu-b", name: "Skill", input: { skill: "skill-b" } },
          ],
        },
      }),
      JSON.stringify({ type: "tool_result", tool_use_id: "tu-a", is_error: false }),
      JSON.stringify({ type: "tool_result", tool_use_id: "tu-b", is_error: true }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.skillInvocations).toHaveLength(2);
    const skillA = result.skillInvocations.find((s) => s.skillName === "skill-a");
    const skillB = result.skillInvocations.find((s) => s.skillName === "skill-b");
    expect(skillA?.status).toBe("success");
    expect(skillB?.status).toBe("error");
  });

  it("uses 'unknown' as skill name when skill input is missing", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        session_id: "s",
        message: {
          content: [
            { type: "tool_use", id: "tu-x", name: "Skill", input: {} },
          ],
        },
      }),
      JSON.stringify({ type: "tool_result", tool_use_id: "tu-x", is_error: false }),
    ];
    const result = parseClaudeStreamJson(lines.join("\n"));
    expect(result.skillInvocations[0].skillName).toBe("unknown");
  });
});

// ============================================================================
// extractClaudeLoginUrl
// ============================================================================

describe("extractClaudeLoginUrl", () => {
  it("returns null for empty string", () => {
    expect(extractClaudeLoginUrl("")).toBeNull();
  });

  it("returns null when no URLs present", () => {
    expect(extractClaudeLoginUrl("please run claude login to continue")).toBeNull();
  });

  it("extracts anthropic URL from text", () => {
    const text = "Please visit https://claude.ai/auth/login to authenticate";
    const url = extractClaudeLoginUrl(text);
    expect(url).toContain("claude.ai");
  });

  it("extracts auth URL from text", () => {
    const text = "Open https://auth.example.com/login?token=abc to continue";
    const url = extractClaudeLoginUrl(text);
    expect(url).toContain("auth.example.com");
  });

  it("returns first URL when no auth/claude/anthropic URL found", () => {
    const text = "Visit https://example.com/page for more info";
    const url = extractClaudeLoginUrl(text);
    expect(url).toContain("example.com");
  });

  it("strips trailing punctuation from URL", () => {
    const text = "See https://claude.ai/login.";
    const url = extractClaudeLoginUrl(text);
    expect(url).not.toMatch(/\.$/);
  });
});

// ============================================================================
// detectClaudeLoginRequired
// ============================================================================

describe("detectClaudeLoginRequired", () => {
  it("returns requiresLogin=false for normal output", () => {
    const result = detectClaudeLoginRequired({
      parsed: { result: "Task complete" },
      stdout: "",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(false);
  });

  it("detects 'not logged in' in result text", () => {
    const result = detectClaudeLoginRequired({
      parsed: { result: "Error: not logged in" },
      stdout: "",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(true);
  });

  it("detects 'please run `claude login`' in stdout", () => {
    const result = detectClaudeLoginRequired({
      parsed: null,
      stdout: "please run `claude login` to authenticate",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(true);
  });

  it("detects 'Authentication required' in stderr", () => {
    const result = detectClaudeLoginRequired({
      parsed: null,
      stdout: "",
      stderr: "Authentication required",
    });
    expect(result.requiresLogin).toBe(true);
  });

  it("detects 'unauthorized' in error messages", () => {
    const result = detectClaudeLoginRequired({
      parsed: { errors: ["unauthorized"] },
      stdout: "",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(true);
  });

  it("extracts loginUrl from stdout when requiresLogin is true", () => {
    const result = detectClaudeLoginRequired({
      parsed: { result: "not logged in" },
      stdout: "Visit https://claude.ai/auth to login",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(true);
    expect(result.loginUrl).toContain("claude.ai");
  });
});

// ============================================================================
// detectClaudeRateLimited
// ============================================================================

describe("detectClaudeRateLimited", () => {
  it("returns false for normal output", () => {
    expect(
      detectClaudeRateLimited({ parsed: { result: "done" }, stdout: "", stderr: "" })
    ).toBe(false);
  });

  it("detects rate_limit_event in stdout JSON line", () => {
    const line = JSON.stringify({ type: "rate_limit_event" });
    expect(
      detectClaudeRateLimited({ parsed: null, stdout: line, stderr: "" })
    ).toBe(true);
  });

  it("detects rate_limit_info in stdout JSON line", () => {
    const line = JSON.stringify({ type: "other", rate_limit_info: { reset_at: "2026-01-01" } });
    expect(
      detectClaudeRateLimited({ parsed: null, stdout: line, stderr: "" })
    ).toBe(true);
  });

  it("detects 'too many requests' in result text", () => {
    expect(
      detectClaudeRateLimited({
        parsed: { result: "Error: too many requests" },
        stdout: "",
        stderr: "",
      })
    ).toBe(true);
  });

  it("detects 'quota exceeded' in stderr", () => {
    expect(
      detectClaudeRateLimited({ parsed: null, stdout: "", stderr: "quota exceeded" })
    ).toBe(true);
  });

  it("detects '429' in any message", () => {
    expect(
      detectClaudeRateLimited({ parsed: null, stdout: "HTTP 429 error", stderr: "" })
    ).toBe(true);
  });

  it("detects 'usage limit reached'", () => {
    expect(
      detectClaudeRateLimited({ parsed: { result: "usage limit reached" }, stdout: "", stderr: "" })
    ).toBe(true);
  });

  it("detects 'out of extra usage'", () => {
    expect(
      detectClaudeRateLimited({ parsed: null, stdout: "out of extra usage for this period", stderr: "" })
    ).toBe(true);
  });
});

// ============================================================================
// describeClaudeFailure
// ============================================================================

describe("describeClaudeFailure", () => {
  it("returns null when no meaningful info present", () => {
    expect(describeClaudeFailure({ result: "", subtype: "" })).toBeNull();
  });

  it("returns message with subtype", () => {
    const msg = describeClaudeFailure({ subtype: "timeout", result: "" });
    expect(msg).toContain("subtype=timeout");
  });

  it("includes result text in message", () => {
    const msg = describeClaudeFailure({ result: "something went wrong", subtype: "" });
    expect(msg).toContain("something went wrong");
  });

  it("falls back to error messages when result is empty", () => {
    const msg = describeClaudeFailure({ result: "", subtype: "", errors: ["network error"] });
    expect(msg).toContain("network error");
  });

  it("includes both subtype and detail", () => {
    const msg = describeClaudeFailure({ subtype: "error_max_turns", result: "Max turns reached" });
    expect(msg).toContain("subtype=error_max_turns");
    expect(msg).toContain("Max turns reached");
  });
});

// ============================================================================
// isClaudeMaxTurnsResult
// ============================================================================

describe("isClaudeMaxTurnsResult", () => {
  it("returns false for null", () => {
    expect(isClaudeMaxTurnsResult(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isClaudeMaxTurnsResult(undefined)).toBe(false);
  });

  it("returns true for subtype=error_max_turns", () => {
    expect(isClaudeMaxTurnsResult({ subtype: "error_max_turns" })).toBe(true);
  });

  it("returns true for stop_reason=max_turns", () => {
    expect(isClaudeMaxTurnsResult({ stop_reason: "max_turns" })).toBe(true);
  });

  it("returns true when result text contains 'max turns'", () => {
    expect(isClaudeMaxTurnsResult({ result: "Reached max turns limit" })).toBe(true);
  });

  it("returns true when result text contains 'maximum turns'", () => {
    expect(isClaudeMaxTurnsResult({ result: "exceeded maximum turns" })).toBe(true);
  });

  it("returns false for normal result", () => {
    expect(isClaudeMaxTurnsResult({ subtype: "success", result: "done" })).toBe(false);
  });

  it("is case-insensitive for subtype", () => {
    expect(isClaudeMaxTurnsResult({ subtype: "ERROR_MAX_TURNS" })).toBe(true);
  });
});

// ============================================================================
// isClaudeUnknownSessionError
// ============================================================================

describe("isClaudeUnknownSessionError", () => {
  it("returns false for normal result", () => {
    expect(isClaudeUnknownSessionError({ result: "Task complete" })).toBe(false);
  });

  it("detects 'no conversation found with session id'", () => {
    expect(
      isClaudeUnknownSessionError({ result: "no conversation found with session id abc123" })
    ).toBe(true);
  });

  it("detects 'unknown session'", () => {
    expect(isClaudeUnknownSessionError({ result: "unknown session" })).toBe(true);
  });

  it("detects 'session not found' pattern", () => {
    expect(isClaudeUnknownSessionError({ result: "session abc123 not found" })).toBe(true);
  });

  it("checks error messages array in addition to result", () => {
    expect(
      isClaudeUnknownSessionError({ result: "", errors: ["unknown session xyz"] })
    ).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isClaudeUnknownSessionError({ result: "No Conversation Found With Session Id XYZ" })).toBe(true);
  });
});
