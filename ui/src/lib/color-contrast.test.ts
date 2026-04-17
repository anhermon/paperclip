import { describe, expect, it } from "vitest";
import { hexToRgb, pickTextColorForSolidBg } from "./color-contrast.js";

// ============================================================================
// hexToRgb
// ============================================================================

describe("hexToRgb", () => {
  it("parses a 6-digit hex with # prefix", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses a 6-digit hex without # prefix", () => {
    expect(hexToRgb("00ff00")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("parses a 3-digit shorthand hex", () => {
    // #f0f → #ff00ff
    expect(hexToRgb("#f0f")).toEqual({ r: 255, g: 0, b: 255 });
  });

  it("parses pure white #ffffff", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses pure black #000000", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("is case-insensitive", () => {
    expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("trims whitespace from input", () => {
    expect(hexToRgb("  #aabbcc  ")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("returns null for empty string", () => {
    expect(hexToRgb("")).toBeNull();
  });

  it("returns null for invalid hex characters", () => {
    expect(hexToRgb("#gggggg")).toBeNull();
  });

  it("returns null for 4-digit hex (not a valid shorthand)", () => {
    expect(hexToRgb("#1234")).toBeNull();
  });

  it("returns null for 5-digit hex", () => {
    expect(hexToRgb("#12345")).toBeNull();
  });

  it("parses a specific brand color #6366f1 (indigo)", () => {
    const result = hexToRgb("#6366f1");
    expect(result).toEqual({ r: 99, g: 102, b: 241 });
  });
});

// ============================================================================
// pickTextColorForSolidBg
// ============================================================================

describe("pickTextColorForSolidBg", () => {
  it("returns light text (#f8fafc) for a dark background", () => {
    // Pure black background
    const result = pickTextColorForSolidBg("#000000");
    expect(result).toBe("#f8fafc");
  });

  it("returns dark text (#111827) for a light background", () => {
    // Pure white background
    const result = pickTextColorForSolidBg("#ffffff");
    expect(result).toBe("#111827");
  });

  it("returns light text for a dark indigo background", () => {
    // Dark indigo — should have better contrast with light text
    const result = pickTextColorForSolidBg("#312e81");
    expect(result).toBe("#f8fafc");
  });

  it("returns dark text for a light yellow background", () => {
    // Light yellow — should have better contrast with dark text
    const result = pickTextColorForSolidBg("#fef08a");
    expect(result).toBe("#111827");
  });

  it("returns light text fallback for invalid hex", () => {
    const result = pickTextColorForSolidBg("not-a-color");
    expect(result).toBe("#f8fafc");
  });

  it("returns a string in both cases", () => {
    expect(typeof pickTextColorForSolidBg("#6366f1")).toBe("string");
    expect(typeof pickTextColorForSolidBg("#fbbf24")).toBe("string");
  });
});
