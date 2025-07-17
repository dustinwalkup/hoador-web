import { eq, and, inArray, sql } from "drizzle-orm";
import { differenceInDays } from "date-fns";

import { rentals, rentalRequests } from "@/db/schemas/rentals.schema";
import { tools, toolImages } from "@/db/schemas/tools.schema";
import { users } from "@/db/schemas/users.schema";
import { type CreateRentalRequestFormData } from "../form-schemas/rental.schema";
import { getCurrentUserId } from "../auth/auth-utils";
import { BaseDAL } from "./base";
import { UnauthorizedError, NotFoundError } from "./errors";

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

export interface RentalRequestItem {
  id: string;
  toolId: string;
  toolName: string;
  toolImageUrl: string | null;
  ownerId: string;
  ownerName: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  dailyRate: string;
  totalAmount: string;
  status: string;
  createdAt: Date;
  deliveryRequested: boolean;
  message: string | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  approvedAt?: Date | null;
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

  async createRentalRequest(
    formData: CreateRentalRequestFormData,
  ): Promise<{ id: string }> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Get tool details to calculate pricing and validate ownership
      const tool = await this.db.query.tools.findFirst({
        where: eq(tools.id, formData.toolId),
        with: {
          owner: {
            columns: {
              id: true,
            },
          },
        },
      });

      if (!tool) {
        throw new NotFoundError("Tool", formData.toolId);
      }

      // Prevent users from renting their own tools
      if (tool.ownerId === userId) {
        throw new Error("Cannot rent your own tool");
      }

      // Calculate rental period and pricing
      const totalDays =
        differenceInDays(formData.endDate, formData.startDate) + 1;

      // Validate rental period
      if (totalDays < tool.minimumRentalPeriod) {
        throw new Error(
          `Minimum rental period is ${tool.minimumRentalPeriod} day(s)`,
        );
      }

      if (totalDays > tool.maximumRentalPeriod) {
        throw new Error(
          `Maximum rental period is ${tool.maximumRentalPeriod} days`,
        );
      }

      // Calculate rate based on rental period (apply discounts for longer rentals)
      let dailyRate = Number(tool.dailyRate);
      if (totalDays >= 30 && tool.monthlyRate) {
        dailyRate = Number(tool.monthlyRate) / 30;
      } else if (totalDays >= 7 && tool.weeklyRate) {
        dailyRate = Number(tool.weeklyRate) / 7;
      }

      const subtotal = Math.round(dailyRate * totalDays * 100) / 100;
      const deliveryFee = formData.deliveryRequested
        ? Number(tool.deliveryFee)
        : 0;
      const securityDeposit = Number(tool.securityDeposit);
      const totalAmount = subtotal + deliveryFee;

      // Create rental request
      const [rentalRequest] = await this.db
        .insert(rentalRequests)
        .values({
          toolId: formData.toolId,
          renterId: userId,
          ownerId: tool.ownerId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          totalDays,
          dailyRate: dailyRate.toString(),
          totalAmount: totalAmount.toString(),
          securityDeposit: securityDeposit.toString(),
          deliveryRequested: formData.deliveryRequested,
          deliveryAddress: formData.deliveryAddress || null,
          deliveryFee: deliveryFee.toString(),
          message: formData.message || null,
          status: "pending",
        })
        .returning({ id: rentalRequests.id });

      return { id: rentalRequest.id };
    } catch (error) {
      this.handleError(error, "createRentalRequest");
    }
  }

  async getRentalRequestById(requestId: string): Promise<{
    id: string;
    toolId: string;
    toolName: string;
    toolImageUrl: string | null;
    renterId: string;
    ownerId: string;
    ownerName: string;
    startDate: Date;
    endDate: Date;
    totalDays: number;
    dailyRate: string;
    totalAmount: string;
    securityDeposit: string;
    deliveryRequested: boolean;
    deliveryAddress: string | null;
    deliveryFee: string;
    message: string | null;
    status: string;
    createdAt: Date;
  }> {
    try {
      // Get current user ID for security check
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Get rental request with related data
      const rentalRequest = await this.db
        .select({
          id: rentalRequests.id,
          toolId: rentalRequests.toolId,
          toolName: tools.name,
          renterId: rentalRequests.renterId,
          ownerId: rentalRequests.ownerId,
          ownerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          totalDays: rentalRequests.totalDays,
          dailyRate: rentalRequests.dailyRate,
          totalAmount: rentalRequests.totalAmount,
          securityDeposit: rentalRequests.securityDeposit,
          deliveryRequested: rentalRequests.deliveryRequested,
          deliveryAddress: rentalRequests.deliveryAddress,
          deliveryFee: rentalRequests.deliveryFee,
          message: rentalRequests.message,
          status: rentalRequests.status,
          createdAt: rentalRequests.createdAt,
        })
        .from(rentalRequests)
        .innerJoin(tools, eq(rentalRequests.toolId, tools.id))
        .innerJoin(users, eq(rentalRequests.ownerId, users.id))
        .where(eq(rentalRequests.id, requestId))
        .limit(1);

      if (rentalRequest.length === 0) {
        throw new NotFoundError("Rental request", requestId);
      }

      const request = rentalRequest[0];

      // Security check: only the renter or owner can view the request
      if (request.renterId !== userId && request.ownerId !== userId) {
        throw new UnauthorizedError("Access denied to this rental request");
      }

      // Get tool image
      const [firstImage] = await this.db
        .select({ imageUrl: toolImages.imageUrl })
        .from(toolImages)
        .where(eq(toolImages.toolId, request.toolId))
        .orderBy(toolImages.orderIndex)
        .limit(1);

      return {
        ...request,
        toolImageUrl: firstImage?.imageUrl || null,
      };
    } catch (error) {
      this.handleError(error, "getRentalRequestById");
    }
  }

  async getRentalRequestsByStatus(
    status:
      | "pending"
      | "approved"
      | "active"
      | "completed"
      | "cancelled"
      | "overdue"
      | "rejected",
  ): Promise<RentalRequestItem[]> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Get rental requests with related data
      const requests = await this.db
        .select({
          id: rentalRequests.id,
          toolId: rentalRequests.toolId,
          toolName: tools.name,
          ownerId: rentalRequests.ownerId,
          ownerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          totalDays: rentalRequests.totalDays,
          dailyRate: rentalRequests.dailyRate,
          totalAmount: rentalRequests.totalAmount,
          status: rentalRequests.status,
          createdAt: rentalRequests.createdAt,
          deliveryRequested: rentalRequests.deliveryRequested,
          message: rentalRequests.message,
          rejectedAt: rentalRequests.rejectedAt,
          rejectionReason: rentalRequests.rejectionReason,
          approvedAt: rentalRequests.approvedAt,
        })
        .from(rentalRequests)
        .innerJoin(tools, eq(rentalRequests.toolId, tools.id))
        .innerJoin(users, eq(rentalRequests.ownerId, users.id))
        .where(
          and(
            eq(rentalRequests.renterId, userId),
            eq(rentalRequests.status, status),
          ),
        )
        .orderBy(rentalRequests.createdAt);

      // Get images for all tools
      const toolIds = [...new Set(requests.map((request) => request.toolId))];
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

      // Add tool images to requests
      return requests.map((request) => ({
        ...request,
        toolImageUrl: toolImagesMap.get(request.toolId) || null,
      }));
    } catch (error) {
      this.handleError(error, "getRentalRequestsByStatus");
    }
  }
}
