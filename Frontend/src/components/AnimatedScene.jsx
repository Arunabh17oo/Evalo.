import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Stars } from "@react-three/drei";

function EnergyRing({ color, radius, speed, offset }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + offset;
    ref.current.rotation.x = t * 0.3;
    ref.current.rotation.y = t * 0.4;
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.05, 32, 180]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.3} />
    </mesh>
  );
}

function PulsingSphere({ position, color, speed }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const scale = 1 + Math.sin(clock.elapsedTime * speed) * 0.15;
    ref.current.scale.set(scale, scale, scale);
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.2, 32, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} metalness={0.5} roughness={0.2} />
    </mesh>
  );
}

function CrystalField() {
  const blocks = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        position: [
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 7
        ],
        color: ["#78e0ff", "#f9b46d", "#8bffb0", "#ff8ec7", "#a78fff"][i % 5],
        size: 0.08 + (i % 4) * 0.04
      })),
    []
  );

  return (
    <>
      {blocks.map((block) => (
        <Float key={block.id} speed={1 + (block.id % 6) * 0.15} floatIntensity={2} rotationIntensity={1.5}>
          <mesh position={block.position}>
            <icosahedronGeometry args={[block.size, 0]} />
            <meshStandardMaterial color={block.color} metalness={0.3} roughness={0.35} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

function ColorShiftingLight({ position, colors, speed }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * speed) % colors.length;
    const index = Math.floor(t);
    const nextIndex = (index + 1) % colors.length;
    const mix = t - index;
    
    // Simple color interpolation
    ref.current.intensity = 0.8 + Math.sin(clock.elapsedTime * speed * 2) * 0.3;
  });

  return <pointLight ref={ref} position={position} color={colors[0]} intensity={1} />;
}

export default function AnimatedScene() {
  return (
    <div className="scene-wrap" aria-hidden>
      <Canvas camera={{ position: [0, 0, 6], fov: 52 }}>
        <color attach="background" args={["#04111f"]} />
        <fog attach="fog" args={["#04111f", 7, 16]} />
        <ambientLight intensity={0.6} />
        <pointLight intensity={1.2} color="#a9f0ff" position={[2.5, 2.8, 1.5]} />
        <pointLight intensity={0.9} color="#ffc987" position={[-2.4, -1.8, -1]} />
        <ColorShiftingLight position={[0, 3, -2]} colors={["#ff8ec7", "#a78fff", "#78e0ff"]} speed={0.3} />

        <EnergyRing color="#5ad8ff" radius={1.45} speed={0.8} offset={0.1} />
        <EnergyRing color="#f6b85a" radius={1.9} speed={0.62} offset={1.4} />
        <EnergyRing color="#96f7b8" radius={2.35} speed={0.48} offset={2.2} />
        <EnergyRing color="#ff8ec7" radius={2.8} speed={0.35} offset={3.1} />

        <mesh>
          <octahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#f2fbff" emissive="#7ddfff" emissiveIntensity={0.5} metalness={0.4} roughness={0.15} />
        </mesh>

        <PulsingSphere position={[2.2, 1.5, -1]} color="#78e0ff" speed={1.2} />
        <PulsingSphere position={[-2, -1.2, -0.5]} color="#f9b46d" speed={0.9} />
        <PulsingSphere position={[0, -2, 1]} color="#8bffb0" speed={1.5} />

        <CrystalField />
        <Stars radius={100} depth={40} count={2500} factor={5} saturation={0} fade speed={0.8} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.3} />
      </Canvas>
    </div>
  );
}
