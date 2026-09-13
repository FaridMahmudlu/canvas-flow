/**
 * Semester Utilities for ELTE Academic Terms
 *
 * ELTE Canvas course codes typically follow the format:
 * - "2026/27/1" (2026/2027 Autumn/Fall Semester)
 * - "2025/26/2" (2025/2026 Spring Semester)
 */

export interface SemesterOption {
  id: string; // e.g., "2026/27/1" or "all"
  label: string; // e.g., "2026/27 Autumn" or "All Semesters"
  courseCount?: number;
  taskCount?: number;
  isCurrent?: boolean;
}

/**
 * Extracts semester string (e.g. "2026/27/1") from course code or course name.
 */
export function extractSemester(code?: string | null, name?: string | null): string | null {
  const combined = `${code || ''} ${name || ''}`;

  // Match pattern like "2026/27/1" or "2025/26/2"
  const match = combined.match(/\b(\d{4}\/\d{2}\/[12])\b/) || combined.match(/\b(\d{4}\/\d{4}\/[12])\b/);
  if (match) {
    return match[1];
  }

  // Fallback for codes containing "2026Autumn" or "2026Spring"
  const yearTermMatch = combined.match(/\b(20\d{2})(Autumn|Spring|Fall)\b/i);
  if (yearTermMatch) {
    const year = parseInt(yearTermMatch[1], 10);
    const nextYearShort = String(year + 1).slice(-2);
    const term = yearTermMatch[2].toLowerCase();
    const termNum = term.startsWith('aut') || term.startsWith('fall') ? '1' : '2';
    return `${year}/${nextYearShort}/${termNum}`;
  }

  return null;
}

/**
 * Formats a raw semester string into a human-friendly label in English.
 * E.g. "2026/27/1" -> "2026/27 Autumn", "2025/26/2" -> "2025/26 Spring"
 */
export function formatSemesterLabel(semester: string): string {
  if (semester === 'all') {
    return 'All Semesters';
  }

  const parts = semester.split('/');
  if (parts.length === 3) {
    const termNum = parts[2];
    const termName = termNum === '1' ? 'Autumn' : termNum === '2' ? 'Spring' : `Term ${termNum}`;
    return `${parts[0]}/${parts[1]} ${termName}`;
  }

  return semester;
}

/**
 * Sorts semester strings in descending order (latest academic year/term first).
 */
export function sortSemesters(semesters: string[]): string[] {
  return [...semesters].sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;

    // Split e.g. "2026/27/1" -> [2026, 27, 1]
    const parse = (s: string) => {
      const p = s.split('/').map(Number);
      return (p[0] || 0) * 100 + (p[2] || 0);
    };

    return parse(b) - parse(a);
  });
}
