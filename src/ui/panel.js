import { settings, CFG, SETTINGS_DEF } from '../core/config.js';
import { Stats } from './stats.js';
import { Inspector } from './inspector.js';
import { GeneBankPanel } from './gene-bank-panel.js';
import { Chart } from '../render/chart.js';
import { TreeView } from '../render/tree-view.js';

export class Panel {
     constructor(world, renderer, tracker, phylo, camera, callbacks) {
          this.world = world;
          this.renderer = renderer;
          this.tracker = tracker;
          this.phylo = phylo;
          this.camera = camera;
          this.callbacks = callbacks;

          this.paused = false;
          this.speed = 1;

          this.stats = new Stats(world, tracker);
          this.inspector = new Inspector(world, tracker);
          this.geneBankPanel = new GeneBankPanel(callbacks.onSpawn);

          const chartCanvas = document.getElementById('chart-canvas');
          this.chart = chartCanvas ? new Chart(chartCanvas) : null;

          const treeCanvas = document.getElementById('tree-canvas');
          this.treeView = treeCanvas ? new TreeView(treeCanvas, phylo) : null;

          this._buildSliders();
          this._bindControls();
          this._bindTabs();
          this._bindTree();
          this._syncPlayButton();
     }

     _syncPlayButton() {
          const btn = document.getElementById('btn-play');
          if (!btn) return;
          btn.textContent = this.paused ? '▶ Resume' : '⏸ Pause';
     }

     _buildSliders() {
          for (const [groupKey, group] of Object.entries(SETTINGS_DEF)) {
               const container = document.querySelector(`[data-group="${groupKey}"]`);
               if (!container) continue;
               container.innerHTML = '';
               for (const item of group.items) {
                    const row = document.createElement('div');
                    row.className = 'slider-row';
                    const val = settings.get(item.key);
                    row.innerHTML = `
          <div class="slider-header">
            <span>${item.label}</span>
            <span class="slider-value" data-v>${item.fmt(val)}</span>
          </div>
          <input type="range" class="slider-input" data-k="${item.key}"
                 min="${item.min}" max="${item.max}" step="${item.step}" value="${val}">
        `;
                    container.appendChild(row);
                    const input = row.querySelector('input');
                    const label = row.querySelector('[data-v]');
                    input.addEventListener('input', () => {
                         const v = parseFloat(input.value);
                         settings.set(item.key, v);
                         label.textContent = item.fmt(v);
                    });
               }
          }
     }

     _bindControls() {
          const playBtn = document.getElementById('btn-play');
          if (playBtn) playBtn.onclick = () => {
               this.paused = !this.paused;
               this._syncPlayButton();
          };

          const resetBtn = document.getElementById('btn-reset-world');
          if (resetBtn) resetBtn.onclick = () => {
               if (confirm('Reset world? Zones & settings will be preserved.')) {
                    this.callbacks.onReset?.();
               }
          };

          const regenZonesBtn = document.getElementById('btn-regen-zones');
          if (regenZonesBtn) regenZonesBtn.onclick = () => this.callbacks.onRegenZones?.();

          const resetSettingsBtn = document.getElementById('btn-reset-settings');
          if (resetSettingsBtn) resetSettingsBtn.onclick = () => {
               if (confirm('Reset all settings to defaults?')) {
                    settings.reset();
                    location.reload();
               }
          };

          for (const s of [1, 2, 4, 8]) {
               const btn = document.getElementById(`btn-speed-${s}`);
               if (btn) btn.onclick = () => {
                    this.speed = s;
                    document.querySelectorAll('[id^="btn-speed-"]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
               };
          }
     }

     _bindTabs() {
          document.querySelectorAll('.top-tab').forEach(btn => {
               btn.onclick = () => {
                    const t = btn.dataset.tab;
                    document.querySelectorAll('.top-tab').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('[data-tab-content]').forEach(x => x.classList.remove('active'));
                    btn.classList.add('active');
                    document.querySelector(`[data-tab-content="${t}"]`)?.classList.add('active');
               };
          });

          document.querySelectorAll('.sub-tab').forEach(btn => {
               btn.onclick = () => {
                    const t = btn.dataset.subtab;
                    const parent = btn.closest('[data-tab-content]');
                    if (!parent) return;
                    parent.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
                    parent.querySelectorAll('[data-subtab-content]').forEach(x => x.classList.remove('active'));
                    btn.classList.add('active');
                    parent.querySelector(`[data-subtab-content="${t}"]`)?.classList.add('active');
               };
          });
     }

     _bindTree() {
          if (!this.treeView) return;
          this.treeView.canvas.addEventListener('click', (e) => {
               const id = this.treeView.pick(e.clientX, e.clientY);
               if (id) this.inspector.openSpecies(id);
          });
     }

     update(dt) {
          this.stats.update();
          if (this.chart) this.chart.draw(this.world.history);
          if (this.treeView) this.treeView.draw(this.inspector.speciesId);
          this.inspector.update();
          this.geneBankPanel.update();
     }
}