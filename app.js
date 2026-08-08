import {
  applyMove,
  applyMoves,
  invertMove,
  isSolved,
  scrambleMoves,
  solvedCube,
} from "./cube.js";
import { mountCube } from "./render.js";

const $ = id => document.getElementById(id);

async function api(path, init) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || "api error");
  return data;
}

function formatMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `0:${String(r).padStart(2, "0")}`;
}

function main() {
  const scene = $("cube-root");
  const status = $("status");
  const movesEl = $("moves");
  const timeEl = $("time");
  const bestEl = $("best");
  const confirmEl = $("confirm");
  const view = mountCube(scene);

  let faces = solvedCube();
  let history = [];
  let moves = 0;
  let timerStarted = null;
  let timerAcc = 0;
  let ticking = null;
  let soundOn = true;
  let busy = false;
  let solvedLatched = true;

  view.paint(faces);

  function setStatus(msg) {
    status.textContent = msg;
  }

  function refreshMeters() {
    movesEl.textContent = String(moves);
    const ms = timerStarted != null ? timerAcc + (Date.now() - timerStarted) : timerAcc;
    timeEl.textContent = formatMs(ms);
  }

  function startTimer() {
    if (timerStarted != null || solvedLatched) return;
    timerStarted = Date.now();
    ticking = window.setInterval(refreshMeters, 200);
  }

  function stopTimer() {
    if (timerStarted != null) {
      timerAcc += Date.now() - timerStarted;
      timerStarted = null;
    }
    if (ticking) {
      clearInterval(ticking);
      ticking = null;
    }
    refreshMeters();
  }

  function beep() {
    if (!soundOn) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 520;
      g.gain.value = 0.04;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.04);
      window.setTimeout(() => ctx.close(), 100);
    } catch {
      /* ignore */
    }
  }

  async function loadScores() {
    try {
      const data = await api("/api/scores");
      const s = data.scores || {};
      bestEl.textContent =
        s.bestTimeMs != null
          ? `${formatMs(s.bestTimeMs)}${s.bestMoves != null ? ` · ${s.bestMoves} 步` : ""}`
          : "—";
    } catch {
      bestEl.textContent = "—";
    }
  }

  async function loadPrefs() {
    try {
      const data = await api("/api/prefs");
      soundOn = data.prefs?.sound !== false;
      $("btn-mute").textContent = soundOn ? "音效開" : "音效關";
      $("btn-mute").setAttribute("aria-pressed", soundOn ? "true" : "false");
    } catch {
      /* offline stub */
    }
  }

  async function onSolved() {
    stopTimer();
    solvedLatched = true;
    setStatus("還原！");
    beep();
    try {
      await api("/api/scores", {
        method: "PUT",
        body: JSON.stringify({ timeMs: timerAcc, moves }),
      });
      await loadScores();
    } catch {
      setStatus("還原！（最佳紀錄未寫入——需要 functions／KV）");
    }
  }

  function afterMove() {
    refreshMeters();
    view.paint(faces);
    if (!solvedLatched && isSolved(faces)) {
      void onSolved();
    }
  }

  function doMove(move) {
    if (busy) return;
    if (solvedLatched && isSolved(faces)) {
      // allow turning a solved cube (restarts play)
      solvedLatched = false;
      moves = 0;
      timerAcc = 0;
      timerStarted = null;
      history = [];
    }
    const norm = applyMove(faces, move);
    history.push(norm);
    moves += 1;
    startTimer();
    beep();
    afterMove();
    setStatus(`轉了 ${norm}`);
  }

  function scramble() {
    if (busy) return;
    stopTimer();
    faces = solvedCube();
    const seq = scrambleMoves(22);
    applyMoves(faces, seq);
    history = [];
    moves = 0;
    timerAcc = 0;
    timerStarted = null;
    solvedLatched = false;
    view.paint(faces);
    refreshMeters();
    setStatus("已打亂——拖曳空白轉看，下方按鈕轉層");
  }

  function undo() {
    if (busy || !history.length) return;
    const last = history.pop();
    applyMove(faces, invertMove(last));
    moves = Math.max(0, moves - 1);
    afterMove();
    setStatus("復原一步");
  }

  function resetSolved() {
    stopTimer();
    faces = solvedCube();
    history = [];
    moves = 0;
    timerAcc = 0;
    solvedLatched = true;
    view.paint(faces);
    refreshMeters();
    setStatus("已重置為還原狀態");
    confirmEl.hidden = true;
  }

  // Orbit: drag on scene background
  let drag = null;
  scene.addEventListener("pointerdown", e => {
    if (e.target.closest(".sticker")) return;
    const o = view.getOrbit();
    drag = { x: e.clientX, y: e.clientY, ox: o.x, oy: o.y };
    scene.setPointerCapture(e.pointerId);
  });
  scene.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    view.setOrbit(drag.ox - dy * 0.4, drag.oy + dx * 0.4);
  });
  scene.addEventListener("pointerup", () => {
    drag = null;
  });
  scene.addEventListener("pointercancel", () => {
    drag = null;
  });

  // Sticker tap → turn that face clockwise (simple mobile path)
  scene.addEventListener("click", e => {
    const st = e.target.closest(".sticker");
    if (!st) return;
    const face = st.dataset.face;
    if (face) doMove(face);
  });

  $("btn-scramble").addEventListener("click", scramble);
  $("btn-undo").addEventListener("click", undo);
  $("btn-reset").addEventListener("click", () => {
    confirmEl.hidden = false;
  });
  $("btn-confirm-cancel").addEventListener("click", () => {
    confirmEl.hidden = true;
  });
  $("btn-confirm-ok").addEventListener("click", resetSolved);
  $("btn-mute").addEventListener("click", async () => {
    soundOn = !soundOn;
    $("btn-mute").textContent = soundOn ? "音效開" : "音效關";
    $("btn-mute").setAttribute("aria-pressed", soundOn ? "true" : "false");
    try {
      await api("/api/prefs", {
        method: "PUT",
        body: JSON.stringify({ sound: soundOn }),
      });
    } catch {
      /* ignore */
    }
  });

  for (const btn of document.querySelectorAll("[data-move]")) {
    btn.addEventListener("click", () => doMove(btn.getAttribute("data-move")));
  }

  refreshMeters();
  void loadScores();
  void loadPrefs();
  setStatus("拖曳轉看；點色塊或下方按鈕轉層；「打亂」開始計時");
}

main();
