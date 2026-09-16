import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

function safeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

describe('Cron Authentication Constant-Time Comparison', () => {
  it('correctly validates matching strings', () => {
    assert.equal(safeCompare('Bearer secret123', 'Bearer secret123'), true);
    assert.equal(safeCompare('', ''), true);
    assert.equal(safeCompare('a'.repeat(64), 'a'.repeat(64)), true);
  });

  it('rejects mismatching strings of the same length', () => {
    assert.equal(safeCompare('Bearer secret123', 'Bearer secret124'), false);
  });

  it('rejects mismatching strings of different lengths without throwing', () => {
    assert.equal(safeCompare('Bearer short', 'Bearer verylongsecretstring123'), false);
    assert.equal(safeCompare('', 'Bearer secret'), false);
    assert.equal(safeCompare('Bearer secret', ''), false);
  });
});
