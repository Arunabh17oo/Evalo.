import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TRACKS = [
    { id: 'lofi', name: 'Lofi Focus', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', icon: '🎧' },
    { id: 'space', name: 'Deep Space', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', icon: '🌌' },
    { id: 'rain', name: 'Ambient Rain', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', icon: '🌧️' },
];

export default function SoundscapeEngine({ isActive }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState(TRACKS[0]);
    const [volume, setVolume] = useState(0.3);
    const audioRef = useRef(new Audio(currentTrack.url));

    useEffect(() => {
        audioRef.current.loop = true;
        audioRef.current.volume = volume;

        if (isActive && isPlaying) {
            audioRef.current.play().catch(e => console.log("Audio playback blocked by browser:", e));
        } else {
            audioRef.current.pause();
        }
    }, [isActive, isPlaying, currentTrack]);

    useEffect(() => {
        audioRef.current.volume = volume;
    }, [volume]);

    const switchTrack = (track) => {
        audioRef.current.pause();
        setCurrentTrack(track);
        audioRef.current = new Audio(track.url);
        audioRef.current.loop = true;
        audioRef.current.volume = volume;
        if (isPlaying) audioRef.current.play();
    };

    if (!isActive) return null;

    return (
        <motion.div
            className="soundscape-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
                position: 'fixed',
                bottom: '100px',
                right: '20px',
                background: 'rgba(13, 20, 31, 0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '1rem',
                borderRadius: '16px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                width: '240px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#78e0ff' }}>Focus Soundscape</span>
                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                    {isPlaying ? '⏸️' : '▶️'}
                </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {TRACKS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => switchTrack(t)}
                        title={t.name}
                        style={{
                            flex: 1,
                            background: currentTrack.id === t.id ? 'rgba(120, 224, 255, 0.2)' : 'rgba(255,255,255,0.05)',
                            border: '1px solid',
                            borderColor: currentTrack.id === t.id ? '#78e0ff' : 'rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '0.4rem',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        {t.icon}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>🔈</span>
                <input
                    type="range"
                    min="0" max="1" step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: '#78e0ff' }}
                />
                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>🔊</span>
            </div>

            <div style={{ fontSize: '0.7rem', opacity: 0.4, textAlign: 'center' }}>
                Playing: {currentTrack.name}
            </div>
        </motion.div>
    );
}
