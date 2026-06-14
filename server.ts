import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import { QuizPage, Student, StudentSubmission, QuestionType } from "./src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to data store files
const DATA_DIR = path.join(__dirname, "src", "data_store");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const QUIZ_FILE = path.join(DATA_DIR, "quiz.json");
const STUDENTS_FILE = path.join(DATA_DIR, "students.json");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");

// Helper to write file safely
const writeJsonFile = (filePath: string, data: any) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`Error writing file ${filePath}:`, err);
  }
};

// Helper to read file safely
const readJsonFile = (filePath: string, defaultData: any) => {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
  }
  return defaultData;
};

// Default initial data for nice out-of-the-box experience
const defaultStudents: Student[] = [
  { id: "s1", name: "김도현", classNumber: 1 },
  { id: "s2", name: "이지수", classNumber: 1 },
  { id: "s3", name: "박세준", classNumber: 2 },
  { id: "s4", name: "최아름", classNumber: 2 },
  { id: "s5", name: "윤민호", classNumber: 3 }
];

const defaultQuiz: QuizPage[] = [
  {
    id: "p1",
    title: "1페이지: 지구 대기 대순환",
    videoUrl: "https://www.youtube.com/watch?v=SglMAnUj0-k",
    questions: [
      {
        id: "q1_1",
        text: "적도 지방에서 온난한 공기가 상승하여 위도 30도 부근에서 가라앉은 뒤, 다시 지표를 따라 적도로 불어 드는 상시풍의 명칭은 무엇일까요?",
        type: QuestionType.MULTIPLE_CHOICE,
        options: ["무역풍", "편서풍", "극동풍", "계절풍"],
        correctAnswer: "무역풍",
        points: 15
      },
      {
        id: "q1_2",
        text: "지표 부근의 대기 대순환 순환 세포 중, 해들리 순환과 페렐 순환이 나뉘는 경계선은 대략 위도 몇 도 부근일까요? (숫자만 작성)",
        type: QuestionType.SHORT_ANSWER,
        options: [],
        correctAnswer: "30",
        points: 15
      }
    ]
  },
  {
    id: "p2",
    title: "2페이지: 화산과 지진 (지각 변동)",
    videoUrl: "https://www.youtube.com/watch?v=W0S83pS_R6I",
    questions: [
      {
        id: "q2_1",
        text: "지하 깊은 곳에서 암석이 고온으로 녹아 있는 액체 상태의 물질을 무엇이라고 할까요?",
        type: QuestionType.SHORT_ANSWER,
        options: [],
        correctAnswer: "마그마",
        points: 15
      },
      {
        id: "q2_2",
        text: "전 세계 지진과 화산 활동의 약 80% 이상이 집중적으로 일어나는 환태평양 변동대의 또 다른 유명한 별명은 무엇인가요?",
        type: QuestionType.MULTIPLE_CHOICE,
        options: ["불의 고리", "물의 장벽", "은빛 고리", "하늘의 문"],
        correctAnswer: "불의 고리",
        points: 20
      }
    ]
  },
  {
    id: "p3",
    title: "3페이지: 친환경 신재생 에너지",
    videoUrl: "https://www.youtube.com/watch?v=Xh06_77mR0Y",
    questions: [
      {
        id: "q3_1",
        text: "태양광 발전은 광전 효과를 이용하여 태양의 어떠한 에너지를 직접 전기에너지로 변환하는 기술인가요?",
        type: QuestionType.MULTIPLE_CHOICE,
        options: ["빛에너지", "열에너지", "화학에너지", "위치에너지"],
        correctAnswer: "빛에너지",
        points: 15
      },
      {
        id: "q3_2",
        text: "바람의 운동에너지를 회전날개를 통해 전기에너지로 바꾸는 청정에너지 발전 방식을 ( ) 발전이라고 합니다. 빈칸에 들어갈 알맞은 단어는 무엇일까요?",
        type: QuestionType.SHORT_ANSWER,
        options: [],
        correctAnswer: "풍력",
        points: 20
      }
    ]
  }
];

// Initialize database arrays in server
let students: Student[] = readJsonFile(STUDENTS_FILE, defaultStudents);
let quizPages: QuizPage[] = readJsonFile(QUIZ_FILE, defaultQuiz);
let submissions: StudentSubmission[] = readJsonFile(SUBMISSIONS_FILE, []);

// Write defaults back if files don't exist
if (!fs.existsSync(STUDENTS_FILE)) writeJsonFile(STUDENTS_FILE, students);
if (!fs.existsSync(QUIZ_FILE)) writeJsonFile(QUIZ_FILE, quizPages);
if (!fs.existsSync(SUBMISSIONS_FILE)) writeJsonFile(SUBMISSIONS_FILE, submissions);

// API Endpoints

// 1. Students APIs
app.get("/api/students", (req, res) => {
  res.json(students);
});

app.post("/api/students", (req, res) => {
  if (Array.isArray(req.body)) {
    students = req.body;
    writeJsonFile(STUDENTS_FILE, students);
    res.json({ success: true, message: "학생 명렬이 업데이트되었습니다.", data: students });
  } else {
    res.status(400).json({ error: "Invalid array form" });
  }
});

// 2. Quiz Configuration APIs
app.get("/api/quiz", (req, res) => {
  res.json(quizPages);
});

app.post("/api/quiz", (req, res) => {
  if (Array.isArray(req.body)) {
    quizPages = req.body;
    writeJsonFile(QUIZ_FILE, quizPages);
    res.json({ success: true, message: "퀴즈 구성이 변경되었습니다.", data: quizPages });
  } else {
    res.status(400).json({ error: "Invalid array form" });
  }
});

// 3. Submissions APIs
app.get("/api/submissions", (req, res) => {
  res.json(submissions);
});

// Post/Update student progress or final answers
app.post("/api/submissions", (req, res) => {
  const submissionData = req.body as Partial<StudentSubmission>;
  if (!submissionData.studentId) {
    res.status(400).json({ error: "studentId is required" });
    return;
  }

  // Find existing submission or create new one
  let index = submissions.findIndex(s => s.studentId === submissionData.studentId);
  const student = students.find(s => s.id === submissionData.studentId);
  const studentName = student ? student.name : (submissionData.studentName || "알 수 없는 학생");
  const classNumber = student ? student.classNumber : (submissionData.classNumber || 1);

  const nowString = new Date().toISOString();

  let submission: StudentSubmission;
  if (index >= 0) {
    submission = {
      ...submissions[index],
      ...submissionData,
      studentName,
      classNumber,
      submittedAt: nowString,
      lastActiveTime: submissionData.lastActiveTime || nowString
    } as StudentSubmission;
    submissions[index] = submission;
  } else {
    submission = {
      studentId: submissionData.studentId,
      studentName,
      classNumber,
      pageAnswers: submissionData.pageAnswers || [],
      score: submissionData.score || 0,
      totalPoints: submissionData.totalPoints || 0,
      submittedAt: nowString,
      isCompleted: submissionData.isCompleted || false,
      currentPageIndex: submissionData.currentPageIndex || 0,
      tabFocused: submissionData.tabFocused !== undefined ? submissionData.tabFocused : true,
      tabSwitchesCount: submissionData.tabSwitchesCount || 0,
      lastActiveTime: submissionData.lastActiveTime || nowString,
      currentDraftAnswers: submissionData.currentDraftAnswers || {},
      warningMessage: submissionData.warningMessage || ""
    };
    submissions.push(submission);
  }

  // Auto-grade calculation if completed is flagged
  if (submission.isCompleted) {
    let earnedPoints = 0;
    let totalPointsPossible = 0;

    quizPages.forEach((page) => {
      // Find submission page answers
      const subPage = submission.pageAnswers.find(pa => pa.pageId === page.id);
      
      page.questions.forEach((question) => {
        const value = question.points || 0;
        totalPointsPossible += value;

        if (subPage) {
          const studentAns = subPage.answers[question.id] || "";
          
          // Compare answer (trim whitespace and ignore casing/spacing for short answer)
          const target = question.correctAnswer.trim().toLowerCase().replace(/\s+/g, "");
          const candidate = studentAns.trim().toLowerCase().replace(/\s+/g, "");
          
          if (target && candidate === target) {
            earnedPoints += value;
          }
        }
      });
    });

    submission.score = earnedPoints;
    submission.totalPoints = totalPointsPossible;
  }

  writeJsonFile(SUBMISSIONS_FILE, submissions);
  res.json({ success: true, submission });
});

// Clear/Reset submissions
app.post("/api/submissions/reset", (req, res) => {
  submissions = [];
  writeJsonFile(SUBMISSIONS_FILE, submissions);
  res.json({ success: true, message: "모든 학생 성적 및 제출 목록이 초기화되었습니다." });
});


// Vite Dev Server Integration & Static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
