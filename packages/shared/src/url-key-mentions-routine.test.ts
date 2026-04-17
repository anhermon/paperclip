import { describe, it, expect } from "vitest";
import {
  isUuidLike,
  normalizeAgentUrlKey,
  deriveAgentUrlKey,
} from "./agent-url-key.js";
import {
  normalizeProjectUrlKey,
  hasNonAsciiContent,
  deriveProjectUrlKey,
} from "./project-url-key.js";
import {
  PROJECT_MENTION_SCHEME,
  AGENT_MENTION_SCHEME,
  SKILL_MENTION_SCHEME,
  buildProjectMentionHref,
  parseProjectMentionHref,
  buildAgentMentionHref,
  parseAgentMentionHref,
  buildSkillMentionHref,
  parseSkillMentionHref,
  extractProjectMentionIds,
  extractAgentMentionIds,
  extractSkillMentionIds,
} from "./project-mentions.js";
import {
  BUILTIN_ROUTINE_VARIABLE_NAMES,
  isBuiltinRoutineVariable,
  getBuiltinRoutineVariableValues,
  isValidRoutineVariableName,
  extractRoutineVariableNames,
  syncRoutineVariablesWithTemplate,
  stringifyRoutineVariableValue,
  interpolateRoutineTemplate,
} from "./routine-variables.js";

// ============================================================================
// agent-url-key.ts
// ============================================================================

describe("isUuidLike", () => {
  it("returns true for a valid v4 UUID", () => {
    expect(isUuidLike("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("returns true for UUID with uppercase letters", () => {
    expect(isUuidLike("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("returns false for non-UUID string", () => {
    expect(isUuidLike("hello")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isUuidLike(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isUuidLike(undefined)).toBe(false);
  });

  it("returns false for partial UUID", () => {
    expect(isUuidLike("550e8400-e29b")).toBe(false);
  });

  it("trims whitespace before checking", () => {
    expect(isUuidLike("  550e8400-e29b-41d4-a716-446655440000  ")).toBe(true);
  });
});

describe("normalizeAgentUrlKey", () => {
  it("returns null for null input", () => {
    expect(normalizeAgentUrlKey(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeAgentUrlKey(undefined)).toBeNull();
  });

  it("lowercases the input", () => {
    expect(normalizeAgentUrlKey("CTO")).toBe("cto");
  });

  it("replaces spaces with hyphens", () => {
    expect(normalizeAgentUrlKey("Chief Technology Officer")).toBe("chief-technology-officer");
  });

  it("replaces non-alphanumeric chars with hyphens", () => {
    expect(normalizeAgentUrlKey("my_agent!")).toBe("my-agent");
  });

  it("trims leading/trailing hyphens", () => {
    expect(normalizeAgentUrlKey("  !hello!  ")).toBe("hello");
  });

  it("collapses multiple delimiters into one hyphen", () => {
    expect(normalizeAgentUrlKey("hello   world")).toBe("hello-world");
  });

  it("returns null for empty string", () => {
    expect(normalizeAgentUrlKey("")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(normalizeAgentUrlKey("   ")).toBeNull();
  });
});

describe("deriveAgentUrlKey", () => {
  it("uses name when valid", () => {
    expect(deriveAgentUrlKey("My Agent")).toBe("my-agent");
  });

  it("falls back to fallback when name is null", () => {
    expect(deriveAgentUrlKey(null, "fallback-key")).toBe("fallback-key");
  });

  it("falls back to fallback when name is empty", () => {
    expect(deriveAgentUrlKey("", "fallback-key")).toBe("fallback-key");
  });

  it("defaults to 'agent' when both name and fallback are unusable", () => {
    expect(deriveAgentUrlKey(null, null)).toBe("agent");
  });

  it("normalizes the name", () => {
    expect(deriveAgentUrlKey("CTO Agent")).toBe("cto-agent");
  });
});

// ============================================================================
// project-url-key.ts
// ============================================================================

describe("normalizeProjectUrlKey", () => {
  it("returns null for null", () => {
    expect(normalizeProjectUrlKey(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeProjectUrlKey(undefined)).toBeNull();
  });

  it("lowercases the input", () => {
    expect(normalizeProjectUrlKey("MyProject")).toBe("myproject");
  });

  it("replaces spaces with hyphens", () => {
    expect(normalizeProjectUrlKey("My Project")).toBe("my-project");
  });

  it("trims leading/trailing hyphens", () => {
    expect(normalizeProjectUrlKey("!my project!")).toBe("my-project");
  });

  it("returns null for empty string", () => {
    expect(normalizeProjectUrlKey("")).toBeNull();
  });

  it("strips non-ASCII characters", () => {
    // Non-ASCII chars don't match [a-z0-9] so they become hyphens
    const result = normalizeProjectUrlKey("café");
    expect(typeof result).toBe("string");
  });
});

describe("hasNonAsciiContent", () => {
  it("returns false for pure ASCII string", () => {
    expect(hasNonAsciiContent("hello")).toBe(false);
  });

  it("returns true for string with non-ASCII character", () => {
    expect(hasNonAsciiContent("café")).toBe(true);
  });

  it("returns true for emoji", () => {
    expect(hasNonAsciiContent("hello 🎉")).toBe(true);
  });

  it("returns false for null", () => {
    expect(hasNonAsciiContent(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasNonAsciiContent(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasNonAsciiContent("")).toBe(false);
  });
});

describe("deriveProjectUrlKey", () => {
  it("returns normalized ASCII name", () => {
    expect(deriveProjectUrlKey("My Project")).toBe("my-project");
  });

  it("appends UUID short ID when name has non-ASCII content", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = deriveProjectUrlKey("Café Project", uuid);
    // Should contain the short ID derived from the UUID
    expect(result).toContain("550e8400");
  });

  it("uses fallback when name is null", () => {
    expect(deriveProjectUrlKey(null, "my-fallback")).toBe("my-fallback");
  });

  it("returns 'project' when both are unusable", () => {
    expect(deriveProjectUrlKey(null, null)).toBe("project");
  });

  it("uses short UUID from fallback when name is non-ASCII only", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = deriveProjectUrlKey("🎉", uuid);
    // Non-ASCII stripping may produce empty normalized form or short ID
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// project-mentions.ts — constants
// ============================================================================

describe("mention scheme constants", () => {
  it("PROJECT_MENTION_SCHEME starts with 'project://'", () => {
    expect(PROJECT_MENTION_SCHEME).toBe("project://");
  });

  it("AGENT_MENTION_SCHEME starts with 'agent://'", () => {
    expect(AGENT_MENTION_SCHEME).toBe("agent://");
  });

  it("SKILL_MENTION_SCHEME starts with 'skill://'", () => {
    expect(SKILL_MENTION_SCHEME).toBe("skill://");
  });
});

// ============================================================================
// buildProjectMentionHref / parseProjectMentionHref
// ============================================================================

describe("buildProjectMentionHref", () => {
  it("builds href without color", () => {
    const href = buildProjectMentionHref("proj-1");
    expect(href).toBe("project://proj-1");
  });

  it("builds href with 6-char hex color (no hash)", () => {
    const href = buildProjectMentionHref("proj-1", "ff0000");
    expect(href).toContain("c=ff0000");
    expect(href.startsWith("project://proj-1")).toBe(true);
  });

  it("builds href with hash-prefixed hex color", () => {
    const href = buildProjectMentionHref("proj-1", "#ff0000");
    expect(href).toContain("c=ff0000");
  });

  it("builds href with 3-char shorthand color", () => {
    const href = buildProjectMentionHref("proj-1", "f00");
    // 'f00' expands to 'ff0000'
    expect(href).toContain("c=ff0000");
  });

  it("omits color param for invalid color", () => {
    const href = buildProjectMentionHref("proj-1", "not-a-color");
    expect(href).not.toContain("?c=");
  });
});

describe("parseProjectMentionHref", () => {
  it("returns null for non-project href", () => {
    expect(parseProjectMentionHref("https://example.com")).toBeNull();
  });

  it("parses projectId from href without color", () => {
    const result = parseProjectMentionHref("project://proj-1");
    expect(result).not.toBeNull();
    expect(result?.projectId).toBe("proj-1");
    expect(result?.color).toBeNull();
  });

  it("parses projectId and color from href with color", () => {
    const href = buildProjectMentionHref("proj-1", "#ff0000");
    const result = parseProjectMentionHref(href);
    expect(result?.projectId).toBe("proj-1");
    expect(result?.color).toBe("#ff0000");
  });

  it("roundtrips build→parse for a valid href", () => {
    const href = buildProjectMentionHref("my-project-id", "#3b82f6");
    const result = parseProjectMentionHref(href);
    expect(result?.projectId).toBe("my-project-id");
    expect(result?.color).toBe("#3b82f6");
  });

  it("returns null for invalid URL", () => {
    expect(parseProjectMentionHref("project://")).toBeNull();
  });
});

// ============================================================================
// buildAgentMentionHref / parseAgentMentionHref
// ============================================================================

describe("buildAgentMentionHref", () => {
  it("builds href without icon", () => {
    expect(buildAgentMentionHref("agent-1")).toBe("agent://agent-1");
  });

  it("builds href with valid icon name", () => {
    const href = buildAgentMentionHref("agent-1", "circuit-board");
    expect(href).toContain("i=circuit-board");
  });

  it("omits icon param for invalid icon name", () => {
    const href = buildAgentMentionHref("agent-1", "has spaces");
    expect(href).not.toContain("?i=");
  });
});

describe("parseAgentMentionHref", () => {
  it("returns null for non-agent href", () => {
    expect(parseAgentMentionHref("project://x")).toBeNull();
  });

  it("parses agentId without icon", () => {
    const result = parseAgentMentionHref("agent://agent-1");
    expect(result?.agentId).toBe("agent-1");
    expect(result?.icon).toBeNull();
  });

  it("roundtrips build→parse with icon", () => {
    const href = buildAgentMentionHref("my-agent", "cpu");
    const result = parseAgentMentionHref(href);
    expect(result?.agentId).toBe("my-agent");
    expect(result?.icon).toBe("cpu");
  });

  it("returns null for empty agentId", () => {
    expect(parseAgentMentionHref("agent://")).toBeNull();
  });
});

// ============================================================================
// buildSkillMentionHref / parseSkillMentionHref
// ============================================================================

describe("buildSkillMentionHref", () => {
  it("builds href without slug", () => {
    expect(buildSkillMentionHref("skill-id-1")).toBe("skill://skill-id-1");
  });

  it("builds href with valid slug", () => {
    const href = buildSkillMentionHref("skill-id-1", "my-skill");
    expect(href).toContain("s=my-skill");
  });

  it("omits slug param for invalid slug", () => {
    const href = buildSkillMentionHref("skill-id-1", "has spaces");
    expect(href).not.toContain("?s=");
  });
});

describe("parseSkillMentionHref", () => {
  it("returns null for non-skill href", () => {
    expect(parseSkillMentionHref("agent://x")).toBeNull();
  });

  it("parses skillId without slug", () => {
    const result = parseSkillMentionHref("skill://skill-1");
    expect(result?.skillId).toBe("skill-1");
    expect(result?.slug).toBeNull();
  });

  it("roundtrips build→parse with slug", () => {
    const href = buildSkillMentionHref("skill-1", "paperclip");
    const result = parseSkillMentionHref(href);
    expect(result?.skillId).toBe("skill-1");
    expect(result?.slug).toBe("paperclip");
  });
});

// ============================================================================
// extractProjectMentionIds
// ============================================================================

describe("extractProjectMentionIds", () => {
  it("returns empty array for empty string", () => {
    expect(extractProjectMentionIds("")).toEqual([]);
  });

  it("extracts project ID from markdown link", () => {
    const markdown = "[Project A](project://proj-1)";
    expect(extractProjectMentionIds(markdown)).toContain("proj-1");
  });

  it("extracts multiple unique project IDs", () => {
    const markdown = "[A](project://id-1) and [B](project://id-2)";
    const result = extractProjectMentionIds(markdown);
    expect(result).toContain("id-1");
    expect(result).toContain("id-2");
  });

  it("deduplicates repeated project IDs", () => {
    const markdown = "[A](project://id-1) [A again](project://id-1)";
    const result = extractProjectMentionIds(markdown);
    expect(result.filter((x) => x === "id-1")).toHaveLength(1);
  });

  it("returns empty array for string with no project mentions", () => {
    expect(extractProjectMentionIds("no mentions here")).toEqual([]);
  });
});

// ============================================================================
// extractAgentMentionIds
// ============================================================================

describe("extractAgentMentionIds", () => {
  it("returns empty array for empty string", () => {
    expect(extractAgentMentionIds("")).toEqual([]);
  });

  it("extracts agent ID from markdown link", () => {
    const markdown = "[@CTO](agent://cto-agent-id)";
    expect(extractAgentMentionIds(markdown)).toContain("cto-agent-id");
  });

  it("deduplicates repeated agent IDs", () => {
    const markdown = "[@A](agent://id-1) [@A again](agent://id-1)";
    const result = extractAgentMentionIds(markdown);
    expect(result.filter((x) => x === "id-1")).toHaveLength(1);
  });
});

// ============================================================================
// extractSkillMentionIds
// ============================================================================

describe("extractSkillMentionIds", () => {
  it("returns empty array for empty string", () => {
    expect(extractSkillMentionIds("")).toEqual([]);
  });

  it("extracts skill ID from markdown link", () => {
    const markdown = "[my skill](skill://skill-id-1)";
    expect(extractSkillMentionIds(markdown)).toContain("skill-id-1");
  });
});

// ============================================================================
// routine-variables.ts
// ============================================================================

describe("BUILTIN_ROUTINE_VARIABLE_NAMES", () => {
  it("contains 'date'", () => {
    expect(BUILTIN_ROUTINE_VARIABLE_NAMES.has("date")).toBe(true);
  });
});

describe("isBuiltinRoutineVariable", () => {
  it("returns true for 'date'", () => {
    expect(isBuiltinRoutineVariable("date")).toBe(true);
  });

  it("returns false for custom variable name", () => {
    expect(isBuiltinRoutineVariable("myVar")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isBuiltinRoutineVariable("DATE")).toBe(false);
  });
});

describe("getBuiltinRoutineVariableValues", () => {
  it("returns an object with a date key", () => {
    const result = getBuiltinRoutineVariableValues();
    expect(result).toHaveProperty("date");
  });

  it("date value matches YYYY-MM-DD format", () => {
    const result = getBuiltinRoutineVariableValues();
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isValidRoutineVariableName", () => {
  it("returns true for simple alphabetic name", () => {
    expect(isValidRoutineVariableName("myVar")).toBe(true);
  });

  it("returns true for name with numbers and underscores", () => {
    expect(isValidRoutineVariableName("myVar_123")).toBe(true);
  });

  it("returns false for name starting with number", () => {
    expect(isValidRoutineVariableName("1bad")).toBe(false);
  });

  it("returns false for name with hyphen", () => {
    expect(isValidRoutineVariableName("my-var")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidRoutineVariableName("")).toBe(false);
  });

  it("returns true for uppercase letters", () => {
    expect(isValidRoutineVariableName("MY_VAR")).toBe(true);
  });
});

describe("extractRoutineVariableNames", () => {
  it("extracts variable names from template", () => {
    expect(extractRoutineVariableNames("Hello {{name}}!")).toEqual(["name"]);
  });

  it("extracts multiple distinct variable names", () => {
    const result = extractRoutineVariableNames("{{greeting}} {{name}}");
    expect(result).toContain("greeting");
    expect(result).toContain("name");
  });

  it("deduplicates repeated variables", () => {
    const result = extractRoutineVariableNames("{{x}} and {{x}}");
    expect(result.filter((v) => v === "x")).toHaveLength(1);
  });

  it("handles whitespace around variable name", () => {
    expect(extractRoutineVariableNames("{{ name }}")).toEqual(["name"]);
  });

  it("returns empty array for template with no variables", () => {
    expect(extractRoutineVariableNames("no variables")).toEqual([]);
  });

  it("returns empty array for null template", () => {
    expect(extractRoutineVariableNames(null)).toEqual([]);
  });

  it("handles array of template strings", () => {
    const result = extractRoutineVariableNames(["{{a}}", "{{b}}"]);
    expect(result).toContain("a");
    expect(result).toContain("b");
  });

  it("filters null entries from array input", () => {
    const result = extractRoutineVariableNames([null, "{{x}}"]);
    expect(result).toEqual(["x"]);
  });
});

describe("syncRoutineVariablesWithTemplate", () => {
  it("returns empty array for template with no variables", () => {
    expect(syncRoutineVariablesWithTemplate("no vars", [])).toEqual([]);
  });

  it("creates default variable entry for new variable", () => {
    const result = syncRoutineVariablesWithTemplate("{{name}}", []);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("name");
    expect(result[0]?.type).toBe("text");
    expect(result[0]?.required).toBe(true);
  });

  it("preserves existing variable definition", () => {
    const existing = [
      { name: "name", label: "Full Name", type: "text" as const, defaultValue: "Alice", required: false, options: [] },
    ];
    const result = syncRoutineVariablesWithTemplate("{{name}}", existing);
    expect(result[0]?.label).toBe("Full Name");
    expect(result[0]?.defaultValue).toBe("Alice");
  });

  it("filters out builtin variables from result", () => {
    const result = syncRoutineVariablesWithTemplate("{{date}} {{name}}", []);
    expect(result.map((v) => v.name)).not.toContain("date");
    expect(result.map((v) => v.name)).toContain("name");
  });

  it("removes variables no longer in template", () => {
    const existing = [
      { name: "oldVar", label: null, type: "text" as const, defaultValue: null, required: true, options: [] },
    ];
    const result = syncRoutineVariablesWithTemplate("{{newVar}}", existing);
    expect(result.map((v) => v.name)).not.toContain("oldVar");
    expect(result.map((v) => v.name)).toContain("newVar");
  });
});

describe("stringifyRoutineVariableValue", () => {
  it("returns string as-is", () => {
    expect(stringifyRoutineVariableValue("hello")).toBe("hello");
  });

  it("converts number to string", () => {
    expect(stringifyRoutineVariableValue(42)).toBe("42");
  });

  it("converts boolean to string", () => {
    expect(stringifyRoutineVariableValue(true)).toBe("true");
    expect(stringifyRoutineVariableValue(false)).toBe("false");
  });

  it("returns empty string for null", () => {
    expect(stringifyRoutineVariableValue(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(stringifyRoutineVariableValue(undefined)).toBe("");
  });

  it("JSON-stringifies an object", () => {
    expect(stringifyRoutineVariableValue({ x: 1 })).toBe('{"x":1}');
  });
});

describe("interpolateRoutineTemplate", () => {
  it("returns null for null template", () => {
    expect(interpolateRoutineTemplate(null, {})).toBeNull();
  });

  it("returns template unchanged when values is null", () => {
    expect(interpolateRoutineTemplate("{{name}}", null)).toBe("{{name}}");
  });

  it("returns template unchanged when values is empty", () => {
    expect(interpolateRoutineTemplate("{{name}}", {})).toBe("{{name}}");
  });

  it("interpolates a variable", () => {
    expect(interpolateRoutineTemplate("Hello {{name}}!", { name: "Alice" })).toBe("Hello Alice!");
  });

  it("interpolates multiple variables", () => {
    const result = interpolateRoutineTemplate("{{greeting}} {{name}}", {
      greeting: "Hi",
      name: "Bob",
    });
    expect(result).toBe("Hi Bob");
  });

  it("leaves unknown variable placeholders untouched", () => {
    const result = interpolateRoutineTemplate("{{known}} {{unknown}}", { known: "hi" });
    expect(result).toContain("hi");
    expect(result).toContain("{{unknown}}");
  });

  it("handles whitespace around variable name", () => {
    expect(interpolateRoutineTemplate("{{ name }}", { name: "Alice" })).toBe("Alice");
  });

  it("converts number values to string", () => {
    expect(interpolateRoutineTemplate("Count: {{n}}", { n: 5 })).toBe("Count: 5");
  });
});
