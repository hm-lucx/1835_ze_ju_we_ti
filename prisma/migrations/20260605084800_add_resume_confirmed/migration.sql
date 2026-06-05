-- Add resumeConfirmed column to GamePlayer
ALTER TABLE "GamePlayer" ADD COLUMN IF NOT EXISTS "resumeConfirmed" BOOLEAN NOT NULL DEFAULT false;
