-- Add service fee and financial tracking fields to rental_requests
-- (Stripe fee: 2.9% + $0.30; application_fee_amount = platform cut + service fee)
ALTER TABLE "rental_requests" ADD COLUMN "service_fee" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "rental_requests" ADD COLUMN "application_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "rental_requests" ADD COLUMN "owner_payout" numeric(10, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "rental_requests" ADD COLUMN "platform_net_revenue" numeric(10, 2) DEFAULT '0' NOT NULL;
