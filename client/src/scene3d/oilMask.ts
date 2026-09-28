// Oil thickness mask for the water shader, painted from the case data on a canvas.
// Red channel = relative thickness. Box is centred on the scene origin, x = east, z = south (three.js, north = -z).
import * as THREE from "three";
import type { LonLat } from "../data/types";

export interface MaskPaint {
  /** Particles in local metres [x, z] with a per-point weight 0..1 and radius in metres. */
  particles: { x: number; z: number; w: number; r: number }[];
  /** Polygons in local metres (x, z) drawn solid, with an overall weight. */
  polygons: { rings: [number, number][][]; w: number }[];
  /** Thin discharge trail behind a hypothesis ship. */
  trail: { pts: [number, number][]; w: number; widthM: number } | null;
}

export class OilMask {
  readonly size = 2048;
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  readonly extentM: number; // full width of the box in metres
  private g: CanvasRenderingContext2D;
  private tmp: HTMLCanvasElement;
  private tg: CanvasRenderingContext2D;

  constructor(extentM: number) {
    this.extentM = extentM;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.g = this.canvas.getContext("2d", { willReadFrequently: false })!;
    this.tmp = document.createElement("canvas");
    this.tmp.width = this.size;
    this.tmp.height = this.size;
    this.tg = this.tmp.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.flipY = false;
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;
    this.texture.anisotropy = 4;
  }

  /** uOilBox uniform: x0, z0, sizeX, sizeZ */
  box(): THREE.Vector4 {
    return new THREE.Vector4(-this.extentM / 2, -this.extentM / 2, this.extentM, this.extentM);
  }

  private px(x: number, z: number): [number, number] {
    return [((x + this.extentM / 2) / this.extentM) * this.size, ((z + this.extentM / 2) / this.extentM) * this.size];
  }

  paint(p: MaskPaint) {
    const g = this.g;
    const S = this.size;
    const k = S / this.extentM;
    g.globalCompositeOperation = "source-over";
    g.filter = "none";
    g.fillStyle = "#000";
    g.fillRect(0, 0, S, S);

    // Particles: soft additive splats
    g.globalCompositeOperation = "lighter";
    for (const q of p.particles) {
      const [cx, cy] = this.px(q.x, q.z);
      const r = Math.max(2, q.r * k);
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      const a = Math.min(1, q.w);
      grad.addColorStop(0, `rgba(255,0,0,${(0.45 * a).toFixed(3)})`);
      grad.addColorStop(0.6, `rgba(255,0,0,${(0.18 * a).toFixed(3)})`);
      grad.addColorStop(1, "rgba(255,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }

    // Merge neighbouring splats into one continuous film (about 300 m of blur).
    if (p.particles.length) {
      const blurPx = Math.max(2, Math.round((300 * S) / this.extentM));
      this.tg.globalCompositeOperation = "copy";
      this.tg.filter = `blur(${blurPx}px)`;
      this.tg.drawImage(this.canvas, 0, 0);
      this.tg.filter = "none";
      g.globalCompositeOperation = "copy";
      g.drawImage(this.tmp, 0, 0);
      // Boost the merged film so its core reads as thick oil.
      g.globalCompositeOperation = "lighter";
      g.drawImage(this.tmp, 0, 0);
    }

    // Polygons: the observed slick at image time
    g.globalCompositeOperation = "lighter";
    for (const poly of p.polygons) {
      g.filter = "blur(2px)";
      g.fillStyle = `rgba(255,0,0,${poly.w.toFixed(3)})`;
      g.beginPath();
      for (const ring of poly.rings) {
        ring.forEach(([x, z], i) => {
          const [cx, cy] = this.px(x, z);
          if (i === 0) g.moveTo(cx, cy);
          else g.lineTo(cx, cy);
        });
        g.closePath();
      }
      g.fill("evenodd");
      g.filter = "none";
    }

    if (p.trail && p.trail.pts.length > 1) {
      g.globalCompositeOperation = "lighter";
      g.filter = "blur(1px)";
      g.strokeStyle = `rgba(255,0,0,${p.trail.w.toFixed(3)})`;
      g.lineWidth = Math.max(1.5, p.trail.widthM * k);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      p.trail.pts.forEach(([x, z], i) => {
        const [cx, cy] = this.px(x, z);
        if (i === 0) g.moveTo(cx, cy);
        else g.lineTo(cx, cy);
      });
      g.stroke();
      g.filter = "none";
    }
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}

/** lon/lat -> local metres (x east, z south) around an origin. */
export function makeLocal(origin: LonLat) {
  const R = 6371008.8;
  const kx = (Math.PI / 180) * R * Math.cos((origin[1] * Math.PI) / 180);
  const ky = (Math.PI / 180) * R;
  return (p: LonLat): [number, number] => [(p[0] - origin[0]) * kx, -(p[1] - origin[1]) * ky];
}
