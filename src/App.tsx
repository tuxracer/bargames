import { useCallback, useEffect, useReducer, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { Hud } from "@/components/Hud";
import { Setup } from "@/components/Setup";
import { chooseMove } from "@/lib/ai";
import { createGame } from "@/lib/game";
import type { Move, SeatKind } from "@/lib/game";
import { canUndo, INITIAL_MATCH, matchReducer } from "@/lib/match";

/** A beat before the computer plays, so its move reads as a reply. */
const THINK_MS = 650;

/** An empty table to show behind the setup card. */
const LOBBY_BOARD = createGame(["human", "human"]);

export const App = () => {
  const [match, dispatch] = useReducer(matchReducer, INITIAL_MATCH);
  const [kinds, setKinds] = useState<readonly SeatKind[]>([]);
  // False while a marble is still in the air; the computer waits for it.
  const [settled, setSettled] = useState(true);
  const game = match.game;

  const start = useCallback((next: readonly SeatKind[]) => {
    setKinds(next);
    dispatch({ type: "start", kinds: next });
  }, []);

  const handleMove = useCallback((move: Move) => {
    setSettled(false);
    dispatch({ type: "move", move });
  }, []);

  const handleSettled = useCallback(() => setSettled(true), []);

  useEffect(() => {
    if (!game || game.winner !== null || !settled) return;
    if (game.seats[game.current].kind !== "computer") return;
    const timer = setTimeout(() => {
      const move = chooseMove(game);
      if (move) handleMove(move);
    }, THINK_MS);
    return () => clearTimeout(timer);
  }, [game, settled, handleMove]);

  const interactive =
    game !== null &&
    game.winner === null &&
    game.seats[game.current].kind === "human";

  return (
    <>
      <GameCanvas
        state={game ?? LOBBY_BOARD}
        interactive={interactive}
        onMove={handleMove}
        onSettled={handleSettled}
      />
      {game ? (
        <Hud
          game={game}
          canUndo={settled && interactive && canUndo(match)}
          onUndo={() => dispatch({ type: "undo" })}
          onPlayAgain={() => start(kinds)}
          onNewGame={() => dispatch({ type: "quit" })}
        />
      ) : (
        <Setup onStart={start} />
      )}
    </>
  );
};
