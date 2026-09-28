import type { PickingInfo, WebMercatorViewport } from "@deck.gl/core";
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { ChevronRight, Map as MapIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorNote, Loading, PageHeader, ProvenanceBadges, StatCard, Tabs, VerdictChip } from "../components/ui";
import { dataUrl, fetchJson, useCasesIndex, useShared } from "../data/load";
import { PLACE, REGION_LABEL } from "../data/places";
import type { CaseIndexEntry, FeatureCollection, Meta, PolygonGeometry } from "../data/types";
import { PALETTES, rgba } from "../design/palette";
import BasemapSwitcher from "../map/BasemapSwitcher";
import ChartFrame, { graticuleLines } from "../map/ChartFrame";
import { basemapDef, basemapLayers, FONT_SANS } from "../map/layers/basemap";
import MapLegend from "../map/MapLegend";
import { MapCanvas } from "../map/MapCanvas";
import { fmtUtc } from "../lib/time";
import { useMapPrefs } from "../store/mapPrefs";
import { useTheme } from "../store/theme";

type Region = "india" | "gulf_of_mexico";
const REGION_BOUNDS: Record<Region, [number, number, number, number]> = {
  india: [66, 6.5, 85, 22.5],
  gulf_of_mexico: [-98, 23, -86, 31],
};

interface CaseGeo {
  entry: CaseIndexEntry;
  slick: FeatureCollection<PolygonGeometry>;
  meta: Meta;
}

export default function Home() {
  const index = useCasesIndex();
  const [region, setRegion] = useState<Region>("india");
  const [hot, setHot] = useState<string | null>(null);
  const [hoverXY, setHoverXY] = useState<{ x: number; y: number } | null>(null);
  const [geos, setGeos] = useState<Record<string, CaseGeo>>({});
  const [vp, setVp] = useState<WebMercatorViewport | null>(null);
  const theme = useTheme((s) => s.theme);
  const P = PALETTES[theme];
  const shared = useShared(region);
  const basemap = useMapPrefs((s) => s.basemap);
  const navigate = useNavigate();

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
      fullyReal: all.filter((c) => c.labels.some((l) => l.startsWith("REAL AIS"))).length,
      realIndian: all.filter((c) => c.region === "india" && c.has_sar_image).length,
      synthetic: all.filter((c) => !c.has_sar_image).length,
      total: all.length,
    };
  }, [index.data]);

  const markerPos = (c: CaseIndexEntry): [number, number] => geos[c.id]?.meta.slick.measures.centroid ?? c.centroid;

  const base = basemapLayers({
    land: shared.land,
    eez: shared.eez,
    graticule: graticuleLines(vp),
    palette: P,
    show: { eez: true, graticule: true },
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
      getRadius: (c) => (c.id === hot ? 13 : 9),
      radiusUnits: "pixels",
      stroked: true,
      filled: true,
      getFillColor: (c) => (c.id === hot ? rgba(P.accent, 0.3) : rgba(P.sea, 0.35)),
      getLineColor: rgba(P.accent),
      lineWidthUnits: "pixels",
      getLineWidth: (c) => (c.id === hot ? 2.5 : 1.75),
      pickable: true,
      updateTriggers: { getRadius: hot, getFillColor: [hot, theme], getLineWidth: hot, getLineColor: theme, getPosition: Object.keys(geos).length },
      transitions: { getRadius: 150 },
    }),
    new TextLayer<CaseIndexEntry>({
      id: "home-labels",
      data: cases,
      getPosition: markerPos,
      getText: (c) => c.id,
      getSize: 12,
      getColor: rgba(P.ink),
      fontFamily: FONT_SANS,
      fontWeight: 600,
      getPixelOffset: [14, 0],
      getTextAnchor: "start",
      getAlignmentBaseline: "center",
      outlineWidth: 3,
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

  return (
    <div className="home">
      <aside className="home-list" aria-label="Cases">
        <div className="home-intro">
          <PageHeader icon={<MapIcon size={22} strokeWidth={1.8} />} title="Cases" description="Pick a slick to investigate. Hover a case to find it on the map." />
          {index.data && (
            <div className="stat-grid stat-grid-4">
              <StatCard value={counts.total} label="Cases" tone="accent" />
              <StatCard value={counts.fullyReal} label="Fully real" sub="Gulf of Mexico" tone="teal" />
              <StatCard value={counts.realIndian} label="Real slick" sub="Synthetic ships" />
              <StatCard value={counts.synthetic} label="Synthetic" sub="Simulated scenario" />
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
                <span className="place">{PLACE[c.id] ?? c.note}</span>
                <span className="meta">
                  {fmtUtc(c.t_image)}
                  {m ? ` · ${m.length_km.toFixed(0)} km slick` : ""}
                </span>
                <span className="badges">
                  <ProvenanceBadges labels={c.labels} />
                  <ChevronRight size={16} className="case-go" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </aside>
      <section className="home-map" aria-label="Case map">
        <MapCanvas
          ariaLabel={`Map of ${REGION_LABEL[region]} with case locations`}
          layers={layers}
          fit={{ bounds: REGION_BOUNDS[region], key: region, padding: 24 }}
          onHover={onHover}
          onClick={(info) => {
            if (info.layer?.id === "home-markers" && info.object) navigate(`/app/case/${(info.object as CaseIndexEntry).id}`);
          }}
          onViewport={setVp}
        >
          <ChartFrame vp={vp} bottomInset={30} />
          <div className="map-tl"><BasemapSwitcher /></div>
          <div className="map-bl">
            <MapLegend
              groups={[{
                title: "Map",
                items: [
                  { key: "case", swatch: <svg width="20" height="14" aria-hidden="true"><circle cx="10" cy="7" r="5" fill="none" stroke="var(--accent)" strokeWidth="1.8" /></svg>, label: "Case (click to open)" },
                  { key: "slick", swatch: <svg width="20" height="14" aria-hidden="true"><path d="M2 10c4-6 10-7 16-6-3 4-9 8-16 6z" fill="rgba(29,23,18,.5)" stroke="var(--past)" strokeWidth="1.5" /></svg>, label: "Slick outline" },
                  { key: "eez", swatch: <svg width="20" height="14" aria-hidden="true"><path d="M1 7H19" stroke="var(--ink-2)" strokeDasharray="4 2" /></svg>, label: "EEZ boundary" },
                ],
              }]}
            />
          </div>
          <div className="map-statusbar">
            <span>{REGION_LABEL[region]}: {cases.length} cases</span>
            <span className="status-zoom num">z {vp ? vp.zoom.toFixed(1) : "–"}</span>
            {basemapDef(basemap).attribution && <span className="attribution">{basemapDef(basemap).attribution}</span>}
          </div>
          {hotCase && hoverXY && (
            <div className="hover-card" style={{ left: Math.min(hoverXY.x + 16, (vp?.width ?? 800) - 250), top: Math.max(8, hoverXY.y - 170) }}>
              {hotCase.entry.has_sar_image ? (
                <img src={dataUrl(`${hotCase.entry.path}sar_quicklook.png`)} alt="" />
              ) : (
                <div style={{ height: 60, display: "grid", placeItems: "center" }} className="muted">
                  Simulated slick, no satellite image
                </div>
              )}
              <div className="body">
                <b>{hotCase.entry.id}</b>
                <span className="place" style={{ fontSize: 16 }}>{PLACE[hotCase.entry.id]}</span>
                <VerdictChip code={hotCase.entry.verdict.code} />
              </div>
            </div>
          )}
        </MapCanvas>
      </section>
    </div>
  );
}
