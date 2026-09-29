import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, HelpCircle, ScanSearch, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorNote, Loading, PageHeader, Tabs } from "../components/ui";
import { dataUrl, useGallery } from "../data/load";
import type { GalleryItem } from "../data/types";
import { useReview, type HumanLabel } from "../store/review";

type Filter = "all" | "oil" | "lookalike" | "clean";
const CLASS_TEXT: Record<GalleryItem["class"], string> = { oil: "Oil", lookalike: "Look-alike", clean: "Clean sea" };
type Answer = "oil" | "lookalike" | "unsure";
const ANSWER_TEXT: Record<Answer, string> = { oil: "Oil", lookalike: "Look-alike or clean", unsure: "Not sure" };

function agrees(a: Answer, c: GalleryItem["class"]) {
  if (a === "unsure") return null;
  return a === "oil" ? c === "oil" : c !== "oil";
}

export default function DetectionTest() {
  const { data, error, loading } = useGallery();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const [showMask, setShowMask] = useState(true);
  const feedback = useReview((s) => s.feedback);
  const blindMode = useReview((s) => s.blindMode);
  const setBlindMode = useReview((s) => s.setBlindMode);
  const answers = useMemo(() => {
    const m = new Map<string, Answer>();
    for (const f of feedback) if (f.source === "test_set") m.set(f.image_id, f.human_label === "CONFIRMED_OIL" ? "oil" : f.human_label === "UNCERTAIN" ? "unsure" : "lookalike");
    return m;
  }, [feedback]);

  if (error) return <div className="page-pad"><ErrorNote error={error} /></div>;
  if (loading || !data) return <div className="page-pad"><Loading /></div>;
  const items = data.items.filter((i) => filter === "all" || i.class === filter);
  const answered = data.items.filter((i) => answers.has(i.id));
  const agreed = answered.filter((i) => agrees(answers.get(i.id)!, i.class) === true).length;
  const decided = answered.filter((i) => agrees(answers.get(i.id)!, i.class) !== null).length;

  return (
    <div className="page-pad reading">
      <PageHeader icon={<ScanSearch size={22} strokeWidth={1.8} />} title="Detection test" />
      <p className="muted" style={{ maxWidth: "68ch" }}>
        {data.items.length} labelled tiles from a public SAR oil-spill test set ({data.source.split(",")[0]}): 12 with oil, 12 look-alikes and 12 clean sea.
        Judge each tile yourself, then compare with the dataset label. Every answer goes to the review log.
      </p>
      <div className="bench-controls">
        <Tabs<Filter> label="Class" variant="pill" value={filter} onChange={setFilter} options={[
          { value: "all", label: "All" }, { value: "oil", label: "Oil" }, { value: "lookalike", label: "Look-alike" }, { value: "clean", label: "Clean" },
        ]} />
        <label className="check-row"><span /><span>Show dataset masks</span><input type="checkbox" checked={showMask} onChange={(e) => setShowMask(e.target.checked)} /></label>
        <label className="check-row"><span /><span>Blind review (hide mask and label until you answer)</span><input type="checkbox" checked={blindMode} onChange={(e) => setBlindMode(e.target.checked)} /></label>
        {decided > 0 && <span className="chip">You agreed with the label on {agreed} of {decided}</span>}
      </div>
      <div className="gallery">
        {items.map((it) => {
          const a = answers.get(it.id);
          const hide = blindMode && !a;
          return (
            <button key={it.id} type="button" className="tile" onClick={() => setOpen(it)} aria-label={`Open tile ${it.id}`}>
              <img src={dataUrl(`shared/gallery/${it.image}`)} alt="" loading="lazy" />
              {showMask && !hide && it.class !== "clean" && <img className="tile-mask" src={dataUrl(`shared/gallery/${it.mask}`)} alt="" loading="lazy" />}
              <span className="tile-cap">
                {hide ? "Not reviewed" : CLASS_TEXT[it.class]}
                {a && <b>{ANSWER_TEXT[a]}</b>}
              </span>
            </button>
          );
        })}
      </div>
      {open && <ReviewDialog item={open} onClose={() => setOpen(null)} blind={blindMode} previous={answers.get(open.id)} />}
    </div>
  );
}

function ReviewDialog({ item, onClose, blind, previous }: { item: GalleryItem; onClose: () => void; blind: boolean; previous?: Answer }) {
  const addFeedback = useReview((s) => s.addFeedback);
  const [answer, setAnswer] = useState<Answer | null>(previous ?? null);
  const reveal = !blind || answer !== null;
  const submit = (a: Answer) => {
    setAnswer(a);
    const label: HumanLabel = a === "oil" ? "CONFIRMED_OIL" : a === "unsure" ? "UNCERTAIN" : item.class === "clean" ? "FALSE_POSITIVE" : "LOOKALIKE";
    addFeedback({
      incident_id: null,
      image_id: item.id,
      ai_prediction: item.class === "oil" ? "oil" : item.class,
      ai_confidence: null,
      human_label: label,
      corrected_mask: null,
      reason: "detection test",
      notes: "",
      reviewer_saw_ai_mask: !blind,
      blind_review: blind,
      source: "test_set",
      test_set_label: item.class,
    });
  };
  const ok = answer ? agrees(answer, item.class) : null;
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog review-dialog" aria-describedby={undefined}>
          <div className="review-img">
            <img src={dataUrl(`shared/gallery/${item.image}`)} alt={`Sentinel-1 tile ${item.id}`} />
            {reveal && item.class !== "clean" && <img className="tile-mask" src={dataUrl(`shared/gallery/${item.mask}`)} alt="" />}
          </div>
          <div className="review-side">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Dialog.Title className="t-panel">Tile {item.id.replace(/^\w+_/, "")}</Dialog.Title>
              <Dialog.Close className="icon-btn" aria-label="Close"><X size={16} /></Dialog.Close>
            </div>
            <p className="muted">Sentinel-1 VV sigma0, stretched {item.stretch_db[0]} to {item.stretch_db[1]} dB.</p>
            <p><b>Is there oil on this tile?</b></p>
            <div className="oil-actions">
              <button type="button" className="btn btn-lg btn-primary" onClick={() => submit("oil")} style={{ justifyContent: "flex-start" }}><CheckCircle2 size={17} /> Oil</button>
              <button type="button" className="btn btn-lg btn-secondary" onClick={() => submit("lookalike")} style={{ justifyContent: "flex-start" }}><XCircle size={17} /> Look-alike or clean sea</button>
              <button type="button" className="btn btn-lg btn-secondary" onClick={() => submit("unsure")} style={{ justifyContent: "flex-start" }}><HelpCircle size={17} /> Not sure</button>
            </div>
            {answer && (
              <div className="verdict-box">
                <span className="t-label">Dataset label</span>
                <b>{CLASS_TEXT[item.class]}{item.class === "oil" ? `, ${Math.round(item.oil_fraction * 100)} % of the tile` : ""}</b>
                <span>{ok === null ? "Marked not sure. Uncertain answers are never used as training targets." : ok ? "You agree with the label." : "You disagree with the label. Disagreements go to a second reviewer."}</span>
              </div>
            )}
            <p className="note">{blind ? "Blind review: the red dataset mask appears after your answer." : "The dataset mask is shown in red."}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
