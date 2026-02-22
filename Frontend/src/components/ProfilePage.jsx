import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ROLE_THEMES = {
    student: {
        gradient: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
        background: 'rgba(14, 165, 233, 0.05)',
        accent: '#38bdf8',
        shadow: '0 20px 40px rgba(14, 165, 233, 0.2)',
        icon: '🎓'
    },
    teacher: {
        gradient: 'linear-gradient(135deg, #10b981, #0f766e)',
        background: 'rgba(16, 185, 129, 0.05)',
        accent: '#34d399',
        shadow: '0 20px 40px rgba(16, 185, 129, 0.2)',
        icon: '🏫'
    },
    admin: {
        gradient: 'linear-gradient(135deg, #ef4444, #7f1d1d)',
        background: 'rgba(239, 68, 68, 0.05)',
        accent: '#f87171',
        shadow: '0 20px 40px rgba(239, 68, 68, 0.2)',
        icon: '⚡'
    },
    guest: {
        gradient: 'linear-gradient(135deg, #6366f1, #312e81)',
        background: 'rgba(99, 102, 241, 0.05)',
        accent: '#818cf8',
        shadow: '0 20px 40px rgba(99, 102, 241, 0.2)',
        icon: '👤'
    }
};

export default function ProfilePage({ user, onLogout, pushToast, myAttempts = [], onViewResult, darkMode, setDarkMode, setActivePage, onClearHistory, busy }) {
    if (!user) return null;

    const theme = ROLE_THEMES[user.role] || ROLE_THEMES.guest;
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [profilePic, setProfilePic] = useState(user.profilePic || null);
    const fileInputRef = useRef(null);

    // Settings
    const [notifications, setNotifications] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);

    const stats = getRoleStats(user);

    const handleSaveProfile = () => {
        setIsEditing(false);
        pushToast("Profile updated successfully!", "success");
    };

    const handleAction = (action) => {
        pushToast(`${action} action triggered`, "info");
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                pushToast("File size too large (max 5MB)", "warning");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePic(reader.result);
                pushToast("Photo uploaded successfully!", "success");
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemovePhoto = () => {
        setProfilePic(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        pushToast("Photo removed.", "info");
    };

    return (
        <div className="profile-wrapper">
            <div className="profile-container">
                {/* 1. Identity Header */}
                <motion.div
                    className="profile-header-premium"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: theme.background }}
                >
                    <div className="header-gradient-glow" style={{ background: theme.gradient }} />

                    <div className="header-content-top">
                        <div className="avatar-side">
                            <motion.div
                                className="premium-avatar-container"
                                whileHover={{ scale: 1.05 }}
                                onClick={() => isEditing && fileInputRef.current?.click()}
                            >
                                <div className="premium-avatar-inner" style={{ background: theme.gradient }}>
                                    {profilePic ? (
                                        <img src={profilePic} alt="Profile" className="avatar-image" />
                                    ) : (
                                        <span className="avatar-initial">{name.charAt(0).toUpperCase()}</span>
                                    )}
                                    {isEditing && (
                                        <div className="avatar-overlay-premium">
                                            <span>📷</span>
                                        </div>
                                    )}
                                </div>
                                <div className="avatar-ring" style={{ borderColor: theme.accent }} />
                            </motion.div>

                            {isEditing && (
                                <motion.div
                                    className="avatar-controls-premium"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept="image/*" />
                                    <button className="btn-small-premium" onClick={() => fileInputRef.current?.click()}>Update</button>
                                    {profilePic && <button className="btn-small-premium danger" onClick={handleRemovePhoto}>Remove</button>}
                                </motion.div>
                            )}
                        </div>

                        <div className="info-side">
                            <AnimatePresence mode="wait">
                                {isEditing ? (
                                    <motion.div
                                        key="edit"
                                        className="edit-fields-premium"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                    >
                                        <input className="input-premium" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" />
                                        <input className="input-premium" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="view"
                                        className="view-fields-premium"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                    >
                                        <h1 className="name-premium">{name}</h1>
                                        <p className="email-premium">{email}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="badges-row-premium">
                                <span className={`badge-premium role-${user.role}`} style={{ background: theme.background, borderColor: theme.accent, color: theme.accent }}>
                                    <span className="badge-icon">{theme.icon}</span>
                                    {user.role.toUpperCase()}
                                </span>
                                <span className="badge-premium light">
                                    EST. {new Date().getFullYear()}
                                </span>
                            </div>
                        </div>

                        <div className="actions-side">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`btn-primary-premium ${isEditing ? 'save' : 'edit'}`}
                                onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                                style={isEditing ? { background: theme.gradient } : {}}
                            >
                                {isEditing ? "Save Changes" : "Edit Profile"}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="btn-secondary-premium logout"
                                onClick={onLogout}
                            >
                                Logout
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* 2. Performance Stats */}
                <div className="stats-section-premium">
                    <h2 className="section-title">Performance Insights</h2>
                    <div className="stats-grid-premium">
                        {stats.map((stat, idx) => (
                            <motion.div
                                key={idx}
                                className="stat-card-premium"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                whileHover={{ y: -5, boxShadow: theme.shadow }}
                            >
                                <div className="stat-icon-premium" style={{ background: theme.background }}>{stat.icon}</div>
                                <div className="stat-value-premium">{stat.value}</div>
                                <div className="stat-label-premium">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* 3. Detailed Settings */}
                <div className="settings-grid-premium">
                    <motion.div
                        className="settings-card-premium glass"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <h3>System Preferences</h3>
                        <div className="pref-items">
                            <div className="pref-item-premium">
                                <div className="pref-label">
                                    <span className="label-text">Theme Mode</span>
                                    <span className="label-sub">Dark/Light balance</span>
                                </div>
                                <button className={`toggle-pill ${darkMode ? 'active' : ''}`} onClick={() => setDarkMode(!darkMode)} style={darkMode ? { background: theme.gradient } : {}}>
                                    {darkMode ? 'Dark' : 'Light'}
                                </button>
                            </div>
                            <div className="pref-item-premium">
                                <div className="pref-label">
                                    <span className="label-text">Email Sync</span>
                                    <span className="label-sub">Get real-time updates</span>
                                </div>
                                <button className={`toggle-pill ${notifications ? 'active' : ''}`} onClick={() => setNotifications(!notifications)} style={notifications ? { background: theme.gradient } : {}}>
                                    {notifications ? 'On' : 'Off'}
                                </button>
                            </div>
                            <div className="pref-item-premium">
                                <div className="pref-label">
                                    <span className="label-text">Motion Controls</span>
                                    <span className="label-sub">Restrict animations</span>
                                </div>
                                <button className={`toggle-pill ${reduceMotion ? 'active' : ''}`} onClick={() => setReduceMotion(!reduceMotion)} style={reduceMotion ? { background: theme.gradient } : {}}>
                                    {reduceMotion ? 'Reduced' : 'Full'}
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        className="settings-card-premium glass"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>{user.role === 'student' ? 'Recent Milestones' : user.role === 'admin' ? 'System Integrity' : 'Management Hub'}</h3>
                            {user.role === 'student' && myAttempts.length > 0 && (
                                <button
                                    className="btn-small-premium danger"
                                    onClick={onClearHistory}
                                    disabled={busy}
                                    style={{ fontSize: '0.7rem' }}
                                >
                                    🗑️ Clear All
                                </button>
                            )}
                        </div>
                        <div className="activity-container-premium">
                            {user.role === 'student' ? (
                                <div className="activity-list-premium">
                                    {myAttempts.length > 0 ? myAttempts.slice(0, 3).map((a, idx) => (
                                        <motion.div
                                            key={a.quizId || idx}
                                            className="activity-item-premium clickable"
                                            whileHover={{ x: 5, background: 'rgba(255,255,255,0.05)' }}
                                            onClick={() => onViewResult && onViewResult(a)}
                                        >
                                            <div className="activity-info-min">
                                                <span className="test-name-bold" style={{ fontWeight: '600', display: 'block' }}>{a.testTitle || "Untitled Test"}</span>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <small style={{ opacity: 0.6, fontSize: '0.8rem' }}>{a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "In Progress"}</small>
                                                    {a.teacherPublishedAt && <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>Finalized</span>}
                                                </div>
                                            </div>
                                            <span className={`score-pill ${a.completed ? 'high' : 'mid'}`} style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.85rem',
                                                background: a.completed ? 'rgba(59, 130, 246, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                                                color: a.completed ? '#60a5fa' : '#fbbf24',
                                                border: `1px solid ${a.completed ? 'rgba(59, 130, 246, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`
                                            }}>
                                                {a.completed ? (a.averagePercentage !== null ? `${Math.round(a.averagePercentage)}%` : "Done") : "Active"}
                                            </span>
                                        </motion.div>
                                    )) : (
                                        <div style={{ opacity: 0.5, padding: '20px', textAlign: 'center', fontSize: '0.9rem' }}>No recent test activity found.</div>
                                    )}
                                </div>
                            ) : user.role === 'admin' ? (
                                <div className="activity-list-premium">
                                    <div className="activity-item-premium clickable" onClick={() => setActivePage("admin")}>
                                        <div className="activity-info-min">
                                            <span className="test-name-bold" style={{ fontWeight: '600', display: 'block' }}>Node Performance</span>
                                            <small style={{ opacity: 0.6, fontSize: '0.8rem' }}>Infrastructure Check</small>
                                        </div>
                                        <span className="status-pill ok" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '4px 10px', borderRadius: '8px' }}>Optimal</span>
                                    </div>
                                    <div className="activity-item-premium clickable" onClick={() => setActivePage("admin")}>
                                        <div className="activity-info-min">
                                            <span className="test-name-bold" style={{ fontWeight: '600', display: 'block' }}>Security Review</span>
                                            <small style={{ opacity: 0.6, fontSize: '0.8rem' }}>Automated Scan</small>
                                        </div>
                                        <span className="status-pill warn" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '8px' }}>2 Flags</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="quick-grid-premium">
                                    <button className="btn-utility-premium" onClick={() => setActivePage("home")}>Question Bank</button>
                                    <button className="btn-utility-premium" onClick={() => setActivePage("home")}>Review Tests</button>
                                    <button className="btn-utility-premium" onClick={() => setActivePage("admin")}>Audit Users</button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>

            <style>{`
                .profile-wrapper {
                    min-height: 100vh;
                    padding-top: 5rem;
                    padding-bottom: 5rem;
                    color: white;
                    overflow-x: hidden;
                    background: transparent;
                }

                .profile-container {
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 0 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 3rem;
                }

                /* Header Styling */
                .profile-header-premium {
                    position: relative;
                    border-radius: 32px;
                    padding: 3rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    overflow: hidden;
                    backdrop-filter: blur(20px);
                    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
                }

                .header-gradient-glow {
                    position: absolute;
                    top: -50%;
                    right: -20%;
                    width: 400px;
                    height: 400px;
                    filter: blur(80px);
                    opacity: 0.15;
                    pointer-events: none;
                }

                .header-content-top {
                    display: flex;
                    align-items: center;
                    gap: 3rem;
                    position: relative;
                    z-index: 2;
                }

                /* Avatar */
                .premium-avatar-container {
                    position: relative;
                    width: 160px;
                    height: 160px;
                    cursor: pointer;
                }

                .premium-avatar-inner {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    font-size: 5rem;
                    font-weight: 800;
                    overflow: hidden;
                    position: relative;
                    z-index: 2;
                    box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
                }

                .avatar-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .avatar-ring {
                    position: absolute;
                    inset: -10px;
                    border: 2px solid;
                    border-radius: 50%;
                    opacity: 0.3;
                    transition: all 0.3s;
                }

                .premium-avatar-container:hover .avatar-ring {
                    inset: -15px;
                    opacity: 0.5;
                }

                .avatar-overlay-premium {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.4);
                    display: grid;
                    place-items: center;
                    font-size: 2rem;
                    backdrop-filter: blur(4px);
                }

                .avatar-controls-premium {
                    display: flex;
                    gap: 0.5rem;
                    margin-top: 1rem;
                    justify-content: center;
                }

                .btn-small-premium {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    padding: 0.4rem 0.8rem;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: 0.2s;
                }
                .btn-small-premium:hover { background: rgba(255,255,255,0.15); }
                .btn-small-premium.danger { color: #f87171; border-color: rgba(248, 113, 113, 0.2); }

                /* Info Section */
                .info-side {
                    flex: 1;
                }

                .name-premium {
                    font-size: 3.5rem;
                    font-weight: 900;
                    margin: 0;
                    letter-spacing: -2px;
                    line-height: 1;
                }

                .email-premium {
                    font-size: 1.2rem;
                    opacity: 0.6;
                    margin: 0.5rem 0 1.5rem;
                }

                .input-premium {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 0.8rem 1.2rem;
                    border-radius: 12px;
                    color: white;
                    font-size: 1.2rem;
                    width: 100%;
                    margin-bottom: 0.8rem;
                }

                .badges-row-premium {
                    display: flex;
                    gap: 1rem;
                }

                .badge-premium {
                    padding: 0.6rem 1.2rem;
                    border-radius: 14px;
                    font-size: 0.850rem;
                    font-weight: 800;
                    border: 1px solid;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    letter-spacing: 1px;
                }

                .badge-premium.light {
                    background: rgba(255,255,255,0.05);
                    border-color: rgba(255,255,255,0.1);
                    color: #94a3b8;
                }

                /* Actions */
                .actions-side {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    min-width: 200px;
                }

                .btn-primary-premium {
                    padding: 1rem 2rem;
                    border-radius: 16px;
                    border: none;
                    color: white;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
                }

                .btn-primary-premium.edit { background: white; color: black; }
                .btn-primary-premium.save { color: white; }

                .btn-secondary-premium {
                    padding: 1rem 2rem;
                    border-radius: 16px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                }

                .btn-secondary-premium.logout:hover {
                    background: rgba(239, 68, 68, 0.1);
                    border-color: rgba(239, 68, 68, 0.2);
                    color: #f87171;
                }

                /* Stats Section */
                .section-title {
                    font-size: 1.5rem;
                    font-weight: 800;
                    margin-bottom: 2rem;
                    opacity: 0.8;
                }

                .stats-grid-premium {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 2rem;
                }

                .stat-card-premium {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    padding: 2.5rem 2rem;
                    border-radius: 28px;
                    text-align: center;
                    backdrop-filter: blur(10px);
                }

                .stat-icon-premium {
                    width: 60px;
                    height: 60px;
                    border-radius: 18px;
                    margin: 0 auto 1.5rem;
                    display: grid;
                    place-items: center;
                    font-size: 1.8rem;
                }

                .stat-value-premium {
                    font-size: 2.5rem;
                    font-weight: 900;
                    margin-bottom: 0.5rem;
                }

                .stat-label-premium {
                    color: #64748b;
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 0.8rem;
                    letter-spacing: 1px;
                }

                /* Settings Grid */
                .settings-grid-premium {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 2rem;
                }

                .settings-card-premium {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    padding: 2.5rem;
                    border-radius: 32px;
                }

                .settings-card-premium h3 {
                    margin: 0 0 2rem;
                    font-size: 1.4rem;
                }

                .pref-items { display: flex; flex-direction: column; gap: 1.5rem; }

                .pref-item-premium {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .label-text { display: block; font-weight: 700; font-size: 1.1rem; }
                .label-sub { display: block; font-size: 0.85rem; color: #64748b; margin-top: 2px; }

                .toggle-pill {
                    padding: 0.6rem 1.4rem;
                    border-radius: 99px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(255,255,255,0.05);
                    color: #94a3b8;
                    font-weight: 600;
                    cursor: pointer;
                    transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .toggle-pill.active {
                    color: white;
                    border-color: transparent;
                    transform: scale(1.05);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
                }

                .activity-list-premium { display: flex; flex-direction: column; gap: 1rem; }
                .activity-item-premium {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255,255,255,0.02);
                    padding: 1rem 1.2rem;
                    border-radius: 14px;
                    border: 1px solid rgba(255,255,255,0.02);
                    transition: 0.2s;
                }
                .activity-item-premium.clickable { cursor: pointer; }
                .activity-item-premium.clickable:hover { 
                    background: rgba(255,255,255,0.06);
                    border-color: rgba(255,255,255,0.1);
                    transform: translateX(4px);
                }

                .score-pill { padding: 0.3rem 0.8rem; border-radius: 8px; font-weight: 800; font-size: 0.8rem; }
                .score-pill.high { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .score-pill.mid { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

                .status-pill { padding: 0.3rem 0.8rem; border-radius: 8px; font-weight: 800; font-size: 0.8rem; }
                .status-pill.ok { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .status-pill.warn { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

                .quick-grid-premium { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .btn-utility-premium {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    color: white;
                    padding: 1.5rem 1rem;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: 700;
                    transition: 0.2s;
                }
                .btn-utility-premium:hover { background: rgba(255,255,255,0.08); transform: translateY(-3px); }

                @media (max-width: 1024px) {
                    .header-content-top { flex-direction: column; text-align: center; }
                    .info-side { width: 100%; }
                    .actions-side { width: 100%; flex-direction: row; justify-content: center; }
                    .badges-row-premium { justify-content: center; }
                    .name-premium { font-size: 2.8rem; }
                }

                @media (max-width: 600px) {
                    .settings-grid-premium { grid-template-columns: 1fr; }
                    .actions-side { flex-direction: column; }
                    .stats-grid-premium { grid-template-columns: 1fr; }
                    .profile-header-premium { padding: 2rem 1.5rem; }
                    .name-premium { font-size: 2.2rem; }
                }
            `}</style>
        </div>
    );
}

function getRoleStats(user) {
    switch (user.role) {
        case 'student':
            return [
                { icon: '📊', value: '85%', label: 'Completion Rate' },
                { icon: '🏆', value: 'A-', label: 'Average Score' },
                { icon: '🛡️', value: 'High', label: 'Trust Score' },
                { icon: '✅', value: '12', label: 'Tests Taken' }
            ];
        case 'teacher':
            return [
                { icon: '📝', value: '8', label: 'Tests Created' },
                { icon: '👥', value: '45', label: 'Student Reach' },
                { icon: '📚', value: '120', label: 'Question Bank' }
            ];
        case 'admin':
            return [
                { icon: '⚡', value: 'Active', label: 'System Status' },
                { icon: '👥', value: '150+', label: 'Total Users' },
                { icon: '🔔', value: '0', label: 'Critical Alerts' }
            ];
        default:
            return [];
    }
}
