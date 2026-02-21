/*
  Warnings:

  - Added the required column `userId` to the `ScheduledJob` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProcessedFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileSize" INTEGER NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "totalAmount" REAL NOT NULL,
    "filePath" TEXT,
    "fileContent" TEXT,
    CONSTRAINT "ProcessedFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DonationTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "donorEmail" TEXT NOT NULL,
    "grossAmount" REAL NOT NULL,
    "fee" REAL NOT NULL,
    "netAmount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "originalData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DonationTransaction_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ProcessedFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DonationLetter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "donorName" TEXT NOT NULL,
    "donorEmail" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "dateRange" TEXT NOT NULL,
    "isSummary" BOOLEAN NOT NULL DEFAULT false,
    "pdfPath" TEXT,
    "pdfGenerated" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipient" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "letterId" TEXT,
    "errorMessage" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasAttachment" BOOLEAN NOT NULL DEFAULT false,
    "attachmentType" TEXT,
    "fileId" TEXT,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuickBooksConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "expiresAt" DATETIME NOT NULL,
    "refreshExpiresAt" DATETIME NOT NULL,
    "companyName" TEXT,
    "lastSyncAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuickBooksConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DonationLetterToDonationTransaction" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DonationLetterToDonationTransaction_A_fkey" FOREIGN KEY ("A") REFERENCES "DonationLetter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DonationLetterToDonationTransaction_B_fkey" FOREIGN KEY ("B") REFERENCES "DonationTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JobExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "latency" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "JobExecution_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScheduledJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_JobExecution" ("completedAt", "id", "jobId", "latency", "result", "startedAt", "status") SELECT "completedAt", "id", "jobId", "latency", "result", "startedAt", "status" FROM "JobExecution";
DROP TABLE "JobExecution";
ALTER TABLE "new_JobExecution" RENAME TO "JobExecution";
CREATE TABLE "new_ScheduledJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduledJob" ("createdAt", "id", "label", "lastRunAt", "schedule", "type", "updatedAt") SELECT "createdAt", "id", "label", "lastRunAt", "schedule", "type", "updatedAt" FROM "ScheduledJob";
DROP TABLE "ScheduledJob";
ALTER TABLE "new_ScheduledJob" RENAME TO "ScheduledJob";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "QuickBooksConnection_userId_key" ON "QuickBooksConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "_DonationLetterToDonationTransaction_AB_unique" ON "_DonationLetterToDonationTransaction"("A", "B");

-- CreateIndex
CREATE INDEX "_DonationLetterToDonationTransaction_B_index" ON "_DonationLetterToDonationTransaction"("B");
