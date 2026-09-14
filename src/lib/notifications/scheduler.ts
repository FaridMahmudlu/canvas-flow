/**
 * Notification Scheduler & Processor
 *
 * Checks upcoming deadlines, newly unlocked tasks, and overdue tasks.
 * Dispatches browser push notifications according to user preferences and Europe/Budapest quiet hours.
 */

import { toZonedTime } from 'date-fns-tz';
import { prisma } from '@/lib/db';
import { broadcastPushNotification } from './push';
import { logger } from '../logger';

export interface SchedulerResult {
  scheduled: number;
  sent: number;
  skippedQuietHours: number;
  failed: number;
}

/**
 * Checks if current time in Europe/Budapest is within user's configured quiet hours.
 */
function isQuietHours(now: Date, startStr?: string | null, endStr?: string | null): boolean {
  if (!startStr || !endStr) return false;

  const zonedNow = toZonedTime(now, 'Europe/Budapest');
  const [startHour, startMin] = startStr.split(':').map(Number);
  const [endHour, endMin] = endStr.split(':').map(Number);

  const currentMinutes = zonedNow.getHours() * 60 + zonedNow.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (startMinutes > endMinutes) {
    // Crosses midnight (e.g. 22:00 - 08:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    // Normal window (e.g. 01:00 - 06:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

/**
 * Scan database tasks and schedule any missing notification reminders.
 */
export async function scheduleReminders(now: Date = new Date()): Promise<number> {
  let scheduledCount = 0;

  const pref = await prisma.notificationPreference.findFirst();
  const config = {
    before24h: pref?.before24h ?? true,
    before6h: pref?.before6h ?? true,
    before1h: pref?.before1h ?? true,
    overdue: pref?.overdue ?? true,
    available: pref?.taskAvailable ?? true,
  };

  // 1. Check unsubmitted tasks with due dates
  const activeTasks = await prisma.task.findMany({
    where: {
      isSubmitted: false,
      published: true,
      dueAt: { not: null },
    },
  });

  for (const task of activeTasks) {
    if (!task.dueAt) continue;
    const dueTime = task.dueAt.getTime();

    // 24 hours before
    if (config.before24h) {
      const time24h = new Date(dueTime - 24 * 60 * 60 * 1000);
      if (time24h > now) {
        try {
          await prisma.notification.create({
            data: {
              taskId: task.id,
              type: '24h',
              scheduledFor: time24h,
              state: 'pending',
              idempotencyKey: `${task.id}_24h_${dueTime}`,
            },
          });
          scheduledCount++;
        } catch {
          // Idempotent: unique constraint prevents duplicates
        }
      }
    }

    // 6 hours before
    if (config.before6h) {
      const time6h = new Date(dueTime - 6 * 60 * 60 * 1000);
      if (time6h > now) {
        try {
          await prisma.notification.create({
            data: {
              taskId: task.id,
              type: '6h',
              scheduledFor: time6h,
              state: 'pending',
              idempotencyKey: `${task.id}_6h_${dueTime}`,
            },
          });
          scheduledCount++;
        } catch {
          // Unique constraint violation — already scheduled
        }
      }
    }

    // 1 hour before
    if (config.before1h) {
      const time1h = new Date(dueTime - 60 * 60 * 1000);
      if (time1h > now) {
        try {
          await prisma.notification.create({
            data: {
              taskId: task.id,
              type: '1h',
              scheduledFor: time1h,
              state: 'pending',
              idempotencyKey: `${task.id}_1h_${dueTime}`,
            },
          });
          scheduledCount++;
        } catch {
          // Unique constraint violation — already scheduled
        }
      }
    }

    // Overdue check
    if (config.overdue && task.dueAt < now) {
      try {
        await prisma.notification.create({
          data: {
            taskId: task.id,
            type: 'overdue',
            scheduledFor: task.dueAt,
            state: 'pending',
            idempotencyKey: `${task.id}_overdue_${dueTime}`,
          },
        });
        scheduledCount++;
      } catch {
        // Unique constraint violation — already scheduled
      }
    }
  }

  // 2. Newly available tasks
  if (config.available) {
    const newlyAvailableTasks = await prisma.task.findMany({
      where: {
        published: true,
        availableAt: {
          lte: now,
        },
      },
    });

    for (const task of newlyAvailableTasks) {
      if (!task.availableAt) continue;
      try {
        await prisma.notification.create({
          data: {
            taskId: task.id,
            type: 'available',
            scheduledFor: task.availableAt,
            state: 'pending',
            idempotencyKey: `${task.id}_available_${task.availableAt.getTime()}`,
          },
        });
        scheduledCount++;
      } catch {
        // Unique constraint violation — already scheduled
      }
    }
  }

  return scheduledCount;
}

/**
 * Process due notifications and send Web Push notifications.
 * Respects quiet hours by holding pending notifications until quiet hours end.
 */
export async function processDueNotifications(now: Date = new Date()): Promise<SchedulerResult> {
  const scheduled = await scheduleReminders(now);

  const pref = await prisma.notificationPreference.findFirst();
  const inQuiet = isQuietHours(now, pref?.quietHoursStart, pref?.quietHoursEnd);

  if (inQuiet) {
    logger.info('Quiet hours active in Europe/Budapest: holding pending reminders', {
      quietHoursStart: pref?.quietHoursStart,
      quietHoursEnd: pref?.quietHoursEnd,
    });
    return {
      scheduled,
      sent: 0,
      skippedQuietHours: 1,
      failed: 0,
    };
  }

  // Find all pending notifications due by now
  const pending = await prisma.notification.findMany({
    where: {
      state: 'pending',
      scheduledFor: { lte: now },
    },
    include: {
      task: {
        include: {
          course: true,
        },
      },
    },
    take: 25,
  });

  let sent = 0;
  let failed = 0;

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://canvas-flow.vercel.app';
  const cleanAppUrl = appUrl.replace(/\/+$/, '');

  for (const notif of pending) {
    // If task was submitted in the meantime, skip deadline notifications
    if (notif.task.isSubmitted && ['24h', '6h', '1h', 'overdue'].includes(notif.type)) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: { state: 'skipped' },
      });
      continue;
    }

    let title = 'CanvasFlow Reminder';
    let body = notif.task.title;

    switch (notif.type) {
      case '24h':
        title = `Due in 24 hours: ${notif.task.course.name}`;
        body = `"${notif.task.title}" is due tomorrow.`;
        break;
      case '6h':
        title = `Due in 6 hours: ${notif.task.course.name}`;
        body = `"${notif.task.title}" is due today.`;
        break;
      case '1h':
        title = `⚠️ Due in 1 hour: ${notif.task.course.name}`;
        body = `Final reminder: "${notif.task.title}" deadline approaching!`;
        break;
      case 'overdue':
        title = `🚨 Overdue: ${notif.task.course.name}`;
        body = `"${notif.task.title}" deadline has passed.`;
        break;
      case 'available':
        title = `Task Now Available: ${notif.task.course.name}`;
        body = `"${notif.task.title}" has opened and is ready to work on.`;
        break;
      case 'new_task':
        title = `New Task Added: ${notif.task.course.name}`;
        body = `New ${notif.task.sourceType}: "${notif.task.title}".`;
        break;
      case 'changed':
        title = `Deadline Changed: ${notif.task.course.name}`;
        body = `Deadline updated for "${notif.task.title}".`;
        break;
      case 'graded':
        title = `Score Updated: ${notif.task.course.name}`;
        body = `"${notif.task.title}" graded: ${notif.task.grade || notif.task.score || 'Reviewed'}.`;
        break;
    }

    // Direct deep-link to the task page
    const taskDeepLink = `${cleanAppUrl}/tasks/${notif.taskId}`;

    const pushResult = await broadcastPushNotification({
      title,
      body,
      tag: `task-${notif.taskId}-${notif.type}`,
      data: {
        taskId: notif.taskId,
        url: taskDeepLink,
        courseName: notif.task.course.name,
      },
    });

    if (pushResult.sent > 0 || pushResult.failed === 0) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: {
          state: 'sent',
          sentAt: new Date(),
        },
      });
      sent++;
    } else {
      await prisma.notification.update({
        where: { id: notif.id },
        data: {
          state: 'failed',
          errorMessage: 'No push subscribers or delivery failed',
        },
      });
      failed++;
    }
  }

  logger.info('Notification scheduler completed processing', {
    scheduled,
    sent,
    failed,
  });

  return {
    scheduled,
    sent,
    skippedQuietHours: 0,
    failed,
  };
}
