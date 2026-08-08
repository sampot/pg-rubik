import { COLORS, FACE, FACE_NAMES } from "./cube.js";

const SIZE = 180;
const CELL = SIZE / 3;
const TURN_MS = 220;
const TURN_MS_180 = 300;

/**
 * Facelet index on a face for cubie coords x,y,z ∈ {-1,0,1}.
 * Face layouts match cube.js cycles (0 top-left … 8 bottom-right).
 */
function faceletIndex(face, x, y, z) {
  switch (face) {
    case "U":
      return (z + 1) * 3 + (x + 1);
    case "D":
      return (1 - z) * 3 + (x + 1);
    case "F":
      return (1 - y) * 3 + (x + 1);
    case "B":
      return (1 - y) * 3 + (1 - x);
    case "L":
      return (1 - y) * 3 + (z + 1);
    case "R":
      return (1 - y) * 3 + (1 - z);
    default:
      return 4;
  }
}

function worldFacesAt(x, y, z) {
  const faces = [];
  if (y === 1) faces.push("U");
  if (y === -1) faces.push("D");
  if (z === 1) faces.push("F");
  if (z === -1) faces.push("B");
  if (x === -1) faces.push("L");
  if (x === 1) faces.push("R");
  return faces;
}

function cubiesOnLayer(face, x, y, z) {
  switch (face) {
    case "U":
      return y === 1;
    case "D":
      return y === -1;
    case "F":
      return z === 1;
    case "B":
      return z === -1;
    case "L":
      return x === -1;
    case "R":
      return x === 1;
    default:
      return false;
  }
}

/**
 * CSS transform for a move — must stay in lockstep with commitAfterTurn().
 * Quarter-turn magnitude: 1 | -1 | 2 (positive = CW looking at that face in cube.js).
 */
function turnMotion(move) {
  const m = String(move).trim().toUpperCase();
  const face = m[0];
  const suf = m.slice(1);
  let cw = 1;
  if (suf === "'") cw = -1;
  else if (suf === "2") cw = 2;

  // Map cube.js clockwise (looking at that face) → CSS degrees.
  // Must match commitAfterTurn coords／sticker remap or facelets desync.
  switch (face) {
    case "U":
      return { face, axis: "Y", deg: cw * 90 };
    case "D":
      return { face, axis: "Y", deg: -cw * 90 };
    case "F":
      return { face, axis: "Z", deg: -cw * 90 };
    case "B":
      return { face, axis: "Z", deg: cw * 90 };
    case "L":
      return { face, axis: "X", deg: cw * 90 };
    case "R":
      return { face, axis: "X", deg: -cw * 90 };
    default:
      return { face, axis: "Y", deg: 0 };
  }
}

/** One +90° about axis (right-handed, Y up, Z toward F, X toward R). */
function rot90Plus(axis, x, y, z) {
  if (axis === "X") return { x, y: -z, z: y };
  if (axis === "Y") return { x: z, y, z: -x };
  if (axis === "Z") return { x: -y, y: x, z };
  return { x, y, z };
}

function rotateCoords(x, y, z, axis, deg) {
  const steps = Math.round(deg / 90);
  const n = Math.abs(steps);
  const plus = steps >= 0;
  let p = { x, y, z };
  for (let i = 0; i < n; i++) {
    if (plus) p = rot90Plus(axis, p.x, p.y, p.z);
    else {
      // -90 = 3× +90
      p = rot90Plus(axis, p.x, p.y, p.z);
      p = rot90Plus(axis, p.x, p.y, p.z);
      p = rot90Plus(axis, p.x, p.y, p.z);
    }
  }
  return p;
}

/** Rotate sticker normals the same way as coords. */
function rotateFaceLabel(face, axis, deg) {
  const normals = {
    U: { x: 0, y: 1, z: 0 },
    D: { x: 0, y: -1, z: 0 },
    F: { x: 0, y: 0, z: 1 },
    B: { x: 0, y: 0, z: -1 },
    L: { x: -1, y: 0, z: 0 },
    R: { x: 1, y: 0, z: 0 },
  };
  const n0 = normals[face];
  if (!n0) return face;
  const n = rotateCoords(n0.x, n0.y, n0.z, axis, deg);
  if (n.y === 1) return "U";
  if (n.y === -1) return "D";
  if (n.z === 1) return "F";
  if (n.z === -1) return "B";
  if (n.x === -1) return "L";
  if (n.x === 1) return "R";
  return face;
}

function remapColors(colors, axis, deg) {
  /** @type {Record<string, number>} */
  const next = {};
  for (const [face, color] of Object.entries(colors)) {
    next[rotateFaceLabel(face, axis, deg)] = color;
  }
  return next;
}

function cubieBaseTransform(x, y, z) {
  return `translate3d(${x * CELL}px, ${-y * CELL}px, ${z * CELL}px)`;
}

function waitTransition(el, ms) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener("transitionend", onEnd);
      resolve();
    };
    const onEnd = e => {
      if (e.target === el && e.propertyName === "transform") finish();
    };
    el.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, ms + 80);
  });
}

/**
 * Build CSS 3D cube from 26 cubies. Orbit on .cube-orbit.
 * @param {HTMLElement} root
 */
export function mountCube(root) {
  root.innerHTML = "";
  root.classList.add("cube-scene");

  const orbit = document.createElement("div");
  orbit.className = "cube-orbit";
  const cube = document.createElement("div");
  cube.className = "cube";

  /**
   * @type {{
   *   x:number, y:number, z:number,
   *   el:HTMLElement,
   *   stickers: Record<string, HTMLElement>,
   *   colors: Record<string, number>
   * }[]}
   */
  const cubies = [];

  function createSticker(face, color) {
    const st = document.createElement("button");
    st.type = "button";
    st.className = `sticker face-${face}`;
    st.dataset.face = face;
    st.setAttribute("aria-label", face);
    st.style.background = COLORS[color];
    return st;
  }

  function applyCubieVisual(c) {
    c.el.style.transform = cubieBaseTransform(c.x, c.y, c.z);
    c.el.dataset.x = String(c.x);
    c.el.dataset.y = String(c.y);
    c.el.dataset.z = String(c.z);
    c.el.innerHTML = "";
    c.stickers = {};
    for (const [face, color] of Object.entries(c.colors)) {
      const st = createSticker(face, color);
      c.stickers[face] = st;
      c.el.appendChild(st);
    }
  }

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        const el = document.createElement("div");
        el.className = "cubie";
        /** @type {Record<string, number>} */
        const colors = {};
        for (const f of worldFacesAt(x, y, z)) {
          colors[f] = FACE[f];
        }
        const c = { x, y, z, el, stickers: {}, colors };
        applyCubieVisual(c);
        cube.appendChild(el);
        cubies.push(c);
      }
    }
  }

  orbit.appendChild(cube);
  root.appendChild(orbit);

  let rotX = -28;
  let rotY = 38;
  const applyOrbit = () => {
    orbit.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  };
  applyOrbit();

  let animating = false;

  /** Sync cubie colors／slots from facelet model (scramble／reset／load). */
  function paint(faces) {
    for (const c of cubies) {
      /** @type {Record<string, number>} */
      const colors = {};
      for (const fname of worldFacesAt(c.x, c.y, c.z)) {
        const fi = FACE[fname];
        const idx = faceletIndex(fname, c.x, c.y, c.z);
        colors[fname] = faces[fi][idx];
      }
      c.colors = colors;
      applyCubieVisual(c);
    }
  }

  /**
   * Animate a turn, then move cubies to the post-rotation slots (no recolor snap).
   * @param {string} move
   */
  async function animateTurn(move) {
    if (animating) return;
    const motion = turnMotion(move);
    if (!motion.deg) return;
    const { face, axis, deg } = motion;

    animating = true;
    const layer = cubies.filter(c => cubiesOnLayer(face, c.x, c.y, c.z));
    const pivot = document.createElement("div");
    pivot.className = "layer-pivot";
    cube.appendChild(pivot);

    for (const c of layer) {
      pivot.appendChild(c.el);
    }

    const ms = Math.abs(deg) === 180 ? TURN_MS_180 : TURN_MS;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    pivot.style.transition = `transform ${ms}ms cubic-bezier(0.2, 0.7, 0.2, 1)`;
    pivot.style.transform = `rotate${axis}(${deg}deg)`;
    await waitTransition(pivot, ms);

    // Commit logical cubie pose to match the finished CSS rotation, then
    // drop the pivot at identity — visuals stay continuous (no paint snap).
    pivot.style.transition = "none";
    for (const c of layer) {
      const next = rotateCoords(c.x, c.y, c.z, axis, deg);
      c.colors = remapColors(c.colors, axis, deg);
      c.x = next.x;
      c.y = next.y;
      c.z = next.z;
      applyCubieVisual(c);
      cube.appendChild(c.el);
    }
    pivot.style.transform = "";
    pivot.remove();
    animating = false;
  }

  return {
    paint,
    animateTurn,
    isAnimating: () => animating,
    setOrbit(x, y) {
      rotX = Math.max(-80, Math.min(80, x));
      rotY = y;
      applyOrbit();
    },
    getOrbit: () => ({ x: rotX, y: rotY }),
    orbitEl: orbit,
  };
}
