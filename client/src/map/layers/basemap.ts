import { BitmapLayer, GeoJsonLayer, PathLayer, TextLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import type { LandFC } from "../../data/load";
import { WATER_LABELS } from "../../data/places";
import type { Palette } from "../../design/palette";
import { rgba } from "../../design/palette";

export const FONT_SANS = '"Archivo Variable", Archivo, system-ui, sans-serif';
export const FONT_SERIF = '"Source Serif 4", Georgia, serif';
const dash = new PathStyleExtension({ dash: true });

export function basemapLayers(opts: {
  land?: LandFC;
  eez?: LandFC;
  graticule: [number, number][][];
  palette: Palette;
  show: { eez: boolean; graticule: boolean };
  region: "india" | "gulf_of_mexico" | null;
  zoom: number;
  theme: string;
  online?: boolean;
}) {
  const { palette: P } = opts;
  return [
    opts.online &&
      new TileLayer({
        id: "online-basemap",
        // Esri World Ocean Base: bathymetry and coastlines. Attribution is shown on the map when this is on.
        data: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
        minZoom: 0,
        maxZoom: 13,
        tileSize: 256,
        // Decode tiles ourselves: the default loader returned empty content for these JPEG tiles.
        getTileData: async ({ url, signal }: { url?: string | null; signal?: AbortSignal }) => {
          if (!url) return null;
          const r = await fetch(url, { signal, mode: "cors" });
          if (!r.ok) return null;
          return createImageBitmap(await r.blob());
        },
        opacity: opts.theme === "night" ? 0.55 : 0.9,
        renderSubLayers: (props) => {
          const { boundingBox } = props.tile;
          return new BitmapLayer(props, {
            data: null as never,
            image: props.data,
            bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
          });
        },
        updateTriggers: { opacity: opts.theme },
      }),
    opts.show.graticule &&
      new PathLayer({
        id: "graticule",
        data: opts.graticule,
        getPath: (d: [number, number][]) => d,
        getColor: rgba(P.grid, 1),
        widthUnits: "pixels",
        getWidth: 1,
        updateTriggers: { getColor: opts.theme },
      }),
    opts.land &&
      new GeoJsonLayer({
        id: "land",
        data: opts.land as never,
        filled: !opts.online,
        stroked: true,
        getFillColor: rgba(P.land),
        getLineColor: rgba(P.coast),
        lineWidthUnits: "pixels",
        getLineWidth: 1,
        updateTriggers: { getFillColor: opts.theme, getLineColor: opts.theme },
      }),
    opts.show.eez &&
      opts.eez &&
      new GeoJsonLayer({
        id: "eez",
        data: opts.eez as never,
        filled: false,
        stroked: true,
        getLineColor: rgba(P.ink2, 0.45),
        lineWidthUnits: "pixels",
        getLineWidth: 1,
        getDashArray: [6, 4],
        dashJustified: true,
        extensions: [dash],
        updateTriggers: { getLineColor: opts.theme },
      } as never),
    opts.region &&
      new TextLayer({
        id: "water-labels",
        data: WATER_LABELS.filter((w) => w.region === opts.region && opts.zoom >= w.minZoom - 0.5),
        getPosition: (d) => d.at,
        getText: (d) => d.name,
        getSize: 15,
        getColor: rgba(P.ink2, 0.8),
        fontFamily: FONT_SERIF,
        fontWeight: "italic 400" as never,
        characterSet: "auto",
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        updateTriggers: { getColor: opts.theme },
      }),
  ];
}
