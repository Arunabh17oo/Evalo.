import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Html, Sphere, MeshDistortMaterial, Stars, MeshWobbleMaterial } from '@react-three/drei';
import * as THREE from 'three';

function ConnectionLine({ start, end, color }) {
    const points = useMemo(() => [
        new THREE.Vector3(...start),
        new THREE.Vector3(...end)
    ], [start, end]);

    const lineGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

    return (
        <line geometry={lineGeometry}>
            <lineBasicMaterial
                color={color}
                transparent
                opacity={0.15}
                linewidth={0.5}
            />
        </line>
    );
}

function KnowledgeNode({ position, name, score, color, onClick }) {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    // Scale node based on mastery score (0.2 to 0.6 range)
    const baseScale = 0.2 + (score / 100) * 0.4;

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (meshRef.current) {
            // Subtle floating motion
            meshRef.current.position.y = position[1] + Math.sin(t * 0.5 + position[0]) * 0.1;
            meshRef.current.position.x = position[0] + Math.cos(t * 0.3 + position[1]) * 0.05;

            // Hover scaling
            const targetScale = hovered ? baseScale * 1.4 : baseScale;
            const currentScale = meshRef.current.scale.x;
            const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.1);
            meshRef.current.scale.set(newScale, newScale, newScale);
        }
    });

    return (
        <group>
            <Float speed={1.5} rotationIntensity={1} floatIntensity={2}>
                <Sphere
                    ref={meshRef}
                    args={[1, 32, 32]}
                    position={position}
                    onClick={onClick}
                    onPointerOver={() => setHovered(true)}
                    onPointerOut={() => setHovered(false)}
                >
                    <MeshDistortMaterial
                        color={color}
                        speed={3}
                        distort={0.3}
                        radius={1}
                        emissive={color}
                        emissiveIntensity={hovered ? 2 : 0.5}
                        metalness={1}
                        roughness={0}
                    />
                </Sphere>
            </Float>

            {/* Glowing Aura */}
            <Sphere args={[baseScale * 1.5, 16, 16]} position={position}>
                <meshBasicMaterial color={color} transparent opacity={0.05} />
            </Sphere>

            <Html position={[position[0], position[1] - 0.8, position[2]]} center distanceFactor={10}>
                <div style={{
                    color: 'white',
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    border: `1px solid ${color}aa`,
                    boxShadow: hovered ? `0 0 15px ${color}66` : 'none',
                    transition: 'all 0.3s ease',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    {name} <span style={{ color: color, marginLeft: '4px' }}>{score}%</span>
                </div>
            </Html>
        </group>
    );
}

export default function KnowledgeOrbit({ data, onTopicClick }) {
    const nodes = useMemo(() => {
        const items = (data && data.topics && data.topics.length > 0)
            ? data.topics
            : [
                { name: 'Loading...', score: 0, color: '#3b82f6' }
            ];

        return items.map((item, idx) => {
            const angle = (idx / items.length) * Math.PI * 2;
            const radius = 4;
            // Add some variance in Z for 3D feel
            const z = Math.sin(angle * 2) * 1;
            return {
                ...item,
                position: [Math.cos(angle) * radius, Math.sin(angle) * radius, z],
            };
        });
    }, [data]);

    const centralRef = useRef();
    const ringRef = useRef();

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (centralRef.current) {
            centralRef.current.rotation.y = t * 0.3;
            centralRef.current.rotation.z = t * 0.1;
            const scale = 1 + Math.sin(t * 2) * 0.05;
            centralRef.current.scale.set(scale, scale, scale);
        }
        if (ringRef.current) {
            ringRef.current.rotation.x = t * 0.2;
            ringRef.current.rotation.y = t * 0.4;
        }
    });

    return (
        <group>
            {/* Background Stars for Depth */}
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            {/* Central Core - Multi-layered */}
            <group>
                <mesh ref={centralRef}>
                    <icosahedronGeometry args={[1.2, 2]} />
                    <MeshDistortMaterial
                        color="#3b82f6"
                        speed={2}
                        distort={0.4}
                        emissive="#3b82f6"
                        emissiveIntensity={0.5}
                        metalness={1}
                        roughness={0}
                    />
                </mesh>

                {/* Outer Wireframe Shield */}
                <mesh ref={ringRef}>
                    <torusGeometry args={[1.8, 0.02, 16, 100]} />
                    <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={1} />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1.9, 0.01, 16, 100]} />
                    <meshStandardMaterial color="#60a5fa" transparent opacity={0.3} />
                </mesh>
            </group>

            {/* Connection Lines */}
            {nodes.map((node, i) => (
                <ConnectionLine
                    key={`line-${i}`}
                    start={[0, 0, 0]}
                    end={node.position}
                    color={node.color}
                />
            ))}

            {/* Knowledge Nodes */}
            {nodes.map((node, i) => (
                <KnowledgeNode
                    key={i}
                    {...node}
                    onClick={() => onTopicClick && onTopicClick(node)}
                />
            ))}

            {/* Ambient and Point Lights */}
            <ambientLight intensity={0.4} />
            <pointLight position={[0, 0, 0]} intensity={2} color="#3b82f6" />
        </group>
    );
}
