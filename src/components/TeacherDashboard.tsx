import React, { useState, useEffect, useRef } from "react";
import { 
  Users, Edit, CheckSquare, QrCode, Award, Plus, Trash2, 
  RefreshCw, ClipboardCopy, Eye, AlertCircle, Play, CheckCircle2, XCircle, Search
} from "lucide-react";
import { QuizPage, Student, StudentSubmission, QuestionType, Question } from "../types.js";

interface TeacherDashboardProps {
  students: Student[];
  quizPages: QuizPage[];
  submissions: StudentSubmission[];
  appUrl: string;
  onUpdateStudents: (students: Student[]) => Promise<void>;
  onUpdateQuiz: (pages: QuizPage[]) => Promise<void>;
  onResetSubmissions: () => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export default function TeacherDashboard({
  students,
  quizPages,
  submissions,
  appUrl,
  onUpdateStudents,
  onUpdateQuiz,
  onResetSubmissions,
  onRefreshData
}: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState<"students" | "quiz" | "answers" | "qrcode" | "scores" | "surveillance">("surveillance");
  const [selectedClassTab, setSelectedClassTab] = useState<number>(1); // Class 1 to 12
  const [studentInput, setStudentInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Custom iframe-safe confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: "danger" | "warning" | "info";
  } | null>(null);

  const triggerConfirm = (options: {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: "danger" | "warning" | "info";
  }) => {
    setConfirmModal(options);
  };

  // Surveillance Filter State
  const [surveillanceFilter, setSurveillanceFilter] = useState<"all" | "online" | "distracted" | "offline" | "completed">("all");

  const [localQuizPages, setLocalQuizPages] = useState<QuizPage[]>(quizPages);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state with parent's quizPages prop only if they actually differ structurally
  useEffect(() => {
    if (JSON.stringify(quizPages) !== JSON.stringify(localQuizPages)) {
      setLocalQuizPages(quizPages);
    }
  }, [quizPages]);

  // Clean up auto-save timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Debounced auto-save (800ms) to allow smooth IME character input
  const debounceSaveQuiz = (updated: QuizPage[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onUpdateQuiz(updated);
      } catch (err) {
        console.error("Auto-save quiz failed:", err);
      }
    }, 800);
  };

  // Immediate save for button clicks (Adding pages, deleting elements, etc.)
  const saveQuizImmediately = async (updated: QuizPage[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setLocalQuizPages(updated);
    try {
      await onUpdateQuiz(updated);
    } catch (err) {
      console.error("Immediate-save quiz failed:", err);
    }
  };

  // Warning text inputs by student id
  const [warnText, setWarnText] = useState<{ [studentId: string]: string }>({});

  // Send real-time remote warning to student
  const handleSendDynamicWarning = async (studentId: string, customMessage?: string) => {
    const message = customMessage || warnText[studentId]?.trim() || "🚨 다른 곳을 탐색하지 말고, 퀴즈 문제 풀이에 전송된 동영상을 정독 시청해 주세요!";
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          warningMessage: message
        })
      });
      if (res.ok) {
        const studentObj = students.find(s => s.id === studentId);
        showToast(`${studentObj ? studentObj.name : "학생"}에게 실시간 원격경고를 성공적으로 보냈습니다.`, "success");
        setWarnText(prev => ({ ...prev, [studentId]: "" }));
        await onRefreshData();
      }
    } catch (err) {
      showToast("경고 전송 중 에러가 발생하였습니다.", "error");
    }
  };

  // Clear remote warning
  const handleClearDynamicWarning = async (studentId: string) => {
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          warningMessage: ""
        })
      });
      if (res.ok) {
        showToast("원격경고가 학생 화면에서 정식 철회되었습니다.", "success");
        await onRefreshData();
      }
    } catch (err) {
      console.error("Warning withdrawal failed:", err);
    }
  };

  // Detail Modal State
  const [selectedSubDetail, setSelectedSubDetail] = useState<StudentSubmission | null>(null);

  // QR Code zoom state
  const [zoomQr, setZoomQr] = useState(false);

  // Show status popup helper
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Batch upload students (with selectedClassTab assigned)
  const handleBatchStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInput.trim()) return;

    setSaving(true);
    // Split by newlines, commas, or spaces
    const names = studentInput
      .split(/[\n,]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0);

    // Preserve all existing students and append new ones (which will naturally preserve other classes too)
    const newClassStudents = names.map((name, idx) => ({
      id: "student_" + selectedClassTab + "_" + Date.now() + "_" + idx,
      name,
      classNumber: selectedClassTab
    }));

    // Combine and preserve previously registered students
    const updatedList = [...students, ...newClassStudents];

    // Remove duplicates based on name inside the same class for integrity
    const uniqueList = updatedList.filter(
      (student, index, self) => 
        self.findIndex(s => s.name === student.name && s.classNumber === student.classNumber) === index
    );

    try {
      await onUpdateStudents(uniqueList);
      setStudentInput("");
      showToast(`${selectedClassTab}반 명단에 새로운 이름들이 성공적으로 추가되었습니다.`);
    } catch (err) {
      showToast("학생 등록에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  // 1-2. File upload CSV/Excel roster parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const processParsedText = async (fileContent: string) => {
      const lines = fileContent.split(/[\r\n]+/);
      const parsedNames: string[] = [];

      // Let's parse rows of columns
      const rows = lines.map(line => {
        return line.split(/[,\t;]+/).map(col => {
          return col.trim().replace(/^["']|["']$/g, "").trim();
        });
      }).filter(cols => cols.length > 0 && cols.some(cell => cell.length > 0));

      if (rows.length === 0) {
        showToast("파일에 데이터가 비어 있습니다.", "error");
        return;
      }

      // 1. Detect if the first row is a header row
      const firstRow = rows[0];
      let nameColIndex = -1;
      let hasHeader = false;

      const headerKeywords = ["이름", "성명", "학생명", "학생", "name", "student", "username"];
      for (let idx = 0; idx < firstRow.length; idx++) {
        const cell = firstRow[idx].replace(/\s+/g, "");
        if (headerKeywords.some(kw => cell.includes(kw))) {
          nameColIndex = idx;
          hasHeader = true;
          break;
        }
      }

      // 2. If no header identified, let's find the best column index
      if (nameColIndex === -1) {
        // Let's count non-numeric cells for each column index up to the first 10 rows
        const colScores: Record<number, number> = {};
        const testRows = rows.slice(0, 10);
        testRows.forEach(row => {
          row.forEach((cell, idx) => {
            if (!cell) return;
            // If it's not a number, give it a score
            if (isNaN(Number(cell))) {
              colScores[idx] = (colScores[idx] || 0) + 1;
              // If it contains Korean characters, give it extra score
              if (/[가-힣]/.test(cell)) {
                colScores[idx] += 2;
              }
            }
          });
        });

        // Find the column index with the highest score
        let bestColIdx = 0;
        let highestScore = -1;
        Object.entries(colScores).forEach(([idxStr, score]) => {
          const idx = parseInt(idxStr, 10);
          if (score > highestScore) {
            highestScore = score;
            bestColIdx = idx;
          }
        });
        nameColIndex = bestColIdx;
      }

      // 3. Extract names using the detected column index
      const startIndex = hasHeader ? 1 : 0;
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (nameColIndex < row.length) {
          const name = row[nameColIndex];
          // Filter out rows that are header-like in case headers exist but weren't skipped, 
          // or numbers, or empty names
          if (name && isNaN(Number(name)) && !headerKeywords.some(kw => name.includes(kw))) {
            parsedNames.push(name);
          }
        } else if (row.length > 0) {
          // Fallback to first column if nameColIndex is out of range for this specific row
          const fallbackName = row[0];
          if (fallbackName && isNaN(Number(fallbackName))) {
            parsedNames.push(fallbackName);
          }
        }
      }

      if (parsedNames.length === 0) {
        showToast("파일에서 학생 이름을 감지해낼 수 없었습니다. (한 줄에 이름 하나가 들어있는 텍스트나 CSV 형식을 장려합니다)", "error");
        return;
      }

      triggerConfirm({
        title: "학생 명단 동기화",
        message: `${selectedClassTab}반 학생 명단을 파일 내용(${parsedNames.length}명)으로 동기화 교체하시겠습니까?`,
        type: "warning",
        onConfirm: async () => {
          const otherClasses = students.filter(s => (s.classNumber ?? 1) !== selectedClassTab);
          const newClassStudents = parsedNames.map((name, idx) => ({
            id: `student_${selectedClassTab}_${Date.now()}_${idx}`,
            name,
            classNumber: selectedClassTab
          }));

          const updated = [...otherClasses, ...newClassStudents];
          try {
            await onUpdateStudents(updated);
            showToast(`${selectedClassTab}반 학생 명단 ${parsedNames.length}명이 새로 반영되었습니다!`, "success");
          } catch {
            showToast("출석부 업로드 등록 중 에러가 발생했습니다.", "error");
          }
        }
      });
      
      // Reset files input so they can re-upload
      if (e.target) e.target.value = "";
    };

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      
      // Checking for replacement char \uFFFD or common broken indicators like "占쏙옙" from EUC-KR in UTF-8
      const hasBrokenChars = text.includes("\uFFFD") || text.includes("占쏙옙");
      const hasKorean = /[가-힣]/.test(text);
      
      if (hasBrokenChars || (!hasKorean && file.name.endsWith(".csv"))) {
        // Fallback retry with EUC-KR decoding for Korean Excel saving format (EUC-KR / CP949)
        const reReader = new FileReader();
        reReader.onload = (reEvent) => {
          const reText = reEvent.target?.result as string;
          processParsedText(reText);
        };
        reReader.readAsText(file, "EUC-KR");
      } else {
        processParsedText(text);
      }
    };

    reader.readAsText(file, "UTF-8");
  };

  // Individual student delete
  const handleDeleteStudent = (id: string) => {
    triggerConfirm({
      title: "학생 삭제",
      message: "이 학생을 명렬에서 삭제하시겠습니까? 관련 데이터가 무효화될 수 있습니다.",
      type: "danger",
      onConfirm: async () => {
        const updated = students.filter(s => s.id !== id);
        try {
          await onUpdateStudents(updated);
          showToast("학생이 일련번호 명단에서 제거되었습니다.");
        } catch {
          showToast("작업 실패", "error");
        }
      }
    });
  };

  // Convert Video URL to preview element
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

  // 2. Add New Page to Quiz
  const handleAddPage = async () => {
    const newPageId = "page_" + Date.now();
    const newPage: QuizPage = {
      id: newPageId,
      title: `${localQuizPages.length + 1}페이지: 신규 영상 및 문제`,
      videoUrl: "https://www.youtube.com/watch?v=SglMAnUj0-k",
      questions: [
        {
          id: "q_" + Date.now() + "_1",
          text: "새로운 질문을 입력해주세요.",
          type: QuestionType.MULTIPLE_CHOICE,
          options: ["선택지 1", "선택지 2", "선택지 3", "선택지 4"],
          correctAnswer: "선택지 1",
          points: 10
        }
      ]
    };

    const updated = [...localQuizPages, newPage];
    try {
      await saveQuizImmediately(updated);
      showToast("새로운 퀴즈 페이지가 생성되었습니다!");
    } catch {
      showToast("페이지 추가 실패", "error");
    }
  };

  // Delete a Page from quiz
  const handleDeletePage = (pageId: string) => {
    if (localQuizPages.length <= 1) {
      alert("최소 1개의 퀴즈 페이지가 존재해야 합니다.");
      return;
    }
    triggerConfirm({
      title: "학습 페이지 삭제",
      message: "해당 단원 수준 페이지를 완전히 삭제하시겠습니까?",
      type: "danger",
      onConfirm: async () => {
        const updated = localQuizPages.filter(p => p.id !== pageId);
        // Re-index remaining page titles if they have standard numbers
        const finalPages = updated.map((p, idx) => {
          if (p.title.includes("페이지: ")) {
            const textParts = p.title.split("페이지: ");
            return {
              ...p,
              title: `${idx + 1}페이지: ${textParts.slice(1).join("페이지: ")}`
            };
          }
          return p;
        });

        try {
          await saveQuizImmediately(finalPages);
          showToast("학습 페이지를 제거했습니다.");
        } catch {
          showToast("작업 실패", "error");
        }
      }
    });
  };

  // Update Page Title or Video URL
  const handleUpdatePageField = (pageId: string, field: "title" | "videoUrl", value: string) => {
    const updated = localQuizPages.map(p => {
      if (p.id === pageId) {
        return { ...p, [field]: value };
      }
      return p;
    });
    setLocalQuizPages(updated);
    debounceSaveQuiz(updated);
  };

  // Add Question to a Page
  const handleAddQuestionToPage = async (pageId: string) => {
    const updated = localQuizPages.map(p => {
      if (p.id === pageId) {
        const newQ: Question = {
          id: "q_" + Date.now(),
          text: "지문 질문 내용을 적어주세요.",
          type: QuestionType.MULTIPLE_CHOICE,
          options: ["선택지 A", "선택지 B", "선택지 C", "선택지 D"],
          correctAnswer: "선택지 A",
          points: 10
        };
        return {
          ...p,
          questions: [...p.questions, newQ]
        };
      }
      return p;
    });
    await saveQuizImmediately(updated);
    showToast("새 문항이 하단에 추가되었습니다.");
  };

  // Delete Question
  const handleDeleteQuestion = (pageId: string, qId: string) => {
    const page = localQuizPages.find(p => p.id === pageId);
    if (page && page.questions.length <= 1) {
      alert("각 학습 페이지는 최소 1개 이상의 문항을 지녀야 합니다.");
      return;
    }
    triggerConfirm({
      title: "문제 문항 삭제",
      message: "해당 문제를 삭제할까요?",
      type: "danger",
      onConfirm: async () => {
        const updated = localQuizPages.map(p => {
          if (p.id === pageId) {
            return {
              ...p,
              questions: p.questions.filter(q => q.id !== qId)
            };
          }
          return p;
        });
        await saveQuizImmediately(updated);
        showToast("문제가 정상적으로 제외되었습니다.");
      }
    });
  };

  // Update specific question field
  const handleUpdateQuestion = (pageId: string, qId: string, fields: Partial<Question>, immediate = false) => {
    const updated = localQuizPages.map(p => {
      if (p.id === pageId) {
        return {
          ...p,
          questions: p.questions.map(q => {
            if (q.id === qId) {
              const base = { ...q, ...fields };
              // if changing type, clean up or set defaults
              if (fields.type) {
                if (fields.type === QuestionType.SHORT_ANSWER) {
                  base.options = [];
                  base.correctAnswer = "";
                } else {
                  base.options = ["예시 1", "예시 2", "예시 3", "예시 4"];
                  base.correctAnswer = "예시 1";
                }
              }
              return base;
            }
            return q;
          })
        };
      }
      return p;
    });

    setLocalQuizPages(updated);
    if (immediate || fields.type !== undefined || fields.points !== undefined) {
      saveQuizImmediately(updated);
    } else {
      debounceSaveQuiz(updated);
    }
  };

  // Copy registration link
  const copyStudentLink = () => {
    const link = `${appUrl}?mode=student`;
    navigator.clipboard.writeText(link);
    showToast("접속용 URL 링크가 클립보드에 복사되었습니다!");
  };

  // Real Submissions calculation helper
  const getSubDetailsByStudent = (studentId: string) => {
    return submissions.find(s => s.studentId === studentId);
  };

  // Total possible quiz score
  const totalMaxPoints = localQuizPages.reduce((acc, p) => acc + p.questions.reduce((qAcc, q) => qAcc + (q.points || 0), 0), 0);

  // Class Stats values
  const completedSubs = submissions.filter(s => s.isCompleted);
  const averageScore = completedSubs.length > 0 
    ? Math.round(completedSubs.reduce((acc, s) => acc + s.score, 0) / completedSubs.length)
    : 0;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl scale-100 transition-all font-medium border border-slate-700 animate-slide-in">
          <CheckCircle2 className={`w-5 h-5 ${toast.type === "success" ? "text-emerald-400" : "text-rose-400"}`} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Teacher Station Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-slate-900 text-white px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-indigo-500/30 text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-400/20">
              교사 제어판 (Teacher Mode)
            </span>
            <span className="text-slate-400 text-xs font-mono">PIN: 1234 LOCKED</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">수업 영상 & 단계별 퀴즈 관리기</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={async () => {
              await onRefreshData();
              showToast("실시간 점수 및 학습 현황이 갱신되었습니다.");
            }}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 transition px-3.5 py-2.5 rounded-lg border border-white/10 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            현황 새로고침
          </button>
        </div>
      </div>

      {/* Statistics Dashboard Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-8 py-5 bg-slate-50 border-b border-slate-100 text-slate-700">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">등록 학생 수</div>
            <div className="text-lg font-bold text-slate-800">{students.length}명</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <Edit className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium font-sans">퀴즈 페이지 수</div>
            <div className="text-lg font-bold text-slate-800">{localQuizPages.length}단계 (종 장)</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">제출 완료 학생</div>
            <div className="text-lg font-bold text-emerald-600 font-mono">
              {completedSubs.length}명 <span className="text-xs text-slate-400 font-normal">/ {students.length}명</span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium font-sans">제출자 평균 점수</div>
            <div className="text-lg font-bold text-slate-800">
              {averageScore}점 <span className="text-xs text-slate-400 font-normal">/ {totalMaxPoints}점</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200 overflow-x-auto bg-white sticky top-0 z-10 scrollbar-none">
        <button
          onClick={() => setActiveTab("surveillance")}
          className={`flex items-center gap-2 px-6 py-4.5 border-b-2 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "surveillance"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/20 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
          id="tab-surveillance"
        >
          <Eye className={`w-4 h-4 text-emerald-500 ${activeTab === "surveillance" ? "animate-pulse" : ""}`} />
          실시간 학생 화면 감시 🖥️
        </button>
        <button
          onClick={() => setActiveTab("scores")}
          className={`flex items-center gap-2 px-6 py-4.5 border-b-2 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "scores"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/20 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
          id="tab-scores"
        >
          <Award className="w-4 h-4" />
          실시간 학생 성적 조회
        </button>
        <button
          onClick={() => setActiveTab("students")}
          className={`flex items-center gap-2 px-6 py-4.5 border-b-2 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "students"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/20 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
          id="tab-students"
        >
          <Users className="w-4 h-4" />
          학생 명렬 입력/관리
        </button>
        <button
          onClick={() => setActiveTab("quiz")}
          className={`flex items-center gap-2 px-6 py-4.5 border-b-2 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "quiz"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/20 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
          id="tab-quiz"
        >
          <Edit className="w-4 h-4" />
          퀴즈 양식 및 동영상 수정
        </button>
        <button
          onClick={() => setActiveTab("answers")}
          className={`flex items-center gap-2 px-6 py-4.5 border-b-2 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "answers"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/20 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
          id="tab-answers"
        >
          <CheckSquare className="w-4 h-4" />
          정답 및 배점 설정
        </button>
        <button
          onClick={() => setActiveTab("qrcode")}
          className={`flex items-center gap-2 px-6 py-4.5 border-b-2 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "qrcode"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/20 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
          id="tab-qrcode"
        >
          <QrCode className="w-4 h-4" />
          학생용 QR코드 및 접속 안내
        </button>
      </div>

      {/* Main Tab Area */}
      <div className="p-8">
        
        {/* TAB 0: Realtime Student Surveillance CCTV Dashboard */}
        {activeTab === "surveillance" && (() => {
          // Get live list of kids for the SELECTED CLASS and their statuses
          const activeStudentList = students
            .filter(student => (student.classNumber ?? 1) === selectedClassTab)
            .map((student) => {
              const sub = submissions.find(s => s.studentId === student.id);
              const isOnline = sub && sub.lastActiveTime 
                ? (Date.now() - new Date(sub.lastActiveTime).getTime() < 12000) // Online within last 12 seconds
                : false;
              const isCompleted = sub?.isCompleted || false;
              const tabFocused = sub?.tabFocused !== false; // default true if not recorded yet
              const tabSwitches = sub?.tabSwitchesCount || 0;
              const activePageIndex = sub?.currentPageIndex || 0;
              const draftAnswers = sub?.currentDraftAnswers || {};
              const warningMessage = sub?.warningMessage || "";
  
              return {
                ...student,
                sub,
                isOnline,
                isCompleted,
                tabFocused,
                tabSwitches,
                activePageIndex,
                draftAnswers,
                warningMessage
              };
            });
  
          // Apply chosen filter
          const filteredStudentsForLive = activeStudentList.filter(student => {
            if (surveillanceFilter === "online") {
              return student.isOnline && !student.isCompleted;
            }
            if (surveillanceFilter === "distracted") {
              return student.isOnline && (!student.tabFocused || student.tabSwitches > 0);
            }
            if (surveillanceFilter === "offline") {
              return !student.isOnline && !student.isCompleted;
            }
            if (surveillanceFilter === "completed") {
              return student.isCompleted;
            }
            return true; // "all"
          });
  
          return (
            <div className="space-y-6">
              {/* Classroom Quick Selector in Surveillance */}
              <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center justify-between gap-4 border border-slate-200">
                <span className="text-xs font-bold text-slate-500 pl-2 hidden md:inline shrink-0">👀 실시간 감시 학급 선택</span>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-center flex-1">
                  {[...Array(12)].map((_, i) => {
                    const classNum = i + 1;
                    const countClass = students.filter(s => (s.classNumber ?? 1) === classNum).length;
                    const isSelected = selectedClassTab === classNum;
                    return (
                      <button
                        key={classNum}
                        onClick={() => setSelectedClassTab(classNum)}
                        className={`py-1.5 px-1 rounded-xl text-xs font-black transition-all ${
                          isSelected
                            ? "bg-slate-850 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {classNum}반 ({countClass})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
                {/* Scan effect lines */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-505 via-emerald-400 to-indigo-505 opacity-60 animate-pulse" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <h2 className="text-xl font-extrabold text-slate-100 font-sans tracking-tight">
                        {selectedClassTab}반 실시간 원격 감시 콘솔 (Live CCTV)
                      </h2>
                    </div>
                    <p className="text-slate-400 text-xs">
                      학생 기기에서 전송하는 진행 구역 및 실시간 정답안을 미러링합니다. 브라우저 창 이탈 경고 및 원격 메시지 발송 기능이 우측 하단에서 제공됩니다.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700">
                    <button
                      onClick={() => setSurveillanceFilter("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        surveillanceFilter === "all" 
                          ? "bg-indigo-600 text-white shadow-md" 
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      전체 ({activeStudentList.length})
                    </button>
                    <button
                      onClick={() => setSurveillanceFilter("online")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        surveillanceFilter === "online" 
                          ? "bg-emerald-600 text-white shadow-md animate-pulse" 
                          : "text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      접속 중 ({activeStudentList.filter(s => s.isOnline && !s.isCompleted).length})
                    </button>
                    <button
                      onClick={() => setSurveillanceFilter("distracted")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        surveillanceFilter === "distracted" 
                          ? "bg-rose-600 text-white shadow-md" 
                          : "text-slate-400 hover:text-rose-300"
                      }`}
                    >
                      딴짓 감지 ({activeStudentList.filter(s => s.isOnline && (!s.tabFocused || s.tabSwitches > 0)).length})
                    </button>
                    <button
                      onClick={() => setSurveillanceFilter("offline")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        surveillanceFilter === "offline" 
                          ? "bg-slate-700 text-white shadow-md" 
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      미접속 ({activeStudentList.filter(s => !s.isOnline && !s.isCompleted).length})
                    </button>
                    <button
                      onClick={() => setSurveillanceFilter("completed")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        surveillanceFilter === "completed" 
                          ? "bg-blue-600 text-white shadow-md" 
                          : "text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      제출 완료 ({activeStudentList.filter(s => s.isCompleted).length})
                    </button>
                  </div>
                </div>

                {/* Status summary tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800 text-xs">
                  <div className="bg-slate-850 p-3 rounded-2xl border border-slate-800/80">
                    <span className="text-slate-500 block">수업 원격 중계</span>
                    <span className="text-slate-200 font-extrabold text-sm mt-0.5">상시 연결 상태</span>
                  </div>
                  <div className="bg-slate-850 p-3 rounded-2xl border border-slate-800/80">
                    <span className="text-slate-500 block">집중 상태 리포트</span>
                    <span className={`font-extrabold text-sm mt-0.5 flex items-center gap-1.5 ${
                      activeStudentList.some(s => s.isOnline && !s.tabFocused) ? "text-rose-400 animate-pulse" : "text-emerald-400"
                    }`}>
                      {activeStudentList.some(s => s.isOnline && !s.tabFocused) ? "🚨 주의 요망 (화면이탈 존재)" : "🟢 특이사항 없음"}
                    </span>
                  </div>
                  <div className="bg-slate-850 p-3 rounded-2xl border border-slate-800/80">
                    <span className="text-slate-500 block">학급 평균 단계</span>
                    <span className="text-slate-200 font-extrabold text-sm mt-0.5">
                      {students.length > 0 ? (activeStudentList.reduce((acc, s) => acc + s.activePageIndex + 1, 0) / students.length).toFixed(1) : 0}단계
                    </span>
                  </div>
                  <div className="bg-slate-850 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 block">통신 갱신 주기</span>
                      <span className="text-slate-400 font-mono text-[9px]">3.0초 자동 갱신 중</span>
                    </div>
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                  </div>
                </div>
              </div>

              {/* List and CCTV grid */}
              {filteredStudentsForLive.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                  <Eye className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-bold text-sm">해당 검색 필터 조건의 학생이 존재하지 않습니다.</p>
                  <p className="text-slate-400 text-xs mt-1">학생들이 교실 링크나 QR코드를 스캔해 로그인하도록 지도해 주세요.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredStudentsForLive.map((item, idx) => {
                    const correspondingPage = localQuizPages[item.activePageIndex];
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`relative bg-slate-900 border-2 rounded-2xl shadow-xl overflow-hidden flex flex-col transition-all duration-305 ${
                          !item.isOnline 
                            ? "border-slate-800 bg-opacity-70" 
                            : !item.tabFocused 
                              ? "border-rose-500 ring-4 ring-rose-500/20 shadow-rose-950/15" 
                              : "border-indigo-950 hover:border-indigo-700"
                        }`}
                      >
                        {/* Browser Mockup Top Header */}
                        <div className="bg-slate-850 px-3 py-2.5 flex items-center justify-between border-b border-slate-850">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block" />
                            <span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block" />
                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[150px] ml-2 font-semibold">
                            {item.name} • {item.isCompleted ? "학습종료" : `단계 ${item.activePageIndex + 1}`}
                          </span>
                          
                          <div className="shrink-0">
                            {item.isOnline ? (
                              <span className="text-[9px] font-extrabold bg-emerald-950 border border-emerald-900 text-emerald-400 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full inline-block"></span>
                                LIVE
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                                OFFLINE
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Screen emulation inside panel */}
                        <div className="p-4 bg-slate-950 min-h-[220px] flex-1 flex flex-col justify-between relative">
                          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(18,24,38,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none" />

                          {/* Status notification row */}
                          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-900 z-10 relative">
                            <span className="text-[10px] text-slate-500 font-mono">CHANNEL #{idx + 1}</span>
                            <div>
                              {item.isCompleted ? (
                                <span className="text-[9px] font-bold text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded">
                                  🏆 최종 답안 제출 완료
                                </span>
                              ) : !item.isOnline ? (
                                <span className="text-[9px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
                                  오프라인 (대기)
                                </span>
                              ) : !item.tabFocused ? (
                                <span className="text-[9px] text-rose-400 font-extrabold bg-rose-950/80 px-2.5 py-0.5 rounded animate-pulse border border-rose-900">
                                  ⚠️ 경보: 다른 창 구경 감지!
                                </span>
                              ) : (
                                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-900">
                                  🟢 정상 (화면 주시 중)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Emulated Viewport Content */}
                          <div className="py-2.5 flex-1 flex flex-col justify-center space-y-3 z-10 relative">
                            {item.isCompleted ? (
                              <div className="text-center p-3 bg-indigo-950/20 rounded-xl border border-indigo-900/30">
                                <Award className="w-7 h-7 text-amber-400 mx-auto mb-1 animate-bounce" />
                                <p className="text-[11px] font-bold text-slate-300">단계 완료 성적표</p>
                                <p className="text-sm font-black font-mono text-amber-300 mt-0.5">{item.sub?.score}점 / {item.sub?.totalPoints}점</p>
                              </div>
                            ) : !item.isOnline ? (
                              <div className="text-center py-4">
                                <p className="text-[10px] text-slate-600 font-mono">무선 기기 신호 대기 중</p>
                                <p className="text-[11px] text-slate-500 mt-1">학생이 로그인하면 미러링이 활성화됩니다.</p>
                              </div>
                            ) : (
                              <div className="space-y-2 text-[11px] text-slate-300 text-left">
                                <div className="bg-slate-900/80 rounded p-1.5 border border-slate-850">
                                  <span className="text-[9px] text-slate-500 block mb-0.5">현재 시청 비디오 위치</span>
                                  <span className="font-bold text-[10px] text-indigo-300 truncate block">
                                    {correspondingPage ? `${item.activePageIndex + 1}단계: ${correspondingPage.title}` : `퀴즈 로딩 중`}
                                  </span>
                                </div>

                                <div className="bg-slate-900/80 rounded p-2 border border-slate-850 space-y-1.5">
                                  <span className="text-[9px] text-slate-500 block border-b border-slate-850 pb-0.5">실시간 작성 중인 정답 (미리보기)</span>
                                  {correspondingPage && correspondingPage.questions.length > 0 ? (
                                    <div className="space-y-1">
                                      {correspondingPage.questions.map((q, qIndex) => {
                                        const ansVal = item.draftAnswers[q.id];
                                        return (
                                          <div key={q.id} className="flex justify-between items-center text-[9px] font-mono">
                                            <span className="text-slate-400 truncate max-w-[120px]">{qIndex + 1}번. {q.text}</span>
                                            {ansVal ? (
                                              <span className="text-emerald-400 font-extrabold truncate max-w-[100px] bg-emerald-950 px-1.5 py-0.2 rounded">
                                                필기: {ansVal}
                                              </span>
                                            ) : (
                                              <span className="text-slate-600 italic">미입력</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-[9px] text-slate-600 italic">문항 분석 대기 중</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Extra suspicious telemetry info */}
                          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] font-mono text-slate-500 z-10 relative">
                            <span className="flex items-center gap-1">
                              화면 이탈 이력: 
                              <span className={`font-bold ${item.tabSwitches > 0 ? "text-rose-400" : "text-slate-400"}`}>
                                {item.tabSwitches}회
                              </span>
                            </span>
                            <span>
                              {item.sub ? (
                                `수신: ${new Date(item.sub.lastActiveTime || item.sub.submittedAt).toLocaleTimeString("ko-KR", { hour12: false })}`
                              ) : "데이터 없음"}
                            </span>
                          </div>
                        </div>

                        {/* Interactive remote warnings controller footer bar */}
                        {item.isOnline && !item.isCompleted && (
                          <div className="bg-slate-850 p-2 border-t border-slate-800 flex flex-col gap-1.5 z-20 relative">
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                placeholder="원격 경고 기입 (예: 집중하세요!)"
                                value={warnText[item.id] || ""}
                                onChange={(e) => setWarnText(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white placeholder-slate-500 flex-1 focus:outline-none focus:border-rose-500"
                              />
                              <button
                                onClick={() => handleSendDynamicWarning(item.id)}
                                className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold px-3 py-1 rounded text-[10px] transition shrink-0 flex items-center gap-1"
                                id={`btn-send-warning-${item.id}`}
                              >
                                경고
                              </button>
                            </div>
                            {item.warningMessage && (
                              <div className="bg-rose-950/40 border border-rose-900/60 px-2 py-1 rounded flex items-center justify-between text-[10px]">
                                <span className="text-rose-300 truncate max-w-[180px]">
                                  송출 중: "{item.warningMessage}"
                                </span>
                                <button
                                  onClick={() => handleClearDynamicWarning(item.id)}
                                  className="text-[9px] text-slate-400 hover:text-slate-200 border border-slate-700 px-1 py-0.2 rounded font-bold transition shrink-0"
                                >
                                  회수
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 1: Realtime Scores Dashboard */}
        {activeTab === "scores" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">학급별 퀴즈 성적표 & 응시 수집 현황</h2>
                <p className="text-slate-500 text-xs mt-1">학생들이 실시간으로 문제를 풀어나가는 진행 현황 및 성적 차트입니다. (3초 자동 갱신 중)</p>
              </div>
              <button
                onClick={() => {
                  triggerConfirm({
                    title: "성적 데이터 초기화",
                    message: "정말로 전체 학생의 현재 모든 퀴즈 풀이 결과 및 제출 점수를 삭제(초기화)하시겠습니까? 학생들은 처음부터 다시 해결해야 합니다.",
                    type: "danger",
                    onConfirm: async () => {
                      await onResetSubmissions();
                      showToast("성공적으로 성적표가 초기화되었습니다.");
                    }
                  });
                }}
                className="bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 px-4 py-2 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 self-start sm:self-center transition"
                id="btn-reset-subs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                성적 전체 데이터 초기화
              </button>
            </div>

            {/* Class Tabs (1 to 12) for Scores */}
            <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1 text-center">
                {[...Array(12)].map((_, i) => {
                  const classNum = i + 1;
                  const countClass = students.filter(s => (s.classNumber ?? 1) === classNum).length;
                  const isSelected = selectedClassTab === classNum;
                  return (
                    <button
                      key={classNum}
                      onClick={() => setSelectedClassTab(classNum)}
                      className={`py-1.5 px-1 rounded-xl text-xs font-black transition-all ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {classNum}반 ({countClass}명)
                    </button>
                  );
                })}
              </div>
            </div>

            {students.filter(s => (s.classNumber ?? 1) === selectedClassTab).length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">{selectedClassTab}반에 등록된 학생 목록이 비어있습니다.</p>
                <p className="text-slate-400 text-xs mt-1">학생 명렬 입력 탭에서 학급 인원의 성명을 먼저 입력해 주세요.</p>
                <button
                  onClick={() => setActiveTab("students")}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
                >
                  명렬 입력 바로가기
                </button>
              </div>
            ) : (
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                      <th className="px-6 py-4">학생 성명</th>
                      <th className="px-6 py-4">응시 상태</th>
                      <th className="px-6 py-4">진행 현황</th>
                      <th className="px-6 py-4">최종 취득 점수</th>
                      <th className="px-6 py-4">가장 최근 제출 시각</th>
                      <th className="px-6 py-4 text-right">상세 채점 내역</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {students
                      .filter((s) => (s.classNumber ?? 1) === selectedClassTab)
                      .map((student) => {
                      const sub = getSubDetailsByStudent(student.id);
                      
                      let statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded-full">
                          미참여
                        </span>
                      );
                      
                      let progressPercent = 0;
                      let progressText = "응시 전";

                      if (sub) {
                        if (sub.isCompleted) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
                              최종 제출 완료
                            </span>
                          );
                          progressPercent = 100;
                          progressText = "완료";
                        } else {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full border border-amber-200">
                              문제 풀이 중
                            </span>
                          );
                          // current page index is 0-based
                          const currentStep = (sub.currentPageIndex || 0) + 1;
                          progressPercent = Math.round((currentStep / localQuizPages.length) * 100);
                          progressText = `${currentStep}/${localQuizPages.length}페이지 해결중`;
                        }
                      }

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4 font-semibold text-slate-800">{student.name}</td>
                          <td className="px-6 py-4">{statusBadge}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3 max-w-xs">
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-500 ${
                                    progressPercent === 100 ? "bg-emerald-500" : "bg-indigo-500"
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{progressText}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold">
                            {sub ? (
                              <span className="text-slate-800">
                                {sub.score} <span className="text-slate-400 font-normal">/ {sub.totalPoints}점</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {sub ? new Date(sub.submittedAt).toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "-"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {sub ? (
                              <button
                                onClick={() => setSelectedSubDetail(sub)}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 py-1.5 px-3 rounded-lg transition"
                                id={`btn-detail-${student.id}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                답안상세
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">내역 없음</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Students List Management (Classes 1-12 Tabs and File Uploaders) */}
        {activeTab === "students" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">학급별 학생 명렬 관리 (1반 ~ 12반)</h2>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                각 반의 탭을 클릭한 뒤, CSV나 텍스트 파일을 업로드하거나 이름을 직접 부가하여 학급 명부를 완성하세요. 
                학생들은 로그인 시 자신이 해당하는 반 탭을 누른 후 성명을 클릭하여 퀴즈방에 접속하게 됩니다.
              </p>
            </div>

            {/* Class Tabs (1 to 12) */}
            <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1 text-center">
                {[...Array(12)].map((_, i) => {
                  const classNum = i + 1;
                  const count = students.filter(s => (s.classNumber ?? 1) === classNum).length;
                  const isSelected = selectedClassTab === classNum;
                  return (
                    <button
                      key={classNum}
                      onClick={() => setSelectedClassTab(classNum)}
                      className={`py-2 px-1.5 rounded-xl text-xs font-black transition-all duration-155 flex flex-col items-center justify-center gap-0.5 ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <span>{classNum}반</span>
                      <span className={`text-[9px] px-1 py-0.2 rounded ${isSelected ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 text-slate-500"}`}>
                        {count}명
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Box 1: File Uploader and Manual Input Form */}
              <div className="space-y-6">
                {/* A. File Upload Card */}
                <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center space-y-4 shadow-sm hover:border-indigo-400 transition-all">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mx-auto">
                    <RefreshCw className="w-6 h-6 animate-spin-slow" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800">{selectedClassTab}반 명렬 파일 일괄 등록</h3>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      엑셀에서 다른 이름으로 저장한 <strong>.csv</strong> 파일이나 <strong>.txt</strong> 텍스트 문서를 드래그하거나 선택하세요.
                    </p>
                  </div>
                  
                  <div>
                    <label 
                      htmlFor="csv-file-input"
                      className="inline-block cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 text-xs rounded-xl transition duration-150 shadow-md shadow-indigo-600/10"
                    >
                      로스터 파일 선택 (.csv / .txt)
                    </label>
                    <input 
                      type="file"
                      id="csv-file-input"
                      accept=".csv, .txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  <div className="bg-white/80 rounded-xl p-3 border border-indigo-100/40 text-[10px] text-indigo-600 text-left space-y-1 font-sans">
                    <p>💡 <strong>한글 글자깨짐 100% 방지 기능 작동 중</strong></p>
                    <p>EUC-KR(한국형 표준 엑셀 저장 타입) 및 UTF-8 방식을 스스로 감지하여 자모 깨짐 없이 학생들의 실명을 매끄럽게 추출합니다.</p>
                  </div>
                </div>

                {/* B. Paste Batch Text Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-indigo-500" />
                    {selectedClassTab}반 직접 이름 추가
                  </h3>
                  <form onSubmit={handleBatchStudents} className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1.5">이름 목록 기입 (줄바꿈 또는 콤마로 구분)</label>
                      <textarea
                        value={studentInput}
                        onChange={(e) => setStudentInput(e.target.value)}
                        placeholder="김도현&#10;정재우, 박민지&#10;한보람"
                        rows={5}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      ></textarea>
                    </div>
                    <button
                      type="submit"
                      disabled={saving || !studentInput.trim()}
                      className="w-full bg-slate-850 hover:bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold transition disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {saving ? "등록 저장 중..." : `${selectedClassTab}반 명단에 추가`}
                    </button>
                  </form>
                </div>
              </div>

              {/* Box 2: Visual Lists */}
              <div className="lg:col-span-2 border border-slate-200 rounded-2xl p-5 bg-white shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        {selectedClassTab}반 배정 학생 목록 (
                        {students.filter(s => (s.classNumber ?? 1) === selectedClassTab).length}명)
                      </h3>
                      <p className="text-[11px] text-slate-400">전체 등록 학생: {students.length}명</p>
                    </div>
                    {students.length > 0 && (
                      <button
                        onClick={() => {
                          triggerConfirm({
                            title: "전체 학생 데이터 초기화",
                            message: `정말로 모든 반의 통합 학생 데이터(${students.length}명)를 영구 삭제(초기화)하시겠습니까? 관련 풀이 이력과 성적이 모두 유실될 수 있습니다.`,
                            type: "danger",
                            onConfirm: async () => {
                              await onUpdateStudents([]);
                              showToast("전체 등록부 데이터가 초기화되었습니다.");
                            }
                          });
                        }}
                        className="text-xs text-rose-500 hover:text-rose-700 font-bold"
                      >
                        전체 학생 초기화
                      </button>
                    )}
                  </div>

                  {students.filter(s => (s.classNumber ?? 1) === selectedClassTab).length === 0 ? (
                    <div className="text-center py-24 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-slate-400 text-xs">현재 {selectedClassTab}반에 등록된 학생 이름이 없습니다.</p>
                      <p className="text-slate-400 text-[10px] mt-1.5">왼쪽의 파일 업로드나 텍스트 대량 쓰기 도구를 활용해 등록해 주세요.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-2">
                      {students
                        .filter(s => (s.classNumber ?? 1) === selectedClassTab)
                        .map((student, idx) => (
                          <div 
                            key={student.id}
                            className="flex items-center justify-between bg-slate-50 border border-slate-150 px-3 py-2.5 rounded-xl hover:border-indigo-200 transition"
                          >
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span className="text-[10px] text-slate-400 font-mono font-bold leading-none">{idx + 1}</span>
                              <span className="text-xs font-bold text-slate-700 truncate leading-none">{student.name}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="text-slate-400 hover:text-rose-600 rounded p-1 hover:bg-rose-50 transition"
                              id={`btn-del-stud-${student.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                
                <div className="pt-4 border-t border-slate-100 mt-4 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>정상 매칭 출석 관리 패널</span>
                  <span className="text-slate-300 font-mono">CLASS_DB_STAGE: v1.1</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Edit Quiz template layout */}
        {activeTab === "quiz" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">퀴즈 양식 구성 및 학습 동영상 편집</h2>
                <p className="text-slate-500 text-xs">수업에 사용되는 단계별 동영상 링크와 해당 단계에서 풀어볼 질문들을 수정/추가합니다.</p>
              </div>
              <button
                onClick={handleAddPage}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 transition self-start sm:self-center"
                id="btn-add-page"
              >
                <Plus className="w-4 h-4" />
                새 퀴즈 페이지 추가 (영상+질문 세트)
              </button>
            </div>

            <div className="space-y-8">
              {localQuizPages.map((page, pIdx) => {
                const vidId = getEmbedID(page.videoUrl);
                return (
                  <div key={page.id} className="border border-indigo-100 rounded-2xl bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                    {/* Page header */}
                    <div className="bg-indigo-50/50 px-6 py-4 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="bg-indigo-600 text-white font-bold text-xs px-2.5 py-1 rounded-md">
                          {pIdx + 1}단계 페이지
                        </span>
                        <input
                          type="text"
                          value={page.title}
                          onChange={(e) => handleUpdatePageField(page.id, "title", e.target.value)}
                          className="bg-transparent font-bold text-slate-800 focus:bg-white border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none flex-1 max-w-sm rounded"
                          placeholder="페이지의 타이틀을 기입하세요."
                        />
                      </div>
                      <button
                        onClick={() => handleDeletePage(page.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition self-end sm:self-center flex items-center gap-1 text-xs font-semibold"
                        id={`btn-del-page-${page.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        페이지 삭제
                      </button>
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Video configuration */}
                      <div className="lg:col-span-5 space-y-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-600 uppercase">동영상 시청 유튜브 링크</label>
                          <input
                            type="text"
                            value={page.videoUrl}
                            onChange={(e) => handleUpdatePageField(page.id, "videoUrl", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-indigo-700"
                            placeholder="예: https://www.youtube.com/watch?v=SglMAnUj0-k"
                          />
                        </div>

                        {/* Video Frame Preview */}
                        <div>
                          <div className="text-xs text-slate-400 mb-1.5 font-medium">동영상 재생 미리보기</div>
                          {vidId ? (
                            <div className="relative aspect-video w-full overflow-hidden bg-slate-900 rounded-xl border border-slate-200">
                              <iframe
                                className="absolute inset-0 w-full h-full"
                                src={`https://www.youtube.com/embed/${vidId}`}
                                title="YouTube Video Preview"
                                allowFullScreen
                              ></iframe>
                            </div>
                          ) : (
                            <div className="aspect-video w-full bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200">
                              <Play className="w-8 h-8 mb-2" />
                              <span className="text-xs">유효한 유튜브 주소를 입력하시면</span>
                              <span className="text-xs">플레이어가 렌더링됩니다.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Questions list for inside this page */}
                      <div className="lg:col-span-7 space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-600 uppercase">
                            해당 비디오 문제 목록 ({page.questions.length}개)
                          </label>
                          <button
                            onClick={() => handleAddQuestionToPage(page.id)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                            id={`btn-add-q-${page.id}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            문제 추가
                          </button>
                        </div>

                        <div className="space-y-4">
                          {page.questions.map((q, qIdx) => (
                            <div key={q.id} className="p-4 bg-slate-50/60 border border-slate-200 rounded-xl space-y-3">
                              {/* Question heading row */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-indigo-700">Q{qIdx + 1}</span>
                                  <select
                                    value={q.type}
                                    onChange={(e) => handleUpdateQuestion(page.id, q.id, { type: e.target.value as QuestionType })}
                                    className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                                  >
                                    <option value={QuestionType.MULTIPLE_CHOICE}>객관식</option>
                                    <option value={QuestionType.SHORT_ANSWER}>주관식 단답형</option>
                                  </select>
                                </div>
                                <button
                                  onClick={() => handleDeleteQuestion(page.id, q.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Question Text */}
                              <input
                                type="text"
                                value={q.text}
                                onChange={(e) => handleUpdateQuestion(page.id, q.id, { text: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="질문을 입력하세요."
                              />

                              {/* Question Options for MULTIPLE CHOICE */}
                              {q.type === QuestionType.MULTIPLE_CHOICE && (
                                <div className="space-y-2">
                                  <div className="text-[10px] uppercase font-bold text-slate-400">선택지 수정 및 입력</div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {(q.options || []).map((opt, optIdx) => (
                                      <div key={optIdx} className="flex items-center gap-1">
                                        <span className="text-xs text-slate-400 font-mono font-bold">{(optIdx + 1)}</span>
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) => {
                                            const newOpts = [...q.options];
                                            newOpts[optIdx] = e.target.value;
                                            
                                            // Handle correct answer update if match was found
                                            let correct = q.correctAnswer;
                                            if (q.correctAnswer === opt) {
                                              correct = e.target.value;
                                            }
                                            handleUpdateQuestion(page.id, q.id, { options: newOpts, correctAnswer: correct });
                                          }}
                                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: Set Correct answers and weights */}
        {activeTab === "answers" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">퀴즈 정답지 설정 및 점수 배점 변경</h2>
              <p className="text-slate-500 text-xs">각 개별 질문에 대한 자동 채점용 정답을 입력하고 문항 난이도에 알맞은 배점을 지정해주십시오.</p>
            </div>

            <div className="space-y-6">
              {localQuizPages.map((page, pIdx) => (
                <div key={page.id} className="border border-slate-200 rounded-xl bg-white p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2.5 border-b border-slate-100">
                    <span className="bg-indigo-50 text-indigo-700 text-xs font-extrabold px-2 py-0.5 rounded">
                      {pIdx + 1}단계 페이지
                    </span>
                    {page.title}
                  </h3>

                  <div className="divide-y divide-slate-100">
                    {page.questions.map((q, qIdx) => (
                      <div key={q.id} className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-slate-400 text-xs font-semibold">Q{qIdx+1}</span>
                            <span className={`text-[10px] px-2 py-0.5 font-bold rounded ${
                              q.type === QuestionType.MULTIPLE_CHOICE ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {q.type === QuestionType.MULTIPLE_CHOICE ? "객관식" : "주관식 단답형"}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-700 leading-snug">{q.text}</p>
                        </div>

                        {/* Correct Answer Input */}
                        <div className="md:col-span-4">
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">정답 지정</label>
                          {q.type === QuestionType.MULTIPLE_CHOICE ? (
                            <select
                              value={q.correctAnswer}
                              onChange={(e) => handleUpdateQuestion(page.id, q.id, { correctAnswer: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">-- 정답 선택 --</option>
                              {(q.options || []).map((o, idx) => (
                                <option key={idx} value={o}>
                                  {idx + 1}번 선택지 ({o})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={q.correctAnswer}
                              onChange={(e) => handleUpdateQuestion(page.id, q.id, { correctAnswer: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
                              placeholder="정확한 오타 없는 키워드 기입 (예: 마그마)"
                            />
                          )}
                        </div>

                        {/* Score Point Weight */}
                        <div className="md:col-span-3">
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">배점 설정 (점수)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={q.points || 10}
                              onChange={(e) => handleUpdateQuestion(page.id, q.id, { points: parseInt(e.target.value) || 10 })}
                              className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <span className="text-xs font-semibold text-slate-400">점</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: QR Code & Invitation Code */}
        {activeTab === "qrcode" && (
          <div className="space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-4">
              <h2 className="text-xl font-bold text-slate-800">학생들의 퀴즈 접속용 QR코드 및 직접 링크</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                학생들이 소지한 태블릿 화면, 스마트폰 카메라 등을 통하여 아래 QR코드를 스캔해 학습 퀴즈룸에 직통 접속할 수 있도록 화면을 대형 빔프로젝터 등에 송출해 주십시오. 
              </p>
            </div>

            <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6.5 text-center flex flex-col items-center space-y-5 shadow-sm">
              <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm relative">
                {/* Embedded QR Code Image generation using free service */}
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`${appUrl}?mode=student`)}`} 
                  alt="Students Quiz Room QR Link"
                  className="w-48 h-48 block cursor-pointer transition active:scale-95"
                  onClick={() => setZoomQr(true)}
                  title="클릭하여 대화면으로 확대합니다."
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="text-center w-full space-y-1">
                <span className="text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                  지상 접속용 복사 경로
                </span>
                <p className="text-xs text-slate-400 break-all pt-1 select-all font-mono">
                  {appUrl}?mode=student
                </p>
              </div>

              <div className="flex items-center gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={copyStudentLink}
                  className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  id="btn-copy-link"
                >
                  <ClipboardCopy className="w-4 h-4 text-slate-500" />
                  접속 링크 복사
                </button>
                <button
                  type="button"
                  onClick={() => setZoomQr(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4.5 rounded-xl text-xs transition flex items-center gap-1"
                  id="btn-zoom-qr"
                >
                  <Eye className="w-4 h-4" />
                  대화면 확대
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: Detail Student Score view card */}
      {selectedSubDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-100 animate-scale-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  [{selectedSubDetail.studentName}] 학생의 상세 답안 및 채점표
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  최종 풀이 제출일: {new Date(selectedSubDetail.submittedAt).toLocaleString("ko-KR")}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubDetail(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-500 p-1.5 rounded-full transition"
                id="btn-close-modal-detail"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Score header */}
              <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between border border-slate-100">
                <span className="text-slate-600 text-sm font-semibold">종합 자동 채점 결과</span>
                <span className="text-2xl font-black font-mono text-indigo-700">
                  {selectedSubDetail.score}점 <span className="text-sm font-normal text-slate-400">/ {selectedSubDetail.totalPoints}점</span>
                </span>
              </div>

              {/* Page breakdown */}
              <div className="space-y-6">
                {localQuizPages.map((page, pIdx) => {
                  const studentPageAns = selectedSubDetail.pageAnswers.find(pa => pa.pageId === page.id);
                  return (
                    <div key={page.id} className="space-y-3">
                      <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wide border-b border-slate-100 pb-1.5">
                        {pIdx + 1}단계 : {page.title}
                      </h4>

                      <div className="space-y-3">
                        {page.questions.map((q) => {
                          const studentAns = studentPageAns ? studentPageAns.answers[q.id] || "" : "";
                          
                          // verify dynamic answer logic
                          const cleanTarget = q.correctAnswer.trim().toLowerCase().replace(/\s+/g, "");
                          const cleanCandidate = studentAns.trim().toLowerCase().replace(/\s+/g, "");
                          const isCorrect = cleanTarget && cleanCandidate === cleanTarget;

                          return (
                            <div 
                              key={q.id}
                              className={`p-3.5 rounded-xl border ${
                                isCorrect 
                                  ? "bg-emerald-50/40 border-emerald-100" 
                                  : "bg-rose-50/40 border-rose-100"
                              } space-y-2`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700">{q.text}</span>
                                <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                                  isCorrect ? "text-emerald-600" : "text-rose-600"
                                }`}>
                                  {isCorrect ? (
                                    <>
                                      <CheckCircle2 className="w-4 h-4" />
                                      정답 (+{q.points}점)
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4" />
                                      오답 (+0점)
                                    </>
                                  )}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-slate-200/50">
                                <div>
                                  <span className="text-slate-400 block mb-0.5">학생 제출 답안</span>
                                  <span className={`font-bold ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                                    {studentAns || "(미입립)"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block mb-0.5">예시 답안</span>
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
        </div>
      )}

      {/* MODAL 2: Giant QR Code for projector screen */}
      {zoomQr && (
        <div 
          onClick={() => setZoomQr(false)}
          className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-8 rounded-3xl max-w-lg w-full text-center space-y-6 shadow-2xl animate-scale-up"
          >
            <h3 className="text-2xl font-black text-slate-800">학생 스마트폰 단대 접속</h3>
            <p className="text-sm text-slate-400">카메라 또는 QR 코드를 통해 빠르게 참여할 수 있습니다.</p>
            
            <div className="bg-slate-50 p-6 rounded-2xl flex justify-center border border-slate-100">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(`${appUrl}?mode=student`)}`} 
                alt="Pupils giant QR access"
                className="w-80 h-80 block select-none"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl font-mono text-xs font-bold text-indigo-700 tracking-wider">
              {appUrl}?mode=student
            </div>

            <button
              onClick={() => setZoomQr(false)}
              className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl text-xs hover:bg-slate-700 transition"
              id="btn-close-zoom-qr"
            >
              화면 닫기
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: Beautiful, Iframe-safe, Custom Confirmation Modal */}
      {confirmModal && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-3xl border border-slate-100 animate-scale-up"
          >
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
              confirmModal.type === "danger" ? "bg-rose-50 text-rose-500" : "bg-indigo-50 text-indigo-500"
            }`}>
              <AlertCircle className="w-6 h-6" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900">{confirmModal.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">{confirmModal.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition active:scale-95"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  const callback = confirmModal.onConfirm;
                  setConfirmModal(null);
                  await callback();
                }}
                className={`text-white font-bold py-2.5 rounded-xl text-xs transition active:scale-95 shadow-md ${
                  confirmModal.type === "danger" 
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/10" 
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10"
                }`}
              >
                {confirmModal.confirmText || "확인 및 반영"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
