-- Keep existing listings available for sale; new listings may be for display.
ALTER TABLE `amulets` ADD COLUMN `listingType` ENUM('SALE', 'SHOW') NOT NULL DEFAULT 'SALE';
