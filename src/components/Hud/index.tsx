import { canStop } from "@/lib/game";
import type { GameState } from "@/lib/game";
import type { Theme } from "@/lib/theme";

type HudProps = {
  game: GameState;
  theme: Theme;
  /** Turn the words upside down for a player on the far side of the table. */
  flipped: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onStop: () => void;
  onPlayAgain: () => void;
  onNewGame: () => void;
};

const statusLine = (game: GameState, theme: Theme): string => {
  const humans = game.seats.filter((seat) => seat.kind === "human").length;
  const seat = game.seats[game.current];
  const name = theme.marbles[seat.zone].name;
  if (seat.kind === "computer") return `${name} is thinking`;
  if (game.chain !== null) {
    return canStop(game) ? "Hop again, or stop here" : "Keep hopping";
  }
  return humans === 1 ? "Your move" : `${name}, your move`;
};

/** Whose turn it is, and the few things you can do besides play. */
export const Hud = ({
  game,
  theme,
  flipped,
  canUndo,
  onUndo,
  onStop,
  onPlayAgain,
  onNewGame,
}: HudProps) => {
  const over = game.winner !== null;
  const seat = game.seats[game.winner ?? game.current];
  const look = theme.marbles[seat.zone];
  const midChain = !over && game.chain !== null;
  const humans = game.seats.filter((other) => other.kind === "human").length;
  const youWon = over && seat.kind === "human" && humans === 1;

  return (
    <div className={flipped ? "hud hud-flipped" : "hud"}>
      <header className="hud-top">
        <p className="wordmark">neongames</p>
        {over ? (
          <div className="win-banner" style={{ color: look.css }}>
            <p className="win-name">
              <span
                className="status-marble"
                style={{ background: look.css }}
              />
              {look.name}
            </p>
            <p className="win-word">wins</p>
            {youWon && <p className="win-note">That&apos;s you.</p>}
          </div>
        ) : (
          <p className="status">
            <span className="status-marble" style={{ background: look.css }} />
            {statusLine(game, theme)}
          </p>
        )}
      </header>
      <footer className="hud-bottom">
        {over ? (
          <button
            type="button"
            className="button button-primary"
            onClick={onPlayAgain}
          >
            Play again
          </button>
        ) : (
          <button
            type="button"
            className="button"
            disabled={!canUndo}
            onClick={onUndo}
          >
            Undo
          </button>
        )}
        {midChain && (
          <button
            type="button"
            className="button button-primary"
            disabled={!canStop(game)}
            onClick={onStop}
          >
            Stop here
          </button>
        )}
        <button type="button" className="button" onClick={onNewGame}>
          New game
        </button>
      </footer>
    </div>
  );
};
