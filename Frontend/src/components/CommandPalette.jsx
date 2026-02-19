import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/CommandPalette.css';

const COMMANDS = [
    { id: 'home', title: 'Go to Home', icon: '🏠', section: 'Navigation', action: (ctx) => ctx.navigateTo('home') },
    { id: 'dashboard', title: 'My Dashboard', icon: '📊', section: 'Navigation', action: (ctx) => ctx.navigateTo('home', 'status-section') },
    { id: 'create-test', title: 'Create New Test', icon: '📝', section: 'Teacher Actions', action: (ctx) => ctx.navigateTo('home'), role: 'teacher' },
    { id: 'manage-users', title: 'Manage Users', icon: '👥', section: 'Admin Actions', action: (ctx) => ctx.navigateTo('home'), role: 'admin' },
    { id: 'upload-books', title: 'Upload/Index Books', icon: '📚', section: 'Teacher Actions', action: (ctx) => ctx.navigateTo('home'), role: 'teacher' },
    { id: 'logout', title: 'Logout', icon: '🚪', section: 'Account', action: (ctx) => ctx.logout() },
    { id: 'toggle-copy', title: 'Toggle Global Copy-Paste', icon: '🔒', section: 'Admin Actions', action: (ctx) => ctx.toggleCopyPaste(), role: 'admin' },
    { id: 'profile', title: 'My Profile', icon: '👤', section: 'Account', action: (ctx) => ctx.navigateTo('profile') },
];

export default function CommandPalette({ isOpen, onClose, context }) {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [isListening, setIsListening] = useState(false);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);

    const filteredCommands = COMMANDS.filter(cmd => {
        const matchesQuery = cmd.title.toLowerCase().includes(query.toLowerCase());
        const matchesRole = !cmd.role || (context.user && (context.user.role === cmd.role || context.user.role === 'admin'));
        return matchesQuery && matchesRole;
    });

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setActiveIndex(0);
            setIsListening(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            stopListening();
        }
    }, [isOpen]);

    useEffect(() => {
        // Initialize Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setQuery(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = () => {
        if (recognitionRef.current) {
            setIsListening(true);
            recognitionRef.current.start();
        } else {
            alert("Voice recognition is not supported in this browser.");
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % filteredCommands.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredCommands[activeIndex]) {
                    filteredCommands[activeIndex].action(context);
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, activeIndex, context, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="cmdk-overlay" onClick={onClose}>
                    <motion.div
                        className="cmdk-container"
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="cmdk-header">
                            <span className="cmdk-search-icon">🔍</span>
                            <input
                                ref={inputRef}
                                className="cmdk-input"
                                placeholder={isListening ? "Listening..." : "Type a command or search..."}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                            <button
                                className={`cmdk-mic-btn ${isListening ? 'listening' : ''}`}
                                onClick={toggleListening}
                                title="Voice Command"
                            >
                                {isListening ? '🔴' : '🎤'}
                            </button>
                            <div className="cmdk-kbd">ESC</div>
                        </div>

                        <div className="cmdk-list">
                            {filteredCommands.length > 0 ? (
                                filteredCommands.map((cmd, idx) => (
                                    <div
                                        key={cmd.id}
                                        className={`cmdk-item ${idx === activeIndex ? 'active' : ''}`}
                                        onClick={() => {
                                            cmd.action(context);
                                            onClose();
                                        }}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                    >
                                        <span className="cmdk-item-icon">{cmd.icon}</span>
                                        <div className="cmdk-item-content">
                                            <span className="cmdk-item-title">{cmd.title}</span>
                                            <span className="cmdk-item-section">{cmd.section}</span>
                                        </div>
                                        {idx === activeIndex && <span className="cmdk-item-enter">↵</span>}
                                    </div>
                                ))
                            ) : (
                                <div className="cmdk-empty">No results found for "{query}"</div>
                            )}
                        </div>

                        <div className="cmdk-footer">
                            <div className="cmdk-help">
                                <span><kbd>↑↓</kbd> Navigate</span>
                                <span><kbd>↵</kbd> Select</span>
                            </div>
                            <div className="cmdk-brand">Evalo Intelligence ✦</div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
