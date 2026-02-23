import React from "react";
import { motion } from "framer-motion";
import "../styles/Footer.css";

const Footer = ({ user, activePage, navigateTo, setAuthOpen, onShowStatus, pushToast }) => {
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleLinkClick = (page, targetId, requiresAuth = false) => {
        if (requiresAuth && !user) {
            setAuthOpen(true);
            return;
        }

        // Restrict Admin access to Student and Teacher views
        if (user?.role === "admin" && (targetId === "teacher-panel" || targetId === "student-join")) {
            if (navigateTo) navigateTo("home");
            if (pushToast) {
                pushToast("To access these, login to Student account and Teachers Account", "warning");
            }
            return;
        }

        if (navigateTo) {
            navigateTo(page, targetId);
        }
    };

    return (
        <footer className="evalo-footer">
            <div className="footer-glow-top"></div>
            <div className="back-to-top-wrap">
                <motion.div
                    className="back-to-top"
                    onClick={scrollToTop}
                    whileHover={{ y: -5, scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                </motion.div>
            </div>

            <div className="footer-container">
                {/* 1. Brand Section */}
                <div className="footer-brand-segment">
                    <div className="brand-identity-v2">
                        <div className="logo-glow-wrap">
                            <img src="/evalo-logo.png" alt="Evalo" className="footer-logo-premium" />
                        </div>
                        <div className="brand-text-v2">
                            <h2 className="gradient-text">Evalo</h2>
                            <p className="premium-tagline">Adaptive AI Intelligence</p>
                        </div>
                    </div>
                    <p className="brand-summary">
                        The world's most advanced AI-powered examination platform. Self-evolving intelligence with hybrid scoring, real-time proctoring, and deep predictive analytics.
                    </p>
                    <div className="social-wrap-v2">
                        <a href="https://github.com/evalo-ai" className="social-btn" aria-label="GitHub" target="_blank" rel="noopener noreferrer">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                        </a>
                        <a href="https://linkedin.com" className="social-btn" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                        </a>
                        <a href="https://twitter.com" className="social-btn" aria-label="Twitter" target="_blank" rel="noopener noreferrer">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
                        </a>
                    </div>
                </div>

                {/* 2. Platform Columns */}
                <div className="footer-links-grid">
                    <div className="footer-nav-col">
                        <h4 className="nav-col-title" onClick={() => handleLinkClick("home", "features-section")}>Intelligence</h4>
                        <ul className="nav-list-v2">
                            <li onClick={() => handleLinkClick("home", "features-section")}>Adaptive Assessment</li>
                            <li onClick={() => handleLinkClick("admin", "teacher-panel", true)}>Teacher Dashboard</li>
                            <li onClick={() => handleLinkClick("home", "features-section")}>AI Proctored Exams</li>
                        </ul>
                    </div>
                    <div className="footer-nav-col">
                        <h4 className="nav-col-title" onClick={() => handleLinkClick("admin", "admin-section", true)}>Security</h4>
                        <ul className="nav-list-v2">
                            <li onClick={() => handleLinkClick("home", "features-section")}>Live Monitoring</li>
                            <li onClick={() => handleLinkClick("admin", "admin-section", true)}>Audit Logs</li>
                            <li onClick={() => handleLinkClick("admin", "admin-section", true)}>Global Settings</li>
                        </ul>
                    </div>
                    <div className="footer-nav-col">
                        <h4 className="nav-col-title" onClick={() => handleLinkClick("admin", "teacher-panel", true)}>Insights</h4>
                        <ul className="nav-list-v2">
                            <li onClick={() => handleLinkClick("admin", "teacher-panel", true)}>Test Analytics</li>
                            <li onClick={() => handleLinkClick("home", "student-join", true)}>Student Reports</li>
                            <li onClick={() => handleLinkClick("admin", "admin-section", true)}>Admin Control</li>
                        </ul>
                    </div>
                    <div className="footer-nav-col">
                        <h4 className="nav-col-title">Portal</h4>
                        <ul className="nav-list-v2">
                            <li onClick={() => handleLinkClick("admin", "admin-section", true)}>Management</li>
                            <li onClick={onShowStatus}>System Status</li>
                        </ul>
                    </div>
                </div>

                {/* 3. Secure Badge Area */}
                <div className="footer-badge-segment">
                    <div className="premium-security-card">
                        <div className="card-icon-glow">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#63f2de" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <div className="card-content">
                            <h5>Enterprise Shield</h5>
                            <p>Hardened AI proctoring active. Encryption enabled for all data streams.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Bottom Bar */}
            <div className="footer-dashboard">
                <div className="dashboard-content">
                    <div className="dashboard-left">
                        <span className="dash-label">POWERED BY</span>
                        <div className="dash-stack">
                            <span>REACT</span>
                            <span className="separator">•</span>
                            <span>OPENAI</span>
                            <span className="separator">•</span>
                            <span>NODE.JS</span>
                        </div>
                    </div>

                    <div className="dashboard-right">
                        <div className="status-indicator" onClick={onShowStatus} style={{ cursor: "pointer" }}>
                            <div className="pulse-dot"></div>
                            <span className="status-text">ENGINE V1.0 ACTIVE</span>
                        </div>
                        <div className="security-tag">
                            <span className="tag-inner">SECURE MODE: ON</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="copyright-strip">
                <p>&copy; 2026 EVALO AI. ADVANCING EDUCATIONAL INTEGRITY WORLDWIDE.</p>
            </div>
        </footer>
    );
};

export default Footer;
