import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { importModuleFromFsPath } from "../services/plugin-manifest-import.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "paperclip-plugin-import-"));
  tempDirs.push(dir);
  return dir;
}

describe("importModuleFromFsPath", () => {
  it("imports modules from absolute filesystem paths", async () => {
    const tempDir = makeTempDir();
    const manifestPath = path.join(tempDir, "manifest.js");
    writeFileSync(
      manifestPath,
      [
        "export default {",
        "  id: 'paperclip.decision-surface',",
        "  routePath: 'decisions',",
        "};",
        "",
      ].join("\n"),
    );

    const mod = await importModuleFromFsPath(manifestPath) as {
      default?: { id?: string; routePath?: string };
    };

    expect(mod.default?.id).toBe("paperclip.decision-surface");
    expect(mod.default?.routePath).toBe("decisions");
  });
});
