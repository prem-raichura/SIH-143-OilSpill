// Times in the data are UTC. Some strings carry no "Z"; treat them as UTC too.
export function parseUtc(s: string): number {
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}

/** Hours from the image time to `iso` (negative = before the image). */
export function hoursFrom(tImage: string, iso: string): number {
  return (parseUtc(iso) - parseUtc(tImage)) / 3_600_000;
}

export function isoAt(tImage: string, hours: number): string {
  return new Date(parseUtc(tImage) + hours * 3_600_000).toISOString();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** "29 Mar 2025, 00:41 UTC" */
export function fmtUtc(msOrIso: number | string, withYear = true): string {
  const d = new Date(typeof msOrIso === "string" ? parseUtc(msOrIso) : msOrIso);
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
  return `${date}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "06:51 UTC" */
export function fmtClock(msOrIso: number | string): string {
  const d = new Date(typeof msOrIso === "string" ? parseUtc(msOrIso) : msOrIso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** Relative time to the image: "17 h 50 min before image", "at image time", "3 h after image". */
export function fmtRel(hours: number): string {
  const a = Math.abs(hours);
  if (a < 1 / 120) return "at image time";
  let h = Math.floor(a);
  let m = Math.round((a - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  const body = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
  return `${body} ${hours < 0 ? "before" : "after"} image`;
}

/** Signed short label for axes: "−12 h", "+24 h", "0 h". */
export function fmtSignedH(h: number): string {
  if (Math.abs(h) < 1e-9) return "0 h";
  return `${h < 0 ? "−" : "+"}${Math.abs(Math.round(h * 10) / 10)} h`;
}
