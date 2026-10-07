import {
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  ACESFilmicToneMapping,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { HOLES } from "@/lib/board";
import { MARBLE_LOOKS } from "@/lib/palette";
import {
  BACKGROUND,
  BOARD_DISC_RADIUS,
  BOARD_THICKNESS,
  BOARD_TOP,
  CAMERA_DISTANCE,
  CAMERA_ELEVATION,
  CAMERA_FOV,
  FELT,
  FIT_MARGIN_X,
  FIT_MARGIN_Y,
  GROUND_LIGHT,
  HOLE_RADIUS,
  HOLE_WOOD,
  KEY_LIGHT,
  MAX_PIXEL_RATIO,
  RIM_TUBE,
  SHADOW_MAP_SIZE,
  SKY_LIGHT,
  WOOD_SIDE,
  ZONE_TINT,
} from "./consts";
import { createDimpleTexture, createWoodTexture } from "./woodTexture";

export type SceneHandle = {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Resize the drawing buffer and refit the board into the viewport. */
  resize: (width: number, height: number) => void;
  dispose: () => void;
};

const FIT_SAMPLES = 24;

/** Everything static: lights, the felt table, the wooden board, its holes. */
export const createScene = (canvas: HTMLCanvasElement): SceneHandle => {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = new Color(BACKGROUND);
  scene.fog = new Fog(BACKGROUND, 22, 48);

  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.4;

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.5, 80);
  camera.position.set(
    0,
    Math.sin(CAMERA_ELEVATION) * CAMERA_DISTANCE,
    Math.cos(CAMERA_ELEVATION) * CAMERA_DISTANCE,
  );
  camera.lookAt(0, BOARD_TOP, 0);

  const key = new DirectionalLight(KEY_LIGHT, 3.2);
  key.position.set(-7, 13, 9);
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
  key.shadow.radius = 3;
  scene.add(key, key.target);

  const sky = new HemisphereLight(SKY_LIGHT, GROUND_LIGHT, 0.5);
  scene.add(sky);

  const felt = new Mesh(
    new PlaneGeometry(80, 80),
    new MeshStandardMaterial({ color: FELT, roughness: 1, metalness: 0 }),
  );
  felt.rotation.x = -Math.PI / 2;
  felt.receiveShadow = true;
  scene.add(felt);

  const woodTexture = createWoodTexture();
  const woodTop = new MeshStandardMaterial({
    color: woodTexture ? 0xffffff : 0x8f552c,
    map: woodTexture,
    roughness: 0.42,
    metalness: 0,
  });
  const woodSide = new MeshStandardMaterial({
    color: WOOD_SIDE,
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
    [woodSide, woodTop, woodSide],
  );
  board.position.y = BOARD_THICKNESS / 2;
  board.receiveShadow = true;
  board.castShadow = true;
  scene.add(board);

  const rim = new Mesh(
    new TorusGeometry(BOARD_DISC_RADIUS - RIM_TUBE * 0.6, RIM_TUBE, 12, 160),
    new MeshStandardMaterial({ color: 0x6b3d1f, roughness: 0.35 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = BOARD_TOP;
  rim.receiveShadow = true;
  scene.add(rim);

  const dimple = createDimpleTexture();
  const holes = new InstancedMesh(
    new CircleGeometry(HOLE_RADIUS, 28),
    new MeshStandardMaterial({ map: dimple, roughness: 0.85, metalness: 0 }),
    HOLES.length,
  );
  holes.receiveShadow = true;
  const placer = new Object3D();
  const wood = new Color(HOLE_WOOD);
  const tint = new Color();
  for (const hole of HOLES) {
    placer.position.set(hole.px, BOARD_TOP + 0.004, hole.py);
    placer.rotation.set(-Math.PI / 2, 0, 0);
    placer.updateMatrix();
    holes.setMatrixAt(hole.index, placer.matrix);
    tint.copy(wood);
    if (hole.zone !== null) {
      tint.lerp(new Color(MARBLE_LOOKS[hole.zone].hex), ZONE_TINT);
    }
    holes.setColorAt(hole.index, tint);
  }
  holes.instanceMatrix.needsUpdate = true;
  if (holes.instanceColor) holes.instanceColor.needsUpdate = true;
  scene.add(holes);

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
    woodTexture?.dispose();
    dimple?.dispose();
    environment.dispose();
    renderer.dispose();
  };

  return { renderer, scene, camera, resize, dispose };
};
