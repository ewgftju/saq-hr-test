export type Role = "hr" | "employee";
export type EntityStatus = "draft" | "published" | "archived";
export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  status: "active" | "inactive";
  avatarColor?: string;
  hiredAt?: string;
  registeredAt?: string;
  seniorityYears?: number;
}
export interface Lesson {
  id: string;
  title: string;
  type: "text" | "video" | "audio" | "file" | "link";
  content: string;
  url?: string;
  fileId?: string;
  fileName?: string;
  durationMinutes: number;
}
export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}
export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  durationHours: number;
  status: EntityStatus;
  chapters: Chapter[];
  testId?: string;
  coverColor?: string;
  updatedAt: string;
  instructor?: string;
  tags?: string[];
  allowSelfEnrollment?: boolean;
  certificateEnabled?: boolean;
}
export type QuestionType = "single" | "multiple" | "text" | "open";
export interface QuestionOption {
  id: string;
  text: string;
}
export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: QuestionOption[];
  /** Option ids for choice questions, accepted strings for short text. Open questions are reviewed manually. */
  correctAnswers: string[];
  points: number;
  explanation?: string;
}
export interface Test {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  timeLimitMinutes: number;
  passPercent: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  allowNegativeMarking: boolean;
  status: EntityStatus;
  showAnswers: boolean;
  showHistory: boolean;
  negativePoints: number;
  questionLimit: number;
}
export interface Program {
  id: string;
  title: string;
  description: string;
  courseIds: string[];
  employeeIds: string[];
  deadline: string;
  status: EntityStatus;
}
export interface Assignment {
  id: string;
  employeeId: string;
  courseId: string;
  assignedAt: string;
  deadline: string;
  required: boolean;
  completedLessonIds: string[];
  completedAt?: string;
  cancelledAt?: string;
}
export type AttemptStatus =
  "in_progress" | "passed" | "failed" | "pending_review";
export type Answers = Record<string, string[]>;
export interface Attempt {
  id: string;
  employeeId: string;
  testId: string;
  courseId: string;
  assignmentId: string;
  number: number;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  /** Immutable copy of the test at the time the attempt starts. */
  testSnapshot: Test;
  questions: Question[];
  answers: Answers;
  status: AttemptStatus;
  score: number;
  maxScore: number;
  percent: number;
  questionScores: Record<string, number>;
  reviewComments: Record<string, string>;
  reviewedAt?: string;
  reviewedBy?: string;
}
export interface Notification {
  id: string;
  employeeId?: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: "assignment" | "deadline" | "result" | "system";
  href?: string;
  audience?: "hr" | "employee" | "all";
}
export interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  type: "file" | "link";
  url?: string;
  fileId?: string;
  fileName?: string;
  updatedAt: string;
}
export interface CourseReview {
  id: string;
  courseId: string;
  employeeId: string;
  rating: number;
  text: string;
  createdAt: string;
}
export interface HrSettings {
  organizationName: string;
  certificatePrefix: string;
  defaultPassPercent: number;
  defaultTimeLimitMinutes: number;
  defaultMaxAttempts: number;
  notificationDaysBefore: number;
}
export interface HrState {
  version: 1;
  employees: Employee[];
  courses: Course[];
  tests: Test[];
  programs: Program[];
  assignments: Assignment[];
  attempts: Attempt[];
  notifications: Notification[];
  resources: Resource[];
  reviews: CourseReview[];
  settings: HrSettings;
}
export type AssignmentStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "completed"
  | "failed"
  | "overdue";
export interface AssignmentProgress {
  status: AssignmentStatus;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  bestScore: number | null;
  lastAttempt?: Attempt;
  isComplete: boolean;
  isOverdue: boolean;
}
export interface AssignCoursesInput {
  employeeIds: string[];
  courseIds: string[];
  deadline: string;
  required?: boolean;
}
export interface ReviewInput {
  scores: Record<string, number>;
  comments?: Record<string, string>;
}
export interface Certificate {
  id: string;
  employeeName: string;
  courseTitle: string;
  completedAt: string;
  score: number | null;
  durationHours: number;
}
