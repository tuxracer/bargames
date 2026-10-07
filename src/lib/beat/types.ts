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
   * peak so the music fills the range whatever the microphone's gain.
   */
  bass: number;
  mid: number;
  high: number;
  /** Overall loudness, 0..1, normalized the same way and smoothed more. */
  level: number;
  /** True on the frame an onset was detected. */
  beat: boolean;
  /** How far above the recent average the onset was, 0..1. */
  strength: number;
  /** A decaying envelope kicked by each beat: 1 on the hit, then falling. */
  punch: number;
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
  /** `gate` scales the noise gate's span; under 1 lets quieter swings through. */
  normalize: (raw: number, dtMs: number, gate?: number) => number;
  reset: () => void;
};

/** A spectrum reduced to a few log-spaced bands, each auto-gained. */
export type SpectrumBands = {
  /** Fill `levels` from an FFT frame; call once per frame. */
  update: (spectrum: Uint8Array, dtMs: number) => Float32Array;
  readonly levels: Float32Array;
  setSensitivity: (level: Sensitivity) => void;
  reset: () => void;
};
