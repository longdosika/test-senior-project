import express, { type NextFunction, type Request, type Response } from "express";
import type { AppDeps } from "./deps";
import { HttpError } from "./http";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { featureRouter, providerErrorStatus } from "./routes/features";
import { taskRouter } from "./routes/tasks";

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", deps.corsOrigin);
    // Cookies are sent cross-origin only when the origin is explicit (never "*") and credentials are allowed.
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter(deps));
  app.use("/api/tasks", taskRouter(deps));
  app.use("/api/admin", adminRouter(deps));
  app.use("/api", featureRouter(deps));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not found" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    const providerStatus = providerErrorStatus(err);
    if (providerStatus) {
      res.status(providerStatus).json({ error: (err as Error).message });
      return;
    }
    const status = (err as { status?: unknown })?.status;
    if (typeof status === "number" && status >= 400 && status < 500) {
      res.status(status).json({ error: (err as Error).message || "bad request" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
