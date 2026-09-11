import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole('ADMIN'));

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

const createSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'CASHIER']).default('CASHIER'),
});

usersRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Data tidak valid', errors: parsed.error.flatten() });
  }
  const { name, username, password, role } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return res.status(409).json({ message: 'Username sudah dipakai' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, username, passwordHash, role },
    select: { id: true, name: true, username: true, role: true },
  });
  res.status(201).json(user);
});

const clearDataSchema = z.object({
  target: z.enum(['PENJUALAN', 'BON', 'SEMUA']),
});

// Hapus data operasional tanpa menyentuh akun user.
usersRouter.delete('/data', async (req, res) => {
  const parsed = clearDataSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Target data tidak valid' });
  }

  const { target } = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    let penjualan = 0;
    let bon = 0;
    let pengeluaran = 0;

    if (target === 'PENJUALAN' || target === 'SEMUA') {
      const deleted = await tx.dailyClosing.deleteMany();
      penjualan = deleted.count;
    }

    if (target === 'BON' || target === 'SEMUA') {
      const deletedExpenses = await tx.expense.deleteMany({ where: { bonId: { not: null } } });
      pengeluaran = deletedExpenses.count;
      const deletedBons = await tx.bon.deleteMany();
      bon = deletedBons.count;
    }

    if (target === 'SEMUA') {
      const deletedExpenses = await tx.expense.deleteMany();
      pengeluaran += deletedExpenses.count;
    }

    return { penjualan, bon, pengeluaran };
  });

  res.json({ message: 'Data berhasil dibersihkan', ...result });
});

usersRouter.patch('/:id/active', async (req, res) => {
  const active = Boolean(req.body?.active);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { active },
    select: { id: true, active: true },
  });
  res.json(user);
});
