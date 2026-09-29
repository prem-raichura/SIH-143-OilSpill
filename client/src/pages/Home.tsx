import type { PickingInfo, WebMercatorViewport } from "@deck.gl/core";
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { ChevronRight, Map as MapIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorNote, Loading, PageHeader, StatCard, Tabs, VerdictChip } from "../components/ui";
import { dataUrl, fetchJson, useCasesIndex, useShared } from "../data/load";
import { PLACE, REGION_BOUNDS, REGION_LABEL, type Region } from "../data/places";
import type { CaseIndexEntry, FeatureCollection, Meta, PolygonGeometry, VerdictCode } from "../data/types";
import { PALETTES, rgba, type Palette } from "../design/palette";
import BasemapSwitcher from "../map/BasemapSwitcher";
import ChartFrame, { graticuleLines } from "../map/ChartFrame";
import { basemapDef, basemapLayers, FONT_SANS } from "../map/layers/basemap";
import MapControls from "../map/MapControls";
import MapLegend from "../map/MapLegend";
import { MapCanvas, type MapHandle } from "../map/MapCanvas";
import { fmtUtc } from "../lib/time";
import { VERDICT_SHORT } from "../lib/verdict";
import { useMapPrefs } from "../store/mapPrefs";
import { useReview } from "../store/review";
import { useTheme } from "../store/theme";

interface CaseGeo {
  entry: CaseIndexEntry;
  slick: FeatureCollection<PolygonGeometry>;
  meta: Meta;
}

const verdictColor = (P: Palette, code: VerdictCode) => P[`v${code}` as "v1"];

export default function Home() {
  const index = useCasesIndex();
  const [region, setRegion] = useState<Region>("india");
  const [hot, setHot] = useState<string | null>(null);
  const [hoverXY, setHoverXY] = useState<{ x: number; y: number } | null>(null);
  const [geos, setGeos] = useState<Record<string, CaseGeo>>({});
  const [vp, setVp] = useState<WebMercatorViewport | null>(null);
  const [fitN, setFitN] = useState(0);
  const theme = useTheme((s) => s.theme);
  const P = PALETTES[theme];
  const shared = useShared(region);
  const { basemap, advanced } = useMapPrefs();
  const gates = useReview((s) => s.gate);
  const navigate = useNavigate();
  const mapRef = useRef<MapHandle>(null);

  useEffect(() => {
    if (!index.data) return;
    let live = true;
    Promise.all(
      index.data.cases.map(async (c) => {
        const [slick, meta] = await Promise.all([
          fetchJson<FeatureCollection<PolygonGeometry>>(`${c.path}slick.geojson`),
          fetchJson<Meta>(`${c.path}meta.json`),
        ]);
        return [c.id, { entry: c, slick, meta }] as const;
      }),
    ).then((pairs) => live && setGeos(Object.fromEntries(pairs)));
    return () => {
      live = false;
    };
  }, [index.data]);

  const cases = useMemo(() => (index.data?.cases ?? []).filter((c) => c.region === region), [index.data, region]);
  const counts = useMemo(() => {
    const all = index.data?.cases ?? [];
    return {
      india: all.filter((c) => c.region === "india").length,
      gulf_of_mexico: all.filter((c) => c.region === "gulf_of_mexico").length,
      waiting: all.filter((c) => !gates[c.id]).length,
      checked: all.filter((c) => gates[c.id]).length,
      total: all.length,
    };
  }, [index.data, gates]);

  const markerPos = (c: CaseIndexEntry): [number, number] => geos[c.id]?.meta.slick.measures.centroid ?? c.centroid;

  const base = basemapLayers({
    land: shared.land,
    eez: shared.eez,
    graticule: advanced ? graticuleLines(vp) : [],
    palette: P,
    show: { eez: true, graticule: advanced },
    region,
    zoom: vp?.zoom ?? 4,
    theme,
    basemap,
  });
  const layers = [
    ...base.under,
    ...base.over,
    new GeoJsonLayer({
      id: "home-slicks",
      data: cases.flatMap((c) => geos[c.id]?.slick.features ?? []) as never,
      filled: true,
      stroked: true,
      getFillColor: rgba("#1D1712", 0.5),
      getLineColor: rgba(P.past),
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      updateTriggers: { getLineColor: theme },
    }),
    new ScatterplotLayer<CaseIndexEntry>({
      id: "home-markers",
      data: cases,
      getPosition: markerPos,
      getRadius: (c) => (c.id === hot ? 15 : 11),
      radiusUnits: "pixels",
      stroked: true,
      filled: true,
      getFillColor: (c) => rgba(verdictColor(P, c.verdict.code), c.id === hot ? 1 : 0.88),
      getLineColor: (c) => (c.id === hot ? rgba(P.ink) : rgba(theme === "night" ? P.sea : "#FFFFFF")),
      lineWidthUnits: "pixels",
      getLineWidth: (c) => (c.id === hot ? 3 : 2.5),
      pickable: true,
      updateTriggers: { getRadius: hot, getFillColor: [hot, theme], getLineWidth: hot, getLineColor: [hot, theme], getPosition: Object.keys(geos).length },
      transitions: { getRadius: 150 },
    }),
    new TextLayer<CaseIndexEntry>({
      id: "home-labels",
      data: cases,
      getPosition: markerPos,
      getText: (c) => PLACE[c.id] ?? c.id,
      getSize: 13,
      getColor: rgba(P.ink),
      fontFamily: FONT_SANS,
      fontWeight: 600,
      getPixelOffset: [18, 0],
      getTextAnchor: "start",
      getAlignmentBaseline: "center",
      outlineWidth: 4,
      outlineColor: rgba(P.sea),
      fontSettings: { sdf: true },
      characterSet: "auto",
      updateTriggers: { getColor: theme, outlineColor: theme, getPosition: Object.keys(geos).length },
    }),
  ];

  const hotCase = hot ? geos[hot] : null;

  const onHover = (info: PickingInfo) => {
    if (info.layer?.id === "home-markers" && info.object) {
      setHot((info.object as CaseIndexEntry).id);
      setHoverXY({ x: info.x, y: info.y });
    } else if (info.layer?.id === "home-markers" || !info.object) {
      setHoverXY(null);
    }
  };

  const W = vp?.width ?? 800;
  const H = vp?.height ?? 600;
  const attribution = basemapDef(basemap).attribution;

  return (
    <div className="home">
      <aside className="home-list" aria-label="Cases">
        <div className="home-intro">
          <PageHeader icon={<MapIcon size={22} strokeWidth={1.8} />} title="Cases" description="Pick a slick to investigate. Hover a case to find it on the map." />
          {index.data && (
            <div className="stat-grid stat-grid-3">
              <StatCard value={counts.total} label="Cases" tone="accent" />
              <StatCard value={counts.waiting} label="Awaiting oil check" tone={counts.waiting ? "warn" : undefined} />
              <StatCard value={counts.checked} label="Oil check done" tone="teal" />
            </div>
          )}
          <Tabs<Region>
            label="Region"
            value={region}
            onChange={setRegion}
            options={[
              { value: "india", label: REGION_LABEL.india, badge: counts.india || undefined },
              { value: "gulf_of_mexico", label: REGION_LABEL.gulf_of_mexico, badge: counts.gulf_of_mexico || undefined },
            ]}
          />
        </div>
        <div className="home-cases" role="list">
          {index.error && <div style={{ padding: 16 }}><ErrorNote error={index.error} /></div>}
          {index.loading && <div style={{ padding: 16 }}><Loading /></div>}
          {cases.map((c) => {
            const m = geos[c.id]?.meta.slick.measures;
            return (
              <Link
                key={c.id}
                to={`/app/case/${c.id}`}
                role="listitem"
                className={`case-row${hot === c.id ? " hot" : ""}`}
                data-v={c.verdict.code}
                onMouseEnter={() => setHot(c.id)}
                onMouseLeave={() => setHot((h) => (h === c.id ? null : h))}
                onFocus={() => setHot(c.id)}
              >
                <span className="case-top">
                  <span className="id num">{c.id}</span>
                  <VerdictChip code={c.verdict.code} />
                </span>
                <span className="place">{PLACE[c.id] ?? c.id}</span>
                <span className="meta">
                  {fmtUtc(c.t_image)}
                  {m ? `, ${m.length_km.toFixed(0)} km slick` : ""}
                  <ChevronRight size={16} className="case-go" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </aside>
      <section className="home-map" aria-label="Case map">
        <MapCanvas
          ref={mapRef}
          ariaLabel={`Map of ${REGION_LABEL[region]} with case locations`}
          layers={layers}
          fit={{ bounds: REGION_BOUNDS[region], key: `${region}:${fitN}`, padding: 32 }}
          onHover={onHover}
          onClick={(info) => {
            if (info.layer?.id === "home-markers" && info.object) navigate(`/app/case/${(info.object as CaseIndexEntry).id}`);
          }}
          onViewport={setVp}
        >
          {advanced && <ChartFrame vp={vp} bottomInset={30} />}
          <div className="map-tl"><BasemapSwitcher /></div>
          <div className="map-bl">
            <MapLegend
              groups={[
                {
                  title: "Verdict",
                  items: ([1, 2, 3, 4, 5] as VerdictCode[]).map((v) => ({
                    key: `v${v}`,
                    swatch: <svg width="20" height="14" aria-hidden="true"><circle cx="10" cy="7" r="5.5" fill={`var(--v${v})`} stroke="var(--panel)" strokeWidth="1.5" /></svg>,
                    label: VERDICT_SHORT[v],
                  })),
                },
                {
                  title: "Map",
                  items: [
                    { key: "slick", swatch: <svg width="20" height="14" aria-hidden="true"><path d="M2 10c4-6 10-7 16-6-3 4-9 8-16 6z" fill="rgba(29,23,18,.5)" stroke="var(--past)" strokeWidth="1.5" /></svg>, label: "Slick outline" },
                    { key: "eez", swatch: <svg width="20" height="14" aria-hidden="true"><path d="M1 7H19" stroke="var(--ink-2)" strokeDasharray="4 2" /></svg>, label: "EEZ boundary" },
                  ],
                },
              ]}
            />
          </div>
          <div className="map-br">
            <MapControls
              onZoomIn={() => mapRef.current?.zoomBy(1)}
              onZoomOut={() => mapRef.current?.zoomBy(-1)}
              onFit={() => setFitN((n) => n + 1)}
              fitLabel={`Show all of ${REGION_LABEL[region]}`}
            />
          </div>
          <div className="map-statusbar">
            <span>{REGION_LABEL[region]}: {cases.length} cases. Click a case to open it.</span>
            {advanced && <span className="status-zoom num">z {vp ? vp.zoom.toFixed(1) : "–"}</span>}
            {attribution && <span className="attribution">{attribution}</span>}
          </div>
          {hotCase && hoverXY && (
            <div className="hover-card" style={{ left: Math.max(8, Math.min(hoverXY.x + 16, W - 250)), top: Math.max(8, Math.min(hoverXY.y - 170, H - 250)) }}>
              {hotCase.entry.has_sar_image ? (
                <img src={dataUrl(`${hotCase.entry.path}sar_quicklook.png`)} alt="" />
              ) : (
                <div style={{ height: 60, display: "grid", placeItems: "center" }} className="muted">
                  No satellite image
                </div>
              )}
              <div className="body">
                <b className="num">{hotCase.entry.id}</b>
                <span className="place" style={{ fontSize: 17 }}>{PLACE[hotCase.entry.id]}</span>
                <VerdictChip code={hotCase.entry.verdict.code} />
              </div>
            </div>
          )}
        </MapCanvas>
      </section>
    </div>
  );
}
