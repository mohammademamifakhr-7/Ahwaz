export function safeNum(v, fallback = 0) {
     return Number.isFinite(v) ? v : fallback;
}

export function clamp(v, lo, hi) {
     const n = safeNum(v, lo);
     return n < lo ? lo : n > hi ? hi : n;
}

export function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }

export function dist2(x1, y1, x2, y2) {
     const dx = safeNum(x1) - safeNum(x2);
     const dy = safeNum(y1) - safeNum(y2);
     return dx * dx + dy * dy;
}

export function safeDiv(a, b, fallback = 0) {
     if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback;
     const r = a / b;
     return Number.isFinite(r) ? r : fallback;
}

export function wrapAngle(a) {
     let v = safeNum(a);
     while (v > Math.PI) v -= Math.PI * 2;
     while (v < -Math.PI) v += Math.PI * 2;
     return v;
}

export function hashFloatArray(arr) {
     if (!arr || arr.length === 0) return 0;
     let hash = 2166136261;
     for (let i = 0; i < arr.length; i += 3) {
          const v = Math.floor(safeNum(arr[i]) * 10000) | 0;
          hash ^= v;
          hash = Math.imul(hash, 16777619);
     }
     return hash >>> 0;
}

export function pickRandom(arr) {
     if (!arr || arr.length === 0) return null;
     return arr[Math.floor(Math.random() * arr.length)];
}

export function formatTime(seconds) {
     const s = Math.max(0, Math.floor(safeNum(seconds, 0)));
     const h = Math.floor(s / 3600);
     const m = Math.floor((s % 3600) / 60);
     const sec = s % 60;
     return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}