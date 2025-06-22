import { eq, and, inArray } from "drizzle-orm";
import { rentals } from "@/db/schemas/rentals.schema";
import { BaseDAL } from "./base";

export class RentalDAL extends BaseDAL {
  async countBorrowedTools(userId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(rentals)
      .where(
        and(
          eq(rentals.renterId, userId),
          inArray(rentals.status, ["approved", "completed"]),
        ),
      );

    return result.length;
  }

  async countSharedTools(userId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(rentals)
      .where(
        and(
          eq(rentals.ownerId, userId),
          inArray(rentals.status, ["approved", "completed"]),
        ),
      );

    return result.length;
  }
}
