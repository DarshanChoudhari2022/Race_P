import type { Race } from "@/types/race";
import { ordinal } from "@/lib/utils/ordinal";
import { calculatePosterLayout } from "@/lib/poster/layoutCalculator";
import { fitHorseNameFontSize } from "@/lib/poster/textFit";

export interface RacePosterProps {
  race: Race;
  footerTop?: string;
  footerBottom?: string;
}

export function RacePoster({
  race,
  footerTop = "PRINTED BY",
  footerBottom = "CHANKA NEWS",
}: RacePosterProps) {
  const layout = calculatePosterLayout(race.runners.length);

  return (
    <section className="race-poster">
      <header className="poster-header" style={{ height: `${layout.headerHeightMm}mm` }}>
        <div className="poster-date">{race.date}</div>
        <div className="poster-venue">
          {race.venue} RACE {race.time}
        </div>
        <div className="poster-race-line">
          <span>{ordinal(race.raceNumber)} RACE</span>
          <span className="poster-bracket">({race.raceNumber})</span>
          <span>{race.distanceMetres}M</span>
        </div>
      </header>

      <main className="poster-runners" style={{ top: `${layout.runnerTopMm}mm` }}>
        {race.runners.map((runner, index) => {
          const horseFont = fitHorseNameFontSize(runner.horseName, layout.horseFontPt);
          return (
            <div
              className="poster-runner"
              key={`${runner.horseNumber}-${runner.horseName}`}
              style={{
                top: `${index * layout.runnerHeightMm}mm`,
                height: `${layout.runnerHeightMm}mm`,
              }}
            >
              <div className="runner-main">
                <span className="runner-number" style={{ fontSize: `${layout.numberFontPt}pt` }}>
                  {runner.horseNumber}
                </span>
                <span className="runner-name" style={{ fontSize: `${horseFont}pt` }}>
                  {runner.horseName}
                </span>
              </div>
              <div className="runner-detail" style={{ fontSize: `${layout.detailFontPt}pt` }}>
                <span className="runner-trainer">{runner.trainer}</span>
                <span className="runner-jockey">
                  {runner.jockey} <span className="runner-draw">({runner.drawNumber ?? "?"})</span>
                </span>
              </div>
            </div>
          );
        })}
      </main>

      <footer className="poster-footer">
        <div>{footerTop}</div>
        <strong>{footerBottom}</strong>
      </footer>
    </section>
  );
}
