"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { ProceduralParams } from "@/lib/visual";
import { makeBand } from "./geometry/band";
import { layoutRing, type RingLayout } from "./geometry/layout";
import { makeStone } from "./geometry/stone";
import { makeMeleeMaterial, makeMetalMaterial, makeStoneMaterial, metalsFor } from "./materials";
import { RingSketch } from "./RingSketch";

function RingModel({ params, layout }: { params: ProceduralParams; layout: RingLayout }) {
  const mats = useMemo(() => {
    const m = metalsFor(params.metal);
    return {
      band: makeMetalMaterial(m.band),
      head: makeMetalMaterial(m.head),
      stone: makeStoneMaterial(params.centerStone),
      melee: makeMeleeMaterial(),
    };
  }, [params.metal, params.centerStone]);

  const geos = useMemo(() => {
    const bands = layout.bandParts.map((b) =>
      makeBand({ widthMm: b.widthMm, profile: params.bandProfile, zOffset: b.zOffset, widthScale: b.widthScale, thicknessMm: layout.bandThickness }),
    );
    const stones = layout.stones.map((s) => makeStone(s.shape, s.carat).geometry);
    const tubes = layout.tubes.map((t) => {
      const curve = new THREE.CatmullRomCurve3(t.points.map((p) => new THREE.Vector3(...p)), Boolean(t.closed), "centripetal");
      return new THREE.TubeGeometry(curve, t.closed ? Math.max(48, t.points.length * 2) : 24, t.radius, 10, Boolean(t.closed));
    });
    const rims = layout.rims.map((r) => {
      const outer = new THREE.Shape(r.outline.map(([x, y]) => new THREE.Vector2(x * r.outer, y * r.outer)));
      outer.holes.push(new THREE.Path([...r.outline].reverse().map(([x, y]) => new THREE.Vector2(x * r.inner, y * r.inner))));
      const g = new THREE.ExtrudeGeometry(outer, { depth: r.y1 - r.y0, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, r.y0, 0);
      return g;
    });
    const sphere = new THREE.SphereGeometry(1, 16, 12);
    const gem = new THREE.IcosahedronGeometry(1, 1);
    return { bands, stones, tubes, rims, sphere, gem };
  }, [layout, params.bandProfile]);

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      [...geos.bands, ...geos.stones, ...geos.tubes, ...geos.rims, geos.sphere, geos.gem].forEach((g) => g.dispose());
    },
    [mats, geos],
  );

  return (
    <group>
      {geos.bands.map((g, i) => (
        <mesh key={`b${i}`} geometry={g} material={mats.band} />
      ))}
      {layout.stones.map((s, i) => (
        <mesh key={`s${i}`} geometry={geos.stones[i]} material={mats.stone} position={s.position} rotation={s.rotation} />
      ))}
      {layout.tubes.map((t, i) => (
        <mesh key={`t${i}`} geometry={geos.tubes[i]} material={t.part === "band" ? mats.band : mats.head} />
      ))}
      {layout.rims.map((r, i) => (
        <mesh key={`r${i}`} geometry={geos.rims[i]} material={mats.head} position={r.position} />
      ))}
      {layout.spheres.map((s, i) => (
        <Instanced
          key={`p${i}`}
          positions={s.positions}
          radius={s.radius}
          geometry={s.material === "stone" ? geos.gem : geos.sphere}
          material={s.material === "stone" ? mats.melee : s.material === "band" ? mats.band : mats.head}
        />
      ))}
    </group>
  );
}

function Instanced({ positions, radius, geometry, material }: { positions: [number, number, number][]; radius: number; geometry: THREE.BufferGeometry; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(radius, radius, radius);
    positions.forEach((p, i) => {
      q.setFromEuler(new THREE.Euler(i * 0.7, i * 1.3, 0));
      m.compose(new THREE.Vector3(...p), q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [positions, radius]);
  return <instancedMesh ref={ref} args={[geometry, material, positions.length]} />;
}

/** Gently sways the ring and reports readiness after the first frames are drawn. */
function Rig({ children, onReady, still }: { children: ReactNode; onReady?: () => void; still?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const frames = useRef(0);
  useFrame((state) => {
    if (ref.current && !still) {
      const t = state.clock.getElapsedTime();
      ref.current.rotation.y = -0.55 + Math.sin(t * 0.45) * 0.45;
    }
    frames.current++;
    if (frames.current === 3) onReady?.();
  });
  return (
    <group ref={ref} rotation={[0.5, -0.55, 0]}>
      {children}
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 25, 15]} intensity={1.6} />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#8d8782"]} />
        <Lightformer form="rect" intensity={4} position={[0, 6, -10]} scale={[18, 3, 1]} />
        <Lightformer form="rect" intensity={3} position={[-10, 2, 0]} rotation-y={Math.PI / 2} scale={[12, 3, 1]} />
        <Lightformer form="rect" intensity={3} position={[10, 2, 0]} rotation-y={-Math.PI / 2} scale={[12, 3, 1]} />
        <Lightformer form="ring" intensity={5} position={[0, 10, 4]} rotation-x={Math.PI / 2} scale={5} />
        <Lightformer form="rect" intensity={1.5} color="#ffe9d6" position={[0, -6, 6]} scale={[14, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 4, 12]} scale={[16, 4, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#1d1b1a" position={[0, -10, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} />
      </Environment>
    </>
  );
}

class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export type ProceduralRingProps = {
  params: ProceduralParams;
  /** Called once the 3D ring has drawn its first frames (or the SVG fallback is shown). */
  onReady?: (mode: "webgl" | "svg") => void;
  /** Disable motion (e.g. prefers-reduced-motion). */
  still?: boolean;
  /** Detail view: drag to rotate, pinch/scroll to zoom (the ring holds still so the user is in control). */
  interactive?: boolean;
};

/**
 * Live 3D render of a ring from its attributes. Only mount this for the top card —
 * browsers cap the number of WebGL contexts. Falls back to an SVG sketch if WebGL fails.
 */
export default function ProceduralRing({ params, onReady, still, interactive }: ProceduralRingProps) {
  const layout = useMemo(() => layoutRing(params), [params]);
  const [gl, setGl] = useState<"unknown" | "yes" | "no">("unknown");
  useEffect(() => setGl(webglAvailable() ? "yes" : "no"), []);

  const fallback = <SketchFallback params={params} onReady={onReady} />;
  if (gl === "unknown") return <RingSketch params={params} />;
  if (gl === "no") return fallback;

  // Frame the whole ring with extra headroom above the stone (the tilt pushes it up).
  const top = layout.top + 1.5;
  const bottom = layout.bottom - 0.5;
  const height = top - bottom;
  const centerY = (top + bottom) / 2;
  const fov = 30;
  const dist = (height / 2 / Math.tan((fov * Math.PI) / 360)) * 1.0;

  return (
    <GLBoundary fallback={fallback}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov, position: [0, dist * 0.18, dist], near: 1, far: 400 }}
        onCreated={({ camera, gl: renderer }) => {
          camera.lookAt(0, 1.2, 0);
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.05;
        }}
        // On the deck the canvas ignores pointers so swipes reach the card; in the detail view it takes them.
        style={{ touchAction: "none", pointerEvents: interactive ? "auto" : "none" }}
        data-testid="ring-canvas"
      >
        <Lights />
        {interactive && (
          <OrbitControls
            makeDefault
            target={[0, 1.2, 0]}
            enablePan={false}
            enableDamping
            minDistance={dist * 0.45}
            maxDistance={dist * 1.6}
            autoRotate
            autoRotateSpeed={0.8}
          />
        )}
        <Rig onReady={() => onReady?.("webgl")} still={still || interactive}>
          <group position={[0, -centerY, 0]}>
            <RingModel params={params} layout={layout} />
          </group>
        </Rig>
      </Canvas>
    </GLBoundary>
  );
}

function SketchFallback({ params, onReady }: { params: ProceduralParams; onReady?: (m: "svg") => void }) {
  useEffect(() => onReady?.("svg"), [onReady]);
  return <RingSketch params={params} />;
}
