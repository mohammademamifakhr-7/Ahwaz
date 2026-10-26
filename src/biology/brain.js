import { settings } from '../core/config.js';
import { randNormal, rand } from '../core/rng.js';
import { safeNum } from '../core/utils.js';

const IN = 24;
const HID = 20;
const OUT = 6;
const N_PARAMS = IN * HID + HID + HID * OUT + OUT;
// 480 + 20 + 120 + 6 = 626

export class Brain {
     static get IN() { return IN; }
     static get HID() { return HID; }
     static get OUT() { return OUT; }
     static get N_PARAMS() { return N_PARAMS; }

     constructor(weights = null) {
          this.w = weights instanceof Float32Array ? weights : new Float32Array(N_PARAMS);
          if (!weights) this._randomInit();
          this.in = new Float32Array(IN);
          this.hid = new Float32Array(HID);
          this.out = new Float32Array(OUT);
          this.mem = [0, 0];
     }

     _randomInit() {
          const s1 = Math.sqrt(2 / IN);
          const s2 = Math.sqrt(2 / HID);
          let i = 0;
          for (let k = 0; k < IN * HID; k++) this.w[i++] = randNormal(0, s1);
          for (let k = 0; k < HID; k++) this.w[i++] = randNormal(0, 0.1);
          for (let k = 0; k < HID * OUT; k++) this.w[i++] = randNormal(0, s2);
          for (let k = 0; k < OUT; k++) this.w[i++] = randNormal(0, 0.1);
     }

     think(inputs) {
          for (let i = 0; i < IN - 2; i++) {
               this.in[i] = Number.isFinite(inputs[i]) ? inputs[i] : 0;
          }
          this.in[IN - 2] = this.mem[0];
          this.in[IN - 1] = this.mem[1];

          for (let h = 0; h < HID; h++) {
               let sum = this.w[IN * HID + h];
               const base = h * IN;
               for (let i = 0; i < IN; i++) sum += this.w[base + i] * this.in[i];
               this.hid[h] = Math.tanh(sum);
          }

          const W2 = IN * HID + HID;
          for (let o = 0; o < OUT; o++) {
               let sum = this.w[W2 + o * HID];
               const base = IN * HID + HID + o * HID;
               for (let h = 0; h < HID; h++) sum += this.w[base + h] * this.hid[h];

               // 0 turn (tanh), 1 throttle (sigmoid), 2 aggression (tanh), 3 share (tanh), 4-5 memory (tanh)
               if (o === 1) this.out[o] = 1 / (1 + Math.exp(-sum));
               else this.out[o] = Math.tanh(sum);

               this.out[o] = safeNum(this.out[o], 0);
          }

          this.mem[0] = this.out[4];
          this.mem[1] = this.out[5];

          return this.out;
     }

     mutate() {
          const sigma = settings.get('mutationRate');
          const resetProb = settings.get('mutationResetProb');
          for (let i = 0; i < N_PARAMS; i++) {
               this.w[i] += randNormal(0, sigma);
               if (!Number.isFinite(this.w[i])) this.w[i] = 0;
               if (rand() < resetProb) {
                    let scale = 0.1;
                    if (i < IN * HID) scale = Math.sqrt(2 / IN);
                    else if (i >= IN * HID + HID && i < IN * HID + HID + HID * OUT) scale = Math.sqrt(2 / HID);
                    this.w[i] = randNormal(0, scale);
               }
          }
          this.mem[0] = 0;
          this.mem[1] = 0;
     }

     clone() {
          const b = new Brain(this.w.slice());
          b.mem[0] = this.mem[0];
          b.mem[1] = this.mem[1];
          return b;
     }
}