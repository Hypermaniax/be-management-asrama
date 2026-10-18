import { config } from "./src/lib/config.ts";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { router } from "./src/routes/route.ts";
import { AppError } from "./src/lib/errors.ts";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({ status: "not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ status: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ status: "validation error", errors: err.issues });
    return;
  }
  console.error(err);
  res.status(500).json({ status: "internal server error" });
});

app.listen(config.port, () => {
  console.log(`Listening on port ${config.port}`);
});
