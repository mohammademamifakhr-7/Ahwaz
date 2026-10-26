export class Chart {
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

     draw(history) {
          this._resize();
          const ctx = this.ctx;
          if (!ctx || !this.W) return;
          const W = this.canvas.width;
          const H = this.canvas.height;
          ctx.fillStyle = '#080b10';
          ctx.fillRect(0, 0, W, H);

          if (!history || history.length < 2) {
               ctx.fillStyle = '#576573';
               ctx.font = `${10 * this.dpr}px monospace`;
               ctx.textAlign = 'center';
               ctx.textBaseline = 'middle';
               ctx.fillText('Collecting…', W / 2, H / 2);
               return;
          }

          const maxC = Math.max(20, ...history.map(s => s.cells));
          const maxP = Math.max(1, ...history.map(s => s.pool || 0));
          const step = W / (history.length - 1);

          ctx.strokeStyle = 'rgba(255,255,255,0.04)';
          for (let i = 1; i < 4; i++) {
               const y = (H / 4) * i;
               ctx.beginPath();
               ctx.moveTo(0, y);
               ctx.lineTo(W, y);
               ctx.stroke();
          }

          // Cells (teal)
          ctx.strokeStyle = '#14b8a6';
          ctx.lineWidth = 1.5 * this.dpr;
          ctx.beginPath();
          for (let i = 0; i < history.length; i++) {
               const x = i * step;
               const y = H - (history[i].cells / maxC) * (H - 12 * this.dpr) - 4 * this.dpr;
               if (i === 0) ctx.moveTo(x, y);
               else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Pool (orange, dashed)
          ctx.strokeStyle = 'rgba(245,158,11,0.7)';
          ctx.setLineDash([3 * this.dpr, 3 * this.dpr]);
          ctx.beginPath();
          for (let i = 0; i < history.length; i++) {
               const x = i * step;
               const y = H - (history[i].pool / maxP) * (H - 12 * this.dpr) - 4 * this.dpr;
               if (i === 0) ctx.moveTo(x, y);
               else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Legend
          ctx.font = `${9 * this.dpr}px monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#14b8a6';
          ctx.fillText('● cells', 6 * this.dpr, 4 * this.dpr);
          ctx.fillStyle = '#f59e0b';
          ctx.fillText('● pool', 60 * this.dpr, 4 * this.dpr);
     }
}