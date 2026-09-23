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
import { isPushConfigured, webpush } from '../lib/push';

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
});

notificationsRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Judul dan isi notifikasi wajib diisi' });

  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true } });
  await prisma.notification.createMany({
    data: users.map((user) => ({ ...parsed.data, userId: user.id })),
  });
  if (isPushConfigured()) {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: { in: users.map((user) => user.id) } } });
    const payload = JSON.stringify({ title: parsed.data.judul, body: parsed.data.pesan });
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
          );
        } catch (error: unknown) {
          const statusCode = (error as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: subscription.id } });
          }
        }
      }),
    );
  }
  res.status(201).json({ count: users.length });
});