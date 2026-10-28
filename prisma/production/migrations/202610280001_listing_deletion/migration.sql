ALTER TABLE "amulets" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "amulets_deletedAt_status_createdAt_idx" ON "amulets"("deletedAt", "status", "createdAt");
