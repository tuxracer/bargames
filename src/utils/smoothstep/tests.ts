import { describe, expect, it } from "vitest";
import { smoothstep } from ".";

describe("smoothstep", () => {
  it("pins the ends and clamps outside the unit range", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(-2)).toBe(0);
    expect(smoothstep(3)).toBe(1);
  });

  it("passes through the midpoint and rises monotonically", () => {
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
    let previous = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      const value = smoothstep(t);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });
});
