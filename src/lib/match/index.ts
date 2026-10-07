import { applyMove, createGame } from "@/lib/game";
import type { MatchAction, MatchState } from "./types";

export * from "./types";

export const INITIAL_MATCH: MatchState = { game: null, history: [] };

/**
 * Undo rewinds to the most recent position where a human was about to move,
 * so taking back a move against the computer also takes back its reply.
 */
const undo = (state: MatchState): MatchState => {
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const past = state.history[index];
    if (past.seats[past.current].kind === "human") {
      return { game: past, history: state.history.slice(0, index) };
    }
  }
  return state;
};

export const matchReducer = (
  state: MatchState,
  action: MatchAction,
): MatchState => {
  switch (action.type) {
    case "start":
      return { game: createGame(action.kinds), history: [] };
    case "move": {
      if (state.game === null) return state;
      return {
        game: applyMove(state.game, action.move),
        history: [...state.history, state.game],
      };
    }
    case "undo":
      return undo(state);
    case "quit":
      return INITIAL_MATCH;
  }
};

export const canUndo = (state: MatchState): boolean => {
  return state.history.some(
    (past) => past.seats[past.current].kind === "human",
  );
};
