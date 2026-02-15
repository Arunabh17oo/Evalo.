import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";

const AnimatedScene = lazy(() => import("./components/AnimatedScene"));
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050/api";
const TOKEN_KEY = "evalo_auth_token";

function appError(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

function authConfig(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function isoToLocalDatetimeInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  // datetime-local expects local time without timezone: YYYY-MM-DDTHH:MM
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatShortDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function digitsOnly(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

// Simplified PDF Generation Function (3 columns: Name, AI Score, Teacher Score)
function generateStudentReportPDF(attempt, test) {
  try {
    // Validation
    if (!attempt) {
      console.error("PDF Error: No attempt data provided");
      alert("Cannot generate PDF: No attempt data available");
      return false;
    }

    if (!test) {
      console.error("PDF Error: No test data provided");
      alert("Cannot generate PDF: No test data available");
      return false;
    }

    console.log("Generating PDF for:", {
      student: attempt.studentName,
      test: test.title,
      hasResponses: !!attempt.responses,
      responseCount: attempt.responses?.length
    });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(10, 95, 127);
    doc.text("EVALO - Test Results", pageWidth / 2, yPos, { align: "center" });

    yPos += 10;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(test.title || "Test Report", pageWidth / 2, yPos, { align: "center" });

    // Line separator
    yPos += 10;
    doc.setDrawColor(99, 242, 222);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);

    // Test Info
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Date: ${formatShortDateTime(attempt.completedAt) || "N/A"}`, 20, yPos);
    yPos += 6;
    doc.text(`Total Marks: ${test.totalMarks || "N/A"}`, 20, yPos);

    // Scores Table (3 columns)
    yPos += 15;

    // Calculate scores
    const aiTotalMarks = (attempt.responses || []).reduce((sum, r) => sum + (r.marksAwarded || 0), 0);
    const teacherTotalMarks = attempt.teacherOverallMarks !== undefined && attempt.teacherOverallMarks !== null
      ? attempt.teacherOverallMarks
      : (attempt.responses || []).reduce((sum, r) => {
        return sum + (r.teacherMarksAwarded !== undefined && r.teacherMarksAwarded !== null ? r.teacherMarksAwarded : 0);
      }, 0);

    const aiPercentage = test.totalMarks ? ((aiTotalMarks / test.totalMarks) * 100).toFixed(1) : "N/A";
    const teacherPercentage = test.totalMarks ? ((teacherTotalMarks / test.totalMarks) * 100).toFixed(1) : "N/A";

    // Prepare simple table data
    const tableData = [[
      attempt.studentName || attempt.studentEmail || "N/A",
      `${aiTotalMarks.toFixed(1)} / ${test.totalMarks} (${aiPercentage}%)`,
      `${teacherTotalMarks.toFixed(1)} / ${test.totalMarks} (${teacherPercentage}%)`
    ]];

    doc.autoTable({
      startY: yPos,
      head: [["Student Name", "AI Score", "Teacher Score"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [10, 95, 127],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 11
      },
      styles: {
        fontSize: 10,
        cellPadding: 5,
        halign: "center"
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 60 },
        1: { cellWidth: 60 },
        2: { cellWidth: 60 }
      }
    });

    // Teacher Remarks
    if (attempt.teacherOverallRemark) {
      yPos = doc.lastAutoTable.finalY + 15;
      doc.setFont(undefined, "bold");
      doc.setFontSize(11);
      doc.text("Teacher's Remarks:", 20, yPos);
      yPos += 6;
      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
      const remarks = doc.splitTextToSize(attempt.teacherOverallRemark, pageWidth - 40);
      doc.text(remarks, 20, yPos);
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Generated by Evalo - ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Download PDF
    const fileName = `Evalo_${test.title.replace(/[^a-zA-Z0-9]/g, "_")}_${attempt.studentName?.replace(/[^a-zA-Z0-9]/g, "_") || "Student"}.pdf`;
    console.log("Saving PDF as:", fileName);
    doc.save(fileName);

    console.log("PDF generated successfully");
    return true;
  } catch (error) {
    console.error("PDF generation error:", error);
    alert(`Failed to generate PDF: ${error.message || "Unknown error"}`);
    return false;
  }
}


function normalizeIntString(value, min, max, fallback) {
  const raw = digitsOnly(value);
  if (!raw) return String(fallback);
  const n = clampInt(Number(raw), min, max);
  return String(n);
}

function Logo5D() {
  return (
    <motion.div
      className="logo5d"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
    >
      <img src="/evalo-logo.png" alt="Evalo Logo" className="logo5d-icon" />
      <div className="logo5d-text">
        <div className="logo5d-stack" aria-hidden>
          <span className="layer l1">Evalo</span>
          <span className="layer l2">Evalo</span>
          <span className="layer l3">Evalo</span>
        </div>
        <span className="logo5d-main">Evalo</span>
        <span className="logo5d-sub">Adaptive AI Exam Intelligence</span>
      </div>
    </motion.div>
  );
}

function AuthModal({ open, mode, onMode, onClose, onSubmit, busy, form, setForm, error }) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-glass"
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <div className="modal-header-with-logo">
          <img src="/evalo-logo.png" alt="Evalo Logo" className="modal-logo" />
          <h3>{mode === "login" ? "Welcome Back to Evalo" : "Create Evalo Account"}</h3>
        </div>
        {error ? <p className="error">{error}</p> : null}

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {mode === "signup" ? (
            <label>
              Full Name
              <input
                value={form.name}
                onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                required
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Login" : "Sign Up"}
          </button>
        </form>

        <div className="row gap-top modal-footer-spaced">
          <button type="button" className="btn-soft" onClick={() => onMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Need an account? Sign Up" : "Already have account? Login"}
          </button>
          <button type="button" className="btn-soft" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("home");
  const [toasts, setToasts] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminCanEditRoles, setAdminCanEditRoles] = useState(false);
  const [adminTests, setAdminTests] = useState([]);
  const [adminTestsBusy, setAdminTestsBusy] = useState(false);

  const [teacherBooks, setTeacherBooks] = useState([]);
  const [bookFiles, setBookFiles] = useState([]);
  const [bookSessionId, setBookSessionId] = useState("");
  const [uploadStats, setUploadStats] = useState(null);
  const [teacherTests, setTeacherTests] = useState([]);
  const [createTestForm, setCreateTestForm] = useState({
    title: "",
    durationMinutes: 35,
    questionCount: 6,
    totalMarks: 100,
    difficulty: "medium",
    questionFormat: "subjective",
    topic: "",
    startsAt: ""
  });
  const [createdTest, setCreatedTest] = useState(null);
  const [editingTestId, setEditingTestId] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [quizId, setQuizId] = useState("");
  const [joinedTest, setJoinedTest] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [mcqChoice, setMcqChoice] = useState(null);
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [result, setResult] = useState(null);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [proctor, setProctor] = useState({ riskScore: 0, warningCount: 0, warningMessages: [] });
  const [proctorAlert, setProctorAlert] = useState("");
  const [marksInfo, setMarksInfo] = useState({ totalMarks: null, marksPerQuestion: null });

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [myAttempts, setMyAttempts] = useState([]);
  const [attemptBusy, setAttemptBusy] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [selectedAttemptDetail, setSelectedAttemptDetail] = useState(null);
  const [selectedAttemptResult, setSelectedAttemptResult] = useState(null);

  const [reviewTestId, setReviewTestId] = useState("");
  const [testAttempts, setTestAttempts] = useState([]);
  const [reviewQuizId, setReviewQuizId] = useState("");
  const [reviewDetail, setReviewDetail] = useState(null);
  const [reviewEdits, setReviewEdits] = useState({});
  const [reviewBaseEdits, setReviewBaseEdits] = useState({});
  const [reviewOverallMarks, setReviewOverallMarks] = useState("");
  const [reviewOverallRemark, setReviewOverallRemark] = useState("");
  const [reviewBaseOverallMarks, setReviewBaseOverallMarks] = useState("");
  const [reviewBaseOverallRemark, setReviewBaseOverallRemark] = useState("");

  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const monitorIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const proctorListenersRef = useRef([]);

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher" || user?.role === "admin";
  const isStudent = user?.role === "student" || user?.role === "admin";
  const examActive = Boolean(quizId && question && !result);
  const [showPublishedAttempts, setShowPublishedAttempts] = useState(false);

  const fullscreenCapable = Boolean(document?.documentElement?.requestFullscreen);
  const fullscreenLocked = Boolean(examActive && question && fullscreenCapable && !isFullscreen);

  function stableSerializeEdits(edits) {
    const entries = Object.entries(edits || {})
      .map(([qid, v]) => {
        const marks = Number.isFinite(Number(v?.teacherMarksAwarded)) ? Number(Number(v.teacherMarksAwarded).toFixed(2)) : 0;
        const feedback = String(v?.teacherFeedback || "").trim();
        return [String(qid), marks, feedback];
      })
      .sort((a, b) => a[0].localeCompare(b[0]));
    return JSON.stringify(entries);
  }

  function normalizeOverallMarks(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
  }

  function calcTeacherSum(edits) {
    const sum = Object.values(edits || {}).reduce((acc, v) => acc + (Number(v?.teacherMarksAwarded) || 0), 0);
    return Number(sum.toFixed(2));
  }

  function pushToast(message, tone = "info") {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, tone }].slice(-5));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!token) {
        setBooting(false);
        setAuthOpen(true);
        return;
      }

      try {
        const { data } = await axios.get(`${API_BASE}/auth/me`, authConfig(token));
        if (!active) return;
        setUser(data.user);
      } catch (_err) {
        if (!active) return;
        setToken("");
        localStorage.removeItem(TOKEN_KEY);
        setAuthOpen(true);
      } finally {
        if (active) setBooting(false);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    return () => stopExamEnvironment();
  }, []);

  async function submitAuth() {
    setAuthError("");
    setBusy(true);
    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/signup";
      const payload =
        authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : { name: authForm.name, email: authForm.email, password: authForm.password };

      const { data } = await axios.post(`${API_BASE}${endpoint}`, payload);
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthOpen(false);
      setAuthError("");
      setAuthForm({ name: "", email: "", password: "" });
      await loadRoleData(data.user, data.token);
      pushToast(authMode === "login" ? "Login successful." : "Account created successfully.", "success");
    } catch (err) {
      setAuthError(appError(err, "Authentication failed."));
    } finally {
      setBusy(false);
    }
  }

  async function loadRoleData(targetUser = user, authToken = token) {
    if (!targetUser || !authToken) return;

    try {
      if (targetUser.role === "teacher" || targetUser.role === "admin") {
        const [booksRes, testsRes] = await Promise.all([
          axios.get(`${API_BASE}/books/mine`, authConfig(authToken)),
          axios.get(`${API_BASE}/tests/mine`, authConfig(authToken))
        ]);
        setTeacherBooks(booksRes.data.books || []);
        setTeacherTests(testsRes.data.tests || []);
      }
      if (targetUser.role === "admin" || targetUser.role === "teacher") {
        const { data } = await axios.get(`${API_BASE}/admin/users`, authConfig(authToken));
        setAdminUsers(data.users || []);
        setAdminCanEditRoles(Boolean(data.canEditRoles));
      }
    } catch (_err) {
      // keep UI alive even if one section fails
    }
  }

  async function loadMyAttempts() {
    if (!token || !isStudent) return;
    setAttemptBusy(true);
    try {
      const { data } = await axios.get(`${API_BASE}/users/me/quizzes`, authConfig(token));
      setMyAttempts(data.quizzes || []);
    } catch (_err) {
      // ignore
    } finally {
      setAttemptBusy(false);
    }
  }

  async function viewAttempt(quizIdToView) {
    if (!token) return;
    setAttemptBusy(true);
    try {
      const [quizRes, resultRes] = await Promise.all([
        axios.get(`${API_BASE}/quizzes/${quizIdToView}`, authConfig(token)),
        axios.get(`${API_BASE}/quiz/${quizIdToView}/result`, authConfig(token)).catch(() => ({ data: null }))
      ]);
      const data = quizRes.data;
      setSelectedAttemptDetail(data);
      setSelectedAttemptResult(resultRes?.data || null);
    } catch (err) {
      setError(appError(err, "Unable to load attempt."));
    } finally {
      setAttemptBusy(false);
    }
  }

  async function loadTestAttempts(testId) {
    if (!token || !isTeacher) return;
    setAttemptBusy(true);
    try {
      const { data } = await axios.get(`${API_BASE}/tests/${testId}/attempts`, authConfig(token));
      setTestAttempts(data.attempts || []);
      setReviewTestId(testId);
    } catch (err) {
      setError(appError(err, "Unable to load test attempts."));
    } finally {
      setAttemptBusy(false);
    }
  }

  async function loadReviewQuiz(quizIdToReview) {
    if (!token) return;
    setAttemptBusy(true);
    try {
      const { data } = await axios.get(`${API_BASE}/quizzes/${quizIdToReview}`, authConfig(token));
      setReviewQuizId(quizIdToReview);
      setReviewDetail(data);
      const base = {};
      (data.responses || []).forEach((r) => {
        base[r.question?.id] = {
          teacherMarksAwarded: r.teacherMarksAwarded ?? r.marksAwarded ?? 0,
          teacherFeedback: r.teacherFeedback ?? ""
        };
      });
      setReviewEdits(base);
      setReviewBaseEdits(base);
      const teacherSum = calcTeacherSum(base);
      const existingOverall = data?.marks?.teacherOverallMarks;
      const overall = existingOverall === null || existingOverall === undefined ? teacherSum : Number(existingOverall);
      const overallStr = Number.isFinite(overall) ? String(overall) : "";
      setReviewOverallMarks(overallStr);
      setReviewBaseOverallMarks(overallStr);

      const remark = String(data?.marks?.teacherOverallRemark || "");
      setReviewOverallRemark(remark);
      setReviewBaseOverallRemark(remark);
    } catch (err) {
      setError(appError(err, "Unable to load quiz for review."));
    } finally {
      setAttemptBusy(false);
    }
  }

  async function submitReview(publishFinal) {
    if (!token || !reviewQuizId) return;
    setAttemptBusy(true);
    try {
      const overallMarks = normalizeOverallMarks(reviewOverallMarks);
      const payload = {
        publishFinal,
        teacherOverallMarks: overallMarks,
        teacherOverallRemark: reviewOverallRemark,
        responses: Object.entries(reviewEdits).map(([questionId, v]) => ({
          questionId,
          teacherMarksAwarded: Number(v.teacherMarksAwarded),
          teacherFeedback: v.teacherFeedback
        }))
      };
      const { data } = await axios.patch(`${API_BASE}/quizzes/${reviewQuizId}/review`, payload, authConfig(token));
      if (publishFinal) {
        const pc = typeof data?.publishCount === "number" ? data.publishCount : null;
        const pl = typeof data?.publishLimit === "number" ? data.publishLimit : 3;
        pushToast(pc !== null ? `Results published successfully (${pc}/${pl}).` : "Results published successfully.", "success");
        setReviewDetail(null);
        setReviewQuizId("");
        setReviewEdits({});
        setReviewBaseEdits({});
        setReviewOverallMarks("");
        setReviewOverallRemark("");
        setReviewBaseOverallMarks("");
        setReviewBaseOverallRemark("");
        await loadTestAttempts(reviewTestId);
      } else {
        pushToast("Draft saved.", "success");
        await loadReviewQuiz(reviewQuizId);
        await loadTestAttempts(reviewTestId);
      }
    } catch (err) {
      const msg = appError(err, "Unable to submit review.");
      setError(msg);
      pushToast(msg, "error");
    } finally {
      setAttemptBusy(false);
    }
  }

  async function logout() {
    try {
      if (token) await axios.post(`${API_BASE}/auth/logout`, {}, authConfig(token));
    } catch (_err) {
      // ignore logout errors
    }

    stopExamEnvironment();
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setActivePage("home");
    setAuthOpen(true);
    setQuizId("");
    setQuestion(null);
    setResult(null);
    pushToast("Logged out.", "info");
  }

  async function refreshAdminUsers() {
    if (!token || !(isAdmin || isTeacher)) return;
    setAdminBusy(true);
    try {
      const { data } = await axios.get(`${API_BASE}/admin/users`, authConfig(token));
      setAdminUsers(data.users || []);
      setAdminCanEditRoles(Boolean(data.canEditRoles));
      pushToast("Users refreshed.", "success");
    } catch (err) {
      setError(appError(err, "Unable to load users."));
    } finally {
      setAdminBusy(false);
    }
  }

  async function refreshAdminTests() {
    if (!token || !isAdmin) return;
    setAdminTestsBusy(true);
    try {
      const { data } = await axios.get(`${API_BASE}/admin/tests`, authConfig(token));
      setAdminTests(data.tests || []);
      pushToast("Tests refreshed.", "success");
    } catch (err) {
      setError(appError(err, "Unable to load tests."));
      pushToast(appError(err, "Unable to load tests."), "error");
    } finally {
      setAdminTestsBusy(false);
    }
  }

  async function adminDeleteTest(testId) {
    if (!token || !isAdmin) return;
    const ok = window.confirm("Delete this test and all related attempts/history? This cannot be undone.");
    if (!ok) return;
    setAdminTestsBusy(true);
    try {
      await axios.delete(`${API_BASE}/admin/tests/${testId}?wipeHistory=true`, authConfig(token));
      pushToast("Test deleted.", "success");
      await refreshAdminTests();
      await loadRoleData();
    } catch (err) {
      const msg = appError(err, "Unable to delete test.");
      setError(msg);
      pushToast(msg, "error");
    } finally {
      setAdminTestsBusy(false);
    }
  }

  async function adminReset(scope = "data") {
    if (!token || !isAdmin) return;
    const message =
      scope === "all"
        ? "Reset EVERYTHING (tests, books, attempts, history, and delete all users except you)?"
        : "Reset platform data (tests, books, attempts, history) to start from 0?";
    const ok = window.confirm(`${message}\n\nThis cannot be undone.`);
    if (!ok) return;
    setAdminTestsBusy(true);
    try {
      await axios.post(`${API_BASE}/admin/reset`, { scope }, authConfig(token));
      pushToast("Platform reset completed.", "success");
      setBookSessionId("");
      setTeacherBooks([]);
      setTeacherTests([]);
      setCreatedTest(null);
      setReviewTestId("");
      setTestAttempts([]);
      setReviewQuizId("");
      setReviewDetail(null);
      setReviewEdits({});
      setReviewBaseEdits({});
      await refreshAdminTests();
      await loadRoleData();
      await loadMyAttempts();
    } catch (err) {
      const msg = appError(err, "Reset failed.");
      setError(msg);
      pushToast(msg, "error");
    } finally {
      setAdminTestsBusy(false);
    }
  }

  async function updateUserRole(userId, role) {
    if (!isAdmin) return;
    setAdminBusy(true);
    setError("");
    try {
      await axios.patch(`${API_BASE}/admin/users/${userId}/role`, { role }, authConfig(token));
      await refreshAdminUsers();
      pushToast("Role updated.", "success");
    } catch (err) {
      setError(appError(err, "Unable to update role."));
    } finally {
      setAdminBusy(false);
    }
  }

  async function uploadBooks(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const fileList = Array.from(bookFiles || []);
      if (!fileList.length) {
        throw new Error("Upload at least one book file.");
      }
      if (fileList.length > 5) {
        throw new Error("You can upload up to 5 books at once.");
      }

      const valid = fileList.every((file) => /\.(pdf|txt)$/i.test(file.name));
      if (!valid) throw new Error("Only PDF or TXT files are allowed.");

      const oversized = fileList.find((file) => file.size > 20 * 1024 * 1024);
      if (oversized) throw new Error(`${oversized.name} exceeds 20MB limit.`);

      const formData = new FormData();
      fileList.forEach((file) => formData.append("books", file));

      const { data } = await axios.post(`${API_BASE}/books/upload`, formData, {
        ...authConfig(token),
        headers: {
          ...authConfig(token).headers,
          "Content-Type": "multipart/form-data"
        }
      });

      setBookSessionId(data.bookSessionId);
      setUploadStats(data.stats);
      await loadRoleData();
      pushToast("Books uploaded and indexed.", "success");
    } catch (err) {
      setError(appError(err, "Book upload failed."));
    } finally {
      setBusy(false);
    }
  }

  async function createTest() {
    setBusy(true);
    setError("");
    try {
      if (!bookSessionId) {
        throw new Error("Upload books first or choose a previously uploaded book session.");
      }

      const durationMinutes = clampInt(createTestForm.durationMinutes, 5, 180);
      const questionCount = clampInt(createTestForm.questionCount, 4, 20);
      const totalMarks = clampInt(createTestForm.totalMarks, 10, 1000);
      const startsAtIso = createTestForm.startsAt ? new Date(createTestForm.startsAt).toISOString() : undefined;

      const payload = {
        title: createTestForm.title || "Evalo Test",
        bookSessionId,
        durationMinutes,
        questionCount,
        totalMarks,
        difficulty: createTestForm.difficulty,
        topic: createTestForm.topic,
        questionFormat: createTestForm.questionFormat,
        startsAt: startsAtIso
      };

      if (editingTestId) {
        const { data } = await axios.patch(`${API_BASE}/tests/${editingTestId}`, payload, authConfig(token));
        setCreatedTest(data.test);
        setEditingTestId("");
        pushToast("Test updated.", "success");
      } else {
        const { data } = await axios.post(`${API_BASE}/tests`, payload, authConfig(token));
        setCreatedTest(data.test);
        pushToast(`Test scheduled. Join code: ${data.test?.joinCode || "-"}`, "success");
      }
      await loadRoleData();
    } catch (err) {
      setError(appError(err, "Unable to create test."));
    } finally {
      setBusy(false);
    }
  }

  async function joinTest() {
    setBusy(true);
    setError("");
    try {
      const { data } = await axios.post(`${API_BASE}/tests/join`, { joinCode }, authConfig(token));
      setQuizId(data.quizId);
      setJoinedTest(data.test);
      setQuestion(data.question);
      setTimeLeftSec(data.timeLeftSec || 0);
      setProctor(data.proctor || { riskScore: 0, warningCount: 0, warningMessages: [] });
      setMarksInfo(data.marks || { totalMarks: data.test?.totalMarks ?? null, marksPerQuestion: data.test?.marksPerQuestion ?? null });
      setAnswer("");
      setMcqChoice(null);
      setLastEvaluation(null);
      setResult(null);

      await startExamEnvironment(data.quizId);
      pushToast("Test started. Proctoring enabled.", "info");
    } catch (err) {
      setError(appError(err, "Unable to join test."));
    } finally {
      setBusy(false);
    }
  }

  async function sendProctorEvent(type, meta = {}, targetQuizId = quizId) {
    if (!targetQuizId || !token) return;
    try {
      const { data } = await axios.post(
        `${API_BASE}/quiz/${targetQuizId}/proctor-event`,
        { type, meta },
        authConfig(token)
      );
      setProctor((prev) => ({ ...prev, ...data }));
      if (data.warning) {
        setProctorAlert(data.warning);
        setTimeout(() => setProctorAlert(""), 3000);
      }
    } catch (_err) {
      // best effort
    }
  }

  async function startExamEnvironment(nextQuizId) {
    stopExamEnvironment();
    setCameraError("");
    setIsFullscreen(Boolean(document.fullscreenElement));

    // getUserMedia requires a secure context except localhost.
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    if (!window.isSecureContext && !isLocalhost) {
      setCameraError("Camera requires HTTPS (secure context). Open the site over HTTPS or use localhost.");
      await sendProctorEvent("media_muted", { reason: "insecure_context" }, nextQuizId);
      // Continue exam without camera/mic in insecure contexts (browser blocks getUserMedia).
    }

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (_err) {
      await sendProctorEvent("fullscreen_exit", { reason: "fullscreen_rejected" }, nextQuizId);
    }
    setIsFullscreen(Boolean(document.fullscreenElement));

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia unavailable in this browser.");
      }
      if (!window.isSecureContext && !isLocalhost) {
        throw new Error("Insecure context blocks camera.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play?.().catch(() => { });
        };
        await videoRef.current.play().catch(() => { });
      }
      setCameraReady(true);
    } catch (_err) {
      setCameraError("Camera/Mic permission not granted. Proctoring risk increased.");
      await sendProctorEvent("media_muted", { reason: "permission_denied" }, nextQuizId);
    }

    const handleVisibility = () => {
      if (document.hidden) {
        sendProctorEvent("tab_hidden", { source: "visibilitychange" }, nextQuizId);
      }
    };

    const handleBlur = () =>
      sendProctorEvent("window_blur", { source: "window_blur" }, nextQuizId);

    const handleFullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) sendProctorEvent("fullscreen_exit", { source: "fullscreenchange" }, nextQuizId);
    };

    const blockedAction = (event, type) => {
      event.preventDefault();
      sendProctorEvent(type, { source: "blocked_action" }, nextQuizId);
    };

    const keyHandler = (event) => {
      if ((event.ctrlKey || event.metaKey) && ["c", "v", "x"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        const type = event.key.toLowerCase() === "v" ? "paste_attempt" : "copy_attempt";
        sendProctorEvent(type, { source: "keyboard_shortcut" }, nextQuizId);
      }
    };

    const onCopy = (e) => blockedAction(e, "copy_attempt");
    const onCut = (e) => blockedAction(e, "copy_attempt");
    const onPaste = (e) => blockedAction(e, "paste_attempt");
    const onContext = (e) => blockedAction(e, "context_menu");

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreen);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", keyHandler);

    proctorListenersRef.current = [
      ["blur", handleBlur, window],
      ["visibilitychange", handleVisibility, document],
      ["fullscreenchange", handleFullscreen, document],
      ["copy", onCopy, document],
      ["cut", onCut, document],
      ["paste", onPaste, document],
      ["contextmenu", onContext, document],
      ["keydown", keyHandler, document]
    ];

    monitorIntervalRef.current = setInterval(() => {
      const stream = mediaStreamRef.current;
      if (!stream) {
        sendProctorEvent("media_muted", { reason: "stream_missing" }, nextQuizId);
        return;
      }

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (!videoTrack || videoTrack.muted || videoTrack.readyState !== "live") {
        sendProctorEvent("no_face", { reason: "video_track_inactive" }, nextQuizId);
      }
      if (!audioTrack || audioTrack.muted || audioTrack.readyState !== "live") {
        sendProctorEvent("media_muted", { reason: "audio_track_inactive" }, nextQuizId);
      }
    }, 12000);

    timerIntervalRef.current = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          forceResult(nextQuizId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return undefined;
  }

  function stopExamEnvironment() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }

    proctorListenersRef.current.forEach(([eventName, handler, target]) => {
      target.removeEventListener(eventName, handler);
    });
    proctorListenersRef.current = [];

    setCameraReady(false);
  }

  async function requestFullscreenNow() {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(Boolean(document.fullscreenElement));
      }
    } catch (_err) {
      // best effort
    }
  }

  async function forceResult(targetQuizId = quizId) {
    if (!targetQuizId || !token) return;
    try {
      const { data } = await axios.get(`${API_BASE}/quiz/${targetQuizId}/result`, authConfig(token));
      setResult(data);
      setQuestion(null);
      stopExamEnvironment();
    } catch (_err) {
      // ignore
    }
  }

  async function submitAnswer(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = question?.type === "mcq" ? { mcqChoice } : { answer };
      if (question?.type === "mcq" && (mcqChoice === null || mcqChoice === undefined)) {
        throw new Error("Please select one option.");
      }
      const { data } = await axios.post(
        `${API_BASE}/quiz/${quizId}/answer`,
        payload,
        authConfig(token)
      );

      if (data.evaluation) {
        setLastEvaluation(data.evaluation);
      }
      if (typeof data.timeLeftSec === "number") {
        setTimeLeftSec(data.timeLeftSec);
      }
      if (data.proctor) {
        setProctor(data.proctor);
      }

      setAnswer("");
      setMcqChoice(null);

      if (data.completed) {
        setResult(data.result);
        setQuestion(null);
        stopExamEnvironment();
      } else {
        setQuestion(data.question);
      }
    } catch (err) {
      setError(appError(err, "Answer submission failed."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (user && token) {
      loadRoleData(user, token);
      loadMyAttempts();
    }
  }, [user, token]);

  // Marks-based tests: teacher controls question count and duration directly.

  if (booting) {
    return <div className="boot">Loading Evalo...</div>;
  }

  return (
    <div className="app-shell">
      <Suspense fallback={<div className="scene-wrap scene-fallback" />}>
        <AnimatedScene />
      </Suspense>

      <div className="toast-stack" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone || "info"}`}>
            <span>{t.message}</span>
            <button
              type="button"
              className="toast-x"
              aria-label="Dismiss notification"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <AuthModal
        open={authOpen}
        mode={authMode}
        onMode={setAuthMode}
        onClose={() => setAuthOpen(false)}
        onSubmit={submitAuth}
        busy={busy}
        form={authForm}
        setForm={setAuthForm}
        error={authError}
      />

      {/* Fixed Top Navigation */}
      <header className="top-nav">
        <div className="nav-container">
          <Logo5D />
          <div className="nav-actions">
            {!user ? (
              <button className="cta-button" onClick={() => setAuthOpen(true)}>Login / Sign Up</button>
            ) : (
              <>
                <button className="btn-soft" onClick={() => setActivePage("home")}>Home</button>
                {isTeacher ? (
                  <button className="btn-soft" onClick={() => setActivePage("admin")}>Admin</button>
                ) : null}
                <span className="role-badge">{user.name} ({user.role})</span>
                <button onClick={logout}>Logout</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="main-grid">
        {error ? <p className="error wide">{error}</p> : null}
        {proctorAlert ? <p className="warning wide">{proctorAlert}</p> : null}

        {activePage === "admin" ? (
          <section className="card big-card">
            <h2>Admin Control Center</h2>
            <p className="subtitle">
              {isAdmin
                ? "Assign user roles between Student, Teacher, and Admin."
                : "Teacher read-only view. Only admin can change roles."}
            </p>
            {!isTeacher ? (
              <p className="error">Admin page is available only for teacher/admin.</p>
            ) : (
              <>
                <div className="row">
                  <button onClick={refreshAdminUsers} disabled={adminBusy}>
                    {adminBusy ? "Refreshing..." : "Refresh Users"}
                  </button>
                  {isAdmin ? (
                    <button className="btn-soft btn-small" onClick={refreshAdminTests} disabled={adminTestsBusy}>
                      {adminTestsBusy ? "Loading..." : "Refresh Tests"}
                    </button>
                  ) : null}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((u) => (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td>{u.email}</td>
                          <td>{u.role}</td>
                          <td>
                            {adminCanEditRoles ? (
                              <select
                                value={u.role}
                                onChange={(e) => updateUserRole(u.id, e.target.value)}
                                disabled={adminBusy || u.id === user?.id}
                                title={u.id === user?.id ? "You cannot change your own role." : ""}
                              >
                                <option value="student">student</option>
                                <option value="teacher">teacher</option>
                                <option value="admin">admin</option>
                              </select>
                            ) : (
                              <span className="pill">Read only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isAdmin ? (
                  <>
                    <div className="evaluation gap-top">
                      <div className="list-header">
                        <h3>Platform Reset</h3>
                        <span className="pill danger">Admin Only</span>
                      </div>
                      <p className="hint">Start from 0 by wiping tests, books, attempts, and history.</p>
                      <div className="row gap-top">
                        <button className="btn-soft btn-small" onClick={() => adminReset("data")} disabled={adminTestsBusy}>
                          Reset Data (Keep Users)
                        </button>
                        <button className="btn-soft btn-small" onClick={() => adminReset("all")} disabled={adminTestsBusy}>
                          Reset All (Wipe Users)
                        </button>
                      </div>
                    </div>

                    <div className="evaluation gap-top">
                      <div className="list-header">
                        <h3>All Tests</h3>
                        <span className="pill">Count: {adminTests.length}</span>
                      </div>
                      {adminTests.length ? (
                        <ul className="flat-list">
                          {adminTests.map((t) => (
                            <li key={t.id} className="list-row">
                              <div className="list-main">
                                <div className="list-title">{t.title}</div>
                                <div className="pill-wrap">
                                  <span className="pill">Code: {t.joinCode}</span>
                                  {t.totalMarks ? <span className="pill">Marks: {t.totalMarks}</span> : null}
                                  {t.startsAt ? <span className="pill">Starts: {formatShortDateTime(t.startsAt)}</span> : null}
                                  <span className="pill">Attempts: {t.attempts ?? 0}</span>
                                </div>
                              </div>
                              <div className="list-actions">
                                <button
                                  className="btn-soft btn-small"
                                  onClick={() => {
                                    if (confirm(`Clear all attempt history for "${t.title}"? This cannot be undone.`)) {
                                      // TODO: Implement clear history endpoint
                                      alert("Clear history feature coming soon!");
                                    }
                                  }}
                                  disabled={adminTestsBusy}
                                >
                                  Clear History
                                </button>
                                <button className="btn-soft btn-small" onClick={() => adminDeleteTest(t.id)} disabled={adminTestsBusy}>
                                  Delete
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="hint">No tests found. Click Refresh Tests.</p>
                      )}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </section>
        ) : (
          <>
            {/* Floating Gradient Orbs */}
            <div className="floating-orbs">
              <div className="floating-orb orb-1"></div>
              <div className="floating-orb orb-2"></div>
              <div className="floating-orb orb-3"></div>
            </div>

            {/* Centered Hero Section */}
            <motion.section
              className="hero-centered"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="hero-title-container">
                <motion.img
                  src="/evalo-logo.png"
                  alt="Evalo Logo"
                  className="hero-logo"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
                <h1 className="gradient-text hero-title">Evalo Smart Examination Platform</h1>
              </div>
              <p className="hero-subtitle-centered">
                Next-generation exam orchestration powered by AI
              </p>

              <div className="pill-wrap-centered">
                <span
                  className="pill-enhanced pill-clickable"
                  onClick={() => {
                    if (!user) {
                      setAuthOpen(true);
                      setError("Please login to access proctoring features");
                    } else {
                      const section = document.getElementById('features-section');
                      section?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <span className="pill-icon">📹</span>
                  Camera + Mic Proctoring
                </span>
                <span
                  className="pill-enhanced pill-clickable"
                  onClick={() => {
                    if (!user) {
                      setAuthOpen(true);
                      setError("Please login to access fullscreen enforcement");
                    } else {
                      const section = document.getElementById('features-section');
                      section?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <span className="pill-icon">🖥️</span>
                  Auto Fullscreen Enforcement
                </span>
                <span
                  className="pill-enhanced pill-clickable"
                  onClick={() => {
                    if (!user) {
                      setAuthOpen(true);
                      setError("Please login to access AI-powered evaluation");
                    } else {
                      const section = document.getElementById('features-section');
                      section?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <span className="pill-icon">🤖</span>
                  AI-Powered Evaluation
                </span>
                <span
                  className="pill-enhanced pill-clickable"
                  onClick={() => {
                    if (!user) {
                      setAuthOpen(true);
                      setError("Please login to access real-time analytics");
                    } else {
                      const section = document.getElementById('features-section');
                      section?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <span className="pill-icon">⚡</span>
                  Real-time Analytics
                </span>
              </div>

              <div className="cta-group-centered">
                <button
                  className="cta-button glow-effect"
                  onClick={() => {
                    const features = document.getElementById('features-section');
                    features?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span>Get Started Free</span>
                </button>
                <button
                  className="cta-button cta-secondary"
                  onClick={() => {
                    const features = document.getElementById('features-section');
                    features?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span>Explore Features</span>
                </button>
              </div>
            </motion.section>

            {/* Centered Stats Section */}
            <motion.section
              className="stats-grid-centered"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <div className="stat-card-large">
                <p className="stat-number-large">AI-Powered</p>
                <p className="stat-label-large">Adaptive Learning</p>
              </div>
              <div className="stat-card-large">
                <p className="stat-number-large">Real-time</p>
                <p className="stat-label-large">Proctoring System</p>
              </div>
              <div className="stat-card-large">
                <p className="stat-number-large">Secure</p>
                <p className="stat-label-large">Exam Environment</p>
              </div>
              <div className="stat-card-large">
                <p className="stat-number-large">Smart</p>
                <p className="stat-label-large">Auto Grading</p>
              </div>
            </motion.section>

            {/* Feature Cards Section */}
            <motion.section
              id="features-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <h2 style={{ textAlign: 'center', marginTop: '3rem', marginBottom: '1rem', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', color: '#f1fbff' }}>
                Platform Capabilities
              </h2>
              <div className="feature-cards-grid">
                <motion.div
                  className="feature-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                >
                  <div className="feature-icon">🎯</div>
                  <h3>Adaptive Assessment</h3>
                  <p>
                    AI-driven subjective question evaluation that adapts to student responses.
                    Generate personalized tests from uploaded materials with intelligent difficulty scaling.
                  </p>
                </motion.div>

                <motion.div
                  className="feature-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  <div className="feature-icon">🔒</div>
                  <h3>Advanced Proctoring</h3>
                  <p>
                    Multi-layered security with camera monitoring, fullscreen enforcement,
                    copy-paste detection, and real-time risk scoring to ensure exam integrity.
                  </p>
                </motion.div>

                <motion.div
                  className="feature-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  <div className="feature-icon">📊</div>
                  <h3>Intelligent Analytics</h3>
                  <p>
                    Comprehensive performance tracking with detailed feedback, teacher review capabilities,
                    and automated grading powered by advanced AI models.
                  </p>
                </motion.div>
              </div>
            </motion.section>


            {isTeacher ? (
              <section className="card split-card">
                <div>
                  <h2>Teacher Panel</h2>
                  <form className="form-grid" onSubmit={uploadBooks}>
                    <label>
                      Upload one or more books (PDF/TXT)
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.txt"
                        onChange={(e) => setBookFiles(e.target.files || [])}
                      />
                    </label>
                    <button type="submit" disabled={busy}>
                      {busy ? "Uploading..." : "Upload & Index"}
                    </button>
                  </form>

                  {uploadStats ? (
                    <div className="evaluation">
                      <p>Book Session: {bookSessionId}</p>
                      <p>{uploadStats.chunks} chunks | {uploadStats.questions} generated questions</p>
                    </div>
                  ) : null}

                  <div className="form-grid gap-top">
                    <label>
                      Test Title
                      <input
                        value={createTestForm.title}
                        onChange={(e) => setCreateTestForm((p) => ({ ...p, title: e.target.value }))}
                      />
                    </label>
                    <label>
                      Total Marks
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        step="1"
                        value={createTestForm.totalMarks}
                        inputMode="numeric"
                        onChange={(e) => {
                          const raw = digitsOnly(e.target.value);
                          setCreateTestForm((p) => ({ ...p, totalMarks: raw ? Number(raw) : 0 }));
                        }}
                        onBlur={(e) => {
                          const normalized = normalizeIntString(e.target.value, 10, 1000, 100);
                          setCreateTestForm((p) => ({ ...p, totalMarks: Number(normalized) }));
                        }}
                      />
                    </label>
                    <label>
                      Duration (minutes)
                      <input
                        type="number"
                        min="5"
                        max="180"
                        step="1"
                        value={createTestForm.durationMinutes}
                        inputMode="numeric"
                        onChange={(e) => {
                          const raw = digitsOnly(e.target.value);
                          setCreateTestForm((p) => ({ ...p, durationMinutes: raw ? Number(raw) : 0 }));
                        }}
                        onBlur={(e) => {
                          const normalized = normalizeIntString(e.target.value, 5, 180, 35);
                          setCreateTestForm((p) => ({ ...p, durationMinutes: Number(normalized) }));
                        }}
                      />
                    </label>
                    <label>
                      Questions
                      <input
                        type="number"
                        min="4"
                        max="20"
                        step="1"
                        value={createTestForm.questionCount}
                        inputMode="numeric"
                        onChange={(e) => {
                          const raw = digitsOnly(e.target.value);
                          setCreateTestForm((p) => ({ ...p, questionCount: raw ? Number(raw) : 0 }));
                        }}
                        onBlur={(e) => {
                          const normalized = normalizeIntString(e.target.value, 4, 20, 6);
                          setCreateTestForm((p) => ({ ...p, questionCount: Number(normalized) }));
                        }}
                      />
                    </label>
                    <label>
                      Topic (optional)
                      <input
                        value={createTestForm.topic}
                        onChange={(e) => setCreateTestForm((p) => ({ ...p, topic: e.target.value }))}
                        placeholder="e.g. Graphs, DP, Trees"
                      />
                    </label>
                    <label>
                      Start Date/Time (optional)
                      <input
                        type="datetime-local"
                        value={createTestForm.startsAt}
                        onChange={(e) => setCreateTestForm((p) => ({ ...p, startsAt: e.target.value }))}
                      />
                    </label>
                    <label>
                      Difficulty
                      <select
                        value={createTestForm.difficulty}
                        onChange={(e) => setCreateTestForm((p) => ({ ...p, difficulty: e.target.value }))}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </label>
                    <label>
                      Question Type
                      <select
                        value={createTestForm.questionFormat}
                        onChange={(e) => setCreateTestForm((p) => ({ ...p, questionFormat: e.target.value }))}
                      >
                        <option value="subjective">Subjective</option>
                        <option value="mcq">MCQ</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </label>
                    <div className="row">
                      <button type="button" onClick={createTest} disabled={busy}>
                        {busy ? "Saving..." : editingTestId ? "Save Changes" : "Create / Schedule Test"}
                      </button>
                      {editingTestId ? (
                        <button
                          type="button"
                          className="btn-soft btn-small"
                          onClick={() => {
                            setEditingTestId("");
                            setCreateTestForm((p) => ({ ...p, title: "", topic: "", startsAt: "" }));
                          }}
                          disabled={busy}
                        >
                          Cancel Edit
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {createdTest ? (
                    <div className="evaluation">
                      <h3>Latest Test Created</h3>
                      <p>{createdTest.title}</p>
                      <p className="big-code">Join Code: {createdTest.joinCode}</p>
                      {createdTest.topic ? <p className="hint">Topic: {createdTest.topic}</p> : null}
                      {createdTest.difficulty ? <p className="hint">Difficulty: {createdTest.difficulty}</p> : null}
                      {createdTest.questionFormat ? <p className="hint">Type: {createdTest.questionFormat}</p> : null}
                      {createdTest.totalMarks ? (
                        <p className="hint">
                          Total Marks: {createdTest.totalMarks} | Marks/Q: {createdTest.marksPerQuestion}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div>
                  <h2>Teacher Assets</h2>
                  <div className="evaluation">
                    <h3>Uploaded Book Sessions</h3>
                    {teacherBooks.length ? (
                      <ul className="flat-list">
                        {teacherBooks.slice(0, 3).map((book) => (
                          <li key={book.id} className="list-row">
                            <div className="list-main">
                              <div className="list-title">{book.title || book.fileNames?.[0] || book.id.slice(0, 8)}</div>
                              {book.id ? <div className="hint">Session: {book.id.slice(0, 8)}…</div> : null}
                            </div>
                            <div className="list-actions">
                              <button className="btn-soft" onClick={() => setBookSessionId(book.id)}>
                                Use
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hint">No book sessions yet.</p>
                    )}
                  </div>

                  <div className="evaluation">
                    <h3>My Tests</h3>
                    {teacherTests.length ? (
                      <ul className="flat-list">
                        {teacherTests.map((test) => (
                          <li key={test.id} className="list-row">
                            <div className="list-main">
                              <div className="list-title">{test.title}</div>
                              <div className="pill-wrap">
                                <span className="pill">Code: {test.joinCode}</span>
                                {test.topic ? <span className="pill">Topic: {test.topic}</span> : null}
                                {test.difficulty ? <span className="pill">Diff: {test.difficulty}</span> : null}
                                {test.questionFormat ? <span className="pill">Type: {test.questionFormat}</span> : null}
                                {test.totalMarks ? <span className="pill">Marks: {test.totalMarks}</span> : null}
                                {test.startsAt ? (
                                  <span className="pill">
                                    {Date.now() < new Date(test.startsAt).getTime() ? "Starts" : "Started"}:{" "}
                                    {formatShortDateTime(test.startsAt)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="list-actions">
                              <button className="btn-soft btn-small" onClick={() => loadTestAttempts(test.id)} disabled={attemptBusy}>
                                Review
                              </button>
                              <button
                                className="btn-soft btn-small"
                                onClick={() => {
                                  setEditingTestId(test.id);
                                  setBookSessionId(test.bookSessionId);
                                  setCreateTestForm((p) => ({
                                    ...p,
                                    title: test.title || "",
                                    durationMinutes: test.durationMinutes || p.durationMinutes,
                                    questionCount: test.questionCount || p.questionCount,
                                    totalMarks: test.totalMarks || p.totalMarks,
                                    difficulty: test.difficulty || p.difficulty,
                                    questionFormat: test.questionFormat || p.questionFormat,
                                    topic: test.topic || "",
                                    startsAt: isoToLocalDatetimeInput(test.startsAt)
                                  }));
                                  pushToast("Editing test settings.", "info");
                                }}
                                disabled={attemptBusy}
                              >
                                Edit
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hint">No tests yet.</p>
                    )}
                  </div>

                  {reviewTestId ? (
                    <div className="evaluation">
                      <div className="list-header">
                        <h3>Test Attempts</h3>
                        <button type="button" className="btn-soft btn-small" onClick={() => setShowPublishedAttempts((v) => !v)}>
                          {showPublishedAttempts ? "Hide Published" : "Show Published"}
                        </button>
                      </div>
                      {(() => {
                        const visible = (testAttempts || []).filter((a) => {
                          // Hide finalized attempts (published 3+ times)
                          if (Number(a.publishCount) >= 3) return false;
                          // Show based on published toggle
                          return showPublishedAttempts ? true : (a.completed && !a.teacherPublishedAt);
                        });
                        return visible.length ? (
                          <ul className="flat-list">
                            {visible.map((a) => (
                              <li key={a.quizId} className="list-row">
                                <div className="list-main">
                                  <div className="list-title">{a.studentName || a.studentEmail || a.userId}</div>
                                  <div className="pill-wrap">
                                    <span className="pill">{a.completed ? "Completed" : "In progress"}</span>
                                    {a.teacherPublishedAt ? (
                                      <span className="pill">
                                        {Number(a.publishCount) >= 3 ? "Finalized" : "Published"}{" "}
                                        {a.publishCount ? `(${a.publishCount}/3)` : ""}
                                      </span>
                                    ) : a.completed ? (
                                      <>
                                        <span className="pill pill-success">Submitted</span>
                                        <span className="pill danger">Needs Review</span>
                                      </>
                                    ) : (
                                      <span className="pill">Awaiting submission</span>
                                    )}
                                  </div>
                                </div>
                                <div className="list-actions">
                                  <button className="btn-soft btn-small" onClick={() => loadReviewQuiz(a.quizId)} disabled={attemptBusy}>
                                    Open
                                  </button>
                                  {a.teacherPublishedAt && (
                                    <button
                                      className="btn-soft btn-small"
                                      onClick={() => generateStudentReportPDF(a, test)}
                                      title="Download PDF Report"
                                    >
                                      📄 PDF
                                    </button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="hint">
                            {showPublishedAttempts ? "No attempts yet." : "No pending attempts. In-progress and published attempts are hidden."}
                          </p>
                        );
                      })()}
                    </div>
                  ) : null}

                  {reviewDetail ? (
                    <div className="evaluation">
                      {(() => {
                        const pc = Number(reviewDetail?.status?.publishCount) || 0;
                        const pl = Number(reviewDetail?.status?.publishLimit) || 3;
                        const publishedBefore = Boolean(reviewDetail?.status?.teacherPublishedAt) || pc > 0;
                        const dirtyEdits = stableSerializeEdits(reviewEdits) !== stableSerializeEdits(reviewBaseEdits);
                        const dirtyOverall =
                          String(reviewOverallMarks || "") !== String(reviewBaseOverallMarks || "") ||
                          String(reviewOverallRemark || "") !== String(reviewBaseOverallRemark || "");
                        const dirty = dirtyEdits || dirtyOverall;
                        const overallMarksOk = normalizeOverallMarks(reviewOverallMarks) !== null;

                        const publishDisabled = attemptBusy || pc >= pl || (publishedBefore && !dirty) || !overallMarksOk;
                        const publishReason =
                          pc >= pl
                            ? `Republish limit reached (${pc}/${pl}).`
                            : publishedBefore && !dirty
                              ? "No changes since last publish. Edit marks/feedback to republish."
                              : !overallMarksOk
                                ? "Overall marks are required before publishing."
                                : null;

                        return (
                          <>
                            <div className="list-header">
                              <h3>Teacher Review</h3>
                              <span className="pill">Publish: {pc}/{pl}</span>
                            </div>
                            <p className="hint">
                              Quiz: {reviewDetail.quizId}{" "}
                              {reviewDetail.status?.teacherPublishedAt ? "(Final published)" : "(Draft)"}
                            </p>
                            {publishReason ? <p className="warning">{publishReason}</p> : null}

                            <div className="form-grid">
                              {(reviewDetail.responses || []).map((r) => (
                                <div key={r.question?.id} className="evaluation">
                                  <p className="prompt">{r.question?.prompt}</p>
                                  {r.question?.type === "mcq" ? (
                                    <p className="hint">
                                      Student Choice:{" "}
                                      {typeof r.mcqChoice === "number" && Array.isArray(r.question?.choices)
                                        ? r.question.choices[r.mcqChoice] || `Option ${r.mcqChoice + 1}`
                                        : "Not recorded"}
                                    </p>
                                  ) : (
                                    <p className="hint">Student Answer: {r.answer}</p>
                                  )}
                                  <div className="row">
                                    <label>
                                      Marks
                                      <input
                                        type="number"
                                        step="0.5"
                                        value={reviewEdits[r.question?.id]?.teacherMarksAwarded ?? 0}
                                        onChange={(e) =>
                                          setReviewEdits((p) => ({
                                            ...p,
                                            [r.question?.id]: {
                                              ...p[r.question?.id],
                                              teacherMarksAwarded: e.target.value
                                            }
                                          }))
                                        }
                                      />
                                    </label>
                                    <label>
                                      Feedback
                                      <input
                                        value={reviewEdits[r.question?.id]?.teacherFeedback ?? ""}
                                        onChange={(e) =>
                                          setReviewEdits((p) => ({
                                            ...p,
                                            [r.question?.id]: {
                                              ...p[r.question?.id],
                                              teacherFeedback: e.target.value
                                            }
                                          }))
                                        }
                                      />
                                    </label>
                                  </div>
                                </div>
                              ))}

                              <div className="evaluation">
                                <h4 style={{ margin: "0 0 0.6rem" }}>Final Overall Review</h4>
                                <div className="row">
                                  <label>
                                    Overall Marks
                                    <input
                                      type="number"
                                      step="0.5"
                                      inputMode="decimal"
                                      value={reviewOverallMarks}
                                      onChange={(e) => setReviewOverallMarks(e.target.value)}
                                      placeholder={`out of ${reviewDetail?.marks?.totalMarks ?? ""}`}
                                    />
                                  </label>
                                  <label>
                                    Overall Remark (optional)
                                    <input
                                      value={reviewOverallRemark}
                                      onChange={(e) => setReviewOverallRemark(e.target.value)}
                                      placeholder="e.g. Strong fundamentals, improve time complexity analysis."
                                    />
                                  </label>
                                </div>
                                <div className="row gap-top">
                                  <button
                                    type="button"
                                    className="btn-soft btn-small"
                                    onClick={() => setReviewOverallMarks(String(calcTeacherSum(reviewEdits)))}
                                    disabled={attemptBusy}
                                  >
                                    Auto-calc From Q Marks
                                  </button>
                                  {reviewDetail?.marks?.totalMarks ? (
                                    <span className="hint">
                                      Total: {reviewDetail.marks.totalMarks} | Suggested: {calcTeacherSum(reviewEdits)}
                                    </span>
                                  ) : (
                                    <span className="hint">Suggested: {calcTeacherSum(reviewEdits)}</span>
                                  )}
                                </div>
                              </div>

                              <div className="row">
                                <button type="button" className="btn-soft" onClick={() => submitReview(false)} disabled={attemptBusy}>
                                  Save Draft
                                </button>
                                <button type="button" onClick={() => submitReview(true)} disabled={publishDisabled}>
                                  Publish Final Marks
                                </button>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {isStudent ? (
              <section className="card split-card">
                <div>
                  <h2>Student Panel</h2>
                  {!isStudent ? (
                    <p className="hint">Admin must assign your role as Student to join tests.</p>
                  ) : (
                    <div className="form-grid">
                      <label>
                        Enter Join Code
                        <input
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          placeholder="e.g. A9P3QX"
                        />
                      </label>
                      <button type="button" onClick={joinTest} disabled={busy}>
                        {busy ? "Joining..." : "Join Test"}
                      </button>
                      <p className="hint">On joining, camera and mic permissions will be requested and fullscreen will be activated.</p>
                    </div>
                  )}
                </div>

                {examActive ? (
                  <div>
                    <h2>AI Proctoring Feed</h2>
                    <div className="camera-box">
                      <video ref={videoRef} autoPlay muted playsInline />
                      {!cameraReady ? <p className="hint">Camera preview inactive.</p> : null}
                    </div>
                    {cameraError ? <p className="error">{cameraError}</p> : null}
                    <div className="evaluation">
                      <p>Risk Score: {proctor.riskScore || 0}%</p>
                      <p>Warnings: {proctor.warningCount || 0}</p>
                    </div>
                  </div>
                ) : null}

                {!examActive ? (
                  <div>
                    <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                      <h2 style={{ margin: 0 }}>Test History</h2>
                      <button className="btn-soft btn-small" onClick={loadMyAttempts} disabled={attemptBusy}>
                        {attemptBusy ? "Loading..." : "Refresh"}
                      </button>
                    </div>
                    <div className="evaluation gap-top">
                      {myAttempts.length ? (
                        <ul className="flat-list">
                          {myAttempts.map((a) => (
                            <li key={a.quizId} className="list-row">
                              <div className="list-main">
                                <div className="list-title">{a.testTitle || "Test"}</div>
                                <div className="pill-wrap">
                                  <span className="pill">{a.completed ? "Completed" : "In progress"}</span>
                                  {a.topic ? <span className="pill">Topic: {a.topic}</span> : null}
                                  {a.difficulty ? <span className="pill">Diff: {a.difficulty}</span> : null}
                                  {a.questionFormat ? <span className="pill">Type: {a.questionFormat}</span> : null}
                                </div>
                              </div>
                              <div className="list-actions">
                                {!a.completed && a.joinCode ? (
                                  <button
                                    className="btn-soft btn-small"
                                    onClick={() => {
                                      setJoinCode(String(a.joinCode || "").toUpperCase());
                                      joinTest();
                                    }}
                                    disabled={attemptBusy || busy}
                                  >
                                    Resume
                                  </button>
                                ) : null}
                                <button
                                  className="btn-soft btn-small"
                                  onClick={() => {
                                    setSelectedAttempt(a);
                                    viewAttempt(a.quizId);
                                  }}
                                  disabled={attemptBusy}
                                >
                                  View
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="hint">No attempts yet.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {isStudent && selectedAttemptDetail ? (
              <section className="card evaluation">
                <h3>Checked Answers (Review)</h3>
                {!selectedAttemptDetail.status?.canSeeAi ? (
                  <p className="hint">AI checking in progress. Your checked results will appear after publish time.</p>
                ) : null}
                {selectedAttemptResult && !selectedAttemptResult.pending ? (
                  <div className="evaluation gap-top">
                    {selectedAttemptResult.remark?.label ? (
                      <p className="result-remark">
                        <span className="result-emoji" aria-hidden>{selectedAttemptResult.remark.emoji || ""}</span>
                        <span>{selectedAttemptResult.remark.label}</span>
                      </p>
                    ) : null}
                    <p>Average Score: {selectedAttemptResult.averagePercentage}%</p>
                    {typeof selectedAttemptResult.marksObtained === "number" ? (
                      <p>
                        Total Marks: {selectedAttemptResult.marksObtained} / {selectedAttemptResult.totalMarks}
                      </p>
                    ) : null}
                    {selectedAttemptResult.teacherOverallRemark ? (
                      <p className="hint">Teacher Remark: {selectedAttemptResult.teacherOverallRemark}</p>
                    ) : null}
                  </div>
                ) : null}
                {(selectedAttemptDetail.responses || []).map((r) => (
                  <div key={r.question?.id} className="evaluation">
                    <p className="prompt">{r.question?.prompt}</p>
                    {r.question?.type === "mcq" ? (
                      <p className="hint">
                        Your Choice:{" "}
                        {typeof r.mcqChoice === "number" && Array.isArray(r.question?.choices)
                          ? r.question.choices[r.mcqChoice] || `Option ${r.mcqChoice + 1}`
                          : "Not recorded"}
                      </p>
                    ) : (
                      <p className="hint">Your Answer: {r.answer}</p>
                    )}
                    {r.percentage !== null ? <p>AI Score: {r.percentage}%</p> : <p className="hint">AI Score: Pending</p>}
                    {r.marksAwarded !== null ? <p>AI Marks: {r.marksAwarded}</p> : <p className="hint">AI Marks: Pending</p>}
                    {r.explanation ? (
                      <details className="explain">
                        <summary>AI Explanation</summary>
                        <p className="hint">{String(r.explanation).slice(0, 900)}</p>
                      </details>
                    ) : null}
                    {r.teacherMarksAwarded !== null ? <p>Teacher Marks: {r.teacherMarksAwarded}</p> : null}
                    {r.teacherFeedback ? <p className="hint">Teacher Feedback: {r.teacherFeedback}</p> : null}
                  </div>
                ))}
              </section>
            ) : null}

            {question ? (
              <section className="card quiz-card">
                <div className="question-head">
                  <span>Test: {joinedTest?.title || "Evalo Test"}</span>
                  <span className="pill">Q{question.number}/{question.total}</span>
                  <span className="pill">{question.difficulty}</span>
                  <span className="pill">{question.type === "mcq" ? "MCQ" : "Subjective"}</span>
                  <span className="pill danger">Time Left: {formatTime(timeLeftSec)}</span>
                  {marksInfo?.totalMarks ? (
                    <span className="pill">Marks: {marksInfo.totalMarks}</span>
                  ) : null}
                </div>

                <div className={`exam-stage ${fullscreenLocked ? "locked" : ""}`}>
                  <div className="exam-content">
                    <p className="prompt">{question.prompt}</p>

                    <form className="form-grid" onSubmit={submitAnswer}>
                      {question.type === "mcq" ? (
                        <div className="mcq-box">
                          <p className="hint">Select one option:</p>
                          <div className="mcq-list">
                            {(question.choices || []).map((c, idx) => (
                              <label key={idx} className={`mcq-option ${mcqChoice === idx ? "active" : ""}`}>
                                <input
                                  type="radio"
                                  name="mcq"
                                  checked={mcqChoice === idx}
                                  onChange={() => setMcqChoice(idx)}
                                />
                                <span>{c}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <label>
                          Your Answer
                          <textarea
                            rows={8}
                            minLength={10}
                            required
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            onCopy={(e) => {
                              e.preventDefault();
                              sendProctorEvent("copy_attempt", { source: "textarea" });
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              sendProctorEvent("paste_attempt", { source: "textarea" });
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              sendProctorEvent("paste_attempt", { source: "drop" });
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onBeforeInput={(e) => {
                              const t = e?.nativeEvent?.inputType || "";
                              if (t === "insertFromPaste" || t === "insertFromDrop") {
                                e.preventDefault();
                                sendProctorEvent("paste_attempt", { source: t });
                              }
                            }}
                          />
                        </label>
                      )}
                      <button type="submit" disabled={busy || fullscreenLocked}>
                        {busy ? "Evaluating..." : "Submit Answer"}
                      </button>
                    </form>
                  </div>

                  {fullscreenLocked ? (
                    <div className="fullscreen-overlay">
                      <div className="fullscreen-card">
                        <p className="fullscreen-title">Fullscreen Required</p>
                        <p className="hint">Questions are blurred until fullscreen is active.</p>
                        <button type="button" onClick={requestFullscreenNow}>
                          Return to Fullscreen
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {lastEvaluation ? (
              <section className="card evaluation">
                <h3>Latest Answer Evaluation</h3>
                <p>Correctness: {lastEvaluation.percentage}%</p>
                {typeof lastEvaluation.marksAwarded === "number" ? (
                  <p>
                    Marks: {lastEvaluation.marksAwarded} / {lastEvaluation.marksPerQuestion ?? "-"}
                  </p>
                ) : null}
                {typeof lastEvaluation.cheatingPenalty === "number" ? (
                  <p>Cheating Penalty: {lastEvaluation.cheatingPenalty}%</p>
                ) : null}
                <p className="hint">{lastEvaluation.feedback}</p>
                {lastEvaluation.explanation ? (
                  <details className="explain">
                    <summary>AI Explanation</summary>
                    <p className="hint">{String(lastEvaluation.explanation).slice(0, 900)}</p>
                  </details>
                ) : null}
              </section>
            ) : null}

            {result ? (
              <section className="card evaluation">
                <h2>Test Completed</h2>
                {result.remark?.label ? (
                  <p className="result-remark">
                    <span className="result-emoji" aria-hidden>{result.remark.emoji || ""}</span>
                    <span>{result.remark.label}</span>
                  </p>
                ) : null}
                <p>Average Score: {result.averagePercentage}%</p>
                {typeof result.marksObtained === "number" ? (
                  <p>
                    Total Marks: {result.marksObtained} / {result.totalMarks}
                  </p>
                ) : null}
                {result.teacherOverallRemark ? <p className="hint">Teacher Remark: {result.teacherOverallRemark}</p> : null}
                <p>
                  Level Progression: {result.levelProgression.started} → {result.levelProgression.ended}
                </p>
                <p>
                  Proctor Risk: {result.proctoring?.riskScore ?? 0}% | Warnings: {result.proctoring?.warningCount ?? 0}
                </p>
                <p className="hint">
                  Beginner: {result.difficultyBreakdown.beginner ?? "-"} | Intermediate: {result.difficultyBreakdown.intermediate ?? "-"} | Advanced: {result.difficultyBreakdown.advanced ?? "-"}
                </p>
              </section>
            ) : null}
          </>
        )
        }
      </main >
    </div >
  );
}
