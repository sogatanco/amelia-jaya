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
import { isPushConfigured } from '../lib/push';
import { sendNotifications } from '../utils/notifications';

notificationsRouter.patch('/:id/read', async (req, res) => {
  const notification = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { dibacaAt: new Date() },
  });
  if (!notification.count) return res.status(404).json({ message: 'Notifikasi tidak ditemukan' });
  res.json({ ok: true });
});

notificationsRouter.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

notificationsRouter.post('/subscribe', async (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Subscription notifikasi tidak valid' });
  const { endpoint, keys } = parsed.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: req.user!.id },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: req.user!.id },
  });
  res.status(201).json({ ok: true, configured: isPushConfigured() });
});

const createSchema = z.object({
  judul: z.string().trim().min(1).max(120),
  pesan: z.string().trim().min(1).max(2000),
  tujuan: z.string().trim().min(1).max(191),
  penerima: z.enum(['SEMUA', 'ADMIN', 'CASHIER', 'USER']),
  userId: z.string().optional(),
});

notificationsRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Judul dan isi notifikasi wajib diisi' });

  if (parsed.data.penerima === 'USER' && !parsed.data.userId) return res.status(400).json({ message: 'Pilih user penerima' });
  const users = await prisma.user.findMany({
    where: { active: true, ...(parsed.data.penerima === 'SEMUA' ? {} : parsed.data.penerima === 'USER' ? { id: parsed.data.userId } : { role: parsed.data.penerima }) },
    select: { id: true },
  });
  await sendNotifications(users.map((user) => user.id), { judul: parsed.data.judul, pesan: parsed.data.pesan, tujuan: parsed.data.tujuan });
  res.status(201).json({ count: users.length });
});