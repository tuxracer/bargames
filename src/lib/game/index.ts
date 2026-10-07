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
    chain: null,
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

type Occupancy = readonly (SeatIndex | null)[];

/**
 * The single hops available from `from`: over an adjacent marble into the
 * empty hole directly beyond. The chain's origin counts as empty (the
 * marble has left it), and holes already visited this chain are off limits.
 */
const singleHops = (
  occupancy: Occupancy,
  origin: HoleIndex,
  from: HoleIndex,
  visited: ReadonlySet<HoleIndex>,
): HoleIndex[] => {
  const landings: HoleIndex[] = [];
  for (let direction = 0; direction < CUBE_DIRECTIONS.length; direction += 1) {
    const over = NEIGHBORS[from][direction];
    if (over === -1 || over === origin || occupancy[over] === null) continue;
    const landing = NEIGHBORS[over][direction];
    if (landing === -1 || visited.has(landing)) continue;
    if (occupancy[landing] !== null && landing !== origin) continue;
    landings.push(landing);
  }
  return landings;
};

/** Breadth-first over hop landings from `start`; maps landing to parent. */
const hopTree = (
  occupancy: Occupancy,
  origin: HoleIndex,
  start: HoleIndex,
  visited: ReadonlySet<HoleIndex>,
): Map<HoleIndex, HoleIndex> => {
  const parent = new Map<HoleIndex, HoleIndex>([[start, -1]]);
  const seen = new Set(visited);
  seen.add(start);
  const queue: HoleIndex[] = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const here = queue[head];
    for (const landing of singleHops(occupancy, origin, here, seen)) {
      seen.add(landing);
      parent.set(landing, here);
      queue.push(landing);
    }
  }
  parent.delete(start);
  return parent;
};

/** Whether a marble at `hole` could still end its chain somewhere legal. */
const canFinishFrom = (
  seat: Seat,
  occupancy: Occupancy,
  origin: HoleIndex,
  hole: HoleIndex,
  visited: ReadonlySet<HoleIndex>,
): boolean => {
  if (canRest(seat, hole)) return true;
  for (const landing of hopTree(occupancy, origin, hole, visited).keys()) {
    if (canRest(seat, landing)) return true;
  }
  return false;
};

/** Adjacent empty holes a marble may step into. A step ends the turn. */
export const stepOptions = (state: GameState, pieceId: number): HoleIndex[] => {
  const piece = pieceById(state, pieceId);
  const seat = state.seats[piece.seat];
  const steps: HoleIndex[] = [];
  for (const next of NEIGHBORS[piece.hole]) {
    if (next !== -1 && state.occupancy[next] === null && canRest(seat, next)) {
      steps.push(next);
    }
  }
  return steps;
};

/**
 * Where a marble may hop next: from its chain's end if one is in progress,
 * otherwise from where it sits. Landings a marble could never finish from
 * (a foreign tip with no way out) are left off.
 */
export const hopOptions = (state: GameState, pieceId: number): HoleIndex[] => {
  const piece = pieceById(state, pieceId);
  const seat = state.seats[piece.seat];
  const chain = state.chain?.piece === pieceId ? state.chain : null;
  const origin = chain ? chain.path[0] : piece.hole;
  const visited = new Set<HoleIndex>(chain ? chain.path : [piece.hole]);
  const landings = singleHops(state.occupancy, origin, piece.hole, visited);
  return landings.filter((landing) => {
    const onward = new Set(visited);
    onward.add(landing);
    return canFinishFrom(seat, state.occupancy, origin, landing, onward);
  });
};

/**
 * Every complete move for one marble: single steps, and hop chains to each
 * reachable resting hole by its shortest path. The computer's menu.
 */
export const legalMovesFor = (state: GameState, pieceId: number): Move[] => {
  const piece = pieceById(state, pieceId);
  const seat = state.seats[piece.seat];
  const from = piece.hole;
  const moves: Move[] = stepOptions(state, pieceId).map((next) => ({
    piece: pieceId,
    path: [from, next],
  }));
  const tree = hopTree(state.occupancy, from, from, new Set([from]));
  for (const landing of tree.keys()) {
    if (!canRest(seat, landing)) continue;
    const path: HoleIndex[] = [];
    for (let hole = landing; hole !== -1; hole = tree.get(hole) ?? -1) {
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

const relocate = (
  state: GameState,
  piece: Piece,
  hole: HoleIndex,
): Pick<GameState, "pieces" | "occupancy"> => {
  const pieces = state.pieces.map((candidate) =>
    candidate.id === piece.id ? { ...candidate, hole } : candidate,
  );
  const occupancy = state.occupancy.slice();
  occupancy[piece.hole] = null;
  occupancy[hole] = piece.seat;
  return { pieces, occupancy };
};

const finishTurn = (state: GameState): GameState => {
  const done: GameState = { ...state, chain: null, turn: state.turn + 1 };
  if (hasWon(done, state.current)) {
    return { ...done, winner: state.current };
  }
  const next = nextSeatWithMoves(done, state.current);
  return { ...done, current: next ?? state.current };
};

const assertMayAct = (state: GameState, piece: Piece) => {
  if (state.winner !== null) throw new GameError("GAME_OVER");
  if (piece.seat !== state.current) throw new GameError("NOT_YOUR_TURN");
};

/** Step one marble into an adjacent hole. The turn ends at once. */
export const applyStep = (
  state: GameState,
  pieceId: number,
  hole: HoleIndex,
): GameState => {
  const piece = pieceById(state, pieceId);
  assertMayAct(state, piece);
  if (state.chain !== null || !stepOptions(state, pieceId).includes(hole)) {
    throw new GameError("ILLEGAL_MOVE");
  }
  return finishTurn({
    ...state,
    ...relocate(state, piece, hole),
    lastMove: { piece: pieceId, path: [piece.hole, hole] },
  });
};

/**
 * Hop one marble over a neighbor. The chain stays open for another hop,
 * unless none is possible, in which case the turn ends where it landed.
 */
export const applyHop = (
  state: GameState,
  pieceId: number,
  hole: HoleIndex,
): GameState => {
  const piece = pieceById(state, pieceId);
  assertMayAct(state, piece);
  if (state.chain !== null && state.chain.piece !== pieceId) {
    throw new GameError("ILLEGAL_MOVE");
  }
  if (!hopOptions(state, pieceId).includes(hole)) {
    throw new GameError("ILLEGAL_MOVE");
  }
  const path = [...(state.chain?.path ?? [piece.hole]), hole];
  const chain = { piece: pieceId, path };
  const landed: GameState = {
    ...state,
    ...relocate(state, piece, hole),
    chain,
    lastMove: chain,
  };
  return hopOptions(landed, pieceId).length === 0 ? finishTurn(landed) : landed;
};

/** End the chain in progress where the marble sits, if it may rest there. */
export const endChain = (state: GameState): GameState => {
  if (state.winner !== null) throw new GameError("GAME_OVER");
  if (state.chain === null) throw new GameError("NO_CHAIN");
  const piece = pieceById(state, state.chain.piece);
  if (!canRest(state.seats[piece.seat], piece.hole)) {
    throw new GameError("ILLEGAL_MOVE");
  }
  return finishTurn(state);
};

/** Whether the chain in progress may stop where its marble now sits. */
export const canStop = (state: GameState): boolean => {
  if (state.chain === null || state.winner !== null) return false;
  const piece = pieceById(state, state.chain.piece);
  return canRest(state.seats[piece.seat], piece.hole);
};

/**
 * Plays a whole move at once: a single step, or every hop of a chain and
 * then the stop. The path must be exactly what the marble travels.
 */
export const applyMove = (state: GameState, move: Move): GameState => {
  const { piece, path } = move;
  if (path.length < 2) throw new GameError("ILLEGAL_MOVE");
  if (state.chain !== null) throw new GameError("ILLEGAL_MOVE");
  const from = path[0];
  if (pieceById(state, piece).hole !== from) {
    throw new GameError("ILLEGAL_MOVE");
  }
  if (path.length === 2 && NEIGHBORS[from].includes(path[1])) {
    return applyStep(state, piece, path[1]);
  }
  let next = state;
  for (let leg = 1; leg < path.length; leg += 1) {
    if (next.chain === null && leg > 1) throw new GameError("ILLEGAL_MOVE");
    next = applyHop(next, piece, path[leg]);
  }
  return next.chain === null ? next : endChain(next);
};
