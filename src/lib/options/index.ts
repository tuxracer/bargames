import { isPlainObject } from "remeda";
import { DEFAULT_OPTIONS, OPTIONS_STORAGE_KEY } from "./consts";
import { isOptions } from "./types";
import type { Options } from "./types";

export * from "./consts";
export * from "./types";

/**
 * Turn whatever was stored into valid options, field by field, so a stale
 * or damaged record still yields something sensible.
 */
export const parseOptions = (raw: string | null): Options => {
  if (raw === null) return DEFAULT_OPTIONS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isOptions(parsed)) return parsed;
    if (isPlainObject(parsed)) {
      return { ...DEFAULT_OPTIONS, ...pickKnown(parsed) };
    }
  } catch {
    // Not JSON; fall through to the defaults.
  }
  return DEFAULT_OPTIONS;
};

const pickKnown = (record: Record<string, unknown>): Partial<Options> => {
  const known: { hints?: boolean } = {};
  if (typeof record.hints === "boolean") known.hints = record.hints;
  return known;
};

const storage = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // Storage access can throw in locked-down contexts.
  }
};

export const loadOptions = (): Options => {
  return parseOptions(storage()?.getItem(OPTIONS_STORAGE_KEY) ?? null);
};

export const saveOptions = (options: Options) => {
  try {
    storage()?.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Quota or privacy mode; the choice simply will not persist.
  }
};
