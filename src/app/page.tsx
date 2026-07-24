"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { RacePoster } from "@/components/poster/RacePoster";
import { posterStyles } from "@/components/poster/posterStyles";
import type { ExtractionResult, Race } from "@/types/race";

export default function Home() {
  const [races, setRaces] = useState<Race[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("Upload an IndiaRace PDF to begin.");
  const [uploadedFile, setUploadedFile] = useState("");
  const [step, setStep] = useState<"idle" | "uploaded" | "extracting" | "review" | "generating" | "done" | "error">("idle");
  const [errorTitle, setErrorTitle] = useState("Upload failed");
  const [busy, setBusy] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const race = races[active];
  const warnings = useMemo(() => races.flatMap((item) => item.warnings ?? []), [races]);

  useEffect(() => {
    if (step !== "generating") return;
    setGenerationSeconds(0);
    const timer = window.setInterval(() => setGenerationSeconds((seconds) => seconds + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [step]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadedFile(file.name);
    setStep("uploaded");
    setRaces([]);
    setActive(0);
    setStatus(`PDF uploaded: ${file.name}`);
    setBusy(true);
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    setStep("extracting");
    setStatus("Extracting native PDF text...");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/extract", { method: "POST", body: form });
      const text = await response.text();
      const result = text ? (JSON.parse(text) as ExtractionResult & { error?: string }) : null;
      if (!response.ok || !result) {
        throw new Error(result?.error ?? `Extraction failed with HTTP ${response.status}`);
      }
      setRaces(result.races);
      setActive(0);
      setStep("review");
      setStatus(`Review ready: detected ${result.races.length} races from ${result.source.replaceAll("_", " ")}.`);
    } catch (error) {
      setErrorTitle("Upload failed");
      setStep("error");
      setStatus(error instanceof Error ? error.message : "Extraction failed.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function updateRace(patch: Partial<Race>) {
    setRaces((items) => items.map((item, index) => (index === active ? { ...item, ...patch } : item)));
  }

  function updateRunner(index: number, field: keyof Race["runners"][number], value: string) {
    if (!race) return;
    const runners = race.runners.map((runner, runnerIndex) =>
      runnerIndex === index
        ? {
            ...runner,
            [field]: field === "horseNumber" || field === "drawNumber" ? Number(value) : value,
          }
        : runner,
    );
    updateRace({ runners });
  }

  function addRunner() {
    if (!race) return;
    updateRace({
      runners: [
        ...race.runners,
        { horseNumber: race.runners.length + 1, drawNumber: null, horseName: "", trainer: "", jockey: "" },
      ],
    });
  }

  function deleteRunner(index: number) {
    if (!race) return;
    updateRace({ runners: race.runners.filter((_, runnerIndex) => runnerIndex !== index) });
  }

  async function generate() {
    if (races.length === 0) return;
    setBusy(true);
    setStep("generating");
    setStatus("Generating print-ready posters...");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ races }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error ?? `Generation failed with HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "race-posters.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setStep("done");
      setStatus("Download ready.");
    } catch (error) {
      setErrorTitle("Generation failed");
      setStep("error");
      setStatus(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <style>{appStyles}</style>
      <style>{posterStyles}</style>
      <section className="topbar">
        <div>
          <h1>Race Card Poster Generator</h1>
          <p>{status}</p>
        </div>
        <label className={`upload-button ${busy ? "disabled" : ""}`}>
          Upload PDF
          <input type="file" accept="application/pdf" disabled={busy} onChange={upload} />
        </label>
        <button className="primary download-button" aria-busy={step === "generating"} disabled={busy || races.length === 0} onClick={generate}>
          {step === "generating" && <span className="button-spinner" aria-hidden="true" />}
          {step === "generating" ? "Generating ZIP..." : "Download ZIP"}
        </button>
      </section>

      <section className="stepbar">
        <div className="task-progress" style={{ ["--progress" as string]: `${progressForStep(step, generationSeconds)}%` }}>
          <Step index={1} label="PDF Uploaded" active={["uploaded", "extracting", "review", "generating", "done"].includes(step)} current={step === "uploaded"} />
          <Step index={2} label="Extract Data" active={["review", "generating", "done"].includes(step)} current={step === "extracting"} />
          <Step index={3} label="Review Posters" active={["review", "generating", "done"].includes(step)} current={step === "review"} />
          <Step index={4} label="Download ZIP" active={step === "done"} current={step === "generating"} />
        </div>
        {uploadedFile && <div className="file-pill">{uploadedFile}</div>}
      </section>

      {step === "idle" && (
        <section className="empty-state">
          <strong>Upload a race-card PDF</strong>
          <span>The app will extract all races, open the review UI, show poster previews, and then generate print-ready output.</span>
        </section>
      )}

      {step === "extracting" && (
        <section className="processing-state">
          <div className="spinner" />
          <div>
            <strong>PDF uploaded successfully.</strong>
            <span>Extracting race details, runners, trainers, jockeys, and draw numbers.</span>
          </div>
        </section>
      )}

      {step === "generating" && (
        <section className="generation-state" role="status" aria-live="polite">
          <div className="spinner" />
          <div className="generation-copy">
            <strong>{generationPhase(generationSeconds)}</strong>
            <span>
              Creating {races.length} print-ready posters. {generationSeconds} second{generationSeconds === 1 ? "" : "s"} elapsed.
            </span>
            <div className="generation-track" aria-hidden="true">
              <span />
            </div>
          </div>
        </section>
      )}

      {step === "error" && (
        <section className="error-state">
          <strong>{errorTitle}</strong>
          <span>{status}</span>
        </section>
      )}

      {races.length > 0 && (
        <section className="workspace">
          <aside className="race-tabs">
            {races.map((item, index) => (
              <button className={index === active ? "selected" : ""} key={item.raceNumber} onClick={() => setActive(index)}>
                Race {item.raceNumber}
                <span>{item.runners.length} runners</span>
              </button>
            ))}
            {warnings.length > 0 && <div className="warning">{warnings.length} validation warnings need review.</div>}
          </aside>

          {race && (
            <section className="editor">
              <div className="race-fields">
                <Field label="Date" value={race.date} onChange={(value) => updateRace({ date: value })} />
                <Field label="Venue" value={race.venue} onChange={(value) => updateRace({ venue: value.toUpperCase() })} />
                <Field label="Time" value={race.time} onChange={(value) => updateRace({ time: value })} />
                <Field label="Race No." value={race.raceNumber} onChange={(value) => updateRace({ raceNumber: Number(value) })} />
                <Field label="Distance" value={race.distanceMetres} onChange={(value) => updateRace({ distanceMetres: Number(value) })} />
              </div>

              <div className="runner-toolbar">
                <h2>Runners</h2>
                <button onClick={addRunner}>Add Runner</button>
              </div>

              <div className="runner-table">
                <div className="runner-head">No.</div>
                <div className="runner-head">Horse</div>
                <div className="runner-head">Trainer</div>
                <div className="runner-head">Jockey</div>
                <div className="runner-head">Draw</div>
                <div className="runner-head"></div>
                {race.runners.map((runner, index) => (
                  <Row
                    key={`${runner.horseNumber}-${index}`}
                    runner={runner}
                    index={index}
                    updateRunner={updateRunner}
                    deleteRunner={deleteRunner}
                  />
                ))}
              </div>
            </section>
          )}

          {race && (
            <aside className="preview-pane">
              <div className="preview-scale">
                <RacePoster race={race} />
              </div>
            </aside>
          )}
        </section>
      )}
    </main>
  );
}

function Step({ index, label, active, current }: { index: number; label: string; active: boolean; current: boolean }) {
  return (
    <div className={`step ${active ? "active" : ""} ${current ? "current" : ""}`}>
      <span>{index}</span>
      {label}
    </div>
  );
}

function progressForStep(step: string, generationSeconds: number): number {
  switch (step) {
    case "uploaded":
      return 12;
    case "extracting":
      return 38;
    case "review":
      return 68;
    case "generating":
      return Math.min(97, 78 + generationSeconds * 2.5);
    case "done":
      return 100;
    default:
      return 0;
  }
}

function generationPhase(seconds: number): string {
  if (seconds < 2) return "Preparing vector PDFs...";
  if (seconds < 7) return "Rendering 300 DPI poster images...";
  return "Packaging your ZIP download...";
}

function Field({ label, value, onChange }: { label: string; value: string | number; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Row({
  runner,
  index,
  updateRunner,
  deleteRunner,
}: {
  runner: Race["runners"][number];
  index: number;
  updateRunner: (index: number, field: keyof Race["runners"][number], value: string) => void;
  deleteRunner: (index: number) => void;
}) {
  return (
    <>
      <input value={runner.horseNumber} onChange={(event) => updateRunner(index, "horseNumber", event.target.value)} />
      <input value={runner.horseName} onChange={(event) => updateRunner(index, "horseName", event.target.value.toUpperCase())} />
      <input value={runner.trainer} onChange={(event) => updateRunner(index, "trainer", event.target.value)} />
      <input value={runner.jockey} onChange={(event) => updateRunner(index, "jockey", event.target.value)} />
      <input value={runner.drawNumber ?? ""} onChange={(event) => updateRunner(index, "drawNumber", event.target.value)} />
      <button className="danger" onClick={() => deleteRunner(index)}>
        Delete
      </button>
    </>
  );
}

const appStyles = `
.app-shell { min-height: 100vh; }
.topbar {
  position: sticky; top: 0; z-index: 2;
  display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center;
  padding: 16px 20px; background: #ffffff; border-bottom: 1px solid #d7dce3;
}
.stepbar {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 20px; background: #fff; border-bottom: 1px solid #d7dce3;
}
.task-progress {
  position: relative; flex: 1; display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px;
}
.task-progress::before, .task-progress::after {
  content: ""; position: absolute; left: 12px; right: 12px; top: 50%; height: 3px; transform: translateY(-50%);
  background: #d7dce3; z-index: 0;
}
.task-progress::after {
  right: auto; width: var(--progress); background: #123C91;
}
.step {
  position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  border: 1px solid #c9d1dc; color: #526070; background: #fff;
  border-radius: 999px; padding: 8px 12px; font-size: 13px; font-weight: 700;
}
.step span {
  display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 999px;
  background: #eef2f6; color: #526070; font-size: 12px;
}
.step.active { border-color: #2E7D16; color: #2E7D16; background: #f0faed; }
.step.current { border-color: #123C91; color: #123C91; background: #edf3ff; }
.step.active span { background: #2E7D16; color: #fff; }
.step.current span { background: #123C91; color: #fff; }
.file-pill {
  max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: #526070; font-size: 13px;
}
.empty-state, .processing-state, .generation-state, .error-state {
  margin: 22px; padding: 22px; background: #fff; border: 1px solid #d7dce3; border-radius: 8px;
  display: flex; flex-direction: column; gap: 6px; color: #526070;
}
.empty-state strong, .processing-state strong, .generation-state strong, .error-state strong { color: #111827; font-size: 18px; }
.processing-state, .generation-state { flex-direction: row; align-items: center; }
.generation-state {
  margin-bottom: 0; border-color: #b9c9ec; background: #f4f7ff;
}
.generation-copy { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.generation-track {
  position: relative; height: 6px; margin-top: 8px; overflow: hidden; border-radius: 3px; background: #dbe4f5;
}
.generation-track span {
  position: absolute; inset: 0 auto 0 -35%; width: 35%; background: #123C91;
  animation: generation-slide 1.2s ease-in-out infinite;
}
.spinner {
  width: 28px; height: 28px; border: 3px solid #d7dce3; border-top-color: #123C91; border-radius: 999px;
  animation: spin .8s linear infinite;
}
.button-spinner {
  width: 15px; height: 15px; border: 2px solid rgba(255,255,255,.45); border-top-color: #fff; border-radius: 50%;
  animation: spin .7s linear infinite;
}
.error-state { border-color: #f2b8bd; background: #fff6f7; color: #8E141B; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes generation-slide {
  0% { left: -35%; }
  100% { left: 100%; }
}
h1 { margin: 0; font-size: 22px; }
p { margin: 3px 0 0; color: #526070; }
button, .upload-button {
  border: 1px solid #c9d1dc; background: #fff; color: #111827;
  border-radius: 6px; padding: 9px 12px; cursor: pointer; font-weight: 700;
}
.primary { background: #123C91; color: #fff; border-color: #123C91; }
.download-button { min-width: 142px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
button:disabled { opacity: .5; cursor: not-allowed; }
.upload-button.disabled { opacity: .5; cursor: not-allowed; }
.upload-button input { display: none; }
.workspace { display: grid; grid-template-columns: 180px minmax(560px, 1fr) 390px; gap: 18px; padding: 18px; }
.race-tabs, .editor, .preview-pane { background: #fff; border: 1px solid #d7dce3; border-radius: 8px; }
.race-tabs { padding: 10px; height: calc(100vh - 146px); overflow: auto; }
.race-tabs button { width: 100%; display: flex; justify-content: space-between; margin-bottom: 8px; }
.race-tabs .selected { background: #edf3ff; border-color: #123C91; }
.race-tabs span { color: #526070; font-weight: 500; }
.warning { margin-top: 10px; color: #8E141B; font-size: 13px; line-height: 1.35; }
.editor { padding: 16px; overflow: auto; height: calc(100vh - 146px); }
.race-fields { display: grid; grid-template-columns: repeat(5, minmax(90px, 1fr)); gap: 10px; }
label span { display: block; color: #526070; font-size: 12px; margin-bottom: 4px; }
input { width: 100%; border: 1px solid #c9d1dc; border-radius: 6px; padding: 8px; }
.runner-toolbar { display: flex; justify-content: space-between; align-items: center; margin: 18px 0 10px; }
h2 { margin: 0; font-size: 18px; }
.runner-table { display: grid; grid-template-columns: 58px 1.4fr 1fr 1fr 64px 74px; gap: 8px; align-items: center; }
.runner-head { color: #526070; font-size: 12px; font-weight: 700; }
.danger { color: #8E141B; }
.preview-pane { height: calc(100vh - 146px); overflow: auto; padding: 14px; }
.preview-scale { transform: scale(.145); transform-origin: top left; width: 250mm; height: 760mm; }
@media (max-width: 1180px) {
  .workspace { grid-template-columns: 150px minmax(520px, 1fr); }
  .preview-pane { grid-column: 1 / -1; height: 520px; }
}
`;
