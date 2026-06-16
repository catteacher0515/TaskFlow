import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import { initializeDataDir } from "./storage";

const rootDir = process.cwd();
const port = Number(process.env.PORT ?? 4317);

await initializeDataDir(rootDir);

const app = createApp({
  rootDir,
  now: () => new Date().toISOString(),
  id: () => randomUUID()
});

app.listen(port, "127.0.0.1", () => {
  console.log(`TaskFlow local API listening on http://127.0.0.1:${port}`);
});
