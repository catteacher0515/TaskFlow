import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("Vite config file", () => {
  it("writes the production client bundle to dist/client for the local app server", () => {
    const configPath = path.resolve(process.cwd(), "vite.config.ts");
    const content = readFileSync(configPath, "utf8");

    expect(content).toContain('outDir: "dist/client"');
  });
});
