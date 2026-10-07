import { DEFAULT_THEME_ID } from "@/lib/theme";
import type { Options } from "./types";

export const DEFAULT_OPTIONS: Options = {
  hints: true,
  theme: DEFAULT_THEME_ID,
};

export const OPTIONS_STORAGE_KEY = "neongames.options";
