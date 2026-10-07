import { describe, expect, it } from "vitest";
import { legalMovesForSeat } from "@/lib/game";
import type { GameState } from "@/lib/game";
import { canUndo, INITIAL_MATCH, matchReducer } from ".";
import type { MatchState } from ".";

const started = (kinds: ("human" | "computer")[]): MatchState => {
  return matchReducer(INITIAL_MATCH, { type: "start", kinds });
};

const play = (state: MatchState): MatchState => {
  const game = state.game as GameState;
  const move = legalMovesForSeat(game, game.current)[0];
  return matchReducer(state, { type: "move", move });
};

describe("matchReducer", () => {
  it("starts with no game and nothing to undo", () => {
    expect(INITIAL_MATCH.game).toBeNull();
    expect(canUndo(INITIAL_MATCH)).toBe(false);
  });

  it("records each move so a human can take one back", () => {
    const one = play(started(["human", "human"]));
    expect(canUndo(one)).toBe(true);
    const undone = matchReducer(one, { type: "undo" });
    expect(undone.game?.turn).toBe(0);
    expect(canUndo(undone)).toBe(false);
  });

  it("undoes the computer's reply along with the human's move", () => {
    const afterHuman = play(started(["human", "computer"]));
    const afterComputer = play(afterHuman);
    expect(afterComputer.game?.turn).toBe(2);
    const undone = matchReducer(afterComputer, { type: "undo" });
    expect(undone.game?.turn).toBe(0);
    expect(undone.game?.current).toBe(0);
  });

  it("ignores moves and undo when no game is running", () => {
    const quit = matchReducer(play(started(["human", "human"])), {
      type: "quit",
    });
    expect(quit).toEqual(INITIAL_MATCH);
    expect(matchReducer(quit, { type: "undo" })).toEqual(INITIAL_MATCH);
  });
});
