import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("local command helper files", () => {
  it("ships a CLI installer that creates taskflow-open and taskflow-stop wrappers", () => {
    const installerPath = path.resolve(process.cwd(), "install-taskflow-cli.command");
    const content = readFileSync(installerPath, "utf8");

    expect(content).toContain('cat > "$BIN_DIR/taskflow-open"');
    expect(content).toContain('cat > "$BIN_DIR/taskflow-stop"');
    expect(content).toContain('exec ./open-taskflow.command');
    expect(content).toContain('exec ./stop-taskflow.command');
  });
});
