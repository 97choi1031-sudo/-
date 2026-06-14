import React, { useState, useEffect } from "react";
import { Users, BookOpen, Lock, Sparkles, GraduationCap } from "lucide-react";
import { QuizPage, Student, StudentSubmission } from "./types.js";
import TeacherDashboard from "./components/TeacherDashboard.js";
import StudentPortal from "./components/StudentPortal.js";

export default function App() {
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [quizPages, setQuizPages] = useState<QuizPage[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passError, setPassError] = useState("");

  const appUrl = window.location.origin;

  // 1. Initial State Fetching
  const fetchData = async () => {
    try {
      const [studentsRes, quizRes, subsRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/quiz"),
        fetch("/api/submissions")
      ]);

      if (studentsRes.ok && quizRes.ok && subsRes.ok) {
        const studentsData = await studentsRes.json();
        const quizData = await quizRes.json();
        const subsData = await subsRes.json();
        
        setStudents(studentsData);
        setQuizPages(quizData);
        setSubmissions(subsData);
      }
    } catch (err) {
      console.error("Error fetching classroom state database:", err);
    } finally {
      setLoading(false);
    }
  };

  // 1b. Real-time Polling State Fetching (Excludes the static/teacher-only quiz payload)
  const fetchRealtimeData = async () => {
    try {
      const [studentsRes, subsRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/submissions")
      ]);

      if (studentsRes.ok && subsRes.ok) {
        const studentsData = await studentsRes.json();
        const subsData = await subsRes.json();
        
        setStudents(studentsData);
        setSubmissions(subsData);
      }
    } catch (err) {
      console.error("Error fetching classroom realtime database:", err);
    }
  };

  useEffect(() => {
    fetchData();

    // Parse mode query parameter from URL (e.g. ?mode=student)
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    if (modeParam === "student") {
      setRole("student");
    } else if (modeParam === "teacher") {
      setRole("teacher");
    }

    // Set up rapid real-time classroom statistics synchronization loop every 3 seconds (real-time data only)
    const interval = setInterval(() => {
      fetchRealtimeData();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // 2. State Updaters posted to API backend
  const handleUpdateStudents = async (updated: Student[]) => {
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const result = await res.json();
        setStudents(result.data);
      }
    } catch (err) {
      console.error("Failed to update student database:", err);
      throw err;
    }
  };

  const handleUpdateQuiz = async (updated: QuizPage[]) => {
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const result = await res.json();
        setQuizPages(result.data);
      }
    } catch (err) {
      console.error("Failed to update quiz database:", err);
      throw err;
    }
  };

  const handleResetSubmissions = async () => {
    try {
      const res = await fetch("/api/submissions/reset", { method: "POST" });
      if (res.ok) {
        setSubmissions([]);
      }
    } catch (err) {
      console.error("Failed to reset student submissions:", err);
      throw err;
    }
  };

  const handleSubmitResult = async (submission: Partial<StudentSubmission>): Promise<StudentSubmission> => {
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission)
      });
      if (res.ok) {
        const result = await res.json();
        
        // Refresh local cache
        await fetchData();
        return result.submission;
      }
      throw new Error("Submission api returned error status");
    } catch (err) {
      console.error("Failed setting submissions progress score:", err);
      throw err;
    }
  };

  const handleSelectTeacherRole = () => {
    // Show a password protection pin modal for classroom environment integrity
    setShowPasswordPrompt(true);
    setPasswordInput("");
    setPassError("");
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "1234") {
      setRole("teacher");
      setShowPasswordPrompt(false);
    } else {
      setPassError("비밀번호가 일치하지 않습니다. (초기 비밀번호: 1234)");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
        <p className="text-slate-500 font-bold text-xs font-sans tracking-wide">학습 및 퀴즈 데이터를 로드하는 동기화 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12">
      {/* Dynamic Role Navigation Bar */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div 
            onClick={() => {
              setRole(null);
              const url = new URL(window.location.href);
              url.searchParams.delete("mode");
              window.history.pushState({}, "", url.toString());
            }}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
          >
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            <span className="font-extrabold text-base tracking-tight text-slate-900">스포츠 퀴즈 및 소감문 작성</span>
          </div>

          <div className="flex items-center gap-2">
            {role === "teacher" && (
              <>
                <span className="text-xs bg-indigo-50 border border-indigo-250 text-indigo-700 px-2.5 py-1 rounded-full font-bold">
                  ● 교사용 모드
                </span>
                <button
                  onClick={() => {
                    setRole("student");
                    const url = new URL(window.location.href);
                    url.searchParams.set("mode", "student");
                    window.history.pushState({}, "", url.toString());
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3.5 py-1.5 rounded-lg text-xs font-bold transition"
                  id="nav-to-student"
                >
                  학생 화면 보기
                </button>
              </>
            )}

            {role === "student" && (
              <>
                <span className="text-xs bg-emerald-50 border border-emerald-250 text-emerald-700 px-2.5 py-1 rounded-full font-bold">
                  ● 학생용 퀴즈 풀이 모드
                </span>
                <button
                  onClick={handleSelectTeacherRole}
                  className="bg-slate-850 hover:bg-slate-900 text-slate-100 px-3.5 py-1.5 rounded-lg text-xs font-bold transition font-sans flex items-center gap-1"
                  id="nav-to-teacher"
                >
                  <Lock className="w-3 h-3" />
                  교사 화면 전환
                </button>
              </>
            )}

            {!role && (
              <span className="text-xs text-slate-400 font-semibold font-sans">
                시스템 준비 완료
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-8">
        
        {/* LANDING PAGE: Role Selection (if no role has been preset in state or url) */}
        {!role && (
          <div className="max-w-2xl mx-auto py-12 md:py-20 space-y-12">
            <div className="text-center py-6">
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                스포츠 퀴즈 및 소감문 작성
              </h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              {/* Option A: Teacher Gateway */}
              <div 
                onClick={handleSelectTeacherRole}
                className="bg-white hover:bg-indigo-50/10 border border-slate-250/60 hover:border-indigo-400 p-8 rounded-2xl cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between space-y-6 group"
                id="landing-role-teacher"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white rounded-2xl flex items-center justify-center transition">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">교사용 제어 모드</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    학생들 출석 명단을 업로드하고, 단계별 유튜브 주소 및 가이드 질문지를 수정/등록합니다. 실시간으로 학생들이 제출하는 상세 점수판 차트를 모니터링하세요.
                  </p>
                </div>
                <div className="text-indigo-600 text-xs font-extrabold flex items-center gap-1">
                  선생님 공간 접속하기 &rarr;
                </div>
              </div>

              {/* Option B: Students Gateway */}
              <div 
                onClick={() => {
                  setRole("student");
                  const url = new URL(window.location.href);
                  url.searchParams.set("mode", "student");
                  window.history.pushState({}, "", url.toString());
                }}
                className="bg-white hover:bg-emerald-50/10 border border-slate-250/60 hover:border-emerald-400 p-8 rounded-2xl cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between space-y-6 group"
                id="landing-role-student"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white rounded-2xl flex items-center justify-center transition">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">학생용 응시 모드</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    수업 프로젝터 화면의 QR코드를 스캔하여 본인 이름을 찾은 뒤, 비디오 영상 시청 후 답지를 순차 단계별로 제출하고 상세 채점 결과와 피드백을 맞이합니다.
                  </p>
                </div>
                <div className="text-emerald-600 text-xs font-extrabold flex items-center gap-1">
                  학생 퀴즈룸 참여하기 &rarr;
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Display components */}
        {role === "teacher" && (
          <TeacherDashboard
            students={students}
            quizPages={quizPages}
            submissions={submissions}
            appUrl={appUrl}
            onUpdateStudents={handleUpdateStudents}
            onUpdateQuiz={handleUpdateQuiz}
            onResetSubmissions={handleResetSubmissions}
            onRefreshData={fetchData}
          />
        )}

        {role === "student" && (
          <StudentPortal
            students={students}
            quizPages={quizPages}
            submissions={submissions}
            onSubmitAnswers={handleSubmitResult}
          />
        )}

      </main>

      {/* PASSWORD PROTECTION MODAL (Teacher PIN check) */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form 
            onSubmit={handleVerifyPassword}
            className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-5 border border-slate-100 shadow-2xl animate-scale-up"
          >
            <div className="text-center space-y-1">
              <Lock className="w-8 h-8 text-indigo-600 mx-auto mb-1" />
              <h3 className="text-base font-bold text-slate-800">교사 인증 비밀번호 기입</h3>
              <p className="text-slate-400 text-xs">안전한 학급 도구 사용을 위해 보안 코드를 기입하십시오.</p>
            </div>

            <div className="space-y-1.5">
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="비밀번호 입력 (기본: 1234)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center text-sm font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
              {passError && (
                <p className="text-rose-600 text-[11px] font-semibold text-center">{passError}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPasswordPrompt(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 font-semibold py-2.5 rounded-xl text-xs transition"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
                id="btn-verify-password-submit"
              >
                교사 모드 입장
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
