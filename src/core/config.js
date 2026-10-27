export class Settings {
     static STORAGE_KEY = 'evogenesis.settings.v8';

     constructor() {
          this.defaults = {
               initialPop: 100,
               maxPop: 500,
               energyCapacity: 200,
               startReserve: 180,
               baseCost: 0.05,
               brainCostPerNeuron: 0.001,
               moveCostFactor: 0.015,
               ambientLight: 0.01,
               photoRate: 0.4,
               initialPoolEnergy: 50000,

               waterCount: 3,
               waterMinRadius: 150,
               waterMaxRadius: 350,
               slowCount: 2,
               slowMinRadius: 100,
               slowMaxRadius: 200,
               lightRadius: 280,
               lightSpeed: 1.0,
               waterCostMult: 1.5,
               waterSpeedMult: 0.6,
               slowSpeedMult: 0.4,
               lightZoneMult: 5.0,

               reproThreshold: 0.6,
               reproChildShare: 0.45,
               reproParentShare: 0.45,
               reproCooldown: 10,
               reproMinAge: 15,
               traitBudgetFraction: 0.5,

               corpseDecay: 0.15,

               mutationRate: 0.08,
               mutationResetProb: 0.003,
               slotMutationProb: 0.12,
               bodyMutationRate: 0.15,
               socialMutationRate: 0.05,

               densitySoftCap: 250,
               densityDeathRate: 0.015,
               densityRadius: 60,

               photoCrowdFactor: 0.2,

               tickHz: 20,
          };
          this.current = { ...this.defaults };
          this._watchers = [];
          this.load();
     }

     load() {
          try {
               const raw = localStorage.getItem(Settings.STORAGE_KEY);
               if (!raw) return;
               const parsed = JSON.parse(raw);
               for (const k of Object.keys(this.defaults)) {
                    if (!(k in parsed)) continue;
                    const v = parsed[k];
                    if (typeof v !== typeof this.defaults[k]) continue;
                    if (typeof v === 'number' && !Number.isFinite(v)) continue;
                    this.current[k] = v;
               }
          } catch (e) { console.warn('[Settings] load failed:', e); }
     }

     save() {
          try { localStorage.setItem(Settings.STORAGE_KEY, JSON.stringify(this.current)); } catch (e) { }
     }

     get(key) {
          const v = this.current[key];
          return v !== undefined ? v : this.defaults[key];
     }

     set(key, value) {
          if (!(key in this.defaults)) return;
          this.current[key] = value;
          this.save();
          for (const fn of this._watchers) { try { fn(key, value); } catch (e) { } }
     }

     watch(fn) { this._watchers.push(fn); }

     reset() {
          this.current = { ...this.defaults };
          try { localStorage.removeItem(Settings.STORAGE_KEY); } catch { }
     }
}

export const settings = new Settings();

export const CFG = {
     world: { width: 2000, height: 1500 },
     initial: { get cells() { return settings.get('initialPop'); } },
     energy: {
          get capacity() { return settings.get('energyCapacity'); },
          get startReserve() { return settings.get('startReserve'); },
          get baseCost() { return settings.get('baseCost'); },
          get brainCostPerNeuron() { return settings.get('brainCostPerNeuron'); },
          get moveCostFactor() { return settings.get('moveCostFactor'); },
          get ambientLight() { return settings.get('ambientLight'); },
          get photoRate() { return settings.get('photoRate'); },
          get initialPoolEnergy() { return settings.get('initialPoolEnergy'); },
     },
     corpse: { get decay() { return settings.get('corpseDecay'); } },
     zones: {
          get waterCount() { return settings.get('waterCount'); },
          get waterMinRadius() { return settings.get('waterMinRadius'); },
          get waterMaxRadius() { return settings.get('waterMaxRadius'); },
          get slowCount() { return settings.get('slowCount'); },
          get slowMinRadius() { return settings.get('slowMinRadius'); },
          get slowMaxRadius() { return settings.get('slowMaxRadius'); },
          get lightRadius() { return settings.get('lightRadius'); },
          get lightSpeedX() { return settings.get('lightSpeed') * 0.55; },
          get lightSpeedY() { return settings.get('lightSpeed') * 0.83; },
          get waterCostMult() { return settings.get('waterCostMult'); },
          get waterSpeedMult() { return settings.get('waterSpeedMult'); },
          get slowSpeedMult() { return settings.get('slowSpeedMult'); },
          get lightZoneMult() { return settings.get('lightZoneMult'); },
     },
     sim: { get tickHz() { return settings.get('tickHz'); }, get maxPop() { return settings.get('maxPop'); } },
     density: {
          get softCap() { return settings.get('densitySoftCap'); },
          get deathRate() { return settings.get('densityDeathRate'); },
          get radius() { return settings.get('densityRadius'); },
     },
     photo: {
          get crowdFactor() { return settings.get('photoCrowdFactor'); },
     },
};

// ============================================================
// Traits — every trait has BOTH an initial cost AND maintenance
// ============================================================

export const TRAITS = {
     // --- Feeding ---
     PHOTO: {
          key: 'photo', label: 'Photosynthesis',
          cost: { initial: 20, maintenance: 0.03 },
          side: false, color: '#22c55e', category: 'feed',
          effect: 'Extracts energy from pool × light. Crowding reduces yield.',
     },
     STOMACH: {
          key: 'stomach', label: 'Stomach',
          cost: { initial: 15, maintenance: 0.02 },
          side: false, color: '#f97316', category: 'feed',
          effect: 'Auto-eats corpses on contact.',
     },
     HUNT: {
          key: 'hunt', label: 'Hunt',
          cost: { initial: 25, maintenance: 0.03 },
          side: false, color: '#ef4444', category: 'feed',
          effect: 'Auto-drains energy from smaller cells on contact.',
     },

     // --- Sensing ---
     EYE: {
          key: 'eye', label: 'Eye',
          cost: { initial: 15, maintenance: 0.01 },
          side: false, color: '#a855f7', category: 'sense',
          effect: 'Vision radius 150 → 250.',
     },
     CHEMO: {
          key: 'chemo', label: 'Chemotaxis',
          cost: { initial: 12, maintenance: 0.01 },
          side: false, color: '#8b5cf6', category: 'sense',
          effect: 'Senses corpses up to 400 px.',
     },

     // --- Movement ---
     FLAGELLUM: {
          key: 'flagellum', label: 'Flagellum',
          cost: { initial: 20, maintenance: 0.02 },
          side: false, color: '#38bdf8', category: 'move',
          effect: 'Base speed +50%.',
     },
     JET: {
          key: 'jet', label: 'Jet',
          cost: { initial: 25, maintenance: 0.005, use: 0.3 },
          side: false, color: '#0ea5e9', category: 'move',
          effect: 'Burst speed ×2 at ×3 metabolic cost.',
     },

     // --- Defense ---
     SHIELD: {
          key: 'shield', label: 'Shield',
          cost: { initial: 20, maintenance: 0.02 },
          side: true, color: '#dc2626', category: 'defend',
          effect: '−70% damage taken (directional).',
     },
     THORN: {
          key: 'thorn', label: 'Thorn',
          cost: { initial: 20, maintenance: 0.02 },
          side: true, color: '#b91c1c', category: 'defend',
          effect: 'Attacker loses 30% of its energy (directional).',
     },
     CAMO: {
          key: 'camo', label: 'Camouflage',
          cost: { initial: 15, maintenance: 0.015 },
          side: false, color: '#78716c', category: 'defend',
          effect: 'Detection radius −40%.',
     },

     // --- Reproduction ---
     FISSION: {
          key: 'fission', label: 'Fission',
          cost: { initial: 10, maintenance: 0.008 },
          side: false, color: '#ec4899', category: 'repro',
          effect: 'Binary fission: 1 cell → 2 cells.',
     },
     CONJUGATION: {
          key: 'conjugation', label: 'Conjugation',
          cost: { initial: 20, maintenance: 0.015 },
          side: false, color: '#f43f5e', category: 'repro',
          effect: 'Sexual reproduction (needs partner).',
     },

     // --- Environmental ---
     WATER_ADAPT: {
          key: 'water_adapt', label: 'Water Adapt',
          cost: { initial: 12, maintenance: 0.008 },
          side: false, color: '#06b6d4', category: 'env',
          effect: '−30% metabolic cost in water zones.',
     },
     THERMO: {
          key: 'thermo', label: 'Thermophile',
          cost: { initial: 12, maintenance: 0.008 },
          side: false, color: '#facc15', category: 'env',
          effect: '+30% speed inside the light zone.',
     },
};

export const TRAIT_KEYS = Object.keys(TRAITS);
export const TRAIT_BY_KEY = Object.fromEntries(Object.values(TRAITS).map(t => [t.key, t]));

export const SETTINGS_DEF = {
     life: {
          label: 'Life & Energy',
          items: [
               { key: 'initialPop', label: 'Initial population', min: 20, max: 300, step: 10, fmt: v => v.toFixed(0) },
               { key: 'baseCost', label: 'Base metabolism', min: 0.01, max: 0.2, step: 0.005, fmt: v => v.toFixed(3) },
               { key: 'photoRate', label: 'Photo extraction', min: 0.1, max: 1.0, step: 0.05, fmt: v => v.toFixed(2) },
               { key: 'ambientLight', label: 'Ambient trickle', min: 0, max: 0.1, step: 0.005, fmt: v => v.toFixed(3) },
               { key: 'photoCrowdFactor', label: 'Photo crowding', min: 0.05, max: 1.0, step: 0.05, fmt: v => v.toFixed(2) },
               { key: 'initialPoolEnergy', label: 'Pool energy', min: 10000, max: 200000, step: 5000, fmt: v => (v / 1000).toFixed(0) + 'k' },
               { key: 'corpseDecay', label: 'Corpse decay', min: 0.01, max: 1.0, step: 0.01, fmt: v => v.toFixed(2) },
          ],
     },
     zones: {
          label: 'Zones',
          items: [
               { key: 'waterCount', label: 'Water zones', min: 0, max: 8, step: 1, fmt: v => v.toFixed(0) },
               { key: 'lightRadius', label: 'Light radius', min: 100, max: 500, step: 10, fmt: v => v.toFixed(0) },
               { key: 'lightSpeed', label: 'Light speed', min: 0.1, max: 3.0, step: 0.1, fmt: v => v.toFixed(1) },
               { key: 'lightZoneMult', label: 'Light ×', min: 1, max: 10, step: 0.5, fmt: v => v.toFixed(1) },
               { key: 'waterCostMult', label: 'Water cost ×', min: 1.0, max: 3.0, step: 0.1, fmt: v => v.toFixed(1) },
               { key: 'waterSpeedMult', label: 'Water speed ×', min: 0.2, max: 1.0, step: 0.05, fmt: v => v.toFixed(2) },
          ],
     },
     reproduction: {
          label: 'Reproduction',
          items: [
               { key: 'reproThreshold', label: 'Repro threshold', min: 0.4, max: 0.95, step: 0.05, fmt: v => v.toFixed(2) },
               { key: 'reproChildShare', label: 'Child share', min: 0.3, max: 0.55, step: 0.05, fmt: v => v.toFixed(2) },
               { key: 'reproCooldown', label: 'Cooldown (s)', min: 5, max: 40, step: 1, fmt: v => v.toFixed(0) },
               { key: 'reproMinAge', label: 'Min age (s)', min: 5, max: 40, step: 1, fmt: v => v.toFixed(0) },
               { key: 'traitBudgetFraction', label: 'Trait budget', min: 0.1, max: 0.9, step: 0.05, fmt: v => v.toFixed(2) },
          ],
     },
     mutation: {
          label: 'Mutation',
          items: [
               { key: 'mutationRate', label: 'Weight σ', min: 0, max: 0.3, step: 0.01, fmt: v => v.toFixed(2) },
               { key: 'slotMutationProb', label: 'Slot mutation', min: 0, max: 0.3, step: 0.01, fmt: v => v.toFixed(2) },
               { key: 'bodyMutationRate', label: 'Body σ', min: 0, max: 0.5, step: 0.01, fmt: v => v.toFixed(2) },
               { key: 'socialMutationRate', label: 'Social σ', min: 0, max: 0.3, step: 0.01, fmt: v => v.toFixed(2) },
          ],
     },
};