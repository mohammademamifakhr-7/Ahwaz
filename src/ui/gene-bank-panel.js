import { geneBank } from '../evolution/gene-bank.js';

export class GeneBankPanel {
     constructor(onSpawn) {
          this.onSpawn = onSpawn;
          this.el = document.getElementById('gene-bank-container');
     }

     update() {
          if (!this.el) return;
          const list = geneBank.list();
          if (list.length === 0) {
               this.el.innerHTML = '<div class="empty-state">No genomes saved yet</div>';
               return;
          }
          this.el.innerHTML = '';
          for (const e of list.slice(0, 20)) {
               const d = document.createElement('div');
               d.className = 'gb-entry';
               d.innerHTML = `
        <div class="gb-head">
          <span class="gb-id">${e.speciesId}</span>
          <span class="gb-reason">${e.reason}</span>
        </div>
        <div class="gb-meta">${e.fullName} · gen ${e.generation}</div>
        <div class="gb-actions">
          <button class="btn gb-spawn" data-id="${e.id}">Spawn</button>
          <button class="btn btn-danger gb-del" data-id="${e.id}">Delete</button>
        </div>
      `;
               this.el.appendChild(d);
          }
          this.el.querySelectorAll('.gb-spawn').forEach(b => {
               b.onclick = () => {
                    const r = this.onSpawn(b.dataset.id);
                    if (r && r.error) alert(r.error);
               };
          });
          this.el.querySelectorAll('.gb-del').forEach(b => {
               b.onclick = () => {
                    geneBank.remove(b.dataset.id);
                    this.update();
               };
          });
     }
}