import { prisma } from '../lib/prisma';
import { isPushConfigured, webpush } from '../lib/push';

interface NotificationPayload {
  judul: string;
  pesan: string;
  tujuan: string;
}

export async function sendNotifications(userIds: string[], payload: NotificationPayload) {
  if (!userIds.length) return;
  await prisma.notification.createMany({ data: userIds.map((userId) => ({ ...payload, userId })) });
  if (!isPushConfigured()) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const pushPayload = JSON.stringify({ title: payload.judul, body: payload.pesan, url: payload.tujuan });
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        pushPayload,
      );
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) await prisma.pushSubscription.delete({ where: { id: subscription.id } });
    }
  }));
}

export async function notifyAdminsFromCashier(judul: string, pesan: string) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
  await sendNotifications(admins.map((admin) => admin.id), { judul, pesan, tujuan: '/laporan' });
}

export async function remindCashiersToCheckOutOfStock() {
  const cashiers = await prisma.user.findMany({ where: { role: 'CASHIER', active: true }, select: { id: true } });
  if (!cashiers.length) return;
  const last = await prisma.notification.findFirst({
    where: { judul: 'Cek Barang Kosong', tujuan: '/barang-kosong' },
    orderBy: { createdAt: 'desc' },
  });
  if (last && Date.now() - last.createdAt.getTime() < 3 * 60 * 60 * 1000) return;
  await sendNotifications(cashiers.map((cashier) => cashier.id), {
    judul: 'Cek Barang Kosong',
    pesan: 'Silakan cek dan input barang yang sedang kosong di toko.',
    tujuan: '/barang-kosong',
  });
}