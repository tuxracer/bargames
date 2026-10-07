import { describe, expect, it } from "vitest";
import {
  createAutoGain,
  createBeatDetector,
  createSpectrumBands,
  REFRACTORY_MS,
} from ".";
import type { Sensitivity } from ".";

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
    const kicking = now >= periodMs && sinceKick < FRAME_MS * 3;
    const frame = detector.update(spectrum(noise, kicking ? kick : 0), now);
    if (frame.beat) detected.push(now);
    peakBass = Math.max(peakBass, frame.bass);
  }
  return { detected, peakBass };
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

  it("calls one beat per kick at a dance tempo", () => {
    const periodMs = 60_000 / 128; // 128 bpm
    const { detected } = play(periodMs, 8);
    expect(detected.length).toBeGreaterThanOrEqual(7);
    expect(detected.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < detected.length; i += 1) {
      expect(detected[i] - detected[i - 1]).toBeGreaterThanOrEqual(
        REFRACTORY_MS,
      );
      expect(detected[i] - detected[i - 1]).toBeCloseTo(periodMs, -1.5);
    }
  });

  it("fills the bass range whether the microphone is quiet or hot", () => {
    const periodMs = 60_000 / 120;
    const quiet = play(periodMs, 8, 8, 40);
    const hot = play(periodMs, 8, 200, 55);
    expect(quiet.detected.length).toBeGreaterThanOrEqual(7);
    expect(hot.detected.length).toBeGreaterThanOrEqual(7);
    expect(quiet.peakBass).toBeGreaterThan(0.8);
    expect(hot.peakBass).toBeGreaterThan(0.8);
  });

  it("hears a broadband stab with no bass as a beat", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    for (let now = 0; now < 1_000; now += 16) {
      detector.update(tone(20, 0, 0, 0), now);
    }
    const frame = detector.update(tone(20, 300, 6_000, 120), 1_000);
    expect(frame.beat).toBe(true);
    expect(frame.strength).toBeGreaterThan(0.3);
  });

  it("reports band energies and a strength on the beat", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    for (let now = 0; now < 1_000; now += 16) {
      detector.update(spectrum(20, 0), now);
    }
    const frame = detector.update(spectrum(20, 200), 1_000);
    expect(frame.beat).toBe(true);
    expect(frame.strength).toBeGreaterThan(0.5);
    expect(frame.bass).toBeGreaterThan(frame.high);
    expect(frame.level).toBeGreaterThan(0);
    expect(frame.level).toBeLessThanOrEqual(1);
  });

  it("kicks the punch envelope on a beat and lets it fall", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    for (let now = 0; now < 1_000; now += 16) {
      detector.update(spectrum(20, 0), now);
    }
    const hit = detector.update(spectrum(20, 200), 1_000).punch;
    expect(hit).toBeGreaterThan(0.9);
    let punch = hit;
    for (let now = 1_016; now < 1_600; now += 16) {
      const next = detector.update(spectrum(20, 0), now).punch;
      expect(next).toBeLessThan(punch);
      punch = next;
    }
    expect(punch).toBeLessThan(0.1);
  });

  it("hears softer kicks at high sensitivity and fewer at low", () => {
    const periodMs = 60_000 / 120;
    const faint = (level: Sensitivity) =>
      play(periodMs, 8, 20, 18, level).detected.length;
    expect(faint("medium")).toBe(0);
    expect(faint("high")).toBeGreaterThanOrEqual(7);
    const soft = (level: Sensitivity) =>
      play(periodMs, 8, 20, 30, level).detected.length;
    expect(soft("medium")).toBeGreaterThanOrEqual(7);
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
});
