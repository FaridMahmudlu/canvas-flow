import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  CanvasApiError,
  CanvasAuthError,
  CanvasForbiddenError,
  CanvasNotFoundError,
  CanvasRateLimitError,
} from '../client';
import { mockUser, mockCourses, mockAssignments } from '../mock';

describe('Canvas Client & Errors', () => {
  it('instantiates specific Canvas error classes with proper status codes', () => {
    const authErr = new CanvasAuthError('Invalid token');
    assert.strictEqual(authErr.status, 401);
    assert.strictEqual(authErr.name, 'CanvasAuthError');

    const forbiddenErr = new CanvasForbiddenError();
    assert.strictEqual(forbiddenErr.status, 403);
    assert.strictEqual(forbiddenErr.name, 'CanvasForbiddenError');

    const notFoundErr = new CanvasNotFoundError();
    assert.strictEqual(notFoundErr.status, 404);
    assert.strictEqual(notFoundErr.name, 'CanvasNotFoundError');

    const rateLimitErr = new CanvasRateLimitError(5000);
    assert.strictEqual(rateLimitErr.status, 429);
    assert.strictEqual(rateLimitErr.retryAfterMs, 5000);
  });

  it('verifies mock dataset contains realistic ELTE structures', () => {
    assert.strictEqual(typeof mockUser.id, 'number');
    assert.strictEqual(mockUser.time_zone, 'Europe/Budapest');

    assert.ok(mockCourses.length > 0);
    const course = mockCourses[0];
    assert.strictEqual(typeof course.id, 'number');
    assert.ok(course.name.length > 0);

    const assignments = mockAssignments[course.id];
    assert.ok(Array.isArray(assignments));
    assert.ok(assignments.length > 0);
    const firstAssignment = assignments[0];
    assert.ok(firstAssignment.html_url?.includes('canvas.elte.hu'));
  });
});
