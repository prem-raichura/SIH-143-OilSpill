import * as Dialog from "@radix-ui/react-dialog";
import { ClipboardList, Download, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useSession } from "../auth/session";
import { PageHeader, Tabs } from "../components/ui";
import { fmtUtc } from "../lib/time";
import { exportJson, useReview } from "../store/review";

type Src = "all" | "case" | "test_set";

export default function ReviewLog() {
  const { feedback, gate, reviews, sightings, importAll, clearAll } = useReview();
  const role = useSession((s) => s.session?.role);
  const [src, setSrc] = useState<Src>("all");
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = feedback.filter((f) => src === "all" || f.source === src).slice().reverse();
  const canManage = role === "supervisor";

  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `review-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const onImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.feedback)) throw new Error("no feedback array");
      importAll({ gate: data.gate ?? {}, reviews: data.reviews ?? {}, feedback: data.feedback, sightings: data.sightings ?? [], observations: data.observations ?? [], reviewerRole: data.reviewerRole ?? "analyst", blindMode: Boolean(data.blindMode) });
      setMsg(`Imported ${data.feedback.length} records.`);
    } catch (e) {
      setMsg(`Couldn't import that file: ${(e as Error).message}. Use a file exported from this page.`);
    }
  };

  return (
    <div className="page-pad reading">
      <PageHeader icon={<ClipboardList size={22} strokeWidth={1.8} />} title="Review log" />
      <p className="muted" style={{ maxWidth: "70ch" }}>
        Every oil check and detection-test answer, in the feedback format of the spec (section 12). These records feed a curated dataset for
        periodic, offline retraining. Nothing retrains automatically, and test-set scenes never enter training. Stored in this browser only.
      </p>
      <div className="bench-controls">
        <Tabs<Src> label="Source" variant="pill" value={src} onChange={setSrc} options={[{ value: "all", label: "All", badge: feedback.length }, { value: "case", label: "Oil checks" }, { value: "test_set", label: "Detection test" }]} />
        <button type="button" className="btn btn-secondary" onClick={download} disabled={!feedback.length}><Download size={14} /> Export JSON</button>
        {canManage && <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import JSON</button>}
        {canManage && <button type="button" className="btn btn-quiet" onClick={() => setConfirm(true)} disabled={!feedback.length}><Trash2 size={14} /> Clear log</button>}
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
      </div>
      {msg && <p className="note note-strong">{msg}</p>}
      <p className="t-label">
        {Object.keys(gate).length} oil checks, {Object.keys(reviews).length} case reviews, {sightings.length} new sightings recorded.
        {!canManage && " Import and clear are for supervisors."}
      </p>
      {rows.length === 0 ? (
        <div className="empty">
          <b>No reviews yet.</b>
          <span>Answer an oil check in any case, or judge tiles in the detection test.</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th><th>When</th><th>Source</th><th>Incident / image</th><th>Model said</th><th>Human label</th><th>Reason</th><th>Role</th><th>Saw AI mask</th><th>Blind</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.feedback_id}>
                  <td className="num">{f.feedback_id}</td>
                  <td className="num">{fmtUtc(f.timestamp)}</td>
                  <td>{f.source === "case" ? "Oil check" : "Detection test"}</td>
                  <td className="num" style={{ maxWidth: 260, wordBreak: "break-all" }}>{f.incident_id ?? ""} {f.image_id}</td>
                  <td>{f.ai_prediction}{f.ai_confidence != null ? ` (${Math.round(f.ai_confidence * 100)} %)` : ""}{f.test_set_label ? `, label ${f.test_set_label}` : ""}</td>
                  <td><b>{f.human_label}</b></td>
                  <td>{f.reason}{f.notes ? `. ${f.notes}` : ""}</td>
                  <td>{f.reviewer_role}</td>
                  <td>{f.reviewer_saw_ai_mask ? "yes" : "no"}</td>
                  <td>{f.blind_review ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog" style={{ padding: 20, width: 420 }} aria-describedby={undefined}>
            <Dialog.Title className="t-panel">Clear the review log?</Dialog.Title>
            <p className="muted" style={{ margin: "10px 0 16px" }}>This deletes every oil check, case review and record in this browser. Export first if you need them.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Dialog.Close className="btn btn-secondary">Keep the log</Dialog.Close>
              <button type="button" className="btn btn-primary" onClick={() => { clearAll(); setConfirm(false); setMsg("Review log cleared."); }}>Clear the log</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
