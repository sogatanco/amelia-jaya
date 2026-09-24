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
    include: { createdBy: { select: { name: true } }, dibeliOleh: { select: { name: true } } },
  });
  res.json(reports);
});

const createSchema = z.object({ namaBarang: z.string().trim().min(1).max(5000), catatan: z.string().trim().max(500).optional() });

outOfStockRouter.post('/', requireRole('CASHIER'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Nama barang wajib diisi' });
  const names = parsed.data.namaBarang.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  if (!names.length) return res.status(400).json({ message: 'Isi minimal satu nama barang' });
  const reports = await prisma.$transaction(
    names.map((namaBarang) => prisma.outOfStock.create({ data: { namaBarang, catatan: parsed.data.catatan, createdById: req.user!.id } })),
  );
  await notifyAdminsFromCashier('Barang Kosong Diinput', `${req.user!.username} melaporkan ${reports.length} barang kosong.`, '/barang-kosong-admin');
  res.status(201).json(reports);
});

outOfStockRouter.patch('/:id/purchased', requireRole('ADMIN'), async (req, res) => {
  const report = await prisma.outOfStock.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ message: 'Laporan barang kosong tidak ditemukan' });
  const updated = await prisma.outOfStock.update({
    where: { id: report.id },
    data: report.dibeliAt ? { dibeliAt: null, dibeliOlehId: null } : { dibeliAt: new Date(), dibeliOlehId: req.user!.id },
    include: { createdBy: { select: { name: true } }, dibeliOleh: { select: { name: true } } },
  });
  res.json(updated);
});