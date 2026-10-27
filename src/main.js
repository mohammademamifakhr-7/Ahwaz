import { settings, CFG } from './core/config.js';
import { seed } from './core/rng.js';
import { formatTime } from './core/utils.js';
import { saveWorld, loadLatestWorld, clearWorlds } from './core/db.js';
import { World } from './world/world.js';
import { Cell } from './biology/cell.js';
import { Genome } from './biology/genome.js';
import { Zones } from './world/zones.js';
import { Camera } from './world/camera.js';
import { Renderer } from './render/renderer.js';
import { SpeciesTracker } from './evolution/species.js';
import { Phylogeny } from './evolution/phylogeny.js';
import { Panel } from './ui/panel.js';
import { geneBank } from './evolution/gene-bank.js';

const urlSeed = new URLSearchParams(location.search).get('seed');
const simSeed = urlSeed
     ? (parseInt(urlSeed, 10) >>> 0) || 1
     : Math.floor(Math.random() * 1e9);
seed(simSeed);

const worldCanvas = document.getElementById('world-canvas');
const world = new World();
const camera = new Camera(worldCanvas);
const renderer = new Renderer(worldCanvas, camera);
const tracker = new SpeciesTracker();
const phylo = new Phylogeny();

const panel = new Panel(world, renderer, tracker, phylo, camera, {
     onReset: async () => {
          world.reset();
          tracker.clear();
          phylo.build(tracker);
          panel.inspector.close();
          renderer.selectedId = null;
          await clearWorlds();
     },
     onRegenZones: () => world.regenerateZones(),
     onSpawn: (id) => {
          const cell = geneBank.spawn(world, id, camera.x, camera.y);
          if (!cell) {
               return { error: 'Not enough pool energy (need 50% of capacity)' };
          }
          renderer.selectedId = cell.id;
          panel.inspector.openCell(cell);
          const t = document.querySelector('.top-tab[data-tab="species"]');
          if (t) t.click();
          return { ok: true };
     },
});

// Tap vs drag detection (works on desktop and mobile)
let tapStartX = 0;
let tapStartY = 0;
let tapStartTime = 0;
let tapPointerId = null;

worldCanvas.addEventListener('pointerdown', (e) => {
     if (e.button !== 0) return;
     tapPointerId = e.pointerId;
     tapStartX = e.clientX;
     tapStartY = e.clientY;
     tapStartTime = performance.now();
});

worldCanvas.addEventListener('pointerup', (e) => {
     if (e.pointerId !== tapPointerId) return;
     tapPointerId = null;

     const dx = e.clientX - tapStartX;
     const dy = e.clientY - tapStartY;
     const dist2 = dx * dx + dy * dy;
     const elapsed = performance.now() - tapStartTime;

     if (dist2 > 30 * 30 || elapsed > 400) return;

     const cell = renderer.pickCell(world, e.clientX, e.clientY);
     if (cell) {
          renderer.selectedId = cell.id;
          panel.inspector.openCell(cell);
          const t = document.querySelector('.top-tab[data-tab="species"]');
          if (t) t.click();
     } else {
          renderer.selectedId = null;
          panel.inspector.close();
     }
});

// Fit world to screen (only remaining button, no fullscreen)
const fitBtn = document.getElementById('btn-fit-screen');
if (fitBtn) fitBtn.onclick = () => camera.fitToScreen();

// Mobile panel toggle
const panelEl = document.getElementById('panel');
const panelToggle = document.getElementById('panel-toggle');
if (panelToggle) {
     panelToggle.onclick = () => {
          panelEl.classList.toggle('collapsed');
     };
}

// Resize handling (fires when the browser window changes size or rotates)
window.addEventListener('resize', () => {
     renderer._resize();
});

// Initial fit
requestAnimationFrame(() => {
     requestAnimationFrame(() => {
          renderer._resize();
          camera.fitToScreen(true);
     });
});

// HUD
const hudSeed = document.getElementById('hud-seed');
const hudFps = document.getElementById('hud-fps');
const hudZoom = document.getElementById('hud-zoom');
const hudTime = document.getElementById('hud-time');
if (hudSeed) hudSeed.textContent = simSeed.toString(36).toUpperCase().slice(0, 6);

// Auto-load from IndexedDB
(async () => {
     try {
          const saved = await loadLatestWorld();
          if (saved) {
               const restored = await World.fromJSON(saved, Genome, Cell, Zones);
               Object.assign(world, restored);
               tracker.update(world);
               phylo.build(tracker);
               world._initialTotal = world.getTotalEnergy();
               console.log('[db] restored from', new Date(saved.savedAt).toLocaleString());
          }
     } catch (e) {
          console.warn('[db] auto-load failed:', e);
     }
})();

// Auto-save
let lastSaveTime = 0;
async function autoSave() {
     try {
          const data = world.toJSON();
          await saveWorld(data);
     } catch (e) {
          console.warn('[db] autosave failed:', e);
     }
}

const saveBtn = document.getElementById('btn-save-now');
if (saveBtn) {
     saveBtn.onclick = async () => {
          await autoSave();
          saveBtn.textContent = 'Saved';
          setTimeout(() => {
               saveBtn.textContent = 'Save';
          }, 1500);
     };
}

// Main loop
let lastTime = performance.now();
let accumulator = 0;
let fpsCounter = 0;
let fpsAccum = 0;
let fps = 60;
let frameErrors = 0;

function frame(now) {
     try {
          const rawDt = (now - lastTime) / 1000;
          const dt = Math.min(0.1, rawDt);
          lastTime = now;

          fpsCounter++;
          fpsAccum += dt;
          if (fpsAccum >= 0.5) {
               fps = fpsCounter / fpsAccum;
               fpsCounter = 0;
               fpsAccum = 0;
               if (hudFps) hudFps.textContent = fps.toFixed(0);
          }

          if (!panel.paused) {
               const simDt = 1 / (CFG.sim.tickHz || 20);
               accumulator += dt * panel.speed;
               if (accumulator > 2.0) accumulator = 2.0;
               let steps = 0;
               while (accumulator >= simDt && steps < 12) {
                    world.step(simDt);
                    accumulator -= simDt;
                    steps++;
               }
          }

          tracker.update(world);
          phylo.build(tracker);
          camera.update(dt, world);
          renderer.draw(world);
          panel.update(dt);

          if (hudZoom) hudZoom.textContent = Math.round(camera.zoom * 100) + '%';
          if (hudTime) hudTime.textContent = formatTime(world.time);

          if (world.time - lastSaveTime > 30) {
               lastSaveTime = world.time;
               autoSave();
          }
     } catch (err) {
          frameErrors++;
          console.error('[frame] error:', err);
          if (frameErrors > 10) {
               console.error('[frame] too many errors, stopping loop');
               return;
          }
     }
     requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle
window.__EVO__ = {
     world,
     camera,
     renderer,
     tracker,
     phylo,
     panel,
     settings,
     CFG,
};
console.log('[Ahwaz v1.0.0] loaded. Try: __EVO__.world.assertEnergyInvariant()');