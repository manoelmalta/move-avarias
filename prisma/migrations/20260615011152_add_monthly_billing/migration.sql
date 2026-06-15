-- CreateTable
CREATE TABLE "MonthlyBilling" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyBilling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBilling_clientId_year_month_key" ON "MonthlyBilling"("clientId", "year", "month");

-- AddForeignKey
ALTER TABLE "MonthlyBilling" ADD CONSTRAINT "MonthlyBilling_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
