import { useCallback, useEffect, useReducer, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import type { MusicStatus } from "@/components/GameCanvas";
import { Hud } from "@/components/Hud";
import { OptionsPanel } from "@/components/Options";
import { Setup } from "@/components/Setup";
import { VisualsPanel } from "@/components/Visuals";
import { chooseMove } from "@/lib/ai";
import type { HoleIndex, Zone } from "@/lib/board";
import { createGame } from "@/lib/game";
import type { GameState, SeatKind } from "@/lib/game";
import { canUndo, INITIAL_MATCH, matchReducer } from "@/lib/match";
import type { MatchAction } from "@/lib/match";
import { loadOptions, saveOptions } from "@/lib/options";
import type { Options } from "@/lib/options";
import { getTheme } from "@/lib/theme";

/** A beat before the computer plays, so its move reads as a reply. */
const THINK_MS = 650;

/** Which card is open over the table, if any. */
type Panel = "none" | "options" | "visuals";

/**
 * Pass and play: which side of the table the view leans toward. The human
 * to move, or through the computer's turns, the last human who moved.
 */
const viewZoneFor = (game: GameState | null, facePlayer: boolean): Zone => {
  if (!facePlayer || game === null) return "S";
  const count = game.seats.length;
  const start = game.winner ?? game.current;
  for (let back = 0; back < count; back += 1) {
    const seat = game.seats[(start - back + count) % count];
    if (seat.kind === "human") return seat.zone;
  }
  return "S";
};

/** An empty table to show behind the setup card. */
const LOBBY_BOARD = createGame(["human", "human"]);

export const App = () => {
  const [match, dispatch] = useReducer(matchReducer, INITIAL_MATCH);
  const [kinds, setKinds] = useState<readonly SeatKind[]>([]);
  // False while the table is still catching up (a marble in the air); the
  // computer waits for it.
  const [settled, setSettled] = useState(true);
  const [options, setOptions] = useState<Options>(loadOptions);
  const [panel, setPanel] = useState<Panel>("none");
  const [musicStatus, setMusicStatus] = useState<MusicStatus>("off");
  const game = match.game;

  const theme = getTheme(options.theme);

  const viewZone = viewZoneFor(game, options.facePlayer);
  const flipped = viewZone === "N" || viewZone === "NE" || viewZone === "NW";

  useEffect(() => {
    saveOptions(options);
  }, [options]);

  // The HTML overlay takes its colors and type from the theme too.
  useEffect(() => {
    document.documentElement.dataset.theme = theme.id;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute(
      "content",
      `#${theme.scene.background.toString(16).padStart(6, "0")}`,
    );
  }, [theme]);

  const start = useCallback((next: readonly SeatKind[]) => {
    setKinds(next);
    dispatch({ type: "start", kinds: next });
  }, []);

  /** Anything that changes the position: the table will report settled. */
  const play = useCallback((action: MatchAction) => {
    setSettled(false);
    dispatch(action);
  }, []);

  const handleStep = useCallback(
    (piece: number, hole: HoleIndex) => play({ type: "step", piece, hole }),
    [play],
  );
  const handleHop = useCallback(
    (piece: number, hole: HoleIndex) => play({ type: "hop", piece, hole }),
    [play],
  );
  const handleStop = useCallback(() => play({ type: "stop" }), [play]);
  const handleSettled = useCallback(() => setSettled(true), []);

  useEffect(() => {
    if (!game || game.winner !== null || !settled) return;
    if (game.seats[game.current].kind !== "computer") return;
    const timer = setTimeout(() => {
      const move = chooseMove(game);
      if (move) play({ type: "move", move });
    }, THINK_MS);
    return () => clearTimeout(timer);
  }, [game, settled, play]);

  const interactive =
    game !== null &&
    game.winner === null &&
    game.seats[game.current].kind === "human";

  return (
    <>
      <GameCanvas
        state={game ?? LOBBY_BOARD}
        interactive={interactive}
        hints={options.hints}
        theme={theme}
        viewZone={viewZone}
        music={options.music}
        sensitivity={options.sensitivity}
        visuals={options.visuals}
        onMusicStatus={setMusicStatus}
        onStep={handleStep}
        onHop={handleHop}
        onStop={handleStop}
        onSettled={handleSettled}
      />
      {game ? (
        <Hud
          game={game}
          theme={theme}
          flipped={flipped}
          canUndo={settled && interactive && canUndo(match)}
          onUndo={() => play({ type: "undo" })}
          onStop={handleStop}
          onPlayAgain={() => start(kinds)}
          onNewGame={() => dispatch({ type: "quit" })}
        />
      ) : (
        <Setup theme={theme} onStart={start} />
      )}
      <button
        type="button"
        className="options-button"
        onClick={() => setPanel("options")}
      >
        Options
      </button>
      {musicStatus === "listening" && (
        <div className="music-indicator" title="Listening to the room">
          <span />
          <span />
          <span />
        </div>
      )}
      {panel === "options" && (
        <OptionsPanel
          options={options}
          musicStatus={musicStatus}
          onChange={setOptions}
          onVisuals={() => setPanel("visuals")}
          onClose={() => setPanel("none")}
        />
      )}
      {panel === "visuals" && (
        <VisualsPanel
          options={options}
          musicStatus={musicStatus}
          onChange={setOptions}
          onBack={() => setPanel("options")}
          onClose={() => setPanel("none")}
        />
      )}
    </>
  );
};
