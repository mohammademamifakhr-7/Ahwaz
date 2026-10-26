import { CFG } from '../core/config.js';

export class Camera {
     constructor(canvas) {
          this.canvas = canvas;
          this.x = CFG.world.width / 2;
          this.y = CFG.world.height / 2;
          this.zoom = 1;
          this.targetZoom = 1;
          this.targetX = this.x;
          this.targetY = this.y;
          this.followId = null;
          this.followZoom = 2.5;
          this._dragging = false;
          this._lastX = 0;
          this._lastY = 0;
          this._pointerId = null;
          this._touches = new Map();
          this._pinchStartDist = 0;
          this._pinchStartZoom = 1;
          this._bindEvents();
     }

     _bindEvents() {
          const c = this.canvas;

          c.addEventListener('wheel', (e) => {
               e.preventDefault();
               const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
               this.targetZoom = Math.max(0.05, Math.min(8, this.targetZoom * factor));
          }, { passive: false });

          c.addEventListener('pointerdown', (e) => {
               this._touches.set(e.pointerId, { x: e.clientX, y: e.clientY });

               if (this._touches.size === 2) {
                    const pts = [...this._touches.values()];
                    const dx = pts[0].x - pts[1].x;
                    const dy = pts[0].y - pts[1].y;
                    this._pinchStartDist = Math.sqrt(dx * dx + dy * dy);
                    this._pinchStartZoom = this.targetZoom;
                    this._dragging = false;
                    return;
               }

               if (this._touches.size === 1) {
                    this._dragging = true;
                    this._lastX = e.clientX;
                    this._lastY = e.clientY;
                    this._pointerId = e.pointerId;
                    this.followId = null;
                    try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
               }
          });

          c.addEventListener('pointermove', (e) => {
               if (this._touches.has(e.pointerId)) {
                    this._touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
               }

               if (this._touches.size === 2) {
                    const pts = [...this._touches.values()];
                    const dx = pts[0].x - pts[1].x;
                    const dy = pts[0].y - pts[1].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (this._pinchStartDist > 0) {
                         const scale = dist / this._pinchStartDist;
                         this.targetZoom = Math.max(0.05, Math.min(8, this._pinchStartZoom * scale));
                    }
                    return;
               }

               if (this._dragging && this._pointerId === e.pointerId) {
                    const dx = (e.clientX - this._lastX) / this.zoom;
                    const dy = (e.clientY - this._lastY) / this.zoom;
                    this.targetX -= dx;
                    this.targetY -= dy;
                    this.x -= dx;
                    this.y -= dy;
                    this._lastX = e.clientX;
                    this._lastY = e.clientY;
               }
          });

          const endPointer = (e) => {
               this._touches.delete(e.pointerId);
               if (this._pointerId === e.pointerId) {
                    this._dragging = false;
                    this._pointerId = null;
               }
               if (this._touches.size < 2) {
                    this._pinchStartDist = 0;
               }
          };

          c.addEventListener('pointerup', endPointer);
          c.addEventListener('pointercancel', endPointer);
          c.addEventListener('pointerleave', endPointer);

          c.addEventListener('contextmenu', (e) => e.preventDefault());
     }

     follow(id, zoom = 2.5) {
          this.followId = id;
          this.followZoom = zoom;
     }

     unfollow() { this.followId = null; }

     fitToScreen(immediate = false) {
          const p = this.canvas.parentElement;
          if (!p) return;
          const cw = p.clientWidth;
          const ch = p.clientHeight;
          if (cw === 0 || ch === 0) return;
          const worldW = CFG.world.width;
          const worldH = CFG.world.height;
          const padding = 0.94;
          const zoomFit = Math.min(cw / worldW, ch / worldH) * padding;
          this.followId = null;
          this.targetZoom = zoomFit;
          this.targetX = worldW / 2;
          this.targetY = worldH / 2;
          if (immediate) {
               this.zoom = this.targetZoom;
               this.x = this.targetX;
               this.y = this.targetY;
          }
     }

     update(dt, world) {
          if (this.followId != null) {
               const cell = world.cells.find(c => c.id === this.followId);
               if (cell) {
                    this.targetX = cell.x;
                    this.targetY = cell.y;
                    this.targetZoom = this.followZoom;
               } else {
                    this.followId = null;
               }
          }
          const k = 1 - Math.exp(-8 * dt);
          this.x += (this.targetX - this.x) * k;
          this.y += (this.targetY - this.y) * k;
          this.zoom += (this.targetZoom - this.zoom) * k;
     }

     screenToWorld(clientX, clientY) {
          const rect = this.canvas.getBoundingClientRect();
          const cssX = clientX - rect.left;
          const cssY = clientY - rect.top;
          return {
               x: (cssX - rect.width / 2) / this.zoom + this.x,
               y: (cssY - rect.height / 2) / this.zoom + this.y,
          };
     }
}