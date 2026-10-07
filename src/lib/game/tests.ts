import { describe, expect, it } from "vitest";
import { holeAt, HOLES, NEIGHBORS, ZONE_APEX, ZONE_HOLES } from "@/lib/board";
import type { HoleIndex } from "@/lib/board";
import {
  applyMove,
  canRest,
  createGame,
  GameError,
  hasWon,
  isGameError,
  legalMovesFor,
  legalMovesForSeat,
} from ".";
import type { GameState, Move } from "./types";

const destination = (move: Move): HoleIndex => move.path[move.path.length - 1];

/** A game with marbles placed by hand, for testing rules in isolation. */
const customGame = (
  placements: readonly { seat: number; holes: readonly HoleIndex[] }[],
  seats = 2,
): GameState => {
  const base = createGame(
    seats === 2 ? ["human", "human"] : ["human", "human", "human"],
  );
  const pieces = placements.flatMap(({ seat, holes }) =>
    holes.map((hole) => ({ id: 0, seat, hole })),
  );
  const numbered = pieces.map((piece, id) => ({ ...piece, id }));
  const occupancy: (number | null)[] = new Array(HOLES.length).fill(null);
  for (const piece of numbered) occupancy[piece.hole] = piece.seat;
  return { ...base, pieces: numbered, occupancy };
};

describe("createGame", () => {
  it("seats two players at opposite tips with ten marbles each", () => {
    const game = createGame(["human", "computer"]);
    expect(game.seats.map((seat) => seat.zone)).toEqual(["S", "N"]);
    expect(game.pieces).toHaveLength(20);
    for (const hole of ZONE_HOLES.S) expect(game.occupancy[hole]).toBe(0);
    for (const hole of ZONE_HOLES.N) expect(game.occupancy[hole]).toBe(1);
    expect(game.current).toBe(0);
    expect(game.winner).toBeNull();
  });

  it("supports three, four and six players and rejects other counts", () => {
    expect(createGame(new Array(3).fill("human")).pieces).toHaveLength(30);
    expect(createGame(new Array(6).fill("human")).pieces).toHaveLength(60);
    expect(() => createGame(["human"])).toThrow(GameError);
    try {
      createGame(new Array(5).fill("human"));
    } catch (error) {
      expect(isGameError(error) && error.code).toBe("BAD_PLAYER_COUNT");
    }
  });
});

describe("legalMovesFor", () => {
  it("lets a lone marble step into any adjacent empty hole", () => {
    const center = holeAt({ x: 0, y: 0, z: 0 });
    const game = customGame([{ seat: 0, holes: [center] }]);
    const moves = legalMovesFor(game, 0);
    expect(moves).toHaveLength(6);
    for (const move of moves) {
      expect(move.path).toHaveLength(2);
      expect(NEIGHBORS[center]).toContain(destination(move));
    }
  });

  it("hops over an adjacent marble of any color into the hole beyond", () => {
    const from = holeAt({ x: 0, y: 0, z: 0 });
    const over = holeAt({ x: 1, y: -1, z: 0 });
    const beyond = holeAt({ x: 2, y: -2, z: 0 });
    const game = customGame([
      { seat: 0, holes: [from] },
      { seat: 1, holes: [over] },
    ]);
    const hop = legalMovesFor(game, 0).find(
      (move) => destination(move) === beyond,
    );
    expect(hop?.path).toEqual([from, beyond]);
  });

  it("chains hops and reports each landing by its shortest path", () => {
    const from = holeAt({ x: 0, y: 0, z: 0 });
    const first = holeAt({ x: 1, y: -1, z: 0 });
    const second = holeAt({ x: 3, y: -3, z: 0 });
    const far = holeAt({ x: 4, y: -4, z: 0 });
    const game = customGame([
      { seat: 0, holes: [from] },
      { seat: 1, holes: [first, second] },
    ]);
    const chain = legalMovesFor(game, 0).find(
      (move) => destination(move) === far,
    );
    expect(chain?.path).toEqual([from, holeAt({ x: 2, y: -2, z: 0 }), far]);
  });

  it("never lands on an occupied hole and never hops a gap", () => {
    const from = holeAt({ x: 0, y: 0, z: 0 });
    const blocked = holeAt({ x: 1, y: -1, z: 0 });
    const beyondBlocked = holeAt({ x: 2, y: -2, z: 0 });
    const gapLanding = holeAt({ x: -2, y: 2, z: 0 });
    const game = customGame([
      { seat: 0, holes: [from] },
      { seat: 1, holes: [blocked, beyondBlocked] },
    ]);
    const landings = legalMovesFor(game, 0).map(destination);
    expect(landings).not.toContain(blocked);
    expect(landings).not.toContain(beyondBlocked);
    expect(landings).not.toContain(gapLanding);
  });

  it("does not hop back over its own starting hole", () => {
    // Marble at A, opponent at B next to it. Hopping A -> C (over B) then
    // trying to continue C -> over A is impossible: A is empty once left.
    const a = holeAt({ x: 0, y: 0, z: 0 });
    const b = holeAt({ x: 1, y: -1, z: 0 });
    const c = holeAt({ x: 2, y: -2, z: 0 });
    const game = customGame([
      { seat: 0, holes: [a] },
      { seat: 1, holes: [b] },
    ]);
    const landings = legalMovesFor(game, 0).map(destination);
    expect(landings).toContain(c);
    expect(landings).not.toContain(a);
    expect(landings).not.toContain(holeAt({ x: -2, y: 2, z: 0 }));
  });

  it("passes through another seat's tip but will not rest there", () => {
    // Seat 0 (home S, goal N) sits just inside the NE tip's edge. It may
    // step into the hexagon but not into NE.
    const neTip = holeAt({ x: 5, y: -4, z: -1 });
    const insideHex = holeAt({ x: 4, y: -4, z: 0 });
    const game = customGame([{ seat: 0, holes: [insideHex] }]);
    expect(canRest(game.seats[0], neTip)).toBe(false);
    expect(canRest(game.seats[0], insideHex)).toBe(true);
    expect(canRest(game.seats[0], holeAt(ZONE_APEX.N))).toBe(true);
    expect(canRest(game.seats[0], holeAt(ZONE_APEX.S))).toBe(true);
    const landings = legalMovesFor(game, 0).map(destination);
    expect(landings).not.toContain(neTip);
  });

  it("finds moves for a fresh opening", () => {
    const game = createGame(["human", "human"]);
    const moves = legalMovesForSeat(game, 0);
    expect(moves.length).toBeGreaterThan(0);
    // Only the front row of the tip can move at the start, and every move
    // leaves the tip heading toward the hexagon.
    for (const move of moves) {
      expect(HOLES[destination(move)].zone).not.toBe("N");
    }
  });
});

describe("applyMove", () => {
  it("moves the marble, updates occupancy and passes the turn", () => {
    const game = createGame(["human", "human"]);
    const move = legalMovesForSeat(game, 0)[0];
    const next = applyMove(game, move);
    const moved = next.pieces[move.piece];
    expect(moved.hole).toBe(destination(move));
    expect(next.occupancy[move.path[0]]).toBeNull();
    expect(next.occupancy[destination(move)]).toBe(0);
    expect(next.current).toBe(1);
    expect(next.lastMove).toEqual(move);
    expect(next.turn).toBe(1);
    expect(game.pieces[move.piece].hole).toBe(move.path[0]);
  });

  it("accepts a move described only by its start and end", () => {
    const from = holeAt({ x: 0, y: 0, z: 0 });
    const far = holeAt({ x: 4, y: -4, z: 0 });
    const game = customGame([
      { seat: 0, holes: [from] },
      {
        seat: 1,
        holes: [holeAt({ x: 1, y: -1, z: 0 }), holeAt({ x: 3, y: -3, z: 0 })],
      },
    ]);
    const next = applyMove(game, { piece: 0, path: [from, far] });
    expect(next.lastMove?.path).toHaveLength(3);
    expect(next.pieces[0].hole).toBe(far);
  });

  it("rejects moves out of turn and illegal destinations", () => {
    const game = createGame(["human", "human"]);
    const theirs = legalMovesForSeat(game, 1)[0];
    expect(() => applyMove(game, theirs)).toThrow("NOT_YOUR_TURN");
    const mine = legalMovesForSeat(game, 0)[0];
    const bogus = { ...mine, path: [mine.path[0], holeAt(ZONE_APEX.N)] };
    expect(() => applyMove(game, bogus)).toThrow("ILLEGAL_MOVE");
  });

  it("declares a winner when the goal tip is full of their marbles", () => {
    const open = holeAt({ x: 4, y: 1, z: -5 }); // N's near row, right end
    const lastStep = holeAt({ x: 4, y: 0, z: -4 }); // one step below it
    const nearlyDone = customGame([
      {
        seat: 0,
        holes: [...ZONE_HOLES.N.filter((hole) => hole !== open), lastStep],
      },
      { seat: 1, holes: [holeAt(ZONE_APEX.S)] },
    ]);
    expect(hasWon(nearlyDone, 0)).toBe(false);
    const finishing = legalMovesFor(nearlyDone, 9).find(
      (move) => destination(move) === open,
    );
    expect(finishing).toBeDefined();
    const won = applyMove(nearlyDone, finishing!);
    expect(won.winner).toBe(0);
    expect(() => applyMove(won, legalMovesForSeat(won, 1)[0])).toThrow(
      "GAME_OVER",
    );
  });

  it("skips a seat that has no legal move", () => {
    // Seat 1's single marble sits in the N apex, boxed in by seat 0.
    const apex = holeAt(ZONE_APEX.N);
    const below = NEIGHBORS[apex].filter((hole) => hole !== -1);
    const beyond = below.flatMap((hole) =>
      NEIGHBORS[hole].filter((next) => next !== -1 && next !== apex),
    );
    const mover = holeAt({ x: 0, y: 0, z: 0 });
    const game = customGame([
      { seat: 0, holes: [...new Set([...below, ...beyond, mover])] },
      { seat: 1, holes: [apex] },
    ]);
    expect(legalMovesForSeat(game, 1)).toHaveLength(0);
    const mine = legalMovesFor(game, game.pieces.length - 2)[0];
    const next = applyMove(game, { ...mine, piece: mine.piece });
    expect(next.current).toBe(0);
  });
});
