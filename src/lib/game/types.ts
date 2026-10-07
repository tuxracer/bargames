import { isNumber, isString } from "remeda";
import type { HoleIndex, Zone } from "@/lib/board";

export type SeatKind = "human" | "computer";

const SEAT_KINDS: readonly SeatKind[] = ["human", "computer"];

export const isSeatKind = (value: unknown): value is SeatKind => {
  return isString(value) && SEAT_KINDS.includes(value as SeatKind);
};

export type PlayerCount = 2 | 3 | 4 | 6;

const PLAYER_COUNTS: readonly PlayerCount[] = [2, 3, 4, 6];

export const isPlayerCount = (value: unknown): value is PlayerCount => {
  return isNumber(value) && PLAYER_COUNTS.includes(value as PlayerCount);
};

/** Index into GameState.seats. */
export type SeatIndex = number;

export type Seat = {
  /** The tip the seat starts in; its goal is the opposite tip. */
  readonly zone: Zone;
  readonly kind: SeatKind;
};

export type Piece = {
  readonly id: number;
  readonly seat: SeatIndex;
  readonly hole: HoleIndex;
};

/**
 * A move is the full path a marble travels: path[0] is where it starts, the
 * last entry where it lands, and anything between is a hop's landing spot.
 */
export type Move = {
  readonly piece: number;
  readonly path: readonly HoleIndex[];
};

export type GameState = {
  readonly seats: readonly Seat[];
  readonly pieces: readonly Piece[];
  /** Which seat owns the marble in each hole, or null when empty. */
  readonly occupancy: readonly (SeatIndex | null)[];
  readonly current: SeatIndex;
  readonly winner: SeatIndex | null;
  readonly lastMove: Move | null;
  /** Completed moves so far; the HUD's clock. */
  readonly turn: number;
};

export type GameErrorCode =
  | "BAD_PLAYER_COUNT"
  | "UNKNOWN_PIECE"
  | "NOT_YOUR_TURN"
  | "ILLEGAL_MOVE"
  | "GAME_OVER";

export class GameError extends Error {
  readonly code: GameErrorCode;
  constructor(code: GameErrorCode) {
    super(code);
    this.name = "GameError";
    this.code = code;
  }
}

export const isGameError = (error: unknown): error is GameError => {
  return error instanceof GameError;
};
