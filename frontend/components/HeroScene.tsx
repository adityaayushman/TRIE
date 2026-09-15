"use client";

import { Component, MutableRefObject, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import * as THREE from "three";
import { prefersReducedMotion, triggerImpact } from "@/lib/impact";

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

/** The hero's one-time dramatic beat: a two-wheeler cuts laterally across a
 * car's lane with no warning — the exact "lane drift where there is no lane
 * discipline" scenario the platform's second pillar names, and the exact
 * road user (a two-wheeler rider) the platform is built to protect. Plays
 * once, ~3.2s after mount, then both actors dissolve into debris and the
 * scene settles permanently into the calm ambient loop underneath — a hook,
 * not a repeating jump-scare.
 *
 * `shakeRef` is written once (to 1.0) at the impact instant; Scene() owns the
 * actual decay and applies it to the camera, so there is one authority for
 * camera motion instead of two components fighting over `camera.position`.
 */
const IMPACT_T = 3.2;
const IMPACT_POINT: [number, number] = [-1.1, -14];

function CollisionSequence({ shakeRef }: { shakeRef: MutableRefObject<number> }) {
  const car = useRef<THREE.Group>(null);
  const bike = useRef<THREE.Group>(null);
  const burst = useRef<THREE.Mesh>(null);
  const debris = useRef<THREE.InstancedMesh>(null);
  const fired = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const DEBRIS_N = 16;
  const debrisState = useMemo(
    () =>
      Array.from({ length: DEBRIS_N }, () => ({
        vx: (Math.random() * 2 - 1) * 6,
        vy: Math.random() * 5 + 2,
        vz: (Math.random() * 2 - 1) * 6,
        spin: Math.random() * 8,
      })),
    []
  );

  const initialized = useRef(false);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();

    // An InstancedMesh's un-set instances default to an identity matrix — a
    // unit cube sitting at the world origin — not "invisible." Zero every
    // instance out on the very first frame, before the collision has any
    // debris of its own to place there.
    if (!initialized.current) {
      initialized.current = true;
      if (debris.current) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        for (let i = 0; i < DEBRIS_N; i++) debris.current.setMatrixAt(i, dummy.matrix);
        debris.current.instanceMatrix.needsUpdate = true;
      }
      if (burst.current) burst.current.scale.setScalar(0);
    }

    if (t < IMPACT_T) {
      // Approach: the car drives its lane, the bike cuts across it — both
      // arrive at IMPACT_POINT at exactly t = IMPACT_T.
      const p = Math.min(1, t / IMPACT_T);
      if (car.current) {
        car.current.position.set(IMPACT_POINT[0], 0, 28 - (28 - IMPACT_POINT[1]) * p);
        car.current.rotation.y = Math.PI;
      }
      if (bike.current) {
        const BIKE_START_X = -6.5;
        const x = BIKE_START_X + (IMPACT_POINT[0] - BIKE_START_X) * p;
        bike.current.position.set(x, 0, IMPACT_POINT[1]);
        bike.current.rotation.y = Math.PI / 2; // travelling sideways, across the lane
      }
      return;
    }

    if (!fired.current) {
      fired.current = true;
      // The flash/debris still play under reduced motion — they convey the
      // moment without moving anything on screen. Only the camera jolt (a
      // motion effect, not a content one) is gated behind the media query.
      if (!prefersReducedMotion()) shakeRef.current = 1;
      triggerImpact();
      if (burst.current) {
        burst.current.scale.setScalar(0.1);
        (burst.current.material as THREE.MeshBasicMaterial).opacity = 1;
      }
      if (debris.current) {
        debrisState.forEach((d, i) => {
          dummy.position.set(IMPACT_POINT[0], 0.5, IMPACT_POINT[1]);
          dummy.scale.setScalar(0.22);
          dummy.updateMatrix();
          debris.current!.setMatrixAt(i, dummy.matrix);
        });
        debris.current.instanceMatrix.needsUpdate = true;
      }
    }

    const since = t - IMPACT_T;

    // The two actors crumple in place and dissolve rather than sliding away —
    // reads as wreckage settling, stays tasteful for a product site.
    const collapse = Math.max(0, 1 - since / 0.6);
    if (car.current) car.current.scale.setScalar(collapse);
    if (bike.current) bike.current.scale.setScalar(collapse);

    // Flash: expands and fades fast.
    if (burst.current && since < 0.5) {
      const k = since / 0.5;
      burst.current.scale.setScalar(0.1 + k * 5);
      (burst.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k) * 0.9;
    } else if (burst.current) {
      (burst.current.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    // Debris: simple ballistic flight, shrinking as it "settles" (a stand-in
    // for a fade, since scaling avoids per-instance transparency sorting).
    if (debris.current && since < 1.4) {
      debrisState.forEach((d, i) => {
        const x = IMPACT_POINT[0] + d.vx * since;
        const y = Math.max(0.06, 0.5 + d.vy * since - 4.9 * since * since);
        const z = IMPACT_POINT[1] + d.vz * since;
        const shrink = Math.max(0, 1 - since / 1.4);
        dummy.position.set(x, y, z);
        dummy.rotation.set(d.spin * since, d.spin * since * 0.7, 0);
        dummy.scale.setScalar(0.22 * shrink);
        dummy.updateMatrix();
        debris.current!.setMatrixAt(i, dummy.matrix);
      });
      debris.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={car}>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[1.5, 0.45, 3.3]} />
          <meshStandardMaterial color="#16233c" metalness={0.8} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.82, -0.3]}>
          <boxGeometry args={[1.28, 0.42, 1.55]} />
          <meshStandardMaterial color="#0e1a30" metalness={0.7} roughness={0.28} />
        </mesh>
        {[0.48, -0.48].map((x, i) => (
          <mesh key={i} position={[x, 0.45, -1.68]}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshBasicMaterial color="#eaf6ff" toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={bike}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.28, 0.32, 1.4]} />
          <meshStandardMaterial color="#1b2a44" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.92, 0.15]}>
          <capsuleGeometry args={[0.16, 0.42, 4, 8]} />
          <meshStandardMaterial color="#0b1220" metalness={0.3} roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.32, 0.02]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshStandardMaterial color="#dbe7f5" metalness={0.2} roughness={0.5} />
        </mesh>
      </group>
      <mesh ref={burst} position={[IMPACT_POINT[0], 0.6, IMPACT_POINT[1]]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#fff4e0" toneMapped={false} transparent opacity={0} depthWrite={false} />
      </mesh>
      <instancedMesh ref={debris} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, DEBRIS_N]}>
        <boxGeometry />
        <meshBasicMaterial color="#f59e0b" toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function Scene() {
  const shake = useRef(0);

  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.08) * 1.4;
    camera.position.y = 4 + Math.sin(t * 0.05) * 0.3;
    // Impact shake: an additive, hard-decaying jolt layered on the ambient
    // sway above — CollisionSequence sets shake.current = 1 exactly once.
    if (shake.current > 0.001) {
      camera.position.x += (Math.random() * 2 - 1) * 0.45 * shake.current;
      camera.position.y += (Math.random() * 2 - 1) * 0.3 * shake.current;
      shake.current *= 0.9;
    } else {
      shake.current = 0;
    }
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
      <CollisionSequence shakeRef={shake} />
      {/* A brief point-light pulse at the impact site, on top of the emissive
          burst mesh, so the flash actually lights the grid/cars around it
          rather than just glowing in isolation. */}
      <ImpactLight />
    </>
  );
}

/** A point light that snaps to full brightness at the impact instant and
 * decays with it — separate from the emissive burst mesh (which is unlit and
 * so cannot itself illuminate anything else in the scene). */
function ImpactLight() {
  const light = useRef<THREE.PointLight>(null);
  const fired = useRef(false);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!light.current) return;
    if (t < IMPACT_T) return;
    if (!fired.current) fired.current = true;
    const since = t - IMPACT_T;
    light.current.intensity = Math.max(0, 6 * (1 - since / 0.45));
  });

  return (
    <pointLight
      ref={light}
      position={[IMPACT_POINT[0], 1.2, IMPACT_POINT[1]]}
      color="#ffb35c"
      intensity={0}
      distance={14}
    />
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
