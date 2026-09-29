import { Copy } from "lucide-react";
import { useState } from "react";
import { KV, Section } from "../../components/ui";
import { PLACE } from "../../data/places";
import { fmtUtc } from "../../lib/time";
import { useWorkspace } from "../../store/workspace";
import { PanelHead } from "../StepPanel";
import { useCase } from "../useCase";

export default function ImageStep() {
  const c = useCase();
  const { meta, entry } = c.bundle;
  const sat = meta.satellite;
  const m = meta.slick.measures;
  const { sarOpacity, setSarOpacity, layers, toggleLayer } = useWorkspace();
  const [copied, setCopied] = useState(false);
  return (
    <>
      <PanelHead title="Satellite image">
        {sat
          ? "Sentinel-1 radar, VV polarisation, calibrated to sigma0 in dB. Oil calms the sea surface, so it shows up dark."
          : "No satellite image for this case; the steps start from the slick outline."}
      </PanelHead>
      <Section title={<span className="place" style={{ fontSize: 18 }}>{PLACE[entry.id]}</span>}>
        <p className="muted num" style={{ fontSize: 13 }}>Image time {fmtUtc(entry.t_image)}</p>
      </Section>
      {sat && (
        <Section title="Scene">
          <KV
            rows={[
              ["Acquired", fmtUtc(sat.acquisition_start)],
              ["Polarisation", sat.polarisation],
              ["Calibration", "sigma0 from the product LUT"],
              ["Bright points (CFAR)", `${sat.n_sar_targets}, not validated`],
            ]}
          />
          <div className="field">
            <span className="t-label">Sentinel-1 product</span>
            <button type="button" className="btn btn-secondary" style={{ justifyContent: "space-between", whiteSpace: "normal", textAlign: "left", height: "auto", padding: "6px 10px" }}
              onClick={() => navigator.clipboard?.writeText(sat.product_id).then(() => setCopied(true), () => undefined)}>
              <span className="num" style={{ fontSize: 11.5, wordBreak: "break-all" }}>{sat.product_id}</span>
              <Copy size={14} style={{ flex: "none" }} />
            </button>
            {copied && <span className="t-label">Copied</span>}
          </div>
          <div className="field">
            <span className="t-label">Backscatter (dB)</span>
            <div className="db-legend" aria-hidden="true" />
            <div className="num" style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>{sat.stretch_db[0].toFixed(1)} dB, calm or oil</span>
              <span>{sat.stretch_db[1].toFixed(1)} dB</span>
            </div>
          </div>
          <label className="field">
            <span className="t-label">Image opacity {Math.round(sarOpacity * 100)} %</span>
            <input type="range" min={0.1} max={1} step={0.05} value={sarOpacity} onChange={(e) => setSarOpacity(Number(e.target.value))} />
          </label>
          <label className="check-row">
            <span />
            <span>Show bright points (possible ships)</span>
            <input type="checkbox" checked={layers.targets} onChange={() => toggleLayer("targets")} />
          </label>
        </Section>
      )}
      <Section title="Detection">
        <KV
          rows={[
            ...(!m.simulated ? ([["Outline source", meta.slick.source]] as [string, string][]) : []),
            ...(m.cerulean_machine_confidence != null
              ? ([["Detector confidence", `${Math.round(m.cerulean_machine_confidence * 100)} % (Cerulean)`]] as [string, string][])
              : []),
            ["Area", `${m.area_km2.toFixed(1)} km²`],
            ["Length", `${m.length_km.toFixed(1)} km`],
          ]}
        />
        <p className="note">A person confirms the oil in the next step, before any ship data is shown.</p>
      </Section>
    </>
  );
}
