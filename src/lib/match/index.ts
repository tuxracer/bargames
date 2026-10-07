import {
  applyHop,
  applyMove,
  applyStep,
  createGame,
  endChain,
} from "@/lib/game";
import type { GameState } from "@/lib/game";
import type { MatchAction, MatchState } from "./types";

export * from "./types";

export const INITIAL_MATCH: MatchState = { game: null, history: [] };

const humanToMove = (game: GameState): boolean => {
  return game.seats[game.current].kind === "human";
};

/**
 * Undo mid-chain takes back one hop. Otherwise it rewinds to the start of
 * the most recent human turn, so taking back a move against the computer
 * also takes back its reply.
 */
const undoTarget = (state: MatchState): number => {
  if (state.game?.chain) return state.history.length - 1;
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const past = state.history[index];
    if (humanToMove(past) && past.chain === null) return index;
  }
  return -1;
};

const undo = (state: MatchState): MatchState => {
  const index = undoTarget(state);
  if (index < 0) return state;
  return { game: state.history[index], history: state.history.slice(0, index) };
};

const advance = (state: MatchState, game: GameState): MatchState => {
  return { game, history: [...state.history, state.game as GameState] };
};

export const matchReducer = (
  state: MatchState,
  action: MatchAction,
): MatchState => {
  switch (action.type) {
    case "start":
      return { game: createGame(action.kinds), history: [] };
    case "move":
      if (state.game === null) return state;
      return advance(state, applyMove(state.game, action.move));
    case "step":
      if (state.game === null) return state;
      return advance(state, applyStep(state.game, action.piece, action.hole));
    case "hop":
      if (state.game === null) return state;
      return advance(state, applyHop(state.game, action.piece, action.hole));
    case "stop":
      if (state.game === null) return state;
      return advance(state, endChain(state.game));
    case "undo":
      return undo(state);
    case "quit":
      return INITIAL_MATCH;
  }
};

export const canUndo = (state: MatchState): boolean => {
  return undoTarget(state) >= 0;
};
