/**
 * Mock Canvas API data for development without credentials.
 * Activated when CANVAS_MOCK_MODE=true.
 */

import type {
  CanvasUser,
  CanvasCourse,
  CanvasAssignment,
  CanvasQuiz,
  CanvasCalendarEvent,
} from './types';

const now = new Date();
const hour = 60 * 60 * 1000;
const day = 24 * hour;

function dateStr(offset: number): string {
  return new Date(now.getTime() + offset).toISOString();
}

export const mockUser: CanvasUser = {
  id: 12345,
  name: 'Test Student',
  short_name: 'Test',
  login_id: 'test.student',
  email: 'test.student@student.elte.hu',
  avatar_url: '',
  locale: 'en',
  time_zone: 'Europe/Budapest',
};

export const mockCourses: CanvasCourse[] = [
  {
    id: 101,
    name: 'Programming',
    course_code: 'PROG101',
    workflow_state: 'available',
    time_zone: 'Europe/Budapest',
  },
  {
    id: 102,
    name: 'Discrete Mathematics',
    course_code: 'DMATH201',
    workflow_state: 'available',
    time_zone: 'Europe/Budapest',
  },
  {
    id: 103,
    name: 'Algorithms and Data Structures',
    course_code: 'ADS301',
    workflow_state: 'available',
    time_zone: 'Europe/Budapest',
  },
  {
    id: 104,
    name: 'Operating Systems',
    course_code: 'OS202',
    workflow_state: 'available',
    time_zone: 'Europe/Budapest',
  },
];

export const mockAssignments: Record<number, CanvasAssignment[]> = {
  101: [
    {
      id: 1001,
      name: 'Recursion Assignment',
      description: '<p>Implement recursive solutions for the following problems...</p>',
      course_id: 101,
      due_at: dateStr(2 * hour),
      unlock_at: dateStr(-2 * day),
      lock_at: dateStr(3 * day),
      html_url: 'https://canvas.elte.hu/courses/101/assignments/1001',
      points_possible: 100,
      submission_types: ['online_upload', 'online_text_entry'],
      published: true,
      locked_for_user: false,
      has_submitted_submissions: false,
      submission: { id: 1, assignment_id: 1001, workflow_state: 'unsubmitted' },
    },
    {
      id: 1002,
      name: 'Object-Oriented Design Project',
      description: '<p>Design and implement a simple OOP project...</p>',
      course_id: 101,
      due_at: dateStr(1 * day + 6 * hour),
      unlock_at: dateStr(-5 * day),
      lock_at: null,
      html_url: 'https://canvas.elte.hu/courses/101/assignments/1002',
      points_possible: 150,
      submission_types: ['online_upload'],
      published: true,
      locked_for_user: false,
      has_submitted_submissions: true,
      submission: {
        id: 2,
        assignment_id: 1002,
        workflow_state: 'submitted',
        submitted_at: dateStr(-1 * day),
        attempt: 1,
        submission_type: 'online_upload',
      },
    },
    {
      id: 1003,
      name: 'Data Structures Implementation',
      description: '<p>Implement a linked list, stack, and queue...</p>',
      course_id: 101,
      due_at: dateStr(4 * day),
      unlock_at: dateStr(2 * day),
      lock_at: dateStr(5 * day),
      html_url: 'https://canvas.elte.hu/courses/101/assignments/1003',
      points_possible: 80,
      submission_types: ['online_upload'],
      published: true,
      locked_for_user: true,
      lock_explanation: 'This assignment is locked until the unlock date.',
      has_submitted_submissions: false,
      submission: { id: 3, assignment_id: 1003, workflow_state: 'unsubmitted' },
    },
  ],
  102: [
    {
      id: 2001,
      name: 'Proof Techniques Homework',
      description: '<p>Complete proofs for the following statements...</p>',
      course_id: 102,
      due_at: dateStr(-1 * day),
      unlock_at: dateStr(-7 * day),
      lock_at: null,
      html_url: 'https://canvas.elte.hu/courses/102/assignments/2001',
      points_possible: 50,
      submission_types: ['online_upload'],
      published: true,
      locked_for_user: false,
      has_submitted_submissions: false,
      submission: { id: 4, assignment_id: 2001, workflow_state: 'unsubmitted' },
    },
    {
      id: 2002,
      name: 'Graph Theory Problem Set',
      description: '<p>Solve the following graph theory problems...</p>',
      course_id: 102,
      due_at: dateStr(18 * hour),
      unlock_at: dateStr(-3 * day),
      lock_at: null,
      html_url: 'https://canvas.elte.hu/courses/102/assignments/2002',
      points_possible: 60,
      submission_types: ['online_upload', 'online_text_entry'],
      published: true,
      locked_for_user: false,
      has_submitted_submissions: false,
      submission: { id: 5, assignment_id: 2002, workflow_state: 'unsubmitted' },
    },
  ],
  103: [
    {
      id: 3001,
      name: 'Sorting Algorithms Analysis',
      description: '<p>Analyze and compare sorting algorithms...</p>',
      course_id: 103,
      due_at: dateStr(3 * day),
      unlock_at: dateStr(-1 * day),
      lock_at: null,
      html_url: 'https://canvas.elte.hu/courses/103/assignments/3001',
      points_possible: 120,
      submission_types: ['online_upload'],
      published: true,
      locked_for_user: false,
      has_submitted_submissions: false,
      submission: { id: 6, assignment_id: 3001, workflow_state: 'unsubmitted' },
    },
  ],
  104: [
    {
      id: 4001,
      name: 'Process Scheduling Simulation',
      description: '<p>Build a process scheduling simulator...</p>',
      course_id: 104,
      due_at: dateStr(5 * day),
      unlock_at: dateStr(1 * day),
      lock_at: dateStr(6 * day),
      html_url: 'https://canvas.elte.hu/courses/104/assignments/4001',
      points_possible: 100,
      submission_types: ['online_upload'],
      published: true,
      locked_for_user: true,
      lock_explanation: 'This assignment opens tomorrow.',
      has_submitted_submissions: false,
      submission: { id: 7, assignment_id: 4001, workflow_state: 'unsubmitted' },
    },
  ],
};

export const mockQuizzes: Record<number, CanvasQuiz[]> = {
  102: [
    {
      id: 501,
      title: 'Set Theory Quiz',
      description: '<p>Quiz on set theory fundamentals...</p>',
      html_url: 'https://canvas.elte.hu/courses/102/quizzes/501',
      quiz_type: 'assignment',
      time_limit: 30,
      points_possible: 40,
      allowed_attempts: 1,
      due_at: dateStr(20 * hour),
      unlock_at: dateStr(-1 * day),
      lock_at: dateStr(1 * day),
      published: true,
      locked_for_user: false,
    },
  ],
  103: [
    {
      id: 502,
      title: 'Complexity Theory Quiz',
      description: '<p>Quiz on Big-O notation and complexity classes...</p>',
      html_url: 'https://canvas.elte.hu/courses/103/quizzes/502',
      quiz_type: 'assignment',
      time_limit: 45,
      points_possible: 50,
      allowed_attempts: 2,
      due_at: dateStr(2 * day),
      unlock_at: dateStr(-2 * day),
      lock_at: dateStr(3 * day),
      published: true,
      locked_for_user: false,
    },
  ],
};

export const mockCalendarEvents: CanvasCalendarEvent[] = [
  {
    id: 901,
    title: 'Programming Lab Session',
    description: 'Weekly lab session for Programming course',
    start_at: dateStr(1 * day + 10 * hour),
    end_at: dateStr(1 * day + 12 * hour),
    context_code: 'course_101',
    context_name: 'Programming',
    type: 'event',
  },
  {
    id: 902,
    title: 'Algorithms Lecture',
    description: 'Weekly lecture for Algorithms course',
    start_at: dateStr(2 * day + 8 * hour),
    end_at: dateStr(2 * day + 10 * hour),
    context_code: 'course_103',
    context_name: 'Algorithms and Data Structures',
    type: 'event',
  },
];
