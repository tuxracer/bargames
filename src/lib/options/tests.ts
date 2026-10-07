import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, loadOptions, parseOptions, saveOptions } from ".";

describe("parseOptions", () => {
  it("falls back to the defaults when nothing or junk is stored", () => {
    expect(parseOptions(null)).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions("not json")).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('"a string"')).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions('{"hints":"yes"}')).toEqual(DEFAULT_OPTIONS);
  });

  it("keeps a stored choice and fills in anything missing", () => {
    expect(parseOptions('{"hints":false}')).toEqual({ hints: false });
    expect(parseOptions('{"unrelated":1}')).toEqual(DEFAULT_OPTIONS);
  });
});

describe("saveOptions and loadOptions", () => {
  it("round-trip through storage", () => {
    saveOptions({ hints: false });
    expect(loadOptions()).toEqual({ hints: false });
    saveOptions(DEFAULT_OPTIONS);
    expect(loadOptions()).toEqual(DEFAULT_OPTIONS);
  });
});
