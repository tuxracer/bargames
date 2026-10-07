import { isBoolean, isPlainObject } from "remeda";
import { isThemeId } from "@/lib/theme";
import type { ThemeId } from "@/lib/theme";

/** Player preferences; they outlive a game. */
export type Options = {
  /** Ring the holes a lifted marble may go to. */
  readonly hints: boolean;
  /** How the table is dressed. */
  readonly theme: ThemeId;
  /** Listen through the microphone and light the table to the music. */
  readonly music: boolean;
  /** Pass and play: tilt the view toward whoever is to move. */
  readonly facePlayer: boolean;
};

export const isOptions = (value: unknown): value is Options => {
  return (
    isPlainObject(value) &&
    isBoolean(value.hints) &&
    isThemeId(value.theme) &&
    isBoolean(value.music) &&
    isBoolean(value.facePlayer)
  );
};
