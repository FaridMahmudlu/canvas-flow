import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractSemester, formatSemesterLabel, sortSemesters } from '../semester';

describe('Semester Utilities', () => {
  test('extracts semester correctly from ELTE course codes', () => {
    assert.equal(
      extractSemester('2026/27/1 IP-18fAN2E 1 - Analízis II. Ea', 'Analysis II'),
      '2026/27/1',
    );
    assert.equal(
      extractSemester('2025/26/2 H78H07-DM1EngPr2026ASpring - Diszkrét matematika I. Gy', 'Discrete Mathematics'),
      '2025/26/2',
    );
  });

  test('extracts semester from course name when code has none', () => {
    assert.equal(
      extractSemester(null, '2026/27/1 IP-18fKVPYEG 5 - Python'),
      '2026/27/1',
    );
  });

  test('formats semester labels cleanly in English', () => {
    assert.equal(formatSemesterLabel('2026/27/1'), '2026/27 Autumn');
    assert.equal(formatSemesterLabel('2025/26/2'), '2025/26 Spring');
    assert.equal(formatSemesterLabel('all'), 'All Semesters');
  });

  test('sorts semesters chronologically with latest first', () => {
    const sorted = sortSemesters(['2025/26/2', '2026/27/1', '2024/25/1']);
    assert.deepEqual(sorted, ['2026/27/1', '2025/26/2', '2024/25/1']);
  });
});
