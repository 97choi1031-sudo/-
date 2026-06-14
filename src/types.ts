export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  SHORT_ANSWER = 'short_answer'
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[]; // for multiple choice
  correctAnswer: string;
  points: number;
}

export interface QuizPage {
  id: string;
  title: string;
  videoUrl: string;
  questions: Question[];
}

export interface Student {
  id: string;
  name: string;
  classNumber: number; // 1 to 12
}

export interface PageSubmission {
  pageId: string;
  answers: { [questionId: string]: string };
}

export interface StudentSubmission {
  studentId: string;
  studentName: string;
  classNumber?: number; // 1 to 12
  pageAnswers: PageSubmission[];
  score: number;
  totalPoints: number;
  submittedAt: string;
  isCompleted: boolean;
  currentPageIndex: number; // 0-based index of where the student currently is
  // Live monitoring fields
  tabFocused?: boolean;
  tabSwitchesCount?: number;
  lastActiveTime?: string;
  currentDraftAnswers?: { [questionId: string]: string }; // Answers they have typed/selected before clicking next page
  warningMessage?: string; // Real-time warning message sent from teacher
}
