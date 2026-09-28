import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Funnel } from "../../charts/charts";
import { Band, Meter, Section } from "../../components/ui";
import { HULL_LABEL, hullKind, ROLE_LABEL, ROLE_ORDER, type Role, type Vessel } from "../../lib/vessels";
import { useWorkspace } from "../../store/workspace";
import { PanelHead } from "../StepPanel";
import { useCase } from "../useCase";
import { HullGlyph } from "../../components/HullGlyph";

const CHIP: Record<Role, string> = { leading: "Leading", shortlist: "Shortlist", screened: "Screened", eliminated: "Eliminated", background: "Background" };

export default function ShipsStep() {
  const c = useCase();
  const ws = useWorkspace();
  const [q, setQ] = useState("");
  const [roles, setRoles] = useState<Set<Role>>(new Set(["leading", "shortlist", "screened", "eliminated"]));
  const counts = c.bundle.ledger.counts;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return c.vessels.filter(
      (v) => roles.has(v.role) && (!s || v.name.toLowerCase().includes(s) || String(v.mmsi).includes(s)),
    );
  }, [c.vessels, roles, q]);
  const toggleRole = (r: Role) =>
    setRoles((prev) => {
      const n = new Set(prev);
      if (n.has(r)) n.delete(r);
      else n.add(r);
      return n;
    });
  const byRole = ROLE_ORDER.map((r) => [r, list.filter((v) => v.role === r)] as const).filter(([, vs]) => vs.length);
  const open = (v: Vessel) => {
    ws.select(v.mmsi);
    ws.setStep("evidence");
    ws.toggleLayer("driftCorrected", true);
  };
  return (
    <>
      <PanelHead title="Ships">
        Every AIS ship near the release corridor in the search window. Only one rule removes a ship: it could not physically reach the
        corridor. Everything else is evidence for or against.
      </PanelHead>
      <Section title="From traffic to candidates">
        <Funnel
          rows={[
            { label: "In the search window", value: counts.vessels_in_window },
            { label: "Eliminated (could not reach)", value: counts.eliminated },
            { label: "Screened with drift", value: counts.screened },
            { label: "Confirmed with forward drift", value: counts.confirmed },
            { label: "Radar-only ships", value: counts.sar_only_targets },
          ]}
        />
        <p className="note">
          AIS coverage near the corridor: {c.bundle.ledger.ais_coverage.score.toFixed(2)} (needs {c.bundle.ledger.ais_coverage.threshold}).
          Ships outside the search window are out of scope. That is not evidence of innocence.
        </p>
      </Section>
      <Section title="Map options">
        <label className="check-row">
          <span /> <span>Only the shortlist</span>
          <input type="checkbox" checked={ws.onlyShortlist} onChange={(e) => ws.set({ onlyShortlist: e.target.checked })} />
        </label>
        <label className="check-row">
          <span /> <span>Colour routes by speed (slow = light)</span>
          <input type="checkbox" checked={ws.colorBySpeed} onChange={(e) => ws.set({ colorBySpeed: e.target.checked })} />
        </label>
      </Section>
      <Section title={`Ships (${list.length})`}>
        <div className="chip-row" role="group" aria-label="Filter by role">
          {(["leading", "shortlist", "screened", "eliminated", "background"] as Role[]).map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={roles.has(r)} onClick={() => toggleRole(r)}>
              <i className={`role-dot role-${r}`} /> {CHIP[r]}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={14} />
          <input className="input" placeholder="Name or MMSI" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {byRole.map(([role, vs]) => (
          <div key={role}>
            <h4 className="t-label" style={{ margin: "10px 0 4px" }}>{ROLE_LABEL[role]}</h4>
            <div className="list" role="listbox" aria-label={ROLE_LABEL[role]}>
              {vs.slice(0, role === "background" ? 40 : 60).map((v) => (
                <button
                  key={v.mmsi}
                  type="button"
                  role="option"
                  aria-selected={ws.selectedMmsi === v.mmsi}
                  className={`list-row${ws.hoverMmsi === v.mmsi ? " hot" : ""}`}
                  onMouseEnter={() => ws.hover(v.mmsi)}
                  onMouseLeave={() => ws.hover(null)}
                  onClick={() => open(v)}
                >
                  <HullGlyph kind={hullKind(v.vesselType)} role={v.role} />
                  <span className="name">{v.name}</span>
                  <span>{v.candidate ? <Band band={v.candidate.band} /> : null}</span>
                  <span className="sub">
                    MMSI {v.mmsi}, {HULL_LABEL[hullKind(v.vesselType)].toLowerCase()}
                    {v.candidate && (
                      <>
                        , score {v.candidate.score.toFixed(2)}, first in {Math.round(v.candidate.rank1_share * 100)} % of runs{" "}
                        <Meter value={v.candidate.rank1_share} label="Rank-first share" />
                      </>
                    )}
                    {v.whyNot && v.role !== "leading" && <span style={{ display: "block", marginTop: 2 }}>{v.whyNot.replace(/^x /, "")}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}
