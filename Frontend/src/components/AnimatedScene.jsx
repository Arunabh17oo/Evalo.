import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Stars, Grid } from "@react-three/drei";

// --- Shared Components ---

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

// --- Themes ---

// 1. Guest Theme: "The Void"
// Minimalist, calm, deep space. Inviting but empty.
function GuestScene() {
  return (
    <>
      <color attach="background" args={["#00050a"]} />
      <fog attach="fog" args={["#00050a", 10, 25]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#4c6ef5" />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />

      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1}>
        <mesh position={[0, -1, -5]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3, 3.02, 64]} />
          <meshBasicMaterial color="#ffffff" opacity={0.1} transparent />
        </mesh>
      </Float>
    </>
  );
}

// 2. Student Theme: "The Nexus" (Enhanced Original)
// Active, energetic, floating crystals, vibrant colors.
function StudentScene() {
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
      <color attach="background" args={["#04111f"]} />
      <fog attach="fog" args={["#04111f", 7, 16]} />
      <ambientLight intensity={0.6} />
      <pointLight intensity={1.2} color="#a9f0ff" position={[2.5, 2.8, 1.5]} />
      <pointLight intensity={0.9} color="#ffc987" position={[-2.4, -1.8, -1]} />

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

      {blocks.map((block) => (
        <Float key={block.id} speed={1 + (block.id % 6) * 0.15} floatIntensity={2} rotationIntensity={1.5}>
          <mesh position={block.position}>
            <icosahedronGeometry args={[block.size, 0]} />
            <meshStandardMaterial color={block.color} metalness={0.3} roughness={0.35} />
          </mesh>
        </Float>
      ))}

      <Stars radius={100} depth={40} count={2500} factor={5} saturation={0} fade speed={0.8} />
    </>
  );
}

// 3. Teacher Theme: "The Architecture"
// Structured, grid-based, analytical. Golden/Purple hues.
function TeacherScene() {
  return (
    <>
      <color attach="background" args={["#0c0515"]} />
      <fog attach="fog" args={["#0c0515", 8, 20]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#d4a5ff" />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#ffd43b" />

      {/* Structured Floor */}
      <Grid
        position={[0, -2, 0]}
        args={[20, 20]}
        cellColor="#4c1d95"
        sectionColor="#8b5cf6"
        fadeDistance={15}
        fadeStrength={1}
      />

      {/* Central Monolith */}
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh position={[0, 0, 0]}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#2e1065" wireframe emissive="#8b5cf6" emissiveIntensity={0.8} />
        </mesh>
      </Float>

      {/* Orbiting Satellites */}
      <group rotation={[0, 0, Math.PI / 4]}>
        <EnergyRing color="#ffd43b" radius={2.5} speed={0.2} offset={0} />
      </group>

      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.2} />
    </>
  );
}

export default function AnimatedScene({ role = "guest" }) {
  console.log("AnimatedScene Role:", role); // Debugging

  return (
    <div className="scene-wrap" aria-hidden>
      <Canvas camera={{ position: [0, 0, 6], fov: 52 }}>
        {role === "guest" && <GuestScene />}
        {role === "student" && <StudentScene />}
        {(role === "teacher" || role === "admin") && <TeacherScene />}

        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
