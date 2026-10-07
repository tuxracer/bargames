import { describe, expect, it } from "vitest";
import { applyMove, createGame, legalMovesForSeat } from "@/lib/game";
import type { GameState } from "@/lib/game";
import { chooseMove, evaluate } from ".";

describe("chooseMove", () => {
  it("always returns one of the legal moves for the seat to play", () => {
    const game = createGame(["computer", "computer"]);
    const legal = legalMovesForSeat(game, 0);
    const move = chooseMove(game, () => 0.5);
    expect(move).not.toBeNull();
    expect(legal).toContainEqual(move);
  });

  it("prefers the move that brings its marbles furthest forward", () => {
    const game = createGame(["computer", "computer"]);
    const move = chooseMove(game, () => 0);
    expect(move).not.toBeNull();
    const after = applyMove(game, move!);
    for (const other of legalMovesForSeat(game, 0)) {
      expect(evaluate(after, 0)).toBeGreaterThanOrEqual(
        evaluate(applyMove(game, other), 0),
      );
    }
  });

  it("finishes a two-computer game within a sane number of turns", () => {
    let game: GameState = createGame(["computer", "computer"]);
    let seed = 1;
    const random = () => {
      seed = (seed * 48_271) % 2_147_483_647;
      return seed / 2_147_483_647;
    };
    for (let turn = 0; turn < 400 && game.winner === null; turn += 1) {
      const move = chooseMove(game, random);
      expect(move).not.toBeNull();
      game = applyMove(game, move!);
    }
    expect(game.winner).not.toBeNull();
  });
});
