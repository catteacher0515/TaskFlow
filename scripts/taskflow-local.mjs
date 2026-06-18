#!/usr/bin/env node

import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const runtimeDir = path.join(rootDir, ".taskflow");
const pidFile = path.join(runtimeDir, "server.pid");
const logFile = path.join(runtimeDir, "server.log");
const port = Number(process.env.PORT ?? 4317);
const url = `http://taskflow.localhost:${port}`;
const readyUrl = `http://127.0.0.1:${port}/api/state`;

function ensureRuntimeDir() {
  mkdirSync(runtimeDir, { recursive: true });
}

function readPid() {
  if (!existsSync(pidFile)) {
    return null;
  }

  const raw = readFileSync(pidFile, "utf8").trim();
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function removePidFile() {
  if (existsSync(pidFile)) {
    rmSync(pidFile, { force: true });
  }
}

function isPortReady() {
  return new Promise((resolve) => {
    const request = http.get(readyUrl, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function listTaskFlowServerPids() {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpnc"], {
    cwd: rootDir,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return [];
  }

  const lines = result.stdout.split("\n").filter(Boolean);
  const processes = [];
  let current = {};

  for (const line of lines) {
    const key = line[0];
    const value = line.slice(1);

    if (key === "p") {
      if ("pid" in current) {
        processes.push(current);
      }
      current = { pid: Number(value) };
      continue;
    }

    if (key === "c") {
      current.command = value;
      continue;
    }

    if (key === "n") {
      current.name = value;
    }
  }

  if ("pid" in current) {
    processes.push(current);
  }

  return processes
    .filter((processInfo) => processInfo.command === "node" && String(processInfo.name ?? "").includes(`:${port}`))
    .map((processInfo) => processInfo.pid)
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function stopConflictingServers() {
  const currentPid = readPid();
  const pids = new Set(listTaskFlowServerPids());

  if (currentPid) {
    pids.add(currentPid);
  }

  for (const pid of pids) {
    if (!isProcessRunning(pid)) {
      continue;
    }

    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Ignore race conditions where the process exits between detection and kill.
    }
  }

  removePidFile();
}

async function waitUntilReady(timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortReady()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`TaskFlow did not become ready within ${timeoutMs / 1000} seconds.`);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildClient() {
  console.log("Building TaskFlow...");
  runCommand("npm", ["run", "build"]);
}

function startDetachedServer() {
  ensureRuntimeDir();
  const logFd = openSync(logFile, "a");
  const child = spawn("npm", ["start"], {
    cwd: rootDir,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    shell: process.platform === "win32",
    env: {
      ...process.env,
      PORT: String(port)
    }
  });

  child.unref();
  writeFileSync(pidFile, `${child.pid}\n`, "utf8");
}

async function ensureStarted() {
  const pid = readPid();

  if (pid && isProcessRunning(pid) && (await isPortReady())) {
    console.log(`TaskFlow is already running at ${url}`);
    return;
  }

  if (pid && !isProcessRunning(pid)) {
    removePidFile();
  }

  stopConflictingServers();
  buildClient();
  startDetachedServer();
  await waitUntilReady();
  console.log(`TaskFlow is ready at ${url}`);
}

function openBrowser() {
  if (process.platform === "darwin") {
    spawnSync("open", [url], { stdio: "ignore" });
    return;
  }

  console.log(`Open ${url} in your browser.`);
}

function stopServer() {
  const pid = readPid();
  const runningPids = listTaskFlowServerPids();

  if (!pid && runningPids.length === 0) {
    console.log("TaskFlow is not running.");
    return;
  }

  stopConflictingServers();
  console.log("TaskFlow stopped.");
}

async function main() {
  const command = process.argv[2] ?? "open";

  if (command === "start") {
    await ensureStarted();
    return;
  }

  if (command === "open") {
    await ensureStarted();
    openBrowser();
    return;
  }

  if (command === "stop") {
    stopServer();
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
