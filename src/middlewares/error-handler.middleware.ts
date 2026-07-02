import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/app-error.js";

const isProduction = process.env["NODE_ENV"] === "production";

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    console.error("[ERROR]", {
      method: req.method,
      path: req.originalUrl,
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
    });

    const payload: Record<string, unknown> = {
      error: error.message,
      code: error.code,
    };

    if (error.details !== undefined && !isProduction) {
      payload.details = error.details;
    }

    res.status(error.statusCode).json(payload);
    return;
  }

  const message =
    error instanceof Error ? error.message : "Erro interno do servidor";
  const stack = error instanceof Error ? error.stack : undefined;

  console.error("[ERROR]", {
    method: req.method,
    path: req.originalUrl,
    message,
    stack,
  });

  res.status(500).json({
    error: isProduction ? "Erro interno do servidor" : message,
    code: "INTERNAL_ERROR",
  });
}
