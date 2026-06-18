import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { registerRoutes, type RouteDeps } from "./routes";

export function createApp(deps: RouteDeps) {
  const app = express();
  const clientDistDir = path.join(deps.rootDir, "dist", "client");
  const clientIndexPath = path.join(clientDistDir, "index.html");

  app.use(express.json());
  registerRoutes(app, deps);

  if (existsSync(clientIndexPath)) {
    app.use(express.static(clientDistDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }

      res.sendFile(clientIndexPath);
    });
  }

  return app;
}
