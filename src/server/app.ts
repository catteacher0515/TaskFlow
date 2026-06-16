import express from "express";
import { registerRoutes, type RouteDeps } from "./routes";

export function createApp(deps: RouteDeps) {
  const app = express();

  app.use(express.json());
  registerRoutes(app, deps);

  return app;
}
