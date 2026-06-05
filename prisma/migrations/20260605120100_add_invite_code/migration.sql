-- Add inviteCode column to Game table
ALTER TABLE "Game" ADD COLUMN "inviteCode" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "Game_inviteCode_key" ON "Game"("inviteCode");
