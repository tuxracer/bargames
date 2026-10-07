/** What one frame of listening heard. Mutable: reused every frame. */
export type BeatFrame = {
  /** Band energies, 0..1, lightly smoothed. */
  bass: number;
  mid: number;
  high: number;
  /** Overall loudness, 0..1, smoothed more. */
  level: number;
  /** True on the frame a bass onset was detected. */
  beat: boolean;
  /** How far above the recent average the onset was, 0..1. */
  strength: number;
};

export type BeatDetector = {
  /** Feed one FFT frame (byte magnitudes per bin) and read the result. */
  update: (spectrum: Uint8Array, nowMs: number) => BeatFrame;
  readonly frame: BeatFrame;
  reset: () => void;
};
