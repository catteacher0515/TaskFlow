import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("launchd support files", () => {
  it("defines a persistent launch agent that keeps the local TaskFlow server running", () => {
    const plistPath = path.resolve(process.cwd(), "launchd/com.huapingyu.taskflow.local.plist");
    const content = readFileSync(plistPath, "utf8");

    expect(content).toContain("<key>Label</key>");
    expect(content).toContain("<string>com.huapingyu.taskflow.local</string>");
    expect(content).toContain("<string>/bin/zsh</string>");
    expect(content).toContain("<string>npm run local:daemon</string>");
    expect(content).toContain("<key>RunAtLoad</key>");
    expect(content).toContain("<true/>");
    expect(content).toContain("<key>KeepAlive</key>");
    expect(content).toContain("<true/>");
    expect(content).toContain("<key>WorkingDirectory</key>");
    expect(content).toContain("/Users/huapingyu/dev/TaskFlow");
  });
});
