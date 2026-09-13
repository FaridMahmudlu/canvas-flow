import { describe, it } from 'node:test';
import assert from 'node:assert';
import { transformAssignment, transformQuiz, transformCalendarEvent } from '../transformer';
import type { CanvasAssignment, CanvasQuiz, CanvasCalendarEvent } from '../../canvas/types';

describe('Task Transformer', () => {
  const course = {
    id: 'course-101',
    canvasCourseId: 101,
    name: 'Programming 101',
    code: 'PROG101',
  };

  const now = new Date('2026-09-14T12:00:00Z');

  it('transforms CanvasAssignment into AcademicTask correctly', () => {
    const rawAssignment: CanvasAssignment = {
      id: 555,
      name: 'Homework 1: Recursion',
      description: '<p>Solve exercises</p>',
      course_id: 101,
      due_at: '2026-09-15T18:00:00Z',
      unlock_at: '2026-09-10T00:00:00Z',
      lock_at: '2026-09-20T00:00:00Z',
      points_possible: 100,
      submission_types: ['online_upload'],
      published: true,
      locked_for_user: false,
      has_submitted_submissions: false,
      html_url: 'https://canvas.elte.hu/courses/101/assignments/555',
    };

    const task = transformAssignment(rawAssignment, course, now);

    assert.strictEqual(task.source, 'canvas');
    assert.strictEqual(task.sourceType, 'assignment');
    assert.strictEqual(task.canvasId, 'assignment_555');
    assert.strictEqual(task.courseName, 'Programming 101');
    assert.strictEqual(task.courseCode, 'PROG101');
    assert.strictEqual(task.title, 'Homework 1: Recursion');
    assert.strictEqual(task.pointsPossible, 100);
    assert.strictEqual(task.isSubmitted, false);
    assert.strictEqual(task.isLocked, false);
    assert.strictEqual(task.status, 'due-soon');
  });

  it('transforms CanvasQuiz with time limits and attempts', () => {
    const rawQuiz: CanvasQuiz = {
      id: 777,
      title: 'Midterm Quiz',
      description: 'Multiple choice quiz',
      quiz_type: 'assignment',
      time_limit: 45,
      allowed_attempts: 2,
      points_possible: 50,
      due_at: '2026-09-14T14:00:00Z', // in 2 hours -> critical
      unlock_at: '2026-09-12T00:00:00Z',
      lock_at: '2026-09-14T16:00:00Z',
      published: true,
      locked_for_user: false,
      html_url: 'https://canvas.elte.hu/courses/101/quizzes/777',
    };

    const task = transformQuiz(rawQuiz, course, now);

    assert.strictEqual(task.sourceType, 'quiz');
    assert.strictEqual(task.canvasId, 'quiz_777');
    assert.strictEqual(task.quizDetails?.timeLimit, 45);
    assert.strictEqual(task.quizDetails?.allowedAttempts, 2);
    assert.strictEqual(task.priority, 'critical');
  });

  it('transforms CanvasCalendarEvent into AcademicTask', () => {
    const rawEvent: CanvasCalendarEvent = {
      id: 999,
      title: 'Lab Session',
      start_at: '2026-09-15T10:00:00Z',
      end_at: '2026-09-15T12:00:00Z',
      type: 'event',
      html_url: 'https://canvas.elte.hu/calendar',
    };

    const task = transformCalendarEvent(rawEvent, course, now);

    assert.strictEqual(task.sourceType, 'event');
    assert.strictEqual(task.canvasId, 'event_999');
    assert.strictEqual(task.isLocked, false);
    assert.strictEqual(task.status, 'available');
  });
});
