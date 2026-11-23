import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues.map((i) => i.message).join(", ");
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message,
      },
    });
    return;
  }

  if (err instanceof SyntaxError && "status" in err && (err as { status?: number }).status === 400) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Malformed JSON payload.",
      },
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    },
  });
}
