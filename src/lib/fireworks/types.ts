/** A color as three 0..1 channels, kept free of three.js. */
export type Rgb = readonly [number, number, number];

/** The shapes a shell may burst into. */
export type BurstKind = "peony" | "ring" | "willow" | "crackle";

/** A rocket on its way up. Mutable slot in a pool. */
export type Shell = {
  active: boolean;
  x: number;
  z: number;
  /** Where the shell bursts, in hole spacings above the board. */
  apexY: number;
  /** A little sideways lean so the rise is not a plumb line. */
  driftX: number;
  driftZ: number;
  startMs: number;
  riseMs: number;
  r: number;
  g: number;
  b: number;
  strength: number;
  kind: BurstKind;
  /** When the shell last shed a trail spark. */
  trailMs: number;
};

/** The most recent burst, for a renderer that lights the scene with it. */
export type Flash = {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  startMs: number;
  strength: number;
};

/** How the sparks burn; each theme tunes its own. */
export type FireworksLook = {
  /** How white-hot a fresh spark burns before it shows its color. */
  readonly whiten: number;
  /** What a spark fades toward as it dies. */
  readonly ember: Rgb;
};

export type FireworksOptions = {
  /** How many sparks may be alive at once. */
  readonly capacity?: number;
  /** How many shells may be in the air at once. */
  readonly shellCapacity?: number;
  readonly look?: FireworksLook;
  /** A 0..1 source, replaceable for deterministic tests. */
  readonly random?: () => number;
};

/** One shell to fire. */
export type Shot = {
  /** Where it leaves the board. */
  readonly x: number;
  readonly z: number;
  /** Where in the board plane it should burst; straight up when omitted. */
  readonly aimX?: number;
  readonly aimZ?: number;
  readonly color: Rgb;
  /** 0..1: how high it goes and how big it bursts. */
  readonly strength: number;
  /** Drawn by weight when omitted. */
  readonly kind?: BurstKind;
  /** How long the climb takes; set to land the burst on a beat. */
  readonly riseMs?: number;
};

export type Fireworks = {
  /** Fire a shell. Returns false when every shell slot is taken. */
  launch: (shot: Shot, nowMs: number) => boolean;
  /** Advance every shell and spark to `nowMs` and rewrite the buffers. */
  update: (nowMs: number) => void;
  /** Put out every spark and shell at once. */
  clear: () => void;
  /** Live sparks, written per update: x, y, z for each. */
  readonly positions: Float32Array;
  /** Live sparks' colors, r, g, b for each, already faded. */
  readonly colors: Float32Array;
  /** Live sparks' sizes, in hole spacings. */
  readonly sizes: Float32Array;
  /** How many sparks are alive; the buffers are valid up to here. */
  count: () => number;
  /** How many shells are still rising. */
  shells: () => number;
  readonly flash: Flash;
};
