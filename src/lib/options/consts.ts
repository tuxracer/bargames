import { DEFAULT_THEME_ID } from "@/lib/theme";
import type { Options, Visuals } from "./types";

export const DEFAULT_VISUALS: Visuals = {
  marbles: true,
  bounce: true,
  halos: true,
  rings: true,
  rim: true,
  floor: true,
  room: true,
  overlay: true,
};

export const DEFAULT_OPTIONS: Options = {
  hints: true,
  theme: DEFAULT_THEME_ID,
  music: false,
  sensitivity: "medium",
  visuals: DEFAULT_VISUALS,
  facePlayer: false,
};

export const OPTIONS_STORAGE_KEY = "neongames.options";
