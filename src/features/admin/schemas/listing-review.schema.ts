import { z } from "zod";

// Validation schema for rejection reason
export const rejectionReasonSchema = z
  .string()
  .min(10, "Rejection reason must be at least 10 characters")
  .max(1000, "Rejection reason must be at most 1000 characters")
  .trim();
