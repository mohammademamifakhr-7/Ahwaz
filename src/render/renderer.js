import { CFG } from '../core/config.js';
import { getColor, getHue, getSpeciesId } from '../evolution/naming.js';
import { getIconColor } from '../ui/icons.js';

export class Renderer {
     constructor(canvas, camera) {
          this.canvas = canvas;
          this.ctx = canvas.getContext('2d');
          this.camera = camera;
          this.selectedId = null;
          this.dpr = Math.min(2, window.devicePixelRatio || 1);
          this._resize();
          window.addEventListener('resize', () => this._resize());
          window.addEventListener('orientationchange', () => {
               setTimeout(() => this._resize(), 200);
          });
     }

     _resize() {
          const p = this.canvas.parentElement;
          if (!p) return;
          const w = p.clientWidth || 1;
          const h = p.clientHeight || 1;
          this.canvas.width = Math.round(w * this.dpr);
          this.canvas.height = Math.round(h * this.dpr);
          this.canvas.style.width = w + 'px';
          this.canvas.style.height = h + 'px';
     }

     // Touch-friendly pick. Minimum 24 CSS px radius on screen.
     pickCell(world, clientX, clientY) {
          const { x: wx, y: wy } = this.camera.screenToWorld(clientX, clientY);
          const MIN_PICK_PX = 24;
          const minWorldRadius = MIN_PICK_PX / this.camera.zoom;

          let best = null;
          let bestD2 = Infinity;
          for (const cell of world.cells) {
               if (!cell.alive) continue;
               const d2 = (cell.x - wx) ** 2 + (cell.y - wy) ** 2;
               const pickR = Math.max(cell.bodyRadius() + 4, minWorldRadius);
               if (d2 < pickR * pickR && d2 < bestD2) {
                    bestD2 = d2;
                    best = cell;
               }
          }
          return best;
     }

     draw(world) {
          const ctx = this.ctx;
          const W = this.canvas.width;
          const H = this.canvas.height;
          ctx.fillStyle = '#050a10';
          ctx.fillRect(0, 0, W, H);

          ctx.save();
          ctx.translate(W / 2, H / 2);
          ctx.scale(this.camera.zoom * this.dpr, this.camera.zoom * this.dpr);
          ctx.translate(-this.camera.x, -this.camera.y);

          this._drawBg(ctx);
          this._drawZones(ctx, world.zones);
          this._drawCorpses(ctx, world.corpses);

          const useFlat = this.camera.zoom < 0.15;

          for (const cell of world.cells) {
               if (!cell.alive) continue;
               this._drawCell(ctx, cell, useFlat);
          }

          if (this.selectedId != null) {
               const sel = world.cells.find(c => c.id === this.selectedId);
               if (sel) this._drawSelection(ctx, sel);
          }

          ctx.restore();
     }

     _drawBg(ctx) {
          ctx.strokeStyle = 'rgba(255,255,255,0.03)';
          ctx.lineWidth = 1;
          for (let x = 0; x <= CFG.world.width; x += 100) {
               ctx.beginPath();
               ctx.moveTo(x, 0);
               ctx.lineTo(x, CFG.world.height);
               ctx.stroke();
          }
          for (let y = 0; y <= CFG.world.height; y += 100) {
               ctx.beginPath();
               ctx.moveTo(0, y);
               ctx.lineTo(CFG.world.width, y);
               ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(20,184,166,0.25)';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, CFG.world.width, CFG.world.height);
     }

     _drawZones(ctx, zones) {
          for (const w of zones.water) {
               const grad = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.radius);
               grad.addColorStop(0, 'rgba(56,139,253,0.18)');
               grad.addColorStop(1, 'rgba(56,139,253,0.02)');
               ctx.fillStyle = grad;
               ctx.beginPath();
               ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
               ctx.fill();
               ctx.strokeStyle = 'rgba(56,139,253,0.4)';
               ctx.lineWidth = 1.5;
               ctx.stroke();
          }
          ctx.setLineDash([8, 8]);
          for (const s of zones.slow) {
               ctx.fillStyle = 'rgba(139,92,246,0.06)';
               ctx.beginPath();
               ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
               ctx.fill();
               ctx.strokeStyle = 'rgba(139,92,246,0.3)';
               ctx.lineWidth = 1.5;
               ctx.stroke();
          }
          ctx.setLineDash([]);
          const L = zones.light;
          const g2 = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.radius);
          g2.addColorStop(0, 'rgba(250,204,21,0.28)');
          g2.addColorStop(0.6, 'rgba(250,204,21,0.1)');
          g2.addColorStop(1, 'rgba(250,204,21,0)');
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.arc(L.x, L.y, L.radius, 0, Math.PI * 2);
          ctx.fill();
     }

     _drawCorpses(ctx, corpses) {
          for (const c of corpses) {
               if (!c.alive) continue;
               const r = Math.max(3, Math.sqrt(c.energy) * 1.1);
               const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
               g.addColorStop(0, 'rgba(245,158,11,0.85)');
               g.addColorStop(1, 'rgba(180,90,40,0.15)');
               ctx.fillStyle = g;
               ctx.beginPath();
               ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
               ctx.fill();
          }
     }

     _drawCell(ctx, cell, useFlat) {
          const r = cell.bodyRadius();
          const eFrac = Math.max(0, Math.min(1, cell.energy / CFG.energy.capacity));
          const hue = getHue(cell.genome);

          if (!useFlat && cell.countTrait('photo') > 0) {
               const glow = ctx.createRadialGradient(cell.x, cell.y, r, cell.x, cell.y, r * 2.5);
               glow.addColorStop(0, 'hsla(' + hue + ',70%,60%,0.25)');
               glow.addColorStop(1, 'hsla(' + hue + ',70%,60%,0)');
               ctx.fillStyle = glow;
               ctx.beginPath();
               ctx.arc(cell.x, cell.y, r * 2.5, 0, Math.PI * 2);
               ctx.fill();
          }

          if (useFlat) {
               ctx.fillStyle = 'hsl(' + hue + ', 68%, ' + (22 + eFrac * 45) + '%)';
               ctx.beginPath();
               ctx.arc(cell.x, cell.y, r, 0, Math.PI * 2);
               ctx.fill();
          } else {
               const color = getColor(cell.genome, eFrac);
               const g = ctx.createRadialGradient(
                    cell.x - r * 0.3, cell.y - r * 0.3, 0,
                    cell.x, cell.y, r
               );
               g.addColorStop(0, color);
               g.addColorStop(1, 'hsla(' + hue + ',68%,' + (15 + eFrac * 25) + '%,0.9)');
               ctx.fillStyle = g;
               ctx.beginPath();
               ctx.arc(cell.x, cell.y, r, 0, Math.PI * 2);
               ctx.fill();
          }

          if (this.camera.zoom > 0.25) {
               for (let i = 0; i < 6; i++) {
                    const s = cell.genome.slots[i];
                    if (!s) continue;
                    const side = s.side ?? i;
                    const c = (side * Math.PI) / 3 - Math.PI / 2;
                    const ic = getIconColor(s.trait);
                    ctx.strokeStyle = ic;
                    ctx.lineWidth = Math.max(2 / this.camera.zoom, r * 0.28);
                    ctx.beginPath();
                    ctx.arc(cell.x, cell.y, r + 1.5, c - 0.3, c + 0.3);
                    ctx.stroke();
               }
          }

          ctx.strokeStyle = 'hsla(' + hue + ',80%,78%,0.9)';
          ctx.lineWidth = Math.max(1 / this.camera.zoom, r * 0.18);
          ctx.beginPath();
          ctx.moveTo(cell.x, cell.y);
          ctx.lineTo(
               cell.x + Math.cos(cell.heading) * r * 1.7,
               cell.y + Math.sin(cell.heading) * r * 1.7
          );
          ctx.stroke();

          if (cell.isFounder) {
               ctx.strokeStyle = 'rgba(250,204,21,0.7)';
               ctx.lineWidth = Math.max(1 / this.camera.zoom, r * 0.15);
               ctx.beginPath();
               ctx.arc(cell.x, cell.y, r + 3, 0, Math.PI * 2);
               ctx.stroke();
          }
     }

     _drawSelection(ctx, cell) {
          const r = cell.bodyRadius() + 8;
          const p = 0.7 + Math.sin(performance.now() * 0.005) * 0.3;
          ctx.strokeStyle = 'rgba(20,184,166,' + p + ')';
          ctx.lineWidth = 2.5 / this.camera.zoom;
          ctx.beginPath();
          ctx.arc(cell.x, cell.y, r, 0, Math.PI * 2);
          ctx.stroke();
          const label = getSpeciesId(cell.genome);
          ctx.font = '600 ' + (12 / this.camera.zoom) + 'px monospace';
          ctx.fillStyle = '#14b8a6';
          ctx.textAlign = 'center';
          ctx.fillText(label, cell.x, cell.y - r - 6 / this.camera.zoom);
     }
}