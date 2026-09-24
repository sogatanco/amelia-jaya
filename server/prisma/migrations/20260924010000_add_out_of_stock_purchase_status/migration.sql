ALTER TABLE `OutOfStock` ADD COLUMN `dibeliAt` DATETIME(3) NULL,
    ADD COLUMN `dibeliOlehId` VARCHAR(191) NULL;

ALTER TABLE `OutOfStock`
    ADD CONSTRAINT `OutOfStock_dibeliOlehId_fkey` FOREIGN KEY (`dibeliOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `OutOfStock_dibeliOlehId_idx` ON `OutOfStock`(`dibeliOlehId`);