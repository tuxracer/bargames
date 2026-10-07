import type { HoleIndex } from "@/lib/board";
import type { GameState, Move, SeatKind } from "@/lib/game";

/** A match wraps one game with the history that makes undo possible. */
export type MatchState = {
  readonly game: GameState | null;
  /** Earlier positions, oldest first; the live position is `game`. */
  readonly history: readonly GameState[];
};

export type MatchAction =
  | { readonly type: "start"; readonly kinds: readonly SeatKind[] }
  /** A whole move at once; how the computer plays. */
  | { readonly type: "move"; readonly move: Move }
  | { readonly type: "step"; readonly piece: number; readonly hole: HoleIndex }
  | { readonly type: "hop"; readonly piece: number; readonly hole: HoleIndex }
  | { readonly type: "stop" }
  | { readonly type: "undo" }
  | { readonly type: "quit" };
