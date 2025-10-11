-- Add new enum values to payment_status
-- This must be in a separate migration from using the enum
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'processing' BEFORE 'completed';
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'succeeded' BEFORE 'completed';

