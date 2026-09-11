import { PrismaClient } from '@prisma/client';

// Singleton Prisma client agar tidak membuat banyak koneksi saat hot-reload dev.
export const prisma = new PrismaClient();
