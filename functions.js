/**
 * pg-rubik — scores／prefs via env.KV (Playgrounds／go／future Tauri).
 */

const SCORES_KEY = "scores:v1";
const PREFS_KEY = "prefs:v1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function error(message, status = 400, code = "bad_request") {
  return json({ ok: false, error: message, code }, status);
}

async function readJson(env, key, fallback) {
  if (!env?.KV || typeof env.KV.get !== "function") return fallback;
  try {
    const v = await env.KV.get(key, "json");
    return v && typeof v === "object" ? v : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(env, key, value) {
  if (!env?.KV || typeof env.KV.put !== "function") {
    throw new Error("kv_unavailable");
  }
  await env.KV.put(key, JSON.stringify(value));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "GET" && (path === "/api" || path === "/api/meta")) {
      return json({ ok: true, name: "pg-rubik", kv: Boolean(env?.KV) });
    }

    if (path === "/api/scores") {
      if (request.method === "GET") {
        const scores = await readJson(env, SCORES_KEY, {
          bestTimeMs: null,
          bestMoves: null,
        });
        return json({ ok: true, scores });
      }
      if (request.method === "PUT" || request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return error("invalid JSON");
        }
        const timeMs = Number(body?.timeMs);
        const moves = Number(body?.moves);
        if (!Number.isFinite(timeMs) || timeMs < 0) {
          return error("timeMs required");
        }
        if (!Number.isFinite(moves) || moves < 0) {
          return error("moves required");
        }
        const prev = await readJson(env, SCORES_KEY, {
          bestTimeMs: null,
          bestMoves: null,
        });
        const next = { ...prev };
        if (prev.bestTimeMs == null || timeMs < prev.bestTimeMs) {
          next.bestTimeMs = Math.round(timeMs);
        }
        if (prev.bestMoves == null || moves < prev.bestMoves) {
          next.bestMoves = Math.round(moves);
        }
        try {
          await writeJson(env, SCORES_KEY, next);
        } catch {
          return error("env.KV 不可用", 503, "kv_unavailable");
        }
        return json({ ok: true, scores: next });
      }
      if (request.method === "DELETE") {
        try {
          await writeJson(env, SCORES_KEY, {
            bestTimeMs: null,
            bestMoves: null,
          });
        } catch {
          return error("env.KV 不可用", 503, "kv_unavailable");
        }
        return json({
          ok: true,
          scores: { bestTimeMs: null, bestMoves: null },
        });
      }
    }

    if (path === "/api/prefs") {
      if (request.method === "GET") {
        const prefs = await readJson(env, PREFS_KEY, { sound: true });
        return json({ ok: true, prefs });
      }
      if (request.method === "PUT" || request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return error("invalid JSON");
        }
        const prev = await readJson(env, PREFS_KEY, { sound: true });
        const next = {
          sound: body?.sound === undefined ? prev.sound : Boolean(body.sound),
        };
        try {
          await writeJson(env, PREFS_KEY, next);
        } catch {
          return error("env.KV 不可用", 503, "kv_unavailable");
        }
        return json({ ok: true, prefs: next });
      }
    }

    return error("not found", 404, "not_found");
  },
};
