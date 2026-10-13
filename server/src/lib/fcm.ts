import { readFileSync } from 'node:fs';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from './prisma';

function getFcmMessaging() {
  if (getApps().length) return getMessaging();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_ADMIN_CREDENTIALS;
  const useApplicationDefault =
    process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === 'true';

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
  } else if (serviceAccountPath) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
  } else if (useApplicationDefault) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  } else {
    return null;
  }

  return getMessaging();
}

interface FcmDelivery {
  token: string;
  title: string;
  body: string;
  notificationId: string;
  destination: string;
}

export async function sendFcmNotifications(deliveries: FcmDelivery[]) {
  if (!deliveries.length) return;

  let messaging: ReturnType<typeof getMessaging> | null;
  try {
    messaging = getFcmMessaging();
  } catch (error) {
    console.error('FCM credentials are invalid; push notifications were not sent.', error);
    return;
  }

  if (!messaging) {
    console.error(
      'FCM is not configured. Set FIREBASE_ADMIN_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS=true on the server.',
    );
    return;
  }

  for (let start = 0; start < deliveries.length; start += 500) {
    const batch = deliveries.slice(start, start + 500);
    try {
      const response = await messaging.sendEach(
        batch.map((delivery) => ({
          token: delivery.token,
          notification: { title: delivery.title, body: delivery.body },
          data: {
            id: delivery.notificationId,
            tujuan: delivery.destination,
          },
          android: { priority: 'high' as const },
        })),
      );

      const invalidTokens: string[] = [];
      response.responses.forEach((result, index) => {
        if (result.success) return;
        const code = result.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(batch[index].token);
        } else {
          console.error('FCM notification delivery failed.', result.error);
        }
      });

      if (invalidTokens.length) {
        await prisma.fcmToken.deleteMany({ where: { token: { in: invalidTokens } } });
      }
    } catch (error) {
      console.error('FCM notification batch failed.', error);
    }
  }
}
