/** How fast a wave front travels, in hole spacings per millisecond. */
export const WAVE_SPEED = 0.02;

/** Thickness of the bright band, in hole spacings. */
export const WAVE_WIDTH = 2;

/**
 * A wave lives this long: long enough to cross the board and run on across
 * the floor around it. It fades gently at first and steeply at the end.
 */
export const WAVE_LIFE_MS = 1_600;

/** Waves alive at once; a fast kick pattern recycles the oldest. */
export const MAX_WAVES = 6;
