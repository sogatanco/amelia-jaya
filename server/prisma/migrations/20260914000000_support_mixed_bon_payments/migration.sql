-- A bill can produce multiple expense rows when it is paid from mixed sources.
ALTER TABLE `Expense` DROP FOREIGN KEY `Expense_bonId_fkey`;
ALTER TABLE `Expense` DROP INDEX `Expense_bonId_key`;
ALTER TABLE `Bon` ADD COLUMN `kategori` VARCHAR(191) NULL;
ALTER TABLE `Expense`
	ADD CONSTRAINT `Expense_bonId_fkey`
	FOREIGN KEY (`bonId`) REFERENCES `Bon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;