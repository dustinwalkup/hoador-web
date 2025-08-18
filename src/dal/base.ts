import { db } from "@/db/db";
import { DALError, ValidationError } from "./errors";
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

    if (error instanceof DALError) {
      throw error;
    }

    // Handle database constraint errors
    if (error.code === "23505") {
      // Unique constraint violation
      throw new ValidationError("A record with this value already exists");
    }

    if (error.code === "23503") {
      // Foreign key constraint violation
      throw new ValidationError("Referenced record does not exist");
    }

    if (error.code === "23514") {
      // Check constraint violation
      throw new ValidationError("Invalid data provided");
    }

    // Generic database error
    throw new DALError(
      `Database operation failed: ${error.message}`,
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
}
