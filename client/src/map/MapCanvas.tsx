import type { Layer, MapViewState, PickingInfo } from "@deck.gl/core";
import { MapView, WebMercatorViewport } from "@deck.gl/core";
import DeckGL, { type DeckGLRef } from "@deck.gl/react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Bounds } from "../data/types";

export interface MapHandle {
  snapshot: () => string | null;
  zoomBy: (d: number) => void;
  resetNorth: () => void;
}

export interface MapCanvasProps {
  layers: (Layer | null | false | undefined)[];
  /** Bounds to fit whenever fitKey changes. */
  fit: { bounds: Bounds | null; key: string | number; padding?: number; maxZoom?: number };
  onHover?: (info: PickingInfo) => void;
  onClick?: (info: PickingInfo) => void;
  onViewport?: (vp: WebMercatorViewport) => void;
  pitch?: number;
  children?: ReactNode;
  cursor?: string;
  ariaLabel: string;
}

const MAP_VIEW = new MapView({ repeat: false });
const clampZoom = (z: number) => Math.max(1.5, Math.min(16, z));

export const MapCanvas = forwardRef<MapHandle, MapCanvasProps>(function MapCanvas(
  { layers, fit, onHover, onClick, onViewport, pitch = 0, children, cursor, ariaLabel },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const deckRef = useRef<DeckGLRef>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewState, setViewState] = useState<MapViewState>({ longitude: 75, latitude: 15, zoom: 4, pitch, bearing: 0 });
  const viewRef = useRef(viewState);
  viewRef.current = viewState;
  const anim = useRef(0);

  // Own tween instead of deck.gl transitions: the view state stays fully controlled here.
  const animateTo = useCallback((target: Partial<MapViewState>, ms: number) => {
    cancelAnimationFrame(anim.current);
    const from = { ...viewRef.current };
    if (ms <= 0 || document.visibilityState === "hidden" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setViewState({ ...from, ...target });
      return;
    }
    const t0 = performance.now();
    const keys = Object.keys(target) as (keyof MapViewState)[];
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const next: MapViewState = { ...viewRef.current };
      for (const k of keys) {
        const a = from[k] as number;
        const b = target[k] as number;
        (next as unknown as Record<string, number>)[k] = a + (b - a) * e;
      }
      setViewState(next);
      if (t < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, []);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width && r.height) setSize({ width: r.width, height: r.height });
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit to bounds when the fit key changes (and once the container has a size).
  const lastFit = useRef<string | null>(null);
  const interacted = useRef(false);
  const lastKey = useRef<string | number | null>(null);
  useEffect(() => {
    if (!fit.bounds || !size.width || !size.height) return;
    if (lastKey.current !== fit.key) interacted.current = false;
    // Refit on a new key, or on resize while the user has not moved the map yet.
    const sig = `${fit.key}|${interacted.current ? "user" : `${Math.round(size.width / 40)}x${Math.round(size.height / 40)}`}`;
    if (lastFit.current === sig) return;
    const first = lastFit.current === null;
    lastFit.current = sig;
    lastKey.current = fit.key;
    const [w, s, e, n] = fit.bounds;
    const pad = Math.min(fit.padding ?? 48, Math.floor(Math.min(size.width, size.height) / 4));
    const vp = new WebMercatorViewport({ width: size.width, height: size.height }).fitBounds(
      [[w, s], [e, n]],
      { padding: pad, maxZoom: fit.maxZoom ?? 11 },
    );
    animateTo({ longitude: vp.longitude, latitude: vp.latitude, zoom: clampZoom(vp.zoom) }, first ? 0 : 500);
  }, [fit.bounds, fit.key, fit.padding, fit.maxZoom, size.width, size.height]);

  const lastPitch = useRef(pitch);
  useEffect(() => {
    if (lastPitch.current === pitch) return; // no transition on mount: it would override the first fit
    lastPitch.current = pitch;
    animateTo({ pitch }, 400);
  }, [pitch]);

  useEffect(() => {
    if (!onViewport || !size.width) return;
    onViewport(new WebMercatorViewport({ ...viewState, width: size.width, height: size.height }));
  }, [viewState, size, onViewport]);

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __deck?: unknown }).__deck = deckRef.current?.deck;
    // Make the map itself focusable so arrow keys pan and +/- zoom (deck.gl keyboard controller).
    const host = deckRef.current?.deck?.getCanvas()?.parentElement;
    if (host && !host.getAttribute("aria-label")) {
      host.tabIndex = 0;
      host.setAttribute("aria-label", `${ariaLabel}. Arrow keys pan, plus and minus zoom.`);
    }
  });

  useImperativeHandle(ref, () => ({
    snapshot: () => {
      const deck = deckRef.current?.deck;
      if (!deck) return null;
      deck.redraw("snapshot");
      const canvas = deck.getCanvas();
      return canvas ? canvas.toDataURL("image/png") : null;
    },
    zoomBy: (d) => animateTo({ zoom: clampZoom(viewRef.current.zoom + d) }, 250),
    resetNorth: () => animateTo({ bearing: 0, pitch }, 300),
  }));

  const onViewStateChange = useCallback(({ viewState: vs, interactionState }: { viewState: MapViewState; interactionState?: Record<string, boolean> }) => {
    const user = Boolean(interactionState && Object.values(interactionState).some(Boolean));
    // deck.gl sometimes echoes an older view state right after mount; only user interaction may move the view.
    if (!user) return;
    interacted.current = true;
    cancelAnimationFrame(anim.current);
    setViewState({ ...vs, zoom: clampZoom(vs.zoom) });
  }, []);

  // Keyboard: arrows pan a fifth of the view (Shift: half), + and - zoom. Our own tween keeps the view state controlled.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, select, textarea, button")) return;
    const vs = viewRef.current;
    const k = e.shiftKey ? 0.5 : 0.2;
    const vp = new WebMercatorViewport({ ...vs, width: size.width, height: size.height });
    const cx = size.width / 2, cy = size.height / 2;
    const pan = (dx: number, dy: number) => {
      const [longitude, latitude] = vp.unproject([cx + dx * size.width * k, cy + dy * size.height * k]);
      animateTo({ longitude, latitude }, 220);
    };
    switch (e.key) {
      case "ArrowLeft": pan(-1, 0); break;
      case "ArrowRight": pan(1, 0); break;
      case "ArrowUp": pan(0, -1); break;
      case "ArrowDown": pan(0, 1); break;
      case "+": case "=": animateTo({ zoom: clampZoom(vs.zoom + 1) }, 220); break;
      case "-": case "_": animateTo({ zoom: clampZoom(vs.zoom - 1) }, 220); break;
      default: return;
    }
    interacted.current = true;
    e.preventDefault();
  };

  return (
    <div ref={wrap} className="map-wrap" style={{ position: "absolute", inset: 0 }} role="application" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {size.width > 0 && (
        <DeckGL
          ref={deckRef}
          views={MAP_VIEW}
          viewState={viewState}
          onViewStateChange={onViewStateChange as never}
          controller={{ doubleClickZoom: true, touchRotate: true, dragRotate: true, keyboard: false }}
          layers={layers.filter(Boolean) as Layer[]}
          onHover={onHover}
          onClick={onClick}
          getCursor={({ isDragging, isHovering }) => (isDragging ? "grabbing" : isHovering ? "pointer" : cursor ?? "grab")}
          useDevicePixels={Math.min(2, window.devicePixelRatio || 1)}
          pickingRadius={6}
          _typedArrayManagerProps={{ overAlloc: 1, poolSize: 0 }}
        />
      )}
      {children}
    </div>
  );
});
