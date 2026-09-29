import { Ship } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageSkeleton } from "../components/loaders";
import { ErrorNote, PageHeader, Tabs } from "../components/ui";
import { fetchJson, useCasesIndex } from "../data/load";
import { PLACE, REGION_LABEL, type Region } from "../data/places";
import type { Ledger, Monitoring, TrackFeature, FeatureCollection } from "../data/types";
import { buildVessels, type Role } from "../lib/vessels";
import { canSeeShips, useSession } from "../auth/session";

interface Row {
  key: string;
  name: string;
  mmsi: number;
  region: Region;
  checked: { caseId: string; role: Role }[];
}

export default function Vessels() {
  const index = useCasesIndex();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<Region>("india");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!index.data) return;
    let live = true;
    Promise.all(
      index.data.cases.map(async (c) => {
        const [ledger, mon, tracks] = await Promise.all([
          fetchJson<Ledger>(`${c.path}ledger.json`),
          fetchJson<Monitoring>(`${c.path}monitoring.json`),
          fetchJson<FeatureCollection>(`${c.path}ais_tracks.geojson`),
        ]);
        return { c, vs: buildVessels(ledger, tracks.features as unknown as TrackFeature[], mon) };
      }),
    ).then((all) => {
      if (!live) return;
      const m = new Map<string, Row>();
      for (const { c, vs } of all) {
        for (const v of vs) {
          if (v.role === "background") continue; // out of scope or unscored: not counted as an investigation
          const key = `${v.mmsi}`;
          const r = m.get(key) ?? { key, name: v.name, mmsi: v.mmsi, region: c.region, checked: [] };
          r.checked.push({ caseId: c.id, role: v.role });
          m.set(key, r);
        }
      }
      setRows([...m.values()].sort((a, b) => b.checked.length - a.checked.length || a.name.localeCompare(b.name)));
    });
    return () => {
      live = false;
    };
  }, [index.data]);

  const role = useSession((s) => s.session?.role);
  const list = useMemo(() => (rows ?? []).filter((r) => r.region === tab), [rows, tab]);
  if (!canSeeShips(role)) return <div className="page-pad">Vessel history is for investigators and supervisors. Analysts review oil only, so reviews stay free of ship bias.</div>;
  if (index.error) return <div className="page-pad"><ErrorNote error={index.error} /></div>;
  if (!rows) return <PageSkeleton variant="table" />;
  const count = (r: Row, role: Role) => r.checked.filter((x) => x.role === role).length;

  return (
    <div className="page-pad reading">
      <PageHeader icon={<Ship size={22} strokeWidth={1.8} />} title="Vessel history" description="Ships checked across all investigations, and how each check ended." />
      <p className="note note-strong" style={{ maxWidth: "70ch" }}>
        Historical association does not affect current attribution. Counts are always shown against the number of investigations a ship was
        checked in; busy ships appear more often simply because they are nearby more often. No risk score is calculated.
      </p>
      <div className="bench-controls">
        <Tabs<Region> label="Region" variant="pill" value={tab} onChange={setTab} options={[{ value: "india", label: REGION_LABEL.india }, { value: "gulf_of_mexico", label: REGION_LABEL.gulf_of_mexico }]} />
        <span className="t-label">Access is limited to authorised investigators.</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Ship</th><th>MMSI</th><th className="r">Checked in</th><th className="r">Leading</th><th className="r">Plausible</th><th className="r">Not supported</th><th className="r">Eliminated</th><th>Cases</th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.key} onClick={() => setOpen(open === r.key ? null : r.key)} style={{ cursor: "pointer" }}>
                <td><b>{r.name}</b></td>
                <td className="num">{r.mmsi}</td>
                <td className="r">{r.checked.length}</td>
                <td className="r">{count(r, "leading") ? `${count(r, "leading")} of ${r.checked.length}` : "0"}</td>
                <td className="r">{count(r, "shortlist")}</td>
                <td className="r">{count(r, "screened")}</td>
                <td className="r">{count(r, "eliminated")}</td>
                <td>
                  {r.checked.map((x) => (
                    <Link key={x.caseId} to={`/app/case/${x.caseId}?step=verdict`} className="chip" style={{ marginRight: 4, textDecoration: "none" }} title={PLACE[x.caseId]}>
                      {x.caseId}
                    </Link>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
