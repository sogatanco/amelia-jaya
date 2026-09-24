import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { notifyAdminsFromCashier } from '../utils/notifications';

export const outOfStockRouter = Router();
outOfStockRouter.use(requireAuth);

outOfStockRouter.get('/', async (_req, res) => {
  const reports = await prisma.outOfStock.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { createdBy: { select: { name: true } } },
  });
  res.json(reports);
});

const createSchema = z.object({ namaBarang: z.string().trim().min(1).max(191), catatan: z.string().trim().max(500).optional() });

outOfStockRouter.post('/', requireRole('CASHIER'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Nama barang wajib diisi' });
  const report = await prisma.outOfStock.create({ data: { ...parsed.data, createdById: req.user!.id } });
  await notifyAdminsFromCashier('Barang Kosong Diinput', `${req.user!.username} melaporkan barang kosong: ${report.namaBarang}`);
  res.status(201).json(report);
});