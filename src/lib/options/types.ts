import { isBoolean, isPlainObject } from "remeda";

/** Player preferences; they outlive a game. */
export type Options = {
  /** Ring the holes a lifted marble may go to. */
  readonly hints: boolean;
};

export const isOptions = (value: unknown): value is Options => {
  return isPlainObject(value) && isBoolean(value.hints);
};
