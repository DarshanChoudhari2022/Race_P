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
          const horseFont = runner.horseFontSize ?? fitHorseNameFontSize(runner.horseName, layout.horseFontPt);
          const numberFont = runner.numberFontSize ?? horseFont;
          const trainerFont = runner.trainerFontSize ?? layout.detailFontPt;
          const jockeyFont = runner.jockeyFontSize ?? layout.detailFontPt;
          const drawFont = runner.drawFontSize ?? layout.detailFontPt;
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
                <span className="runner-number" style={{ fontSize: `${numberFont}pt` }}>
                  {runner.horseNumber}
                </span>
                <span className="runner-name" style={{ fontSize: `${horseFont}pt` }}>
                  {runner.horseName}
                </span>
              </div>
              <div className="runner-detail" style={{ fontSize: `${layout.detailFontPt}pt` }}>
                <span className="runner-trainer" style={{ fontSize: `${trainerFont}pt` }}>{runner.trainer}</span>
                <span className="runner-jockey" style={{ fontSize: `${jockeyFont}pt` }}>
                  {runner.jockey} <span className="runner-draw" style={{ fontSize: `${drawFont}pt` }}>({runner.drawNumber ?? "?"})</span>
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
