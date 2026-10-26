const GENERA = [
     'Bacillus', 'Coccus', 'Spirillum', 'Vibrio', 'Cyanobacter', 'Proteo',
     'Actino', 'Chlamy', 'Myxo', 'Deino', 'Thermo', 'Halo', 'Methano',
     'Nitro', 'Rhizo', 'Azoto', 'Pseudomonas', 'Lacto', 'Strepto', 'Staphylo',
];
const EPITHETS = [
     'primus', 'minor', 'major', 'rapida', 'lenta', 'aurea', 'viridis',
     'rubra', 'alba', 'caerulea', 'vulgaris', 'communis', 'simplex',
     'complexa', 'magna', 'parva', 'nova', 'antiqua', 'vivax', 'fugax',
];

function fnv1a(str) {
     let h = 2166136261;
     for (let i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h = Math.imul(h, 16777619);
     }
     return h >>> 0;
}

export function cellName(cell, speciesId) {
     if (!cell) return '?';
     const shortId = (cell.id & 0xFFFFF).toString(36).toUpperCase().padStart(3, '0');
     const sid = speciesId || 'X-000';
     return `${sid}.${shortId}`;
}

export function speciesLongName(genome, speciesId) {
     const sid = speciesId || 'X-000';
     const h = fnv1a(sid);
     const genus = GENERA[h % GENERA.length];
     const epithet = EPITHETS[(h >>> 8) % EPITHETS.length];
     return `${genus} ${epithet}`;
}