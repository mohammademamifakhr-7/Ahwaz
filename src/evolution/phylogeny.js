const X0 = 30;
const Y0 = 20;

export class Phylogeny {
     constructor() {
          this.nodes = new Map();
          this.roots = [];
          this.positions = new Map();
          this._lastW = 0;
          this._lastH = 0;
     }

     build(tracker) {
          this.nodes.clear();
          this.roots = [];
          for (const sp of tracker.list()) {
               this.nodes.set(sp.id, {
                    id: sp.id,
                    hue: sp.hue,
                    longName: sp.longName,
                    parentId: sp.parentId,
                    children: [],
                    current: sp.current,
                    extinct: sp.extinct,
                    birthTime: sp.birthTime,
                    ordinal: sp.ordinal,
               });
          }
          for (const node of this.nodes.values()) {
               if (node.parentId && this.nodes.has(node.parentId)) {
                    this.nodes.get(node.parentId).children.push(node);
               } else {
                    this.roots.push(node);
               }
          }
          this.roots.sort((a, b) => a.birthTime - b.birthTime);
          for (const n of this.nodes.values()) {
               n.children.sort((a, b) => a.birthTime - b.birthTime);
          }
     }

     layout(width, height) {
          if (width === this._lastW && height === this._lastH && this.positions.size > 0) return;
          this._lastW = width;
          this._lastH = height;
          this.positions.clear();
          if (this.roots.length === 0) return;

          const leafCount = new Map();
          const depth = new Map();
          const walk = (n, d) => {
               depth.set(n.id, d);
               if (n.children.length === 0) { leafCount.set(n.id, 1); return 1; }
               let t = 0;
               for (const c of n.children) t += walk(c, d + 1);
               leafCount.set(n.id, t);
               return t;
          };
          let maxDepth = 0;
          for (const r of this.roots) walk(r, 0);
          for (const d of depth.values()) if (d > maxDepth) maxDepth = d;

          const availW = width - X0 - 40;
          const levelW = Math.max(12, availW / Math.max(1, maxDepth));
          const total = this.roots.reduce((s, r) => s + leafCount.get(r.id), 0);
          const availH = height - Y0 * 2;
          const rowH = Math.max(3, Math.min(20, availH / Math.max(1, total)));

          let yCursor = Y0;
          const assign = (node, level) => {
               const leaves = leafCount.get(node.id) || 1;
               const yCenter = yCursor + (leaves * rowH) / 2;
               this.positions.set(node.id, { x: X0 + level * levelW, y: yCenter });
               for (const c of node.children) assign(c, level + 1);
               yCursor += leaves * rowH;
          };
          for (const r of this.roots) assign(r, 0);
     }

     pick(sx, sy, dpr = 1) {
          let best = null;
          let bestD = 22 * dpr;
          for (const [id, p] of this.positions) {
               const dx = sx - p.x * dpr;
               const dy = sy - p.y * dpr;
               const d = Math.sqrt(dx * dx + dy * dy);
               if (d < bestD) { bestD = d; best = id; }
          }
          return best;
     }

     get(id) { return this.nodes.get(id) || null; }
}