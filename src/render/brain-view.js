const POS = '#14b8a6';   // positive = teal
const NEG = '#f59e0b';   // negative = orange
const LABEL_COLOR = '#8b98a8';
const VALUE_COLOR = '#e6edf5';
const MEM_COLOR = '#a78bfa';

// Labels for 24 inputs (short, Mahan-style)
const INPUT_LABELS = [
     'energy',   // 0
     'hunger',   // 1
     'light',    // 2
     'zone',     // 3
     'wall',     // 4
     'corp sig', // 5
     'corp sin', // 6
     'corp cos', // 7
     'cell sig', // 8
     'cell sin', // 9
     'cell cos', // 10
     'size rt',  // 11
     'cell vF',  // 12 (velocity forward)
     'cell vS',  // 13 (velocity side)
     'gen sim',  // 14 (genetic similarity)
     'kin',      // 15
     'stranger', // 16
     'has pho',  // 17
     'has sto',  // 18
     'has hun',  // 19
     'age',      // 20
     'offspring',// 21
     'mem 1',    // 22
     'mem 2',    // 23
];

// Labels for 6 outputs
const OUTPUT_LABELS = [
     'turn',       // 0
     'throttle',   // 1
     'aggression', // 2
     'share',      // 3
     'mem 1',      // 4
     'mem 2',      // 5
];

export class BrainView {
     constructor(canvas) {
          this.canvas = canvas;
          this.ctx = canvas.getContext('2d');
          this.dpr = Math.min(2, window.devicePixelRatio || 1);
     }

     _resize() {
          const rect = this.canvas.getBoundingClientRect();
          if (rect.width === 0) return;
          this.canvas.width = rect.width * this.dpr;
          this.canvas.height = rect.height * this.dpr;
          this.W = rect.width;
          this.H = rect.height;
     }

     draw(brain) {
          this._resize();
          const ctx = this.ctx;
          if (!ctx || !this.W) return;
          const W = this.canvas.width;
          const H = this.canvas.height;

          ctx.fillStyle = '#080b10';
          ctx.fillRect(0, 0, W, H);
          if (!brain) return;

          const IN = brain.in.length;   // 24
          const HID = brain.hid.length; // 20
          const OUT = brain.out.length; // 6
          const dpr = this.dpr;

          // Layout — leave room for labels
          const xIn = 95 * dpr;
          const xHid = 200 * dpr;
          const xOut = W - 105 * dpr;

          const top = 30 * dpr;
          const bot = H - 30 * dpr;
          const span = bot - top;

          // Input node positions (24 across the left)
          const yIn = i => top + (span / (IN - 1)) * i;
          // Hidden (20 across the middle, indented to center)
          const hidSpan = span * 0.85;
          const hidTop = top + (span - hidSpan) / 2;
          const yHid = i => hidTop + (hidSpan / (HID - 1)) * i;
          // Output (6 across the right)
          const outSpan = span * 0.7;
          const outTop = top + (span - outSpan) / 2;
          const yOut = i => outTop + (outSpan / (OUT - 1)) * i;

          // Draw connections (behind nodes)
          ctx.lineWidth = 0.6 * dpr;

          // Input → Hidden
          for (let h = 0; h < HID; h++) {
               for (let i = 0; i < IN; i++) {
                    const w = brain.w[h * IN + i];
                    if (!Number.isFinite(w) || Math.abs(w) < 0.35) continue;
                    const src = brain.in[i];
                    const signal = w * src;
                    const mag = Math.abs(signal);
                    if (mag < 0.04) continue;
                    const alpha = Math.min(0.5, mag * 1.2);
                    ctx.strokeStyle = signal > 0
                         ? `rgba(20,184,166,${alpha})`
                         : `rgba(245,158,11,${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(xIn, yIn(i));
                    ctx.lineTo(xHid, yHid(h));
                    ctx.stroke();
               }
          }

          // Hidden → Output
          const W1 = IN * HID;
          const B1 = W1 + HID;
          for (let o = 0; o < OUT; o++) {
               for (let h = 0; h < HID; h++) {
                    const w = brain.w[B1 + o * HID + h];
                    if (!Number.isFinite(w) || Math.abs(w) < 0.35) continue;
                    const src = brain.hid[h];
                    const signal = w * src;
                    const mag = Math.abs(signal);
                    if (mag < 0.04) continue;
                    const alpha = Math.min(0.5, mag * 1.2);
                    ctx.strokeStyle = signal > 0
                         ? `rgba(20,184,166,${alpha})`
                         : `rgba(245,158,11,${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(xHid, yHid(h));
                    ctx.lineTo(xOut, yOut(o));
                    ctx.stroke();
               }
          }

          // Node drawing helper
          const drawNode = (x, y, v, r) => {
               const mag = Math.min(1, Math.abs(v));
               const color = v >= 0 ? POS : NEG;
               ctx.fillStyle = color;
               ctx.globalAlpha = 0.22 + mag * 0.78;
               ctx.beginPath();
               ctx.arc(x, y, r, 0, Math.PI * 2);
               ctx.fill();
               ctx.globalAlpha = 1;
               ctx.strokeStyle = 'rgba(70,84,96,0.8)';
               ctx.lineWidth = 1 * dpr;
               ctx.stroke();
          };

          // Input nodes
          for (let i = 0; i < IN; i++) drawNode(xIn, yIn(i), brain.in[i], 3.5 * dpr);
          // Hidden nodes
          for (let h = 0; h < HID; h++) drawNode(xHid, yHid(h), brain.hid[h], 4 * dpr);
          // Output nodes
          for (let o = 0; o < OUT; o++) drawNode(xOut, yOut(o), brain.out[o], 5 * dpr);

          // Labels — Input
          ctx.font = `500 ${8.5 * dpr}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          for (let i = 0; i < IN; i++) {
               const label = INPUT_LABELS[i] || `in ${i}`;
               ctx.fillStyle = LABEL_COLOR;
               ctx.fillText(label, xIn - 10 * dpr, yIn(i));
          }

          // Labels — Output
          ctx.textAlign = 'left';
          for (let o = 0; o < OUT; o++) {
               const label = OUTPUT_LABELS[o] || `out ${o}`;
               const val = brain.out[o];
               // Label
               ctx.fillStyle = LABEL_COLOR;
               ctx.fillText(label, xOut + 10 * dpr, yOut(o) - 5 * dpr);
               // Value
               ctx.font = `600 ${8.5 * dpr}px "JetBrains Mono", monospace`;
               ctx.fillStyle = val > 0 ? POS : NEG;
               ctx.fillText(val.toFixed(2), xOut + 10 * dpr, yOut(o) + 6 * dpr);
               ctx.font = `500 ${8.5 * dpr}px "JetBrains Mono", monospace`;
          }

          // Column headers
          ctx.font = `600 ${9 * dpr}px "Inter", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#576573';
          ctx.fillText('INPUT (24)', xIn, 8 * dpr);
          ctx.fillText('HIDDEN (20)', xHid, 8 * dpr);
          ctx.fillText('OUTPUT (6)', xOut, 8 * dpr);

          // Legend
          ctx.font = `500 ${8 * dpr}px "Inter", sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillStyle = POS;
          ctx.fillText('●', 8 * dpr, 8 * dpr);
          ctx.fillStyle = LABEL_COLOR;
          ctx.fillText('positive', 20 * dpr, 8 * dpr);
          ctx.fillStyle = NEG;
          ctx.fillText('●', 65 * dpr, 8 * dpr);
          ctx.fillStyle = LABEL_COLOR;
          ctx.fillText('negative', 77 * dpr, 8 * dpr);
     }
}