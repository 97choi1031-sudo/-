import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, Play, ArrowRight, Award, LogIn, Lock, BookOpen, AlertCircle, XCircle 
} from "lucide-react";
import { QuizPage, Student, StudentSubmission, QuestionType, PageSubmission } from "../types.js";

interface StudentPortalProps {
  students: Student[];
  quizPages: QuizPage[];
  submissions: StudentSubmission[];
  onSubmitAnswers: (
    submission: Partial<StudentSubmission>
  ) => Promise<StudentSubmission>;
}

export default function StudentPortal({
  students,
  quizPages,
  submissions,
  onSubmitAnswers
}: StudentPortalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedClassNum, setSelectedClassNum] = useState<number>(1); // Active student class (1 - 12)
  const [isLogged, setIsLogged] = useState(false);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  
  // Accumulated student answers for the current session
  const [answersByPage, setAnswersByPage] = useState<{ [pageId: string]: { [qId: string]: string } }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSession, setSubmittedSession] = useState<StudentSubmission | null>(null);

  // Live monitor state variables
  const [tabFocused, setTabFocused] = useState(true);
  const [tabSwitches, setTabSwitches] = useState(0);

  // Focus action handlers
  useEffect(() => {
    if (!isLogged || !selectedStudentId) return;

    const handleFocus = () => {
      setTabFocused(true);
    };

    const handleBlur = () => {
      setTabFocused(false);
      setTabSwitches(prev => prev + 1);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    const handleVisibility = () => {
      if (document.hidden) {
        setTabFocused(false);
        setTabSwitches(prev => prev + 1);
      } else {
        setTabFocused(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isLogged, selectedStudentId]);

  // Background status telemetry pinger every 2.5 seconds to inform Teacher Dashboard
  useEffect(() => {
    if (!isLogged || !selectedStudentId || submittedSession) return;

    const syncTelemetry = async () => {
      try {
        const activePage = quizPages[currentPageIdx];
        if (!activePage) return;
        const pageAnswersArr: PageSubmission[] = quizPages.map(page => ({
          pageId: page.id,
          answers: answersByPage[page.id] || {}
        }));

        const payload: Partial<StudentSubmission> = {
          studentId: selectedStudentId,
          currentPageIndex: currentPageIdx,
          tabFocused,
          tabSwitchesCount: tabSwitches,
          currentDraftAnswers: answersByPage[activePage.id] || {},
          pageAnswers: pageAnswersArr
        };

        await onSubmitAnswers(payload);
      } catch (err) {
        console.error("Silence sync failed:", err);
      }
    };

    const interval = setInterval(syncTelemetry, 2500);
    return () => clearInterval(interval);
  }, [isLogged, selectedStudentId, currentPageIdx, tabFocused, tabSwitches, answersByPage, submittedSession, quizPages]);

  // Helper: YouTube ID Parser
  const getEmbedID = (url: string) => {
    if (!url) return "";
    let videoId = "";
    if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split(/[?#]/)[0] || "";
    } else if (url.includes("youtube.com/embed/")) {
      videoId = url.split("youtube.com/embed/")[1]?.split(/[?#]/)[0] || "";
    } else if (url.includes("v=")) {
      videoId = url.split("v=")[1]?.split("&")[0] || "";
    } else {
      videoId = url.trim();
    }
    return videoId;
  };

  // Check if student has already done the quiz previously
  const getExistingSubmission = () => {
    return submissions.find(s => s.studentId === selectedStudentId);
  };

  const handleLogin = () => {
    if (!selectedStudentId) return;

    const existing = getExistingSubmission();
    if (existing && existing.isCompleted) {
      // Already finished! Read previous state and bypass directly to scoreboard
      setSubmittedSession(existing);
    } else if (existing) {
      // Resume from previous state
      setCurrentPageIdx(existing.currentPageIndex || 0);
      setTabSwitches(existing.tabSwitchesCount || 0);
      
      // Load previous answers
      const restored: { [pageId: string]: { [qId: string]: string } } = {};
      existing.pageAnswers.forEach(pa => {
        restored[pa.pageId] = pa.answers;
      });
      setAnswersByPage(restored);
    } else {
      setTabSwitches(0);
    }
    
    setIsLogged(true);
  };

  const handleSelectAnswer = (qId: string, answer: string) => {
    const activePage = quizPages[currentPageIdx];
    const pageId = activePage.id;

    setAnswersByPage(prev => ({
      ...prev,
      [pageId]: {
        ...(prev[pageId] || {}),
        [qId]: answer
      }
    }));
  };

  // Proceed to next page or Final submit
  const handlePageNext = async () => {
    const activePage = quizPages[currentPageIdx];
    const pageAnswers = answersByPage[activePage.id] || {};

    // Validate that all questions on current page have been touched
    const missing = activePage.questions.some(q => !pageAnswers[q.id]?.trim());
    if (missing) {
      if (!confirm("아직 풀지 않은 문제가 있습니다. 정답을 기입하지 않고 넘어가시겠습니까?")) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const isLastPage = currentPageIdx === quizPages.length - 1;

      // Construct submissions structure
      const pageAnswersArr: PageSubmission[] = quizPages.map(page => ({
        pageId: page.id,
        answers: answersByPage[page.id] || {}
      }));

      const payload: Partial<StudentSubmission> = {
        studentId: selectedStudentId,
        pageAnswers: pageAnswersArr,
        currentPageIndex: currentPageIdx,
        isCompleted: isLastPage // marks completed if this is true
      };

      const result = await onSubmitAnswers(payload);

      if (isLastPage) {
        // Finished! Show scoring page
        setSubmittedSession(result);
      } else {
        // Move to next page
        setCurrentPageIdx(prev => prev + 1);
      }
    } catch (err) {
      alert("데이터 전송 중 오류가 발생했습니다. 네트워크를 확인하세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Student Logout / Retry
  const handleLogout = () => {
    setSelectedStudentId("");
    setIsLogged(false);
    setCurrentPageIdx(0);
    setAnswersByPage({});
    setSubmittedSession(null);
  };

  // Render Login page
  if (!isLogged) {
    const classFilteredStudents = students.filter(s => (s.classNumber ?? 1) === selectedClassNum);
    const selectedStudentObj = students.find(s => s.id === selectedStudentId);

    return (
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-8 animate-scale-up">
        {/* Entrance Portal Header */}
        <div className="text-center space-y-2">
          <div className="bg-indigo-50 text-indigo-700 w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-1">
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-850 tracking-tight">온라인 비디오 및 단답 퀴즈룸</h2>
          <p className="text-slate-400 text-xs">
            본인의 학급(반) 번호 탭을 누르신 후, 아래 명렬 목록에서 자신의 이름을 클릭해 접속하십시오.
          </p>
        </div>

        {/* Classroom Tabs (1 to 12) */}
        <div className="space-y-2">
          <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">나의 학급(반) 선택</label>
          <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1 text-center">
              {[...Array(12)].map((_, i) => {
                const classNum = i + 1;
                const isSelected = selectedClassNum === classNum;
                return (
                  <button
                    key={classNum}
                    onClick={() => {
                      setSelectedClassNum(classNum);
                      setSelectedStudentId(""); // Clear selection on class change for safety
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-black transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {classNum}반
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="bg-amber-50 border border-amber-150 rounded-2xl p-6 text-center space-y-2.5">
            <AlertCircle className="w-7 h-7 text-amber-600 mx-auto" />
            <p className="text-xs text-amber-800 font-bold leading-relaxed">
              아직 선생님께서 오늘의 출석부 명단을 등록하지 않으셨습니다.
            </p>
            <p className="text-slate-400 text-[11px]">교 사용 제어 가이드 탭에서 학생 명렬을 등록해 주셔야 활성화됩니다.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Student Name Grid Picker */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                  {selectedClassNum}반 학생 명렬표 ({classFilteredStudents.length}명)
                </label>
                {selectedStudentObj && (
                  <span className="text-xs text-indigo-700 font-bold bg-indigo-50 px-2.5 py-0.5 rounded-full animate-pulse">
                    🟢 선택됨 : {selectedStudentObj.name} 학생
                  </span>
                )}
              </div>

              {classFilteredStudents.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-slate-500 text-xs font-semibold">아직 {selectedClassNum}반 학생 리스트가 로드되지 않았습니다.</p>
                  <p className="text-[10px] text-slate-400 mt-1">선생님께 명렬 일괄 파일 업로드를 요청해 보십시오.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto p-1.5 bg-slate-50 rounded-2xl border border-slate-150">
                  {classFilteredStudents.map(s => {
                    const sub = submissions.find(sub => sub.studentId === s.id);
                    const isDone = sub && sub.isCompleted;
                    const isSelected = selectedStudentId === s.id;

                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStudentId(s.id)}
                        className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between min-h-[64px] relative cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-500/15 font-bold shadow-sm"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-350 hover:bg-slate-50/50"
                        }`}
                        id={`student-chip-${s.id}`}
                      >
                        <span className="text-xs font-bold block truncate">{s.name}</span>
                        <div className="flex items-center justify-between w-full mt-1.5">
                          {isDone ? (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              제출완료
                            </span>
                          ) : sub ? (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded border border-amber-200">
                              풀이중
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[8px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                              미접속
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Login Proceed Button */}
            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={handleLogin}
                disabled={!selectedStudentId}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400"
                id="student-login-submit"
              >
                <LogIn className="w-4.5 h-4.5" />
                {selectedStudentObj ? `[${selectedClassNum}반 ${selectedStudentObj.name}] 퀴즈룸 학습 입장하기` : "출석 서명을 먼저 클릭해 주세요"}
              </button>
              <p className="text-center text-[10px] text-slate-400 mt-3 font-semibold">
                ⚠️ 주의사항: 시험이나 퀴즈 시간 중 브라우저 창이나 탭을 무시하고 다른 곳을 탐색하면 실시간으로 교사 스마트 모니터에 적발 경보 신호가 송출됩니다.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Load current student submission to read live warning message
  const studentSub = submissions.find(s => s.studentId === selectedStudentId);
  const activeWarning = studentSub?.warningMessage;

  const handleAcknowledgeWarning = async () => {
    if (!selectedStudentId) return;
    try {
      await onSubmitAnswers({
        studentId: selectedStudentId,
        warningMessage: "" // clear warning message
      });
    } catch (err) {
      console.error("Warning clear failed", err);
    }
  };

  const renderWarningModal = () => {
    if (!activeWarning) return null;
    return (
      <div className="fixed inset-0 z-[999] bg-rose-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center border-4 border-rose-500 shadow-2xl animate-scale-up space-y-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <AlertCircle className="w-9 h-9" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-rose-700">👨‍🏫 교사의 실시간 원격 신호</h3>
            <p className="text-slate-400 text-[11px]">담당 교사로부터 원격 지도 경고를 수신하였습니다.</p>
          </div>
          <div className="bg-rose-50/55 border border-rose-100 p-4 rounded-2xl text-center">
            <p className="text-sm font-bold text-rose-800 leading-relaxed font-sans">
              "{activeWarning}"
            </p>
          </div>
          <button
            onClick={handleAcknowledgeWarning}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3.5 rounded-xl text-xs transition duration-150 shadow-lg shadow-rose-600/20 active:translate-y-0.5"
            id="student-clear-warning"
          >
            확인하였습니다 (학습 집중하기)
          </button>
        </div>
      </div>
    );
  };

  // Render Result Feedback Page
  if (submittedSession) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-scale-up">
        {renderWarningModal()}
        {/* Header congratulations banner */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-8 shadow-xl text-center space-y-4">
          <Award className="w-16 h-16 text-amber-400 mx-auto animate-bounce" />
          <h2 className="text-2xl font-black text-white">{submittedSession.studentName} 학생, 수고하셨습니다!</h2>
          <p className="text-indigo-200 text-xs">모든 단계의 교육 비디오 시청과 퀴즈 풀이가 완료되었습니다. 결과를 확인해보세요.</p>
          
          <div className="inline-block bg-white/10 border border-white/20 px-6 py-4 rounded-2xl">
            <span className="text-slate-300 text-xs block font-semibold">나의 최종 채점 점수</span>
            <span className="text-3xl font-black font-mono text-amber-300">
              {submittedSession.score}점 <span className="text-sm font-normal text-slate-300">/ {submittedSession.totalPoints}점</span>
            </span>
          </div>

          <div className="pt-2">
            <button
              onClick={handleLogout}
              className="bg-white hover:bg-slate-50 text-indigo-900 font-bold px-5 py-2.5 rounded-xl text-xs transition"
              id="student-logout-back"
            >
              초기 화면으로 돌아가기
            </button>
          </div>
        </div>

        {/* Detailed diagnostic breakdown */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-6 shadow-md">
          <h3 className="text-md font-bold text-slate-800 pb-3 border-b border-slate-100">지상 및 오답 상세 내역 복습</h3>

          <div className="space-y-6">
            {quizPages.map((page, pIdx) => {
              const studentPageAns = submittedSession.pageAnswers.find(pa => pa.pageId === page.id);
              return (
                <div key={page.id} className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-100 text-slate-600 rounded-full font-mono text-[10px] font-bold">
                      {pIdx + 1}
                    </span>
                    {page.title}
                  </h4>

                  <div className="space-y-4">
                    {page.questions.map((q) => {
                      const studentAns = studentPageAns ? studentPageAns.answers[q.id] || "" : "";
                      
                      const cleanTarget = q.correctAnswer.trim().toLowerCase().replace(/\s+/g, "");
                      const cleanCandidate = studentAns.trim().toLowerCase().replace(/\s+/g, "");
                      const isCorrect = cleanTarget && cleanCandidate === cleanTarget;

                      return (
                        <div 
                          key={q.id}
                          className={`p-4 rounded-2xl border transition hover:shadow-sm ${
                            isCorrect 
                              ? "bg-emerald-50/20 border-emerald-100" 
                              : "bg-rose-50/20 border-rose-100"
                          } space-y-3`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs text-slate-400 mb-0.5 font-bold">배점 {q.points}점</p>
                              <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.text}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-xs font-bold shrink-0 ${
                              isCorrect ? "text-emerald-600" : "text-rose-600"
                            }`}>
                              {isCorrect ? (
                                <>
                                  <CheckCircle2 className="w-5 h-5" />
                                  <span>맞음</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-5 h-5" />
                                  <span>틀림</span>
                                </>
                              )}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2.5 border-t border-slate-200/50">
                            <div className="bg-white/80 p-2 rounded-lg border border-slate-100">
                              <span className="text-slate-400 block mb-0.5">나의 제출 결과</span>
                              <span className={`font-bold ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                                {studentAns || "(정답 미입립)"}
                              </span>
                            </div>
                            <div className="bg-white/80 p-2 rounded-lg border border-slate-100">
                              <span className="text-slate-400 block mb-0.5">올바른 문제 정답</span>
                              <span className="font-bold text-indigo-700">
                                {q.correctAnswer}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Active quiz playing interface
  const activePage = quizPages[currentPageIdx];
  const videoId = getEmbedID(activePage?.videoUrl || "");
  const pageAnswers = answersByPage[activePage?.id] || {};

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-scale-up">
      {renderWarningModal()}
      {/* Top indicator of page progress */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-indigo-600 text-white text-xs font-black px-3 py-1 rounded-lg">
            {currentPageIdx + 1} / {quizPages.length}단계
          </span>
          <h2 className="text-base font-bold text-slate-800">{activePage?.title}</h2>
        </div>
        <button
          onClick={() => {
            if (confirm("답안을 모두 임시저장하고 로그인 화면으로 가겠습니까?")) {
              setIsLogged(false);
            }
          }}
          className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
        >
          잠시 로그아웃
        </button>
      </div>

      {/* Progress timeline bar */}
      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
        <div 
          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((currentPageIdx) / quizPages.length) * 100}%` }}
        ></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Video Frame */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-md border border-slate-100 p-5 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              <Play className="w-3.5 h-3.5 fill-indigo-600 text-indigo-600" />
              학습 동영상 시청
            </span>
            <p className="text-xs text-slate-400">아래의 설명 동영상을 처음부터 끝까지 올바르게 정독 시청해 주세요.</p>
          </div>

          {videoId ? (
            <div className="relative aspect-video w-full overflow-hidden bg-slate-900 rounded-2xl border border-slate-200 shadow-inner">
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                title={activePage.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          ) : (
            <div className="aspect-video w-full bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200">
              <Play className="w-12 h-12 mb-2 animate-pulse text-indigo-400" />
              <span className="text-xs font-semibold">선생님이 추가한 교육 영상 파일이 비어 있습니다.</span>
            </div>
          )}
        </div>

        {/* Right Column - Quizzes list */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-md border border-slate-100 p-5 flex flex-col justify-between min-h-[420px]">
          <div className="space-y-5">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">퀴즈 문항 해결</span>
              <p className="text-xs text-slate-400">동영상에서 관찰한 실마리를 적용하여 올바른 정답을 작성하세요.</p>
            </div>

            <div className="space-y-6 max-h-[360px] overflow-y-auto pr-1">
              {activePage?.questions.map((q, qIndex) => {
                const currentAnswer = pageAnswers[q.id] || "";

                return (
                  <div key={q.id} className="space-y-2.5 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="flex items-start gap-1.5">
                      <span className="text-xs font-bold text-indigo-600 font-mono mt-0.5">Q{qIndex + 1}.</span>
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{q.text}</p>
                    </div>

                    {q.type === QuestionType.MULTIPLE_CHOICE ? (
                      <div className="grid grid-cols-1 gap-1.5">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = currentAnswer === opt;
                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleSelectAnswer(q.id, opt)}
                              className={`w-full text-left px-4 py-2.5 text-xs rounded-xl border transition-all flex items-center justify-between ${
                                isSelected 
                                  ? "bg-indigo-50/80 border-indigo-500 font-bold text-indigo-900 ring-2 ring-indigo-500/10" 
                                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/50 hover:border-slate-300"
                              }`}
                              id={`option-${q.id}-${optIdx}`}
                            >
                              <span>{optIdx + 1}. {opt}</span>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={currentAnswer}
                        onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                        placeholder="정확한 단답 키워드를 띄어쓰기 없이 입력하세요."
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-4">
            <button
              onClick={handlePageNext}
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
              id="btn-page-next-submit"
            >
              {isSubmitting ? "전송 처리 중..." : (
                currentPageIdx === quizPages.length - 1 ? "마지막 퀴즈 제출 및 채정 확인" : "문제 제출 및 다음 동영상으로"
              )}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
