import { Brain } from '../biology/brain.js';
import { Genome } from '../biology/genome.js';
import { getSpeciesId, getFullId } from './naming.js';

const KEY = 'evogenesis.geneBank.v3';
const MAX = 200;

function ser(g) {
     return {
          w: [...g.brain.w],
          slots: g.slots.map(s => s ? { ...s } : null),
          social: [...g.social],
          body: g.bodySize,
          gen: g.generation,
     };
}

function deser(o) {
     return new Genome(
          new Brain(new Float32Array(o.w)),
          o.slots || [],
          o.social || [],
          o.body || 5,
          o.gen || 0
     );
}

export class GeneBank {
     constructor() {
          this.entries = [];
          this._saveTimer = null;
          this._dirty = false;
          this._load();
     }

     _load() {
          try {
               const raw = localStorage.getItem(KEY);
               if (!raw) return;
               const arr = JSON.parse(raw);
               if (Array.isArray(arr)) {
                    this.entries = arr.filter(e => e && e.w);
               }
          } catch (e) {
               console.warn('[GeneBank] load:', e);
          }
     }

     _scheduleSave() {
          this._dirty = true;
          if (this._saveTimer) return;
          this._saveTimer = setTimeout(() => {
               this._saveTimer = null;
               if (this._dirty) {
                    this._dirty = false;
                    this._flushSave();
               }
          }, 1000);
     }

     _flushSave() {
          try {
               localStorage.setItem(KEY, JSON.stringify(this.entries));
          } catch (e) {
               console.warn('[GeneBank] save:', e);
          }
     }

     save(genome, reason = 'manual') {
          if (!genome) return null;
          const fullName = getFullId(genome);
          const existing = this.entries.find(e => e.fullName === fullName);
          if (existing) {
               existing.savedAt = Date.now();
               existing.reason = reason;
               this._scheduleSave();
               return existing;
          }
          const entry = {
               id: 'g' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
               speciesId: getSpeciesId(genome),
               fullName,
               generation: genome.generation,
               reason,
               savedAt: Date.now(),
               ...ser(genome),
          };
          this.entries.push(entry);

          if (this.entries.length > MAX) {
               const removable = this.entries
                    .filter(e => e.reason !== 'founder')
                    .sort((a, b) => a.savedAt - b.savedAt);
               let toRemove = this.entries.length - MAX;
               for (const e of removable) {
                    if (toRemove <= 0) break;
                    const i = this.entries.indexOf(e);
                    if (i >= 0) {
                         this.entries.splice(i, 1);
                         toRemove--;
                    }
               }
          }

          this._scheduleSave();
          return entry;
     }

     consider(cell) {
          if (!cell || !cell.genome) return;
          const sp = getSpeciesId(cell.genome);
          if (!this.entries.some(e => e.speciesId === sp)) {
               this.save(cell.genome, 'founder');
               return;
          }
          if (cell.offspring >= 3) {
               this.save(cell.genome, 'high-offspring');
               return;
          }
          if (cell.age >= 90) {
               this.save(cell.genome, 'long-lived');
          }
     }

     considerBatch(batch) {
          if (!Array.isArray(batch) || batch.length === 0) return;
          for (const item of batch) {
               if (!item || !item.genome) continue;
               const sp = getSpeciesId(item.genome);
               if (!this.entries.some(e => e.speciesId === sp)) {
                    this.save(item.genome, 'founder');
                    continue;
               }
               if (item.offspring >= 3) {
                    this.save(item.genome, 'high-offspring');
                    continue;
               }
               if (item.age >= 90) {
                    this.save(item.genome, 'long-lived');
               }
          }
     }

     list() {
          return this.entries.slice().sort((a, b) => b.savedAt - a.savedAt);
     }

     get(id) {
          return this.entries.find(e => e.id === id);
     }

     remove(id) {
          const i = this.entries.findIndex(e => e.id === id);
          if (i >= 0) {
               this.entries.splice(i, 1);
               this._scheduleSave();
          }
     }

     spawn(world, entryId, x, y) {
          const e = this.get(entryId);
          if (!e) return null;
          try {
               const g = deser(e);
               return world.spawnFromGenome(
                    g,
                    x ?? world.width / 2,
                    y ?? world.height / 2
               );
          } catch (err) {
               console.error(err);
               return null;
          }
     }

     clear() {
          this.entries = [];
          this._scheduleSave();
     }

     count() {
          return this.entries.length;
     }
}

export const geneBank = new GeneBank();