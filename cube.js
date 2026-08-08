/**
 * 3×3 facelet model + moves (U D L R F B and ' / 2).
 * Faces: U=0 D=1 F=2 B=3 L=4 R=5. Colors match face centers.
 */

export const FACE = { U: 0, D: 1, F: 2, B: 3, L: 4, R: 5 };
export const FACE_NAMES = ["U", "D", "F", "B", "L", "R"];
export const COLORS = ["#f5f5f5", "#f6d32d", "#3d9a5f", "#3b6fd6", "#e89a2b", "#d64545"];

/** @returns {number[][]} six faces × 9 stickers */
export function solvedCube() {
  return FACE_NAMES.map((_, fi) => Array(9).fill(fi));
}

export function cloneCube(faces) {
  return faces.map(f => f.slice());
}

export function isSolved(faces) {
  return faces.every((face, fi) => face.every(c => c === fi));
}

function rotateFace(face, times) {
  const t = ((times % 4) + 4) % 4;
  let f = face.slice();
  for (let n = 0; n < t; n++) {
    const o = f.slice();
    f = [o[6], o[3], o[0], o[7], o[4], o[1], o[8], o[5], o[2]];
  }
  return f;
}

/** One 4-cycle of sticker slots: a→b→c→d→a per quarter turn. */
function cycle4(faces, a, b, c, d, times) {
  const slots = [a, b, c, d];
  const t = ((times % 4) + 4) % 4;
  for (let n = 0; n < t; n++) {
    const vals = slots.map(([fi, i]) => faces[fi][i]);
    for (let i = 0; i < 4; i++) {
      const [fi, idx] = slots[(i + 1) % 4];
      faces[fi][idx] = vals[i];
    }
  }
}

/**
 * Apply one move in place. move like "U", "R'", "F2".
 * @returns {string} normalized move
 */
export function applyMove(faces, move) {
  const m = String(move || "").trim().toUpperCase();
  const faceCh = m[0];
  const suf = m.slice(1);
  let times = 1;
  if (suf === "'") times = 3;
  else if (suf === "2") times = 2;
  else if (suf !== "") throw new Error(`bad move: ${move}`);

  const fi = FACE[faceCh];
  if (fi === undefined) throw new Error(`bad move: ${move}`);

  faces[fi] = rotateFace(faces[fi], times);

  // Side cycles (clockwise looking at that face)
  if (faceCh === "U") {
    cycle4(faces, [FACE.F, 0], [FACE.R, 0], [FACE.B, 0], [FACE.L, 0], times);
    cycle4(faces, [FACE.F, 1], [FACE.R, 1], [FACE.B, 1], [FACE.L, 1], times);
    cycle4(faces, [FACE.F, 2], [FACE.R, 2], [FACE.B, 2], [FACE.L, 2], times);
  } else if (faceCh === "D") {
    cycle4(faces, [FACE.F, 6], [FACE.L, 6], [FACE.B, 6], [FACE.R, 6], times);
    cycle4(faces, [FACE.F, 7], [FACE.L, 7], [FACE.B, 7], [FACE.R, 7], times);
    cycle4(faces, [FACE.F, 8], [FACE.L, 8], [FACE.B, 8], [FACE.R, 8], times);
  } else if (faceCh === "F") {
    cycle4(faces, [FACE.U, 6], [FACE.R, 0], [FACE.D, 2], [FACE.L, 8], times);
    cycle4(faces, [FACE.U, 7], [FACE.R, 3], [FACE.D, 1], [FACE.L, 5], times);
    cycle4(faces, [FACE.U, 8], [FACE.R, 6], [FACE.D, 0], [FACE.L, 2], times);
  } else if (faceCh === "B") {
    cycle4(faces, [FACE.U, 2], [FACE.L, 0], [FACE.D, 6], [FACE.R, 8], times);
    cycle4(faces, [FACE.U, 1], [FACE.L, 3], [FACE.D, 7], [FACE.R, 5], times);
    cycle4(faces, [FACE.U, 0], [FACE.L, 6], [FACE.D, 8], [FACE.R, 2], times);
  } else if (faceCh === "L") {
    cycle4(faces, [FACE.U, 0], [FACE.F, 0], [FACE.D, 0], [FACE.B, 8], times);
    cycle4(faces, [FACE.U, 3], [FACE.F, 3], [FACE.D, 3], [FACE.B, 5], times);
    cycle4(faces, [FACE.U, 6], [FACE.F, 6], [FACE.D, 6], [FACE.B, 2], times);
  } else if (faceCh === "R") {
    cycle4(faces, [FACE.U, 8], [FACE.B, 0], [FACE.D, 8], [FACE.F, 8], times);
    cycle4(faces, [FACE.U, 5], [FACE.B, 3], [FACE.D, 5], [FACE.F, 5], times);
    cycle4(faces, [FACE.U, 2], [FACE.B, 6], [FACE.D, 2], [FACE.F, 2], times);
  }

  return times === 1 ? faceCh : times === 2 ? faceCh + "2" : faceCh + "'";
}

export function invertMove(move) {
  const m = String(move).trim().toUpperCase();
  if (m.endsWith("2")) return m;
  if (m.endsWith("'")) return m.slice(0, -1);
  return m + "'";
}

const FACES = ["U", "D", "L", "R", "F", "B"];

/** Random legal scramble; avoid consecutive same face. */
export function scrambleMoves(n = 22) {
  const out = [];
  let last = "";
  for (let i = 0; i < n; i++) {
    let f;
    do {
      f = FACES[(Math.random() * FACES.length) | 0];
    } while (f === last);
    last = f;
    const suf = ["", "'", "2"][(Math.random() * 3) | 0];
    out.push(f + suf);
  }
  return out;
}

export function applyMoves(faces, moves) {
  for (const m of moves) applyMove(faces, m);
  return faces;
}
