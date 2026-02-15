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
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} roughness={0.35} />
    </mesh>
  );
}

function CrystalField() {
  const blocks = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        position: [
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 6
        ],
        color: ["#78e0ff", "#f9b46d", "#8bffb0"][i % 3]
      })),
    []
  );

  return (
    <>
      {blocks.map((block) => (
        <Float key={block.id} speed={1 + (block.id % 5) * 0.2} floatIntensity={1.8} rotationIntensity={1.3}>
          <mesh position={block.position}>
            <icosahedronGeometry args={[0.12 + (block.id % 3) * 0.05, 0]} />
            <meshStandardMaterial color={block.color} metalness={0.2} roughness={0.4} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

export default function AnimatedScene() {
  return (
    <div className="scene-wrap" aria-hidden>
      <Canvas camera={{ position: [0, 0, 6], fov: 52 }}>
        <color attach="background" args={["#04111f"]} />
        <fog attach="fog" args={["#04111f", 6, 14]} />
        <ambientLight intensity={0.55} />
        <pointLight intensity={1.1} color="#a9f0ff" position={[2.5, 2.8, 1.5]} />
        <pointLight intensity={0.8} color="#ffc987" position={[-2.4, -1.8, -1]} />

        <EnergyRing color="#5ad8ff" radius={1.45} speed={0.8} offset={0.1} />
        <EnergyRing color="#f6b85a" radius={1.9} speed={0.62} offset={1.4} />
        <EnergyRing color="#96f7b8" radius={2.35} speed={0.48} offset={2.2} />

        <mesh>
          <octahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial color="#f2fbff" emissive="#7ddfff" emissiveIntensity={0.45} metalness={0.3} roughness={0.2} />
        </mesh>

        <CrystalField />
        <Stars radius={90} depth={30} count={1800} factor={4} saturation={0} fade speed={0.6} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.25} />
      </Canvas>
    </div>
  );
}
