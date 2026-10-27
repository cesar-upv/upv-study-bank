import Dexie, { type Table } from 'dexie';
import { UnitPackage, Question, Answer } from '@/domain/content/types';

export interface StoredPackage {
  id: string; // `${subjectId}:${unitId}`
  subjectId: string;
  unitId: string;
  pkg: UnitPackage;
  importedAt: string;
}

export interface StoredAttempt {
  id: string; // uuid
  subjectId: string;
  unitId: string;
  questionId: string;
  contentRevision: number;
  type: string;
  submittedResponse: any;
  normalizedResponse?: any;
  score: number; // 0 to 1
  maxScore: number; // usually 1
  assisted: boolean;
  submittedAt: string;
  feedback?: any;
  generatorId?: string;
  generatorVersion?: number;
  seed?: number;
  snapshot?: any;
}

export interface StoredSession {
  id: string; // uuid
  subjectId: string;
  unitId: string;
  status: 'in_progress' | 'submitted' | 'abandoned';
  mode: 'exam' | 'practice';
  questionIds: string[];
  questionSnapshot?: Question[];
  answerSnapshot?: Answer[];
  contentRevision?: number;
  optionsOrder?: Record<string, string[]>; // questionId -> shuffled optionIds
  answers: Record<string, any>;
  startedAt: string;
  deadline?: string | null;
  submittedAt?: string;
  autogradedScore?: number;
  autogradedCount?: number;
  selfAssessedScore?: number;
  selfAssessedCount?: number;
  unansweredCount?: number;
}

export interface StoredBookmark {
  id: string; // `${subjectId}:${unitId}:${itemType}:${itemId}`
  subjectId: string;
  unitId: string;
  itemType: 'lesson' | 'question';
  itemId: string;
  createdAt: string;
}

export interface StoredLessonProgress {
  id: string; // `${subjectId}:${unitId}:${lessonId}`
  subjectId: string;
  unitId: string;
  lessonId: string;
  completed: boolean;
  readAt: string;
}

export interface StoredReviewItem {
  id: string; // `${subjectId}:${unitId}:${questionId}`
  subjectId: string;
  unitId: string;
  questionId: string;
  dueDate: string; // ISO string
  intervalDays: number;
  consecutiveUnassisted: number;
  lastAttemptId?: string;
  lastScore?: number;
  updatedAt: string;
}

export interface StoredSetting {
  key: string;
  value: any;
}

export class StudyBankDatabase extends Dexie {
  importedPackages!: Table<StoredPackage, string>;
  attempts!: Table<StoredAttempt, string>;
  sessions!: Table<StoredSession, string>;
  bookmarks!: Table<StoredBookmark, string>;
  lessonProgress!: Table<StoredLessonProgress, string>;
  reviewItems!: Table<StoredReviewItem, string>;
  settings!: Table<StoredSetting, string>;

  constructor() {
    super('StudyBankDB');

    this.version(1).stores({
      importedPackages: 'id, subjectId, unitId, importedAt',
      attempts: 'id, subjectId, unitId, questionId, type, submittedAt, [subjectId+unitId+questionId]',
      sessions: 'id, subjectId, unitId, status, mode, startedAt, [subjectId+unitId+status+mode]',
      bookmarks: 'id, subjectId, unitId, itemType, itemId, [subjectId+unitId]',
      lessonProgress: 'id, subjectId, unitId, lessonId, completed, [subjectId+unitId]',
      reviewItems: 'id, subjectId, unitId, questionId, dueDate, [subjectId+unitId]',
      settings: 'key',
    });
  }
}

export const db = new StudyBankDatabase();
