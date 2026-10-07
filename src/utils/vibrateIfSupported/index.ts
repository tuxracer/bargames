/**
 * Fires a haptic pulse where the Vibration API exists; a silent no-op
 * elsewhere (iOS Safari has no `navigator.vibrate`).
 */
export const vibrateIfSupported = (pattern: number | number[]) => {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
};
