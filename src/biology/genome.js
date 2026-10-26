import { settings, TRAITS, TRAIT_KEYS, TRAIT_BY_KEY } from '../core/config.js';
import { Brain } from './brain.js';
import { rand, randInt, randNormal, randPick } from '../core/rng.js';

export class Genome {
     constructor(brain, slots, social, bodySize, generation = 0) {
          this.brain = brain || new Brain();
          this.slots = slots || [null, null, null, null, null, null];
          this.social = social || [0, 0, 0, 0, 0, 0];
          this.bodySize = Number.isFinite(bodySize) ? bodySize : 5;
          this.generation = generation || 0;
     }

     static primordial() {
          const slots = [null, null, null, null, null, null];
          // Founders start with photo (they can extract energy immediately)
          // and fission (they can reproduce)
          slots[0] = { trait: 'photo', side: null };
          slots[1] = { trait: 'fission', side: null };
          return new Genome(
               new Brain(),
               slots,
               [0, 0, 0.5, 0, 0, 0.3],
               5 + randNormal(0, 0.3),
               0
          );
     }

     countTrait(key) {
          let n = 0;
          for (const s of this.slots) if (s && s.trait === key) n++;
          return n;
     }

     hasTrait(key) { return this.countTrait(key) > 0; }
     hasReproTrait() { return this.hasTrait('fission') || this.hasTrait('conjugation'); }

     upkeepCost() {
          let cost = 0;
          for (const s of this.slots) {
               if (!s) continue;
               const t = TRAIT_BY_KEY[s.trait];
               if (t && t.cost && t.cost.maintenance) cost += t.cost.maintenance;
          }
          return cost;
     }

     mutate(traitBudget = 0) {
          this.brain.mutate();

          this.bodySize += randNormal(0, settings.get('bodyMutationRate'));
          this.bodySize = Math.max(3, Math.min(12, this.bodySize));
          if (!Number.isFinite(this.bodySize)) this.bodySize = 5;

          for (let i = 0; i < 6; i++) {
               this.social[i] += randNormal(0, settings.get('socialMutationRate'));
               this.social[i] = Math.max(-1, Math.min(1, this.social[i]));
               if (!Number.isFinite(this.social[i])) this.social[i] = 0;
          }

          const slotProb = settings.get('slotMutationProb');
          let spent = 0;
          for (let i = 0; i < 6; i++) {
               if (rand() < slotProb) {
                    spent += this._mutateSlot(i, Math.max(0, traitBudget - spent));
               }
          }
          this.generation++;
          return spent;
     }

     _mutateSlot(i, budget) {
          const s = this.slots[i];
          const r = rand();

          // Weighted pick by cost — cheaper traits more likely
          const pickTrait = () => {
               const affordable = TRAIT_KEYS.filter(k => (TRAITS[k].cost?.initial || 0) <= budget);
               if (!affordable.length) return null;
               const weights = affordable.map(k => 1 / (1 + (TRAITS[k].cost?.initial || 0)));
               const total = weights.reduce((a, b) => a + b, 0);
               let roll = rand() * total;
               for (let j = 0; j < affordable.length; j++) {
                    roll -= weights[j];
                    if (roll <= 0) return TRAITS[affordable[j]];
               }
               return TRAITS[affordable[affordable.length - 1]];
          };

          if (!s) {
               if (r < 0.6) {
                    const trait = pickTrait();
                    if (!trait) return 0;
                    this.slots[i] = { trait: trait.key, side: trait.side ? randInt(0, 5) : null };
                    return trait.cost?.initial || 0;
               }
          } else if (r < 0.25) {
               this.slots[i] = null;
          } else if (r < 0.65) {
               const trait = pickTrait();
               if (!trait) return 0;
               this.slots[i] = { trait: trait.key, side: trait.side ? randInt(0, 5) : null };
               return trait.cost?.initial || 0;
          } else if (s.side !== null) {
               this.slots[i].side = randInt(0, 5);
          }
          return 0;
     }

     clone() {
          return new Genome(
               this.brain.clone(),
               this.slots.map(s => s ? { ...s } : null),
               this.social.slice(),
               this.bodySize,
               this.generation
          );
     }

     static crossover(a, b) {
          const w = new Float32Array(a.brain.w.length);
          for (let i = 0; i < w.length; i++) w[i] = rand() < 0.5 ? a.brain.w[i] : b.brain.w[i];
          const childSlots = [];
          for (let i = 0; i < 6; i++) {
               const src = rand() < 0.5 ? a.slots[i] : b.slots[i];
               childSlots.push(src ? { ...src } : null);
          }
          const childSocial = [];
          for (let i = 0; i < 6; i++) childSocial.push(rand() < 0.5 ? a.social[i] : b.social[i]);
          return new Genome(new Brain(w), childSlots, childSocial,
               (a.bodySize + b.bodySize) / 2, Math.max(a.generation, b.generation));
     }
}