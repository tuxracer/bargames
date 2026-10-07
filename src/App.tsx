import { useCallback, useEffect, useReducer, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { Hud } from "@/components/Hud";
import { OptionsPanel } from "@/components/Options";
import { Setup } from "@/components/Setup";
import { chooseMove } from "@/lib/ai";
import type { HoleIndex } from "@/lib/board";
import { createGame } from "@/lib/game";
import type { SeatKind } from "@/lib/game";
import { canUndo, INITIAL_MATCH, matchReducer } from "@/lib/match";
import type { MatchAction } from "@/lib/match";
import { loadOptions, saveOptions } from "@/lib/options";
import type { Options } from "@/lib/options";
import { getTheme } from "@/lib/theme";

/** A beat before the computer plays, so its move reads as a reply. */
const THINK_MS = 650;

/** An empty table to show behind the setup card. */
const LOBBY_BOARD = createGame(["human", "human"]);

export const App = () => {
  const [match, dispatch] = useReducer(matchReducer, INITIAL_MATCH);
  const [kinds, setKinds] = useState<readonly SeatKind[]>([]);
  // False while the table is still catching up (a marble in the air); the
  // computer waits for it.
  const [settled, setSettled] = useState(true);
  const [options, setOptions] = useState<Options>(loadOptions);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const game = match.game;

  const theme = getTheme(options.theme);

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
        onStep={handleStep}
        onHop={handleHop}
        onStop={handleStop}
        onSettled={handleSettled}
      />
      {game ? (
        <Hud
          game={game}
          theme={theme}
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
        onClick={() => setOptionsOpen(true)}
      >
        Options
      </button>
      {optionsOpen && (
        <OptionsPanel
          options={options}
          onChange={setOptions}
          onClose={() => setOptionsOpen(false)}
        />
      )}
    </>
  );
};
