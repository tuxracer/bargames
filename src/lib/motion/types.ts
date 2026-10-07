export type Point2 = {
  readonly x: number;
  readonly y: number;
};

/** A marble's place along a path at one instant. Mutable: reused per frame. */
export type MotionSample = {
  x: number;
  y: number;
  /** Height above the resting surface, in hole spacings. */
  lift: number;
  /** Which leg of the path is in flight (0-based); the last leg when done. */
  leg: number;
  done: boolean;
};
