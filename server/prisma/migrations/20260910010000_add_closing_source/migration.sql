-- Izinkan satu tanggal memiliki omset dari kasir dan QRIS.
ALTER TABLE `DailyClosing` DROP INDEX `DailyClosing_tanggal_key`;
ALTER TABLE `DailyClosing` ADD COLUMN `sumber` VARCHAR(191) NOT NULL DEFAULT 'KASIR';
CREATE UNIQUE INDEX `DailyClosing_tanggal_sumber_key` ON `DailyClosing`(`tanggal`, `sumber`);