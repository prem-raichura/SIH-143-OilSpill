import { BitmapLayer, GeoJsonLayer, PathLayer, TextLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import type { Layer } from "@deck.gl/core";
import { PathStyleExtension } from "@deck.gl/extensions";
import type { LandFC } from "../../data/load";
import { WATER_LABELS } from "../../data/places";
import type { Palette } from "../../design/palette";
import { rgba } from "../../design/palette";
import type { BasemapId } from "../../store/mapPrefs";

export const FONT_SANS = '"Archivo Variable", Archivo, system-ui, sans-serif';
export const FONT_SERIF = '"Source Serif 4", Georgia, serif';
const dash = new PathStyleExtension({ dash: true });

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

export interface BasemapDef {
  id: BasemapId;
  label: string;
  hint: string;
  /** Tile URL template; null for the offline chart. */
  url: string | null;
  maxZoom: number;
  attribution: string | null;
  /** Colours for the small preview tile in the switcher: [sea, land]. */
  preview: [string, string];
}

export const BASEMAPS: BasemapDef[] = [
  { id: "chart", label: "Chart", hint: "Drawn from coastline data; works without internet", url: null, maxZoom: 16, attribution: null, preview: ["#D9E9F4", "#EFEBE0"] },
  {
    id: "ocean", label: "Ocean", hint: "Bathymetry and coastlines", url: `${ESRI}/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}`, maxZoom: 13,
    attribution: "Basemap: Esri, GEBCO, NOAA, National Geographic, Garmin, HERE and other contributors", preview: ["#9FC8E3", "#E6E0CC"],
  },
  {
    id: "satellite", label: "Satellite", hint: "Optical imagery", url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, maxZoom: 18,
    attribution: "Imagery: Esri, Maxar, Earthstar Geographics and the GIS user community", preview: ["#1B3A57", "#5B6B3A"],
  },
  {
    id: "light", label: "Light", hint: "Quiet grey reference map", url: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, maxZoom: 16,
    attribution: "Basemap: Esri, HERE, Garmin, © OpenStreetMap contributors and the GIS user community", preview: ["#D4DADC", "#F6F6F4"],
  },
  {
    id: "dark", label: "Dark", hint: "Dark grey reference map", url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, maxZoom: 16,
    attribution: "Basemap: Esri, HERE, Garmin, © OpenStreetMap contributors and the GIS user community", preview: ["#2E3134", "#4A4D50"],
  },
];

export const basemapDef = (id: BasemapId) => BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];

/**
 * Basemap layers, split so data can sit between them:
 * under = web tiles (drawn first, under the SAR image), over = graticule, land, EEZ and water names.
 */
export function basemapLayers(opts: {
  land?: LandFC;
  eez?: LandFC;
  graticule: [number, number][][];
  palette: Palette;
  show: { eez: boolean; graticule: boolean };
  region: "india" | "gulf_of_mexico" | null;
  zoom: number;
  theme: string;
  basemap: BasemapId;
}): { under: Layer[]; over: Layer[] } {
  const { palette: P } = opts;
  const def = basemapDef(opts.basemap);
  const tiles = def.url != null;
  const onDarkTiles = opts.basemap === "satellite" || opts.basemap === "dark";
  const under = [
    tiles &&
      new TileLayer({
        id: `basemap-${def.id}`,
        data: def.url!,
        minZoom: 0,
        maxZoom: def.maxZoom,
        tileSize: 256,
        // Decode tiles ourselves: the default loader returned empty content for these JPEG tiles.
        getTileData: async ({ url, signal }: { url?: string | null; signal?: AbortSignal }) => {
          if (!url) return null;
          const r = await fetch(url, { signal, mode: "cors" });
          if (!r.ok) return null;
          return createImageBitmap(await r.blob());
        },
        renderSubLayers: (props) => {
          const { boundingBox } = props.tile;
          return new BitmapLayer(props, {
            data: null as never,
            image: props.data,
            bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
          });
        },
      }),
  ].filter(Boolean) as Layer[];

  const over = [
    opts.show.graticule &&
      new PathLayer({
        id: "graticule",
        data: opts.graticule,
        getPath: (d: [number, number][]) => d,
        getColor: tiles ? rgba(onDarkTiles ? "#FFFFFF" : P.ink2, 0.22) : rgba(P.grid, 1),
        widthUnits: "pixels",
        getWidth: 1,
        updateTriggers: { getColor: [opts.theme, opts.basemap] },
      }),
    opts.land &&
      new GeoJsonLayer({
        id: "land",
        data: opts.land as never,
        // Web tiles bring their own land; keep only the coastline so it still shows if tiles fail to load (offline).
        filled: !tiles,
        stroked: true,
        getFillColor: rgba(P.land),
        getLineColor: tiles ? rgba(onDarkTiles ? "#FFFFFF" : P.coast, 0.5) : rgba(P.coast),
        lineWidthUnits: "pixels",
        getLineWidth: 1,
        updateTriggers: { getFillColor: opts.theme, getLineColor: [opts.theme, opts.basemap] },
      }),
    opts.show.eez &&
      opts.eez &&
      new GeoJsonLayer({
        id: "eez",
        data: opts.eez as never,
        filled: false,
        stroked: true,
        getLineColor: onDarkTiles ? rgba("#FFFFFF", 0.55) : rgba(P.ink2, 0.5),
        lineWidthUnits: "pixels",
        getLineWidth: 1,
        getDashArray: [6, 4],
        dashJustified: true,
        extensions: [dash],
        updateTriggers: { getLineColor: [opts.theme, opts.basemap] },
      } as never),
    opts.region &&
      new TextLayer({
        id: "water-labels",
        data: WATER_LABELS.filter((w) => w.region === opts.region && opts.zoom >= w.minZoom - 0.5),
        getPosition: (d) => d.at,
        getText: (d) => d.name,
        getSize: 15,
        getColor: onDarkTiles ? rgba("#FFFFFF", 0.85) : rgba(P.ink2, 0.8),
        fontFamily: FONT_SERIF,
        fontWeight: "italic 400" as never,
        characterSet: "auto",
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        updateTriggers: { getColor: [opts.theme, opts.basemap] },
      }),
  ].filter(Boolean) as Layer[];
  return { under, over };
}
