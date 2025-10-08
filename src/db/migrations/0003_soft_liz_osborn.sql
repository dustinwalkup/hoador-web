ALTER TABLE "rental_requests" ADD COLUMN "setup_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD COLUMN "setup_fee" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "setup_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "setup_fee" numeric(10, 2) DEFAULT '0' NOT NULL;