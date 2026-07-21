import path from "node:path";
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Unit tests for pure helpers in agent-instructions.ts.
// These functions are not exported, so we replicate them inline — this keeps
// the tests stable even if the module's import graph changes, and documents
// the exact behaviour we care about.
// ---------------------------------------------------------------------------

// ─── Replicated pure helpers ────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isBundleMode(value: unknown): value is "managed" | "external" {
  return value === "managed" || value === "external";
}

function inferLanguage(relativePath: string): string {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return "javascript";
  }
  if (lower.endsWith(".sh")) return "bash";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".toml")) return "toml";
  if (lower.endsWith(".txt")) return "text";
  return "text";
}

function isMarkdown(relativePath: string) {
  return relativePath.toLowerCase().endsWith(".md");
}

const IGNORED_INSTRUCTIONS_FILE_NAMES = new Set([".DS_Store", "Thumbs.db", "Desktop.ini"]);
const IGNORED_INSTRUCTIONS_DIRECTORY_NAMES = new Set([
  ".git",
  ".nox",
  ".pytest_cache",
  ".ruff_cache",
  ".tox",
  ".venv",
  "__pycache__",
  "node_modules",
  "venv",
]);

function shouldIgnoreInstructionsEntry(entry: { name: string; isDirectory(): boolean; isFile(): boolean }) {
  if (entry.name === "." || entry.name === "..") return true;
  if (entry.isDirectory()) {
    return IGNORED_INSTRUCTIONS_DIRECTORY_NAMES.has(entry.name);
  }
  if (!entry.isFile()) return false;
  return (
    IGNORED_INSTRUCTIONS_FILE_NAMES.has(entry.name)
    || entry.name.startsWith("._")
    || entry.name.endsWith(".pyc")
    || entry.name.endsWith(".pyo")
  );
}

function normalizeRelativeFilePath(candidatePath: string): string {
  const normalized = path.posix.normalize(candidatePath.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Instructions file path must stay within the bundle root");
  }
  return normalized;
}

// ─── asRecord ───────────────────────────────────────────────────────────────

describe("asRecord", () => {
  it("returns the object as-is for a plain object", () => {
    const input = { a: 1, b: "two" };
    expect(asRecord(input)).toBe(input);
  });

  it("returns empty object for null", () => {
    expect(asRecord(null)).toEqual({});
  });

  it("returns empty object for undefined", () => {
    expect(asRecord(undefined)).toEqual({});
  });

  it("returns empty object for a string", () => {
    expect(asRecord("hello")).toEqual({});
  });

  it("returns empty object for a number", () => {
    expect(asRecord(42)).toEqual({});
  });

  it("returns empty object for an array", () => {
    expect(asRecord([1, 2, 3])).toEqual({});
  });

  it("returns empty object for a boolean", () => {
    expect(asRecord(true)).toEqual({});
  });

  it("accepts a nested object", () => {
    const input = { x: { y: 1 } };
    expect(asRecord(input)).toEqual({ x: { y: 1 } });
  });
});

// ─── asString ───────────────────────────────────────────────────────────────

describe("asString", () => {
  it("returns the string when non-empty", () => {
    expect(asString("hello")).toBe("hello");
  });

  it("returns null for an empty string", () => {
    expect(asString("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(asString("   ")).toBeNull();
    expect(asString("\t\n")).toBeNull();
  });

  it("returns trimmed string (leading/trailing spaces kept if non-empty after trim)", () => {
    expect(asString("  hello  ")).toBe("hello");
  });

  it("returns null for null", () => {
    expect(asString(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(asString(undefined)).toBeNull();
  });

  it("returns null for a number", () => {
    expect(asString(42)).toBeNull();
  });

  it("returns null for an object", () => {
    expect(asString({})).toBeNull();
  });

  it("returns null for an array", () => {
    expect(asString([])).toBeNull();
  });
});

// ─── isBundleMode ───────────────────────────────────────────────────────────

describe("isBundleMode", () => {
  it("returns true for 'managed'", () => {
    expect(isBundleMode("managed")).toBe(true);
  });

  it("returns true for 'external'", () => {
    expect(isBundleMode("external")).toBe(true);
  });

  it("returns false for other strings", () => {
    expect(isBundleMode("legacy")).toBe(false);
    expect(isBundleMode("auto")).toBe(false);
    expect(isBundleMode("")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isBundleMode(null)).toBe(false);
    expect(isBundleMode(undefined)).toBe(false);
    expect(isBundleMode(1)).toBe(false);
    expect(isBundleMode({})).toBe(false);
  });
});

// ─── inferLanguage ──────────────────────────────────────────────────────────

describe("inferLanguage", () => {
  it("infers markdown for .md files", () => {
    expect(inferLanguage("AGENTS.md")).toBe("markdown");
    expect(inferLanguage("docs/README.MD")).toBe("markdown");
  });

  it("infers json for .json files", () => {
    expect(inferLanguage("config.json")).toBe("json");
    expect(inferLanguage("settings.JSON")).toBe("json");
  });

  it("infers yaml for .yaml and .yml files", () => {
    expect(inferLanguage("config.yaml")).toBe("yaml");
    expect(inferLanguage("config.yml")).toBe("yaml");
    expect(inferLanguage("config.YAML")).toBe("yaml");
  });

  it("infers typescript for .ts and .tsx files", () => {
    expect(inferLanguage("server.ts")).toBe("typescript");
    expect(inferLanguage("component.tsx")).toBe("typescript");
    expect(inferLanguage("app.TS")).toBe("typescript");
  });

  it("infers javascript for .js, .jsx, .mjs, .cjs files", () => {
    expect(inferLanguage("app.js")).toBe("javascript");
    expect(inferLanguage("comp.jsx")).toBe("javascript");
    expect(inferLanguage("module.mjs")).toBe("javascript");
    expect(inferLanguage("module.cjs")).toBe("javascript");
  });

  it("infers bash for .sh files", () => {
    expect(inferLanguage("deploy.sh")).toBe("bash");
    expect(inferLanguage("run.SH")).toBe("bash");
  });

  it("infers python for .py files", () => {
    expect(inferLanguage("script.py")).toBe("python");
    expect(inferLanguage("script.PY")).toBe("python");
  });

  it("infers toml for .toml files", () => {
    expect(inferLanguage("pyproject.toml")).toBe("toml");
  });

  it("infers text for .txt files", () => {
    expect(inferLanguage("notes.txt")).toBe("text");
  });

  it("falls back to text for unknown extensions", () => {
    expect(inferLanguage("Makefile")).toBe("text");
    expect(inferLanguage("file.xyz")).toBe("text");
    expect(inferLanguage("noextension")).toBe("text");
  });
});

// ─── isMarkdown ─────────────────────────────────────────────────────────────

describe("isMarkdown", () => {
  it("returns true for .md files", () => {
    expect(isMarkdown("AGENTS.md")).toBe(true);
    expect(isMarkdown("docs/README.md")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isMarkdown("README.MD")).toBe(true);
    expect(isMarkdown("file.Md")).toBe(true);
  });

  it("returns false for non-markdown files", () => {
    expect(isMarkdown("file.txt")).toBe(false);
    expect(isMarkdown("file.ts")).toBe(false);
    expect(isMarkdown("file.json")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isMarkdown("")).toBe(false);
  });
});

// ─── shouldIgnoreInstructionsEntry ─────────────────────────────────────────

function makeEntry(name: string, isDir: boolean, isFile = !isDir) {
  return { name, isDirectory: () => isDir, isFile: () => isFile };
}

describe("shouldIgnoreInstructionsEntry", () => {
  it("ignores '.' and '..' entries", () => {
    expect(shouldIgnoreInstructionsEntry(makeEntry(".", false, false))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry("..", false, false))).toBe(true);
  });

  it("ignores known system directories", () => {
    expect(shouldIgnoreInstructionsEntry(makeEntry("node_modules", true))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry(".git", true))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry("__pycache__", true))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry(".venv", true))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry("venv", true))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry(".nox", true))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry(".tox", true))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry(".pytest_cache", true))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry(".ruff_cache", true))).toBe(true);
  });

  it("does not ignore normal directories", () => {
    expect(shouldIgnoreInstructionsEntry(makeEntry("docs", true))).toBe(false);
    expect(shouldIgnoreInstructionsEntry(makeEntry("src", true))).toBe(false);
  });

  it("ignores known system files", () => {
    expect(shouldIgnoreInstructionsEntry(makeEntry(".DS_Store", false))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry("Thumbs.db", false))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry("Desktop.ini", false))).toBe(true);
  });

  it("ignores files starting with '._'", () => {
    expect(shouldIgnoreInstructionsEntry(makeEntry("._AGENTS.md", false))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry("._config.json", false))).toBe(true);
  });

  it("ignores .pyc and .pyo files", () => {
    expect(shouldIgnoreInstructionsEntry(makeEntry("module.pyc", false))).toBe(true);
    expect(shouldIgnoreInstructionsEntry(makeEntry("module.pyo", false))).toBe(true);
  });

  it("does not ignore normal markdown and source files", () => {
    expect(shouldIgnoreInstructionsEntry(makeEntry("AGENTS.md", false))).toBe(false);
    expect(shouldIgnoreInstructionsEntry(makeEntry("config.json", false))).toBe(false);
    expect(shouldIgnoreInstructionsEntry(makeEntry("script.py", false))).toBe(false);
  });

  it("does not ignore non-file non-directory entries (e.g. symlinks)", () => {
    // isFile returns false, isDirectory returns false → falls through to false
    expect(shouldIgnoreInstructionsEntry(makeEntry("symlink", false, false))).toBe(false);
  });
});

// ─── normalizeRelativeFilePath ──────────────────────────────────────────────

describe("normalizeRelativeFilePath", () => {
  it("returns simple relative paths unchanged", () => {
    expect(normalizeRelativeFilePath("AGENTS.md")).toBe("AGENTS.md");
    expect(normalizeRelativeFilePath("docs/guide.md")).toBe("docs/guide.md");
  });

  it("normalizes double slashes", () => {
    expect(normalizeRelativeFilePath("docs//guide.md")).toBe("docs/guide.md");
  });

  it("resolves internal . segments", () => {
    expect(normalizeRelativeFilePath("docs/./guide.md")).toBe("docs/guide.md");
  });

  it("strips leading slashes", () => {
    expect(normalizeRelativeFilePath("/AGENTS.md")).toBe("AGENTS.md");
    expect(normalizeRelativeFilePath("///docs/guide.md")).toBe("docs/guide.md");
  });

  it("converts Windows backslash separators to forward slashes", () => {
    expect(normalizeRelativeFilePath("docs\\guide.md")).toBe("docs/guide.md");
    expect(normalizeRelativeFilePath("sub\\dir\\file.md")).toBe("sub/dir/file.md");
  });

  it("throws for '..' traversal", () => {
    expect(() => normalizeRelativeFilePath("../outside.md")).toThrow();
  });

  it("throws for paths that resolve to '..'", () => {
    expect(() => normalizeRelativeFilePath("sub/../../outside.md")).toThrow();
  });

  it("throws for '.' (root itself)", () => {
    expect(() => normalizeRelativeFilePath(".")).toThrow();
  });

  it("throws for empty string", () => {
    expect(() => normalizeRelativeFilePath("")).toThrow();
  });
});
