/** Clamps a number into the closed range [min, max]. */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};
