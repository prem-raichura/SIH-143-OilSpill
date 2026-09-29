import type { ReactNode } from "react";

/** Hover card that follows the pointer and flips left or up near the map edges so it is never cut off. */
export default function MapTooltip({ x, y, width, height, className = "map-tooltip", children }: {
  x: number;
  y: number;
  /** Size of the map box the tooltip lives in. */
  width: number;
  height: number;
  className?: string;
  children: ReactNode;
}) {
  const flipX = x > width - 300;
  const flipY = y > height - 170;
  return (
    <div
      className={className}
      style={{
        left: x,
        top: y,
        transform: `translate(${flipX ? "calc(-100% - 12px)" : "12px"}, ${flipY ? "calc(-100% - 12px)" : "12px"})`,
      }}
    >
      {children}
    </div>
  );
}
