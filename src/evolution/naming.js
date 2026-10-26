import { hashFloatArray, safeNum } from '../core/utils.js';

const LETTERS = 'ABCDEFGHJKLMNPQR';
const N = 626;   // new brain param count (24*20 + 20 + 20*6 + 6)
const MAX_RADIUS = 500;

let projA = null, projB = null;

function init() {
     if (projA) return;
     projA = new Float32Array(N);
     projB = new Float32Array(N);
     let s = 0x1A2B3C4D;
     for (let i = 0; i < N; i++) {
          s = (s * 1103515245 + 12345) & 0x7fffffff;
          projA[i] = (s / 0x7fffffff) * 2 - 1;
          s = (s * 1103515245 + 12345) & 0x7fffffff;
          projB[i] = (s / 0x7fffffff) * 2 - 1;
     }
}

export function getTaxonomy(genome) {
     init();
     const w = genome?.brain?.w;
     if (!w || w.length !== N) return { letter: 'A', number: 0, numberStr: '000', hue: 0 };

     let x = 0, y = 0;
     for (let i = 0; i < N; i++) {
          x += safeNum(w[i]) * projA[i];
          y += safeNum(w[i]) * projB[i];
     }
     const angle = Math.atan2(y, x);
     const norm = (angle + Math.PI) / (Math.PI * 2);
     const letter = LETTERS[Math.min(15, Math.max(0, Math.floor(norm * 16)))];
     const radius = Math.sqrt(x * x + y * y);
     const number = Math.abs(Math.floor((radius / MAX_RADIUS) * 1000)) % 1000;
     const hue = Math.floor(norm * 360) % 360;
     return { letter, number, numberStr: String(number).padStart(3, '0'), hue };
}

export function getSpeciesId(genome) {
     const t = getTaxonomy(genome);
     return `${t.letter}-${t.numberStr}`;
}

export function getFullId(genome) {
     const t = getTaxonomy(genome);
     const hash = hashFloatArray(genome?.brain?.w || []);
     const suffix = (hash % 46656).toString(36).toUpperCase().padStart(3, '0');
     return `${t.letter}-${t.numberStr}-${suffix}`;
}

export function getColor(genome, energyFrac = 1) {
     const t = getTaxonomy(genome);
     const l = Math.max(20, Math.min(78, 22 + safeNum(energyFrac) * 55));
     return `hsl(${t.hue}, 68%, ${l}%)`;
}

export function getHue(genome) {
     return getTaxonomy(genome).hue;
}