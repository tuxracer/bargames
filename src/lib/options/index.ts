import { isBoolean, isPlainObject } from "remeda";
import { isSensitivity } from "@/lib/beat";
import { isThemeId } from "@/lib/theme";
import {
  DEFAULT_OPTIONS,
  DEFAULT_VISUALS,
  OPTIONS_STORAGE_KEY,
} from "./consts";
import { isOptions, VISUAL_ASPECTS } from "./types";
import type { Options, Visuals } from "./types";

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

/** The stored visuals, aspect by aspect, with the defaults for the rest. */
const pickVisuals = (value: unknown): Visuals => {
  if (!isPlainObject(value)) return DEFAULT_VISUALS;
  const visuals = { ...DEFAULT_VISUALS };
  for (const aspect of VISUAL_ASPECTS) {
    const stored = value[aspect];
    if (isBoolean(stored)) visuals[aspect] = stored;
  }
  return visuals;
};

const pickKnown = (record: Record<string, unknown>): Partial<Options> => {
  const known: {
    hints?: boolean;
    theme?: Options["theme"];
    music?: boolean;
    sensitivity?: Options["sensitivity"];
    visuals?: Visuals;
    facePlayer?: boolean;
  } = {};
  if (isBoolean(record.hints)) known.hints = record.hints;
  if (isThemeId(record.theme)) known.theme = record.theme;
  if (isBoolean(record.music)) known.music = record.music;
  if (isSensitivity(record.sensitivity)) {
    known.sensitivity = record.sensitivity;
  }
  if ("visuals" in record) known.visuals = pickVisuals(record.visuals);
  if (isBoolean(record.facePlayer)) known.facePlayer = record.facePlayer;
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
