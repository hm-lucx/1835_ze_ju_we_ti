-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 12000,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_gameId_key" ON "BankAccount"("gameId");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
