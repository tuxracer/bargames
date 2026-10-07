import {
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
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

export type SceneHandle = {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** The parts music is allowed to move, with their resting values. */
  readonly pulse: {
    readonly key: DirectionalLight;
    readonly keyIntensity: number;
    readonly rim: MeshStandardMaterial;
    readonly rimIntensity: number;
    readonly table: MeshStandardMaterial;
    readonly tableIntensity: number;
  };
  /** Resize the drawing buffer and refit the board into the viewport. */
  resize: (width: number, height: number) => void;
  dispose: () => void;
};

const FIT_SAMPLES = 24;
const TABLE_SIZE = 80;
const GRID_REPEAT = 20;
const HOLE_RING_INNER = 0.3;
const HOLE_RING_OUTER = 0.37;

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
  scene.background = new Color(look.background);
  scene.fog = new Fog(look.background, 22, 48);

  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = look.environmentIntensity;

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.5, 80);
  camera.position.set(
    0,
    Math.sin(CAMERA_ELEVATION) * CAMERA_DISTANCE,
    Math.cos(CAMERA_ELEVATION) * CAMERA_DISTANCE,
  );
  camera.lookAt(0, BOARD_TOP, 0);

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
  if (look.table.grid !== null) {
    const grid = createGridTexture(
      `#${look.table.grid.toString(16).padStart(6, "0")}`,
    );
    textures.push(grid);
    if (grid) {
      grid.repeat.set(GRID_REPEAT, GRID_REPEAT);
      tableMaterial.emissive.set(0xffffff);
      tableMaterial.emissiveMap = grid;
      tableMaterial.emissiveIntensity = 0.45;
      tableMaterial.roughness = 0.6;
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
  const rim = new Mesh(
    new TorusGeometry(BOARD_DISC_RADIUS - RIM_TUBE * 0.6, RIM_TUBE, 12, 160),
    rimMaterial,
  );
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
    }
  }
  holes.instanceMatrix.needsUpdate = true;
  if (holes.instanceColor) holes.instanceColor.needsUpdate = true;
  scene.add(holes);
  if (rings) {
    rings.instanceMatrix.needsUpdate = true;
    if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    scene.add(rings);
  }

  const sample = new Vector3();
  const resize = (width: number, height: number) => {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
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
    pulse: {
      key,
      keyIntensity: look.key.intensity,
      rim: rimMaterial,
      rimIntensity: look.rim.emissiveIntensity,
      table: tableMaterial,
      tableIntensity: tableMaterial.emissiveIntensity,
    },
    resize,
    dispose,
  };
};
