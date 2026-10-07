import { isNumber, isPlainObject, isString } from "remeda";

/** Cube coordinates on the triangular lattice; x + y + z is always 0. */
export type Cube = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

/**
 * The six tips of the star, named by compass point as seen in portrait with
 * the first player seated at the bottom (S).
 */
export type Zone = "N" | "NE" | "SE" | "S" | "SW" | "NW";

/** Index into the HOLES table; the canonical way to name a hole. */
export type HoleIndex = number;

export type Hole = {
  readonly index: HoleIndex;
  readonly cube: Cube;
  /** Which tip the hole belongs to, or null for the central hexagon. */
  readonly zone: Zone | null;
  /** Board-plane position in hole spacings; +x right, +y toward S. */
  readonly px: number;
  readonly py: number;
};

const ZONE_NAMES: readonly Zone[] = ["N", "NE", "SE", "S", "SW", "NW"];

export const isZone = (value: unknown): value is Zone => {
  return isString(value) && ZONE_NAMES.includes(value as Zone);
};

export const isCube = (value: unknown): value is Cube => {
  return (
    isPlainObject(value) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.z) &&
    value.x + value.y + value.z === 0
  );
};
