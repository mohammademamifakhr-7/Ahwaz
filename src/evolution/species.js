import { getSpeciesId, getFullId, getHue } from './naming.js';
import { speciesLongName } from '../core/names.js';

const MAX_SPECIES = 400;
const MAX_HISTORY = 80;

export class SpeciesTracker {
     constructor() {
          this.species = new Map();
          this.ordinal = 1;
          this.updateTimer = 0;
     }

     update(world) {
          if (!world?.cells) return;

          for (const sp of this.species.values()) {
               sp._prev = sp.current;
               sp.current = 0;
          }

          for (const cell of world.cells) {
               if (!cell.alive) continue;
               const id = getSpeciesId(cell.genome);
               if (!this.species.has(id)) this._register(id, cell, world.time);
               const sp = this.species.get(id);
               sp.current++;
               if (!sp.repGenome || cell.offspring > sp.repOffspring) {
                    sp.repGenome = cell.genome;
                    sp.repOffspring = cell.offspring;
               }
               if (sp.current > sp.peak) sp.peak = sp.current;
          }

          for (const sp of this.species.values()) {
               if (sp.current === 0 && sp._prev > 0 && !sp.extinct) {
                    sp.extinct = true;
                    sp.extinctTime = world.time;
               }
          }

          if (this.species.size > MAX_SPECIES) {
               const extinct = [...this.species.values()]
                    .filter(s => s.extinct)
                    .sort((a, b) => a.extinctTime - b.extinctTime);
               let remove = this.species.size - MAX_SPECIES;
               for (const sp of extinct) {
                    if (remove <= 0) break;
                    this.species.delete(sp.id);
                    remove--;
               }
          }
     }

     _register(id, firstCell, time) {
          const letter = id[0];
          let parentId = null;
          const myNum = parseInt(id.slice(2), 10) || 0;
          let bestD = -1;
          for (const [otherId, sp] of this.species) {
               if (sp.extinct || otherId[0] !== letter) continue;
               const num = parseInt(otherId.slice(2), 10) || 0;
               const d = Math.abs(num - myNum);
               if (bestD < 0 || d < bestD) { bestD = d; parentId = otherId; }
          }

          this.species.set(id, {
               id,
               fullName: getFullId(firstCell.genome),
               longName: speciesLongName(firstCell.genome, id),
               hue: getHue(firstCell.genome),
               parentId,
               birthTime: time,
               extinct: false,
               extinctTime: null,
               current: 0,
               peak: 0,
               repGenome: firstCell.genome,
               repOffspring: 0,
               ordinal: this.ordinal++,
          });
     }

     list() { return [...this.species.values()]; }
     active() { return this.list().filter(s => s.current > 0); }
     extinct() { return this.list().filter(s => s.extinct); }
     get(id) { return this.species.get(id) || null; }
     clear() { this.species.clear(); this.ordinal = 1; }
}