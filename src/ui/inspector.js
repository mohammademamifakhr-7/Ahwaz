import { settings, TRAIT_BY_KEY } from '../core/config.js';
import { getSpeciesId } from '../evolution/naming.js';
import { cellName, speciesLongName } from '../core/names.js';
import { formatTime } from '../core/utils.js';
import { getIcon } from './icons.js';
import { BrainView } from '../render/brain-view.js';

export class Inspector {
     constructor(world, tracker) {
          this.world = world;
          this.tracker = tracker;
          this.section = document.getElementById('inspector-section');
          this.title = document.getElementById('inspector-title');
          this.content = document.getElementById('inspector-content');
          this.empty = document.getElementById('inspector-empty');

          const closeBtn = document.getElementById('btn-close-inspector');
          if (closeBtn) closeBtn.onclick = () => this.close();

          this.canvas = document.createElement('canvas');
          this.canvas.className = 'brain-canvas';
          this.brainView = new BrainView(this.canvas);

          this.cellId = null;
          this.speciesId = null;
     }

     setWorld(w) { this.world = w; }

     openCell(cell) {
          this.cellId = cell.id;
          this.speciesId = null;
          if (this.section) this.section.classList.remove('hidden');
          if (this.empty) this.empty.classList.add('hidden');
          this.update();
     }

     openSpecies(id) {
          this.speciesId = id;
          this.cellId = null;
          if (this.section) this.section.classList.remove('hidden');
          if (this.empty) this.empty.classList.add('hidden');
          this.update();
     }

     close() {
          if (this.section) this.section.classList.add('hidden');
          if (this.empty) this.empty.classList.remove('hidden');
          this.cellId = null;
          this.speciesId = null;
     }

     update() {
          if (!this.section || this.section.classList.contains('hidden')) return;
          if (this.cellId != null) {
               const c = this.world.cells.find(x => x.id === this.cellId);
               if (c) this._renderCell(c);
               else this.close();
          } else if (this.speciesId) {
               const sp = this.tracker.get(this.speciesId);
               if (sp) this._renderSpecies(sp);
               else this.close();
          }
     }

     _renderCell(cell) {
          const sid = getSpeciesId(cell.genome);
          const cname = cellName(cell, sid);
          const sname = speciesLongName(cell.genome, sid);
          if (this.title) this.title.textContent = cname;
          const cap = settings.get('energyCapacity');
          const inGrace = cell.isFounder && this.world.time < this.world.founderGraceUntil;

          let html = `
      <div class="row"><span>Species</span><b>${sid}</b></div>
      <div class="row"><span>Scientific name</span><b style="color:#a78bfa">${sname}</b></div>
      <div class="row"><span>Generation</span><b>${cell.genome.generation}</b></div>
      <div class="row"><span>Energy</span><b>${cell.energy.toFixed(1)} / ${cap}</b></div>
      <div class="row"><span>Age</span><b>${formatTime(cell.age)}</b></div>
      <div class="row"><span>Offspring</span><b>${cell.offspring}</b></div>
      <div class="row"><span>Body</span><b>${cell.genome.bodySize.toFixed(2)}</b></div>
      <div class="row"><span>Born</span><b>${formatTime(cell.history.birthTime || 0)}</b></div>
      ${cell.isFounder ? `<div class="row"><span>Status</span><b style="color:#f59e0b">FOUNDER${inGrace ? ' (grace)' : ''}</b></div>` : ''}
      <div class="sect">Traits</div>
    `;

          for (let i = 0; i < 6; i++) {
               const s = cell.genome.slots[i];
               if (s) {
                    const t = TRAIT_BY_KEY[s.trait];
                    const side = s.side !== null ? ` (${s.side})` : '';
                    const color = t?.color || '#8b98a8';
                    const effect = t?.effect ? `<br><span style="color:#576573;font-size:10px">${t.effect}</span>` : '';
                    html += `<div class="trait"><div class="ic">${getIcon(s.trait)}</div><div style="color:${color}">${t ? t.label : s.trait}${side}${effect}</div></div>`;
               } else {
                    html += `<div class="trait"><div class="ic"></div><div style="color:#576573">Empty slot</div></div>`;
               }
          }

          // History
          if (cell.history && cell.history.events && cell.history.events.length > 0) {
               html += `<div class="sect">Life story</div>`;
               const events = cell.history.events.slice(-8);
               for (const ev of events) {
                    html += `<div class="history"><span class="t">${formatTime(ev.t)}</span> · ${ev.ev}</div>`;
               }
               if (cell.history.eaten > 0) html += `<div class="history"><span class="t">total</span> · ate ${cell.history.eaten} corpses</div>`;
               if (cell.history.killed > 0) html += `<div class="history"><span class="t">total</span> · killed ${cell.history.killed} cells</div>`;
          }

          if (this.content) this.content.innerHTML = html;

          const bc = document.createElement('div');
          bc.className = 'brain-box';
          bc.appendChild(this.canvas);
          this.content?.appendChild(bc);
          requestAnimationFrame(() => this.brainView.draw(cell.genome.brain));
     }

     _renderSpecies(sp) {
          if (this.title) this.title.textContent = `${sp.id}`;
          if (this.content) {
               this.content.innerHTML = `
        <div class="row"><span>Scientific name</span><b style="color:hsl(${sp.hue},65%,65%)">${sp.longName}</b></div>
        <div class="row"><span>Species ID</span><b>${sp.id}</b></div>
        <div class="row"><span>Population</span><b>${sp.current}</b></div>
        <div class="row"><span>Peak</span><b>${sp.peak || sp.current}</b></div>
        <div class="row"><span>Status</span><b style="color:${sp.extinct ? '#ef4444' : '#10b981'}">${sp.extinct ? 'EXTINCT' : 'ACTIVE'}</b></div>
        <div class="row"><span>Born</span><b>${formatTime(sp.birthTime)}</b></div>
        ${sp.parentId ? `<div class="row"><span>Parent species</span><b>${sp.parentId}</b></div>` : ''}
      `;
          }
          if (sp.repGenome && this.content) {
               const bc = document.createElement('div');
               bc.className = 'brain-box';
               bc.appendChild(this.canvas);
               this.content.appendChild(bc);
               requestAnimationFrame(() => this.brainView.draw(sp.repGenome.brain));
          }
     }
}