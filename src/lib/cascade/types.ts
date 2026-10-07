/** One ring of light expanding across the board. Mutable slot in a pool. */
export type Wave = {
  x: number;
  y: number;
  startMs: number;
  strength: number;
  active: boolean;
};

export type Cascade = {
  /** Start a wave at a board-plane point. */
  trigger: (x: number, y: number, strength: number, nowMs: number) => void;
  /** Glow (0..1+) felt at a point right now, summed over live waves. */
  glowAt: (x: number, y: number, nowMs: number) => number;
  /** Where a wave's front is and how bright, for drawing the ring itself. */
  front: (wave: Wave, nowMs: number) => { radius: number; strength: number };
  /** Retire waves that have left the board; call once per frame. */
  prune: (nowMs: number) => void;
  /** Number of waves in flight. */
  active: () => number;
  /** The pool itself, for renderers that draw every live wave. */
  readonly waves: readonly Wave[];
};
