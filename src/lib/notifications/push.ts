/**
 * Web Push Notification Delivery
 *
 * Sends push notifications to subscribed browsers via Web Push protocol.
 */

import webpush from 'web-push';
import { prisma } from '@/lib/db';

// Initialize VAPID details if keys are present
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:student@canvas-flow.elte';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.warn('Failed to configure VAPID details:', err);
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    taskId?: string;
    courseName?: string;
    [key: string]: unknown;
  };
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

/**
 * Send a push notification to a specific subscription.
 */
export async function sendPushNotification(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: PushNotificationPayload,
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return {
      success: false,
      error: 'VAPID keys not configured. Generate keys and set in .env.local',
    };
  }

  const pushSubscription: webpush.PushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    const res = await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
    );

    return { success: true, statusCode: res.statusCode };
  } catch (error: unknown) {
    const webPushError = error as { statusCode?: number; message?: string };
    // If subscription is expired or gone (410 or 404), clean it up
    if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: subscription.endpoint },
      });
    }

    return {
      success: false,
      error: webPushError.message || 'Push delivery failed',
      statusCode: webPushError.statusCode,
    };
  }
}

/**
 * Broadcast push notification to all stored browser subscriptions.
 */
export async function broadcastPushNotification(
  payload: PushNotificationPayload,
): Promise<{ sent: number; failed: number }> {
  const subscriptions = await prisma.pushSubscription.findMany();

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const result = await sendPushNotification(sub, payload);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}
