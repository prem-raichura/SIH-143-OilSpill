// 3D ocean scene built from the case data: the slick and its drift on a wind-driven sea, ships on their
// real AIS tracks. Lit by a fixed daytime sun so the sea always reads in colour (the satellite passes are
// at dawn, dusk or night, which rendered an almost black sea). An illustration, never evidence.
import { OrbitControls, Sky } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useCase, type CaseDerived } from "../case/useCase";
import { Segmented } from "../components/ui";
import { PALETTES } from "../design/palette";
import { PLACE } from "../data/places";
import { windAt } from "../lib/forcing";
import { particlesAt } from "../lib/oilroutes";
import { fmtRel, fmtUtc, isoAt, parseUtc } from "../lib/time";
import { useTheme } from "../store/theme";
import { stateAt } from "../lib/tracks";
import { hullKind, ROLE_LABEL, type Role, type Vessel } from "../lib/vessels";
import { useClock } from "../store/clock";
import { useWorkspace } from "../store/workspace";
import { makeLocal, OilMask, type MaskPaint } from "./oilMask";
import { buildShip, buildWake, type ShipModel } from "./shipModels";
import { createWaterMaterial } from "./waterMaterial";

type Preset = "overview" | "satellite" | "follow" | "edge";
const EXTENT = 140_000;
const SAR_BG = new THREE.Color("#000000");
/** Fixed late-morning sun: about 35° up, from the south-east. */
const SUN_DIR = (() => {
  const alt = (35 * Math.PI) / 180;
  const az = (135 * Math.PI) / 180; // clockwise from north
  return new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)).normalize();
})();
const SKY_SUN = SUN_DIR.clone().multiplyScalar(100);

interface SceneOpts {
  preset: Preset;
  presetKey: number;
  sar: boolean;
  sarWind: number;
  trueScale: boolean;
  labels: boolean;
  hypothesis: number | null;
  quality: "high" | "low";
}

function useSceneData(c: CaseDerived) {
  return useMemo(() => {
    const origin = c.centroid;
    const local = makeLocal(origin);
    const slickRings = c.slickRings.map((r) => r.map(local));
    return { origin, local, slickRings };
  }, [c]);
}

/** Mask content for clock time h (hours from the image). */
function maskFor(c: CaseDerived, local: (p: [number, number]) => [number, number], slickRings: [number, number][][], h: number, hyp: Vessel | null): MaskPaint {
  const ap = c.bundle.meta.slick.measures.age_prior_h;
  const out: MaskPaint = { particles: [], polygons: [], trail: null };
  if (!c.drift) return out;
  const limit = hyp?.candidate ? hyp.candidate.best_fit_age_h : ap.max;
  if (h < 0) {
    const age = -h;
    if (age <= limit) {
      const w = hyp?.candidate ? 1 : 1 - 0.7 * Math.min(1, Math.max(0, (age - ap.min) / Math.max(1, ap.max - ap.min)));
      const sinceRelease = hyp?.candidate ? Math.max(0, hyp.candidate.best_fit_age_h - age) : Math.max(0, ap.max - age);
      for (const p of particlesAt(c.drift.backward.frames, age)) {
        const [x, z] = local(p);
        out.particles.push({ x, z, w: w * 0.9, r: 520 + 70 * sinceRelease });
      }
    }
  } else {
    const r0 = 380 + 30 * ap.max;
    for (const p of particlesAt(c.drift.forward.frames, h)) {
      const [x, z] = local(p);
      out.particles.push({ x, z, w: 0.8, r: r0 + 40 * h });
    }
  }
  // The observed slick around the image time
  const near = Math.max(0, 1 - Math.abs(h) / 0.75);
  if (near > 0) out.polygons.push({ rings: slickRings, w: near });

  // Hypothesis: a discharge trail behind the chosen ship during its release window
  if (hyp?.candidate && c.trackIdx.has(hyp.mmsi)) {
    const ti = c.trackIdx.get(hyp.mmsi)!;
    const conf = hyp.candidate.confirmation;
    const t0 = conf ? (parseUtc(conf.release_window[0]) - parseUtc(c.bundle.meta.t_image)) / 3.6e6 : -hyp.candidate.best_fit_age_h - 1;
    const t1 = conf ? (parseUtc(conf.release_window[1]) - parseUtc(c.bundle.meta.t_image)) / 3.6e6 : -hyp.candidate.best_fit_age_h + 1;
    if (h >= t0 && h <= Math.min(0, t1 + 0.5)) {
      const pts: [number, number][] = [];
      for (let t = Math.max(t0, h - 1.5); t <= Math.min(h, t1); t += 0.05) pts.push(local(stateAt(ti, t).pos));
      out.trail = { pts, w: 1, widthM: 320 };
    }
  }
  return out;
}

interface ShipEntry {
  v: Vessel;
  model: ShipModel;
  wake: THREE.Mesh;
}

/** Ships that get a label in the scene. */
function labelled(v: Vessel, hypothesis: number | null) {
  return v.role === "leading" || v.role === "shortlist" || v.mmsi === hypothesis;
}

function World({ opts, onFollowMissing, labelEls, onShips }: {
  opts: SceneOpts;
  onFollowMissing: () => void;
  labelEls: React.MutableRefObject<Map<number, HTMLDivElement>>;
  onShips: (vs: Vessel[]) => void;
}) {
  const c = useCase();
  const { origin, local, slickRings } = useSceneData(c);
  const { camera, scene, gl } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const mask = useMemo(() => new OilMask(EXTENT), []);
  const water = useMemo(() => createWaterMaterial(mask.texture, mask.box()), [mask]);
  const lastPaint = useRef<{ h: number; hyp: number | null } | null>(null);

  useEffect(() => () => { mask.dispose(); water.dispose(); }, [mask, water]);

  const hypVessel = opts.hypothesis ? c.byMmsi.get(opts.hypothesis) ?? null : null;

  // Ships near the slick at some point in the window, plus the hypothesis ship
  const ships = useMemo<ShipEntry[]>(() => {
    if (!c.shipsUnlocked) return []; // v4.1 rule: no ships before the oil check
    const list = c.vessels.filter((v) => {
      const ti = c.trackIdx.get(v.mmsi);
      if (!ti) return false;
      if (v.mmsi === opts.hypothesis) return true;
      if (v.role === "background") return false;
      return ti.coords.some((p) => {
        const [x, z] = local(p);
        return Math.hypot(x, z) < EXTENT * 0.45;
      });
    });
    return list.slice(0, 24).map((v, i) => {
      const model = buildShip(hullKind(v.vesselType), 1000 + i * 37);
      const wake = buildWake();
      return { v, model, wake };
    });
  }, [c, local, opts.hypothesis]);

  useEffect(() => onShips(ships.map((s) => s.v)), [ships, onShips]);

  // Materials for radar look
  const sarMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff" }), []);

  // Camera presets
  const presetStart = useRef<{ t: number; from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const target = new THREE.Vector3(0, 0, 0);
    let pos = new THREE.Vector3();
    const m = c.bundle.meta.slick.measures;
    const L = m.length_km * 1000;
    if (opts.preset === "overview") {
      const d = Math.max(16_000, L * 0.9);
      target.copy(oilCenter.current);
      pos = oilCenter.current.clone().add(new THREE.Vector3(d * 0.35, d * 0.55, d * 0.95));
    } else if (opts.preset === "satellite") {
      pos = new THREE.Vector3(0, Math.max(45_000, L * 1.8), 1);
    } else if (opts.preset === "edge") {
      const b = ((m.fresh_end_bearing_deg ?? m.orientation_deg) * Math.PI) / 180;
      // Stand off the fresh end, low, looking back along the slick toward the sun-lit water.
      const out = new THREE.Vector3(Math.sin(b), 0, -Math.cos(b));
      const end = out.clone().multiplyScalar(L * 0.5);
      target.copy(end).addScaledVector(out, -Math.min(6000, L * 0.25));
      pos = end.clone().addScaledVector(out, 3500).add(new THREE.Vector3(0, 1100, 0));
    } else {
      pos = cam.position.clone();
    }
    const ctl = controls.current;
    presetStart.current = {
      t: performance.now(),
      from: cam.position.clone(),
      to: pos,
      tFrom: ctl ? ctl.target.clone() : new THREE.Vector3(),
      tTo: target,
    };
    if (opts.preset === "follow") presetStart.current = null;
  }, [opts.preset, opts.presetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, opts.quality === "high" ? 1.5 : 1));
  }, [gl, opts.quality]);

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const oilCenter = useRef(new THREE.Vector3());
  const userMoved = useRef(false);
  useEffect(() => {
    userMoved.current = false;
  }, [opts.preset, opts.presetKey]);
  useEffect(() => {
    const ctl = controls.current;
    if (!ctl) return;
    const onStart = () => {
      if (!presetStart.current) userMoved.current = true;
    };
    ctl.addEventListener("start", onStart);
    return () => ctl.removeEventListener("start", onStart);
  });

  useFrame((state, delta) => {
    const h = useClock.getState().h;
    const ctl = controls.current;
    water.uniforms.uTime.value = state.clock.elapsedTime;

    // Wind drives the waves
    const w = windAt(c.forcing, origin, h);
    const ws = Math.hypot(w[0], w[1]);
    water.uniforms.uWindDir.value.set(w[0], -w[1]).normalize();
    water.uniforms.uWindSpeed.value = ws;
    water.uniforms.uSar.value = opts.sar ? 1 : 0;
    water.uniforms.uSarWind.value = opts.sarWind;

    // Oil mask (repaint when the clock moves enough)
    const lp = lastPaint.current;
    if (!lp || Math.abs(lp.h - h) > 0.08 || lp.hyp !== opts.hypothesis) {
      const paint = maskFor(c, local, slickRings, h, hypVessel);
      mask.paint(paint);
      lastPaint.current = { h, hyp: opts.hypothesis };
      if (paint.particles.length) {
        let sx = 0, sz = 0;
        for (const q of paint.particles) { sx += q.x; sz += q.z; }
        oilCenter.current.set(sx / paint.particles.length, 0, sz / paint.particles.length);
      } else if (paint.polygons.length) oilCenter.current.set(0, 0, 0);
    }

    // Overview keeps the oil in frame while the clock plays, unless the user has moved the camera.
    if (opts.preset === "overview" && !presetStart.current && ctl && !userMoved.current) {
      const d = oilCenter.current.clone().sub(ctl.target).multiplyScalar(Math.min(1, delta * 1.5));
      ctl.target.add(d);
      camera.position.add(d);
      ctl.update();
    }

    // Camera preset transitions
    const ps = presetStart.current;
    if (ps && ctl) {
      const t = Math.min(1, (performance.now() - ps.t) / 1400);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(ps.from, ps.to, e);
      ctl.target.lerpVectors(ps.tFrom, ps.tTo, e);
      ctl.update();
      if (t >= 1) presetStart.current = null;
    }

    // Ships
    const camH = Math.max(50, camera.position.y);
    const exag = opts.trueScale ? 1 : THREE.MathUtils.clamp(camH / 600, 1, 28);
    let followed: ShipEntry | undefined;
    for (const s of ships) {
      const ti = c.trackIdx.get(s.v.mmsi)!;
      const st = stateAt(ti, h);
      const [x, z] = local(st.pos);
      const visible = st.status === "moving" || (st.status === "gap" && st.sinceFixH < 2) || (st.status === "after" && st.sinceFixH < 1);
      const g = s.model.group;
      g.visible = visible;
      s.wake.visible = visible && st.status === "moving" && !opts.sar;
      const el = labelEls.current.get(s.v.mmsi);
      if (!visible) {
        if (el) el.style.display = "none";
        continue;
      }
      const heading = (st.bearing * Math.PI) / 180;
      const bob = Math.sin(state.clock.elapsedTime * 0.9 + s.v.mmsi) * 0.012;
      g.position.set(x, 0, z);
      g.rotation.set(bob, -heading, Math.sin(state.clock.elapsedTime * 0.7 + s.v.mmsi * 0.3) * 0.02);
      g.scale.setScalar(exag);
      s.model.navLights.visible = false;
      // Wake behind the stern, length grows with speed
      const sog = st.sog ?? 10;
      const wakeLen = (s.model.length * 1.6 + sog * 32) * exag;
      s.wake.position.set(x, 0.4, z);
      s.wake.rotation.set(0, -heading, 0);
      s.wake.scale.set(wakeLen, 1, wakeLen);
      tmp.v.set(0, 0, s.model.length * 0.45 * exag).applyAxisAngle(new THREE.Vector3(0, 1, 0), -heading);
      s.wake.position.add(tmp.v);
      if (el) {
        tmp.v.set(x, (s.model.length * 0.18 + 25) * exag, z).project(camera);
        const onScreen = tmp.v.z < 1 && Math.abs(tmp.v.x) < 1.2 && Math.abs(tmp.v.y) < 1.2;
        el.style.display = onScreen && opts.labels ? "" : "none";
        el.style.transform = `translate(${((tmp.v.x + 1) / 2) * state.size.width}px, ${((1 - tmp.v.y) / 2) * state.size.height}px) translate(-50%, -120%)`;
      }
      if (opts.preset === "follow" && s.v.mmsi === (opts.hypothesis ?? useWorkspace.getState().selectedMmsi)) followed = s;
      // Radar look: ships become bright point targets
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const ud = mesh.userData as { orig?: THREE.Material };
        if (opts.sar) {
          if (!ud.orig) ud.orig = mesh.material as THREE.Material;
          mesh.material = sarMat;
        } else if (ud.orig) {
          mesh.material = ud.orig;
          delete ud.orig;
        }
      });
    }

    if (opts.preset === "follow" && ctl) {
      if (!followed) onFollowMissing();
      else {
        const g = followed.model.group;
        const heading = g.rotation.y;
        const back = new THREE.Vector3(0, 0, followed.model.length * 2.4 * exag).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
        const desired = g.position.clone().add(back).add(new THREE.Vector3(0, followed.model.length * 0.55 * exag, 0));
        camera.position.lerp(desired, Math.min(1, delta * 2.5));
        ctl.target.lerp(g.position, Math.min(1, delta * 4));
        ctl.update();
      }
    }

    // Fixed daytime colours; only the radar look changes the background and fog.
    water.uniforms.uFogDensity.value = opts.sar ? 0 : 0.0000055;
    scene.background = opts.sar ? SAR_BG : null;
  });

  return (
    <>
      {!opts.sar && <Sky distance={450000} sunPosition={SKY_SUN} turbidity={4} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.82} />}
      <hemisphereLight args={["#CFE6FF", "#1B4A63", 0.9]} />
      <directionalLight color="#FFF3DC" intensity={2.2} position={SUN_DIR.clone().multiplyScalar(10000)} />
      <mesh rotation-x={-Math.PI / 2} material={water} frustumCulled={false}>
        <planeGeometry args={[600_000, 600_000, 1, 1]} />
      </mesh>
      {ships.map((s) => (
        <group key={s.v.mmsi}>
          <primitive object={s.model.group} />
          <primitive object={s.wake} />
        </group>
      ))}
      <OrbitControls ref={controls as never} makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI * 0.495} minDistance={40} maxDistance={260000} />
    </>
  );
}

function webgl2(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

export default function OceanScene() {
  const c = useCase();
  const ws = useWorkspace();
  const h = useClock((s) => s.h);
  const P = PALETTES[useTheme((s) => s.theme)];
  const roleHex: Record<Role, string> = { leading: P.shipLead, shortlist: P.shipShort, screened: P.shipScreen, eliminated: P.shipElim, background: P.shipElim };
  const lead = c.verdict.code === 3 ? c.verdict.lead?.mmsi ?? null : null;
  const selectedCand = ws.selectedMmsi && c.byMmsi.get(ws.selectedMmsi)?.candidate ? ws.selectedMmsi : null;
  const [opts, setOpts] = useState<SceneOpts>({
    preset: "overview",
    presetKey: 0,
    sar: false,
    sarWind: 6,
    trueScale: false,
    labels: true,
    hypothesis: c.shipsUnlocked ? selectedCand ?? lead : null,
    quality: "high",
  });
  const set = (p: Partial<SceneOpts>) => setOpts((o) => ({ ...o, ...p }));
  const labelEls = useRef(new Map<number, HTMLDivElement>());
  const [sceneShips, setSceneShips] = useState<Vessel[]>([]);
  const hyp = opts.hypothesis ? c.byMmsi.get(opts.hypothesis) : undefined;
  const candidates = c.vessels.filter((v) => v.candidate && c.trackIdx.has(v.mmsi) && (v.role === "leading" || v.role === "shortlist" || v.role === "screened")).slice(0, 12);

  if (!webgl2()) return <div className="page-pad">3D needs WebGL 2. The map views still work.</div>;

  return (
    <div className="scene-wrap">
      <Canvas
        camera={{ fov: 42, near: 1, far: 900_000, position: [12000, 16000, 26000] }}
        gl={{ logarithmicDepthBuffer: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        <World opts={opts} labelEls={labelEls} onShips={setSceneShips} onFollowMissing={() => set({ preset: "overview", presetKey: opts.presetKey + 1 })} />
      </Canvas>
      <div className="scene-labels" aria-hidden="true">
        {sceneShips.filter((v) => labelled(v, opts.hypothesis)).map((v) => (
          <div
            key={v.mmsi}
            className="scene-label"
            style={{ display: "none" }}
            ref={(el) => {
              if (el) labelEls.current.set(v.mmsi, el);
              else labelEls.current.delete(v.mmsi);
            }}
          >
            <i style={{ background: roleHex[v.role] }} />
            {v.name}
            <span>{v.mmsi === opts.hypothesis ? "hypothesis" : ROLE_LABEL[v.role].toLowerCase()}</span>
          </div>
        ))}
      </div>

      <div className="scene-hud scene-hud-tl">
        <span className="place">{PLACE[c.bundle.entry.id]}</span>
        <b className="num">{fmtUtc(isoAt(c.bundle.meta.t_image, h))}</b>
        <span className="num">{fmtRel(h)}</span>
      </div>

      <details className="scene-hud scene-hud-tr" open>
        <summary><b>View controls</b></summary>
        <Segmented<Preset>
          label="Camera"
          size="sm"
          value={opts.preset}
          onChange={(p) => set({ preset: p, presetKey: opts.presetKey + 1, sar: p === "satellite" ? opts.sar : false })}
          options={[
            { value: "overview", label: "Overview" },
            { value: "satellite", label: "Satellite pass" },
            { value: "follow", label: "Follow ship", disabled: !hyp && !ws.selectedMmsi },
            { value: "edge", label: "Slick edge" },
          ]}
        />
        {!c.analyst && (
        <label className="scene-field">
          <span>Hypothesis ship</span>
          <select className="select" value={opts.hypothesis ?? ""} disabled={!c.shipsUnlocked} onChange={(e) => set({ hypothesis: e.target.value ? Number(e.target.value) : null })}>
            <option value="">None (oil only)</option>
            {candidates.map((v) => (
              <option key={v.mmsi} value={v.mmsi}>{v.name} ({ROLE_LABEL[v.role].toLowerCase()})</option>
            ))}
          </select>
        </label>
        )}
        <div className="scene-toggles">
          <label title="Grey-scale, the way the satellite radar sees the sea"><input type="checkbox" checked={opts.sar} onChange={(e) => set({ sar: e.target.checked, preset: e.target.checked ? "satellite" : opts.preset, presetKey: opts.presetKey + (e.target.checked ? 1 : 0) })} /> Radar look</label>
          <label><input type="checkbox" checked={opts.trueScale} onChange={(e) => set({ trueScale: e.target.checked })} /> True ship size</label>
          <label><input type="checkbox" checked={opts.labels} onChange={(e) => set({ labels: e.target.checked })} /> Labels</label>
          <label><input type="checkbox" checked={opts.quality === "low"} onChange={(e) => set({ quality: e.target.checked ? "low" : "high" })} /> Low quality</label>
        </div>
        {opts.sar && (
          <label className="scene-field">
            <span>Wind {opts.sarWind} m/s: {opts.sarWind < 3 ? "calm sea looks dark everywhere (look-alike risk)" : opts.sarWind > 10 ? "waves break through, the slick fades" : "oil stands out as a dark calm patch"}</span>
            <input type="range" min={0} max={15} step={0.5} value={opts.sarWind} onChange={(e) => set({ sarWind: Number(e.target.value) })} />
          </label>
        )}
      </details>

      {hyp && c.shipsUnlocked && (
        <div className="scene-banner" role="note">
          Hypothesis: if {hyp.name} released oil around {fmtUtc(hyp.candidate!.best_fit_release_time)}. Illustration, not evidence.
        </div>
      )}
      {!c.shipsUnlocked && !c.analyst && <div className="scene-banner" role="note">Ships appear after the oil check. Showing the oil only.</div>}
      {h < -(hyp?.candidate ? hyp.candidate.best_fit_age_h : c.bundle.meta.slick.measures.age_prior_h.max) && (
        <div className="scene-hud scene-hud-note" role="note">
          No oil on the water yet: this is before {hyp?.candidate ? "the hypothesis release time" : "the oldest age in the prior"}. Move the timeline forward.
        </div>
      )}
      <p className="scene-foot"><span>3D view built from this case's data: slick outline, drift particles, ERA5 wind, AIS tracks. Daylight lighting for readability. Ship models are generic by type{opts.trueScale ? "" : " and enlarged so they stay visible"}.</span></p>
    </div>
  );
}
