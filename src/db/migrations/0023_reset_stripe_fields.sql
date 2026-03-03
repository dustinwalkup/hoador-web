UPDATE "user"
SET
  "stripe_customer_id" = NULL,
  "stripe_connected_account_id" = NULL,
  "connect_onboarding_complete" = false,
  "connect_charges_enabled" = false,
  "connect_payouts_enabled" = false;
