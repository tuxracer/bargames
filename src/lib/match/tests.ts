import { describe, expect, it } from "vitest";
import { hopOptions, legalMovesForSeat } from "@/lib/game";
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

describe("hop by hop in a match", () => {
  const hopTwice = (): MatchState => {
    // Walk the first human marble out with steps until a hop appears, then
    // take it. Both seats are human so the search is deterministic.
    let state = started(["human", "human"]);
    for (let guard = 0; guard < 40; guard += 1) {
      const game = state.game as GameState;
      const mine = game.pieces.filter((piece) => piece.seat === game.current);
      const hopper = mine.find((piece) => hopOptions(game, piece.id).length);
      if (hopper) {
        const hole = hopOptions(game, hopper.id)[0];
        return matchReducer(state, { type: "hop", piece: hopper.id, hole });
      }
      state = play(state);
    }
    throw new Error("no hop found");
  };

  it("records a hop as its own position so undo takes back one hop", () => {
    const mid = hopTwice();
    const game = mid.game as GameState;
    if (game.chain === null) return; // the hop ended the turn by itself
    expect(canUndo(mid)).toBe(true);
    const back = matchReducer(mid, { type: "undo" });
    expect(back.game?.chain).toBeNull();
    expect(back.game?.turn).toBe(game.turn);
    expect(back.game?.current).toBe(game.current);
  });

  it("stops a chain and hands the turn over", () => {
    const mid = hopTwice();
    const game = mid.game as GameState;
    if (game.chain === null) return;
    const stopped = matchReducer(mid, { type: "stop" });
    expect(stopped.game?.chain).toBeNull();
    expect(stopped.game?.current).not.toBe(game.current);
    expect(stopped.game?.turn).toBe(game.turn + 1);
  });

  it("rewinds a finished chain to the start of that turn", () => {
    const mid = hopTwice();
    const game = mid.game as GameState;
    if (game.chain === null) return;
    const stopped = matchReducer(mid, { type: "stop" });
    const back = matchReducer(stopped, { type: "undo" });
    expect(back.game?.chain).toBeNull();
    expect(back.game?.turn).toBe(game.turn);
    expect(back.game?.current).toBe(game.current);
    expect(back.game?.pieces).toEqual(
      mid.history[mid.history.length - 1].pieces,
    );
  });
});
