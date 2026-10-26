import { speciesLongName } from '../core/names.js';

export class TreeView {
     constructor(canvas, phylogeny) {
          this.canvas = canvas;
          this.ctx = canvas.getContext('2d');
          this.phylogeny = phylogeny;
          this.dpr = Math.min(2, window.devicePixelRatio || 1);
          this.selectedId = null;
     }

     _resize() {
          const rect = this.canvas.getBoundingClientRect();
          if (rect.width === 0) return;
          this.canvas.width = rect.width * this.dpr;
          this.canvas.height = rect.height * this.dpr;
          this.W = rect.width;
          this.H = rect.height;
     }

     pick(clientX, clientY) {
          const rect = this.canvas.getBoundingClientRect();
          const sx = (clientX - rect.left) * this.dpr;
          const sy = (clientY - rect.top) * this.dpr;
          return this.phylogeny.pick(sx, sy, this.dpr);
     }

     draw(selectedId) {
          this._resize();
          const ctx = this.ctx;
          if (!ctx || !this.W) return;

          ctx.fillStyle = '#080b10';
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

          this.phylogeny.layout(this.W, this.H);

          // Connections
          for (const [id, p] of this.phylogeny.positions) {
               const n = this.phylogeny.get(id);
               if (!n) continue;
               const pp = this.phylogeny.positions.get(n.parentId);
               if (!pp) continue;
               ctx.strokeStyle = n.extinct
                    ? 'rgba(87,101,115,0.25)'
                    : `hsla(${n.hue},65%,60%,0.55)`;
               ctx.lineWidth = 1.4 * this.dpr;
               ctx.beginPath();
               ctx.moveTo(pp.x * this.dpr, pp.y * this.dpr);
               ctx.lineTo(p.x * this.dpr, p.y * this.dpr);
               ctx.stroke();
          }

          // Nodes + labels (only if tree isn't too crowded)
          const showLabels = this.phylogeny.nodes.size <= 30;
          for (const [id, p] of this.phylogeny.positions) {
               const n = this.phylogeny.get(id);
               if (!n) continue;
               const active = id === selectedId;
               const extinct = n.extinct && n.current === 0;
               const size = Math.min(7, 3 + Math.log2(Math.max(1, n.current)) * 1.1) * this.dpr;

               ctx.beginPath();
               ctx.arc(p.x * this.dpr, p.y * this.dpr, size, 0, Math.PI * 2);
               if (extinct) {
                    ctx.fillStyle = 'rgba(87,101,115,0.15)';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(87,101,115,0.5)';
                    ctx.lineWidth = 1 * this.dpr;
                    ctx.stroke();
               } else {
                    ctx.fillStyle = `hsl(${n.hue},65%,58%)`;
                    ctx.fill();
                    if (active) {
                         ctx.strokeStyle = '#14b8a6';
                         ctx.lineWidth = 2.5 * this.dpr;
                         ctx.stroke();
                    }
               }

               // Labels
               if (showLabels && n.longName) {
                    ctx.fillStyle = extinct ? 'rgba(87,101,115,0.6)' : `hsl(${n.hue},50%,72%)`;
                    ctx.font = `${8 * this.dpr}px "Inter", sans-serif`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(n.longName, p.x * this.dpr + size + 4 * this.dpr, p.y * this.dpr);
               }
          }

          ctx.fillStyle = '#576573';
          ctx.font = `${10 * this.dpr}px monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`${this.phylogeny.nodes.size} species`, 8 * this.dpr, 8 * this.dpr);
     }
}