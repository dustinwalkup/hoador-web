-- BIZ-06: chargeback auto-disputes are inserted with created_by = 'system',
-- and disputes.created_by is a FK to "user".id. No row carried that id, so
-- every auto-dispute failed the FK and the payout freeze + ops alert never ran.
-- No "account" row is created, so this user can never sign in.
INSERT INTO "user" ("id", "name", "email", "status", "user_type", "email_verified")
VALUES ('system', 'System', 'system@invalid.hoador', 'inactive', 'standard', false)
ON CONFLICT ("id") DO NOTHING;
