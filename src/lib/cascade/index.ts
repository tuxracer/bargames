import { MAX_WAVES, WAVE_LIFE_MS, WAVE_SPEED, WAVE_WIDTH } from "./consts";
import type { Cascade, Wave } from "./types";

export * from "./consts";
export * from "./types";

/** How much of a wave is left at `age`: full at first, gone at its life. */
const fadeAt = (ageMs: number): number => {
  const t = ageMs / WAVE_LIFE_MS;
  if (t < 0 || t > 1) return 0;
  return 1 - t * t;
};

/**
 * A pool of expanding light rings. Each beat drops a wave at a point; the
 * glow at any marble is how close a wave front is passing it, so the light
 * visibly cascades outward through the pieces. Allocation-free after setup.
 */
export const createCascade = (maxWaves = MAX_WAVES): Cascade => {
  const waves: Wave[] = [];
  for (let i = 0; i < maxWaves; i += 1) {
    waves.push({ x: 0, y: 0, startMs: 0, strength: 0, active: false });
  }
  const frontOut = { radius: 0, strength: 0 };

  const trigger = (x: number, y: number, strength: number, nowMs: number) => {
    let slot: Wave | null = null;
    let oldest = Infinity;
    for (const wave of waves) {
      if (!wave.active) {
        slot = wave;
        break;
      }
      if (wave.startMs < oldest) {
        oldest = wave.startMs;
        slot = wave;
      }
    }
    if (!slot) return;
    slot.x = x;
    slot.y = y;
    slot.startMs = nowMs;
    slot.strength = strength;
    slot.active = true;
  };

  const glowAt = (x: number, y: number, nowMs: number): number => {
    let glow = 0;
    for (const wave of waves) {
      if (!wave.active) continue;
      const age = nowMs - wave.startMs;
      const fade = fadeAt(age);
      if (fade === 0) continue;
      const front = age * WAVE_SPEED;
      const distance = Math.hypot(x - wave.x, y - wave.y);
      const offset = (distance - front) / WAVE_WIDTH;
      const band = Math.exp(-offset * offset * 4);
      glow += wave.strength * band * fade;
    }
    return glow;
  };

  const front = (wave: Wave, nowMs: number) => {
    const age = nowMs - wave.startMs;
    frontOut.radius = age * WAVE_SPEED;
    frontOut.strength = wave.active ? wave.strength * fadeAt(age) : 0;
    return frontOut;
  };

  const prune = (nowMs: number) => {
    for (const wave of waves) {
      if (wave.active && nowMs - wave.startMs > WAVE_LIFE_MS) {
        wave.active = false;
      }
    }
  };

  const active = () => waves.filter((wave) => wave.active).length;

  return { trigger, glowAt, front, prune, active, waves };
};
