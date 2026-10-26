function mulberry32(seed) {
     let state = seed >>> 0;
     return function () {
          state = (state + 0x6d2b79f5) | 0;
          let t = Math.imul(state ^ (state >>> 15), 1 | state);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
     };
}

let _rand = Math.random;

export function seed(s) {
     const safe = Number.isFinite(s) && s > 0 ? s >>> 0 : 1;
     _rand = mulberry32(safe);
     for (let i = 0; i < 10; i++) _rand();
}

export function rand() {
     const v = _rand();
     return Number.isFinite(v) ? v : 0.5;
}

export function randRange(lo, hi) { return lo + rand() * (hi - lo); }
export function randInt(lo, hi) { return Math.floor(randRange(lo, hi + 1)); }
export function randPick(arr) {
     if (!arr || arr.length === 0) return null;
     return arr[Math.floor(rand() * arr.length)];
}

export function randNormal(mean = 0, sd = 1) {
     let u = 0, v = 0;
     while (u === 0) u = rand();
     while (v === 0) v = rand();
     const n = mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
     return Number.isFinite(n) ? n : mean;
}