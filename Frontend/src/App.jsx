import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";

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

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function digitsOnly(value) {
  return String(value || "").replace(/[^\d]/g, "");
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
      <div className="logo5d-stack" aria-hidden>
        <span className="layer l1">Evalo</span>
        <span className="layer l2">Evalo</span>
        <span className="layer l3">Evalo</span>
      </div>
      <span className="logo5d-main">Evalo</span>
      <span className="logo5d-sub">Adaptive AI Exam Intelligence</span>
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
        <h3>{mode === "login" ? "Welcome Back to Evalo" : "Create Evalo Account"}</h3>
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

        <div className="row gap-top">
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

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminCanEditRoles, setAdminCanEditRoles] = useState(false);

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
    initialLevel: "intermediate"
  });
  const [createdTest, setCreatedTest] = useState(null);

  const [joinCode, setJoinCode] = useState("");
  const [quizId, setQuizId] = useState("");
  const [joinedTest, setJoinedTest] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
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

  const [reviewTestId, setReviewTestId] = useState("");
  const [testAttempts, setTestAttempts] = useState([]);
  const [reviewQuizId, setReviewQuizId] = useState("");
  const [reviewDetail, setReviewDetail] = useState(null);
  const [reviewEdits, setReviewEdits] = useState({});

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
      const { data } = await axios.get(`${API_BASE}/quizzes/${quizIdToView}`, authConfig(token));
      setSelectedAttemptDetail(data);
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
      const payload = {
        publishFinal,
        responses: Object.entries(reviewEdits).map(([questionId, v]) => ({
          questionId,
          teacherMarksAwarded: Number(v.teacherMarksAwarded),
          teacherFeedback: v.teacherFeedback
        }))
      };
      await axios.patch(`${API_BASE}/quizzes/${reviewQuizId}/review`, payload, authConfig(token));
      if (publishFinal) {
        pushToast("Results published successfully.", "success");
        setReviewDetail(null);
        setReviewQuizId("");
        setReviewEdits({});
        await loadTestAttempts(reviewTestId);
      } else {
        pushToast("Draft saved.", "success");
        await loadReviewQuiz(reviewQuizId);
        await loadTestAttempts(reviewTestId);
      }
    } catch (err) {
      setError(appError(err, "Unable to submit review."));
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

      const payload = {
        title: createTestForm.title || "Evalo Test",
        bookSessionId,
        durationMinutes,
        questionCount,
        totalMarks,
        initialLevel: createTestForm.initialLevel
      };

      const { data } = await axios.post(`${API_BASE}/tests`, payload, authConfig(token));
      setCreatedTest(data.test);
      await loadRoleData();
      pushToast(`Test created. Join code: ${data.test?.joinCode || "-"}`, "success");
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
          videoRef.current?.play?.().catch(() => {});
        };
        await videoRef.current.play().catch(() => {});
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
      if (!document.fullscreenElement) {
        sendProctorEvent("fullscreen_exit", { source: "fullscreenchange" }, nextQuizId);
      }
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
      document.exitFullscreen().catch(() => {});
    }

    proctorListenersRef.current.forEach(([eventName, handler, target]) => {
      target.removeEventListener(eventName, handler);
    });
    proctorListenersRef.current = [];

    setCameraReady(false);
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
      const { data } = await axios.post(
        `${API_BASE}/quiz/${quizId}/answer`,
        { answer },
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

      <header className="topbar">
        <Logo5D />
        <div className="topbar-actions">
          <button className="btn-soft" onClick={() => setActivePage("home")}>Home</button>
          {isTeacher ? (
            <button className="btn-soft" onClick={() => setActivePage("admin")}>Admin</button>
          ) : null}
          {!user ? (
            <button onClick={() => setAuthOpen(true)}>Login / Sign Up</button>
          ) : (
            <>
              <span className="role-badge">{user.name} ({user.role})</span>
              <button onClick={logout}>Logout</button>
            </>
          )}
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
                <button onClick={refreshAdminUsers} disabled={adminBusy}>{adminBusy ? "Refreshing..." : "Refresh Users"}</button>
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
              </>
            )}
          </section>
        ) : (
          <>
            <section className="card hero-card">
              <h1>Evalo Smart Examination Platform</h1>
              <p className="subtitle">
                Role-based exam orchestration, adaptive subjective questions, timer-based tests, and AI proctoring risk warnings.
              </p>
              <div className="pill-wrap">
                <span className="pill">Camera + Mic Proctoring</span>
                <span className="pill">Auto Fullscreen Enforcement</span>
                <span className="pill">Adaptive Subjective Evaluation</span>
              </div>
            </section>

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
                      Initial Level
                      <select
                        value={createTestForm.initialLevel}
                        onChange={(e) => setCreateTestForm((p) => ({ ...p, initialLevel: e.target.value }))}
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </label>
                    <button type="button" onClick={createTest} disabled={busy}>
                      {busy ? "Creating..." : "Create Test"}
                    </button>
                  </div>

                  {createdTest ? (
                    <div className="evaluation">
                      <h3>Latest Test Created</h3>
                      <p>{createdTest.title}</p>
                      <p className="big-code">Join Code: {createdTest.joinCode}</p>
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
                        {teacherBooks.map((book) => (
                          <li key={book.id}>
                            <span>{book.title || book.fileNames?.[0] || book.id.slice(0, 8)}</span>
                            <button className="btn-soft" onClick={() => setBookSessionId(book.id)}>
                              Use
                            </button>
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
                          <li key={test.id}>
                            <span>{test.title}</span>
                            <span className="pill">Code: {test.joinCode}</span>
                            {test.totalMarks ? <span className="pill">Marks: {test.totalMarks}</span> : null}
                            <button className="btn-soft" onClick={() => loadTestAttempts(test.id)} disabled={attemptBusy}>
                              Review
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hint">No tests yet.</p>
                    )}
                  </div>

                  {reviewTestId ? (
                    <div className="evaluation">
                      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                        <h3 style={{ margin: 0 }}>Test Attempts</h3>
                        <button
                          type="button"
                          className="btn-soft"
                          onClick={() => setShowPublishedAttempts((v) => !v)}
                        >
                          {showPublishedAttempts ? "Hide Published" : "Show Published"}
                        </button>
                      </div>
                      {(testAttempts || []).filter((a) => (showPublishedAttempts ? true : !a.teacherPublishedAt)).length ? (
                        <ul className="flat-list">
                          {testAttempts
                            .filter((a) => (showPublishedAttempts ? true : !a.teacherPublishedAt))
                            .map((a) => (
                            <li key={a.quizId}>
                              <span>{a.studentName || a.studentEmail || a.userId}</span>
                              <span className="pill">{a.completed ? "Completed" : "In progress"}</span>
                              {a.teacherPublishedAt ? <span className="pill">Published</span> : <span className="pill danger">Needs Review</span>}
                              <button className="btn-soft" onClick={() => loadReviewQuiz(a.quizId)} disabled={attemptBusy}>
                                Open
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="hint">{showPublishedAttempts ? "No attempts yet." : "No pending attempts. Published results are hidden."}</p>
                      )}
                    </div>
                  ) : null}

                  {reviewDetail ? (
                    <div className="evaluation">
                      <h3>Teacher Review</h3>
                      <p className="hint">
                        Quiz: {reviewDetail.quizId}{" "}
                        {reviewDetail.status?.teacherPublishedAt ? "(Final published)" : "(Draft)"}
                      </p>
                      <div className="form-grid">
                        {(reviewDetail.responses || []).map((r) => (
                          <div key={r.question?.id} className="evaluation">
                            <p className="prompt">{r.question?.prompt}</p>
                            <p className="hint">Student Answer: {r.answer}</p>
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
                        <div className="row">
                          <button type="button" className="btn-soft" onClick={() => submitReview(false)} disabled={attemptBusy}>
                            Save Draft
                          </button>
                          <button type="button" onClick={() => submitReview(true)} disabled={attemptBusy}>
                            Publish Final Marks
                          </button>
                        </div>
                      </div>
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
                    <button className="btn-soft" onClick={loadMyAttempts} disabled={attemptBusy}>
                      {attemptBusy ? "Loading..." : "Refresh"}
                    </button>
                  </div>
                  <div className="evaluation gap-top">
                    {myAttempts.length ? (
                      <ul className="flat-list">
                        {myAttempts.map((a) => (
                          <li key={a.quizId}>
                            <span>{a.testTitle || "Test"}</span>
                            <span className="pill">{a.completed ? "Completed" : "In progress"}</span>
                            <button
                              className="btn-soft"
                              onClick={() => {
                                setSelectedAttempt(a);
                                viewAttempt(a.quizId);
                              }}
                              disabled={attemptBusy}
                            >
                              View
                            </button>
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
                {(selectedAttemptDetail.responses || []).map((r) => (
                  <div key={r.question?.id} className="evaluation">
                    <p className="prompt">{r.question?.prompt}</p>
                    <p className="hint">Your Answer: {r.answer}</p>
                    {r.percentage !== null ? <p>AI Score: {r.percentage}%</p> : <p className="hint">AI Score: Pending</p>}
                    {r.marksAwarded !== null ? <p>AI Marks: {r.marksAwarded}</p> : <p className="hint">AI Marks: Pending</p>}
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
                  <span className="pill danger">Time Left: {formatTime(timeLeftSec)}</span>
                  {marksInfo?.totalMarks ? (
                    <span className="pill">Marks: {marksInfo.totalMarks}</span>
                  ) : null}
                </div>

                <p className="prompt">{question.prompt}</p>

                <form className="form-grid" onSubmit={submitAnswer}>
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
                  <button type="submit" disabled={busy}>{busy ? "Evaluating..." : "Submit Answer"}</button>
                </form>
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
              </section>
            ) : null}

            {result ? (
              <section className="card evaluation">
                <h2>Test Completed</h2>
                <p>Average Score: {result.averagePercentage}%</p>
                {typeof result.marksObtained === "number" ? (
                  <p>
                    Total Marks: {result.marksObtained} / {result.totalMarks}
                  </p>
                ) : null}
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
        )}
      </main>
    </div>
  );
}
