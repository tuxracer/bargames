/** How fast a wave front travels, in hole spacings per millisecond. */
export const WAVE_SPEED = 0.02;

/** Thickness of the bright band, in hole spacings. */
export const WAVE_WIDTH = 1.4;

/** A wave fades out over its life, so the far side gets a gentler pass. */
export const WAVE_LIFE_MS = 1_100;

/** Waves alive at once; a fast kick pattern recycles the oldest. */
export const MAX_WAVES = 6;
