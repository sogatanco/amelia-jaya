import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(notifications);
});

notificationsRouter.patch('/:id/read', async (req, res) => {
  const notification = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { dibacaAt: new Date() },
  });
  if (!notification.count) return res.status(404).json({ message: 'Notifikasi tidak ditemukan' });
  res.json({ ok: true });
});

const createSchema = z.object({
  judul: z.string().trim().min(1).max(120),
  pesan: z.string().trim().min(1).max(2000),
});

notificationsRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Judul dan isi notifikasi wajib diisi' });

  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true } });
  await prisma.notification.createMany({
    data: users.map((user) => ({ ...parsed.data, userId: user.id })),
  });
  res.status(201).json({ count: users.length });
});