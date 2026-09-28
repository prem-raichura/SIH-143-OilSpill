// Small overview (locator) map: land outline around the current view, with the view's extent as a box.
// Drawn in SVG so it needs no second WebGL context.
import { WebMercatorViewport } from "@deck.gl/core";
import { useMemo } from "react";
import type { LandFC } from "../data/load";
import type { LonLat } from "../data/types";
import { geometryRings } from "../lib/geo";

const W = 184;
const H = 120;

export default function OverviewMap({ vp, land, onJump }: { vp: WebMercatorViewport | null; land?: LandFC; onJump: (p: LonLat) => void }) {
  const [lon, lat] = vp ? vp.unproject([vp.width / 2, vp.height / 2]) : [0, 0];
  const zoom = vp ? Math.max(1, vp.zoom - 4) : 1;
  // Recompute the land path only when the overview moves noticeably.
  const key = vp ? `${Math.round(lon * 4) / 4}|${Math.round(lat * 4) / 4}|${Math.round(zoom * 2) / 2}` : "";
  const ov = useMemo(() => {
    if (!vp) return null;
    const [klon, klat, kz] = key.split("|").map(Number);
    const o = new WebMercatorViewport({ width: W, height: H, longitude: klon, latitude: klat, zoom: kz });
    let d = "";
    for (const f of land?.features ?? []) {
      for (const ring of geometryRings(f.geometry)) {
        let seg = "";
        for (let i = 0; i < ring.length; i += ring.length > 400 ? 3 : 1) {
          const [x, y] = o.project(ring[i]);
          seg += `${seg ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        if (seg) d += `${seg}Z`;
      }
    }
    return { o, d };
  }, [key, land]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!vp || !ov) return null;
  const corners = [[0, 0], [vp.width, 0], [vp.width, vp.height], [0, vp.height]].map((p) => ov.o.project(vp.unproject(p) as LonLat));
  const box = corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const small = Math.abs(corners[1][0] - corners[0][0]) < 8;
  const c = ov.o.project([lon, lat]);
  return (
    <div className="overview" aria-label="Overview map. Click to move the main map there.">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onJump(ov.o.unproject([e.clientX - r.left, e.clientY - r.top]) as LonLat);
        }}
      >
        <rect width={W} height={H} fill="var(--sea)" />
        <path d={ov.d} fill="var(--land)" stroke="var(--coast)" strokeWidth={0.8} />
        {small ? (
          <g>
            <circle cx={c[0]} cy={c[1]} r={5} fill="none" stroke="var(--accent)" strokeWidth={2} />
            <circle cx={c[0]} cy={c[1]} r={1.5} fill="var(--accent)" />
          </g>
        ) : (
          <polygon points={box} fill="var(--accent)" fillOpacity={0.14} stroke="var(--accent)" strokeWidth={1.6} />
        )}
      </svg>
    </div>
  );
}
