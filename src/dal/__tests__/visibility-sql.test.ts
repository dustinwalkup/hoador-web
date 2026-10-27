import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { listings } from "@/db/schemas/listings.schema";
import { ownerVisibleToViewerHome } from "../visibility-sql";

const render = (chunk: ReturnType<typeof ownerVisibleToViewerHome>) =>
  new PgDialect().sqlToQuery(chunk);

const rawRecipientColumn = sql`cv.user_id`;

describe("ownerVisibleToViewerHome", () => {
  it("checks the owner's flag for the viewer's primary community", () => {
    const { sql: text } = render(
      ownerVisibleToViewerHome(listings.ownerId, "viewer-b"),
    );

    expect(text).toContain('"viewer_home"."is_primary" = true');
    expect(text).toContain(
      '"viewer_home"."community_id" = "owner_home_cv"."community_id"',
    );
    expect(text).toContain('"owner_home_cv"."user_id" = "listings"."owner_id"');
    expect(text).toContain('"owner_home_cv"."is_visible" = true');
  });

  // An aliased Drizzle table interpolated into raw `sql` renders as the bare
  // alias; without `AS`, Postgres would look for a table named owner_home_cv.
  it("names the real tables behind the aliases", () => {
    const { sql: text } = render(
      ownerVisibleToViewerHome(listings.ownerId, "viewer-b"),
    );

    expect(text).toContain('FROM "community_visibility" AS "owner_home_cv"');
    expect(text).toContain('JOIN "community_memberships" AS "viewer_home"');
  });

  // The need fan-out filters a set of recipients, so the viewer is a column
  // there, and the poster a bound id.
  it("accepts a column as the viewer and a bound id as the owner", () => {
    const { sql: text, params } = render(
      ownerVisibleToViewerHome("poster-a", rawRecipientColumn),
    );

    expect(text).toContain('"viewer_home"."user_id" = cv.user_id');
    expect(text).toContain('"owner_home_cv"."user_id" = $1');
    expect(params).toEqual(["poster-a"]);
  });

  it("binds the viewer id rather than interpolating it", () => {
    const hostile = "x' OR '1'='1";
    const { sql: text, params } = render(
      ownerVisibleToViewerHome(sql`n.created_by_user_id`, hostile),
    );

    expect(params).toEqual([hostile]);
    expect(text).not.toContain(hostile);
    expect(text).toContain('"viewer_home"."user_id" = $1');
    expect(text).toContain('"owner_home_cv"."user_id" = n.created_by_user_id');
  });
});
