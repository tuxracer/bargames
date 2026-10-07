/** Frequency bands in Hz. Kick drums and bass live in the first. */
export const BASS_HZ: readonly [number, number] = [30, 150];
export const MID_HZ: readonly [number, number] = [150, 2_000];
export const HIGH_HZ: readonly [number, number] = [2_000, 8_000];

/** Frames of bass history the onset detector compares against (~0.7 s at 60 fps). */
export const HISTORY_FRAMES = 43;

/** Onset must exceed the rolling mean by this many standard deviations. */
export const ONSET_SIGMA = 1.6;
/** And by this ratio, so a quiet room's noise does not count. */
export const ONSET_RATIO = 1.25;
/** Below this bass energy nothing is a beat. */
export const ONSET_FLOOR = 0.08;
/** Fastest the detector will call beats; 250 ms is 240 bpm. */
export const REFRACTORY_MS = 250;

/** Smoothing for the band readouts (per frame) and the level. */
export const BAND_SMOOTHING = 0.6;
export const LEVEL_SMOOTHING = 0.9;
