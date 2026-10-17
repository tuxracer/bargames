import { clamp } from "@/utils/clamp";
import { smoothstep } from "@/utils/smoothstep";
import {
  BASS_HZ,
  ENVELOPE_MAX_STEP_MS,
  ENVELOPE_MS,
  FLOOR_RISE_MS,
  FLUX_FLOOR,
  FLUX_RATIO,
  FLUX_SIGMA,
  GATE_SPAN_HIGH,
  GATE_SPAN_LOW,
  HIGH_HZ,
  HISTORY_FRAMES,
  KICK_STRENGTH_SCALE,
  LEVEL_SMOOTHING,
  MID_HZ,
  ONSET_FLOOR,
  ONSET_STEP,
  ONSET_SIGMA,
  PEAK_RELEASE_MS,
  PRESENCE_ATTACK_MS,
  PRESENCE_HOLD_MS,
  PRESENCE_RELEASE_MS,
  PUNCH_MS,
  REFRACTORY_MS,
  RHYTHM_ONSETS,
  RHYTHM_WINDOW_MS,
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
  presence: 0,
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

/** Exponential smoothing toward `next` with time constant `tauMs`. */
const follow = (prior: number, next: number, dtMs: number, tauMs: number) => {
  return next + (prior - next) * Math.exp(-dtMs / tauMs);
};

/**
 * Software auto gain. A phone microphone with its own gain control off can
 * be very quiet, or sit near the analyser's ceiling next to a speaker; in
 * either case the music should fill the range. The peak follows the signal
 * up at once and falls off slowly; the floor creeps up and drops at once.
 * A band whose swing between the two is narrow is not moving and fades
 * toward zero rather than being stretched. It cannot tell music from
 * noise, so callers scale the result by the detector's `presence`.
 */
export const createAutoGain = (): AutoGain => {
  let peak = 0;
  let floor = 1;

  const normalize = (raw: number, dtMs: number): number => {
    peak = Math.max(raw, peak * Math.exp(-dtMs / PEAK_RELEASE_MS));
    floor =
      raw < floor
        ? raw
        : floor + (raw - floor) * (1 - Math.exp(-dtMs / FLOOR_RISE_MS));
    const span = peak - floor;
    const open = smoothstep(
      (span - GATE_SPAN_LOW) / (GATE_SPAN_HIGH - GATE_SPAN_LOW),
    );
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
 * frame whose bass envelope jumps well above its recent average, or whose
 * spectral flux (how much of the spectrum just got louder, which catches
 * snares and stabs when the bass is a steady drone) does. A short
 * refractory period makes one kick one beat. Onsets only count as beats
 * once a few have landed in rhythm, which is also what lifts `presence`;
 * a lone bump in a quiet room moves nothing.
 * `sampleRate` and `fftSize` describe the analyser that produces the spectra.
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
  /** The smoothed bands the detector reads instead of the jittery raw ones. */
  const envelope = { bass: 0, mid: 0, high: 0, loudness: 0 };
  let lastOnsetMs = -Infinity;
  /** Onsets in a row, each within the rhythm window of the last. */
  let run = 0;
  let heardMs = -Infinity;
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
    envelope.bass = 0;
    envelope.mid = 0;
    envelope.high = 0;
    envelope.loudness = 0;
    lastOnsetMs = -Infinity;
    run = 0;
    heardMs = -Infinity;
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
    const flux = spectralFlux(spectrum);
    const stepMs = Math.min(dtMs, ENVELOPE_MAX_STEP_MS);
    envelope.bass = follow(envelope.bass, bass, stepMs, ENVELOPE_MS);
    envelope.mid = follow(envelope.mid, mid, stepMs, ENVELOPE_MS);
    envelope.high = follow(envelope.high, high, stepMs, ENVELOPE_MS);
    envelope.loudness = (envelope.bass + envelope.mid + envelope.high) / 3;

    // Compare the envelope and the flux against their histories, then
    // record them.
    bassHistory.push(envelope.bass);
    fluxHistory.push(flux);

    const { onset } = profile;
    const mean = bassHistory.mean();
    const kick =
      envelope.bass >= ONSET_FLOOR &&
      envelope.bass > mean + ONSET_STEP * onset &&
      envelope.bass > mean + ONSET_SIGMA * onset * bassHistory.deviation();
    const stab =
      flux >= FLUX_FLOOR * onset &&
      flux > fluxHistory.mean() * (1 + (FLUX_RATIO - 1) * onset) &&
      flux > fluxHistory.mean() + FLUX_SIGMA * onset * fluxHistory.deviation();
    const ready = bassHistory.ready();
    const rested = nowMs - lastOnsetMs >= REFRACTORY_MS;

    frame.punch *= Math.exp(-dtMs / PUNCH_MS);
    frame.beat = false;
    frame.strength = 0;
    if (ready && rested && (kick || stab)) {
      run = nowMs - lastOnsetMs <= RHYTHM_WINDOW_MS ? run + 1 : 1;
      lastOnsetMs = nowMs;
      const inRhythm =
        run >= RHYTHM_ONSETS || nowMs - heardMs <= PRESENCE_HOLD_MS;
      if (inRhythm) {
        heardMs = nowMs;
        frame.beat = true;
        const kickStrength = kick
          ? ((envelope.bass - mean) * KICK_STRENGTH_SCALE) /
            Math.max(mean, 0.05)
          : 0;
        const stabStrength = stab
          ? (flux - fluxHistory.mean()) / Math.max(fluxHistory.mean() * 3, 0.03)
          : 0;
        frame.strength = clamp(Math.max(kickStrength, stabStrength), 0, 1);
        frame.punch = Math.max(frame.punch, 0.6 + 0.4 * frame.strength);
      }
    }

    const present = nowMs - heardMs <= PRESENCE_HOLD_MS ? 1 : 0;
    frame.presence = follow(
      frame.presence,
      present,
      dtMs,
      present > frame.presence ? PRESENCE_ATTACK_MS : PRESENCE_RELEASE_MS,
    );
    if (frame.presence < 0.001) frame.presence = 0;

    const { presence } = frame;
    frame.bass = gains.bass.normalize(envelope.bass, dtMs) * presence;
    frame.mid = gains.mid.normalize(envelope.mid, dtMs) * presence;
    frame.high = gains.high.normalize(envelope.high, dtMs) * presence;
    frame.level =
      frame.level * LEVEL_SMOOTHING +
      gains.level.normalize(envelope.loudness, dtMs) *
        presence *
        (1 - LEVEL_SMOOTHING);
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

  const update = (
    spectrum: Uint8Array,
    dtMs: number,
    presence = 1,
  ): Float32Array => {
    for (let band = 0; band < count; band += 1) {
      const first = firstBin[band];
      const last = Math.min(lastBin[band], spectrum.length - 1);
      let total = 0;
      for (let bin = first; bin <= last; bin += 1) total += spectrum[bin];
      const raw = last >= first ? total / ((last - first + 1) * 255) : 0;
      const target = gains[band].normalize(raw, dtMs) * presence;
      const keep = target > levels[band] ? SPECTRUM_ATTACK : SPECTRUM_RELEASE;
      levels[band] = levels[band] * keep + target * (1 - keep);
    }
    return levels;
  };

  const reset = () => {
    levels.fill(0);
    for (const gain of gains) gain.reset();
  };

  return { update, levels, reset };
};
