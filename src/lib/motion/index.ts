import { clamp } from "@/utils/clamp";
import { smoothstep } from "@/utils/smoothstep";
import { HOP_LIFT, LEG_MS } from "./consts";
import type { MotionSample, Point2 } from "./types";

export * from "./consts";
export * from "./types";

export const createMotionSample = (): MotionSample => ({
  x: 0,
  y: 0,
  lift: 0,
  leg: 0,
  done: false,
});

/** Total flight time for a path of `pointCount` waypoints. */
export const motionDuration = (pointCount: number, legMs = LEG_MS): number => {
  return Math.max(pointCount - 1, 0) * legMs;
};

/**
 * Where a marble is `elapsedMs` into its flight along `points`. Each leg
 * eases horizontally and arcs vertically, so a chain of hops reads as a
 * marble bouncing hole to hole. Writes into `out` and returns it.
 */
export const sampleMotion = (
  points: readonly Point2[],
  elapsedMs: number,
  out: MotionSample,
  legMs = LEG_MS,
  lift = HOP_LIFT,
): MotionSample => {
  const legs = points.length - 1;
  if (legs <= 0) {
    const only = points[0] ?? { x: 0, y: 0 };
    out.x = only.x;
    out.y = only.y;
    out.lift = 0;
    out.leg = 0;
    out.done = true;
    return out;
  }
  const total = legs * legMs;
  if (elapsedMs >= total) {
    const last = points[legs];
    out.x = last.x;
    out.y = last.y;
    out.lift = 0;
    out.leg = legs - 1;
    out.done = true;
    return out;
  }
  const clamped = clamp(elapsedMs, 0, total);
  const leg = Math.min(Math.floor(clamped / legMs), legs - 1);
  const s = (clamped - leg * legMs) / legMs;
  const eased = smoothstep(s);
  const from = points[leg];
  const to = points[leg + 1];
  out.x = from.x + (to.x - from.x) * eased;
  out.y = from.y + (to.y - from.y) * eased;
  out.lift = lift * 4 * s * (1 - s);
  out.leg = leg;
  out.done = false;
  return out;
};
