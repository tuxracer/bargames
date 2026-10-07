import { describe, expect, it } from "vitest";
import {
  BOARD_RADIUS,
  cubeDistance,
  distanceToApex,
  HOLE_COUNT,
  HOLES,
  holeAt,
  isOnBoard,
  NEIGHBORS,
  OPPOSITE_ZONE,
  PIECES_PER_PLAYER,
  ZONE_APEX,
  ZONE_HOLES,
  ZONES,
  zoneOf,
} from ".";

describe("board", () => {
  it("has the 121 holes of a standard star board", () => {
    expect(HOLES).toHaveLength(HOLE_COUNT);
    const hexagon = HOLES.filter((hole) => hole.zone === null);
    expect(hexagon).toHaveLength(61);
  });

  it("gives every tip exactly ten holes, one of which is its apex", () => {
    for (const zone of ZONES) {
      expect(ZONE_HOLES[zone]).toHaveLength(PIECES_PER_PLAYER);
      const apex = holeAt(ZONE_APEX[zone]);
      expect(ZONE_HOLES[zone]).toContain(apex);
      expect(zoneOf(ZONE_APEX[zone])).toBe(zone);
    }
  });

  it("places opposite tips on opposite sides of the center", () => {
    for (const zone of ZONES) {
      const apex = ZONE_APEX[zone];
      const opposite = ZONE_APEX[OPPOSITE_ZONE[zone]];
      expect(opposite).toEqual({ x: -apex.x, y: -apex.y, z: -apex.z });
    }
  });

  it("rejects lattice points outside the star", () => {
    expect(isOnBoard({ x: 0, y: 0, z: 0 })).toBe(true);
    expect(isOnBoard({ x: 5, y: 5, z: -10 })).toBe(false);
    expect(isOnBoard({ x: 1, y: 1, z: 1 })).toBe(false);
    expect(holeAt({ x: 9, y: -4, z: -5 })).toBe(-1);
  });

  it("links neighbors symmetrically and never across the board edge", () => {
    for (const hole of HOLES) {
      for (const neighbor of NEIGHBORS[hole.index]) {
        if (neighbor === -1) continue;
        expect(NEIGHBORS[neighbor]).toContain(hole.index);
        expect(cubeDistance(hole.cube, HOLES[neighbor].cube)).toBe(1);
      }
    }
    const apex = holeAt(ZONE_APEX.S);
    const open = NEIGHBORS[apex].filter((neighbor) => neighbor !== -1);
    expect(open).toHaveLength(2);
  });

  it("lays holes out one spacing apart so the drawn board is regular", () => {
    for (const hole of HOLES) {
      for (const neighbor of NEIGHBORS[hole.index]) {
        if (neighbor === -1) continue;
        const other = HOLES[neighbor];
        const distance = Math.hypot(other.px - hole.px, other.py - hole.py);
        expect(distance).toBeCloseTo(1);
      }
    }
    const top = HOLES[holeAt(ZONE_APEX.N)];
    expect(top.py).toBeLessThan(0);
    expect(Math.hypot(top.px, top.py)).toBeCloseTo(BOARD_RADIUS);
  });

  it("measures the race to the far corner in lattice steps", () => {
    const homeApex = holeAt(ZONE_APEX.S);
    expect(distanceToApex(homeApex, "N")).toBe(16);
    expect(distanceToApex(homeApex, "S")).toBe(0);
  });
});
