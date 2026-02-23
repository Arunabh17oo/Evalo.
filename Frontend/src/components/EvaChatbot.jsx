import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import '../styles/EvaChatbot.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5050/api';

export default function EvaChatbot({ token }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hi! I'm Eva, your Evalo AI assistant. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async (e) => {
        e?.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsTyping(true);

        try {
            console.log('Eva calling:', `${API_BASE}/chat/eva`, 'Token present:', !!token);
            const { data } = await axios.post(`${API_BASE}/chat/eva`, {
                message: userMsg,
                history: messages.slice(-5) // Send last few messages for context
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setMessages(prev => [...prev, data]);
        } catch (error) {
            console.error('Chat error details:', error.response?.data || error.message);
            const errMsg = error.response?.status === 401
                ? "Please login to talk to me!"
                : `Connection lost (${error.response?.status || 'Network Error'}). Try again?`;

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errMsg
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="eva-chatbot-container">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="eva-window"
                        initial={{ opacity: 0, y: 20, scale: 0.9, transformOrigin: 'bottom right' }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        <div className="eva-header">
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span className="status-dot"></span>
                                <h3>Eva AI</h3>
                            </div>
                            <button className="eva-close-btn" onClick={() => setIsOpen(false)}>&times;</button>
                        </div>

                        <div className="eva-messages" ref={scrollRef}>
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`message ${msg.role}`}>
                                    {msg.content}
                                </div>
                            ))}
                            {isTyping && (
                                <div className="message eva typing-indicator">
                                    <div className="typing">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <form className="eva-input-area" onSubmit={handleSend}>
                            <input
                                type="text"
                                placeholder="Ask Eva anything..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={isTyping}
                            />
                            <button className="eva-send-btn" type="submit" disabled={!input.trim() || isTyping}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                className="eva-bubble"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                layoutId="eva-bubble"
            >
                {!isOpen ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                )}
            </motion.div>
        </div>
    );
}
