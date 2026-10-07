import { THEMES } from "./consts";
import type { Theme, ThemeId } from "./types";

export * from "./consts";
export * from "./types";

export const getTheme = (id: ThemeId): Theme => THEMES[id];
