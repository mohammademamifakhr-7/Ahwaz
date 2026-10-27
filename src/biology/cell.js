import { settings, CFG } from '../core/config.js';
import { Genome } from './genome.js';
import { randRange, rand } from '../core/rng.js';
import { safeNum, clamp, wrapAngle } from '../core/utils.js';

const SENSE_IN = 26;

export class Cell {
     constructor(genome, x, y, id) {
          this.id = id;
          this.genome = genome || Genome.primordial();
          this.x = safeNum(x, 100);
          this.y = safeNum(y, 100);
          this.heading = randRange(-Math.PI, Math.PI);
          this.energy = settings.get('startReserve');
          this.age = 0;
          this.offspring = 0;
          this.alive = true;
          this.reproCooldown = 0;
          this.lastTurn = 0;
          this.lastThrottle = 0;
          this._corpseCreated = false;
          this._photoDemand = 0;
          this._photoGain = 0;
          this.metabolismSpent = 0;
          this.velX = 0;
          this.velY = 0;
          this.isFounder = false;
          this.recentDamage = 0;
          this._senseBuffer = new Float32Array(SENSE_IN);
          this.history = {
               birthTime: 0,
               birthLocation: { x: this.x, y: this.y },
               parentId: null,
               eaten: 0,
               killed: 0,
               escapes: 0,
               events: [],
          };
     }

     bodyRadius() { return this.genome.bodySize * 0.8 + 2; }
     countTrait(key) { return this.genome.countTrait(key); }

     getViewRange() {
          return this.countTrait('eye') > 0 ? 250 : 150;
     }

     getCorpseRange() {
          return this.countTrait('chemo') > 0 ? 400 : 150;
     }

     getMoveMultiplier(world) {
          let m = 1;
          if (this.countTrait('flagellum') > 0) m += 0.5;
          const inLight = (world.getLightMultiplier(this.x, this.y) ?? 1) > 1.5;
          if (inLight && this.countTrait('thermo') > 0) m += 0.3;
          return m;
     }

     isPhotosynthetic() { return this.countTrait('photo') > 0; }

     // Fill all 26 inputs explicitly. No implicit zeros — every slot has a
     // meaningful value, and every value is guaranteed to be finite.
     sense(world) {
          const inputs = this._senseBuffer;
          const cap = settings.get('energyCapacity');

          // 0-2: self state
          inputs[0] = clamp(this.energy / cap, 0, 1);
          inputs[1] = clamp(1 - this.energy / cap, 0, 1);
          inputs[2] = Math.min(1, this.age / 300);

          // 3-5: environment
          inputs[3] = clamp(world.getLightMultiplier(this.x, this.y) ?? 1, 0, 1);
          inputs[4] = world.getZoneType(this.x, this.y) ?? 0;
          const W = world.width ?? 2000, H = world.height ?? 1500;
          const dWall = Math.min(this.x, W - this.x, this.y, H - this.y);
          inputs[5] = clamp(1 - dWall / 200, 0, 1);

          // 6-9: self-awareness of traits
          inputs[6] = this.countTrait('photo') > 0 ? 1 : 0;
          inputs[7] = this.countTrait('stomach') > 0 ? 1 : 0;
          inputs[8] = this.countTrait('hunt') > 0 ? 1 : 0;
          inputs[9] = this.countTrait('eye') > 0 ? 1 : 0;

          // 10-14: nearest corpse (always written)
          inputs[10] = 0;
          inputs[11] = 0;
          inputs[12] = 0;
          inputs[13] = 0;
          inputs[14] = 0;
          const corpse = world.nearestCorpse(this.x, this.y, this.getCorpseRange());
          if (corpse) {
               const dx = corpse.x - this.x;
               const dy = corpse.y - this.y;
               const d = Math.sqrt(dx * dx + dy * dy) || 1;
               const a = Math.atan2(dy, dx) - this.heading;
               inputs[10] = Math.exp(-d / 100);
               inputs[11] = Math.sin(a);
               inputs[12] = Math.cos(a);
               // corpses don't move; 13-14 stay 0
          }

          // 15-23: nearest cell (always written)
          inputs[15] = 0;
          inputs[16] = 0;
          inputs[17] = 0;
          inputs[18] = 0;
          inputs[19] = 0;
          inputs[20] = 0;
          inputs[21] = 0;
          inputs[22] = this.genome.social[2];
          inputs[23] = this.genome.social[3];

          const other = world.nearestCell(this, this.getViewRange());
          if (other) {
               const dx = other.x - this.x;
               const dy = other.y - this.y;
               const d = Math.sqrt(dx * dx + dy * dy) || 1;
               const a = Math.atan2(dy, dx) - this.heading;

               inputs[15] = Math.exp(-d / 100);
               inputs[16] = Math.sin(a);
               inputs[17] = Math.cos(a);
               inputs[18] = clamp((this.genome.bodySize - other.genome.bodySize) / 6, -1, 1);

               const rvx = (other.velX || 0) - (this.velX || 0);
               const rvy = (other.velY || 0) - (this.velY || 0);
               const fwd = { x: Math.cos(this.heading), y: Math.sin(this.heading) };
               const side = { x: -fwd.y, y: fwd.x };
               inputs[19] = clamp((rvx * fwd.x + rvy * fwd.y) / 200, -1, 1);
               inputs[20] = clamp((rvx * side.x + rvy * side.y) / 200, -1, 1);
               inputs[21] = world.geneticSimilarity(this, other);
          }

          // 24-25: memory — filled by brain.think
          inputs[24] = 0;
          inputs[25] = 0;

          // Defensive: ensure every value is finite
          for (let i = 0; i < SENSE_IN; i++) {
               if (!Number.isFinite(inputs[i])) inputs[i] = 0;
          }

          return inputs;
     }

     act(world, dt) {
          if (!this.alive) return;
          if (!Number.isFinite(this.x) || !Number.isFinite(this.y) || !Number.isFinite(this.heading)) {
               world.returnToPool(Math.max(0, this.energy));
               this.energy = 0;
               this.alive = false;
               return;
          }

          if (this.energy <= 0) {
               if (this.metabolismSpent > 0) {
                    world.returnToPool(this.metabolismSpent);
                    this.metabolismSpent = 0;
               }
               this.energy = 0;
               this.alive = false;
               return;
          }

          this.age += dt;
          if (this.reproCooldown > 0) this.reproCooldown -= dt;
          if (this.recentDamage > 0) this.recentDamage = Math.max(0, this.recentDamage - dt * 2);

          const inputs = this.sense(world);
          const out = this.genome.brain.think(inputs);

          this.lastTurn = safeNum(out[0], 0);
          this.lastThrottle = safeNum(out[1], 0);

          const baseSpeed = 40 + this.genome.bodySize * 3;
          let speedMult = this.getMoveMultiplier(world);

          const jetActive = this.countTrait('jet') > 0 && this.lastThrottle > 0.85;
          if (jetActive) speedMult *= 2;

          const zoneSpeed = world.getSpeedMultiplier(this.x, this.y) ?? 1;
          const v = this.lastThrottle * baseSpeed * speedMult * zoneSpeed;

          this.heading = wrapAngle(this.heading + this.lastTurn * 2.5 * dt);
          this.x += Math.cos(this.heading) * v * dt;
          this.y += Math.sin(this.heading) * v * dt;

          const r = this.bodyRadius();
          const W = world.width ?? 2000, H = world.height ?? 1500;
          this.x = clamp(this.x, r, W - r);
          this.y = clamp(this.y, r, H - r);
          this.velX = Math.cos(this.heading) * v;
          this.velY = Math.sin(this.heading) * v;

          const brainNeurons = 20;
          let cost = settings.get('baseCost');
          cost += brainNeurons * settings.get('brainCostPerNeuron');
          cost += this.genome.upkeepCost();
          cost += this.lastThrottle * this.lastThrottle * settings.get('moveCostFactor');
          if (jetActive) cost *= 3;

          const zoneCost = world.getCostMultiplier(this.x, this.y) ?? 1;
          const waterAdapt = this.countTrait('water_adapt') > 0;
          const adaptMult = waterAdapt && zoneCost > 1 ? 0.7 : 1;

          const nominal = cost * dt * zoneCost * adaptMult;
          const actual = Math.min(this.energy, nominal);
          this.energy -= actual;
          this.metabolismSpent += actual;

          if (this.countTrait('stomach') > 0) {
               const c = world.nearestCorpse(this.x, this.y, 10 + r);
               if (c && c.alive) {
                    const gain = Math.min(c.energy, 30 * dt);
                    if (gain > 0) {
                         c.energy -= gain;
                         this.energy += gain;
                         if (this.history.eaten === 0) {
                              this.history.events.push({ t: world.time, ev: 'first meal' });
                         }
                         this.history.eaten++;
                         if (c.energy < 0.01) {
                              world.returnToPool(c.energy);
                              c.energy = 0;
                              c.alive = false;
                         }
                    }
               }
          }

          if (this.countTrait('hunt') > 0) {
               const target = world.nearestCell(this, 15 + r);
               if (target && target.alive && typeof target.defenseAgainst === 'function') {
                    const dx = target.x - this.x;
                    const dy = target.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 15 + r + target.bodyRadius()) {
                         if (this.genome.bodySize > target.genome.bodySize * 1.1) {
                              const relAngle = Math.atan2(-dy, -dx) - target.heading;
                              const def = target.defenseAgainst(relAngle);
                              const nominalDmg = 20 * (1 - def) * dt;
                              const actualDmg = Math.min(target.energy, nominalDmg);

                              target.energy -= actualDmg;
                              target.recentDamage = Math.min(1, target.recentDamage + actualDmg * 0.1);
                              this.energy += actualDmg * 0.5;
                              world.returnToPool(actualDmg * 0.5);

                              if (this.history.killed === 0 && target.energy <= 0) {
                                   this.history.events.push({ t: world.time, ev: 'first kill' });
                              }
                              if (target.energy <= 0) {
                                   this.history.killed++;
                                   if (target.countTrait('thorn') > 0) {
                                        const retaliation = Math.min(this.energy, this.energy * 0.3);
                                        this.energy -= retaliation;
                                        this.metabolismSpent += retaliation * 0.5;
                                        world.returnToPool(retaliation * 0.5);
                                   }
                              }
                         }
                    }
               }
          }

          const cap = settings.get('energyCapacity');
          if (this.energy > cap) {
               world.returnToPool(this.energy - cap);
               this.energy = cap;
          }
          if (!Number.isFinite(this.energy)) this.energy = 0;

          if (this.energy < cap * 0.1 && this.age > 30 && rand() < 0.005 * dt * 20) {
               const freed = this.genome.shedTraitUnderStress();
               if (freed > 0) {
                    this.history.events.push({ t: world.time, ev: 'shed trait under stress' });
               }
          }

          if (this.energy <= 0) {
               if (this.metabolismSpent > 0) {
                    world.returnToPool(this.metabolismSpent);
                    this.metabolismSpent = 0;
               }
               this.energy = 0;
               this.alive = false;
          }
     }

     tryReproduce(world, pendingBirths) {
          if (this.reproCooldown > 0) return;
          if (this.age < settings.get('reproMinAge')) return;
          const cap = settings.get('energyCapacity');
          if (this.energy < settings.get('reproThreshold') * cap) return;
          if (!this.genome.hasReproTrait()) return;
          if ((world.cells.length + pendingBirths.length) >= settings.get('maxPop')) return;

          // --- Sexual reproduction (conjugation) ---
          if (this.countTrait('conjugation') > 0) {
               const partner = world.nearestSexualPartner(this, 200);
               if (!partner) return;

               const childGenome = Genome.crossover(this.genome, partner.genome);
               const e1 = this.energy;
               const e2 = partner.energy;
               const childEnergy = e1 * 0.3 + e2 * 0.25;

               this.energy = e1 * 0.4;
               partner.energy = e2 * 0.4;

               // Any leftover energy returns to the pool — nothing is destroyed
               const leftover = e1 + e2 - childEnergy - this.energy - partner.energy;
               if (leftover > 0) world.returnToPool(leftover);

               partner.reproCooldown = settings.get('reproCooldown');
               partner.offspring++;
               partner.history.events.push({ t: world.time, ev: 'mated' });

               const angle = randRange(-Math.PI, Math.PI);
               const dist = this.bodyRadius() + 12;
               const cx = clamp(this.x + Math.cos(angle) * dist, 5, world.width - 5);
               const cy = clamp(this.y + Math.sin(angle) * dist, 5, world.height - 5);
               const child = new Cell(childGenome, cx, cy, world.nextId());
               child.energy = childEnergy;
               child.history.parentId = this.id;
               child.history.birthTime = world.time;
               child.history.birthLocation = { x: cx, y: cy };
               pendingBirths.push(child);

               this.offspring++;
               this.history.events.push({ t: world.time, ev: 'reproduced (sexual)' });
               this.reproCooldown = settings.get('reproCooldown');
               return;
          }

          // --- Asexual reproduction (fission) ---
          if (this.countTrait('fission') > 0) {
               const e = this.energy;
               const childEnergy = e * 0.45;
               const thermalization = e * 0.10;
               world.returnToPool(thermalization);

               const budget = childEnergy * settings.get('traitBudgetFraction');

               // Snapshot the parent's genome BEFORE mutation — child 2 will be
               // an independent mutant of this snapshot, not of the mutated parent.
               const parentSnapshot = this.genome.clone();

               // Child 1: this cell mutates in place
               const spent1 = this.genome.mutate(budget);
               const loss1 = Math.min(spent1, childEnergy);
               this.energy = childEnergy - loss1;
               if (loss1 > 0) world.returnToPool(loss1);

               this.age = 0;
               this.offspring = 1;
               this.reproCooldown = settings.get('reproCooldown');
               this.history.events.push({ t: world.time, ev: 'reproduced (fission → child 1)' });

               // Child 2: independent mutant of the same pre-mutation parent
               const child2Genome = parentSnapshot;
               const spent2 = child2Genome.mutate(budget);
               const loss2 = Math.min(spent2, childEnergy);
               const child2Energy = childEnergy - loss2;
               if (loss2 > 0) world.returnToPool(loss2);

               const angle = randRange(-Math.PI, Math.PI);
               const dist = this.bodyRadius() + 8;
               const cx = clamp(this.x + Math.cos(angle) * dist, 5, world.width - 5);
               const cy = clamp(this.y + Math.sin(angle) * dist, 5, world.height - 5);

               const child2 = new Cell(child2Genome, cx, cy, world.nextId());
               child2.energy = child2Energy;
               child2.history.parentId = this.history.parentId;
               child2.history.birthTime = world.time;
               child2.history.birthLocation = { x: cx, y: cy };
               pendingBirths.push(child2);
          }
     }
}