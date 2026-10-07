import type { Zone } from "@/lib/board";
import type { PlayerCount } from "./types";

/**
 * Where each seat sits for a given table size, in turn order. The first seat
 * is always S, the bottom of a portrait screen, so the player holding the
 * phone pushes their marbles away from themselves.
 */
export const SEAT_LAYOUTS: Readonly<Record<PlayerCount, readonly Zone[]>> = {
  2: ["S", "N"],
  3: ["S", "NW", "NE"],
  4: ["S", "SW", "N", "NE"],
  6: ["S", "SW", "NW", "N", "NE", "SE"],
};
