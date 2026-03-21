-- AlterTable
ALTER TABLE "DonationTransaction" ADD COLUMN     "classification" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
ADD COLUMN     "classificationConf" DOUBLE PRECISION,
ADD COLUMN     "qbSalesReceiptId" TEXT,
ADD COLUMN     "restrictedFund" TEXT;

-- AlterTable
ALTER TABLE "QuickBooksConnection" ADD COLUMN     "autoSyncCron" TEXT,
ADD COLUMN     "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrgBranding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgName" TEXT,
    "tagLine" TEXT,
    "taxId" TEXT,
    "signerName" TEXT,
    "signerTitle" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qbClassId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllocationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationSplit" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AllocationSplit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgBranding_userId_key" ON "OrgBranding"("userId");

-- AddForeignKey
ALTER TABLE "OrgBranding" ADD CONSTRAINT "OrgBranding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationRule" ADD CONSTRAINT "AllocationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationSplit" ADD CONSTRAINT "AllocationSplit_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AllocationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationSplit" ADD CONSTRAINT "AllocationSplit_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
