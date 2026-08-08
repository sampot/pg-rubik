import { COLORS, FACE, FACE_NAMES } from "./cube.js";

const CELL = 180 / 3;
const TURN_MS = 360;
const TURN_MS_180 = 480;

/** @typedef {[number, number, number]} Vec3 */
/** @typedef {[Vec3, Vec3, Vec3]} Mat3 */

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

function matIdentity() {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

function matMul(a, b) {
  const r = matIdentity();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    }
  }
  return r;
}

function matMulVec(m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** Right-handed rotation by mathDeg (multiples of 90) about axis. */
function matRotateAxis(axis, mathDeg) {
  const steps = ((Math.round(mathDeg / 90) % 4) + 4) % 4;
  let m = matIdentity();
  for (let s = 0; s < steps; s++) {
    /** @type {Mat3} */
    let r;
    if (axis === "X") {
      // +90 about X: y'=-z, z'=y
      r = [
        [1, 0, 0],
        [0, 0, -1],
        [0, 1, 0],
      ];
    } else if (axis === "Y") {
      // +90 about Y: x'=z, z'=-x
      r = [
        [0, 0, 1],
        [0, 1, 0],
        [-1, 0, 0],
      ];
    } else {
      // +90 about Z: x'=-y, y'=x
      r = [
        [0, -1, 0],
        [1, 0, 0],
        [0, 0, 1],
      ];
    }
    m = matMul(r, m);
  }
  return m;
}

function roundVec(v) {
  return [Math.round(v[0]), Math.round(v[1]), Math.round(v[2])];
}

/**
 * Math CW (cube.js) → axis + mathDeg (right-handed, +Y up).
 * CSS has +Y down; conjugating by S=diag(1,-1,1) → CSS angle:
 *   Y: same as mathDeg; X／Z: negate.
 */
function turnMotion(move) {
  const m = String(move).trim().toUpperCase();
  const face = m[0];
  const suf = m.slice(1);
  let cw = 1;
  if (suf === "'") cw = -1;
  else if (suf === "2") cw = 2;

  switch (face) {
    case "U":
      return { face, axis: "Y", mathDeg: cw * 90 };
    case "D":
      return { face, axis: "Y", mathDeg: -cw * 90 };
    case "F":
      return { face, axis: "Z", mathDeg: -cw * 90 };
    case "B":
      return { face, axis: "Z", mathDeg: cw * 90 };
    case "L":
      return { face, axis: "X", mathDeg: cw * 90 };
    case "R":
      return { face, axis: "X", mathDeg: -cw * 90 };
    default:
      return { face, axis: "Y", mathDeg: 0 };
  }
}

/** CSS rotate* angle that matches matMathToCss(matRotateAxis(axis, mathDeg)). */
function cssDegForAxis(axis, mathDeg) {
  return axis === "Y" ? mathDeg : -mathDeg;
}

/** Map math-space rotation (+Y up) into CSS matrix3d space (+Y down). */
function matMathToCss(m) {
  const s = [1, -1, 1];
  const r = matIdentity();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i][j] = s[i] * m[i][j] * s[j];
    }
  }
  return r;
}

/** Local +X/+Y/+Z sticker → world face name from cubie rotation. */
function localToWorldFace(localFace, rot) {
  const local = {
    R: [1, 0, 0],
    L: [-1, 0, 0],
    U: [0, 1, 0],
    D: [0, -1, 0],
    F: [0, 0, 1],
    B: [0, 0, -1],
  }[localFace];
  if (!local) return localFace;
  const [x, y, z] = roundVec(matMulVec(rot, local));
  if (y === 1) return "U";
  if (y === -1) return "D";
  if (z === 1) return "F";
  if (z === -1) return "B";
  if (x === -1) return "L";
  if (x === 1) return "R";
  return localFace;
}

function cubieCssTransform(x, y, z, rotMath) {
  // matrix3d is column-major; rot is math-space, convert for CSS +Y-down.
  const m = matMathToCss(rotMath);
  const tx = x * CELL;
  const ty = -y * CELL;
  const tz = z * CELL;
  return `matrix3d(${m[0][0]},${m[1][0]},${m[2][0]},0,${m[0][1]},${m[1][1]},${m[2][1]},0,${m[0][2]},${m[1][2]},${m[2][2]},0,${tx},${ty},${tz},1)`;
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
   * Physical cubie: sticker colors are fixed on LOCAL faces; only pos＋rot change.
   * @type {{
   *   x:number, y:number, z:number,
   *   rot: Mat3,
   *   el: HTMLElement,
   *   stickers: Record<string, HTMLElement>,
   *   localColors: Record<string, number>
   * }[]}
   */
  const cubies = [];

  function createSticker(localFace, color) {
    const st = document.createElement("button");
    st.type = "button";
    st.className = `sticker face-${localFace}`;
    st.dataset.localFace = localFace;
    st.style.background = COLORS[color];
    st.addEventListener("click", e => {
      e.stopPropagation();
      const cubie = cubies.find(c => c.stickers[localFace] === st);
      if (!cubie) return;
      const world = localToWorldFace(localFace, cubie.rot);
      st.dataset.face = world;
      root.dispatchEvent(
        new CustomEvent("cubie-face-click", { detail: { face: world } })
      );
    });
    return st;
  }

  function applyCubieTransform(c) {
    c.el.style.transform = cubieCssTransform(c.x, c.y, c.z, c.rot);
    // Expose world face on stickers for accessibility／fallback
    for (const [local, st] of Object.entries(c.stickers)) {
      const world = localToWorldFace(local, c.rot);
      st.dataset.face = world;
      st.setAttribute("aria-label", world);
    }
  }

  function mountStickers(c) {
    c.el.innerHTML = "";
    c.stickers = {};
    for (const [local, color] of Object.entries(c.localColors)) {
      const st = createSticker(local, color);
      c.stickers[local] = st;
      c.el.appendChild(st);
    }
    applyCubieTransform(c);
  }

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        const el = document.createElement("div");
        el.className = "cubie";
        /** @type {Record<string, number>} */
        const localColors = {};
        for (const f of worldFacesAt(x, y, z)) {
          localColors[f] = FACE[f];
        }
        const c = {
          x,
          y,
          z,
          rot: matIdentity(),
          el,
          stickers: {},
          localColors,
        };
        mountStickers(c);
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

  /**
   * Reset cubies from facelets (scramble／reset). Stickers recolored; rot = I.
   * @param {number[][]} faces
   */
  function paint(faces) {
    let i = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const c = cubies[i++];
          c.x = x;
          c.y = y;
          c.z = z;
          c.rot = matIdentity();
          /** @type {Record<string, number>} */
          const localColors = {};
          for (const fname of worldFacesAt(x, y, z)) {
            localColors[fname] =
              faces[FACE[fname]][faceletIndex(fname, x, y, z)];
          }
          c.localColors = localColors;
          mountStickers(c);
          if (c.el.parentElement !== cube) cube.appendChild(c.el);
        }
      }
    }
  }

  /**
   * @param {string} move
   */
  async function animateTurn(move) {
    if (animating) return;
    const motion = turnMotion(move);
    if (!motion.mathDeg) return;
    const { face, axis, mathDeg } = motion;
    const cssDeg = cssDegForAxis(axis, mathDeg);
    const R = matRotateAxis(axis, mathDeg);

    animating = true;
    const layer = cubies.filter(c => cubiesOnLayer(face, c.x, c.y, c.z));
    const pivot = document.createElement("div");
    pivot.className = "layer-pivot";
    cube.appendChild(pivot);

    for (const c of layer) {
      pivot.appendChild(c.el);
    }

    const ms = Math.abs(mathDeg) === 180 ? TURN_MS_180 : TURN_MS;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Ease-in-out: less snappy than hard ease-out (felt like a jump).
    pivot.style.transition = `transform ${ms}ms cubic-bezier(0.4, 0.05, 0.2, 1)`;
    pivot.style.transform = `rotate${axis}(${cssDeg}deg)`;
    await waitTransition(pivot, ms);

    // Bake math pose to match the finished CSS turn. Sticker DOM never changes.
    pivot.style.transition = "none";
    for (const c of layer) {
      const p = roundVec(matMulVec(R, [c.x, c.y, c.z]));
      c.x = p[0];
      c.y = p[1];
      c.z = p[2];
      c.rot = matMul(R, c.rot);
      applyCubieTransform(c);
      cube.appendChild(c.el);
    }
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
