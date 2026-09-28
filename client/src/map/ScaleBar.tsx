import type { WebMercatorViewport } from "@deck.gl/core";
import { KM_PER_NM } from "../lib/geo";

const NICE = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

export default function ScaleBar({ vp }: { vp: WebMercatorViewport | null }) {
  if (!vp) return null;
  const [lon, lat] = vp.unproject([vp.width / 2, vp.height / 2]);
  // unitsPerMeter is in common units (zoom 0); multiply by the viewport scale for pixels.
  const metersPerPx = 1 / (vp.getDistanceScales([lon, lat]).unitsPerMeter[0] * vp.scale);
  if (!metersPerPx) return null;
  const kmPerPx = metersPerPx / 1000;
  const maxPx = 110;
  const nm = [...NICE].reverse().find((d) => (d * KM_PER_NM) / kmPerPx <= maxPx) ?? 0.5;
  const km = [...NICE].reverse().find((d) => d / kmPerPx <= maxPx) ?? 0.5;
  return (
    <div className="scale-bar" aria-label={`Scale: ${nm} nautical miles, ${km} kilometres`}>
      <span className="sb-row"><span className="bar" style={{ width: (nm * KM_PER_NM) / kmPerPx }} /><span>{nm} nm</span></span>
      <span className="sb-row"><span className="bar bar-km" style={{ width: km / kmPerPx }} /><span>{km} km</span></span>
    </div>
  );
}
