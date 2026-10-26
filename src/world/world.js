import { CFG, settings } from '../core/config.js';
import { Cell } from '../biology/cell.js';
import { Genome } from '../biology/genome.js';
import { Zones } from './zones.js';
import { randRange, rand } from '../core/rng.js';
import { geneBank } from '../evolution/gene-bank.js';

export class World {
     constructor() {
          this.time = 0;
          this._nextId = 1;
          this.cells = [];
          this.corpses = [];
          this.history = [];
          this.historyTimer = 0;
          this.zones = new Zones();
          this.energyPool = 0;
          this.founderGraceUntil = CFG.energy.founderGraceSeconds;
          this._pendingGeneBank = [];
          this._spawnInitial();
          this._initPool();
          this._initialTotal = this.getTotalEnergy();
     }

     get width() { return CFG.world.width; }
     get height() { return CFG.world.height; }

     nextId() { return this._nextId++; }

     _spawnInitial() {
          const W = CFG.world.width;
          const H = CFG.world.height;
          const n = CFG.initial.cells;
          for (let i = 0; i < n; i++) {
               const c = new Cell(
                    Genome.primordial(),
                    randRange(50, W - 50),
                    randRange(50, H - 50),
                    this.nextId()
               );
               c.isFounder = true;
               c.history.birthTime = 0;
               c.history.birthLocation = { x: c.x, y: c.y };
               this.cells.push(c);
          }
     }

     _initPool() {
          this.energyPool = CFG.energy.initialPoolEnergy;
     }

     consumePoolEnergy(amount) {
          const a = Number.isFinite(amount) && amount > 0 ? amount : 0;
          const taken = Math.min(this.energyPool, a);
          this.energyPool -= taken;
          return taken;
     }

     returnToPool(amount) {
          const a = Number.isFinite(amount) && amount > 0 ? amount : 0;
          this.energyPool += a;
          return a;
     }

     getTotalEnergy() {
          let e = this.energyPool;
          for (const c of this.cells) e += c.energy;
          for (const c of this.corpses) e += c.energy;
          return e;
     }

     getEnergyBreakdown() {
          let cellE = 0;
          let corpseE = 0;
          for (const c of this.cells) cellE += c.energy;
          for (const c of this.corpses) corpseE += c.energy;
          const total = this.energyPool + cellE + corpseE;
          const safe = total > 0 ? total : 1;
          return {
               total,
               pool: this.energyPool,
               cells: cellE,
               corpses: corpseE,
               poolPct: (this.energyPool / safe) * 100,
               cellsPct: (cellE / safe) * 100,
               corpsesPct: (corpseE / safe) * 100,
          };
     }

     assertEnergyInvariant(tolerance = 2) {
          if (!this._initialTotal) return true;
          const now = this.getTotalEnergy();
          const drift = Math.abs(now - this._initialTotal);
          if (drift > tolerance) {
               console.warn(
                    '[EnergyInvariant] drift=' + drift.toFixed(3) +
                    ' initial=' + this._initialTotal.toFixed(2) +
                    ' now=' + now.toFixed(2)
               );
               return false;
          }
          return true;
     }

     countPhotosyntheticNeighbors(cell) {
          let n = 0;
          const r2 = CFG.biofilm.radius ** 2;
          for (const other of this.cells) {
               if (other === cell || !other.alive) continue;
               if (!other.isPhotosynthetic()) continue;
               const dx = other.x - cell.x;
               const dy = other.y - cell.y;
               if (dx * dx + dy * dy < r2) n++;
          }
          return n;
     }

     geneticSimilarity(a, b) {
          const wa = a.genome.brain.w;
          const wb = b.genome.brain.w;
          if (wa.length !== wb.length) return 0.5;
          let dot = 0;
          let ma = 0;
          let mb = 0;
          for (let i = 0; i < wa.length; i += 8) {
               dot += wa[i] * wb[i];
               ma += wa[i] * wa[i];
               mb += wb[i] * wb[i];
          }
          if (ma === 0 || mb === 0) return 0.5;
          const cos = dot / Math.sqrt(ma * mb);
          return Math.max(0, Math.min(1, (cos + 1) / 2));
     }

     _photosynthesisTick(dt) {
          const ambient = CFG.energy.ambientLight;
          const photoRate = CFG.energy.photoRate;
          const biofilmBonus = CFG.biofilm.bonus;
          const biofilmCap = CFG.biofilm.cap;

          let totalDemand = 0;
          for (const cell of this.cells) {
               if (!cell.alive) {
                    cell._photoDemand = 0;
                    continue;
               }
               const photoSlots = cell.countTrait('photo');
               const inGrace = cell.isFounder && this.time < this.founderGraceUntil;
               let demand = ambient * dt;

               if (photoSlots > 0) {
                    const lightMult = this.getLightMultiplier(cell.x, cell.y);
                    const n = this.countPhotosyntheticNeighbors(cell);
                    const biofilmMult = 1 + Math.min(biofilmCap, n * biofilmBonus);
                    demand += photoSlots * photoRate * lightMult * biofilmMult * dt;
               } else if (inGrace) {
                    demand += photoRate * 0.3 * this.getLightMultiplier(cell.x, cell.y) * dt;
               }

               cell._photoDemand = demand;
               totalDemand += demand;
          }

          if (totalDemand <= 0) return;

          const available = Math.max(0, this.energyPool);
          const scale = available < totalDemand ? available / totalDemand : 1;

          for (const cell of this.cells) {
               if (!cell.alive || !cell._photoDemand) continue;
               const gain = cell._photoDemand * scale;
               if (gain > 0) {
                    cell.energy += gain;
                    this.energyPool -= gain;
               }
               cell._photoDemand = 0;
          }
     }

     // Density pressure — kills cells above the soft cap but returns ALL
     // leftover energy to the pool so the invariant stays intact.
     _densityPressure(dt) {
          const softCap = CFG.density.softCap;
          const n = this.cells.length;
          if (n <= softCap) return;

          const excess = (n - softCap) / 100;
          const deathRate = CFG.density.deathRate * excess;

          for (const cell of this.cells) {
               if (!cell.alive) continue;
               if (cell.isFounder && this.time < this.founderGraceUntil) continue;
               if (rand() < deathRate * dt) {
                    const leftover = Math.max(0, cell.energy);
                    cell.energy = 0;
                    cell.alive = false;
                    cell._corpseCreated = true;

                    if (leftover > 0.5) {
                         // Half becomes a corpse for scavengers, half returns to the pool
                         this.corpses.push({
                              x: cell.x,
                              y: cell.y,
                              energy: leftover * 0.5,
                              alive: true,
                         });
                         this.returnToPool(leftover * 0.5);
                    } else {
                         this.returnToPool(leftover);
                    }
               }
          }
     }

     // Safety net: if population drops very low, respawn a few cells from
     // the pool. Energy is conserved — pool energy becomes cell energy.
     _populationSafetyNet() {
          const n = this.cells.length;
          if (n >= 5) return;

          const reserved = CFG.energy.capacity * 0.5;
          const maxSpawn = Math.floor(this.energyPool / reserved);
          if (maxSpawn <= 0) return;

          const toSpawn = Math.min(20 - n, maxSpawn);
          const W = CFG.world.width;
          const H = CFG.world.height;

          for (let i = 0; i < toSpawn; i++) {
               const genome = Genome.primordial();
               const cell = new Cell(
                    genome,
                    randRange(50, W - 50),
                    randRange(50, H - 50),
                    this.nextId()
               );
               const taken = this.consumePoolEnergy(reserved);
               if (taken < reserved * 0.5) return;
               cell.energy = taken;
               cell.isFounder = true;
               cell.history.birthTime = this.time;
               cell.history.birthLocation = { x: cell.x, y: cell.y };
               cell.history.events.push({ t: this.time, ev: 'emergency respawn' });
               this.cells.push(cell);
          }

          // Extend grace so the new founders have time to adapt
          const neededGrace = this.time + 60;
          if (this.founderGraceUntil < neededGrace) {
               this.founderGraceUntil = neededGrace;
          }
     }

     step(dt) {
          this.time += dt;
          this.zones.update(dt);
          this._photosynthesisTick(dt);
          this._densityPressure(dt);

          for (const cell of this.cells) {
               if (!cell.alive) continue;
               cell.metabolismSpent = 0;
               cell.act(this, dt);
          }

          for (const cell of this.cells) {
               if (cell.metabolismSpent > 0) {
                    this.energyPool += cell.metabolismSpent;
                    cell.metabolismSpent = 0;
               }
          }

          const pendingBirths = [];
          for (const cell of this.cells) {
               if (cell.alive) cell.tryReproduce(this, pendingBirths);
          }

          // Deaths — convert remaining energy to a corpse or return to pool
          for (const cell of this.cells) {
               if (!cell.alive && !cell._corpseCreated) {
                    cell._corpseCreated = true;
                    if (cell.energy > 0.1) {
                         this.corpses.push({
                              x: cell.x,
                              y: cell.y,
                              energy: cell.energy,
                              alive: true,
                         });
                    } else {
                         this.returnToPool(cell.energy);
                    }
                    cell.energy = 0;

                    // Defer gene bank write — batched later
                    if (cell.offspring >= 2 || cell.age >= 90) {
                         this._pendingGeneBank.push({
                              genome: cell.genome.clone(),
                              offspring: cell.offspring,
                              age: cell.age,
                         });
                    }
               }
          }

          // Corpse decay
          for (const c of this.corpses) {
               if (!c.alive) continue;
               const decay = CFG.corpse.decay * dt;
               const actual = Math.min(c.energy, decay);
               c.energy -= actual;
               this.energyPool += actual;
               if (c.energy < 0.01) {
                    this.energyPool += c.energy;
                    c.energy = 0;
                    c.alive = false;
               }
          }

          this.cells = this.cells.filter(c => c.alive);
          this.corpses = this.corpses.filter(c => c.alive);
          this.cells.push(...pendingBirths);

          this._populationSafetyNet();

          // Flush batched gene bank writes
          if (this._pendingGeneBank.length > 0) {
               const batch = this._pendingGeneBank;
               this._pendingGeneBank = [];
               try { geneBank.considerBatch(batch); } catch (e) { /* ignore */ }
          }

          // History sampling
          this.historyTimer += dt;
          if (this.historyTimer >= 0.5) {
               this.historyTimer = 0;
               const br = this.getEnergyBreakdown();
               this.history.push({
                    t: this.time,
                    cells: this.cells.length,
                    corpses: this.corpses.length,
                    pool: this.energyPool,
                    avgEnergy: this.avgEnergy(),
                    total: br.total,
                    cellsE: br.cells,
               });
               if (this.history.length > 600) {
                    this.history = this.history.filter((_, i) => i % 2 === 0);
               }
          }
     }

     avgEnergy() {
          if (this.cells.length === 0) return 0;
          let s = 0;
          for (const c of this.cells) s += c.energy;
          return s / this.cells.length;
     }

     spawnFromGenome(genome, x, y) {
          const W = CFG.world.width;
          const H = CFG.world.height;
          const needed = CFG.energy.capacity * 0.5;
          if (this.energyPool < needed) return null;
          const taken = this.consumePoolEnergy(needed);
          const cell = new Cell(
               genome.clone(),
               Math.max(20, Math.min(W - 20, x)),
               Math.max(20, Math.min(H - 20, y)),
               this.nextId()
          );
          cell.energy = taken;
          cell.history.birthTime = this.time;
          cell.history.birthLocation = { x: cell.x, y: cell.y };
          cell.history.events.push({ t: this.time, ev: 'spawned from gene bank' });
          this.cells.push(cell);
          return cell;
     }

     nearestCell(self, r) {
          let best = null;
          let bestD = r * r;
          for (const c of this.cells) {
               if (c === self || !c.alive) continue;
               const d = (c.x - self.x) ** 2 + (c.y - self.y) ** 2;
               if (d < bestD) {
                    bestD = d;
                    best = c;
               }
          }
          return best;
     }

     nearestCorpse(x, y, r) {
          let best = null;
          let bestD = r * r;
          for (const c of this.corpses) {
               if (!c.alive) continue;
               const d = (c.x - x) ** 2 + (c.y - y) ** 2;
               if (d < bestD) {
                    bestD = d;
                    best = c;
               }
          }
          return best;
     }

     nearestSexualPartner(self, r) {
          let best = null;
          let bestD = r * r;
          for (const c of this.cells) {
               if (c === self || !c.alive) continue;
               if (!c.genome.hasTrait('conjugation')) continue;
               if (c.energy < CFG.energy.capacity * 0.3) continue;
               const d = (c.x - self.x) ** 2 + (c.y - self.y) ** 2;
               if (d < bestD) {
                    bestD = d;
                    best = c;
               }
          }
          return best;
     }

     getCostMultiplier(x, y) { return this.zones.getCostMultiplier(x, y); }
     getSpeedMultiplier(x, y) { return this.zones.getSpeedMultiplier(x, y); }
     getLightMultiplier(x, y) { return this.zones.getLightMultiplier(x, y); }
     getZoneType(x, y) { return this.zones.getZoneType(x, y); }
     regenerateZones() { this.zones.rebuild(); }

     toJSON() {
          return {
               time: this.time,
               nextId: this._nextId,
               energyPool: this.energyPool,
               initialTotal: this._initialTotal,
               founderGraceUntil: this.founderGraceUntil,
               cells: this.cells.map(c => ({
                    id: c.id,
                    x: c.x,
                    y: c.y,
                    heading: c.heading,
                    energy: c.energy,
                    age: c.age,
                    offspring: c.offspring,
                    reproCooldown: c.reproCooldown,
                    velX: c.velX,
                    velY: c.velY,
                    isFounder: c.isFounder,
                    genome: {
                         w: Array.from(c.genome.brain.w),
                         slots: c.genome.slots.map(s => s ? { ...s } : null),
                         social: c.genome.social.slice(),
                         bodySize: c.genome.bodySize,
                         generation: c.genome.generation,
                    },
                    history: c.history,
               })),
               corpses: this.corpses.map(c => ({ x: c.x, y: c.y, energy: c.energy })),
               zones: this.zones.toJSON(),
               history: this.history.slice(-100),
          };
     }

     static async fromJSON(data, GenomeClass, CellClass, ZonesClass) {
          const { Brain } = await import('../biology/brain.js');
          const w = Object.create(World.prototype);
          w.time = data.time;
          w._nextId = data.nextId;
          w.energyPool = data.energyPool;
          w._initialTotal = data.initialTotal;
          w.founderGraceUntil = data.founderGraceUntil ?? CFG.energy.founderGraceSeconds;
          w.corpses = data.corpses.map(c => ({ ...c, alive: true }));
          w.history = data.history || [];
          w.historyTimer = 0;
          w._pendingGeneBank = [];
          w.zones = ZonesClass.fromJSON(data.zones);
          w.cells = data.cells.map(cd => {
               const g = new GenomeClass(
                    new Brain(new Float32Array(cd.genome.w)),
                    cd.genome.slots,
                    cd.genome.social,
                    cd.genome.bodySize,
                    cd.genome.generation
               );
               const c = new CellClass(g, cd.x, cd.y, cd.id);
               c.heading = cd.heading;
               c.energy = cd.energy;
               c.age = cd.age;
               c.offspring = cd.offspring;
               c.reproCooldown = cd.reproCooldown;
               c.velX = cd.velX;
               c.velY = cd.velY;
               c.isFounder = cd.isFounder ?? false;
               if (cd.history) c.history = cd.history;
               c.alive = true;
               return c;
          });
          return w;
     }

     reset() {
          this.time = 0;
          this._nextId = 1;
          this.cells = [];
          this.corpses = [];
          this.history = [];
          this.historyTimer = 0;
          this._pendingGeneBank = [];
          this.founderGraceUntil = CFG.energy.founderGraceSeconds;
          this._spawnInitial();
          this._initPool();
          this._initialTotal = this.getTotalEnergy();
     }
}