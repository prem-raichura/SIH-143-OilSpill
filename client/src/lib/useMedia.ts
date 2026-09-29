import { useEffect, useState } from "react";

/** Phones and tablets: the case panel becomes a bottom sheet and lists stack under the maps. Keep in sync with the CSS breakpoint. */
export const NARROW = "(max-width: 1023px)";

/** Whether a CSS media query matches, updated when it changes. */
export function useMedia(query: string): boolean {
  const read = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(query).matches);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}
