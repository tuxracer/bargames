import {
  BAND_SMOOTHING,
  BASS_HZ,
  HIGH_HZ,
  HISTORY_FRAMES,
  LEVEL_SMOOTHING,
  MID_HZ,
  ONSET_FLOOR,
  ONSET_RATIO,
  ONSET_SIGMA,
  REFRACTORY_MS,
} from "./consts";
import type { BeatDetector, BeatFrame } from "./types";

export * from "./consts";
export * from "./types";

export const createBeatFrame = (): BeatFrame => ({
  bass: 0,
  mid: 0,
  high: 0,
  level: 0,
  beat: false,
  strength: 0,
});

/** Mean magnitude (0..1) over the bins covering a frequency band. */
const bandEnergy = (
  spectrum: Uint8Array,
  binHz: number,
  band: readonly [number, number],
): number => {
  const first = Math.max(0, Math.floor(band[0] / binHz));
  const last = Math.min(spectrum.length - 1, Math.ceil(band[1] / binHz));
  if (last < first) return 0;
  let total = 0;
  for (let bin = first; bin <= last; bin += 1) total += spectrum[bin];
  return total / ((last - first + 1) * 255);
};

/**
 * A bass-onset beat detector in the classic energy-vs-history style: a beat
 * is a frame whose bass energy jumps well above its recent average, with a
 * short refractory period so one kick is one beat. `sampleRate` and
 * `fftSize` describe the analyser that produces the spectra.
 */
export const createBeatDetector = (
  sampleRate: number,
  fftSize: number,
): BeatDetector => {
  const binHz = sampleRate / fftSize;
  const frame = createBeatFrame();
  const history = new Float32Array(HISTORY_FRAMES);
  let filled = 0;
  let cursor = 0;
  let lastBeatMs = -Infinity;

  const reset = () => {
    history.fill(0);
    filled = 0;
    cursor = 0;
    lastBeatMs = -Infinity;
    Object.assign(frame, createBeatFrame());
  };

  const update = (spectrum: Uint8Array, nowMs: number): BeatFrame => {
    const bass = bandEnergy(spectrum, binHz, BASS_HZ);
    const mid = bandEnergy(spectrum, binHz, MID_HZ);
    const high = bandEnergy(spectrum, binHz, HIGH_HZ);
    frame.bass = frame.bass * BAND_SMOOTHING + bass * (1 - BAND_SMOOTHING);
    frame.mid = frame.mid * BAND_SMOOTHING + mid * (1 - BAND_SMOOTHING);
    frame.high = frame.high * BAND_SMOOTHING + high * (1 - BAND_SMOOTHING);
    const loudness = (bass + mid + high) / 3;
    frame.level =
      frame.level * LEVEL_SMOOTHING + loudness * (1 - LEVEL_SMOOTHING);

    // Compare the raw bass against the history, then record it.
    let mean = 0;
    for (let i = 0; i < filled; i += 1) mean += history[i];
    mean = filled > 0 ? mean / filled : 0;
    let variance = 0;
    for (let i = 0; i < filled; i += 1) {
      const delta = history[i] - mean;
      variance += delta * delta;
    }
    const deviation = filled > 1 ? Math.sqrt(variance / filled) : 0;
    history[cursor] = bass;
    cursor = (cursor + 1) % HISTORY_FRAMES;
    if (filled < HISTORY_FRAMES) filled += 1;

    const ready = filled >= HISTORY_FRAMES / 2;
    const loudEnough = bass >= ONSET_FLOOR && bass > mean * ONSET_RATIO;
    const spiky = bass > mean + ONSET_SIGMA * deviation;
    const rested = nowMs - lastBeatMs >= REFRACTORY_MS;
    if (ready && loudEnough && spiky && rested) {
      lastBeatMs = nowMs;
      frame.beat = true;
      frame.strength = Math.min(1, (bass - mean) / Math.max(mean, 0.05));
    } else {
      frame.beat = false;
      frame.strength = 0;
    }
    return frame;
  };

  return { update, frame, reset };
};
