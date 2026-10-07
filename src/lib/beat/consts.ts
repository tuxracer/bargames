/** Frequency bands in Hz. Kick drums and bass live in the first. */
export const BASS_HZ: readonly [number, number] = [30, 150];
export const MID_HZ: readonly [number, number] = [150, 2_000];
export const HIGH_HZ: readonly [number, number] = [2_000, 8_000];

/** Frames of history the onset detectors compare against (~0.7 s at 60 fps). */
export const HISTORY_FRAMES = 43;

/** A bass onset must exceed the rolling mean by this many standard deviations. */
export const ONSET_SIGMA = 1.6;
/**
 * And by this much outright (a byte-magnitude fraction, so a few dB), so a
 * quiet room's noise does not count. A ratio would not do: the analyser's
 * scale is logarithmic, and a ratio asks a loud microphone for a far
 * bigger jump than a quiet one.
 */
export const ONSET_STEP = 0.05;
/** Below this bass energy nothing is a beat. */
export const ONSET_FLOOR = 0.08;
/** Spectral flux (broadband attack) onset thresholds, same shape. */
export const FLUX_SIGMA = 2.2;
export const FLUX_RATIO = 1.8;
export const FLUX_FLOOR = 0.012;
/** Fastest the detector will call beats; 250 ms is 240 bpm. */
export const REFRACTORY_MS = 250;

/** Smoothing for the band readouts (per frame) and the level. */
export const BAND_SMOOTHING = 0.5;
export const LEVEL_SMOOTHING = 0.85;

/**
 * Auto gain: every band is read against its own recent floor and peak, so
 * a quiet phone microphone and a saturated one both fill the 0..1 range.
 * The peak falls off over this long once the music drops.
 */
export const PEAK_RELEASE_MS = 2_500;
/** The floor creeps up toward the signal this slowly, and drops at once. */
export const FLOOR_RISE_MS = 4_000;
/**
 * A band only counts as music once its floor-to-peak swing is this wide
 * (in byte-magnitude fractions); below it is room noise, faded to nothing.
 */
export const GATE_SPAN_LOW = 0.03;
export const GATE_SPAN_HIGH = 0.08;

/** The punch envelope: kicked by each beat, decaying with this time constant. */
export const PUNCH_MS = 200;

/** Spectrum bands for the rim: log-spaced between these frequencies. */
export const SPECTRUM_LOW_HZ = 40;
export const SPECTRUM_HIGH_HZ = 6_000;
export const SPECTRUM_ATTACK = 0.45;
export const SPECTRUM_RELEASE = 0.82;

/** How eagerly the detector calls a beat and how wide the noise gate opens. */
export type SensitivityProfile = {
  /** Multiplier on every onset threshold; under 1 hears more. */
  readonly onset: number;
  /** Multiplier on the auto gain's noise gate span; under 1 hears more. */
  readonly gate: number;
};

export const SENSITIVITY_PROFILES: Readonly<
  Record<"low" | "medium" | "high", SensitivityProfile>
> = {
  low: { onset: 1.6, gate: 1.6 },
  medium: { onset: 1, gate: 1 },
  high: { onset: 0.65, gate: 0.6 },
};
