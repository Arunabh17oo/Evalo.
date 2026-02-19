import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function ProfilePage({ user, onLogout, pushToast }) {
    if (!user) return null;

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [profilePic, setProfilePic] = useState(user.profilePic || null);

    // File upload ref
    const fileInputRef = React.useRef(null);

    // Settings State
    const [darkMode, setDarkMode] = useState(true);
    const [notifications, setNotifications] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);

    const stats = getRoleStats(user);

    const handleSaveProfile = () => {
        setIsEditing(false);
        // In a real app, send profilePic data to backend
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
        <div className="profile-container">
            {/* 1. Identity Header */}
            <motion.div
                className="profile-header"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="avatar-section">
                    <div className="profile-avatar" onClick={() => isEditing && fileInputRef.current?.click()}>
                        {profilePic ? (
                            <img src={profilePic} alt="Profile" className="avatar-image" />
                        ) : (
                            name.charAt(0).toUpperCase()
                        )}
                        {isEditing && (
                            <div className="avatar-overlay">
                                <span>📷</span>
                            </div>
                        )}
                    </div>
                    {isEditing && (
                        <div className="avatar-controls">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                                accept="image/*"
                            />
                            <button className="btn-small-text" onClick={() => fileInputRef.current?.click()}>
                                Upload Photo
                            </button>
                            {profilePic && (
                                <button className="btn-small-text danger" onClick={handleRemovePhoto}>
                                    Remove
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="profile-info">
                    {isEditing ? (
                        <div className="edit-form">
                            <input
                                className="edit-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your Name"
                            />
                            <input
                                className="edit-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email"
                            />
                        </div>
                    ) : (
                        <>
                            <h1>{name}</h1>
                            <p>{email}</p>
                        </>
                    )}
                    <div className="badges-row">
                        <span className={`role-badge ${user.role}`}>{user.role.toUpperCase()}</span>
                        <span className="member-since">Member since: {new Date().getFullYear()}</span>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className={isEditing ? "btn-save-profile" : "btn-edit-profile"}
                        onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                    >
                        {isEditing ? "Save Changes" : "Edit Profile"}
                    </button>
                    <button className="btn-logout" onClick={onLogout}>Logout</button>
                </div>
            </motion.div>

            {/* 2. Performance Stats */}
            <motion.div
                className="stats-grid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                {stats.map((stat, idx) => (
                    <div key={idx} className="stat-card">
                        <div className="stat-icon">{stat.icon}</div>
                        <div className="stat-value">{stat.value}</div>
                        <div className="stat-label">{stat.label}</div>
                    </div>
                ))}
            </motion.div>

            {/* 3. Account Settings */}
            <div className="settings-grid">
                <motion.div
                    className="settings-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h2>Account Settings</h2>
                    <div className="setting-item">
                        <div className="setting-info">
                            <span>Theme Preference</span>
                            <small>Dark/Light mode</small>
                        </div>
                        <button
                            className={`toggle-btn ${darkMode ? 'active' : ''}`}
                            onClick={() => {
                                setDarkMode(!darkMode);
                                pushToast(`Dark Mode ${!darkMode ? 'Enabled' : 'Disabled'}`, "info");
                            }}
                        >
                            {darkMode ? 'Dark Mode' : 'Light Mode'}
                        </button>
                    </div>
                    <div className="setting-item">
                        <div className="setting-info">
                            <span>Email Notifications</span>
                            <small>Get updates on tests</small>
                        </div>
                        <button
                            className={`toggle-btn ${notifications ? 'active' : ''}`}
                            onClick={() => {
                                setNotifications(!notifications);
                                pushToast(`Notifications ${!notifications ? 'Enabled' : 'Disabled'}`, "info");
                            }}
                        >
                            {notifications ? 'On' : 'Off'}
                        </button>
                    </div>
                    <div className="setting-item">
                        <div className="setting-info">
                            <span>Security</span>
                            <small>Password & Authentication</small>
                        </div>
                        <button className="btn-outline" onClick={() => pushToast("Password change email sent!", "success")}>
                            Change Password
                        </button>
                    </div>
                    <div className="setting-item">
                        <div className="setting-info">
                            <span>Accessibility</span>
                            <small>Reduce Motion, High Contrast</small>
                        </div>
                        <div className="toggle-group">
                            <button
                                className={`toggle-btn ${reduceMotion ? 'active' : ''}`}
                                onClick={() => setReduceMotion(!reduceMotion)}
                            >
                                Reduce Motion
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Role Specific Extra (optional placeholder for Recent Activity/Alerts) */}
                <motion.div
                    className="settings-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h2>{user.role === 'student' ? 'Recent Activity 📉' : user.role === 'admin' ? 'System Alerts 🔔' : 'Quick Actions ⚡'}</h2>
                    {user.role === 'student' ? (
                        <ul className="activity-list">
                            <li><span>Physics Midterm</span> <span className="score good">85%</span></li>
                            <li><span>Chemistry Quiz</span> <span className="score avg">72%</span></li>
                            <li><span>Math Final</span> <span className="score good">90%</span></li>
                        </ul>
                    ) : user.role === 'admin' ? (
                        <ul className="activity-list">
                            <li><span>System Check</span> <span className="status ok">All Systems Operational</span></li>
                            <li><span>Proctoring</span> <span className="status warning">2 Flags Reviewed</span></li>
                        </ul>
                    ) : (
                        <div className="quick-actions">
                            <button className="btn-outline full-width" onClick={() => handleAction("Upload Question Bank")}>
                                Upload New Question Bank
                            </button>
                            <button className="btn-outline full-width" onClick={() => handleAction("Review Pending Tests")}>
                                Review Pending Tests
                            </button>
                            <button className="btn-outline full-width" onClick={() => handleAction("Manage Students")}>
                                Manage Students
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>

            <style>{`
                .profile-container {
                    max-width: 900px;
                    margin: 4rem auto 0; /* Added top margin to clear header */
                    padding: 2rem;
                    color: white;
                    padding-bottom: 6rem; /* space for fab */
                    position: relative;
                    z-index: 15;
                }

                .profile-header {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                    background: #1e293b; /* Solid dark background */
                    padding: 2.5rem;
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    position: relative;
                    z-index: 2;
                }

                .avatar-section {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }

                .profile-avatar {
                    width: 120px;
                    height: 120px;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    font-size: 3.5rem;
                    font-weight: bold;
                    box-shadow: 0 10px 30px rgba(99, 102, 241, 0.4);
                    border: 4px solid rgba(255,255,255,0.1);
                    overflow: hidden;
                    position: relative;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .profile-avatar:hover {
                    border-color: rgba(255,255,255,0.3);
                }

                .avatar-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .avatar-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.3);
                    display: grid;
                    place-items: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                
                .profile-avatar:hover .avatar-overlay {
                    opacity: 1;
                }

                .avatar-controls {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    align-items: center;
                }

                .btn-small-text {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    font-size: 0.85rem;
                    cursor: pointer;
                    text-decoration: underline;
                    padding: 0;
                }
                
                .btn-small-text:hover { color: white; }
                .btn-small-text.danger { color: #f87171; }
                .btn-small-text.danger:hover { color: #ef4444; }

                .profile-info {
                    flex: 1;
                }

                .profile-info h1 {
                    margin: 0;
                    font-size: 2.5rem;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                }

                .profile-info p {
                    margin: 0.5rem 0 1rem;
                    opacity: 0.7;
                    font-size: 1.1rem;
                }
                
                .edit-form {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }
                
                .edit-input {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    padding: 0.5rem;
                    border-radius: 8px;
                    color: white;
                    font-size: 1.1rem;
                }

                .badges-row {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .role-badge {
                    display: inline-block;
                    padding: 0.4rem 1rem;
                    border-radius: 99px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .role-badge.student { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
                .role-badge.teacher { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
                .role-badge.admin { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }

                .member-since {
                    font-size: 0.9rem;
                    opacity: 0.5;
                }

                .header-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.8rem;
                }

                .btn-logout, .btn-edit-profile, .btn-save-profile {
                    padding: 0.8rem 1.5rem;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 600;
                    min-width: 140px;
                }

                .btn-logout {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #f87171;
                }
                .btn-logout:hover {
                    background: rgba(239, 68, 68, 0.2);
                    transform: translateY(-2px);
                }

                .btn-edit-profile {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                }
                .btn-edit-profile:hover {
                    background: rgba(255, 255, 255, 0.2);
                    transform: translateY(-2px);
                }
                
                .btn-save-profile {
                    background: #6366f1;
                    border: 1px solid #6366f1;
                    color: white;
                }
                .btn-save-profile:hover {
                    background: #4f46e5;
                    transform: translateY(-2px);
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .stat-card {
                    background: #1e293b;
                    padding: 2rem;
                    border-radius: 20px;
                    text-align: center;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    transition: transform 0.2s;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                }
                .stat-card:hover {
                    transform: translateY(-5px);
                    background: #334155;
                }

                .stat-icon {
                    font-size: 2.5rem;
                    margin-bottom: 1rem;
                }

                .stat-value {
                    font-size: 2rem;
                    font-weight: 800;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(to right, #fff, #94a3b8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .stat-label {
                    font-size: 0.95rem;
                    color: #94a3b8;
                    font-weight: 500;
                }
                
                .settings-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 2rem;
                }

                .settings-section {
                    background: #1e293b;
                    padding: 2rem;
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                }

                .settings-section h2 {
                    margin-top: 0;
                    margin-bottom: 1.5rem;
                    font-size: 1.3rem;
                    color: #e2e8f0;
                }

                .setting-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.2rem 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .setting-item:last-child { border-bottom: none; }

                .setting-info { display: flex; flex-direction: column; gap: 4px; }
                .setting-info span { font-weight: 600; color: #f1f5f9; }
                .setting-info small { color: #64748b; font-size: 0.85rem; }

                .toggle-btn {
                    padding: 0.6rem 1.2rem;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: transparent;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .toggle-btn.active {
                    background: #6366f1;
                    color: white;
                    border-color: #6366f1;
                }
                
                .btn-outline {
                    padding: 0.6rem 1.2rem;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: transparent;
                    color: white;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                
                .btn-outline:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: white;
                }
                
                .full-width { width: 100%; margin-bottom: 0.5rem; }
                
                .activity-list { list-style: none; padding: 0; margin: 0; }
                .activity-list li {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.8rem 0;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    font-size: 0.95rem;
                }
                .activity-list li:last-child { border-bottom: none; }
                .score { font-weight: bold; }
                .score.good { color: #34d399; }
                .score.avg { color: #facc15; }
                .status.ok { color: #34d399; }
                .status.warning { color: #facc15; }
                
                @media (max-width: 768px) {
                    .profile-header { flex-direction: column; text-align: center; padding: 1.5rem; }
                    .header-actions { width: 100%; flex-direction: row; justify-content: center; }
                    .badges-row { justify-content: center; }
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
