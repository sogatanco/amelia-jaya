-- Migrasi awal MySQL - Pembukuan Toko Kelontong Amelia Jaya
-- Struktur lengkap termasuk kolom pembayaran tagihan & sumber dana.

CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'CASHIER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DailyClosing` (
    `id` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `omset` DOUBLE NOT NULL,
    `catatan` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Expense` (
    `id` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `kategori` VARCHAR(191) NOT NULL,
    `jumlah` DOUBLE NOT NULL,
    `keterangan` VARCHAR(191) NULL,
    `sumber` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `sumberDana` VARCHAR(191) NOT NULL DEFAULT 'LACI',
    `dariLaci` DOUBLE NOT NULL DEFAULT 0,
    `dariCashflow` DOUBLE NOT NULL DEFAULT 0,
    `dariBank` DOUBLE NOT NULL DEFAULT 0,
    `bonId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Bon` (
    `id` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `tipe` VARCHAR(191) NOT NULL,
    `jumlah` DOUBLE NULL,
    `supplier` VARCHAR(191) NULL,
    `imagePath` VARCHAR(191) NOT NULL,
    `ocrText` TEXT NULL,
    `ocrConfidence` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DIPROSES',
    `jatuhTempo` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `caraBayar` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);
CREATE UNIQUE INDEX `DailyClosing_tanggal_key` ON `DailyClosing`(`tanggal`);
CREATE UNIQUE INDEX `Expense_bonId_key` ON `Expense`(`bonId`);
CREATE INDEX `Expense_tanggal_idx` ON `Expense`(`tanggal`);
CREATE INDEX `Bon_tipe_status_idx` ON `Bon`(`tipe`, `status`);

ALTER TABLE `DailyClosing` ADD CONSTRAINT `DailyClosing_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_bonId_fkey` FOREIGN KEY (`bonId`) REFERENCES `Bon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Bon` ADD CONSTRAINT `Bon_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
