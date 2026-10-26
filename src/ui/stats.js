import { formatTime } from '../core/utils.js';

export class Stats {
     constructor(world, tracker) {
          this.world = world;
          this.tracker = tracker;
          this.elCells = document.getElementById('stat-cells');
          this.elSpecies = document.getElementById('stat-species');
          this.elTime = document.getElementById('stat-time');
          this.elCorpses = document.getElementById('stat-corpses');
          this.elTotal = document.getElementById('energy-total');
          this.elPctPool = document.getElementById('energy-pct-pool');
          this.elPctCells = document.getElementById('energy-pct-cells');
          this.elPctCorpses = document.getElementById('energy-pct-corpses');
          this.elAbsPool = document.getElementById('energy-abs-pool');
          this.elAbsCells = document.getElementById('energy-abs-cells');
          this.elAbsCorpses = document.getElementById('energy-abs-corpses');
          this.elBarPool = document.getElementById('energy-bar-pool');
          this.elBarCells = document.getElementById('energy-bar-cells');
          this.elBarCorpses = document.getElementById('energy-bar-corpses');
     }

     setWorld(w) { this.world = w; }

     _fmt(n) { return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '0'; }

     update() {
          const w = this.world;
          if (!w) return;
          const active = this.tracker ? this.tracker.active().length : 0;
          const total = this.tracker ? this.tracker.list().length : 0;

          if (this.elCells) this.elCells.textContent = w.cells.length;
          if (this.elSpecies) this.elSpecies.textContent = `${active}/${total}`;
          if (this.elTime) this.elTime.textContent = formatTime(w.time);
          if (this.elCorpses) this.elCorpses.textContent = w.corpses.length;

          const br = w.getEnergyBreakdown();
          if (this.elTotal) this.elTotal.textContent = this._fmt(br.total);
          if (this.elPctPool) this.elPctPool.textContent = br.poolPct.toFixed(1) + '%';
          if (this.elPctCells) this.elPctCells.textContent = br.cellsPct.toFixed(1) + '%';
          if (this.elPctCorpses) this.elPctCorpses.textContent = br.corpsesPct.toFixed(1) + '%';
          if (this.elAbsPool) this.elAbsPool.textContent = this._fmt(br.pool);
          if (this.elAbsCells) this.elAbsCells.textContent = this._fmt(br.cells);
          if (this.elAbsCorpses) this.elAbsCorpses.textContent = this._fmt(br.corpses);
          if (this.elBarPool) this.elBarPool.style.width = br.poolPct + '%';
          if (this.elBarCells) this.elBarCells.style.width = br.cellsPct + '%';
          if (this.elBarCorpses) this.elBarCorpses.style.width = br.corpsesPct + '%';
     }
}