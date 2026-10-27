import { sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import {
  communityMemberships,
  communityVisibility,
} from "@/db/schemas/communities.schema";

type UserRef = string | AnyPgColumn | SQL;

const ownerHomeCv = alias(communityVisibility, "owner_home_cv");
const viewerHome = alias(communityMemberships, "viewer_home");

/**
 * The owner-side half of symmetric community visibility, keyed on the
 * VIEWER's home community: true when the item's owner has not hidden the
 * community the viewer lives in ("hiding a community hides you from its
 * members").
 *
 * Every feed already joins the owner's `community_visibility` row for the
 * ITEM's community, but listings, services and needs are all created in the
 * owner's primary community, and `bulkSetVisibility` refuses to hide a
 * primary. That join therefore never fails, and without this predicate an
 * owner who hid community X stayed visible to every member of X.
 *
 * Fail-closed: a viewer with no primary membership, or an owner with no
 * visibility row for the viewer's home, matches nothing. An owner viewing
 * their own items always matches (their home can't be hidden).
 *
 * Each side is a user id (bound, never interpolated), a Drizzle column, or raw
 * `sql` for a hand-written query's alias.
 *
 * @param ownerId - the owner/provider/creator (a feed's owner column)
 * @param viewerId - the viewer (the authenticated user, or a recipient column
 *   when filtering a fan-out)
 */
export function ownerVisibleToViewerHome(
  ownerId: UserRef,
  viewerId: UserRef,
): SQL {
  // An aliased table interpolated into raw `sql` renders as the bare alias
  // name, so the underlying table is spelled out with `AS`.
  return sql`EXISTS (
    SELECT 1
    FROM ${communityVisibility} AS ${ownerHomeCv}
    JOIN ${communityMemberships} AS ${viewerHome}
      ON ${viewerHome.communityId} = ${ownerHomeCv.communityId}
    WHERE ${viewerHome.userId} = ${viewerId}
      AND ${viewerHome.isPrimary} = true
      AND ${ownerHomeCv.userId} = ${ownerId}
      AND ${ownerHomeCv.isVisible} = true
  )`;
}
