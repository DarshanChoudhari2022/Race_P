"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { RacePoster } from "@/components/poster/RacePoster";
import { posterStyles } from "@/components/poster/posterStyles";
import type { ExtractionResult, Race } from "@/types/race";

export default function Home() {
  const [races, setRaces] = useState<Race[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("Upload an IndiaRace PDF to begin.");
  const [busy, setBusy] = useState(false);
  const race = races[active];
  const warnings = useMemo(() => races.flatMap((item) => item.warnings ?? []), [races]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus("Extracting native PDF text...");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/extract", { method: "POST", body: form });
    const result = (await response.json()) as ExtractionResult;
    setRaces(result.races);
    setActive(0);
    setStatus(`Detected ${result.races.length} races from ${result.source.replaceAll("_", " ")}.`);
    setBusy(false);
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
    setStatus("Generating vector PDFs, PNGs, and ZIP...");
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ races }),
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "race-posters.zip";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Download ready.");
    setBusy(false);
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
        <label className="upload-button">
          Upload PDF
          <input type="file" accept="application/pdf" onChange={upload} />
        </label>
        <button className="primary" disabled={busy || races.length === 0} onClick={generate}>
          Download ZIP
        </button>
      </section>

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
h1 { margin: 0; font-size: 22px; }
p { margin: 3px 0 0; color: #526070; }
button, .upload-button {
  border: 1px solid #c9d1dc; background: #fff; color: #111827;
  border-radius: 6px; padding: 9px 12px; cursor: pointer; font-weight: 700;
}
.primary { background: #123C91; color: #fff; border-color: #123C91; }
button:disabled { opacity: .5; cursor: not-allowed; }
.upload-button input { display: none; }
.workspace { display: grid; grid-template-columns: 180px minmax(560px, 1fr) 390px; gap: 18px; padding: 18px; }
.race-tabs, .editor, .preview-pane { background: #fff; border: 1px solid #d7dce3; border-radius: 8px; }
.race-tabs { padding: 10px; height: calc(100vh - 96px); overflow: auto; }
.race-tabs button { width: 100%; display: flex; justify-content: space-between; margin-bottom: 8px; }
.race-tabs .selected { background: #edf3ff; border-color: #123C91; }
.race-tabs span { color: #526070; font-weight: 500; }
.warning { margin-top: 10px; color: #8E141B; font-size: 13px; line-height: 1.35; }
.editor { padding: 16px; overflow: auto; height: calc(100vh - 96px); }
.race-fields { display: grid; grid-template-columns: repeat(5, minmax(90px, 1fr)); gap: 10px; }
label span { display: block; color: #526070; font-size: 12px; margin-bottom: 4px; }
input { width: 100%; border: 1px solid #c9d1dc; border-radius: 6px; padding: 8px; }
.runner-toolbar { display: flex; justify-content: space-between; align-items: center; margin: 18px 0 10px; }
h2 { margin: 0; font-size: 18px; }
.runner-table { display: grid; grid-template-columns: 58px 1.4fr 1fr 1fr 64px 74px; gap: 8px; align-items: center; }
.runner-head { color: #526070; font-size: 12px; font-weight: 700; }
.danger { color: #8E141B; }
.preview-pane { height: calc(100vh - 96px); overflow: auto; padding: 14px; }
.preview-scale { transform: scale(.145); transform-origin: top left; width: 250mm; height: 760mm; }
@media (max-width: 1180px) {
  .workspace { grid-template-columns: 150px minmax(520px, 1fr); }
  .preview-pane { grid-column: 1 / -1; height: 520px; }
}
`;
