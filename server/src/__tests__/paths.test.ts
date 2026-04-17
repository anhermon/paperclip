import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePaperclipConfigPath, resolvePaperclipEnvPath } from "../paths.js";

const ORIGINAL_PAPERCLIP_CONFIG = process.env.PAPERCLIP_CONFIG;

afterEach(() => {
  if (ORIGINAL_PAPERCLIP_CONFIG === undefined) delete process.env.PAPERCLIP_CONFIG;
  else process.env.PAPERCLIP_CONFIG = ORIGINAL_PAPERCLIP_CONFIG;
});

describe("resolvePaperclipConfigPath", () => {
  it("returns the resolved override path when explicitly provided", () => {
    const result = resolvePaperclipConfigPath("/explicit/path/config.json");
    expect(result).toBe(path.resolve("/explicit/path/config.json"));
  });

  it("resolves relative override paths from cwd", () => {
    const result = resolvePaperclipConfigPath("relative/config.json");
    expect(result).toBe(path.resolve("relative/config.json"));
  });

  it("uses PAPERCLIP_CONFIG env var when set", () => {
    process.env.PAPERCLIP_CONFIG = "/env/config.json";
    const result = resolvePaperclipConfigPath();
    expect(result).toBe(path.resolve("/env/config.json"));
  });

  it("gives explicit override precedence over PAPERCLIP_CONFIG env var", () => {
    process.env.PAPERCLIP_CONFIG = "/env/config.json";
    const result = resolvePaperclipConfigPath("/explicit/override.json");
    expect(result).toBe(path.resolve("/explicit/override.json"));
  });

  it("finds a .paperclip/config.json in an ancestor directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pclip-paths-test-"));
    try {
      const configDir = path.join(tmpDir, ".paperclip");
      fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, "config.json");
      fs.writeFileSync(configPath, JSON.stringify({ deploymentMode: "local", logging: { logDir: null } }));

      const deepDir = path.join(tmpDir, "a", "b", "c");
      fs.mkdirSync(deepDir, { recursive: true });

      delete process.env.PAPERCLIP_CONFIG;
      const originalCwd = process.cwd();
      process.chdir(deepDir);
      try {
        const result = resolvePaperclipConfigPath();
        expect(result).toBe(configPath);
      } finally {
        process.chdir(originalCwd);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("falls back to the default config path when no ancestor has .paperclip/config.json", () => {
    delete process.env.PAPERCLIP_CONFIG;
    // Run from a directory guaranteed to have no .paperclip/config.json ancestor
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pclip-noanc-"));
    try {
      const originalCwd = process.cwd();
      process.chdir(tmpDir);
      try {
        const result = resolvePaperclipConfigPath();
        // Should return the default config path (ends in config.json)
        expect(result).toMatch(/config\.json$/);
      } finally {
        process.chdir(originalCwd);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("resolvePaperclipEnvPath", () => {
  it("returns a .env file in the same directory as the resolved config path", () => {
    const envPath = resolvePaperclipEnvPath("/some/dir/config.json");
    expect(envPath).toBe(path.resolve("/some/dir/.env"));
  });

  it("derives the .env path from PAPERCLIP_CONFIG env var", () => {
    process.env.PAPERCLIP_CONFIG = "/env/dir/config.json";
    const envPath = resolvePaperclipEnvPath();
    expect(envPath).toBe(path.resolve("/env/dir/.env"));
  });

  it("is always named .env regardless of the config filename", () => {
    const envPath = resolvePaperclipEnvPath("/foo/bar/custom-name.json");
    expect(path.basename(envPath)).toBe(".env");
  });
});
