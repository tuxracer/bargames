/** Where the microphone stands, for the options panel and the HUD. */
export type MusicStatus =
  | "off"
  | "starting"
  | "listening"
  | "denied"
  | "unsupported";

/** A microphone feed reduced to one FFT frame per call. */
export type Listener = {
  /** Ask for the microphone and start analysing. Rejects if refused. */
  start: () => Promise<void>;
  stop: () => void;
  /** Fill `out` with byte magnitudes per bin; false while not running. */
  sample: (out: Uint8Array<ArrayBuffer>) => boolean;
  readonly bins: number;
  readonly fftSize: number;
  sampleRate: () => number;
  running: () => boolean;
};

const FFT_SIZE = 1_024;
const SMOOTHING = 0.5;

export class ListenerError extends Error {
  readonly code: "UNSUPPORTED" | "DENIED";
  constructor(code: "UNSUPPORTED" | "DENIED") {
    super(code);
    this.name = "ListenerError";
    this.code = code;
  }
}

export const isListenerError = (error: unknown): error is ListenerError => {
  return error instanceof ListenerError;
};

/**
 * Opens the microphone with processing off (we want the music, not a
 * cleaned-up voice) and exposes the analyser. Nothing is recorded or sent
 * anywhere; the stream only ever feeds the analyser node.
 */
export const createListener = (): Listener => {
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let stream: MediaStream | null = null;

  const resumeOnGesture = () => {
    context?.resume().catch(() => {
      // Still suspended; the next gesture will try again.
    });
  };

  const start = async () => {
    if (context) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new ListenerError("UNSUPPORTED");
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
    } catch {
      throw new ListenerError("DENIED");
    }
    context = new AudioContext();
    analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    context.createMediaStreamSource(stream).connect(analyser);
    // Browsers keep a context made outside a gesture suspended until one.
    window.addEventListener("pointerdown", resumeOnGesture);
    await context.resume().catch(() => {});
  };

  const stop = () => {
    window.removeEventListener("pointerdown", resumeOnGesture);
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    analyser = null;
    context?.close().catch(() => {});
    context = null;
  };

  const sample = (out: Uint8Array<ArrayBuffer>): boolean => {
    if (!analyser || context?.state !== "running") return false;
    analyser.getByteFrequencyData(out);
    return true;
  };

  return {
    start,
    stop,
    sample,
    bins: FFT_SIZE / 2,
    fftSize: FFT_SIZE,
    sampleRate: () => context?.sampleRate ?? 48_000,
    running: () => context?.state === "running",
  };
};
