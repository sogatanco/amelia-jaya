import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { notifyAdminsFromCashier } from '../utils/notifications';

export const closingsRouter = Router();
closingsRouter.use(requireAuth);

function serializeClosing<T extends { tanggal: Date }>(closing: T) {
  return { ...closing, tanggal: dayjs(closing.tanggal).format('YYYY-MM-DD') };
}

const upsertSchema = z.object({
  tanggal: z.string().min(1), // format YYYY-MM-DD, dipilih dari list tanggal di form
  omset: z.number().nonnegative(),
  sumber: z.enum(['KASIR', 'QRIS']).default('KASIR'),
  catatan: z.string().optional(),
});

// Daftar tanggal 60 hari terakhir untuk dropdown form, ditandai mana yang
// sudah diinput dan mana yang belum (karena closing bisa telat diinput).
closingsRouter.get('/dates', async (req, res) => {
  const days = Number(req.query.days ?? 60);
  const start = dayjs().subtract(days, 'day').startOf('day');

  const existing = await prisma.dailyClosing.findMany({
    where: { tanggal: { gte: start.toDate() } },
    select: { tanggal: true, omset: true },
  });
  const existingMap = new Map<string, number>();
  for (const item of existing) {
    const key = dayjs(item.tanggal).format('YYYY-MM-DD');
    existingMap.set(key, (existingMap.get(key) ?? 0) + item.omset);
  }

  const dates = [];
  for (let i = 0; i <= days; i++) {
    const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
    dates.push({ tanggal: d, sudahDiinput: existingMap.has(d), omset: existingMap.get(d) ?? null });
  }

  res.json(dates);
});

closingsRouter.get('/', async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const where: Record<string, unknown> = {};
  if (from || to) {
    where.tanggal = {
      ...(from ? { gte: dayjs(from).startOf('day').toDate() } : {}),
      ...(to ? { lte: dayjs(to).endOf('day').toDate() } : {}),
    };
  }

  const closings = await prisma.dailyClosing.findMany({
    where,
    orderBy: { tanggal: 'desc' },
    include: { createdBy: { select: { name: true } } },
  });
  res.json(closings.map(serializeClosing));
});

// Buat/perbarui omset harian untuk tanggal tertentu (upsert by tanggal).
closingsRouter.post('/', async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Data tidak valid', errors: parsed.error.flatten() });
  }
  const { tanggal, omset, sumber, catatan } = parsed.data;
  const tanggalDate = dayjs(tanggal).startOf('day').toDate();

  const closing = await prisma.dailyClosing.upsert({
    where: { tanggal_sumber: { tanggal: tanggalDate, sumber } },
    update: { omset, catatan },
    create: { tanggal: tanggalDate, omset, sumber, catatan, createdById: req.user!.id },
  });

  if (req.user!.role === 'CASHIER') {
    await notifyAdminsFromCashier('Omset Diinput Kasir', `Omset ${sumber} tanggal ${tanggal} sebesar Rp${omset.toLocaleString('id-ID')}.`);
  }

  res.json(serializeClosing(closing));
});
