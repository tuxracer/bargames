import { MAX_WAVES, WAVE_LIFE_MS, WAVE_SPEED, WAVE_WIDTH } from "./consts";
import type { Cascade, Wave } from "./types";

export * from "./consts";
export * from "./types";

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
      if (age < 0 || age > WAVE_LIFE_MS) continue;
      const front = age * WAVE_SPEED;
      const distance = Math.hypot(x - wave.x, y - wave.y);
      const offset = (distance - front) / WAVE_WIDTH;
      const band = Math.exp(-offset * offset * 4);
      const fade = 1 - age / WAVE_LIFE_MS;
      glow += wave.strength * band * fade;
    }
    return glow;
  };

  const prune = (nowMs: number) => {
    for (const wave of waves) {
      if (wave.active && nowMs - wave.startMs > WAVE_LIFE_MS) {
        wave.active = false;
      }
    }
  };

  const active = () => waves.filter((wave) => wave.active).length;

  return { trigger, glowAt, prune, active };
};
