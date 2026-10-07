/** Board geometry, in hole spacings (one unit = the gap between holes). */
export const BOARD_DISC_RADIUS = 7.8;
export const BOARD_THICKNESS = 0.5;
export const BOARD_TOP = BOARD_THICKNESS;
export const RIM_TUBE = 0.11;
export const HOLE_RADIUS = 0.34;
export const MARBLE_RADIUS = 0.44;
/** A resting marble sinks a little into its dimple. */
export const MARBLE_SINK = 0.12;
export const MARBLE_REST_Y = BOARD_TOP + MARBLE_RADIUS - MARBLE_SINK;

/** Lift while selected (bobbing) and while being dragged. */
export const SELECT_LIFT = 0.28;
export const DRAG_LIFT = 0.9;
/** A touch-dragged marble rides this far ahead of the fingertip so it stays
 * visible; mouse drags get no offset. */
export const DRAG_FINGER_OFFSET = 0.7;

/** How far a dropped (or tapped) marble may be from a legal hole's center
 * and still snap into it, in hole spacings. The snap always takes the
 * nearest legal hole, so this only needs to stay under one spacing: a drop
 * dead on a neighboring hole that is not legal still flies home. */
export const SNAP_RADIUS = 0.9;
/** How far a press must travel (CSS px) before it counts as a drag. */
export const DRAG_THRESHOLD_PX = 8;
/** How close a touch must land to a hole center to pick it up. */
export const PICK_RADIUS = 0.6;

/** How long the view takes to swing toward the next player's side. */
export const VIEW_SWING_MS = 900;

/** Camera framing. */
export const CAMERA_FOV = 34;
export const CAMERA_ELEVATION = (58 * Math.PI) / 180;
export const CAMERA_DISTANCE = 26;
/** Fraction of the viewport the board disc may fill, per axis. The HUD
 * sits above and below the board, so height is tighter than width. */
export const FIT_MARGIN_X = 0.9;
export const FIT_MARGIN_Y = 0.78;

export const MAX_PIXEL_RATIO = 2;
export const SHADOW_MAP_SIZE = 1_024;

/** Haptics (ms). Short: a marble clicking into a hole. */
export const LAND_HAPTIC_MS = 8;
