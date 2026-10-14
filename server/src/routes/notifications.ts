import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { isFcmConfigured } from '../lib/fcm';
import { isPushConfigured } from '../lib/push';
import { requireAuth, requireRole } from '../middleware/auth';
import { sendNotifications } from '../utils/notifications';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(notifications.map((notification) => ({ ...notification, tujuan: notification.tujuan || '/laporan' })));
});

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

const fcmTokenSchema = z.object({
  token: z.string().trim().min(1).max(512),
});

const fcmStatusSchema = z.object({
  token: z.string().trim().min(1).max(512).optional(),
});

notificationsRouter.post('/fcm-status', async (req, res) => {
  const parsed = fcmStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Token FCM tidak valid' });

  const [deviceCount, currentToken] = await Promise.all([
    prisma.fcmToken.count({ where: { userId: req.user!.id } }),
    parsed.data.token
      ? prisma.fcmToken.findUnique({
          where: { token: parsed.data.token },
          select: { userId: true },
        })
      : Promise.resolve(null),
  ]);

  res.json({
    serverConfigured: isFcmConfigured(),
    registeredDevices: deviceCount,
    thisDeviceRegistered: Boolean(
      currentToken && currentToken.userId === req.user!.id,
    ),
  });
});

notificationsRouter.post('/fcm-token', async (req, res) => {
  const parsed = fcmTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Token FCM tidak valid' });

  await prisma.fcmToken.upsert({
    where: { token: parsed.data.token },
    update: { userId: req.user!.id },
    create: { token: parsed.data.token, userId: req.user!.id },
  });
  res.status(201).json({ ok: true });
});

notificationsRouter.delete('/fcm-token', async (req, res) => {
  const parsed = fcmTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Token FCM tidak valid' });

  await prisma.fcmToken.deleteMany({
    where: { token: parsed.data.token, userId: req.user!.id },
  });
  res.status(204).end();
});

notificationsRouter.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const deleted = await prisma.notification.deleteMany({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!deleted.count) return res.status(404).json({ message: 'Notifikasi tidak ditemukan' });
  res.status(204).end();
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