import { describe, expect, it } from "vitest";
import {
  createAutoGain,
  createBeatDetector,
  createSpectrumBands,
  PRESENCE_HOLD_MS,
  REFRACTORY_MS,
  RHYTHM_ONSETS,
} from ".";
import type { BeatDetector, BeatFrame, Sensitivity } from ".";

const SAMPLE_RATE = 48_000;
const FFT_SIZE = 1_024;
const BINS = FFT_SIZE / 2;
const BIN_HZ = SAMPLE_RATE / FFT_SIZE;
const FRAME_MS = 1_000 / 60;

/** A spectrum with flat noise plus an optional kick in the bass band. */
const spectrum = (noise: number, kick: number): Uint8Array => {
  const out = new Uint8Array(BINS);
  for (let bin = 0; bin < BINS; bin += 1) {
    const hz = bin * BIN_HZ;
    out[bin] = Math.min(255, hz >= 30 && hz <= 150 ? noise + kick : noise);
  }
  return out;
};

/** Noise with a tone (one band of bins) raised by `gain`. */
const tone = (noise: number, lowHz: number, highHz: number, gain: number) => {
  const out = new Uint8Array(BINS);
  for (let bin = 0; bin < BINS; bin += 1) {
    const hz = bin * BIN_HZ;
    out[bin] = Math.min(
      255,
      hz >= lowHz && hz <= highHz ? noise + gain : noise,
    );
  }
  return out;
};

/**
 * A microphone in a quiet room: every bin jitters on its own, every frame,
 * around a floor. Seeded so a failure can be reproduced. `spread` is the
 * per-bin standard deviation in byte magnitudes; 14 is what the analyser
 * reads from white noise with the app's settings.
 */
const createRoom = (floor: number, spread = 14, seed = 7) => {
  let state = seed;
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
  const gaussian = () => {
    const u = Math.max(random(), 1e-9);
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const out = new Uint8Array(BINS);
  return (kick = 0): Uint8Array => {
    for (let bin = 0; bin < BINS; bin += 1) {
      const hz = bin * BIN_HZ;
      const lift = hz >= 30 && hz <= 150 ? kick : 0;
      out[bin] = Math.max(
        0,
        Math.min(255, Math.round(floor + lift + gaussian() * spread)),
      );
    }
    return out;
  };
};

/** How long a synthetic kick holds the bass band up: 100 ms, like a real one. */
const KICK_FRAMES = 6;

/** Plays `beats` kicks spaced `periodMs` apart (the first after one period) at 60 fps. */
const play = (
  periodMs: number,
  beats: number,
  noise = 20,
  kick = 160,
  sensitivity: Sensitivity = "medium",
): { detected: number[]; peakBass: number } => {
  const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
  detector.setSensitivity(sensitivity);
  const detected: number[] = [];
  let peakBass = 0;
  const totalMs = periodMs * (beats + 1);
  for (let now = 0; now < totalMs; now += FRAME_MS) {
    const sinceKick = now % periodMs;
    const kicking = now >= periodMs && sinceKick < FRAME_MS * KICK_FRAMES;
    const frame = detector.update(spectrum(noise, kicking ? kick : 0), now);
    if (frame.beat) detected.push(now);
    peakBass = Math.max(peakBass, frame.bass);
  }
  return { detected, peakBass };
};

/** Feed a second of flat noise, then soft kicks at 1 s and 1.5 s, so the
 * next kick is the one that lands in rhythm. Returns its time. */
const prime = (detector: BeatDetector, noise = 20): number => {
  for (let now = 0; now < 2_000; now += 16) {
    const sinceKick = (now - 1_000) % 500;
    const kicking = now >= 1_000 && sinceKick < 16 * KICK_FRAMES;
    detector.update(spectrum(noise, kicking ? 60 : 0), now);
  }
  return 2_000;
};

/** Play a hard kick from `start` and return the frame it is heard on (or
 * the last frame of the kick if it never is). */
const hit = (detector: BeatDetector, start: number): BeatFrame => {
  let frame = detector.frame;
  for (let i = 0; i < KICK_FRAMES; i += 1) {
    frame = detector.update(spectrum(20, 200), start + i * 16);
    if (frame.beat) break;
  }
  return frame;
};

describe("createBeatDetector", () => {
  it("hears nothing in steady noise", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    let beats = 0;
    let peak = 0;
    for (let now = 0; now < 3_000; now += 16) {
      const frame = detector.update(spectrum(40, 0), now);
      if (frame.beat) beats += 1;
      peak = Math.max(peak, frame.bass, frame.level, frame.punch);
    }
    expect(beats).toBe(0);
    expect(peak).toBe(0);
  });

  it("keeps a quiet room dark, even at high sensitivity", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    detector.setSensitivity("high");
    const room = createRoom(60);
    let beats = 0;
    let peak = 0;
    for (let now = 0; now < 20_000; now += FRAME_MS) {
      const frame = detector.update(room(), now);
      if (frame.beat) beats += 1;
      peak = Math.max(
        peak,
        frame.bass,
        frame.mid,
        frame.high,
        frame.level,
        frame.punch,
        frame.presence,
      );
    }
    expect(beats).toBe(0);
    expect(peak).toBe(0);
  });

  it("ignores a couple of bumps in a quiet room", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    const room = createRoom(60);
    let beats = 0;
    let presence = 0;
    for (let now = 0; now < 6_000; now += FRAME_MS) {
      const bumping =
        (now >= 2_000 && now < 2_000 + FRAME_MS * KICK_FRAMES) ||
        (now >= 2_600 && now < 2_600 + FRAME_MS * KICK_FRAMES);
      const bump = bumping ? 120 : 0;
      const frame = detector.update(room(bump), now);
      if (frame.beat) beats += 1;
      presence = Math.max(presence, frame.presence);
    }
    expect(beats).toBe(0);
    expect(presence).toBe(0);
  });

  it("opens on the third kick in rhythm and fades after the last", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    const room = createRoom(60);
    const periodMs = 60_000 / 128;
    const kicks = [0, 1, 2, 3].map((i) => 2_000 + i * periodMs);
    const opening = kicks[RHYTHM_ONSETS - 1];
    const beats: number[] = [];
    let presenceAtFirst = 0;
    let presenceDuring = 0;
    let presenceHeld = 1;
    let presenceAfter = 1;
    const lastKick = kicks[kicks.length - 1];
    for (let now = 0; now < lastKick + 8_000; now += FRAME_MS) {
      const kicking = kicks.some((at) => now >= at && now < at + FRAME_MS * 6);
      const frame = detector.update(room(kicking ? 120 : 0), now);
      if (frame.beat) beats.push(now);
      if (now < opening)
        presenceAtFirst = Math.max(presenceAtFirst, frame.presence);
      if (now > opening + 400 && now < lastKick) {
        presenceDuring = Math.min(presenceDuring || 1, frame.presence);
      }
      if (now > lastKick && now < lastKick + PRESENCE_HOLD_MS) {
        presenceHeld = Math.min(presenceHeld, frame.presence);
      }
      if (now > lastKick + 7_000) {
        presenceAfter = Math.min(presenceAfter, frame.presence);
      }
    }
    expect(beats.length).toBe(kicks.length - RHYTHM_ONSETS + 1);
    expect(beats[0]).toBeGreaterThanOrEqual(opening);
    expect(beats[0]).toBeLessThan(opening + 100);
    expect(presenceAtFirst).toBe(0);
    expect(presenceDuring).toBeGreaterThan(0.9);
    expect(presenceHeld).toBeGreaterThan(0.9);
    expect(presenceAfter).toBeLessThan(0.02);
  });

  it("calls one beat per kick at a dance tempo", () => {
    const periodMs = 60_000 / 128; // 128 bpm
    const { detected } = play(periodMs, 8);
    expect(detected.length).toBe(8 - RHYTHM_ONSETS + 1);
    for (let i = 1; i < detected.length; i += 1) {
      expect(detected[i] - detected[i - 1]).toBeGreaterThanOrEqual(
        REFRACTORY_MS,
      );
      expect(detected[i] - detected[i - 1]).toBeCloseTo(periodMs, -1.5);
    }
  });

  it("fills the bass range whether the microphone is quiet or hot", () => {
    const periodMs = 60_000 / 120;
    const quiet = play(periodMs, 8, 8, 100);
    const hot = play(periodMs, 8, 180, 75);
    expect(quiet.detected.length).toBeGreaterThanOrEqual(6);
    expect(hot.detected.length).toBeGreaterThanOrEqual(6);
    expect(quiet.peakBass).toBeGreaterThan(0.8);
    expect(hot.peakBass).toBeGreaterThan(0.8);
  });

  it("hears a broadband stab with no bass as a beat", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    for (let now = 0; now < 1_000; now += 16) {
      detector.update(tone(20, 0, 0, 0), now);
    }
    for (let now = 1_000; now < 2_000; now += 16) {
      const stabbing = (now - 1_000) % 512 === 0;
      detector.update(tone(20, 300, 6_000, stabbing ? 120 : 0), now);
    }
    const frame = detector.update(tone(20, 300, 6_000, 120), 2_000);
    expect(frame.beat).toBe(true);
    expect(frame.strength).toBeGreaterThan(0.3);
  });

  it("reports band energies and a strength on the beat", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    const frame = hit(detector, prime(detector));
    expect(frame.beat).toBe(true);
    expect(frame.strength).toBeGreaterThan(0.5);
    expect(frame.bass).toBeGreaterThan(frame.high);
    expect(frame.level).toBeGreaterThan(0);
    expect(frame.level).toBeLessThanOrEqual(1);
  });

  it("kicks the punch envelope on a beat and lets it fall", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    const start = prime(detector);
    const struck = hit(detector, start).punch;
    expect(struck).toBeGreaterThan(0.9);
    let punch = struck;
    const landed = start + KICK_FRAMES * 16;
    for (let now = landed; now < landed + 600; now += 16) {
      const next = detector.update(spectrum(20, 0), now).punch;
      expect(next).toBeLessThan(punch);
      punch = next;
    }
    expect(punch).toBeLessThan(0.1);
  });

  it("hears softer kicks at high sensitivity and fewer at low", () => {
    const periodMs = 60_000 / 120;
    const faint = (level: Sensitivity) =>
      play(periodMs, 8, 20, 30, level).detected.length;
    expect(faint("medium")).toBe(0);
    expect(faint("high")).toBeGreaterThanOrEqual(6);
    const soft = (level: Sensitivity) =>
      play(periodMs, 8, 20, 50, level).detected.length;
    expect(soft("medium")).toBeGreaterThanOrEqual(6);
    expect(soft("low")).toBe(0);
  });

  it("ignores a kick while the history is still empty", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    expect(detector.update(spectrum(20, 200), 0).beat).toBe(false);
  });
});

describe("createAutoGain", () => {
  it("stretches a quiet signal's swing to the full range", () => {
    const gain = createAutoGain();
    let top = 0;
    for (let i = 0; i < 120; i += 1) {
      const raw = i % 30 === 0 ? 0.16 : 0.04;
      top = Math.max(top, gain.normalize(raw, FRAME_MS));
    }
    expect(top).toBeGreaterThan(0.95);
  });

  it("gates a signal that barely moves", () => {
    const gain = createAutoGain();
    let top = 0;
    for (let i = 0; i < 120; i += 1) {
      const raw = 0.5 + (i % 2) * 0.01;
      top = Math.max(top, gain.normalize(raw, FRAME_MS));
    }
    expect(top).toBe(0);
  });
});

describe("createSpectrumBands", () => {
  it("lights the band a tone falls in and leaves the others dark", () => {
    const bands = createSpectrumBands(SAMPLE_RATE, FFT_SIZE, 12);
    for (let i = 0; i < 90; i += 1) {
      bands.update(tone(10, 0, 0, 0), FRAME_MS);
    }
    let levels = bands.levels;
    for (let i = 0; i < 12; i += 1) {
      levels = bands.update(tone(10, 1_000, 1_300, 120), FRAME_MS);
    }
    const brightest = levels.indexOf(Math.max(...levels));
    expect(levels[brightest]).toBeGreaterThan(0.8);
    expect(brightest).toBeGreaterThan(3);
    expect(brightest).toBeLessThan(10);
    expect(levels[0]).toBeLessThan(0.05);
    expect(levels[11]).toBeLessThan(0.05);
  });

  it("falls slower than it rises", () => {
    const bands = createSpectrumBands(SAMPLE_RATE, FFT_SIZE, 4);
    for (let i = 0; i < 90; i += 1) bands.update(tone(10, 0, 0, 0), FRAME_MS);
    let rise = 0;
    for (let i = 0; i < 3; i += 1) {
      rise = Math.max(...bands.update(tone(10, 40, 6_000, 120), FRAME_MS));
    }
    let fall = rise;
    for (let i = 0; i < 3; i += 1) {
      fall = Math.max(...bands.update(tone(10, 0, 0, 0), FRAME_MS));
    }
    expect(rise).toBeGreaterThan(0.7);
    expect(fall).toBeGreaterThan(rise * 0.4);
  });

  it("stays dark while the detector hears no music", () => {
    const bands = createSpectrumBands(SAMPLE_RATE, FFT_SIZE, 8);
    const room = createRoom(60);
    let top = 0;
    for (let i = 0; i < 300; i += 1) {
      top = Math.max(top, ...bands.update(room(), FRAME_MS, 0));
    }
    expect(top).toBe(0);
    let lit = 0;
    for (let i = 0; i < 30; i += 1) {
      lit = Math.max(lit, ...bands.update(room(), FRAME_MS, 1));
    }
    expect(lit).toBeGreaterThan(0.5);
  });
});
