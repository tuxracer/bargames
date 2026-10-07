import { describe, expect, it } from "vitest";
import { createMotionSample, motionDuration, sampleMotion } from ".";

const path = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 2 },
];

describe("sampleMotion", () => {
  it("starts at the first point on the ground and ends at the last", () => {
    const out = createMotionSample();
    sampleMotion(path, 0, out, 100);
    expect(out).toMatchObject({ x: 0, y: 0, lift: 0, leg: 0, done: false });
    sampleMotion(path, motionDuration(path.length, 100), out, 100);
    expect(out).toMatchObject({ x: 2, y: 2, lift: 0, leg: 1, done: true });
    sampleMotion(path, 10_000, out, 100);
    expect(out.done).toBe(true);
  });

  it("arcs upward in the middle of each leg and lands between legs", () => {
    const out = createMotionSample();
    sampleMotion(path, 50, out, 100, 1);
    expect(out.lift).toBeCloseTo(1);
    expect(out.x).toBeCloseTo(1);
    expect(out.leg).toBe(0);
    sampleMotion(path, 100, out, 100, 1);
    expect(out.lift).toBeCloseTo(0);
    expect(out.x).toBeCloseTo(2);
    expect(out.y).toBeCloseTo(0);
    expect(out.leg).toBe(1);
  });

  it("treats a single point as already arrived", () => {
    const out = createMotionSample();
    sampleMotion([{ x: 3, y: 4 }], 0, out);
    expect(out).toMatchObject({ x: 3, y: 4, lift: 0, done: true });
    expect(motionDuration(1)).toBe(0);
  });
});
