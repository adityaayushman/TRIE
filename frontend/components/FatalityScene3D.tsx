"use client";

import { Component, ReactNode, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Grid, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

/** If WebGL is unavailable or the scene throws, fall back to nothing here — the
 * research section already carries the same numbers as a 2D table above, so the
 * page loses spectacle, not evidence. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Real DfT STATS19 (GB 2024) fatal-collision rate, by speed limit and light.
 * A legitimate 3D case: z = f(x, y) over two independent factors, where the
 * *joint* effect — the dark penalty widening as speed rises — is the point, and
 * rotating the view is what makes it legible (mitigating 3D's occlusion). */
const SPEEDS = [20, 30, 40, 50, 60, 70];
const DAY = [0.47, 0.65, 1.47, 2.6, 3.55, 2.55];
const DARK = [0.78, 1.34, 2.74, 3.63, 4.04, 5.78];

const DAY_COLOR = "#f5b942"; // warm — daylight
const DARK_COLOR = "#6366f1"; // cool indigo — darkness
const X_STEP = 1.15;
const Z = 0.72; // depth offset for the two light conditions
const H_SCALE = 0.82; // rate% -> world height

function Bar({
  x,
  z,
  rate,
  color,
}: {
  x: number;
  z: number;
  rate: number;
  color: string;
}) {
  // A fixed-height box grown from its base by animating scale.y in the frame
  // loop — no per-frame geometry reallocation, no React re-render.
  const grow = useRef<THREE.Group>(null);
  const t = useRef(0);
  const target = rate * H_SCALE;
  useFrame((_, delta) => {
    if (!grow.current || t.current >= 1) return;
    t.current = Math.min(1, t.current + delta / 0.7);
    grow.current.scale.y = Math.max(0.001, 1 - Math.pow(1 - t.current, 3));
  });

  return (
    <group position={[x, 0, z]}>
      <group ref={grow} scale={[1, 0.001, 1]}>
        <mesh position={[0, target / 2, 0]}>
          <boxGeometry args={[0.66, target, 0.66]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} metalness={0.3} roughness={0.4} />
        </mesh>
      </group>
      <Billboard position={[0, target + 0.3, 0]}>
        <Text fontSize={0.3} color="#e2e8f0" anchorX="center" anchorY="middle">
          {rate.toFixed(1)}
        </Text>
      </Billboard>
    </group>
  );
}

function Scene() {
  const originX = -((SPEEDS.length - 1) / 2) * X_STEP;
  return (
    <>
      <color attach="background" args={["#070a12"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 12, 8]} intensity={1.2} color="#dbe7ff" />
      <directionalLight position={[-8, 4, -6]} intensity={0.4} color="#38507a" />

      <Grid
        args={[SPEEDS.length * X_STEP + 1.5, 3.4]}
        position={[0, 0, 0]}
        cellSize={0.6}
        cellThickness={0.6}
        cellColor="#1e2a44"
        sectionSize={100}
        sectionColor="#1e2a44"
        fadeDistance={30}
        fadeStrength={1.5}
      />

      {SPEEDS.map((s, i) => {
        const x = originX + i * X_STEP;
        return (
          <group key={s}>
            <Bar x={x} z={Z} rate={DAY[i]} color={DAY_COLOR} />
            <Bar x={x} z={-Z} rate={DARK[i]} color={DARK_COLOR} />
            {/* speed tick along the front edge */}
            <Billboard position={[x, -0.35, Z + 0.7]}>
              <Text fontSize={0.28} color="#64748b" anchorX="center" anchorY="middle">
                {s}
              </Text>
            </Billboard>
          </group>
        );
      })}

      {/* axis captions */}
      <Billboard position={[0, -0.85, Z + 0.7]}>
        <Text fontSize={0.26} color="#94a3b8" anchorX="center" anchorY="middle">
          speed limit (mph)
        </Text>
      </Billboard>
      <Billboard position={[originX - 1.1, 0.2, Z]}>
        <Text fontSize={0.26} color={DAY_COLOR} anchorX="center" anchorY="middle">
          Day
        </Text>
      </Billboard>
      <Billboard position={[originX - 1.1, 0.2, -Z]}>
        <Text fontSize={0.26} color={DARK_COLOR} anchorX="center" anchorY="middle">
          Dark
        </Text>
      </Billboard>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.9}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.15}
      />
    </>
  );
}

export function FatalityScene3D() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="h-[340px] w-full">
      <SceneBoundary>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [5.5, 4.5, 7.5], fov: 42 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <Scene />
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
