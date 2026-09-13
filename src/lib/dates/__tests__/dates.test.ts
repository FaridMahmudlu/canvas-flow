import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatDateTime,
  formatShortDate,
  formatRelativeDeadline,
  formatRelativeAvailability,
  getGreeting,
  DEFAULT_TIMEZONE,
} from '../../dates';

describe('Date & Time Utilities', () => {
  const baseTime = new Date('2026-09-14T10:00:00Z');
  const hour = 60 * 60 * 1000;
  const minute = 60 * 1000;

  it('formats relative deadlines within hours', () => {
    const dueIn30Mins = new Date(baseTime.getTime() + 30 * minute);
    assert.strictEqual(formatRelativeDeadline(dueIn30Mins, baseTime), 'Due in 30 minutes');

    const dueIn2Hours = new Date(baseTime.getTime() + 2 * hour + 15 * minute);
    assert.strictEqual(formatRelativeDeadline(dueIn2Hours, baseTime), 'Due in 2h 15m');
  });

  it('formats overdue deadlines correctly', () => {
    const overdue2Hours = new Date(baseTime.getTime() - 2 * hour);
    assert.strictEqual(formatRelativeDeadline(overdue2Hours, baseTime), 'Overdue by 2h');

    const overdue3Days = new Date(baseTime.getTime() - 3 * 24 * hour);
    assert.strictEqual(formatRelativeDeadline(overdue3Days, baseTime), 'Overdue by 3 days');
  });

  it('formats relative availability when past and future', () => {
    const alreadyOpen = new Date(baseTime.getTime() - 1 * hour);
    assert.strictEqual(formatRelativeAvailability(alreadyOpen, baseTime), 'Available now');

    const opensIn2Hours = new Date(baseTime.getTime() + 2 * hour);
    assert.strictEqual(formatRelativeAvailability(opensIn2Hours, baseTime), 'Opens in 2 hours');
  });

  it('generates appropriate greetings by time of day', () => {
    const morning = new Date('2026-09-14T07:00:00Z'); // 09:00 in Budapest
    assert.strictEqual(getGreeting(morning, DEFAULT_TIMEZONE), 'Good morning');

    const afternoon = new Date('2026-09-14T12:00:00Z'); // 14:00 in Budapest
    assert.strictEqual(getGreeting(afternoon, DEFAULT_TIMEZONE), 'Good afternoon');

    const evening = new Date('2026-09-14T18:00:00Z'); // 20:00 in Budapest
    assert.strictEqual(getGreeting(evening, DEFAULT_TIMEZONE), 'Good evening');
  });
});
