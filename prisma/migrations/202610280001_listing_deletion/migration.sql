ALTER TABLE `amulets` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `amulets_deletedAt_status_createdAt_idx` ON `amulets`(`deletedAt`, `status`, `createdAt`);
