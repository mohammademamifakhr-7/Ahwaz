import { settings, CFG } from '../core/config.js';
import { Genome } from './genome.js';
import { randRange } from '../core/rng.js';
import { safeNum, clamp, wrapAngle } from '../core/utils.js';

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
          this.aggression = 0;
          this.share = 0;
          this.lastTurn = 0;
          this.lastThrottle = 0;
          this._corpseCreated = false;
          this._photoDemand = 0;
          this.metabolismSpent = 0;
          this.velX = 0;
          this.velY = 0;
          this.isFounder = false;
          this.history = {
               birthTime: 0,
               birthLocation: { x: this.x, y: this.y },
               parentId: null,
               parentSpecies: null,
               eaten: 0,
               killed: 0,
               escapes: 0,
               events: [],
          };
     }

     bodyRadius() { return this.genome.bodySize * 0.8 + 2; }
     countTrait(key) { return this.genome.countTrait(key); }

     getViewRange(world) {
          let r = 150;
          if (this.countTrait('eye') > 0) r = 250;
          return r;
     }

     getCorpseRange(world) {
          let r = 0;
          if (this.countTrait('chemo') > 0) r = 400;
          return r;
     }

     getMoveMultiplier(world) {
          let m = 1;
          if (this.countTrait('flagellum') > 0) m += 0.5;
          const inLight = (world.getLightMultiplier?.(this.x, this.y) ?? 1) > 1.5;
          if (inLight && this.countTrait('thermo') > 0) m += 0.3;
          return m;
     }

     // Auto-consume trait check (used by world for biofilm)
     isPhotosynthetic() { return this.countTrait('photo') > 0; }

     sense(world) {
          const inputs = new Float32Array(24);
          const cap = settings.get('energyCapacity');

          // 0: energy
          inputs[0] = clamp(this.energy / cap, 0, 1);
          // 1: hunger
          inputs[1] = clamp(1 - this.energy / cap, 0, 1);
          // 2: light
          inputs[2] = clamp(world.getLightMultiplier?.(this.x, this.y) ?? 1, 0, 1);
          // 3: zone type
          inputs[3] = world.getZoneType?.(this.x, this.y) ?? 0;
          // 4: wall distance
          const W = world.width ?? 2000, H = world.height ?? 1500;
          const dWall = Math.min(this.x, W - this.x, this.y, H - this.y);
          inputs[4] = clamp(1 - dWall / 200, 0, 1);

          // 5-7: nearest corpse
          const corpseRange = Math.max(150, this.getCorpseRange(world));
          const corpse = world.nearestCorpse?.(this.x, this.y, corpseRange);
          if (corpse) {
               const dx = corpse.x - this.x, dy = corpse.y - this.y;
               const d = Math.sqrt(dx * dx + dy * dy) || 1;
               const a = Math.atan2(dy, dx) - this.heading;
               inputs[5] = Math.exp(-d / 80);
               inputs[6] = Math.sin(a);
               inputs[7] = Math.cos(a);
          }

          // 8-10: nearest cell
          const viewR = this.getViewRange(world);
          const other = world.nearestCell?.(this, viewR);
          if (other) {
               const dx = other.x - this.x, dy = other.y - this.y;
               const d = Math.sqrt(dx * dx + dy * dy) || 1;
               const a = Math.atan2(dy, dx) - this.heading;
               inputs[8] = Math.exp(-d / 80);
               inputs[9] = Math.sin(a);
               inputs[10] = Math.cos(a);

               // 11: size ratio (-1: I'm much smaller, +1: much bigger)
               inputs[11] = clamp((this.genome.bodySize - other.genome.bodySize) / 5, -1, 1);

               // 12-13: relative velocity
               const rvx = (other.velX || 0) - (this.velX || 0);
               const rvy = (other.velY || 0) - (this.velY || 0);
               const fwd = { x: Math.cos(this.heading), y: Math.sin(this.heading) };
               const side = { x: -fwd.y, y: fwd.x };
               inputs[12] = clamp((rvx * fwd.x + rvy * fwd.y) / 200, -1, 1);
               inputs[13] = clamp((rvx * side.x + rvy * side.y) / 200, -1, 1);

               // 14: genetic similarity (0-1)
               inputs[14] = world.geneticSimilarity?.(this, other) ?? 0.5;
          } else {
               inputs[11] = 0; inputs[12] = 0; inputs[13] = 0; inputs[14] = 0;
          }

          // 15-16: my social preferences
          inputs[15] = this.genome.social[2];  // kin
          inputs[16] = this.genome.social[3];  // stranger
          // 17-19: self-aware of traits
          inputs[17] = this.countTrait('photo') > 0 ? 1 : 0;
          inputs[18] = this.countTrait('stomach') > 0 ? 1 : 0;
          inputs[19] = this.countTrait('hunt') > 0 ? 1 : 0;
          // 20: age
          inputs[20] = Math.min(1, this.age / 200);
          // 21: offspring
          inputs[21] = Math.min(1, this.offspring / 10);
          // 22-23: memory (brain fills)

          return inputs;
     }

     act(world, dt) {
          if (!this.alive) return;

          if (this.energy <= 0) {
               if (this.metabolismSpent > 0) { world.returnToPool(this.metabolismSpent); this.metabolismSpent = 0; }
               this.energy = 0;
               this.alive = false;
               return;
          }

          this.age += dt;
          if (this.reproCooldown > 0) this.reproCooldown -= dt;

          const inputs = this.sense(world);
          const out = this.genome.brain.think(inputs);

          this.lastTurn = safeNum(out[0], 0);
          this.lastThrottle = safeNum(out[1], 0);
          this.aggression = safeNum(out[2], 0);
          this.share = safeNum(out[3], 0);

          // Movement
          let baseSpeed = 40 + this.genome.bodySize * 3;
          let speedMult = this.getMoveMultiplier(world);

          // Flee bonus: if aggression < -0.3, boost speed (brain learning to flee)
          if (this.aggression < -0.3) {
               speedMult *= 1.5;
          }
          // Jet burst: high cost for speed
          const jetActive = this.countTrait('jet') > 0 && this.lastThrottle > 0.8;
          if (jetActive) speedMult *= 2;

          const zoneSpeed = world.getSpeedMultiplier?.(this.x, this.y) ?? 1;
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

          // Metabolism
          const inGrace = this.isFounder && world.time < world.founderGraceUntil;
          const brainNeurons = 20;
          let cost = settings.get('baseCost');
          cost += brainNeurons * settings.get('brainCostPerNeuron');
          cost += this.genome.upkeepCost();
          cost += this.lastThrottle * this.lastThrottle * settings.get('moveCostFactor');
          if (jetActive) cost *= 3;
          if (inGrace) cost *= 0.4;

          const zoneCost = world.getCostMultiplier?.(this.x, this.y) ?? 1;
          const waterAdapt = this.countTrait('water_adapt') > 0;
          const adaptMult = waterAdapt && zoneCost > 1 ? 0.7 : 1;

          const nominal = cost * dt * zoneCost * adaptMult;
          const actual = Math.min(this.energy, nominal);
          this.energy -= actual;
          this.metabolismSpent += actual;

          // Eat corpse (automatic if stomach + contact)
          if (this.countTrait('stomach') > 0) {
               const c = world.nearestCorpse?.(this.x, this.y, 10 + r);
               if (c && c.alive) {
                    const gain = Math.min(c.energy, 30 * dt);
                    if (gain > 0) {
                         c.energy -= gain;
                         this.energy += gain;
                         if (this.history.eaten === 0) this.history.events.push({ t: world.time, ev: 'first meal' });
                         this.history.eaten++;
                         if (c.energy < 0.01) {
                              world.returnToPool(c.energy);
                              c.energy = 0;
                              c.alive = false;
                         }
                    }
               }
          }

          // Hunt / flee interaction
          const target = world.nearestCell?.(this, 15 + r);
          if (target) {
               const dx = target.x - this.x, dy = target.y - this.y;
               const dist = Math.sqrt(dx * dx + dy * dy);
               if (dist < 15 + r + target.bodyRadius()) {
                    const myHunt = this.countTrait('hunt');
                    const mySize = this.genome.bodySize;
                    const theirSize = target.genome.bodySize;

                    // Hunt: aggression > 0.3 + hunt trait + smaller target
                    if (this.aggression > 0.3 && myHunt > 0 && mySize > theirSize * 0.9) {
                         const def = target.defenseAgainst(Math.atan2(-dy, -dx) - target.heading);
                         const nominalDmg = settings.get('combatBaseCost') * (1 - def) * dt;
                         const actualDmg = Math.min(target.energy, nominalDmg);
                         target.energy -= actualDmg;
                         this.metabolismSpent += actualDmg * 0.5;
                         world.returnToPool(actualDmg * 0.5);

                         if (target.alive && target.energy <= 0) {
                              if (this.history.killed === 0) this.history.events.push({ t: world.time, ev: 'first kill' });
                              this.history.killed++;
                              // Thorn retaliation
                              if (target.countTrait('thorn') > 0) {
                                   this.energy -= this.energy * 0.3;
                              }
                         }
                    }
               }
          }

          // Cap
          const cap = settings.get('energyCapacity');
          if (this.energy > cap) {
               world.returnToPool(this.energy - cap);
               this.energy = cap;
          }
          if (!Number.isFinite(this.energy)) this.energy = 0;

          // Death
          if (this.energy <= 0) {
               if (this.metabolismSpent > 0) { world.returnToPool(this.metabolismSpent); this.metabolismSpent = 0; }
               this.energy = 0;
               this.alive = false;
          }
     }

     // Binary fission: THIS cell becomes child 1 (mutated), a NEW cell is child 2.
     // NO corpse left behind. 1 cell → 2 cells. 10% cost to pool.
     tryReproduce(world, pendingBirths) {
          if (this.reproCooldown > 0) return;
          if (this.age < settings.get('reproMinAge')) return;
          const cap = settings.get('energyCapacity');
          if (this.energy < settings.get('reproThreshold') * cap) return;
          if (!this.genome.hasReproTrait()) return;
          if ((world.cells.length + pendingBirths.length) >= settings.get('maxPop')) return;

          const hasConjugation = this.countTrait('conjugation') > 0;

          if (hasConjugation) {
               const partner = world.nearestSexualPartner?.(this, 200);
               if (!partner) return;
               const childGenome = Genome.crossover(this.genome, partner.genome);
               const e = this.energy;
               const childEnergy = e * 0.45;
               const partnerE = partner.energy;
               const partnerChildEnergy = partnerE * 0.35;

               this.energy = e * 0.35;
               partner.energy = partnerE * 0.35;
               partner.reproCooldown = settings.get('reproCooldown');
               partner.offspring++;
               partner.history.events.push({ t: world.time, ev: 'mated' });

               const angle = randRange(-Math.PI, Math.PI);
               const cx = clamp(this.x + Math.cos(angle) * (this.bodyRadius() + 12), 5, world.width - 5);
               const cy = clamp(this.y + Math.sin(angle) * (this.bodyRadius() + 12), 5, world.height - 5);
               const child = new Cell(childGenome, cx, cy, world.nextId());
               child.energy = childEnergy + partnerChildEnergy;
               child.history.parentId = this.id;
               child.history.birthTime = world.time;
               child.history.birthLocation = { x: cx, y: cy };
               pendingBirths.push(child);

               this.offspring++;
               this.history.events.push({ t: world.time, ev: 'reproduced (sexual)' });
               this.reproCooldown = settings.get('reproCooldown');
               return;
          }

          // Fission (asexual): parent becomes child 1, new cell is child 2.
          const e = this.energy;
          const childEnergy = e * 0.45;
          const cost = e * 0.10;
          world.returnToPool(cost);

          // Parent mutates INTO child 1 (it's now a new organism)
          const budget = childEnergy * settings.get('traitBudgetFraction');
          const spent = this.genome.mutate(budget);
          if (spent > 0) world.returnToPool(spent);
          this.energy = childEnergy - spent / 2;
          if (this.energy < 0) this.energy = 0;
          this.age = 0;
          this.offspring = 0;
          this.reproCooldown = settings.get('reproCooldown');
          this.history = {
               birthTime: world.time,
               birthLocation: { x: this.x, y: this.y },
               parentId: this.history.parentId,
               parentSpecies: null,
               eaten: 0,
               killed: 0,
               escapes: 0,
               events: [{ t: world.time, ev: 'reproduced (fission → became child 1)' }],
          };

          // Child 2 is new
          const angle = randRange(-Math.PI, Math.PI);
          const cx = clamp(this.x + Math.cos(angle) * (this.bodyRadius() + 8), 5, world.width - 5);
          const cy = clamp(this.y + Math.sin(angle) * (this.bodyRadius() + 8), 5, world.height - 5);
          const child2Genome = this.genome.clone();
          const spent2 = child2Genome.mutate(budget);
          if (spent2 > 0) world.returnToPool(spent2);
          const child2 = new Cell(child2Genome, cx, cy, world.nextId());
          child2.energy = Math.max(0, childEnergy - spent2 / 2);
          child2.history.parentId = this.history.parentId;
          child2.history.birthTime = world.time;
          child2.history.birthLocation = { x: cx, y: cy };
          pendingBirths.push(child2);

          this.offspring = 1;  // one child (the other IS this cell)
     }
}