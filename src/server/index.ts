import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import { initializeDataDir } from "./storage";

const rootDir = process.cwd();
const port = Number(process.env.PORT ?? 4317);
const host = process.env.HOST ?? "0.0.0.0";

await initializeDataDir(rootDir);

const app = createApp({
  rootDir,
  now: () => new Date().toISOString(),
  id: () => randomUUID()
});

app.listen(port, host, () => {
  console.log(`TaskFlow API listening on http://${host}:${port}`);
});
