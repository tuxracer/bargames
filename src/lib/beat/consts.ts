/** Frequency bands in Hz. Kick drums and bass live in the first. */
export const BASS_HZ: readonly [number, number] = [30, 150];
export const MID_HZ: readonly [number, number] = [150, 2_000];
export const HIGH_HZ: readonly [number, number] = [2_000, 8_000];

/**
 * Each band is smoothed with this time constant before anything reads it.
 * A microphone's noise is different every frame, while a kick lasts many
 * frames, so the smoothing takes a quiet room's bass jitter down to a few
 * percent of a kick's rise, and the onset detector no longer hears noise
 * as beats. Measured against the analyser: 80 ms leaves kicks at 128 bpm
 * intact and stationary noise with no onsets at all.
 */
export const ENVELOPE_MS = 80;
/**
 * A long frame (the scene being built, a tab in the background) must not
 * let the envelope jump straight to one raw, noisy reading: the smoothing
 * step is computed as if no more than this long had passed.
 */
export const ENVELOPE_MAX_STEP_MS = 50;

/** Frames of history the onset detectors compare against (~0.7 s at 60 fps). */
export const HISTORY_FRAMES = 43;

/** A bass onset must exceed the rolling mean by this many standard deviations. */
export const ONSET_SIGMA = 1.2;
/**
 * And by this much outright (a byte-magnitude fraction, so a few dB), so a
 * quiet room's noise does not count. A ratio would not do: the analyser's
 * scale is logarithmic, and a ratio asks a loud microphone for a far
 * bigger jump than a quiet one.
 */
export const ONSET_STEP = 0.05;
/** Below this bass energy nothing is a beat. */
export const ONSET_FLOOR = 0.08;
/** The envelope blunts a kick's peak; strength is scaled back up by this. */
export const KICK_STRENGTH_SCALE = 1.5;
/** Spectral flux (broadband attack) onset thresholds, same shape. */
export const FLUX_SIGMA = 2.2;
export const FLUX_RATIO = 1.8;
export const FLUX_FLOOR = 0.012;
/** Fastest the detector will call beats; 250 ms is 240 bpm. */
export const REFRACTORY_MS = 250;

/**
 * One onset on its own is a door, a glass, or a stray in the noise. Music
 * is onsets in rhythm: `RHYTHM_ONSETS` of them in a row, each within
 * `RHYTHM_WINDOW_MS` of the last, turn the show on, and from then on each
 * onset keeps it going. Two seconds is 30 bpm, slower than any beat worth
 * dancing to. Three in a row costs one extra beat when a song starts and
 * takes a quiet room at high sensitivity from a false start every few
 * minutes to none in a five-minute soak.
 */
export const RHYTHM_WINDOW_MS = 2_000;
export const RHYTHM_ONSETS = 3;
/** The show stays open this long after the last confirmed beat ... */
export const PRESENCE_HOLD_MS = 2_500;
/** ... then fades out over this, having opened quickly on the beat. */
export const PRESENCE_RELEASE_MS = 1_000;
export const PRESENCE_ATTACK_MS = 120;

/** Smoothing for the level readout (per frame); the bands use the envelope. */
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
 * A band whose floor-to-peak swing is narrower than this (in byte-magnitude
 * fractions) is not moving, and reads toward zero rather than being
 * stretched to full: a steady drone should not pin the marbles at full
 * glow. Whether anything is playing at all is `presence`'s call, not this.
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

/** How eagerly the detector calls a beat. */
export type SensitivityProfile = {
  /** Multiplier on every onset threshold; under 1 hears more. */
  readonly onset: number;
};

export const SENSITIVITY_PROFILES: Readonly<
  Record<"low" | "medium" | "high", SensitivityProfile>
> = {
  low: { onset: 1.6 },
  medium: { onset: 1 },
  high: { onset: 0.65 },
};
