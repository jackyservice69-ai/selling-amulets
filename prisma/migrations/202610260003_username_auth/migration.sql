-- DropForeignKey
ALTER TABLE `email_verifications` DROP FOREIGN KEY `email_verifications_userId_fkey`;

-- DropForeignKey
ALTER TABLE `password_resets` DROP FOREIGN KEY `password_resets_userId_fkey`;

-- DropIndex
DROP INDEX `users_email_key` ON `users`;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `email`,
    DROP COLUMN `emailVerifiedAt`;

-- DropTable
DROP TABLE `email_verifications`;

-- DropTable
DROP TABLE `password_resets`;

-- All referrals now count at registration; verification no longer exists.
UPDATE `site_settings` SET `value` = JSON_SET(`value`, '$.referralCountAt', 'REGISTRATION');
