import React from 'react';
import { motion } from 'framer-motion';

export default function VoiceAssistant({ onOpen }) {
    return (
        <>
            <motion.button
                className="voice-fab"
                onClick={onOpen}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                title="Open Voice Command Palette"
            >
                <span style={{ fontSize: '1.5rem' }}>🎙️</span>
            </motion.button>
            <style>{`
                .voice-fab {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    border: none;
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    box-shadow: 0 10px 25px rgba(59, 130, 246, 0.5);
                    cursor: pointer;
                    z-index: 10000;
                    display: grid;
                    place-items: center;
                    color: white;
                    overflow: hidden;
                    animation: pulse-glow 2s infinite;
                }
                
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
                    70% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
                }

                .voice-fab:hover {
                    transform: scale(1.1);
                }
                
                .voice-fab:active {
                    transform: scale(0.95);
                }
            `}</style>
        </>
    );
}
