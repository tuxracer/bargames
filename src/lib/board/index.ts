import { CUBE_DIRECTIONS, HEX_RADIUS, ROW_HEIGHT, ZONE_APEX } from "./consts";
import type { Cube, Hole, HoleIndex, Zone } from "./types";

export * from "./consts";
export * from "./types";

/** The tip a lattice point falls in, or null inside the central hexagon. */
export const zoneOf = (cube: Cube): Zone | null => {
  if (cube.z < -HEX_RADIUS) return "N";
  if (cube.z > HEX_RADIUS) return "S";
  if (cube.x > HEX_RADIUS) return "NE";
  if (cube.x < -HEX_RADIUS) return "SW";
  if (cube.y < -HEX_RADIUS) return "SE";
  if (cube.y > HEX_RADIUS) return "NW";
  return null;
};

/**
 * The star is the union of two big triangles: one with every coordinate at
 * least -4, one with every coordinate at most 4. Their overlap is the hexagon.
 */
export const isOnBoard = (cube: Cube): boolean => {
  if (cube.x + cube.y + cube.z !== 0) return false;
  const min = Math.min(cube.x, cube.y, cube.z);
  const max = Math.max(cube.x, cube.y, cube.z);
  return min >= -HEX_RADIUS || max <= HEX_RADIUS;
};

export const cubeDistance = (a: Cube, b: Cube): number => {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.z - b.z),
  );
};

const cubeKey = (x: number, z: number) => `${x},${z}`;

const buildHoles = (): readonly Hole[] => {
  const extent = 2 * HEX_RADIUS;
  const holes: Hole[] = [];
  for (let z = -extent; z <= extent; z += 1) {
    for (let x = -extent; x <= extent; x += 1) {
      const cube = { x, y: -x - z, z };
      if (!isOnBoard(cube)) continue;
      holes.push({
        index: holes.length,
        cube,
        zone: zoneOf(cube),
        px: x + z / 2,
        py: z * ROW_HEIGHT,
      });
    }
  }
  return holes;
};

/** Every hole on the board, ordered top row to bottom, left to right. */
export const HOLES: readonly Hole[] = buildHoles();

const HOLE_BY_KEY: ReadonlyMap<string, HoleIndex> = new Map(
  HOLES.map((hole) => [cubeKey(hole.cube.x, hole.cube.z), hole.index]),
);

/** The hole at a lattice point, or -1 when the point is off the board. */
export const holeAt = (cube: Cube): HoleIndex => {
  return HOLE_BY_KEY.get(cubeKey(cube.x, cube.z)) ?? -1;
};

/** NEIGHBORS[hole][direction] is the adjacent hole, or -1 at the edge. */
export const NEIGHBORS: readonly (readonly HoleIndex[])[] = HOLES.map((hole) =>
  CUBE_DIRECTIONS.map((direction) =>
    holeAt({
      x: hole.cube.x + direction.x,
      y: hole.cube.y + direction.y,
      z: hole.cube.z + direction.z,
    }),
  ),
);

const holesInZone = (zone: Zone): readonly HoleIndex[] => {
  return HOLES.filter((hole) => hole.zone === zone).map((hole) => hole.index);
};

/** The ten holes of each tip. */
export const ZONE_HOLES: Readonly<Record<Zone, readonly HoleIndex[]>> = {
  N: holesInZone("N"),
  NE: holesInZone("NE"),
  SE: holesInZone("SE"),
  S: holesInZone("S"),
  SW: holesInZone("SW"),
  NW: holesInZone("NW"),
};

/** Lattice steps from a hole to the apex of a zone; the AI's yardstick. */
export const distanceToApex = (hole: HoleIndex, zone: Zone): number => {
  return cubeDistance(HOLES[hole].cube, ZONE_APEX[zone]);
};
