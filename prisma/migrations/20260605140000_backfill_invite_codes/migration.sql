-- Backfill empty inviteCode values before unique constraint conflicts on shared DBs
UPDATE "Game"
SET "inviteCode" = UPPER(SUBSTRING(MD5("id") FROM 1 FOR 6))
WHERE "inviteCode" = '' OR "inviteCode" IS NULL;
