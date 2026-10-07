import { describe, expect, it } from "vitest";
import { createBeatDetector, REFRACTORY_MS } from ".";

const SAMPLE_RATE = 48_000;
const FFT_SIZE = 1_024;
const BINS = FFT_SIZE / 2;
const BIN_HZ = SAMPLE_RATE / FFT_SIZE;

/** A spectrum with flat noise plus an optional kick in the bass band. */
const spectrum = (noise: number, kick: number): Uint8Array => {
  const out = new Uint8Array(BINS);
  for (let bin = 0; bin < BINS; bin += 1) {
    const hz = bin * BIN_HZ;
    out[bin] = hz >= 30 && hz <= 150 ? noise + kick : noise;
  }
  return out;
};

/** Plays `beats` kicks spaced `periodMs` apart (the first after one period) at 60 fps; returns beat times. */
const play = (
  periodMs: number,
  beats: number,
  noise = 20,
  kick = 160,
): number[] => {
  const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
  const detected: number[] = [];
  const frameMs = 1_000 / 60;
  const totalMs = periodMs * (beats + 1);
  for (let now = 0; now < totalMs; now += frameMs) {
    const sinceKick = now % periodMs;
    const kicking = now >= periodMs && sinceKick < frameMs * 2;
    const frame = detector.update(spectrum(noise, kicking ? kick : 0), now);
    if (frame.beat) detected.push(now);
  }
  return detected;
};

describe("createBeatDetector", () => {
  it("hears nothing in steady noise", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    let beats = 0;
    for (let now = 0; now < 3_000; now += 16) {
      if (detector.update(spectrum(40, 0), now).beat) beats += 1;
    }
    expect(beats).toBe(0);
  });

  it("calls one beat per kick at a dance tempo", () => {
    const periodMs = 60_000 / 128; // 128 bpm
    const detected = play(periodMs, 8);
    expect(detected.length).toBeGreaterThanOrEqual(7);
    expect(detected.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < detected.length; i += 1) {
      expect(detected[i] - detected[i - 1]).toBeGreaterThanOrEqual(
        REFRACTORY_MS,
      );
      expect(detected[i] - detected[i - 1]).toBeCloseTo(periodMs, -1.5);
    }
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

  it("ignores a kick while the history is still empty", () => {
    const detector = createBeatDetector(SAMPLE_RATE, FFT_SIZE);
    expect(detector.update(spectrum(20, 200), 0).beat).toBe(false);
  });
});
