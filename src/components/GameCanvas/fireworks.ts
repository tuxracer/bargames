import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  PointLight,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
} from "three";
import type { PerspectiveCamera, WebGLRenderer } from "three";
import { createFireworks, FLASH_MS } from "@/lib/fireworks";
import type { Flash, Shot } from "@/lib/fireworks";
import type { Theme } from "@/lib/theme";
import { BOARD_TOP } from "./consts";

export type FireworkDisplay = {
  /** Fire a shell; see `Fireworks.launch`. */
  launch: (shot: Shot, nowMs: number) => boolean;
  /** Advance the show and hand this frame's sparks to the GPU. */
  update: (nowMs: number) => void;
  /** True while anything is still in the air or burning. */
  alive: () => boolean;
  /** The most recent burst, for lighting beyond the table. */
  flash: () => Flash;
  /** Put the show out at once. */
  clear: () => void;
  dispose: () => void;
};

/** How far a burst's light reaches, in hole spacings. */
const FLASH_REACH = 60;

const VERTEX_SHADER = `
attribute float size;
attribute vec3 tint;
uniform float uScale;
varying vec3 vTint;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

/** A hot core with a soft skirt, so a spark reads as light, not a dot. */
const FRAGMENT_SHADER = `
uniform float uGlow;
varying vec3 vTint;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  if (r2 > 1.0) discard;
  float skirt = 1.0 - r2;
  float core = exp(-r2 * 4.0);
  gl_FragColor = vec4(vTint * (core + skirt * skirt * 0.45) * uGlow, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * The winner's fireworks: the simulation's sparks drawn as additive point
 * sprites straight from its buffers, and one point light that jumps to
 * each burst so the board and the marbles catch its color.
 */
export const createFireworkDisplay = (
  scene: Scene,
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  theme: Theme,
): FireworkDisplay => {
  const look = theme.fireworks;
  const sim = createFireworks({
    look: { whiten: look.whiten, ember: look.ember },
  });

  const geometry = new BufferGeometry();
  const position = new BufferAttribute(sim.positions, 3);
  const tint = new BufferAttribute(sim.colors, 3);
  const size = new BufferAttribute(sim.sizes, 1);
  for (const attribute of [position, tint, size]) {
    attribute.setUsage(DynamicDrawUsage);
  }
  geometry.setAttribute("position", position);
  geometry.setAttribute("tint", tint);
  geometry.setAttribute("size", size);
  geometry.setDrawRange(0, 0);

  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uScale: { value: 1 },
      uGlow: { value: look.glow },
    },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const points = new Points(geometry, material);
  points.position.y = BOARD_TOP;
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);

  // Present from the start so no material recompiles when the show begins.
  const light = new PointLight(0xffffff, 0, FLASH_REACH, 2);
  scene.add(light);

  const viewport = new Vector2();

  const upload = (attribute: BufferAttribute, items: number, width: number) => {
    attribute.clearUpdateRanges();
    attribute.addUpdateRange(0, items * width);
    attribute.needsUpdate = true;
  };

  const update = (nowMs: number) => {
    sim.update(nowMs);
    const count = sim.count();
    geometry.setDrawRange(0, count);
    if (count > 0) {
      upload(position, count, 3);
      upload(tint, count, 3);
      upload(size, count, 1);
    }
    // Point size in pixels for a one-unit spark at one unit's distance.
    renderer.getDrawingBufferSize(viewport);
    material.uniforms.uScale.value =
      viewport.y * camera.projectionMatrix.elements[5] * 0.5;

    const flash = sim.flash;
    const age = nowMs - flash.startMs;
    const burn = flash.strength * Math.exp(-age / FLASH_MS);
    light.intensity = burn < 0.002 ? 0 : burn * look.flash;
    if (light.intensity > 0) {
      light.position.set(flash.x, BOARD_TOP + flash.y, flash.z);
      light.color.setRGB(flash.r, flash.g, flash.b);
    }
  };

  const alive = () => sim.count() > 0 || sim.shells() > 0;

  const clear = () => {
    sim.clear();
    geometry.setDrawRange(0, 0);
    light.intensity = 0;
  };

  const dispose = () => {
    scene.remove(points, light);
    geometry.dispose();
    material.dispose();
  };

  return {
    launch: sim.launch,
    update,
    alive,
    flash: () => sim.flash,
    clear,
    dispose,
  };
};
