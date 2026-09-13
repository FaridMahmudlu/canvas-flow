/**
 * Central date/time utility.
 *
 * All user-facing dates go through this module.
 * Default timezone: Europe/Budapest.
 * Uses date-fns + date-fns-tz for robust timezone handling.
 */

import {
  format,
  formatDistanceToNow,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  isToday,
  isTomorrow,
  isYesterday,
  isThisWeek,
  isPast,
  addDays,
} from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

export const DEFAULT_TIMEZONE = 'Europe/Budapest';

// ─── Core Formatting ───────────────────────────────────────────────────

/**
 * Format a date for display in the user's timezone.
 * Examples:
 *   "Today, 18:30"
 *   "Tomorrow, 09:00"
 *   "Yesterday, 14:15"
 *   "Mon, Sep 14, 10:00"
 */
export function formatDateTime(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = ensureDate(date);
  const zoned = toZonedTime(d, timezone);

  if (isToday(zoned)) {
    return `Today, ${formatInTimeZone(d, timezone, 'HH:mm')}`;
  }
  if (isTomorrow(zoned)) {
    return `Tomorrow, ${formatInTimeZone(d, timezone, 'HH:mm')}`;
  }
  if (isYesterday(zoned)) {
    return `Yesterday, ${formatInTimeZone(d, timezone, 'HH:mm')}`;
  }
  if (isThisWeek(zoned)) {
    return formatInTimeZone(d, timezone, 'EEE, HH:mm');
  }

  return formatInTimeZone(d, timezone, 'EEE, MMM d, HH:mm');
}

/**
 * Format a short date (no time).
 * Examples:
 *   "Today"
 *   "Tomorrow"
 *   "Mon, Sep 14"
 */
export function formatShortDate(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = ensureDate(date);
  const zoned = toZonedTime(d, timezone);

  if (isToday(zoned)) return 'Today';
  if (isTomorrow(zoned)) return 'Tomorrow';
  if (isYesterday(zoned)) return 'Yesterday';

  return formatInTimeZone(d, timezone, 'EEE, MMM d');
}

/**
 * Format a relative deadline.
 * Examples:
 *   "Due in 42 minutes"
 *   "Due in 4h 22m"
 *   "Due today at 23:59"
 *   "Due tomorrow at 09:00"
 *   "Due Mon, Sep 14"
 *   "Overdue by 2 days"
 */
export function formatRelativeDeadline(
  dueAt: Date | string,
  now: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const due = ensureDate(dueAt);
  const diffMs = due.getTime() - now.getTime();

  // Overdue
  if (diffMs < 0) {
    const absDiffMs = Math.abs(diffMs);
    const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `Overdue by ${days} day${days !== 1 ? 's' : ''}`;
    if (hours > 0) return `Overdue by ${hours}h`;
    const mins = Math.floor(absDiffMs / (1000 * 60));
    return `Overdue by ${mins}m`;
  }

  const diffMins = differenceInMinutes(due, now);
  const diffHours = differenceInHours(due, now);
  const diffDays = differenceInDays(due, now);

  // Under 1 hour
  if (diffMins < 60) {
    return `Due in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  }

  // Under 6 hours — show hours and minutes
  if (diffHours < 6) {
    const remainingMins = diffMins % 60;
    if (remainingMins === 0) return `Due in ${diffHours}h`;
    return `Due in ${diffHours}h ${remainingMins}m`;
  }

  // Today
  const zoned = toZonedTime(due, timezone);
  if (isToday(zoned)) {
    return `Due today at ${formatInTimeZone(due, timezone, 'HH:mm')}`;
  }

  // Tomorrow
  if (isTomorrow(zoned)) {
    return `Due tomorrow at ${formatInTimeZone(due, timezone, 'HH:mm')}`;
  }

  // This week
  if (diffDays <= 6) {
    return `Due ${formatInTimeZone(due, timezone, 'EEEE')} at ${formatInTimeZone(due, timezone, 'HH:mm')}`;
  }

  // Further out
  return `Due ${formatInTimeZone(due, timezone, 'MMM d')}`;
}

/**
 * Format relative availability.
 * Examples:
 *   "Available now"
 *   "Opens in 3 hours"
 *   "Opens tomorrow at 10:00"
 *   "Opens Mon, Sep 14 at 10:00"
 */
export function formatRelativeAvailability(
  availableAt: Date | string,
  now: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const available = ensureDate(availableAt);
  const diffMs = available.getTime() - now.getTime();

  // Already available
  if (diffMs <= 0) return 'Available now';

  const diffMins = differenceInMinutes(available, now);
  const diffHours = differenceInHours(available, now);

  // Under 1 hour
  if (diffMins < 60) {
    return `Opens in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  }

  // Under 6 hours
  if (diffHours < 6) {
    return `Opens in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  }

  const zoned = toZonedTime(available, timezone);

  if (isToday(zoned)) {
    return `Opens today at ${formatInTimeZone(available, timezone, 'HH:mm')}`;
  }
  if (isTomorrow(zoned)) {
    return `Opens tomorrow at ${formatInTimeZone(available, timezone, 'HH:mm')}`;
  }

  return `Opens ${formatInTimeZone(available, timezone, 'EEE, MMM d')} at ${formatInTimeZone(available, timezone, 'HH:mm')}`;
}

/**
 * Format a submitted-at date.
 * Example: "Submitted Sep 13, 2026 at 18:42"
 */
export function formatSubmittedAt(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = ensureDate(date);
  return `Submitted ${formatInTimeZone(d, timezone, 'MMM d, yyyy')} at ${formatInTimeZone(d, timezone, 'HH:mm')}`;
}

/**
 * Format "Last synced X ago".
 */
export function formatSyncAge(date: Date | string): string {
  const d = ensureDate(date);
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Get a time-of-day greeting.
 */
export function getGreeting(now: Date = new Date(), timezone: string = DEFAULT_TIMEZONE): string {
  const zoned = toZonedTime(now, timezone);
  const hour = zoned.getHours();

  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Calendar Helpers ──────────────────────────────────────────────────

/**
 * Get the start and end of a week for calendar queries.
 */
export function getWeekRange(date: Date = new Date()): { start: string; end: string } {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const start = new Date(date);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);

  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────

function ensureDate(date: Date | string): Date {
  if (date instanceof Date) return date;
  return new Date(date);
}
