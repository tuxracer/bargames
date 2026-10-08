import type { BurstKind, FireworksLook } from "./types";

export const SPARK_CAPACITY = 6_000;
export const SHELL_CAPACITY = 16;

/** Where a shell bursts, in hole spacings above the board, by strength. */
export const APEX_MIN = 4.5;
export const APEX_RANGE = 3.5;
/** How long the climb takes; stronger shells climb a little longer. */
export const RISE_MS = 750;
export const RISE_RANGE_MS = 350;
/** How far a shell may lean sideways on the way up. */
export const DRIFT = 2;

/** Sparks per burst at full strength, by kind. */
export const BURST_SPARKS: Readonly<Record<BurstKind, number>> = {
  peony: 380,
  ring: 180,
  willow: 300,
  crackle: 260,
};
/** How much of a burst's sparks survive at zero strength. */
export const BURST_FLOOR = 0.45;

/** Burst speed in hole spacings per second, by kind. */
export const BURST_SPEED: Readonly<Record<BurstKind, number>> = {
  peony: 7.5,
  ring: 8,
  willow: 5,
  crackle: 6.5,
};
/** How long a spark burns, ms, by kind, with a spread. */
export const SPARK_LIFE_MS: Readonly<Record<BurstKind, number>> = {
  peony: 1_500,
  ring: 1_300,
  willow: 2_800,
  crackle: 1_700,
};
export const SPARK_LIFE_SPREAD = 0.4;
/** Air drag per second: how quickly a spark loses its burst speed. */
export const SPARK_DRAG: Readonly<Record<BurstKind, number>> = {
  peony: 1.6,
  ring: 1.4,
  willow: 2.6,
  crackle: 1.8,
};
/** Downward pull in hole spacings per second squared. */
export const GRAVITY = 5.5;
/** Willow sparks hang in the air: they feel less of the pull at first. */
export const WILLOW_GRAVITY = 0.6;

export const SPARK_SIZE = 0.5;
export const SPARK_SIZE_SPREAD = 0.5;
/** Crackle sparks flicker this fast (Hz) and this deep. */
export const CRACKLE_HZ = 14;
export const CRACKLE_DEPTH = 0.75;

/** The shell itself: a bright head and the embers it sheds while rising. */
export const HEAD_SIZE = 0.42;
export const HEAD_LIFE_MS = 70;
export const TRAIL_EVERY_MS = 18;
export const TRAIL_LIFE_MS = 420;
export const TRAIL_SIZE = 0.3;
export const TRAIL_SCATTER = 0.9;

/** A burst's flash fades with this time constant. */
export const FLASH_MS = 320;

/** How the share of each kind is drawn; peonies most often. */
export const KIND_WEIGHTS: readonly (readonly [BurstKind, number])[] = [
  ["peony", 0.45],
  ["ring", 0.2],
  ["willow", 0.2],
  ["crackle", 0.15],
];

export const DEFAULT_LOOK: FireworksLook = {
  whiten: 0.8,
  ember: [1, 0.45, 0.12],
};
