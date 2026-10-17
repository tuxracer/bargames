import { isString } from "remeda";

/** How loud the music has to be before the table reacts. */
export type Sensitivity = "low" | "medium" | "high";

const SENSITIVITIES: readonly Sensitivity[] = ["low", "medium", "high"];

export const isSensitivity = (value: unknown): value is Sensitivity => {
  return isString(value) && SENSITIVITIES.includes(value as Sensitivity);
};

/** What one frame of listening heard. Mutable: reused every frame. */
export type BeatFrame = {
  /**
   * Band energies, 0..1, each normalized against its own recent floor and
   * peak so the music fills the range whatever the microphone's gain, and
   * scaled by `presence` so a silent room reads as zero.
   */
  bass: number;
  mid: number;
  high: number;
  /** Overall loudness, 0..1, normalized the same way and smoothed more. */
  level: number;
  /** True on the frame an onset was detected, in rhythm with the last. */
  beat: boolean;
  /** How far above the recent average the onset was, 0..1. */
  strength: number;
  /** A decaying envelope kicked by each beat: 1 on the hit, then falling. */
  punch: number;
  /**
   * How sure the detector is that music is playing, 0..1: it rises once
   * two onsets land in rhythm and fades a few seconds after the last.
   * Everything the music moves should scale by it.
   */
  presence: number;
};

export type BeatDetector = {
  /** Feed one FFT frame (byte magnitudes per bin) and read the result. */
  update: (spectrum: Uint8Array, nowMs: number) => BeatFrame;
  readonly frame: BeatFrame;
  setSensitivity: (level: Sensitivity) => void;
  reset: () => void;
};

/** Reads one raw band and returns it normalized against its recent range. */
export type AutoGain = {
  normalize: (raw: number, dtMs: number) => number;
  reset: () => void;
};

/** A spectrum reduced to a few log-spaced bands, each auto-gained. */
export type SpectrumBands = {
  /**
   * Fill `levels` from an FFT frame; call once per frame. `presence` (from
   * the beat detector) scales the result so a silent room stays dark.
   */
  update: (
    spectrum: Uint8Array,
    dtMs: number,
    presence?: number,
  ) => Float32Array;
  readonly levels: Float32Array;
  reset: () => void;
};
