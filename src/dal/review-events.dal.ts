import { and, asc, eq, inArray } from "drizzle-orm";

import { BaseDAL } from "./base";
import { reviewEvents } from "@/db/schemas/review-events.schema";
import type { ReviewEventRow } from "@/db/schemas/review-events.schema";
import { reviewEntityKindEnum, reviewEventTypeEnum } from "@/db/schemas/_enums";
import { user } from "@/db/schemas/user.schema";

export type ReviewEntityKind = (typeof reviewEntityKindEnum.enumValues)[number];
export type ReviewEventType = (typeof reviewEventTypeEnum.enumValues)[number];

export type ReviewEvent = ReviewEventRow & {
  /** Resolved actor, or null if the actor user no longer exists or there is no actor. */
  actor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
};

interface CreateReviewEventInput {
  entityKind: ReviewEntityKind;
  entityId: string;
  eventType: ReviewEventType;
  actorUserId: string | null;
  note?: string | null;
}

/**
 * DAL for append-only review events (admin decisions + provider resubmits).
 *
 * These events are used to reconstruct full review history without relying on
 * parent-row scalar fields that might change over time.
 */
export class ReviewEventsDAL extends BaseDAL {
  async createEvent(input: CreateReviewEventInput): Promise<void> {
    try {
      await this.db.insert(reviewEvents).values({
        entityKind: input.entityKind,
        entityId: input.entityId,
        eventType: input.eventType,
        actorUserId: input.actorUserId,
        note: input.note ?? null,
      });
    } catch (error) {
      this.handleError(error, "ReviewEventsDAL.createEvent");
    }
  }

  /**
   * Deletes all events for one entity.
   */
  async deleteEventsForEntity(
    entityKind: ReviewEntityKind,
    entityId: string,
  ): Promise<void> {
    try {
      await this.db
        .delete(reviewEvents)
        .where(
          and(
            eq(reviewEvents.entityKind, entityKind),
            eq(reviewEvents.entityId, entityId),
          ),
        );
    } catch (error) {
      this.handleError(error, "ReviewEventsDAL.deleteEventsForEntity");
    }
  }

  /**
   * Fetch events for one entity, chronological (oldest -> newest).
   */
  async getEventsForEntity(
    entityKind: ReviewEntityKind,
    entityId: string,
  ): Promise<ReviewEvent[]> {
    try {
      const rows = await this.db
        .select({
          id: reviewEvents.id,
          entityKind: reviewEvents.entityKind,
          entityId: reviewEvents.entityId,
          eventType: reviewEvents.eventType,
          actorUserId: reviewEvents.actorUserId,
          note: reviewEvents.note,
          createdAt: reviewEvents.createdAt,
          actorFirstName: user.firstName,
          actorLastName: user.lastName,
          actorProfileImageUrl: user.profileImageUrl,
        })
        .from(reviewEvents)
        .leftJoin(user, eq(reviewEvents.actorUserId, user.id))
        .where(
          and(
            eq(reviewEvents.entityKind, entityKind),
            eq(reviewEvents.entityId, entityId),
          ),
        )
        .orderBy(asc(reviewEvents.createdAt));

      return rows.map((row) => ({
        id: row.id,
        entityKind: row.entityKind,
        entityId: row.entityId,
        eventType: row.eventType,
        actorUserId: row.actorUserId,
        note: row.note,
        createdAt: row.createdAt,
        actor: row.actorUserId
          ? {
              id: row.actorUserId,
              firstName: row.actorFirstName,
              lastName: row.actorLastName,
              profileImageUrl: row.actorProfileImageUrl,
            }
          : null,
      }));
    } catch (error) {
      this.handleError(error, "ReviewEventsDAL.getEventsForEntity");
    }
  }

  /**
   * Fetch events for multiple entities of the same kind in one query,
   * sorted chronologically for reconstruction by the caller.
   */
  async getEventsForEntities(
    entityKind: ReviewEntityKind,
    entityIds: string[],
  ): Promise<ReviewEvent[]> {
    if (entityIds.length === 0) return [];
    try {
      const rows = await this.db
        .select({
          id: reviewEvents.id,
          entityKind: reviewEvents.entityKind,
          entityId: reviewEvents.entityId,
          eventType: reviewEvents.eventType,
          actorUserId: reviewEvents.actorUserId,
          note: reviewEvents.note,
          createdAt: reviewEvents.createdAt,
          actorFirstName: user.firstName,
          actorLastName: user.lastName,
          actorProfileImageUrl: user.profileImageUrl,
        })
        .from(reviewEvents)
        .leftJoin(user, eq(reviewEvents.actorUserId, user.id))
        .where(
          and(
            eq(reviewEvents.entityKind, entityKind),
            inArray(reviewEvents.entityId, entityIds),
          ),
        )
        .orderBy(asc(reviewEvents.createdAt));

      return rows.map((row) => ({
        id: row.id,
        entityKind: row.entityKind,
        entityId: row.entityId,
        eventType: row.eventType,
        actorUserId: row.actorUserId,
        note: row.note,
        createdAt: row.createdAt,
        actor: row.actorUserId
          ? {
              id: row.actorUserId,
              firstName: row.actorFirstName,
              lastName: row.actorLastName,
              profileImageUrl: row.actorProfileImageUrl,
            }
          : null,
      }));
    } catch (error) {
      this.handleError(error, "ReviewEventsDAL.getEventsForEntities");
    }
  }
}
