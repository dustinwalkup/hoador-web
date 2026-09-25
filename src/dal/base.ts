import * as Sentry from "@sentry/nextjs";
import { db } from "@/db/db";
import { DALError, ValidationError, ConflictError } from "./errors";
import { type PaginatedResult } from "./types";

export abstract class BaseDAL<TTable = undefined> {
  protected db = db;
  protected table?: TTable;

  constructor(table?: TTable) {
    this.table = table;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected handleError(error: any, operation: string): never {
    console.error(`DAL Error in ${operation}:`, error);

    // drizzle-orm 0.45 wraps every driver error in `DrizzleQueryError`; the
    // real pg error (with `.code`) lives on `.cause`, not on the error
    // itself (SEC-16). Falling back to `error` keeps this working for a
    // driver error that isn't wrapped, and for mocked `{code}` fixtures.
    const pgError = error?.cause ?? error;
    const pgCode = pgError?.code;

    const isUnexpectedError =
      process.env.NODE_ENV === "production" &&
      pgCode !== "23505" &&
      pgCode !== "23503" &&
      pgCode !== "23514";

    if (isUnexpectedError) {
      Sentry.captureException(error, {
        tags: { error_type: "dal_error", operation, error_code: pgCode },
        contexts: { database: { operation, error_code: pgCode } },
      });
    }

    if (error instanceof DALError) {
      throw error;
    }

    if (pgCode === "23505") {
      throw new ConflictError("A record with this value already exists");
    }
    if (pgCode === "23503") {
      throw new ValidationError("Referenced record does not exist");
    }
    if (pgCode === "23514") {
      throw new ValidationError("Invalid data provided");
    }

    // Generic database error. Never put the driver message in the client
    // response (SEC-16) — it's already logged above (console.error, and to
    // Sentry when unexpected) with the operation name for correlation.
    throw new DALError(
      "A database error occurred. Please try again.",
      "DATABASE_ERROR",
      500,
    );
  }

  protected validatePagination(page: number, limit: number): void {
    if (page < 1) {
      throw new ValidationError("Page must be greater than 0", "page");
    }

    if (limit < 1 || limit > 100) {
      throw new ValidationError("Limit must be between 1 and 100", "limit");
    }
  }

  protected createPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  protected validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  protected validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-$$$$]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10;
  }

  /**
   * Retry a read-only DB call once on transient connection failures.
   *
   * Safe ONLY for reads. Do not use for writes — a "Connection terminated"
   * error can fire after the server has already committed, so retrying a
   * mutation risks duplicate writes.
   */
  protected async withReadRetry<T>(
    fn: () => Promise<T>,
    operation: string,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (!isTransientConnectionError(error)) throw error;
      console.warn(
        `[DAL] Transient connection error in ${operation}, retrying once:`,
        (error as Error)?.message,
      );
      await new Promise((r) => setTimeout(r, 75));
      return await fn();
    }
  }
}

const TRANSIENT_MESSAGE_PATTERNS = [
  "Connection terminated unexpectedly",
  "Connection terminated",
  "terminating connection due to administrator command",
  "Client has encountered a connection error and is not queryable",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
];

function isTransientConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const msg = (error as { message?: string }).message ?? "";
  const code = (error as { code?: string }).code ?? "";
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EPIPE") {
    return true;
  }
  return TRANSIENT_MESSAGE_PATTERNS.some((p) => msg.includes(p));
}
