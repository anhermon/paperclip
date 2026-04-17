import { describe, expect, it } from "vitest";
import { extractProviderId, extractProviderIdWithFallback, extractModelName } from "./model-utils.js";

// ============================================================================
// extractProviderId
// ============================================================================

describe("extractProviderId", () => {
  it("returns the provider segment before the first slash", () => {
    expect(extractProviderId("anthropic/claude-3-5-sonnet")).toBe("anthropic");
  });

  it("handles nested slashes — only splits on the first", () => {
    expect(extractProviderId("openai/gpt-4/turbo")).toBe("openai");
  });

  it("returns null when there is no slash", () => {
    expect(extractProviderId("claude-3")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractProviderId("")).toBeNull();
  });

  it("trims whitespace from the input", () => {
    expect(extractProviderId("  anthropic/claude-3  ")).toBe("anthropic");
  });

  it("returns null when the provider segment is empty (leading slash)", () => {
    expect(extractProviderId("/model-name")).toBeNull();
  });

  it("returns null when provider is only whitespace after trim", () => {
    expect(extractProviderId("   /model")).toBeNull();
  });
});

// ============================================================================
// extractProviderIdWithFallback
// ============================================================================

describe("extractProviderIdWithFallback", () => {
  it("returns the provider when present", () => {
    expect(extractProviderIdWithFallback("google/gemini-pro")).toBe("google");
  });

  it("returns default fallback 'other' when no slash", () => {
    expect(extractProviderIdWithFallback("gemini-pro")).toBe("other");
  });

  it("accepts a custom fallback string", () => {
    expect(extractProviderIdWithFallback("gemini-pro", "unknown")).toBe("unknown");
  });

  it("returns provider even with custom fallback when slash present", () => {
    expect(extractProviderIdWithFallback("openai/gpt-4", "custom")).toBe("openai");
  });
});

// ============================================================================
// extractModelName
// ============================================================================

describe("extractModelName", () => {
  it("returns the model segment after the first slash", () => {
    expect(extractModelName("anthropic/claude-3-5-sonnet")).toBe("claude-3-5-sonnet");
  });

  it("returns the full input when there is no slash", () => {
    expect(extractModelName("claude-3")).toBe("claude-3");
  });

  it("returns everything after the first slash (including nested slashes)", () => {
    expect(extractModelName("openai/gpt-4/turbo")).toBe("gpt-4/turbo");
  });

  it("trims whitespace from the input", () => {
    expect(extractModelName("  anthropic/claude-3  ")).toBe("claude-3");
  });

  it("returns empty string when model segment is empty (trailing slash)", () => {
    expect(extractModelName("anthropic/")).toBe("");
  });

  it("returns trimmed full string when input has no slash but has spaces", () => {
    expect(extractModelName("  my-model  ")).toBe("my-model");
  });
});
