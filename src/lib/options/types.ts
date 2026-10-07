import { isBoolean, isPlainObject } from "remeda";
import { isThemeId } from "@/lib/theme";
import type { ThemeId } from "@/lib/theme";

/** Player preferences; they outlive a game. */
export type Options = {
  /** Ring the holes a lifted marble may go to. */
  readonly hints: boolean;
  /** How the table is dressed. */
  readonly theme: ThemeId;
};

export const isOptions = (value: unknown): value is Options => {
  return (
    isPlainObject(value) && isBoolean(value.hints) && isThemeId(value.theme)
  );
};
