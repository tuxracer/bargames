import { clamp } from "@/utils/clamp";
import { smoothstep } from "@/utils/smoothstep";
import {
  BAND_SMOOTHING,
  BASS_HZ,
  FLOOR_RISE_MS,
  FLUX_FLOOR,
  FLUX_RATIO,
  FLUX_SIGMA,
  GATE_SPAN_HIGH,
  GATE_SPAN_LOW,
  HIGH_HZ,
  HISTORY_FRAMES,
  LEVEL_SMOOTHING,
  MID_HZ,
  ONSET_FLOOR,
  ONSET_STEP,
  ONSET_SIGMA,
  PEAK_RELEASE_MS,
  PUNCH_MS,
  REFRACTORY_MS,
  SENSITIVITY_PROFILES,
  SPECTRUM_ATTACK,
  SPECTRUM_HIGH_HZ,
  SPECTRUM_LOW_HZ,
  SPECTRUM_RELEASE,
} from "./consts";
import type {
  AutoGain,
  BeatDetector,
  BeatFrame,
  Sensitivity,
  SpectrumBands,
} from "./types";

export * from "./consts";
export * from "./types";

export const createBeatFrame = (): BeatFrame => ({
  bass: 0,
  mid: 0,
  high: 0,
  level: 0,
  beat: false,
  strength: 0,
  punch: 0,
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
 * Software auto gain. A phone microphone with its own gain control off can
 * be very quiet, or sit near the analyser's ceiling next to a speaker; in
 * either case the music should fill the range. The peak follows the signal
 * up at once and falls off slowly; the floor creeps up and drops at once.
 * A band whose swing between the two is narrow is room noise and is gated
 * toward zero rather than stretched.
 */
export const createAutoGain = (): AutoGain => {
  let peak = 0;
  let floor = 1;

  const normalize = (raw: number, dtMs: number, gate = 1): number => {
    peak = Math.max(raw, peak * Math.exp(-dtMs / PEAK_RELEASE_MS));
    floor =
      raw < floor
        ? raw
        : floor + (raw - floor) * (1 - Math.exp(-dtMs / FLOOR_RISE_MS));
    const span = peak - floor;
    const low = GATE_SPAN_LOW * gate;
    const high = GATE_SPAN_HIGH * gate;
    const open = smoothstep((span - low) / (high - low));
    return clamp(((raw - floor) / Math.max(span, 0.001)) * open, 0, 1);
  };

  const reset = () => {
    peak = 0;
    floor = 1;
  };

  return { normalize, reset };
};

/** A rolling window of a signal with its mean and standard deviation. */
const createHistory = (length: number) => {
  const values = new Float32Array(length);
  let filled = 0;
  let cursor = 0;
  let mean = 0;
  let deviation = 0;

  /** Compare `value` against what came before, then record it. */
  const push = (value: number) => {
    let total = 0;
    for (let i = 0; i < filled; i += 1) total += values[i];
    mean = filled > 0 ? total / filled : 0;
    let variance = 0;
    for (let i = 0; i < filled; i += 1) {
      const delta = values[i] - mean;
      variance += delta * delta;
    }
    deviation = filled > 1 ? Math.sqrt(variance / filled) : 0;
    values[cursor] = value;
    cursor = (cursor + 1) % length;
    if (filled < length) filled += 1;
  };

  const reset = () => {
    values.fill(0);
    filled = 0;
    cursor = 0;
    mean = 0;
    deviation = 0;
  };

  return {
    push,
    reset,
    ready: () => filled >= length / 2,
    mean: () => mean,
    deviation: () => deviation,
  };
};

/**
 * An onset detector in the classic energy-vs-history style: a beat is a
 * frame whose bass energy jumps well above its recent average, or whose
 * spectral flux (how much of the spectrum just got louder, which catches
 * snares and stabs when the bass is a steady drone) does. A short
 * refractory period makes one kick one beat. `sampleRate` and `fftSize`
 * describe the analyser that produces the spectra.
 */
export const createBeatDetector = (
  sampleRate: number,
  fftSize: number,
): BeatDetector => {
  const binHz = sampleRate / fftSize;
  const frame = createBeatFrame();
  const bassHistory = createHistory(HISTORY_FRAMES);
  const fluxHistory = createHistory(HISTORY_FRAMES);
  const previous = new Uint8Array(fftSize / 2);
  const gains = {
    bass: createAutoGain(),
    mid: createAutoGain(),
    high: createAutoGain(),
    level: createAutoGain(),
  };
  let lastBeatMs = -Infinity;
  let lastMs: number | null = null;
  let profile = SENSITIVITY_PROFILES.medium;

  const setSensitivity = (level: Sensitivity) => {
    profile = SENSITIVITY_PROFILES[level];
  };

  const reset = () => {
    bassHistory.reset();
    fluxHistory.reset();
    previous.fill(0);
    for (const gain of Object.values(gains)) gain.reset();
    lastBeatMs = -Infinity;
    lastMs = null;
    Object.assign(frame, createBeatFrame());
  };

  /** Fraction of the spectrum that got louder since the last frame. */
  const spectralFlux = (spectrum: Uint8Array): number => {
    const bins = Math.min(spectrum.length, previous.length);
    let rise = 0;
    for (let bin = 0; bin < bins; bin += 1) {
      const delta = spectrum[bin] - previous[bin];
      if (delta > 0) rise += delta;
      previous[bin] = spectrum[bin];
    }
    return rise / (bins * 255);
  };

  const update = (spectrum: Uint8Array, nowMs: number): BeatFrame => {
    const dtMs = lastMs === null ? 1_000 / 60 : Math.max(0, nowMs - lastMs);
    lastMs = nowMs;

    const bass = bandEnergy(spectrum, binHz, BASS_HZ);
    const mid = bandEnergy(spectrum, binHz, MID_HZ);
    const high = bandEnergy(spectrum, binHz, HIGH_HZ);
    const loudness = (bass + mid + high) / 3;
    const flux = spectralFlux(spectrum);

    const smooth = (prior: number, next: number, keep: number) =>
      prior * keep + next * (1 - keep);
    const { gate, onset } = profile;
    frame.bass = smooth(
      frame.bass,
      gains.bass.normalize(bass, dtMs, gate),
      BAND_SMOOTHING,
    );
    frame.mid = smooth(
      frame.mid,
      gains.mid.normalize(mid, dtMs, gate),
      BAND_SMOOTHING,
    );
    frame.high = smooth(
      frame.high,
      gains.high.normalize(high, dtMs, gate),
      BAND_SMOOTHING,
    );
    frame.level = smooth(
      frame.level,
      gains.level.normalize(loudness, dtMs, gate),
      LEVEL_SMOOTHING,
    );

    // Compare the raw signals against their histories, then record them.
    bassHistory.push(bass);
    fluxHistory.push(flux);

    const kick =
      bass >= ONSET_FLOOR &&
      bass > bassHistory.mean() + ONSET_STEP * onset &&
      bass > bassHistory.mean() + ONSET_SIGMA * onset * bassHistory.deviation();
    const stab =
      flux >= FLUX_FLOOR * onset &&
      flux > fluxHistory.mean() * (1 + (FLUX_RATIO - 1) * onset) &&
      flux > fluxHistory.mean() + FLUX_SIGMA * onset * fluxHistory.deviation();
    const ready = bassHistory.ready();
    const rested = nowMs - lastBeatMs >= REFRACTORY_MS;

    frame.punch *= Math.exp(-dtMs / PUNCH_MS);
    if (ready && rested && (kick || stab)) {
      lastBeatMs = nowMs;
      frame.beat = true;
      const kickStrength = kick
        ? (bass - bassHistory.mean()) / Math.max(bassHistory.mean(), 0.05)
        : 0;
      const stabStrength = stab
        ? (flux - fluxHistory.mean()) / Math.max(fluxHistory.mean() * 3, 0.03)
        : 0;
      frame.strength = clamp(Math.max(kickStrength, stabStrength), 0, 1);
      frame.punch = Math.max(frame.punch, 0.6 + 0.4 * frame.strength);
    } else {
      frame.beat = false;
      frame.strength = 0;
    }
    return frame;
  };

  return { update, frame, setSensitivity, reset };
};

/**
 * The spectrum folded into `count` log-spaced bands between
 * `SPECTRUM_LOW_HZ` and `SPECTRUM_HIGH_HZ`, each auto-gained and smoothed
 * with a fast attack and a slow release, the way an equalizer display
 * falls. Made for the neon rim, which wears it as a ring.
 */
export const createSpectrumBands = (
  sampleRate: number,
  fftSize: number,
  count: number,
): SpectrumBands => {
  const binHz = sampleRate / fftSize;
  const levels = new Float32Array(count);
  const gains: AutoGain[] = [];
  const firstBin = new Int32Array(count);
  const lastBin = new Int32Array(count);
  const ratio = SPECTRUM_HIGH_HZ / SPECTRUM_LOW_HZ;
  for (let band = 0; band < count; band += 1) {
    const low = SPECTRUM_LOW_HZ * ratio ** (band / count);
    const high = SPECTRUM_LOW_HZ * ratio ** ((band + 1) / count);
    firstBin[band] = Math.max(0, Math.floor(low / binHz));
    lastBin[band] = Math.max(firstBin[band], Math.ceil(high / binHz) - 1);
    gains.push(createAutoGain());
  }

  let gate = SENSITIVITY_PROFILES.medium.gate;

  const setSensitivity = (level: Sensitivity) => {
    gate = SENSITIVITY_PROFILES[level].gate;
  };

  const update = (spectrum: Uint8Array, dtMs: number): Float32Array => {
    for (let band = 0; band < count; band += 1) {
      const first = firstBin[band];
      const last = Math.min(lastBin[band], spectrum.length - 1);
      let total = 0;
      for (let bin = first; bin <= last; bin += 1) total += spectrum[bin];
      const raw = last >= first ? total / ((last - first + 1) * 255) : 0;
      const target = gains[band].normalize(raw, dtMs, gate);
      const keep = target > levels[band] ? SPECTRUM_ATTACK : SPECTRUM_RELEASE;
      levels[band] = levels[band] * keep + target * (1 - keep);
    }
    return levels;
  };

  const reset = () => {
    levels.fill(0);
    for (const gain of gains) gain.reset();
  };

  return { update, levels, setSensitivity, reset };
};
