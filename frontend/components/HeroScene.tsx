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
 * flowing traffic light-trails and a few pulsing "black spot" nodes — the
 * platform's own subject matter (roads, traffic, discovered risk), procedural
 * and self-contained (no external models or textures). Kept deliberately light:
 * ~48 instanced streaks, a handful of nodes, capped DPR. */

const LANES = [-6.6, -4.4, -2.2, 0, 2.2, 4.4, 6.6];

function Traffic() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = 48;
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
      <meshBasicMaterial color="#7dd3fc" toneMapped={false} transparent opacity={0.85} />
    </instancedMesh>
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
      <ambientLight intensity={0.4} />
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
