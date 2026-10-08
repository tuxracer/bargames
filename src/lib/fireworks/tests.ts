import { describe, expect, it } from "vitest";
import {
  APEX_MIN,
  createFireworks,
  RISE_MS,
  RISE_RANGE_MS,
  SPARK_LIFE_MS,
} from ".";

/** A fixed sequence so a test sees the same show every run. */
const seeded = (seed = 1) => {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
};

const RED = [1, 0.2, 0.1] as const;
const shot = (strength = 1, x = 0, z = 0) => ({ x, z, color: RED, strength });

/** Run the show frame by frame from `from` to `to`. */
const run = (
  show: ReturnType<typeof createFireworks>,
  from: number,
  to: number,
  stepMs = 16,
) => {
  for (let t = from; t <= to; t += stepMs) show.update(t);
};

describe("createFireworks", () => {
  it("rises as a lit head before it bursts, then showers sparks", () => {
    const show = createFireworks({ random: seeded() });
    expect(show.launch(shot(), 0)).toBe(true);
    expect(show.shells()).toBe(1);
    run(show, 0, 200);
    // Still climbing: a head and its trail, well under a burst's worth.
    expect(show.count()).toBeGreaterThan(0);
    expect(show.count()).toBeLessThan(60);
    const head = show.positions[1];
    expect(head).toBeGreaterThan(0);
    expect(head).toBeLessThan(APEX_MIN);
    run(show, 216, RISE_MS + RISE_RANGE_MS + 40);
    expect(show.shells()).toBe(0);
    expect(show.count()).toBeGreaterThan(100);
    expect(show.flash.strength).toBeGreaterThan(0);
    expect(show.flash.y).toBeGreaterThanOrEqual(APEX_MIN);
  });

  it("drops its sparks under gravity and burns them out", () => {
    const show = createFireworks({ random: seeded(7) });
    show.launch(shot(0.5, 2, -3), 0);
    const burstMs = RISE_MS + RISE_RANGE_MS + 40;
    run(show, 0, burstMs);
    const sparks = show.count();
    let heightThen = 0;
    for (let i = 0; i < sparks; i += 1) heightThen += show.positions[i * 3 + 1];
    heightThen /= sparks;
    run(show, burstMs + 16, burstMs + 800);
    const left = show.count();
    let heightNow = 0;
    for (let i = 0; i < left; i += 1) heightNow += show.positions[i * 3 + 1];
    heightNow /= left;
    expect(heightNow).toBeLessThan(heightThen);
    run(show, burstMs + 816, burstMs + SPARK_LIFE_MS.willow + 100);
    expect(show.count()).toBe(0);
  });

  it("burns white-hot first and fades toward the ember color", () => {
    const show = createFireworks({
      random: seeded(3),
      look: { whiten: 1, ember: [0, 0, 1] },
    });
    show.launch({ ...shot(), kind: "peony" }, 0);
    const burstMs = RISE_MS + RISE_RANGE_MS + 40;
    run(show, 0, burstMs);
    // Fresh from the burst: near white, so green is up from the red's 0.2.
    const freshGreen = show.colors[1];
    expect(freshGreen).toBeGreaterThan(0.6);
    run(show, burstMs + 16, burstMs + 1_200);
    // Old: dim, and leaning blue toward the ember.
    expect(show.count()).toBeGreaterThan(0);
    expect(show.colors[0]).toBeLessThan(0.8);
    expect(show.colors[2]).toBeGreaterThan(show.colors[1]);
  });

  it("refuses a launch when every shell is in the air", () => {
    const show = createFireworks({ random: seeded(), shellCapacity: 2 });
    expect(show.launch(shot(), 0)).toBe(true);
    expect(show.launch(shot(), 0)).toBe(true);
    expect(show.launch(shot(), 0)).toBe(false);
    run(show, 0, RISE_MS + RISE_RANGE_MS + 40);
    expect(show.launch(shot(), 2_000)).toBe(true);
  });

  it("never writes past its spark capacity", () => {
    const show = createFireworks({ random: seeded(), capacity: 100 });
    for (let i = 0; i < 8; i += 1) show.launch(shot(1, i), 0);
    let most = 0;
    for (let t = 0; t <= RISE_MS + RISE_RANGE_MS + 200; t += 16) {
      show.update(t);
      most = Math.max(most, show.count());
    }
    expect(most).toBeLessThanOrEqual(100);
    expect(most).toBeGreaterThan(80);
    expect(show.positions.length).toBe(300);
  });

  it("clears everything at once", () => {
    const show = createFireworks({ random: seeded() });
    show.launch(shot(), 0);
    run(show, 0, RISE_MS + RISE_RANGE_MS + 40);
    show.clear();
    expect(show.count()).toBe(0);
    expect(show.shells()).toBe(0);
    expect(show.flash.strength).toBe(0);
  });
});
