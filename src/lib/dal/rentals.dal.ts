import { eq, and, inArray, sql } from "drizzle-orm";
import { rentals, rentalRequests } from "@/db/schemas/rentals.schema";
import { tools, toolImages } from "@/db/schemas/tools.schema";
import { users } from "@/db/schemas/users.schema";
import { BaseDAL } from "./base";
import { getCurrentUserId } from "../auth/auth-utils";
import { UnauthorizedError } from "./errors";

export interface BorrowedTool {
  id: string;
  toolId: string;
  toolName: string;
  toolImageUrl: string | null;
  ownerId: string;
  ownerName: string;
  startDate: Date;
  endDate: Date;
  totalAmount: string;
  status: string;
  dailyRate: string;
}

export interface BorrowedToolsData {
  currentRentals: BorrowedTool[];
  upcomingRentals: BorrowedTool[];
}

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

  async getBorrowedTools(): Promise<BorrowedToolsData> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      const now = new Date();

      // Get all active and approved rentals for the user
      const allRentals = await this.db
        .select({
          id: rentals.id,
          toolId: rentals.toolId,
          toolName: tools.name,
          ownerId: rentals.ownerId,
          ownerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
          startDate: rentals.startDate,
          endDate: rentals.endDate,
          totalAmount: rentals.totalAmount,
          status: rentals.status,
          dailyRate: rentalRequests.dailyRate,
        })
        .from(rentals)
        .innerJoin(tools, eq(rentals.toolId, tools.id))
        .innerJoin(users, eq(rentals.ownerId, users.id))
        .innerJoin(rentalRequests, eq(rentals.requestId, rentalRequests.id))
        .where(
          and(
            eq(rentals.renterId, userId),
            inArray(rentals.status, ["approved", "active"]),
          ),
        )
        .orderBy(rentals.startDate);

      // Get images for all tools
      const toolIds = [...new Set(allRentals.map((rental) => rental.toolId))];
      const toolImagesMap = new Map<string, string | null>();

      for (const toolId of toolIds) {
        const [firstImage] = await this.db
          .select({ imageUrl: toolImages.imageUrl })
          .from(toolImages)
          .where(eq(toolImages.toolId, toolId))
          .orderBy(toolImages.orderIndex)
          .limit(1);

        toolImagesMap.set(toolId, firstImage?.imageUrl || null);
      }

      // Separate current and upcoming rentals
      const currentRentals: BorrowedTool[] = [];
      const upcomingRentals: BorrowedTool[] = [];

      for (const rental of allRentals) {
        const toolWithImage: BorrowedTool = {
          ...rental,
          toolImageUrl: toolImagesMap.get(rental.toolId) || null,
        };

        // Current rentals: started and not yet ended
        if (rental.startDate <= now && rental.endDate >= now) {
          currentRentals.push(toolWithImage);
        }
        // Upcoming rentals: haven't started yet
        else if (rental.startDate > now) {
          upcomingRentals.push(toolWithImage);
        }
      }

      return {
        currentRentals,
        upcomingRentals,
      };
    } catch (error) {
      this.handleError(error, "getBorrowedTools");
    }
  }
}
