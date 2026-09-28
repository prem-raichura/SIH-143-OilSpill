// Human place names for case titles (serif italic in the UI, chart convention for water names).
export const PLACE: Record<string, string> = {
  "US-01": "Western Gulf of Mexico",
  "US-02": "Central Gulf, off Louisiana",
  "US-03": "Central Gulf of Mexico",
  "AS-01": "Mumbai approaches",
  "AS-02": "Off Goa",
  "AS-03": "Off Kochi",
  "AS-04": "South of Kerala",
  "IN-E1": "Off Kerala, near the MSC Elsa 3 wreck",
  "IN-S1": "Mumbai approach lanes",
  "IN-S2": "Arabian Sea main route",
  "IN-S3": "Off Chennai, Bay of Bengal",
  "IN-R1": "Arabian Sea, west of Ratnagiri",
};

export const REGION_LABEL = { india: "Indian waters", gulf_of_mexico: "Gulf of Mexico" } as const;

export const WATER_LABELS: { region: "india" | "gulf_of_mexico"; name: string; at: [number, number]; minZoom: number }[] = [
  { region: "india", name: "Arabian Sea", at: [66.5, 15.5], minZoom: 3 },
  { region: "india", name: "Laccadive Sea", at: [74.8, 8.2], minZoom: 5 },
  { region: "india", name: "Bay of Bengal", at: [86.5, 15.5], minZoom: 3 },
  { region: "india", name: "Gulf of Mannar", at: [79.0, 8.6], minZoom: 6 },
  { region: "india", name: "Gulf of Khambhat", at: [72.4, 21.4], minZoom: 6 },
  { region: "gulf_of_mexico", name: "Gulf of Mexico", at: [-90.5, 25.2], minZoom: 3 },
  { region: "gulf_of_mexico", name: "Bay of Campeche", at: [-94.2, 20.2], minZoom: 5 },
];

/** "REAL SLICK (Cerulean)" -> "Real slick (Cerulean)", and whether it is a real-data label. */
export function labelInfo(label: string): { text: string; real: boolean } {
  const text = label.charAt(0) + label.slice(1).replace(/[A-Z]{2,}/g, (w) => w.toLowerCase()).replace(/\bAis\b/i, "AIS");
  const clean = text.replace(/\bais\b/gi, "AIS");
  return { text: clean.charAt(0).toUpperCase() + clean.slice(1), real: /^REAL/i.test(label) };
}
