CREATE TABLE "community_networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_visibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"community_id" uuid NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "join_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "network_id" uuid;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "latitude" numeric(10, 8);--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "longitude" numeric(11, 8);--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD COLUMN "verification_status" "verification_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD COLUMN "verified_by" text;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD COLUMN "admin_notes" text;--> statement-breakpoint
ALTER TABLE "community_visibility" ADD CONSTRAINT "community_visibility_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_visibility" ADD CONSTRAINT "community_visibility_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_networks_name_idx" ON "community_networks" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "community_networks_slug_idx" ON "community_networks" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "community_visibility_user_community_idx" ON "community_visibility" USING btree ("user_id","community_id");--> statement-breakpoint
CREATE INDEX "community_visibility_user_visible_idx" ON "community_visibility" USING btree ("user_id") WHERE "community_visibility"."is_visible" = true;--> statement-breakpoint
CREATE INDEX "community_visibility_community_visible_idx" ON "community_visibility" USING btree ("community_id") WHERE "community_visibility"."is_visible" = true;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_network_id_community_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."community_networks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communities_network_id_idx" ON "communities" USING btree ("network_id");--> statement-breakpoint
CREATE UNIQUE INDEX "community_memberships_user_primary_idx" ON "community_memberships" USING btree ("user_id") WHERE "community_memberships"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "community_memberships_verification_status_idx" ON "community_memberships" USING btree ("verification_status");