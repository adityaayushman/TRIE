"use client";

import { Component, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import * as THREE from "three";

/** If WebGL is unavailable or the scene throws, render nothing rather than
 * white-screening the landing — the hero still shows its text and the ambient
 * backdrop behind it. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The landing hero's 3D scene: a night road-grid receding to the horizon, with
 * a hero car and a motorbike driving away down the road (headlights ahead, tail
 * lights toward you), flowing oncoming light-trails, and pulsing "black spot"
 * nodes — the platform's own subject matter (roads, traffic, vulnerable riders,
 * discovered risk), all procedural and self-contained (no external models or
 * textures). Kept deliberately light: two lit vehicles, ~40 instanced streaks, a
 * handful of nodes, two directional lights, capped DPR. */

const LANES = [-6.6, -4.4, -2.2, 0, 2.2, 4.4, 6.6];

function Traffic() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = 40;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const streaks = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        lane: LANES[Math.floor(Math.random() * LANES.length)],
        z: Math.random() * 160 - 90,
        speed: 12 + Math.random() * 26,
        len: 1.6 + Math.random() * 3.2,
      })),
    []
  );

  useFrame((_, dt) => {
    if (!mesh.current) return;
    const step = Math.min(dt, 0.05);
    streaks.forEach((s, i) => {
      s.z += s.speed * step;
      if (s.z > 70) s.z = -90;
      dummy.position.set(s.lane, 0.06, s.z);
      dummy.scale.set(0.16, 0.06, s.len);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, count]}>
      <boxGeometry />
      <meshBasicMaterial color="#7dd3fc" toneMapped={false} transparent opacity={0.8} />
    </instancedMesh>
  );
}

/** A stylized low-poly car, built from primitives, that drives away down the
 * road on a continuous loop. It travels in -z (into the scene), so you watch it
 * recede with red tail-lights glowing — the reset happens far away inside the
 * fog, so the loop is seamless. A faint headlight glow, a side accent strip and
 * a gentle suspension bob sell it as alive without any per-wheel spin (invisible
 * at this scale) or shadows (too costly). */
function Car({ lane, speed, phase }: { lane: number; speed: number; phase: number }) {
  const group = useRef<THREE.Group>(null);
  // The stretch of road the car covers before looping. Front is -z (heading).
  const START_Z = 16;
  const END_Z = -92;
  const SPAN = START_Z - END_Z;

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    // Position along the loop, offset by phase so multiple vehicles are spread.
    const travelled = (t * speed + phase * SPAN) % SPAN;
    const z = START_Z - travelled;
    group.current.position.set(lane, 0, z);
    // Subtle suspension bob + micro weave, so it never looks frozen.
    group.current.position.y = Math.sin(t * 4 + phase * 6) * 0.03;
    group.current.rotation.y = Math.PI + Math.sin(t * 0.7 + phase * 3) * 0.03;
  });

  return (
    <group ref={group}>
      {/* lower body */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[1.5, 0.45, 3.3]} />
        <meshStandardMaterial color="#16233c" metalness={0.8} roughness={0.32} />
      </mesh>
      {/* cabin, set back toward the tail */}
      <mesh position={[0, 0.82, -0.3]}>
        <boxGeometry args={[1.28, 0.42, 1.55]} />
        <meshStandardMaterial color="#0e1a30" metalness={0.7} roughness={0.28} />
      </mesh>
      {/* windshield glint */}
      <mesh position={[0, 0.82, 0.55]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[1.18, 0.5, 0.06]} />
        <meshStandardMaterial color="#4a6fa5" metalness={0.9} roughness={0.1} emissive="#0b2036" emissiveIntensity={0.4} />
      </mesh>
      {/* cyan accent strips down each side — the premium neon line */}
      <mesh position={[0.76, 0.5, 0]}>
        <boxGeometry args={[0.04, 0.06, 2.8]} />
        <meshBasicMaterial color="#38bdf8" toneMapped={false} />
      </mesh>
      <mesh position={[-0.76, 0.5, 0]}>
        <boxGeometry args={[0.04, 0.06, 2.8]} />
        <meshBasicMaterial color="#38bdf8" toneMapped={false} />
      </mesh>
      {/* wheels (front z<0, rear z>0) */}
      {[
        [0.74, -1.05],
        [-0.74, -1.05],
        [0.74, 1.05],
        [-0.74, 1.05],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.28, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 18]} />
          <meshStandardMaterial color="#05070c" metalness={0.4} roughness={0.7} />
        </mesh>
      ))}
      {/* headlights, front (-z), lighting the way ahead */}
      {[0.48, -0.48].map((x, i) => (
        <mesh key={i} position={[x, 0.45, -1.68]}>
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshBasicMaterial color="#eaf6ff" toneMapped={false} />
        </mesh>
      ))}
      {/* forward beam glow on the road */}
      <mesh position={[0, 0.12, -2.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 2.4]} />
        <meshBasicMaterial color="#bfe6ff" toneMapped={false} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      {/* tail-lights, rear (+z), facing the camera */}
      {[0.5, -0.5].map((x, i) => (
        <mesh key={i} position={[x, 0.45, 1.66]}>
          <boxGeometry args={[0.24, 0.12, 0.06]} />
          <meshBasicMaterial color="#ff3b30" toneMapped={false} />
        </mesh>
      ))}
      {/* tail glow */}
      <mesh position={[0, 0.45, 1.72]}>
        <planeGeometry args={[1.5, 0.5]} />
        <meshBasicMaterial color="#ff5b52" toneMapped={false} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A motorbike + rider — a nod to the platform's whole premise, that two-wheeler
 * riders (46% of Indian road deaths) are the road users it exists to protect.
 * Same loop and heading as the car, narrower, one tail-light. */
function Motorbike({ lane, speed, phase }: { lane: number; speed: number; phase: number }) {
  const group = useRef<THREE.Group>(null);
  const START_Z = 16;
  const END_Z = -92;
  const SPAN = START_Z - END_Z;

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    const travelled = (t * speed + phase * SPAN) % SPAN;
    group.current.position.set(lane, 0, START_Z - travelled);
    group.current.position.y = Math.sin(t * 5 + phase * 6) * 0.025;
    // A little lean as it weaves — bikes are never dead straight.
    group.current.rotation.z = Math.sin(t * 1.6 + phase * 4) * 0.08;
    group.current.rotation.y = Math.PI;
  });

  return (
    <group ref={group}>
      {/* frame */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.28, 0.32, 1.4]} />
        <meshStandardMaterial color="#1b2a44" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* rider */}
      <mesh position={[0, 0.92, 0.15]}>
        <capsuleGeometry args={[0.16, 0.42, 4, 8]} />
        <meshStandardMaterial color="#0b1220" metalness={0.3} roughness={0.8} />
      </mesh>
      {/* helmet — a visible white dome, because this rider has one */}
      <mesh position={[0, 1.32, 0.02]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#dbe7f5" metalness={0.2} roughness={0.5} />
      </mesh>
      {/* wheels */}
      {[-0.62, 0.62].map((z, i) => (
        <mesh key={i} position={[0, 0.3, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.12, 16]} />
          <meshStandardMaterial color="#05070c" metalness={0.4} roughness={0.7} />
        </mesh>
      ))}
      {/* single headlight */}
      <mesh position={[0, 0.5, -0.72]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color="#eaf6ff" toneMapped={false} />
      </mesh>
      {/* tail-light */}
      <mesh position={[0, 0.5, 0.72]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshBasicMaterial color="#ff3b30" toneMapped={false} />
      </mesh>
    </group>
  );
}

const NODES: { pos: [number, number]; color: string; phase: number }[] = [
  { pos: [-4.4, -16], color: "#f59e0b", phase: 0 },
  { pos: [2.2, -30], color: "#ef4444", phase: 1.1 },
  { pos: [6.6, -9], color: "#38bdf8", phase: 2.3 },
  { pos: [-2.2, -44], color: "#f59e0b", phase: 3.4 },
  { pos: [4.4, -58], color: "#ef4444", phase: 4.2 },
];

function BlackSpots() {
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      const pulse = (t * 0.6 + NODES[i].phase) % 2.2;
      const scale = 0.6 + pulse * 1.5;
      ring.scale.set(scale, scale, scale);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.6 - pulse * 0.28);
    });
  });

  return (
    <>
      {NODES.map((node, i) => (
        <group key={i} position={[node.pos[0], 0.08, node.pos[1]]}>
          <mesh>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshBasicMaterial color={node.color} toneMapped={false} />
          </mesh>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            ref={(el) => {
              rings.current[i] = el;
            }}
          >
            <ringGeometry args={[0.5, 0.62, 40]} />
            <meshBasicMaterial color={node.color} toneMapped={false} transparent side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Scene() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.08) * 1.4;
    camera.position.y = 4 + Math.sin(t * 0.05) * 0.3;
    camera.lookAt(0, 0, -26);
  });

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <fog attach="fog" args={["#020617", 24, 96]} />
      {/* Lighting: a cool key from above-front gives the vehicles form; a dim
          back-rim separates them from the night. The grid/streaks are unlit
          (basic material), so this only shapes the cars — cheap. */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 11, 7]} intensity={1.15} color="#bcd8ff" />
      <directionalLight position={[-7, 5, -9]} intensity={0.5} color="#38507a" />
      <Grid
        position={[0, 0, 0]}
        args={[240, 240]}
        cellSize={2.2}
        cellThickness={0.7}
        cellColor="#1e3a5f"
        sectionSize={11}
        sectionThickness={1.2}
        sectionColor="#0ea5e9"
        fadeDistance={90}
        fadeStrength={2.5}
        infiniteGrid
      />
      <Traffic />
      <Car lane={0} speed={20} phase={0} />
      <Car lane={4.4} speed={26} phase={0.55} />
      <Motorbike lane={-2.2} speed={16} phase={0.28} />
      <BlackSpots />
    </>
  );
}

export function HeroScene() {
  // Client-only: the WebGL canvas must not render during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <SceneBoundary>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 4, 18], fov: 55 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        frameloop="always"
      >
        <Scene />
      </Canvas>
    </SceneBoundary>
  );
}
