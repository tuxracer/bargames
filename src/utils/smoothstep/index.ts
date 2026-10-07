import { clamp } from "@/utils/clamp";

/** Cubic smoothstep clamped to [0, 1]: gentle at both ends. */
export const smoothstep = (t: number): number => {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};
