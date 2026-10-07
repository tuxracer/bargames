import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTIONS,
  DEFAULT_VISUALS,
  loadOptions,
  parseOptions,
  saveOptions,
} from ".";

describe("parseOptions", () => {
  it("falls back to the defaults when nothing or junk is stored", () => {
    expect(parseOptions(null)).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions("not json")).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('"a string"')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('{"hints":"yes"}')).toEqual(DEFAULT_OPTIONS);
  });

  it("keeps a stored choice and fills in anything missing", () => {
    expect(parseOptions('{"hints":false}')).toEqual({
      ...DEFAULT_OPTIONS,
      hints: false,
    });
    expect(parseOptions('{"theme":"neon"}')).toEqual({
      ...DEFAULT_OPTIONS,
      theme: "neon",
    });
    expect(parseOptions('{"theme":"lava"}')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('{"unrelated":1}')).toEqual(DEFAULT_OPTIONS);
  });

  it("keeps the music settings aspect by aspect", () => {
    expect(parseOptions('{"sensitivity":"high"}')).toEqual({
      ...DEFAULT_OPTIONS,
      sensitivity: "high",
    });
    expect(parseOptions('{"sensitivity":"deafening"}')).toEqual(
      DEFAULT_OPTIONS,
    );
    expect(parseOptions('{"visuals":{"bounce":false,"rim":"no"}}')).toEqual({
      ...DEFAULT_OPTIONS,
      visuals: { ...DEFAULT_VISUALS, bounce: false },
    });
    expect(parseOptions('{"visuals":7}')).toEqual(DEFAULT_OPTIONS);
  });
});

describe("saveOptions and loadOptions", () => {
  it("round-trip through storage", () => {
    const chosen = {
      hints: false,
      theme: "neon",
      music: true,
      sensitivity: "low",
      visuals: { ...DEFAULT_VISUALS, floor: false },
      facePlayer: true,
    } as const;
    saveOptions(chosen);
    expect(loadOptions()).toEqual(chosen);
    saveOptions(DEFAULT_OPTIONS);
    expect(loadOptions()).toEqual(DEFAULT_OPTIONS);
  });
});
