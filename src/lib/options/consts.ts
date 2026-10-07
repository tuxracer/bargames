import { DEFAULT_THEME_ID } from "@/lib/theme";
import type { Options } from "./types";

export const DEFAULT_OPTIONS: Options = {
  hints: true,
  theme: DEFAULT_THEME_ID,
  music: false,
  facePlayer: false,
};

export const OPTIONS_STORAGE_KEY = "neongames.options";
