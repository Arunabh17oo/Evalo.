import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Html, Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

function KnowledgeNode({ position, name, score, color, onClick }) {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (meshRef.current) {
            meshRef.current.position.y += Math.sin(t + position[0]) * 0.002;
            const targetScale = hovered ? 1.2 : 1;
            meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        }
    });

    return (
        <group position={position}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
                <Sphere
                    ref={meshRef}
                    args={[0.4, 32, 32]}
                    onClick={onClick}
                    onPointerOver={() => setHovered(true)}
                    onPointerOut={() => setHovered(false)}
                    style={{ cursor: 'pointer' }}
                >
                    <MeshDistortMaterial
                        color={color}
                        speed={2}
                        distort={0.4}
                        radius={1}
                        emissive={color}
                        emissiveIntensity={hovered ? 0.8 : 0.3}
                        metalness={0.9}
                        roughness={0.1}
                    />
                </Sphere>
            </Float>
            <Html position={[0, -0.6, 0]} center distanceFactor={10} pointerEvents="none">
                <div style={{
                    color: 'white',
                    background: 'rgba(0,0,0,0.5)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    border: `1px solid ${color}66`,
                    pointerEvents: 'none',
                    userSelect: 'none'
                }}>
                    {name}<br />{score}%
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
            const radius = 3.5;
            return {
                ...item,
                position: [Math.cos(angle) * radius, Math.sin(angle) * radius, 0],
            };
        });
    }, [data]);

    const centralRef = useRef();
    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (centralRef.current) {
            centralRef.current.rotation.y = t * 0.2;
        }
    });

    return (
        <group>
            {/* Central Class "Core" */}
            <mesh ref={centralRef}>
                <icosahedronGeometry args={[1, 1]} />
                <meshStandardMaterial
                    color="#3b82f6"
                    wireframe
                    emissive="#3b82f6"
                    emissiveIntensity={0.5}
                />
            </mesh>

            {/* Connection Lines */}
            {nodes.map((node, i) => (
                <line key={`line-${i}`}>
                    <bufferGeometry>
                        <bufferAttribute
                            attach="attributes-position"
                            count={2}
                            array={new Float32Array([0, 0, 0, ...node.position])}
                            itemSize={3}
                        />
                    </bufferGeometry>
                    <lineBasicMaterial color="#ffffff" transparent opacity={0.1} />
                </line>
            ))}

            {/* Knowledge Nodes */}
            {nodes.map((node, i) => (
                <KnowledgeNode
                    key={i}
                    {...node}
                    onClick={() => onTopicClick && onTopicClick(node)}
                />
            ))}
        </group>
    );
}
