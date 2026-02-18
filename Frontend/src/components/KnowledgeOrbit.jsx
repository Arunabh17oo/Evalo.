import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Text, Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

function KnowledgeNode({ position, name, score, color }) {
    const meshRef = useRef();
    const textRef = useRef();

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (meshRef.current) {
            meshRef.current.position.y += Math.sin(t + position[0]) * 0.002;
        }
    });

    return (
        <group position={position}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
                <Sphere ref={meshRef} args={[0.4, 32, 32]}>
                    <MeshDistortMaterial
                        color={color}
                        speed={2}
                        distort={0.3}
                        radius={1}
                        emissive={color}
                        emissiveIntensity={0.2}
                        metalness={0.8}
                        roughness={0.2}
                    />
                </Sphere>
            </Float>
            <Text
                ref={textRef}
                position={[0, -0.7, 0]}
                fontSize={0.2}
                color="white"
                anchorX="center"
                anchorY="middle"
                font="https://fonts.gstatic.com/s/outfit/v11/QGYxz_kZ_SQK7HFF8qnR.woff"
            >
                {name} ({score}%)
            </Text>
        </group>
    );
}

export default function KnowledgeOrbit({ data }) {
    const nodes = useMemo(() => {
        if (!data || !data.riskDistribution) return [];

        // Mock topics for visualization if none provided
        const items = [
            { name: 'Core Logic', score: 85, color: '#78e0ff' },
            { name: 'Security', score: 45, color: '#ef4444' },
            { name: 'Speed', score: 92, color: '#8bffb0' },
            { name: 'Accuracy', score: 68, color: '#f9b46d' },
            { name: 'Analysis', score: 77, color: '#a78fff' },
        ];

        return items.map((item, idx) => {
            const angle = (idx / items.length) * Math.PI * 2;
            const radius = 3;
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
                    <bufferGeometry attach="geometry">
                        <bufferAttribute
                            attach="attributes-position"
                            count={2}
                            array={new Float32Array([0, 0, 0, ...node.position])}
                            itemSize={3}
                        />
                    </bufferGeometry>
                    <lineBasicMaterial attach="material" color="rgba(255,255,255,0.1)" transparent opacity={0.2} />
                </line>
            ))}

            {/* Knowledge Nodes */}
            {nodes.map((node, i) => (
                <KnowledgeNode key={i} {...node} />
            ))}
        </group>
    );
}
