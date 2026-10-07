import {
  CUBE_DIRECTIONS,
  HOLE_COUNT,
  NEIGHBORS,
  OPPOSITE_ZONE,
  HOLES,
  ZONE_HOLES,
} from "@/lib/board";
import type { HoleIndex, Zone } from "@/lib/board";
import { SEAT_LAYOUTS } from "./consts";
import { GameError, isPlayerCount } from "./types";
import type {
  GameState,
  Move,
  Piece,
  Seat,
  SeatIndex,
  SeatKind,
} from "./types";

export * from "./consts";
export * from "./types";

export const goalZoneOf = (seat: Seat): Zone => OPPOSITE_ZONE[seat.zone];

const buildOccupancy = (pieces: readonly Piece[]): (SeatIndex | null)[] => {
  const occupancy: (SeatIndex | null)[] = new Array(HOLE_COUNT).fill(null);
  for (const piece of pieces) {
    occupancy[piece.hole] = piece.seat;
  }
  return occupancy;
};

/** Seats one marble set per kind, in the layout for that many players. */
export const createGame = (kinds: readonly SeatKind[]): GameState => {
  const count = kinds.length;
  if (!isPlayerCount(count)) {
    throw new GameError("BAD_PLAYER_COUNT");
  }
  const seats: Seat[] = SEAT_LAYOUTS[count].map((zone, index) => ({
    zone,
    kind: kinds[index],
  }));
  const pieces: Piece[] = [];
  seats.forEach((seat, seatIndex) => {
    for (const hole of ZONE_HOLES[seat.zone]) {
      pieces.push({ id: pieces.length, seat: seatIndex, hole });
    }
  });
  return {
    seats,
    pieces,
    occupancy: buildOccupancy(pieces),
    current: 0,
    winner: null,
    lastMove: null,
    turn: 0,
  };
};

/**
 * A marble may pass through any hole but may only come to rest in the open
 * hexagon, its own home tip, or its goal tip. The other four tips belong to
 * other seats (or to nobody), and parking there would only clog the board.
 */
export const canRest = (seat: Seat, hole: HoleIndex): boolean => {
  const zone = HOLES[hole].zone;
  return zone === null || zone === seat.zone || zone === goalZoneOf(seat);
};

export const pieceById = (state: GameState, pieceId: number): Piece => {
  const piece = state.pieces[pieceId];
  if (piece === undefined || piece.id !== pieceId) {
    throw new GameError("UNKNOWN_PIECE");
  }
  return piece;
};

/**
 * Every legal move for one marble: single steps to an adjacent empty hole,
 * and chains of hops over any marble into the empty hole directly beyond.
 * Each destination is reported once, by its shortest hop chain.
 */
export const legalMovesFor = (state: GameState, pieceId: number): Move[] => {
  const piece = pieceById(state, pieceId);
  const seat = state.seats[piece.seat];
  const { occupancy } = state;
  const from = piece.hole;
  const moves: Move[] = [];

  for (let direction = 0; direction < CUBE_DIRECTIONS.length; direction += 1) {
    const next = NEIGHBORS[from][direction];
    if (next !== -1 && occupancy[next] === null && canRest(seat, next)) {
      moves.push({ piece: pieceId, path: [from, next] });
    }
  }

  // Breadth-first over hop landings. The origin counts as empty: the marble
  // has left it, so it can neither be hopped over nor landed on again.
  const parent = new Map<HoleIndex, HoleIndex>([[from, -1]]);
  const queue: HoleIndex[] = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const here = queue[head];
    for (
      let direction = 0;
      direction < CUBE_DIRECTIONS.length;
      direction += 1
    ) {
      const over = NEIGHBORS[here][direction];
      if (over === -1 || over === from || occupancy[over] === null) continue;
      const landing = NEIGHBORS[over][direction];
      if (landing === -1 || occupancy[landing] !== null) continue;
      if (parent.has(landing)) continue;
      parent.set(landing, here);
      queue.push(landing);
    }
  }

  for (const landing of queue) {
    if (landing === from || !canRest(seat, landing)) continue;
    const path: HoleIndex[] = [];
    for (let hole = landing; hole !== -1; hole = parent.get(hole) ?? -1) {
      path.push(hole);
    }
    path.reverse();
    moves.push({ piece: pieceId, path });
  }

  return moves;
};

export const legalMovesForSeat = (
  state: GameState,
  seat: SeatIndex,
): Move[] => {
  const moves: Move[] = [];
  for (const piece of state.pieces) {
    if (piece.seat !== seat) continue;
    moves.push(...legalMovesFor(state, piece.id));
  }
  return moves;
};

export const hasWon = (state: GameState, seat: SeatIndex): boolean => {
  const goal = goalZoneOf(state.seats[seat]);
  return state.pieces.every(
    (piece) => piece.seat !== seat || HOLES[piece.hole].zone === goal,
  );
};

const destinationOf = (move: Move): HoleIndex =>
  move.path[move.path.length - 1];

/** The seat after `seat` with at least one legal move, or null if none. */
const nextSeatWithMoves = (
  state: GameState,
  seat: SeatIndex,
): SeatIndex | null => {
  const count = state.seats.length;
  for (let offset = 1; offset <= count; offset += 1) {
    const candidate = (seat + offset) % count;
    if (legalMovesForSeat(state, candidate).length > 0) {
      return candidate;
    }
  }
  return null;
};

/**
 * Plays a move for the seat whose turn it is. The move is matched to a legal
 * move by its destination, so callers may hand back a move they were given
 * or just the start and end of a drag.
 */
export const applyMove = (state: GameState, move: Move): GameState => {
  if (state.winner !== null) {
    throw new GameError("GAME_OVER");
  }
  const piece = pieceById(state, move.piece);
  if (piece.seat !== state.current) {
    throw new GameError("NOT_YOUR_TURN");
  }
  const destination = destinationOf(move);
  const legal = legalMovesFor(state, move.piece).find(
    (candidate) => destinationOf(candidate) === destination,
  );
  if (legal === undefined) {
    throw new GameError("ILLEGAL_MOVE");
  }

  const pieces = state.pieces.map((candidate) =>
    candidate.id === piece.id ? { ...candidate, hole: destination } : candidate,
  );
  const occupancy = state.occupancy.slice();
  occupancy[piece.hole] = null;
  occupancy[destination] = piece.seat;

  const moved: GameState = {
    ...state,
    pieces,
    occupancy,
    lastMove: legal,
    turn: state.turn + 1,
  };
  if (hasWon(moved, state.current)) {
    return { ...moved, winner: state.current };
  }
  const next = nextSeatWithMoves(moved, state.current);
  return { ...moved, current: next ?? state.current };
};
