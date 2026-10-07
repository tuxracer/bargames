import { useState } from "react";
import { SEAT_LAYOUTS } from "@/lib/game";
import type { PlayerCount, SeatKind } from "@/lib/game";
import type { Theme } from "@/lib/theme";

type SetupProps = {
  theme: Theme;
  onStart: (kinds: readonly SeatKind[]) => void;
};

const PLAYER_COUNTS: readonly PlayerCount[] = [2, 3, 4, 6];

const defaultKinds = (count: PlayerCount): SeatKind[] => {
  return SEAT_LAYOUTS[count].map((_, index) =>
    index === 0 ? "human" : "computer",
  );
};

/** The table before the game: how many sit down, and which are people. */
export const Setup = ({ theme, onStart }: SetupProps) => {
  const [count, setCount] = useState<PlayerCount>(2);
  const [kinds, setKinds] = useState<SeatKind[]>(() => defaultKinds(2));

  const pickCount = (next: PlayerCount) => {
    setCount(next);
    setKinds(defaultKinds(next));
  };

  const toggleKind = (index: number) => {
    setKinds((previous) =>
      previous.map((kind, i) =>
        i === index ? (kind === "human" ? "computer" : "human") : kind,
      ),
    );
  };

  return (
    <div className="setup-backdrop">
      <section className="setup">
        <p className="setup-eyebrow">bargames</p>
        <h1 className="setup-title">Chinese Checkers</h1>
        <p className="setup-blurb">
          Race your ten marbles across the star into the far corner. Step to a
          neighboring hole, or hop over any marble, as many times as the board
          allows.
        </p>

        <div className="setup-row">
          <span className="setup-label">Players</span>
          <div className="segmented">
            {PLAYER_COUNTS.map((option) => (
              <button
                key={option}
                type="button"
                className={
                  option === count ? "segment segment-selected" : "segment"
                }
                onClick={() => pickCount(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <ul className="seat-list">
          {SEAT_LAYOUTS[count].map((zone, index) => {
            const look = theme.marbles[zone];
            const kind = kinds[index];
            return (
              <li key={zone} className="seat-row">
                <span
                  className="seat-marble"
                  style={{ background: look.css }}
                />
                <span className="seat-name">{look.name}</span>
                <button
                  type="button"
                  className="seat-kind"
                  onClick={() => toggleKind(index)}
                >
                  {kind === "human" ? "Person" : "Computer"}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          className="button button-primary"
          onClick={() => onStart(kinds)}
        >
          Set up the board
        </button>
      </section>
    </div>
  );
};
