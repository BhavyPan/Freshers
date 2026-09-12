"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

function OrbitShard({
  radius,
  speed,
  tilt,
  size,
  offset = 0,
}: {
  radius: number;
  speed: number;
  tilt: number;
  size: number;
  offset?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + offset;
    ref.current.position.set(Math.cos(t) * radius, Math.sin(t) * radius * Math.sin(tilt), Math.sin(t) * radius * Math.cos(tilt));
    ref.current.rotation.x = t * 1.4;
    ref.current.rotation.y = t * 0.9;
  });
  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[size, 0]} />
      <meshStandardMaterial
        color="#1b0d36"
        metalness={0.9}
        roughness={0.2}
        flatShading
        emissive="#6d28d9"
        emissiveIntensity={0.5}
      />
    </mesh>
  );
}

function ObsidianCrystal({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const ring1 = useRef<THREE.Mesh>(null!);
  const ring2 = useRef<THREE.Mesh>(null!);
  const core = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    group.current.rotation.y += delta * 0.22;
    group.current.rotation.x = Math.sin(t * 0.35) * 0.1 + state.pointer.y * 0.08;
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, state.pointer.x * 0.12, 0.04);
    ring1.current.rotation.z += delta * 0.12;
    ring2.current.rotation.z -= delta * 0.08;
    const pulse = 1 + Math.sin(t * 1.6) * 0.045;
    core.current.scale.setScalar(pulse);
  });

  return (
    <Float speed={2.1} rotationIntensity={0.35} floatIntensity={1.1}>
      <group ref={group}>
        {/* main faceted obsidian crystal */}
        <mesh>
          <icosahedronGeometry args={[1.72, 0]} />
          <meshStandardMaterial
            color="#170a2f"
            metalness={0.85}
            roughness={0.16}
            flatShading
            emissive="#3b0a70"
            emissiveIntensity={0.35}
          />
        </mesh>
        {/* glowing inner core */}
        <mesh ref={core} scale={0.52}>
          <octahedronGeometry args={[1.72, 0]} />
          <meshBasicMaterial color="#c084fc" transparent opacity={0.5} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* purple wireframe shell */}
        <mesh scale={1.085}>
          <icosahedronGeometry args={[1.72, 0]} />
          <meshBasicMaterial color="#a855f7" wireframe transparent opacity={0.26} />
        </mesh>
        {/* twin halo rings */}
        <mesh ref={ring1} rotation={[Math.PI / 2.35, 0.25, 0]}>
          <torusGeometry args={[2.75, 0.014, 8, 140]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.55} />
        </mesh>
        <mesh ref={ring2} rotation={[Math.PI / 1.9, -0.5, 0.4]}>
          <torusGeometry args={[3.3, 0.008, 8, 140]} />
          <meshBasicMaterial color="#c084fc" transparent opacity={0.28} />
        </mesh>
        {/* orbiting shards */}
        <OrbitShard radius={3.1} speed={0.5} tilt={0.5} size={0.3} offset={0.4} />
        <OrbitShard radius={3.6} speed={0.34} tilt={1.15} size={0.22} offset={2.4} />
        {!reduced && <OrbitShard radius={2.6} speed={0.72} tilt={-0.35} size={0.18} offset={4.2} />}
        {!reduced && <OrbitShard radius={4.1} speed={0.26} tilt={0.85} size={0.26} offset={1.2} />}
      </group>
    </Float>
  );
}

function GlowSprite({ size = 8.5 }: { size?: number }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(192,132,252,0.5)");
    g.addColorStop(0.35, "rgba(124,58,237,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <sprite scale={[size, size, 1]}>
      <spriteMaterial map={texture} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
    </sprite>
  );
}

export default function CrystalScene({ reduced = false }: { reduced?: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0.35, 6.6], fov: 45 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 6, 4]} intensity={1.4} color="#d8b4fe" />
      <pointLight position={[7, 3, 3]} intensity={130} color="#a855f7" />
      <pointLight position={[-7, -2, -3]} intensity={90} color="#4c1d95" />
      <pointLight position={[0, -6, 2]} intensity={60} color="#c084fc" />
      <ObsidianCrystal reduced={reduced} />
      <GlowSprite size={reduced ? 7 : 9} />
      <Sparkles count={reduced ? 45 : 130} scale={[11, 8.5, 6]} size={2.1} speed={0.32} color="#c4b5fd" opacity={0.65} />
      <Sparkles count={reduced ? 12 : 34} scale={[8, 6, 4]} size={4.2} speed={0.18} color="#f5f3ff" opacity={0.5} />
    </Canvas>
  );
}
