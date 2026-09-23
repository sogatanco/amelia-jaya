import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { categoryKey, normalizeCategoryLabel } from '../utils/category';

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

expensesRouter.get('/categories', async (_req, res) => {
  const expenses = await prisma.expense.findMany({
    select: { kategori: true },
    orderBy: { createdAt: 'desc' },
  });
  const categories = new Map<string, string>();
  for (const expense of expenses) {
    const label = normalizeCategoryLabel(expense.kategori);
    const key = categoryKey(expense.kategori);
    if (label && !categories.has(key)) categories.set(key, label);
  }
  res.json([...categories.values()]);
});

const createSchema = z
  .object({
    tanggal: z.string().min(1),
    kategori: z.string().min(1),
    jumlah: z.number().positive(),
    keterangan: z.string().optional(),
    sumberDana: z.enum(['LACI', 'CASHFLOW', 'BANK', 'CAMPUR']).default('LACI'),
    dariLaci: z.number().nonnegative().optional(),
    dariCashflow: z.number().nonnegative().optional(),
    dariBank: z.number().nonnegative().optional(),
  })
  .refine((d) => d.sumberDana !== 'CAMPUR' || ((d.dariLaci ?? 0) + (d.dariCashflow ?? 0) + (d.dariBank ?? 0)) === d.jumlah, {
    message: 'Untuk sumber campuran, total rincian (laci + cashflow + bank) harus sama dengan jumlah pengeluaran',
  });

expensesRouter.get('/', async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const where: Record<string, unknown> = {};
  if (from || to) {
    where.tanggal = {
      ...(from ? { gte: dayjs(from).startOf('day').toDate() } : {}),
      ...(to ? { lte: dayjs(to).endOf('day').toDate() } : {}),
    };
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { tanggal: 'desc' },
    include: { createdBy: { select: { name: true } }, bon: true },
  });
  res.json(expenses);
});

expensesRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Data tidak valid', errors: parsed.error.flatten() });
  }
  const { tanggal, jumlah, keterangan, sumberDana, dariLaci, dariCashflow, dariBank } = parsed.data;
  const kategoriNormalized = normalizeCategoryLabel(parsed.data.kategori);

  const rincian =
    sumberDana === 'CAMPUR'
      ? { dariLaci: dariLaci ?? 0, dariCashflow: dariCashflow ?? 0, dariBank: dariBank ?? 0 }
      : sumberDana === 'LACI'
        ? { dariLaci: jumlah, dariCashflow: 0, dariBank: 0 }
        : sumberDana === 'CASHFLOW'
          ? { dariLaci: 0, dariCashflow: jumlah, dariBank: 0 }
          : { dariLaci: 0, dariCashflow: 0, dariBank: jumlah };

  const expense = await prisma.expense.create({
    data: {
      tanggal: dayjs(tanggal).startOf('day').toDate(),
      kategori: kategoriNormalized,
      jumlah,
      keterangan,
      sumberDana,
      ...rincian,
      createdById: req.user!.id,
    },
  });

  res.status(201).json(expense);
});

expensesRouter.delete('/:id', async (req, res) => {
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
