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
function GuestScene({ darkMode }) {
  const bgColor = darkMode ? "#00050a" : "#f0f4f8";
  return (
    <>
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[bgColor, 10, 25]} />
      <ambientLight intensity={darkMode ? 0.4 : 0.8} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color={darkMode ? "#4c6ef5" : "#2563eb"} />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />

      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1}>
        <mesh position={[0, -1, -5]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3, 3.02, 64]} />
          <meshBasicMaterial color={darkMode ? "#ffffff" : "#000000"} opacity={0.1} transparent />
        </mesh>
      </Float>
    </>
  );
}

// 2. Student Theme: "The Nexus"
function StudentScene({ darkMode }) {
  const bgColor = darkMode ? "#04111f" : "#eef2f7";
  const blocks = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        position: [
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 7
        ],
        color: darkMode
          ? ["#78e0ff", "#f9b46d", "#8bffb0", "#ff8ec7", "#a78fff"][i % 5]
          : ["#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6"][i % 5],
        size: 0.08 + (i % 4) * 0.04
      })),
    [darkMode]
  );

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[bgColor, 7, 16]} />
      <ambientLight intensity={darkMode ? 0.6 : 1.0} />
      <pointLight intensity={1.2} color={darkMode ? "#a9f0ff" : "#ffffff"} position={[2.5, 2.8, 1.5]} />
      <pointLight intensity={0.9} color={darkMode ? "#ffc987" : "#ffe4c4"} position={[-2.4, -1.8, -1]} />

      <EnergyRing color={darkMode ? "#5ad8ff" : "#0ea5e9"} radius={1.45} speed={0.8} offset={0.1} />
      <EnergyRing color={darkMode ? "#f6b85a" : "#f59e0b"} radius={1.9} speed={0.62} offset={1.4} />
      <EnergyRing color={darkMode ? "#96f7b8" : "#10b981"} radius={2.35} speed={0.48} offset={2.2} />
      <EnergyRing color={darkMode ? "#ff8ec7" : "#ec4899"} radius={2.8} speed={0.35} offset={3.1} />

      <mesh>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color={darkMode ? "#f2fbff" : "#ffffff"}
          emissive={darkMode ? "#7ddfff" : "#0ea5e9"}
          emissiveIntensity={darkMode ? 0.5 : 0.2}
          metalness={0.4}
          roughness={0.15}
        />
      </mesh>

      <PulsingSphere position={[2.2, 1.5, -1]} color={darkMode ? "#78e0ff" : "#0ea5e9"} speed={1.2} />
      <PulsingSphere position={[-2, -1.2, -0.5]} color={darkMode ? "#f9b46d" : "#f59e0b"} speed={0.9} />
      <PulsingSphere position={[0, -2, 1]} color={darkMode ? "#8bffb0" : "#10b981"} speed={1.5} />

      {blocks.map((block) => (
        <Float key={block.id} speed={1 + (block.id % 6) * 0.15} floatIntensity={2} rotationIntensity={1.5}>
          <mesh position={block.position}>
            <icosahedronGeometry args={[block.size, 0]} />
            <meshStandardMaterial color={block.color} metalness={0.3} roughness={0.35} />
          </mesh>
        </Float>
      ))}

      <Stars radius={100} depth={40} count={darkMode ? 2500 : 1000} factor={5} saturation={0} fade speed={0.8} />
    </>
  );
}

// 3. Teacher Theme: "The Architecture"
function TeacherScene({ darkMode }) {
  const bgColor = darkMode ? "#0c0515" : "#f5f3ff";
  return (
    <>
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[bgColor, 8, 20]} />
      <ambientLight intensity={darkMode ? 0.5 : 0.9} />
      <pointLight position={[5, 5, 5]} intensity={1} color={darkMode ? "#d4a5ff" : "#c084fc"} />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color={darkMode ? "#ffd43b" : "#fbbf24"} />

      <Grid
        position={[0, -2, 0]}
        args={[20, 20]}
        cellColor={darkMode ? "#4c1d95" : "#ddd6fe"}
        sectionColor={darkMode ? "#8b5cf6" : "#a78bfa"}
        fadeDistance={15}
        fadeStrength={1}
      />

      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh position={[0, 0, 0]}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={darkMode ? "#2e1065" : "#ffffff"}
            wireframe
            emissive={darkMode ? "#8b5cf6" : "#7c3aed"}
            emissiveIntensity={darkMode ? 0.8 : 0.3}
          />
        </mesh>
      </Float>

      <group rotation={[0, 0, Math.PI / 4]}>
        <EnergyRing color={darkMode ? "#ffd43b" : "#f59e0b"} radius={2.5} speed={0.2} offset={0} />
      </group>

      <Stars radius={100} depth={50} count={darkMode ? 3000 : 800} factor={4} saturation={0} fade speed={0.2} />
    </>
  );
}

export default function AnimatedScene({ role = "guest", darkMode = true }) {
  return (
    <div className="scene-wrap" aria-hidden>
      <Canvas camera={{ position: [0, 0, 6], fov: 52 }}>
        {role === "guest" && <GuestScene darkMode={darkMode} />}
        {role === "student" && <StudentScene darkMode={darkMode} />}
        {(role === "teacher" || role === "admin") && <TeacherScene darkMode={darkMode} />}

        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
