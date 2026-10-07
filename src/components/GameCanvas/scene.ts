import {
  BufferAttribute,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RingGeometry,
  Scene,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  ACESFilmicToneMapping,
} from "three";
import type { Material, Texture } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { HOLES } from "@/lib/board";
import { MAX_WAVES } from "@/lib/cascade";
import type { Theme } from "@/lib/theme";
import {
  BOARD_DISC_RADIUS,
  BOARD_THICKNESS,
  BOARD_TOP,
  CAMERA_DISTANCE,
  CAMERA_ELEVATION,
  CAMERA_FOV,
  FIT_MARGIN_X,
  FIT_MARGIN_Y,
  HOLE_RADIUS,
  MAX_PIXEL_RATIO,
  RIM_TUBE,
  SHADOW_MAP_SIZE,
} from "./consts";
import {
  createDimpleTexture,
  createGridTexture,
  createWoodTexture,
} from "./woodTexture";

/** Uniforms for the wave rings that run out along the grid floor. */
export type RippleUniforms = {
  /** Per wave: origin x, origin z, front radius, strength. */
  readonly waves: { value: Float32Array };
  readonly count: { value: number };
  /** Whole-floor breathing, 0 at rest. */
  readonly pulse: { value: number };
};

/** The parts music is allowed to move, with their resting values. */
export type Stage = {
  readonly key: DirectionalLight;
  readonly keyIntensity: number;
  readonly rim: MeshStandardMaterial;
  readonly rimIntensity: number;
  readonly rimEmissive: Color;
  /**
   * Per-vertex (brightness, white) for the rim, when it glows: the rim
   * wears the spectrum as a ring. Null for a rim that is not a light.
   */
  readonly rimMusic: BufferAttribute | null;
  /** Each rim vertex's bearing in the board plane (S is +pi/2). */
  readonly rimAngles: Float32Array;
  readonly table: MeshStandardMaterial;
  readonly tableIntensity: number;
  /** Set on a floor with a grid; null for felt. */
  readonly ripple: RippleUniforms | null;
  /** The lit rings around every hole, on boards that have them. */
  readonly rings: InstancedMesh | null;
  /** The rings' resting colors, three floats per hole. */
  readonly ringColors: Float32Array;
  readonly room: {
    readonly background: Color;
    readonly fog: Color;
    readonly base: Color;
  };
};

export type SceneHandle = {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly stage: Stage;
  /** Resize the drawing buffer and refit the board into the viewport. */
  resize: (width: number, height: number) => void;
  /**
   * Put the camera on the side of the table at this azimuth (radians in
   * the board plane; S is +pi/2) without turning the board on screen.
   */
  setView: (azimuth: number) => void;
  dispose: () => void;
};

const FIT_SAMPLES = 24;
const TABLE_SIZE = 80;
const GRID_REPEAT = 20;
const HOLE_RING_INNER = 0.3;
const HOLE_RING_OUTER = 0.37;
const RIM_RADIAL_SEGMENTS = 12;
const RIM_TUBULAR_SEGMENTS = 160;
/** Thickness of a floor ripple's ring, in hole spacings. */
const RIPPLE_WIDTH = 2.2;
/** How much of a ripple shows between the grid lines, as a faint wash. */
const RIPPLE_WASH = 0.05;

const toCss = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/**
 * Teach the grid floor's material to carry wave rings: the emissive (the
 * lines and their halos) brightens where a ring front passes, and a faint
 * wash of the line color shows the ring between the lines.
 */
const addRipple = (
  material: MeshStandardMaterial,
  lineColor: Color,
): RippleUniforms => {
  const uniforms: RippleUniforms = {
    waves: { value: new Float32Array(MAX_WAVES * 4) },
    count: { value: 0 },
    pulse: { value: 0 },
  };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWaves = uniforms.waves;
    shader.uniforms.uWaveCount = uniforms.count;
    shader.uniforms.uPulse = uniforms.pulse;
    shader.uniforms.uLineColor = { value: lineColor };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vFloorPos;",
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\n" +
          "vFloorPos = (modelMatrix * vec4(transformed, 1.0)).xz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          "varying vec2 vFloorPos;",
          `uniform vec4 uWaves[${MAX_WAVES}];`,
          "uniform int uWaveCount;",
          "uniform float uPulse;",
          "uniform vec3 uLineColor;",
        ].join("\n"),
      )
      .replace(
        "#include <emissivemap_fragment>",
        [
          "#include <emissivemap_fragment>",
          "float ripple = 0.0;",
          `for (int i = 0; i < ${MAX_WAVES}; i++) {`,
          "  if (i >= uWaveCount) break;",
          "  vec4 wave = uWaves[i];",
          `  float off = (distance(vFloorPos, wave.xy) - wave.z) / ${RIPPLE_WIDTH.toFixed(2)};`,
          "  ripple += wave.w * exp(-off * off * 4.0);",
          "}",
          "totalEmissiveRadiance *= 1.0 + uPulse + ripple;",
          `totalEmissiveRadiance += uLineColor * ripple * ${RIPPLE_WASH.toFixed(3)};`,
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => "grid-ripple";
  return uniforms;
};

/**
 * Give a glowing rim a per-vertex music attribute: x scales its emission,
 * y adds white. Returns the attribute and each vertex's bearing.
 */
const addRimMusic = (
  material: MeshStandardMaterial,
  geometry: TorusGeometry,
): { attribute: BufferAttribute; angles: Float32Array } => {
  const positions = geometry.getAttribute("position");
  const count = positions.count;
  const music = new Float32Array(count * 2);
  const angles = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    music[i * 2] = 1;
    // The torus lies in its local XY plane; the mesh is turned flat so
    // local Y becomes board Z, which keeps the bearing as atan2(y, x).
    angles[i] = Math.atan2(positions.getY(i), positions.getX(i));
  }
  const attribute = new BufferAttribute(music, 2);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("music", attribute);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 music;\nvarying vec2 vMusic;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvMusic = music;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vMusic;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n" +
          "totalEmissiveRadiance = totalEmissiveRadiance * vMusic.x + vec3(vMusic.y);",
      );
  };
  material.customProgramCacheKey = () => "rim-music";
  return { attribute, angles };
};

/** Everything static: lights, the table, the board, its holes. */
export const createScene = (
  canvas: HTMLCanvasElement,
  theme: Theme,
): SceneHandle => {
  const look = theme.scene;
  const textures: (Texture | null)[] = [];

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const background = new Color(look.background);
  const fog = new Fog(look.background, 22, 48);
  scene.background = background;
  scene.fog = fog;

  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = look.environmentIntensity;

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.5, 80);
  // The camera's up is the board's north, not the sky: wherever the camera
  // stands around the table, the S tip stays at the bottom of the screen
  // and only the perspective tilts toward that side. Think of a player
  // walking around a real board: the board does not turn, their view does.
  camera.up.set(0, 0, -1);
  let azimuth = Math.PI / 2;
  const placeCamera = () => {
    const reach = Math.cos(CAMERA_ELEVATION) * CAMERA_DISTANCE;
    camera.position.set(
      Math.cos(azimuth) * reach,
      Math.sin(CAMERA_ELEVATION) * CAMERA_DISTANCE,
      Math.sin(azimuth) * reach,
    );
    camera.lookAt(0, BOARD_TOP, 0);
  };
  placeCamera();

  const key = new DirectionalLight(look.key.color, look.key.intensity);
  key.position.set(...look.key.position);
  key.castShadow = true;
  key.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  key.shadow.camera.left = -BOARD_DISC_RADIUS - 1;
  key.shadow.camera.right = BOARD_DISC_RADIUS + 1;
  key.shadow.camera.top = BOARD_DISC_RADIUS + 1;
  key.shadow.camera.bottom = -BOARD_DISC_RADIUS - 1;
  key.shadow.camera.near = 4;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  const sky = new HemisphereLight(
    look.hemisphere.sky,
    look.hemisphere.ground,
    look.hemisphere.intensity,
  );
  scene.add(sky);

  const tableMaterial = new MeshStandardMaterial({
    color: look.table.color,
    roughness: 1,
    metalness: 0,
  });
  let ripple: RippleUniforms | null = null;
  if (look.table.grid !== null) {
    const grid = createGridTexture(toCss(look.table.grid));
    textures.push(grid);
    if (grid) {
      grid.repeat.set(GRID_REPEAT, GRID_REPEAT);
      tableMaterial.emissive.set(0xffffff);
      tableMaterial.emissiveMap = grid;
      tableMaterial.emissiveIntensity = 0.45;
      tableMaterial.roughness = 0.6;
      ripple = addRipple(tableMaterial, new Color(look.table.grid));
    }
  }
  const table = new Mesh(
    new PlaneGeometry(TABLE_SIZE, TABLE_SIZE),
    tableMaterial,
  );
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  let boardTop: Material;
  if (look.board.kind === "wood") {
    const wood = createWoodTexture();
    textures.push(wood);
    boardTop = new MeshStandardMaterial({
      color: wood ? look.board.color : 0x8f552c,
      map: wood,
      roughness: 0.42,
      metalness: 0,
    });
  } else {
    boardTop = new MeshPhysicalMaterial({
      color: look.board.color,
      roughness: 0.25,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
  }
  const boardSide = new MeshStandardMaterial({
    color: look.board.side,
    roughness: 0.6,
    metalness: 0,
  });
  const board = new Mesh(
    new CylinderGeometry(
      BOARD_DISC_RADIUS,
      BOARD_DISC_RADIUS,
      BOARD_THICKNESS,
      128,
    ),
    [boardSide, boardTop, boardSide],
  );
  board.position.y = BOARD_THICKNESS / 2;
  board.receiveShadow = true;
  board.castShadow = true;
  scene.add(board);

  const rimMaterial = new MeshStandardMaterial({
    color: look.rim.color,
    emissive: look.rim.emissive,
    emissiveIntensity: look.rim.emissiveIntensity,
    roughness: 0.35,
    toneMapped: look.rim.emissiveIntensity === 0,
  });
  const rimGeometry = new TorusGeometry(
    BOARD_DISC_RADIUS - RIM_TUBE * 0.6,
    RIM_TUBE,
    RIM_RADIAL_SEGMENTS,
    RIM_TUBULAR_SEGMENTS,
  );
  const rimMusic =
    look.rim.emissiveIntensity > 0 && theme.music.rimSpectrum > 0
      ? addRimMusic(rimMaterial, rimGeometry)
      : null;
  const rim = new Mesh(rimGeometry, rimMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = BOARD_TOP;
  rim.receiveShadow = true;
  scene.add(rim);

  const dimple = createDimpleTexture();
  textures.push(dimple);
  const holes = new InstancedMesh(
    new CircleGeometry(HOLE_RADIUS, 28),
    new MeshStandardMaterial({ map: dimple, roughness: 0.85, metalness: 0 }),
    HOLES.length,
  );
  holes.receiveShadow = true;
  const rings = look.holes.rings
    ? new InstancedMesh(
        new RingGeometry(HOLE_RING_INNER, HOLE_RING_OUTER, 32),
        new MeshBasicMaterial({ toneMapped: false }),
        HOLES.length,
      )
    : null;
  const placer = new Object3D();
  const base = new Color(look.holes.base);
  const tint = new Color();
  const lit = new Color();
  const ringColors = new Float32Array(rings ? HOLES.length * 3 : 0);
  for (const hole of HOLES) {
    placer.position.set(hole.px, BOARD_TOP + 0.004, hole.py);
    placer.rotation.set(-Math.PI / 2, 0, 0);
    placer.updateMatrix();
    holes.setMatrixAt(hole.index, placer.matrix);
    tint.copy(base);
    if (hole.zone !== null) {
      tint.lerp(new Color(theme.marbles[hole.zone].hex), look.holes.zoneTint);
    }
    holes.setColorAt(hole.index, tint);
    if (rings) {
      placer.position.y = BOARD_TOP + 0.008;
      placer.updateMatrix();
      rings.setMatrixAt(hole.index, placer.matrix);
      lit
        .set(
          hole.zone === null
            ? (look.table.grid ?? base)
            : theme.marbles[hole.zone].hex,
        )
        .multiplyScalar(hole.zone === null ? 0.5 : 0.8);
      rings.setColorAt(hole.index, lit);
      lit.toArray(ringColors, hole.index * 3);
    }
  }
  holes.instanceMatrix.needsUpdate = true;
  if (holes.instanceColor) holes.instanceColor.needsUpdate = true;
  scene.add(holes);
  if (rings) {
    rings.instanceMatrix.needsUpdate = true;
    if (rings.instanceColor) {
      rings.instanceColor.setUsage(DynamicDrawUsage);
      rings.instanceColor.needsUpdate = true;
    }
    scene.add(rings);
  }

  const sample = new Vector3();
  const fit = () => {
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    // Project the board rim and zoom until it just fits the viewport.
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < FIT_SAMPLES; i += 1) {
      const angle = (i / FIT_SAMPLES) * Math.PI * 2;
      sample.set(
        Math.cos(angle) * BOARD_DISC_RADIUS,
        BOARD_TOP,
        Math.sin(angle) * BOARD_DISC_RADIUS,
      );
      sample.project(camera);
      maxX = Math.max(maxX, Math.abs(sample.x));
      maxY = Math.max(maxY, Math.abs(sample.y));
    }
    camera.zoom = Math.min(FIT_MARGIN_X / maxX, FIT_MARGIN_Y / maxY);
    camera.updateProjectionMatrix();
  };

  const resize = (width: number, height: number) => {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    fit();
  };

  const setView = (next: number) => {
    if (next === azimuth) return;
    azimuth = next;
    placeCamera();
    fit();
  };

  const dispose = () => {
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    for (const texture of textures) texture?.dispose();
    environment.dispose();
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    stage: {
      key,
      keyIntensity: look.key.intensity,
      rim: rimMaterial,
      rimIntensity: look.rim.emissiveIntensity,
      rimEmissive: new Color(look.rim.emissive),
      rimMusic: rimMusic?.attribute ?? null,
      rimAngles: rimMusic?.angles ?? new Float32Array(0),
      table: tableMaterial,
      tableIntensity: tableMaterial.emissiveIntensity,
      ripple,
      rings,
      ringColors,
      room: { background, fog: fog.color, base: new Color(look.background) },
    },
    resize,
    setView,
    dispose,
  };
};
