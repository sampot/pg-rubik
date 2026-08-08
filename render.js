import { COLORS, FACE_NAMES } from "./cube.js";

const SIZE = 180;
const HALF = SIZE / 2;

/**
 * Build CSS 3D cube (6 faces × 9 stickers). Orbit on .cube-orbit.
 * @param {HTMLElement} root
 */
export function mountCube(root) {
  root.innerHTML = "";
  root.classList.add("cube-scene");

  const orbit = document.createElement("div");
  orbit.className = "cube-orbit";
  const cube = document.createElement("div");
  cube.className = "cube";

  /** @type {HTMLElement[][]} */
  const stickers = FACE_NAMES.map(() => []);

  const faceTransforms = {
    U: `rotateX(90deg) translateZ(${HALF}px)`,
    D: `rotateX(-90deg) translateZ(${HALF}px)`,
    F: `translateZ(${HALF}px)`,
    B: `rotateY(180deg) translateZ(${HALF}px)`,
    L: `rotateY(-90deg) translateZ(${HALF}px)`,
    R: `rotateY(90deg) translateZ(${HALF}px)`,
  };

  for (let fi = 0; fi < 6; fi++) {
    const name = FACE_NAMES[fi];
    const face = document.createElement("div");
    face.className = `cube-face face-${name}`;
    face.style.transform = faceTransforms[name];
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sticker";
      cell.dataset.face = name;
      cell.dataset.index = String(i);
      cell.setAttribute("aria-label", `${name} ${i + 1}`);
      face.appendChild(cell);
      stickers[fi].push(cell);
    }
    cube.appendChild(face);
  }

  orbit.appendChild(cube);
  root.appendChild(orbit);

  let rotX = -28;
  let rotY = 38;
  const applyOrbit = () => {
    orbit.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  };
  applyOrbit();

  return {
    stickers,
    paint(faces) {
      for (let fi = 0; fi < 6; fi++) {
        for (let i = 0; i < 9; i++) {
          const c = faces[fi][i];
          stickers[fi][i].style.background = COLORS[c];
        }
      }
    },
    setOrbit(x, y) {
      rotX = Math.max(-80, Math.min(80, x));
      rotY = y;
      applyOrbit();
    },
    getOrbit: () => ({ x: rotX, y: rotY }),
    orbitEl: orbit,
  };
}
