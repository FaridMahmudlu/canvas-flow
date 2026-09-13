import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeTaskStatus,
  computePriority,
  computePriorityScore,
  isTaskAvailable,
  isTaskOverdue,
  isTaskLocked,
} from '../availability';

describe('Availability & Priority Engine', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  it('identifies locked tasks correctly', () => {
    // Explicitly locked
    assert.strictEqual(isTaskLocked(true, null, now), true);

    // Locked because lockAt in past
    const pastLock = new Date(now.getTime() - 1 * hour);
    assert.strictEqual(isTaskLocked(false, pastLock, now), true);

    // Not locked when lockAt in future
    const futureLock = new Date(now.getTime() + 2 * day);
    assert.strictEqual(isTaskLocked(false, futureLock, now), false);
  });

  it('identifies task availability based on unlockAt', () => {
    // Available when unlock date in past
    const pastUnlock = new Date(now.getTime() - 1 * day);
    assert.strictEqual(isTaskAvailable(pastUnlock, null, false, now), true);

    // Unavailable when unlock date in future
    const futureUnlock = new Date(now.getTime() + 1 * day);
    assert.strictEqual(isTaskAvailable(futureUnlock, null, false, now), false);

    // Unavailable if locked
    assert.strictEqual(isTaskAvailable(pastUnlock, null, true, now), false);
  });

  it('identifies overdue tasks', () => {
    const pastDue = new Date(now.getTime() - 2 * hour);
    const futureDue = new Date(now.getTime() + 2 * hour);

    // Past due & not submitted -> overdue
    assert.strictEqual(isTaskOverdue(pastDue, false, now), true);

    // Past due & already submitted -> NOT overdue
    assert.strictEqual(isTaskOverdue(pastDue, true, now), false);

    // Future due -> NOT overdue
    assert.strictEqual(isTaskOverdue(futureDue, false, now), false);
  });

  it('computes correct status values across lifecycle', () => {
    // 1. Submitted
    assert.strictEqual(
      computeTaskStatus(
        {
          isSubmitted: true,
          submissionWorkflowState: 'submitted',
          dueAt: new Date(now.getTime() - 1 * hour),
        },
        now,
      ),
      'submitted',
    );

    // 2. Overdue
    assert.strictEqual(
      computeTaskStatus(
        {
          isSubmitted: false,
          dueAt: new Date(now.getTime() - 1 * hour),
        },
        now,
      ),
      'overdue',
    );

    // 3. Due Soon (< 24h)
    assert.strictEqual(
      computeTaskStatus(
        {
          isSubmitted: false,
          dueAt: new Date(now.getTime() + 4 * hour),
        },
        now,
      ),
      'due-soon',
    );

    // 4. Upcoming
    assert.strictEqual(
      computeTaskStatus(
        {
          isSubmitted: false,
          dueAt: new Date(now.getTime() + 5 * day),
        },
        now,
      ),
      'available',
    );

    // 5. Locked
    assert.strictEqual(
      computeTaskStatus(
        {
          isLocked: true,
          isSubmitted: false,
          dueAt: new Date(now.getTime() + 5 * day),
        },
        now,
      ),
      'locked',
    );
  });

  it('computes priority accurately based on proximity and points', () => {
    // Critical: < 3 hours
    assert.strictEqual(
      computePriority(
        {
          dueAt: new Date(now.getTime() + 2 * hour),
          isSubmitted: false,
          isLocked: false,
        },
        now,
      ),
      'critical',
    );

    // High: < 24 hours
    assert.strictEqual(
      computePriority(
        {
          dueAt: new Date(now.getTime() + 12 * hour),
          isSubmitted: false,
          isLocked: false,
        },
        now,
      ),
      'high',
    );

    // Low: already submitted
    assert.strictEqual(
      computePriority(
        {
          dueAt: new Date(now.getTime() + 2 * hour),
          isSubmitted: true,
          isLocked: false,
        },
        now,
      ),
      'low',
    );
  });

  it('produces higher priority scores for closer deadlines and higher points', () => {
    const imminentTaskScore = computePriorityScore(
      {
        dueAt: new Date(now.getTime() + 2 * hour),
        pointsPossible: 100,
        isSubmitted: false,
        isLocked: false,
      },
      now,
    );

    const distantTaskScore = computePriorityScore(
      {
        dueAt: new Date(now.getTime() + 7 * day),
        pointsPossible: 10,
        isSubmitted: false,
        isLocked: false,
      },
      now,
    );

    assert.ok(imminentTaskScore > distantTaskScore);
  });
});
