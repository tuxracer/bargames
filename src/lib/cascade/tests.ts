import { describe, expect, it } from "vitest";
import { createCascade, WAVE_LIFE_MS, WAVE_SPEED } from ".";

describe("createCascade", () => {
  it("is dark with no waves and bright at a fresh wave's origin", () => {
    const cascade = createCascade();
    expect(cascade.glowAt(0, 0, 0)).toBe(0);
    cascade.trigger(0, 0, 1, 1_000);
    expect(cascade.glowAt(0, 0, 1_000)).toBeCloseTo(1);
    expect(cascade.glowAt(6, 0, 1_000)).toBeLessThan(0.01);
  });

  it("sweeps outward: a far marble lights up later than a near one", () => {
    const cascade = createCascade();
    cascade.trigger(0, 0, 1, 0);
    const peakTime = (distance: number) => {
      let best = 0;
      let bestGlow = -1;
      for (let t = 0; t <= WAVE_LIFE_MS; t += 5) {
        const glow = cascade.glowAt(distance, 0, t);
        if (glow > bestGlow) {
          bestGlow = glow;
          best = t;
        }
      }
      return best;
    };
    const near = peakTime(2);
    const far = peakTime(6);
    expect(far).toBeGreaterThan(near);
    expect(far - near).toBeCloseTo(4 / WAVE_SPEED, -2);
  });

  it("fades out and is pruned after its life", () => {
    const cascade = createCascade();
    cascade.trigger(0, 0, 1, 0);
    expect(cascade.active()).toBe(1);
    expect(cascade.glowAt(0, 0, WAVE_LIFE_MS + 1)).toBe(0);
    cascade.prune(WAVE_LIFE_MS + 1);
    expect(cascade.active()).toBe(0);
  });

  it("recycles the oldest wave when the pool is full", () => {
    const cascade = createCascade(2);
    cascade.trigger(0, 0, 1, 0);
    cascade.trigger(5, 0, 1, 100);
    cascade.trigger(-5, 0, 1, 200);
    expect(cascade.active()).toBe(2);
    expect(cascade.glowAt(0, 0, 200)).toBeLessThan(0.5);
    expect(cascade.glowAt(-5, 0, 200)).toBeCloseTo(1);
  });
});
