import { describe, expect, it } from "vitest";
import {
  isBuiltinRoutineVariable,
  isValidRoutineVariableName,
  extractRoutineVariableNames,
  syncRoutineVariablesWithTemplate,
  stringifyRoutineVariableValue,
  interpolateRoutineTemplate,
  getBuiltinRoutineVariableValues,
  BUILTIN_ROUTINE_VARIABLE_NAMES,
} from "./routine-variables.js";

// ============================================================================
// isBuiltinRoutineVariable
// ============================================================================

describe("isBuiltinRoutineVariable", () => {
  it("returns true for 'date'", () => {
    expect(isBuiltinRoutineVariable("date")).toBe(true);
    expect(isBuiltinRoutineVariable("timestamp")).toBe(true);
    expect(isBuiltinRoutineVariable("repo")).toBe(false);
  });

  it("returns false for unknown variable", () => {
    expect(isBuiltinRoutineVariable("myVar")).toBe(false);
  });

  it("BUILTIN_ROUTINE_VARIABLE_NAMES set contains 'date'", () => {
    expect(BUILTIN_ROUTINE_VARIABLE_NAMES.has("date")).toBe(true);
    expect(BUILTIN_ROUTINE_VARIABLE_NAMES.has("timestamp")).toBe(true);
  });
});

// ============================================================================
// isValidRoutineVariableName
// ============================================================================

describe("isValidRoutineVariableName", () => {
  it("returns true for simple alphanumeric name", () => {
    expect(isValidRoutineVariableName("myVar")).toBe(true);
  });

<<<<<<< HEAD
  it("returns true for name with underscore", () => {
    expect(isValidRoutineVariableName("my_var")).toBe(true);
  });

  it("returns true for name with digits after first char", () => {
    expect(isValidRoutineVariableName("var123")).toBe(true);
  });

  it("returns false for name starting with digit", () => {
    expect(isValidRoutineVariableName("1var")).toBe(false);
  });

  it("returns false for name with hyphen", () => {
    expect(isValidRoutineVariableName("my-var")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidRoutineVariableName("")).toBe(false);
  });

  it("returns false for name with spaces", () => {
    expect(isValidRoutineVariableName("my var")).toBe(false);
  });
});

// ============================================================================
// extractRoutineVariableNames
// ============================================================================

describe("extractRoutineVariableNames", () => {
  it("extracts a single variable", () => {
    expect(extractRoutineVariableNames("Hello {{ name }}")).toEqual(["name"]);
  });

  it("extracts multiple variables", () => {
    const result = extractRoutineVariableNames("{{ greeting }}, {{ name }}!");
    expect(result).toContain("greeting");
    expect(result).toContain("name");
    expect(result).toHaveLength(2);
  });

  it("deduplicates repeated variables", () => {
    expect(extractRoutineVariableNames("{{ x }} and {{ x }}")).toEqual(["x"]);
  });

  it("returns empty array for template with no variables", () => {
    expect(extractRoutineVariableNames("no variables here")).toEqual([]);
  });

  it("returns empty array for null", () => {
    expect(extractRoutineVariableNames(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(extractRoutineVariableNames(undefined)).toEqual([]);
  });

  it("handles array of templates", () => {
    const result = extractRoutineVariableNames(["{{ a }}", "{{ b }}"]);
    expect(result).toContain("a");
    expect(result).toContain("b");
  });

  it("handles whitespace in variable syntax", () => {
    expect(extractRoutineVariableNames("{{  myVar  }}")).toEqual(["myVar"]);
  });
});

// ============================================================================
// syncRoutineVariablesWithTemplate
// ============================================================================

describe("syncRoutineVariablesWithTemplate", () => {
  it("creates default variables for new template variables", () => {
    const result = syncRoutineVariablesWithTemplate("{{ name }}", null);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("name");
    expect(result[0].type).toBe("text");
    expect(result[0].required).toBe(true);
  });

  it("preserves existing variable definitions", () => {
    const existing = [{ name: "name", label: "Your Name", type: "text" as const, defaultValue: "Alice", required: false, options: [] }];
    const result = syncRoutineVariablesWithTemplate("{{ name }}", existing);
    expect(result[0].label).toBe("Your Name");
    expect(result[0].defaultValue).toBe("Alice");
  });

  it("excludes built-in variables from the result", () => {
    const result = syncRoutineVariablesWithTemplate("{{ date }} and {{ name }}", null);
    expect(result.map((v) => v.name)).not.toContain("date");
    expect(result.map((v) => v.name)).toContain("name");
  });

  it("returns empty array when template has no custom variables", () => {
    expect(syncRoutineVariablesWithTemplate("{{ date }}", null)).toHaveLength(0);
  });

  it("removes variables no longer in template", () => {
    const existing = [{ name: "oldVar", label: null, type: "text" as const, defaultValue: null, required: true, options: [] }];
    const result = syncRoutineVariablesWithTemplate("{{ newVar }}", existing);
    expect(result.map((v) => v.name)).not.toContain("oldVar");
  });
});

// ============================================================================
// stringifyRoutineVariableValue
// ============================================================================

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

  it("JSON-stringifies objects", () => {
    const result = stringifyRoutineVariableValue({ key: "value" });
    expect(result).toBe('{"key":"value"}');
  });
});

// ============================================================================
// interpolateRoutineTemplate
// ============================================================================

describe("interpolateRoutineTemplate", () => {
  it("returns null for null template", () => {
    expect(interpolateRoutineTemplate(null, {})).toBeNull();
  });

  it("returns template unchanged when values is null", () => {
    expect(interpolateRoutineTemplate("hello {{ name }}", null)).toBe("hello {{ name }}");
  });

  it("returns template unchanged when values is empty", () => {
    expect(interpolateRoutineTemplate("hello {{ name }}", {})).toBe("hello {{ name }}");
  });

  it("substitutes a single variable", () => {
    expect(interpolateRoutineTemplate("Hello {{ name }}!", { name: "World" })).toBe("Hello World!");
  });

  it("substitutes multiple variables", () => {
    const result = interpolateRoutineTemplate("{{ greeting }}, {{ name }}!", {
      greeting: "Hi",
      name: "Alice",
    });
    expect(result).toBe("Hi, Alice!");
  });

  it("leaves unmatched variables in place", () => {
    expect(interpolateRoutineTemplate("{{ unknown }}", { name: "Alice" })).toBe("{{ unknown }}");
  });

  it("handles numeric values", () => {
    expect(interpolateRoutineTemplate("Count: {{ n }}", { n: 5 })).toBe("Count: 5");
  });

  it("getBuiltinRoutineVariableValues returns a human-readable timestamp with year, time, and UTC", () => {
    const values = getBuiltinRoutineVariableValues();
    const year = String(new Date().getUTCFullYear());
    expect(values.timestamp).toContain(year);
    expect(values.timestamp).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
    expect(values.timestamp).toContain("UTC");
  });

  it("excludes built-in variables from syncRoutineVariablesWithTemplate", () => {
    const result = syncRoutineVariablesWithTemplate(
      "Daily report for {{date}} at {{timestamp}} — {{repo}}",
      [],
    );
    expect(result).toEqual([
      { name: "repo", label: null, type: "text", defaultValue: null, required: true, options: [] },
    ]);
  });

  it("interpolates built-in variables alongside user variables", () => {
    const builtins = getBuiltinRoutineVariableValues();
    const allVars = { ...builtins, repo: "paperclip" };
    expect(
      interpolateRoutineTemplate("Report for {{date}} ({{timestamp}}) on {{repo}}", allVars),
    ).toBe(`Report for ${builtins.date} (${builtins.timestamp}) on paperclip`);
  });
});
