/*
  Warnings:

  - You are about to drop the column `type` on the `ScheduledJob` table. All the data in the column will be lost.
  - Added the required column `prompt` to the `ScheduledJob` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduledJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "cron_expression" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduledJob" ("createdAt", "frequency", "id", "label", "lastRunAt", "schedule", "updatedAt", "userId") SELECT "createdAt", "frequency", "id", "label", "lastRunAt", "schedule", "updatedAt", "userId" FROM "ScheduledJob";
DROP TABLE "ScheduledJob";
ALTER TABLE "new_ScheduledJob" RENAME TO "ScheduledJob";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
