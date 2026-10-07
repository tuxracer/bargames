import { distanceToApex } from "@/lib/board";
import { applyMove, goalZoneOf, legalMovesForSeat } from "@/lib/game";
import type { GameState, Move, SeatIndex } from "@/lib/game";
import { STRAGGLER_WEIGHT, TIE_BREAK_JITTER } from "./consts";

export * from "./consts";

/**
 * How good a position is for `seat`: the fewer lattice steps its marbles
 * have left to the far corner of the goal, the better. The straggler term
 * keeps the computer from racing nine marbles home and forgetting the tenth.
 */
export const evaluate = (state: GameState, seat: SeatIndex): number => {
  const goal = goalZoneOf(state.seats[seat]);
  let total = 0;
  let worst = 0;
  for (const piece of state.pieces) {
    if (piece.seat !== seat) continue;
    const distance = distanceToApex(piece.hole, goal);
    total += distance;
    if (distance > worst) worst = distance;
  }
  return -(total + STRAGGLER_WEIGHT * worst);
};

/**
 * Greedy one-move lookahead: play whatever leaves the best position. Simple,
 * fast, and good enough to keep a casual game honest.
 */
export const chooseMove = (
  state: GameState,
  random: () => number = Math.random,
): Move | null => {
  const seat = state.current;
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const move of legalMovesForSeat(state, seat)) {
    const score =
      evaluate(applyMove(state, move), seat) + random() * TIE_BREAK_JITTER;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
};
