import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Footer from "./components/Footer";
import CommandPalette from "./components/CommandPalette";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import KnowledgeOrbit from "./components/KnowledgeOrbit";
import SoundscapeEngine from "./components/SoundscapeEngine";



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

    autoTable(doc, {
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

    // Detailed Responses Table
    yPos = doc.lastAutoTable.finalY + 15;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFont(undefined, "bold");
    doc.setFontSize(14);
    doc.setTextColor(10, 95, 127);
    doc.text("Question-wise Analysis", 20, yPos);

    const detailedBody = (attempt.responses || []).map((r, idx) => {
      const respText = r.answer || (typeof r.mcqChoice === 'number' ? `Option ${r.mcqChoice + 1}` : "N/A");
      const analysis = r.feedback || r.aiReasoning || "No specific feedback recorded.";
      return [
        `Q${idx + 1}`,
        respText,
        `${r.percentage}%`,
        analysis
      ];
    });

    autoTable(doc, {
      startY: yPos + 6,
      head: [["Q#", "Your Answer", "Score", "AI Analysis & Feedback"]],
      body: detailedBody,
      theme: "striped",
      headStyles: { fillColor: [10, 95, 127], fontSize: 9 },
      styles: { fontSize: 8, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 65 },
        2: { cellWidth: 20 },
        3: { cellWidth: 80 }
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

function Logo5D({ onHome }) {
  return (
    <motion.div
      className="logo5d"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      onClick={onHome}
      style={{ cursor: onHome ? 'pointer' : 'default' }}
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
          <h3>Welcome to Evalo</h3>
        </div>
        {error ? <p className="error">{error}</p> : null}

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {mode === "signup" && (
            <>
              <label>
                Full Name
                <input
                  value={form.name}
                  onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                I am a:
                <select
                  className="input-select"
                  value={form.role}
                  onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}
                  required
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher / Professor</option>
                </select>
              </label>
            </>
          )}
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

function AddUserModal({ open, onClose, onSubmit, busy, form, setForm, error }) {
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
          <h3>Add New User (Admin)</h3>
        </div>
        {error ? <p className="error">{error}</p> : null}

        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label>
            Full Name
            <input
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              required
              placeholder="e.g. John Doe"
            />
          </label>
          <label>
            Role
            <select
              className="input-select"
              value={form.role}
              onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}
              required
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
              required
              placeholder="user@evalo.ai"
            />
          </label>
          <label>
            Temp Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
              required
              placeholder="Min 6 characters"
            />
          </label>
          <div className="row gap-top modal-footer-spaced">
            <button type="button" className="btn-soft" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function PendingApprovalView({ user, onRefresh, busy }) {
  return (
    <div className="card big-card centered-text" style={{ padding: '4rem 2rem' }}>
      <img src="/evalo-logo.png" alt="Evalo" style={{ width: '80px', marginBottom: '2rem' }} />
      <div className="gap-top">
        <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 800 }}>Welcome to Evalo, {user.name}!</h2>
        <div className="pill warning" style={{ fontSize: '1.2rem', padding: '0.8rem 1.5rem', display: 'inline-block' }}>
          🔒 Your Account is Pending Approval
        </div>
        <p className="subtitle gap-top" style={{ maxWidth: '600px', margin: '2rem auto', fontSize: '1.1rem', color: '#def0ff' }}>
          Our administrators are currently reviewing your request for a <strong>{user.role}</strong> account.
          You will gain full access to Evalo's features once your profile is verified.
          Please check back shortly!
        </p>
        <div className="row gap-top" style={{ justifyContent: 'center' }}>
          <button className="cta-button" onClick={onRefresh} disabled={busy}>
            <span>{busy ? "Checking..." : "Check Approval Status"}</span>
          </button>
        </div>
        <div className="row gap-top" style={{ justifyContent: 'center', gap: '1rem', opacity: 0.5 }}>
          <div className="feature-tag">Proctored Exams</div>
          <div className="feature-tag">AI Analysis</div>
          <div className="feature-tag">Real-time Analytics</div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsModal({ open, onClose, data }) {
  if (!open || !data) return null;

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-glass analytics-modal"
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3>📊 Test Analytics: {data.testTitle}</h3>
          <button className="btn-close" onClick={onClose} style={{ background: "none", border: "none", color: "white", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
        </div>

        {data.empty ? (
          <div className="empty-state" style={{ textAlign: "center", padding: "2rem" }}>
            <p className="hint">No student attempts yet for this test.</p>
          </div>
        ) : (
          <>
            <div className="analytics-visual" style={{ height: "300px", background: "rgba(0,0,0,0.2)", borderRadius: "16px", marginBottom: "1.5rem", overflow: "hidden", position: "relative" }}>
              <Canvas camera={{ position: [0, 0, 8] }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <KnowledgeOrbit data={data} />
                <OrbitControls enableZoom={false} />
              </Canvas>
              <div style={{ position: "absolute", bottom: "10px", right: "15px", pointerEvents: "none", fontSize: "0.7rem", opacity: 0.5 }}>
                Interactive 3D Knowledge Map
              </div>
            </div>
            <div className="analytics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div className="stat-card" style={{ padding: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                <label style={{ fontSize: "0.8rem", opacity: 0.7 }}>Average Score</label>
                <div className="stat-value" style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.5rem 0" }}>{data.averageScore} / {data.maxMarks}</div>
                <div className="mini-progress-bar" style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    className="mini-progress-fill"
                    style={{ width: `${(data.averageScore / data.maxMarks) * 100}%`, height: "100%", background: "#3b82f6" }}
                  />
                </div>
              </div>

              <div className="stat-card" style={{ padding: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                <label style={{ fontSize: "0.8rem", opacity: 0.7 }}>Highest Score</label>
                <div className="stat-value" style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.5rem 0" }}>{data.highestScore}</div>
              </div>

              <div className="stat-card" style={{ padding: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                <label style={{ fontSize: "0.8rem", opacity: 0.7 }}>Completion Rate</label>
                <div className="stat-value" style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.5rem 0" }}>{data.completionRate}%</div>
                <p className="hint" style={{ fontSize: "0.75rem" }}>{data.completedCount} / {data.totalStudents} students</p>
              </div>

              <div className="stat-card" style={{ padding: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                <label style={{ fontSize: "0.8rem", opacity: 0.7 }}>Average Proctor Risk</label>
                <div className="stat-value" style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.5rem 0" }}>{data.averageRisk}%</div>
                <p className="hint" style={{ fontSize: "0.75rem" }}>Risk: {data.averageRisk < 30 ? "Low" : data.averageRisk < 55 ? "Medium" : "High"}</p>
              </div>

              <div className="risk-dist-section" style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
                <h4 style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>🛡️ Proctoring Risk Distribution</h4>
                <div className="risk-bar-chart" style={{ display: "flex", height: "12px", borderRadius: "6px", overflow: "hidden", background: "rgba(255,255,255,0.1)" }}>
                  <div className="risk-segment" style={{ flex: data.riskDistribution?.low || 0, background: "#10b981" }} title="Low Risk"></div>
                  <div className="risk-segment" style={{ flex: data.riskDistribution?.medium || 0, background: "#f59e0b" }} title="Medium Risk"></div>
                  <div className="risk-segment" style={{ flex: data.riskDistribution?.high || 0, background: "#ef4444" }} title="High Risk"></div>
                  <div className="risk-segment" style={{ flex: data.riskDistribution?.critical || 0, background: "#7f1d1d" }} title="Critical Risk"></div>
                </div>
                <div className="risk-legend" style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.7rem", opacity: 0.8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><i style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></i> Low</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><i style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b", display: "inline-block" }}></i> Med</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><i style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", display: "inline-block" }}></i> High</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><i style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#7f1d1d", display: "inline-block" }}></i> Crit</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="modal-actions" style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-soft" onClick={onClose}>Close</button>
        </div>
      </motion.div>

    </div>
  );
}

function ProctorLogModal({ open, onClose, logs }) {
  if (!open || !logs) return null;

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-glass proctor-modal"
        style={{ maxWidth: "800px", width: "90%" }}
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3>🔒 Proctoring Logs: {logs.studentName}</h3>
          <button className="btn-close" onClick={onClose} style={{ background: "none", border: "none", color: "white", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
        </div>

        <div className="proctor-summary" style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="pill" style={{ background: logs.proctor.riskScore > 50 ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)" }}>
            Risk Score: {logs.proctor.riskScore}%
          </div>
          <div className="pill">Warnings: {logs.proctor.warningCount}</div>
        </div>

        <div className="log-container" style={{ maxHeight: "400px", overflowY: "auto", background: "rgba(0,0,0,0.1)", borderRadius: "8px", padding: "0.5rem" }}>
          {logs.proctor.events && logs.proctor.events.length > 0 ? (
            <table className="log-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.05)", textAlign: "left" }}>
                  <th style={{ padding: "0.75rem" }}>Time</th>
                  <th style={{ padding: "0.75rem" }}>Event</th>
                  <th style={{ padding: "0.75rem" }}>Risk</th>
                  <th style={{ padding: "0.75rem" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.proctor.events.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: e.riskScore > 50 ? "rgba(239, 68, 68, 0.05)" : "transparent" }}>
                    <td style={{ padding: "0.75rem" }}>{new Date(e.at).toLocaleTimeString()}</td>
                    <td style={{ padding: "0.75rem", textTransform: "capitalize" }}>{e.type.replace(/_/g, " ")}</td>
                    <td style={{ padding: "0.75rem" }}>{e.riskScore}%</td>
                    <td style={{ padding: "0.75rem" }} className="hint">{typeof e.meta === "object" ? JSON.stringify(e.meta) : String(e.meta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-hint" style={{ textAlign: "center", padding: "2rem" }}>No proctoring events logged.</p>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-soft" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </div>
  );
}

import VoiceAssistant from "./components/VoiceAssistant";
import ProfilePage from "./components/ProfilePage";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("home");
  const [toasts, setToasts] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({ allowCopyPaste: false });
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  // Theme State
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('evalo_theme') !== 'light';
  });

  useEffect(() => {
    if (darkMode) {
      document.body.classList.remove('light-mode');
      localStorage.setItem('evalo_theme', 'dark');
    } else {
      document.body.classList.add('light-mode');
      localStorage.setItem('evalo_theme', 'light');
    }
  }, [darkMode]);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", role: "student" });

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminCanEditRoles, setAdminCanEditRoles] = useState(false);
  const [adminTests, setAdminTests] = useState([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);


  const navigateTo = (page, targetId) => {
    setActivePage(page);
    if (targetId) {
      // Force scroll to top first to reset position if we were at the footer
      window.scrollTo(0, 0);
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const [adminTestsBusy, setAdminTestsBusy] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const cmdkContext = {
    user,
    navigateTo,
    logout,
    toggleCopyPaste: () => updateGlobalSecurity(!globalSettings.allowCopyPaste),
  };

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [addUserError, setAddUserError] = useState("");

  const [teacherBooks, setTeacherBooks] = useState([]);
  const [bookFiles, setBookFiles] = useState([]);
  const [bookSessionId, setBookSessionId] = useState("");
  const [uploadStats, setUploadStats] = useState(null);
  const [teacherTests, setTeacherTests] = useState([]);
  const [createTestForm, setCreateTestForm] = useState({
    title: "",
    durationMinutes: 35,
    questionCount: 1,
    totalMarks: 100,
    difficulty: "medium",
    questionFormat: "subjective",
    topic: "",
    startsAt: (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
    })(),
    mcqCount: 0,
    subjectiveCount: 0
  });
  const [createdTest, setCreatedTest] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Restore draft from localStorage on mount
  useEffect(() => {
    if (!draftRestored) {
      try {
        const savedDraft = localStorage.getItem('evalo_test_draft');
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          setCreateTestForm(draft);
          pushToast('📝 Draft restored from previous session', 'success');
        }
      } catch (err) {
        console.error('Failed to restore draft:', err);
      }
      setDraftRestored(true);
    }
  }, [draftRestored]);

  // Auto-save draft to localStorage every 10 seconds
  useEffect(() => {
    if (!draftRestored) return;
    const timer = setInterval(() => {
      try {
        localStorage.setItem('evalo_test_draft', JSON.stringify(createTestForm));
      } catch (err) {
        console.error('Failed to save draft:', err);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [createTestForm, draftRestored]);

  const [editingTestId, setEditingTestId] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [quizId, setQuizId] = useState("");
  const [joinedTest, setJoinedTest] = useState(null);
  const [testAnalytics, setTestAnalytics] = useState(null);
  const [proctorLogs, setProctorLogs] = useState(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showProctorModal, setShowProctorModal] = useState(false);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [mcqChoice, setMcqChoice] = useState(null);
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [result, setResult] = useState(null);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [proctor, setProctor] = useState({ riskScore: 0, warningCount: 0, warningMessages: [] });
  const [proctorAlert, setProctorAlert] = useState("");
  const [marksInfo, setMarksInfo] = useState({ totalMarks: null, marksPerQuestion: null });

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState(""); // "saving", "saved", "error"
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const autoSaveTimerRef = useRef(null);

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
  const lastAutoSaveAnswerRef = useRef("");

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher" || user?.role === "admin";
  const isStudent = user?.role === "student" || user?.role === "admin";
  const examActive = Boolean(quizId && question && !result);
  const [showPublishedAttempts, setShowPublishedAttempts] = useState(false);

  // Bulk publish state
  const [selectedQuizIds, setSelectedQuizIds] = useState([]);
  const [bulkPublishing, setBulkPublishing] = useState(false);

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

    setToasts((prev) => {
      // Prevent duplicate messages in the same stack
      if (prev.some((t) => t.message === message)) return prev;
      return [...prev, { id, message, tone }].slice(-5);
    });

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

        // Fetch global settings
        const sRes = await axios.get(`${API_BASE}/settings`);
        setGlobalSettings(sRes.data);
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
          : { name: authForm.name, email: authForm.email, password: authForm.password, role: authForm.role };

      const { data } = await axios.post(`${API_BASE}${endpoint}`, payload);
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthOpen(false);
      setAuthError("");
      setAuthForm({ name: "", email: "", password: "", role: "student" });
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

  async function deleteTest(testId) {
    if (!token || !confirm("Are you sure you want to delete this test and all its attempts?")) return;
    try {
      await axios.delete(`${API_BASE}/tests/${testId}`, authConfig(token));
      pushToast("Test deleted successfully.", "success");
      loadRoleData();
    } catch (err) {
      pushToast(appError(err, "Failed to delete test."), "danger");
    }
  }

  async function clearMyHistory() {
    if (!token || !confirm("Are you sure you want to clear your entire test history?")) return;
    try {
      await axios.delete(`${API_BASE}/users/me/quizzes`, authConfig(token));
      pushToast("History cleared successfully.", "success");
      loadMyAttempts();
    } catch (err) {
      pushToast(appError(err, "Failed to clear history."), "danger");
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
      setSelectedQuizIds([]); // Clear selection when loading new test
    } catch (err) {
      setError(appError(err, "Unable to load test attempts."));
    } finally {
      setAttemptBusy(false);
    }
  }

  async function fetchTestAnalytics(testId) {
    setBusy(true);
    try {
      const { data } = await axios.get(`${API_BASE}/tests/${testId}/analytics`, authConfig(token));
      setTestAnalytics(data);
      setShowAnalyticsModal(true);
    } catch (err) {
      pushToast(appError(err, "Failed to load analytics"), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function fetchProctorLogs(quizId) {
    setBusy(true);
    try {
      const { data } = await axios.get(`${API_BASE}/quiz/${quizId}/proctor-logs`, authConfig(token));
      setProctorLogs(data);
      setShowProctorModal(true);
    } catch (err) {
      pushToast(appError(err, "Failed to load proctor logs"), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function bulkPublishResults() {
    if (!reviewTestId || selectedQuizIds.length === 0) return;

    setBulkPublishing(true);
    try {
      const { data } = await axios.post(
        `${API_BASE}/tests/${reviewTestId}/bulk-publish`,
        { quizIds: selectedQuizIds },
        authConfig(token)
      );

      if (data.successCount > 0) {
        pushToast(`✅ Published ${data.successCount} result(s) successfully!`, "success");
      }
      if (data.failureCount > 0) {
        pushToast(`⚠️ ${data.failureCount} result(s) could not be published. Check individual errors.`, "error");
      }

      // Reload attempts to reflect changes
      await loadTestAttempts(reviewTestId);
      setSelectedQuizIds([]);
    } catch (err) {
      setError(appError(err, "Bulk publish failed."));
    } finally {
      setBulkPublishing(false);
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
      pushToast("User role updated.", "success");
    } catch (err) {
      pushToast(appError(err, "Failed to update role."), "error");
    } finally {
      setAdminBusy(false);
    }
  }

  async function addUser() {
    if (!isAdmin) return;
    setAdminBusy(true);
    setAddUserError("");
    try {
      await axios.post(`${API_BASE}/admin/users/add`, addUserForm, authConfig(token));
      pushToast("User added successfully.", "success");
      setAddUserOpen(false);
      setAddUserForm({ name: "", email: "", password: "", role: "student" });
      await refreshAdminUsers();
    } catch (err) {
      setAddUserError(appError(err, "Failed to add user."));
    } finally {
      setAdminBusy(false);
    }
  }

  async function deleteUser(userId) {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    setAdminBusy(true);
    try {
      await axios.delete(`${API_BASE}/admin/users/${userId}`, authConfig(token));
      pushToast("User deleted successfully.", "success");
      await refreshAdminUsers();
    } catch (err) {
      pushToast(appError(err, "Failed to delete user."), "error");
    } finally {
      setAdminBusy(false);
    }
  }

  async function refreshMyProfile() {
    if (!token) return;
    setBusy(true);
    try {
      const { data } = await axios.get(`${API_BASE}/auth/me`, authConfig(token));
      setUser(data.user);
      if (data.user.isApproved) {
        pushToast("Welcome! Your account is approved.", "success");
      } else {
        pushToast("Status checked: Still pending.", "info");
      }
    } catch (err) {
      pushToast(appError(err, "Failed to refresh profile."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function approveUser(userId, isApproved) {
    if (!token || !isAdmin) return;
    setAdminBusy(true);
    try {
      await axios.patch(`${API_BASE}/admin/users/${userId}/approve`, { isApproved }, authConfig(token));
      await refreshAdminUsers();
      pushToast(isApproved ? "User approved." : "Approval revoked.", "success");
    } catch (err) {
      setError(appError(err, "Approval update failed."));
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

  // Clear draft from localStorage and reset form
  function clearDraft() {
    try {
      localStorage.removeItem('evalo_test_draft');
      setCreateTestForm({
        title: "",
        durationMinutes: 35,
        questionCount: 6,
        totalMarks: 100,
        difficulty: "medium",
        questionFormat: "subjective",
        topic: "",
        startsAt: (() => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          return tomorrow.toISOString().slice(0, 16);
        })(),
        mcqCount: 0,
        subjectiveCount: 0
      });
      pushToast('🗑️ Draft cleared', 'success');
    } catch (err) {
      console.error('Failed to clear draft:', err);
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

      if (!createTestForm.startsAt) {
        throw new Error("Start Date and Time are required.");
      }

      // Validate mixed format
      if (createTestForm.questionFormat === "mixed") {
        if (createTestForm.mcqCount + createTestForm.subjectiveCount !== questionCount) {
          throw new Error(`Mixed format: MCQ (${createTestForm.mcqCount}) + Subjective (${createTestForm.subjectiveCount}) must equal total questions (${questionCount})`);
        }
        if (createTestForm.mcqCount < 1 || createTestForm.subjectiveCount < 1) {
          throw new Error("Mixed format requires at least 1 MCQ and 1 Subjective question.");
        }
      }

      const startsAtIso = new Date(createTestForm.startsAt).toISOString();

      const payload = {
        title: createTestForm.title || "Evalo Test",
        bookSessionId,
        durationMinutes,
        questionCount,
        totalMarks,
        difficulty: createTestForm.difficulty,
        topic: createTestForm.topic,
        questionFormat: createTestForm.questionFormat,
        startsAt: startsAtIso,
        // Include mixed format configuration
        ...(createTestForm.questionFormat === "mixed" && {
          mcqCount: createTestForm.mcqCount,
          subjectiveCount: createTestForm.subjectiveCount
        })
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
      const { data } = await axios.post(`${API_BASE}/tests/join`, { joinCode, rollNo }, authConfig(token));
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
      // Auto-cancel exam when cheating reaches 100%
      if ((data.riskScore || 0) >= 100) {
        pushToast("⛔ Exam auto-terminated: Cheating limit (100%) reached.", "danger");
        forceResult(targetQuizId);
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
    const onPaste = (e) => {
      if (globalSettings.allowCopyPaste) return;
      blockedAction(e, "paste_attempt");
    };
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

  // Auto-save function - saves answer every 30 seconds
  async function autoSaveAnswer() {
    if (!quizId || !answer || answer === lastAutoSaveAnswerRef.current) {
      return; // No changes to save
    }

    try {
      setAutoSaveStatus("saving");
      const response = await axios.patch(
        `${API_BASE}/quiz/${quizId}/autosave`,
        { answer },
        authConfig(token)
      );

      if (response.data.saved) {
        setAutoSaveStatus("saved");
        setLastSavedAt(new Date());
        lastAutoSaveAnswerRef.current = answer;

        // Clear status after 2 seconds
        setTimeout(() => setAutoSaveStatus(""), 2000);
      }
    } catch (err) {
      console.error("Auto-save failed:", err);
      setAutoSaveStatus("error");
      setTimeout(() => setAutoSaveStatus(""), 3000);
    }
  }

  // Update word and character count when answer changes
  useEffect(() => {
    const words = answer.trim().split(/\s+/).filter(w => w.length > 0);
    setWordCount(words.length);
    setCharacterCount(answer.length);
  }, [answer]);

  // Auto-save effect - runs every 30 seconds
  useEffect(() => {
    if (!quizId || !question || result) {
      return; // Don't auto-save if quiz is not active
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    // Set up auto-save timer
    autoSaveTimerRef.current = setInterval(() => {
      autoSaveAnswer();
    }, 30000); // 30 seconds

    // Cleanup on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [quizId, question, result, answer]);

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
        setLastEvaluation(null);
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

  // Background polling for result updates (every 30 seconds if result is pending)
  useEffect(() => {
    if (!token || !result || result.teacherPublishedAt) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/quiz/${quizId}/result`, authConfig(token));
        if (data && data.teacherPublishedAt) {
          setResult(data);
          pushToast("🎉 Your marks have been published by the teacher!", "success");
        }
      } catch (err) {
        // fail silently
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [token, result, quizId]);

  async function refreshResultSync() {
    if (!token || !result) return;
    setBusy(true);
    try {
      const { data } = await axios.get(`${API_BASE}/quiz/${result.quizId || result.id}/result`, authConfig(token));
      setResult(data || result);
      if (data?.teacherPublishedAt) {
        pushToast("Scores updated.", "success");
      } else {
        pushToast("Scores are still pending teacher review.", "info");
      }
    } catch (err) {
      setError(appError(err, "Sync failed."));
    } finally {
      setBusy(false);
    }
  }

  async function updateGlobalSettings(allow) {
    let password = "";
    if (allow) {
      password = prompt("SECURITY CHECK: Please re-type your ADMINISTRATOR password to enable global copy-paste functionality:");
      if (password === null) return; // User cancelled
      if (!password.trim()) {
        pushToast("Password is required to change this setting.", "error");
        return;
      }
    }

    setSettingsBusy(true);
    try {
      const { data } = await axios.post(
        `${API_BASE}/settings`,
        { allowCopyPaste: allow, password },
        authConfig(token)
      );
      if (data.ok) {
        setGlobalSettings(data.settings);
        pushToast(`Global copy-paste ${allow ? "ENABLED" : "DISABLED"}.`, "success");
      }
    } catch (err) {
      setError(appError(err, "Settings update failed."));
    } finally {
      setSettingsBusy(false);
    }
  }

  // Marks-based tests: teacher controls question count and duration directly.

  if (booting) {
    return <div className="boot">Loading Evalo...</div>;
  }

  return (
    <div className="app-shell">
      <Suspense fallback={<div className="scene-wrap scene-fallback" />}>
        <AnimatedScene role={user?.role || "guest"} />
      </Suspense>

      <div className="toast-stack" aria-live="polite" aria-relevant="additions removals">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast ${t.tone || "info"}`}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              layout
            >
              <span>{t.message}</span>
              <button
                type="button"
                className="toast-x"
                aria-label="Dismiss notification"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Analytics Modal */}
      <AnalyticsModal
        open={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        data={testAnalytics}
      />

      {/* Proctoring Log Modal */}
      <ProctorLogModal
        open={showProctorModal}
        onClose={() => setShowProctorModal(false)}
        logs={proctorLogs}
      />

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
          <Logo5D onHome={() => setActivePage("home")} />
          <div className="nav-actions">
            {!user ? (
              <button className="cta-button" onClick={() => setAuthOpen(true)}><span>Login / Sign Up</span></button>
            ) : (
              <>
                {(isTeacher || isAdmin) && user.isApproved ? (
                  <button className="btn-soft" onClick={() => setActivePage("admin")}>
                    {isAdmin ? "Admin Control" : "Teacher Hub"}
                  </button>
                ) : null}
                <span
                  className="role-badge"
                  onClick={() => setActivePage("profile")}
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  title="Go to Profile"
                >
                  {user.name} ({user.role})
                </span>
                <button onClick={logout}>Logout</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="main-grid">
        {error ? <p className="error wide">{error}</p> : null}
        {proctorAlert ? <p className="warning wide">{proctorAlert}</p> : null}

        {user && !user.isApproved && user.role !== 'admin' && activePage === "home" ? (
          <PendingApprovalView user={user} onRefresh={refreshMyProfile} busy={busy} />
        ) : (
          <>
            {activePage === "profile" ? (
              <ProfilePage
                user={user}
                onLogout={logout}
                pushToast={pushToast}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                myAttempts={myAttempts}
                onViewResult={(a) => {
                  setSelectedAttempt(a);
                  viewAttempt(a.quizId);
                  setActivePage("home");
                }}
                onClearHistory={clearMyHistory}
                busy={attemptBusy}
                setActivePage={setActivePage}
              />
            ) : activePage === "admin" ? (
              <section id="admin-section" className="card big-card">
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
                    <div className="row" style={{ justifyContent: 'space-between' }}>
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
                      {isAdmin && (
                        <button className="btn-success" onClick={() => setAddUserOpen(true)}>
                          + Add User
                        </button>
                      )}
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
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
                                <span className={`pill ${(u.isApproved || u.role === 'admin') ? 'success' : 'warning'}`}>
                                  {(u.isApproved || u.role === 'admin') ? 'Approved' : 'Pending'}
                                </span>
                              </td>
                              <td className="row" style={{ gap: '8px' }}>
                                {adminCanEditRoles ? (
                                  <>
                                    <select
                                      value={u.role}
                                      onChange={(e) => updateUserRole(u.id, e.target.value)}
                                      disabled={adminBusy || u.id === user?.id || u.role === 'admin'}
                                      title={u.role === 'admin' ? "Admins are protected." : ""}
                                    >
                                      <option value="student">student</option>
                                      <option value="teacher">teacher</option>
                                      <option value="admin">admin</option>
                                    </select>
                                    {u.role !== 'admin' && (
                                      <>
                                        <button
                                          className={`btn-small ${u.isApproved ? 'btn-danger' : 'btn-success'}`}
                                          onClick={() => approveUser(u.id, !u.isApproved)}
                                          disabled={adminBusy}
                                        >
                                          {u.isApproved ? 'Revoke' : 'Approve'}
                                        </button>
                                        <button
                                          className="btn-danger btn-small"
                                          onClick={() => deleteUser(u.id)}
                                          disabled={adminBusy}
                                          title="Delete User"
                                        >
                                          Delete
                                        </button>
                                      </>
                                    )}
                                  </>
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
                            <h3>More Admin Functions</h3>
                            <span className="pill success">System Control</span>
                          </div>
                          <p className="hint">Utility functions for platform maintenance and auditing.</p>
                          <div className="row gap-top">
                            <button className="btn-soft btn-small" onClick={() => pushToast("Audit Log fetched (Demo)", "info")}>
                              View Audit Logs
                            </button>
                            <button className="btn-soft btn-small" onClick={() => pushToast("Cache cleared (Demo)", "info")}>
                              Clear System Cache
                            </button>
                            <button className="btn-soft btn-small" onClick={() => pushToast("Storage optimized (Demo)", "info")}>
                              Optimize Storage
                            </button>
                          </div>
                        </div>

                        <div className="evaluation gap-top">
                          <div className="list-header">
                            <h3>Global Exam Settings</h3>
                            <span className="pill success">System-wide</span>
                          </div>
                          <p className="hint">Control shared behaviors across all student tests platform-wide.</p>
                          <div className="row gap-top" style={{ alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ flex: 1 }}>
                              <strong style={{ display: 'block', marginBottom: '4px' }}>Allow Copy-Paste in Tests</strong>
                              <p className="hint" style={{ margin: 0, fontSize: '0.85rem' }}>
                                {globalSettings.allowCopyPaste
                                  ? "Students can currently paste text into answer boxes."
                                  : "Pasting is strictly blocked. Enabling this requires admin password verification."}
                              </p>
                            </div>
                            <label className="switch">
                              <input
                                type="checkbox"
                                checked={globalSettings.allowCopyPaste}
                                onChange={(e) => updateGlobalSettings(e.target.checked)}
                                disabled={settingsBusy}
                              />
                              <span className="slider round"></span>
                            </label>
                          </div>
                        </div>

                        <div className="evaluation gap-top">
                          <div className="list-header">
                            <h3>Platform Reset</h3>
                            <span className="pill danger">High Risk</span>
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


                {user?.role === "teacher" ? (
                  <section id="teacher-panel" className="card split-card">
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
                            min="1"
                            max="20"
                            step="1"
                            value={createTestForm.questionCount}
                            inputMode="numeric"
                            onChange={(e) => {
                              const raw = digitsOnly(e.target.value);
                              setCreateTestForm((p) => ({ ...p, questionCount: raw ? Number(raw) : 0 }));
                            }}
                            onBlur={(e) => {
                              const normalized = normalizeIntString(e.target.value, 1, 20, 1);
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
                          Start Date *
                          <input
                            type="date"
                            value={createTestForm.startsAt ? createTestForm.startsAt.split('T')[0] : ''}
                            onChange={(e) => {
                              const currentTime = createTestForm.startsAt ? createTestForm.startsAt.split('T')[1] || '09:00' : '09:00';
                              setCreateTestForm((p) => ({ ...p, startsAt: e.target.value ? `${e.target.value}T${currentTime}` : '' }));
                            }}
                            required
                          />
                        </label>
                        <label>
                          Start Time *
                          <input
                            type="time"
                            value={createTestForm.startsAt ? createTestForm.startsAt.split('T')[1] || '' : ''}
                            onChange={(e) => {
                              const currentDate = createTestForm.startsAt ? createTestForm.startsAt.split('T')[0] : new Date().toISOString().split('T')[0];
                              setCreateTestForm((p) => ({ ...p, startsAt: e.target.value ? `${currentDate}T${e.target.value}` : '' }));
                            }}
                            required
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
                            onChange={(e) => {
                              const format = e.target.value;
                              setCreateTestForm((p) => {
                                // If switching to mixed, set default split
                                if (format === "mixed") {
                                  const half = Math.floor(p.questionCount / 2);
                                  return {
                                    ...p,
                                    questionFormat: format,
                                    mcqCount: half,
                                    subjectiveCount: p.questionCount - half
                                  };
                                }
                                return { ...p, questionFormat: format, mcqCount: 0, subjectiveCount: 0 };
                              });
                            }}
                          >
                            <option value="subjective">Subjective</option>
                            <option value="mcq">MCQ</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </label>

                        {createTestForm.questionFormat === "mixed" && (
                          <>
                            <label>
                              MCQ Questions *
                              <input
                                type="number"
                                min="1"
                                max={createTestForm.questionCount - 1}
                                value={createTestForm.mcqCount}
                                onChange={(e) => {
                                  const mcq = parseInt(e.target.value) || 0;
                                  setCreateTestForm((p) => ({
                                    ...p,
                                    mcqCount: mcq,
                                    subjectiveCount: p.questionCount - mcq
                                  }));
                                }}
                                required
                              />
                            </label>
                            <label>
                              Subjective Questions *
                              <input
                                type="number"
                                min="1"
                                max={createTestForm.questionCount - 1}
                                value={createTestForm.subjectiveCount}
                                onChange={(e) => {
                                  const subj = parseInt(e.target.value) || 0;
                                  setCreateTestForm((p) => ({
                                    ...p,
                                    subjectiveCount: subj,
                                    mcqCount: p.questionCount - subj
                                  }));
                                }}
                                required
                              />
                            </label>
                            <p className="hint" style={{ marginTop: '-10px', fontSize: '0.85em', color: createTestForm.mcqCount + createTestForm.subjectiveCount === createTestForm.questionCount ? '#63f2de' : '#ff6b6b' }}>
                              {createTestForm.mcqCount} MCQ + {createTestForm.subjectiveCount} Subjective = {createTestForm.mcqCount + createTestForm.subjectiveCount} / {createTestForm.questionCount} total
                              {createTestForm.mcqCount + createTestForm.subjectiveCount !== createTestForm.questionCount && " ⚠️ Must equal total!"}
                            </p>
                          </>
                        )}
                        <div className="row">
                          <button type="button" onClick={createTest} disabled={busy}>
                            {busy ? "Saving..." : editingTestId ? "Save Changes" : "Create / Schedule Test"}
                          </button>
                          <button
                            type="button"
                            className="btn-soft btn-small"
                            onClick={clearDraft}
                            disabled={busy}
                            title="Clear draft and reset form"
                          >
                            🗑️ Clear Draft
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
                        <h3>My Tests</h3>
                        {teacherTests.length ? (
                          <div className="test-grid">
                            {teacherTests.map((test) => (
                              <div key={test.id} className="test-card">
                                {/* Card Header */}
                                <div className="test-card-header">
                                  <h4 className="test-card-title">{test.title}</h4>
                                  <div className="test-card-code">
                                    {test.joinCode}
                                  </div>
                                </div>

                                {/* Card Body - Metadata */}
                                <div className="test-card-body">
                                  {/* Question Format */}
                                  <div className="test-meta-row">
                                    <span className="test-meta-label">📝 Format:</span>
                                    {test.questionFormat === "mixed" && test.mcqCount && test.subjectiveCount ? (
                                      <span className="format-badge mixed">
                                        {test.mcqCount} MCQ + {test.subjectiveCount} Subjective
                                      </span>
                                    ) : (
                                      <span className="format-badge">
                                        {test.questionFormat === "mcq" ? "🔘 MCQ" :
                                          test.questionFormat === "subjective" ? "✍️ Subjective" :
                                            "📋 Mixed"}
                                      </span>
                                    )}
                                  </div>

                                  {/* Topic */}
                                  {test.topic && (
                                    <div className="test-meta-row">
                                      <span className="test-meta-label">📚 Topic:</span>
                                      <span className="test-meta-value">{test.topic}</span>
                                    </div>
                                  )}

                                  {/* Marks & Duration */}
                                  <div className="test-meta-row">
                                    <span className="test-meta-label">📊 Marks:</span>
                                    <span className="test-meta-value">{test.totalMarks} pts</span>
                                    <span style={{ marginLeft: '12px', color: '#aac8e4' }}>⏱️ {test.durationMinutes || 35} min</span>
                                  </div>

                                  {/* Difficulty */}
                                  {test.difficulty && (
                                    <div className="test-meta-row">
                                      <span className="test-meta-label">🎯 Difficulty:</span>
                                      <span className="test-meta-value" style={{
                                        color: test.difficulty === 'easy' ? '#63f2de' :
                                          test.difficulty === 'hard' ? '#ff6b6b' : '#ffd93d'
                                      }}>
                                        {test.difficulty.charAt(0).toUpperCase() + test.difficulty.slice(1)}
                                      </span>
                                    </div>
                                  )}

                                  {/* Start Date/Time */}
                                  {test.startsAt && (
                                    <div className="test-meta-row">
                                      <span className="test-meta-label">🗓️ {Date.now() < new Date(test.startsAt).getTime() ? "Starts:" : "Started:"}</span>
                                      <span className="test-meta-value">{formatShortDateTime(test.startsAt)}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Card Footer - Actions */}
                                <div className="test-card-footer">
                                  <button
                                    className="btn-card-primary"
                                    onClick={() => loadTestAttempts(test.id)}
                                    disabled={attemptBusy}
                                  >
                                    👥 Review Submissions
                                  </button>
                                  <button
                                    className="btn-card-secondary"
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
                                        startsAt: isoToLocalDatetimeInput(test.startsAt),
                                        mcqCount: test.mcqCount || 0,
                                        subjectiveCount: test.subjectiveCount || 0
                                      }));
                                      setCreateTestOpen(true);
                                      pushToast("Editing test settings.", "info");
                                    }}
                                    disabled={attemptBusy}
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    className="btn-card-secondary danger"
                                    onClick={() => deleteTest(test.id)}
                                    style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="empty-state">
                            <div className="empty-state-icon">📝</div>
                            <p className="empty-state-text">No tests created yet. Create your first test above!</p>
                          </div>
                        )}
                      </div>

                      {reviewTestId ? (() => {
                        // Find the test being reviewed
                        const currentTest = teacherTests.find(t => t.id === reviewTestId);

                        return (
                          <div className="evaluation">
                            <div className="list-header">
                              <h3>Test Attempts{currentTest ? `: ${currentTest.title}` : ''}</h3>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {selectedQuizIds.length > 0 && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn-primary btn-small"
                                      onClick={bulkPublishResults}
                                      disabled={bulkPublishing}
                                    >
                                      {bulkPublishing ? '⏳ Publishing...' : `📤 Publish Selected (${selectedQuizIds.length})`}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-soft btn-small"
                                      onClick={() => setSelectedQuizIds([])}
                                    >
                                      ✖ Clear
                                    </button>
                                  </>
                                )}
                                <button type="button" className="btn-soft btn-small" onClick={() => setShowPublishedAttempts((v) => !v)}>
                                  {showPublishedAttempts ? "🔽 Hide Published" : "🔼 Show Published"}
                                </button>
                              </div>
                            </div>
                            {(() => {
                              const visible = (testAttempts || []).filter((a) => {
                                // Hide finalized attempts (published 3+ times)
                                if (Number(a.publishCount) >= 3) return false;
                                // Show based on published toggle
                                return showPublishedAttempts ? true : (a.completed && !a.teacherPublishedAt);
                              });
                              return visible.length ? (
                                <div style={{ marginTop: '16px' }}>
                                  {visible.map((a) => {
                                    const isPublishable = a.completed && Number.isFinite(Number(a.teacherOverallMarks));
                                    const isSelected = selectedQuizIds.includes(a.quizId);

                                    return (
                                      <div key={a.quizId} className="attempt-card">
                                        <div className="attempt-info">
                                          {isPublishable && (
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setSelectedQuizIds([...selectedQuizIds, a.quizId]);
                                                } else {
                                                  setSelectedQuizIds(selectedQuizIds.filter(id => id !== a.quizId));
                                                }
                                              }}
                                              style={{ marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer' }}
                                            />
                                          )}
                                          <div className="attempt-name">
                                            {a.rollNo ? <span style={{ fontWeight: 600, color: '#63f2de', marginRight: '8px' }}>[{a.rollNo}]</span> : null}
                                            {a.studentName || a.studentEmail || a.userId}
                                          </div>
                                          <div className="attempt-status-row">
                                            {a.completed ? (
                                              <span className="pill pill-success">✓ Submitted</span>
                                            ) : (
                                              <span className="pill">🔄 In Progress</span>
                                            )}

                                            {a.teacherPublishedAt ? (
                                              <span className="pill" style={{ background: 'rgba(99, 242, 222, 0.2)', color: '#63f2de' }}>
                                                {Number(a.publishCount) >= 3 ? "✓ Finalized" : "📤 Published"}{" "}
                                                {a.publishCount ? `(${a.publishCount}/3)` : ""}
                                              </span>
                                            ) : a.completed ? (
                                              <span className="pill danger">⚠️ Needs Review</span>
                                            ) : (
                                              <span className="pill" style={{ opacity: 0.6 }}>⏳ Awaiting Submission</span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="attempt-actions">
                                          <button
                                            className="btn-card-primary"
                                            onClick={() => loadReviewQuiz(a.quizId)}
                                            disabled={attemptBusy}
                                            style={{ minWidth: '80px' }}
                                          >
                                            📝 Open
                                          </button>
                                          <button
                                            className="btn-card-secondary"
                                            onClick={() => fetchProctorLogs(a.quizId)}
                                            disabled={attemptBusy}
                                            style={{ minWidth: '80px' }}
                                            title="View proctoring logs"
                                          >
                                            🔒 Logs
                                          </button>
                                          {a.teacherPublishedAt && currentTest && (
                                            <button
                                              className="btn-card-secondary"
                                              onClick={() => generateStudentReportPDF(a, currentTest)}
                                              title="Download PDF Report"
                                              style={{ minWidth: '80px' }}
                                            >
                                              📄 PDF
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="empty-state">
                                  <div className="empty-state-icon">📋</div>
                                  <p className="empty-state-text">
                                    {showPublishedAttempts ? "No attempts yet." : "No pending submissions to review."}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })() : null}

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
                                  Student: {reviewDetail.studentName || reviewDetail.studentEmail || reviewDetail.studentId}
                                  {reviewDetail.rollNo ? ` | Roll No: ${reviewDetail.rollNo}` : ""}
                                </p>
                                <p className="hint" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                  Quiz ID: {reviewDetail.quizId} |
                                  Status: {reviewDetail.status?.teacherPublishedAt ? "Finalized" : "Draft"}
                                </p>
                                {publishReason ? <p className="warning">{publishReason}</p> : null}

                                <div className="form-grid">
                                  {(reviewDetail.responses || []).map((r) => (
                                    <div key={r.question?.id} className="evaluation" style={{ position: 'relative' }}>
                                      {r.isAI && (
                                        <span className="pill success" style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '10px', padding: '2px 8px' }}>
                                          🤖 AI Suggested
                                        </span>
                                      )}
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

                                      {r.isAI && (
                                        <div className="ai-feedback-box" style={{ background: 'rgba(59, 130, 246, 0.04)', marginBottom: '1rem', borderLeftColor: '#3b82f6' }}>
                                          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <strong>AI Analysis: {r.percentage}%</strong>
                                            {r.aiConfidence && <span className="hint" style={{ fontSize: '0.7rem' }}>Confidence: {Math.round(r.aiConfidence * 100)}%</span>}
                                          </div>
                                          <p className="hint" style={{ color: '#e2e8f0' }}>{r.feedback}</p>
                                          {r.aiReasoning && (
                                            <details style={{ marginTop: '0.5rem' }}>
                                              <summary className="ai-reasoning-summary" style={{ fontSize: '0.8rem' }}>View Logic</summary>
                                              <p className="hint" style={{ fontSize: '0.8rem', paddingTop: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem' }}>{r.aiReasoning}</p>
                                            </details>
                                          )}
                                        </div>
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
                  </section >
                ) : null
                }

                {user?.role === "student" ? (
                  <section id="student-join" className="card split-card">
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
                              onChange={(e) => setJoinCode(e.target.value.toUpperCase().trim())}
                              placeholder="e.g. A9P3QX"
                            />
                          </label>
                          <label>
                            Your Roll Number
                            <input
                              value={rollNo}
                              onChange={(e) => setRollNo(e.target.value.trim())}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (joinCode && rollNo && !busy) joinTest();
                                }
                              }}
                              placeholder="e.g. 2024-CS-01"
                            />
                          </label>
                          {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}
                          <button type="button" onClick={joinTest} disabled={busy || !joinCode || !rollNo}>
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
                        <div className="evaluation" style={{ padding: 0, background: 'none' }}>
                          {(() => {
                            const risk = proctor.riskScore || 0;
                            const riskColor = risk >= 80 ? '#ef4444' : risk >= 60 ? '#f97316' : risk >= 30 ? '#f59e0b' : '#10b981';
                            const riskMsg = risk >= 80 ? '🔴 Critical – will auto-terminate at 100%' : risk >= 60 ? '🚨 High risk – return to exam now' : risk >= 30 ? '⚠️ Suspicious activity detected' : '✅ Looking good – stay focused';
                            return (
                              <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${riskColor}33`, borderRadius: '14px', padding: '1rem', marginTop: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.8)' }}>⚠️ CHEATING CHANCES</span>
                                  <span style={{ fontWeight: 900, fontSize: '1.4rem', color: riskColor, transition: 'color 0.5s' }}>{risk}%</span>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '8px', height: '12px', overflow: 'hidden', marginBottom: '0.6rem' }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${risk}%`,
                                    background: `linear-gradient(90deg, ${riskColor}99, ${riskColor})`,
                                    borderRadius: '8px',
                                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s',
                                    boxShadow: `0 0 10px ${riskColor}66`
                                  }} />
                                </div>
                                <p style={{ fontSize: '0.75rem', color: riskColor, margin: '0 0 0.3rem', transition: 'color 0.5s' }}>{riskMsg}</p>
                                <p style={{ fontSize: '0.7rem', opacity: 0.45, margin: 0 }}>Warnings issued: {proctor.warningCount || 0}</p>
                              </div>
                            );
                          })()}
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
                ) : null
                }

                {
                  isStudent && selectedAttemptDetail ? (
                    <section className="card result-display" style={{ marginTop: '2rem' }}>
                      <div className="result-header">
                        <h2>Attempt Review</h2>
                        <div className="result-actions-bar">
                          <div className={`result-remark-badge ${!selectedAttemptDetail.status?.teacherPublishedAt ? 'pending' : ''}`}>
                            <span className="result-emoji">{!selectedAttemptDetail.status?.teacherPublishedAt ? "⏳" : "✅"}</span>
                            <span className="result-label">
                              {!selectedAttemptDetail.status?.teacherPublishedAt ? "Pending Teacher Review" : "Evaluation Finalized"}
                            </span>
                          </div>
                          {!selectedAttemptDetail.status?.teacherPublishedAt && (
                            <button className="btn-soft btn-small" onClick={refreshResultSync} disabled={busy}>
                              {busy ? "🔄 Syncing..." : "🔄 Refresh Scores"}
                            </button>
                          )}
                        </div>
                      </div>

                      {selectedAttemptResult && (
                        <div className="score-overview-grid">
                          <div className={`score-card ${!selectedAttemptDetail.status?.teacherPublishedAt ? 'pending-card' : 'final'}`}>
                            <div className="score-label-sub">Final Marks</div>
                            <div className="score-circle-new">
                              <div className="score-value-big">
                                {selectedAttemptDetail.status?.teacherPublishedAt ? (selectedAttemptResult.marksObtained || 0) : ".."}
                              </div>
                              <div className="score-max-small">/ {selectedAttemptResult.totalMarks || 0}</div>
                            </div>
                            <div className="score-status-text" style={{ color: selectedAttemptDetail.status?.teacherPublishedAt ? '#10b981' : '#fbbf24' }}>
                              {selectedAttemptDetail.status?.teacherPublishedAt ? "Validated" : "Under Review"}
                            </div>
                          </div>

                          <div className="score-card ai-prediction">
                            <div className="score-label-sub">AI Predicted Score</div>
                            <div className="score-circle-new">
                              <div className="score-value-big">
                                {String((selectedAttemptDetail.responses || []).reduce((sum, r) => sum + (r.marksAwarded || 0), 0).toFixed(1))}
                              </div>
                              <div className="score-max-small">/ {selectedAttemptResult.totalMarks || 0}</div>
                            </div>
                            <div className="score-status-text" style={{ color: '#3b82f6' }}>
                              Semantic Analysis
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="section-divider" style={{ margin: '3rem 0', height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                      <h3 style={{ marginBottom: '2rem' }}>Question-wise Analysis</h3>

                      {(selectedAttemptDetail.responses || []).map((r) => (
                        <div key={r.question?.id} className="evaluation" style={{ position: 'relative' }}>
                          {r.isAI && (
                            <span className="pill success" style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '10px', padding: '2px 8px' }}>
                              🤖 AI Evaluated
                            </span>
                          )}
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

                          <div className="row" style={{ gap: '1rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                            {r.percentage !== null ? (
                              <span className="stat-pill">AI Score: {r.percentage}%</span>
                            ) : (
                              <span className="stat-pill hint">AI Score: Pending</span>
                            )}
                            {r.marksAwarded !== null && (
                              <span className="stat-pill">Marks: {r.marksAwarded}</span>
                            )}
                            {r.teacherMarksAwarded !== null && (
                              <span className="stat-pill success">Teacher Marks: {r.teacherMarksAwarded}</span>
                            )}
                          </div>

                          {r.feedback && (
                            <div className="ai-feedback-box">
                              <p><strong>Feedback:</strong> {r.feedback}</p>
                            </div>
                          )}

                          {r.aiReasoning && (
                            <details className="explain" style={{ marginTop: '0.5rem' }}>
                              <summary className="ai-reasoning-summary">
                                <span>🧠 AI Reasoning</span>
                                {r.aiConfidence && (
                                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Confidence: {Math.round(r.aiConfidence * 100)}%</span>
                                    <div className="confidence-meter">
                                      <div className="confidence-fill" style={{ width: `${r.aiConfidence * 100}%` }} />
                                    </div>
                                  </div>
                                )}
                              </summary>
                              <p className="hint" style={{ marginTop: '0.5rem', borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '1rem' }}>
                                {r.aiReasoning}
                              </p>
                            </details>
                          )}

                          {!r.aiReasoning && r.explanation && (
                            <details className="explain">
                              <summary>Concept Reference</summary>
                              <p className="hint">{String(r.explanation).slice(0, 900)}</p>
                            </details>
                          )}

                          {r.teacherFeedback && (
                            <div className="teacher-overall-feedback" style={{ marginTop: '1rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                              <p className="hint"><strong>Teacher Feedback:</strong> {r.teacherFeedback}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </section>
                  ) : null
                }

                {
                  question ? (
                    <section className="card quiz-card">
                      <div className="question-head">
                        <span>Test: {joinedTest?.title || "Evalo Test"}</span>
                        <span className="pill">Q{question.number}/{question.total}</span>
                        <span className="pill">{question.difficulty}</span>
                        <span className="pill">{question.type === "mcq" ? "MCQ" : "Subjective"}</span>
                        <span className={`pill ${timeLeftSec < 300 ? "danger" : ""}`}>
                          ⏱️ {formatTime(timeLeftSec)}
                          {timeLeftSec < 300 && timeLeftSec > 0 ? " ⚠️" : ""}
                        </span>
                        {marksInfo?.totalMarks ? (
                          <span className="pill">Marks: {marksInfo.totalMarks}</span>
                        ) : null}
                        {autoSaveStatus && (
                          <span className={`pill ${autoSaveStatus === "saved" ? "success" : autoSaveStatus === "error" ? "danger" : ""}`}>
                            {autoSaveStatus === "saving" && "💾 Saving..."}
                            {autoSaveStatus === "saved" && "✓ Saved"}
                            {autoSaveStatus === "error" && "⚠️ Save failed"}
                          </span>
                        )}
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
                                  rows={10}
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
                                  placeholder="Type your detailed answer here..."
                                />
                                <div className="answer-stats">
                                  <span className="hint">Words: {wordCount} | Characters: {characterCount}</span>
                                  {lastSavedAt && (
                                    <span className="hint">Last saved: {lastSavedAt.toLocaleTimeString()}</span>
                                  )}
                                </div>
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
                  ) : null
                }

                {
                  lastEvaluation ? (
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
                  ) : null
                }

                {
                  result ? (
                    <section className="card result-display">
                      <div className="result-header">
                        <h2>🎉 Test Completed!</h2>
                        <div className="result-actions-bar">
                          <div className={`result-remark-badge ${!result.teacherPublishedAt ? 'pending' : ''}`}>
                            <span className="result-emoji">{!result.teacherPublishedAt ? "⏳" : (result.remark?.emoji || "✅")}</span>
                            <span className="result-label">
                              {!result.teacherPublishedAt ? "Pending for Teacher Review" : (result.remark?.label || "Test Evaluated")}
                            </span>
                          </div>
                          {!result.teacherPublishedAt && (
                            <button className="btn-soft btn-small" onClick={refreshResultSync} disabled={busy}>
                              {busy ? "🔄 Syncing..." : "🔄 Refresh Scores"}
                            </button>
                          )}
                          {result.teacherPublishedAt && (
                            <button
                              className="btn-soft btn-small"
                              onClick={() => generateStudentReportPDF(result, joinedTest || { title: result.testTitle, totalMarks: result.totalMarks })}
                              title="Download Results as PDF"
                            >
                              📄 Download PDF
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="score-overview-grid">
                        <div className={`score-card ${!result.teacherPublishedAt ? 'pending-card' : 'final'}`}>
                          <div className="score-label-sub">Final Marks</div>
                          <div className="score-circle-new">
                            <div className="score-value-big">
                              {result.teacherPublishedAt ? (result.marksObtained || 0) : ".."}
                            </div>
                            <div className="score-max-small">/ {result.totalMarks || 0}</div>
                          </div>
                          <div className="score-status-text" style={{ color: result.teacherPublishedAt ? '#10b981' : '#fbbf24' }}>
                            {result.teacherPublishedAt ? "Validated" : "Under Review"}
                          </div>
                        </div>

                        <div className="score-card ai-prediction">
                          <div className="score-label-sub">AI Predicted Score</div>
                          <div className="score-circle-new">
                            <div className="score-value-big">
                              {String((result.responses || []).reduce((sum, r) => sum + (r.marksAwarded || 0), 0).toFixed(1))}
                            </div>
                            <div className="score-max-small">/ {result.totalMarks || 0}</div>
                          </div>
                          <div className="score-status-text" style={{ color: '#3b82f6' }}>
                            Semantic Analysis
                          </div>
                        </div>
                      </div>

                      <div className="performance-stats" style={{ marginTop: '2rem' }}>
                        <div className="stat-card">
                          <div className="stat-icon">📊</div>
                          <div className="stat-content">
                            <div className="stat-label">Level Progression</div>
                            <div className="stat-value">
                              {result.levelProgression?.started || "N/A"} → {result.levelProgression?.ended || "N/A"}
                            </div>
                          </div>
                        </div>
                        {/* ... stats ... */}
                        <div className="stat-card">
                          <div className="stat-icon">🎯</div>
                          <div className="stat-content">
                            <div className="stat-label">Difficulty Breakdown</div>
                            <div className="stat-value stat-breakdown">
                              <span>Beg: {result.difficultyBreakdown?.beginner ?? 0}</span>
                              <span>Int: {result.difficultyBreakdown?.intermediate ?? 0}</span>
                              <span>Adv: {result.difficultyBreakdown?.advanced ?? 0}</span>
                            </div>
                          </div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-icon">🔒</div>
                          <div className="stat-content">
                            <div className="stat-label">Proctoring</div>
                            <div className="stat-value">
                              Risk: {result.proctoring?.riskScore ?? 0}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {result.teacherOverallRemark && (
                        <div className="teacher-overall-feedback" style={{ marginTop: '2.5rem', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>💬 Teacher's Comments</h3>
                          <p className="feedback-text" style={{ color: '#e2e8f0', lineHeight: '1.6', fontSize: '1.05rem' }}>{result.teacherOverallRemark}</p>
                        </div>
                      )}
                    </section>
                  ) : null
                }
              </>
            )}
          </>
        )}

      </main>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        context={cmdkContext}
      />
      <AddUserModal
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        onSubmit={addUser}
        busy={adminBusy}
        form={addUserForm}
        setForm={setAddUserForm}
        error={addUserError}
      />
      <Footer user={user} activePage={activePage} navigateTo={navigateTo} setAuthOpen={setAuthOpen} />
      {!examActive && <VoiceAssistant context={cmdkContext} onOpen={() => setIsCommandPaletteOpen(true)} />}
    </div>
  );
}
