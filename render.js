import { COLORS, FACE, FACE_NAMES } from "./cube.js";

const SIZE = 180;
const CELL = SIZE / 3;
const HALF = SIZE / 2;
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

/** CSS rotate axis + degrees for a normalized move (U, U', U2, …). */
function turnTransform(move) {
  const m = String(move).trim().toUpperCase();
  const face = m[0];
  const suf = m.slice(1);
  let turns = 1;
  if (suf === "'") turns = -1;
  else if (suf === "2") turns = 2;

  // Looking at the face: clockwise = positive for R/U/F in CSS if we pick signs carefully.
  // Empirically tuned for Y-up, Z toward F, X toward R.
  const deg = turns * 90;
  switch (face) {
    case "U":
      return { axis: "Y", deg: -deg };
    case "D":
      return { axis: "Y", deg: deg };
    case "F":
      return { axis: "Z", deg: -deg };
    case "B":
      return { axis: "Z", deg: deg };
    case "L":
      return { axis: "X", deg: deg };
    case "R":
      return { axis: "X", deg: -deg };
    default:
      return { axis: "Y", deg: 0 };
  }
}

function parseMoveFace(move) {
  return String(move).trim().toUpperCase()[0];
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

  /** @type {{ x:number, y:number, z:number, el:HTMLElement, stickers: Record<string, HTMLElement> }[]} */
  const cubies = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        const el = document.createElement("div");
        el.className = "cubie";
        el.style.transform = cubieBaseTransform(x, y, z);
        el.dataset.x = String(x);
        el.dataset.y = String(y);
        el.dataset.z = String(z);

        /** @type {Record<string, HTMLElement>} */
        const stickers = {};
        const faces = [];
        if (y === 1) faces.push("U");
        if (y === -1) faces.push("D");
        if (z === 1) faces.push("F");
        if (z === -1) faces.push("B");
        if (x === -1) faces.push("L");
        if (x === 1) faces.push("R");

        for (const fname of faces) {
          const st = document.createElement("button");
          st.type = "button";
          st.className = `sticker face-${fname}`;
          st.dataset.face = fname;
          st.setAttribute("aria-label", fname);
          el.appendChild(st);
          stickers[fname] = st;
        }

        cube.appendChild(el);
        cubies.push({ x, y, z, el, stickers });
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

  function paint(faces) {
    for (const c of cubies) {
      for (const fname of Object.keys(c.stickers)) {
        const fi = FACE[fname];
        const idx = faceletIndex(fname, c.x, c.y, c.z);
        const color = faces[fi][idx];
        c.stickers[fname].style.background = COLORS[color];
      }
    }
  }

  /**
   * Animate one face turn, then caller should applyMove + paint.
   * @param {string} move
   * @returns {Promise<void>}
   */
  async function animateTurn(move) {
    if (animating) return;
    const face = parseMoveFace(move);
    if (!FACE_NAMES.includes(face)) return;
    const { axis, deg } = turnTransform(move);
    if (!deg) return;

    animating = true;
    const layer = cubies.filter(c => cubiesOnLayer(face, c.x, c.y, c.z));
    const pivot = document.createElement("div");
    pivot.className = "layer-pivot";
    cube.appendChild(pivot);

    for (const c of layer) {
      pivot.appendChild(c.el);
      // Positions stay relative to cube center; cubies already use translate from origin.
    }

    const ms = Math.abs(deg) === 180 ? TURN_MS_180 : TURN_MS;
    // Double-rAF so the browser paints the unrotated pivot before transitioning.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    pivot.style.transition = `transform ${ms}ms cubic-bezier(0.2, 0.7, 0.2, 1)`;
    pivot.style.transform = `rotate${axis}(${deg}deg)`;
    await waitTransition(pivot, ms);

    pivot.style.transition = "none";
    pivot.style.transform = "";
    for (const c of layer) {
      cube.appendChild(c.el);
      c.el.style.transform = cubieBaseTransform(c.x, c.y, c.z);
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
