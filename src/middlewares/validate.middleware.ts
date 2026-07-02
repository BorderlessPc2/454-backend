import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "../lib/app-error.js";

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      next(new ValidationError("Dados inválidos", fieldErrors));
      return;
    }

    req.body = result.data;
    next();
  };
}
