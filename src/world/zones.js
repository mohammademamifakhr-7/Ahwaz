import { CFG } from '../core/config.js';
import { randRange } from '../core/rng.js';

export class Zones {
     constructor() {
          this.water = [];
          this.slow = [];
          this.light = {
               x: CFG.world.width / 2, y: CFG.world.height / 2, radius: 280, time: 0,
               ampX: CFG.world.width * 0.32, ampY: CFG.world.height * 0.32,
               speedX: 0.55, speedY: 0.83,
          };
          this.rebuild();
     }

     rebuild() {
          this.water = [];
          this.slow = [];
          const W = CFG.world.width, H = CFG.world.height;
          for (let i = 0; i < CFG.zones.waterCount; i++) {
               const r = randRange(CFG.zones.waterMinRadius, CFG.zones.waterMaxRadius);
               this.water.push({
                    x: randRange(r + 30, Math.max(r + 31, W - r - 30)),
                    y: randRange(r + 30, Math.max(r + 31, H - r - 30)),
                    radius: r,
               });
          }
          for (let i = 0; i < CFG.zones.slowCount; i++) {
               const r = randRange(CFG.zones.slowMinRadius, CFG.zones.slowMaxRadius);
               this.slow.push({
                    x: randRange(r + 30, Math.max(r + 31, W - r - 30)),
                    y: randRange(r + 30, Math.max(r + 31, H - r - 30)),
                    radius: r,
               });
          }
          this.light.radius = CFG.zones.lightRadius;
          this.light.x = W / 2;
          this.light.y = H / 2;
          this.light.time = 0;
          this.light.ampX = W * 0.32;
          this.light.ampY = H * 0.32;
          this.light.speedX = CFG.zones.lightSpeedX;
          this.light.speedY = CFG.zones.lightSpeedY;
     }

     update(dt) {
          this.light.time += dt;
          const W = CFG.world.width, H = CFG.world.height;
          this.light.x = W / 2 + Math.sin(this.light.time * this.light.speedX) * this.light.ampX;
          this.light.y = H / 2 + Math.cos(this.light.time * this.light.speedY) * this.light.ampY;
     }

     getCostMultiplier(x, y) {
          for (const w of this.water) {
               if ((x - w.x) ** 2 + (y - w.y) ** 2 < w.radius ** 2) return CFG.zones.waterCostMult;
          }
          return 1;
     }

     getSpeedMultiplier(x, y) {
          let m = 1;
          for (const w of this.water) {
               if ((x - w.x) ** 2 + (y - w.y) ** 2 < w.radius ** 2) { m *= CFG.zones.waterSpeedMult; break; }
          }
          for (const s of this.slow) {
               if ((x - s.x) ** 2 + (y - s.y) ** 2 < s.radius ** 2) { m *= CFG.zones.slowSpeedMult; break; }
          }
          return m;
     }

     getLightMultiplier(x, y) {
          const dx = x - this.light.x, dy = y - this.light.y;
          if (dx * dx + dy * dy < this.light.radius ** 2) return CFG.zones.lightZoneMult;
          return 1;
     }

     getZoneType(x, y) {
          for (const w of this.water) {
               if ((x - w.x) ** 2 + (y - w.y) ** 2 < w.radius ** 2) return 1;
          }
          for (const s of this.slow) {
               if ((x - s.x) ** 2 + (y - s.y) ** 2 < s.radius ** 2) return -1;
          }
          return 0;
     }

     toJSON() {
          return {
               water: this.water.map(w => ({ ...w })),
               slow: this.slow.map(s => ({ ...s })),
               light: { ...this.light },
          };
     }

     static fromJSON(d) {
          const z = Object.create(Zones.prototype);
          z.water = (d?.water || []).map(w => ({ ...w }));
          z.slow = (d?.slow || []).map(s => ({ ...s }));
          z.light = {
               ...(d?.light || {
                    x: 1000, y: 750, radius: 280, time: 0,
                    ampX: 640, ampY: 480, speedX: 0.55, speedY: 0.83,
               })
          };
          return z;
     }
}