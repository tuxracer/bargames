import type { Cube, Zone } from "./types";

/** The central hexagon reaches this far from the center (side length 5). */
export const HEX_RADIUS = 4;

/** Each tip adds this many rows beyond the hexagon. */
export const TIP_DEPTH = 4;

/** Holes on a standard board: a 61-hole hexagon plus six 10-hole tips. */
export const HOLE_COUNT = 121;

/** Marbles each player starts with; also the size of every tip. */
export const PIECES_PER_PLAYER = 10;

/** The six lattice directions, counterclockwise from +x. */
export const CUBE_DIRECTIONS: readonly Cube[] = [
  { x: 1, y: -1, z: 0 },
  { x: 1, y: 0, z: -1 },
  { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 },
  { x: -1, y: 0, z: 1 },
  { x: 0, y: -1, z: 1 },
];

/** Tips in clockwise order as seen on screen, starting from the top. */
export const ZONES: readonly Zone[] = ["N", "NE", "SE", "S", "SW", "NW"];

export const OPPOSITE_ZONE: Readonly<Record<Zone, Zone>> = {
  N: "S",
  S: "N",
  NE: "SW",
  SW: "NE",
  SE: "NW",
  NW: "SE",
};

/** The outermost hole of each tip; the far corner a player races toward. */
export const ZONE_APEX: Readonly<Record<Zone, Cube>> = {
  N: { x: 4, y: 4, z: -8 },
  S: { x: -4, y: -4, z: 8 },
  NE: { x: 8, y: -4, z: -4 },
  SW: { x: -8, y: 4, z: 4 },
  SE: { x: 4, y: -8, z: 4 },
  NW: { x: -4, y: 8, z: -4 },
};

/** Vertical distance between lattice rows, in hole spacings. */
export const ROW_HEIGHT = Math.sqrt(3) / 2;

/** Distance from the board center to every tip apex, in hole spacings. */
export const BOARD_RADIUS = (HEX_RADIUS + TIP_DEPTH) * ROW_HEIGHT;
