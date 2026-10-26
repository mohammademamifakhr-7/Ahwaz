const ICONS = {
     photo: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>`,
     stomach: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M9 2v4c0 2-3 3-3 6 0 4 3 8 7 8s7-4 7-8c0-3-3-4-3-6V2"/></svg>`,
     hunt: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M14 4l6 6-4 4-2-2-6 6-4-4 6-6-2-2z"/></svg>`,
     eye: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
     chemo: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M4 12c2-4 4-6 8-6s6 2 8 6c-2 4-4 6-8 6s-6-2-8-6z"/><circle cx="12" cy="12" r="2" fill="${c}"/></svg>`,
     flagellum: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M3 12c3-4 6-4 9 0s6 4 9 0"/><circle cx="12" cy="12" r="2" fill="${c}"/></svg>`,
     jet: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M3 12l6-4v3h9v2H9v3z"/></svg>`,
     shield: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M12 2L4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-4z"/></svg>`,
     thorn: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M12 2l3 6-3-2-3 2 3-6zM12 22l-3-6 3 2 3-2-3 6zM2 12l6-3-2 3 2 3-6-3zM22 12l-6 3 2-3-2-3 6 3z"/></svg>`,
     camo: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><path d="M2 2l20 20" stroke-dasharray="3 3"/></svg>`,
     fission: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/><path d="M11 12h2"/></svg>`,
     conjugation: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/><path d="M12 8v8M8 12h8" opacity="0.5"/></svg>`,
     water_adapt: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11z"/></svg>`,
     thermo: c => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M10 4v10a4 4 0 1 0 4 0V4a2 2 0 1 0-4 0z"/></svg>`,
};

const COLORS = {
     photo: '#22c55e',
     stomach: '#f97316',
     hunt: '#ef4444',
     eye: '#a855f7',
     chemo: '#8b5cf6',
     flagellum: '#38bdf8',
     jet: '#0ea5e9',
     shield: '#dc2626',
     thorn: '#b91c1c',
     camo: '#78716c',
     fission: '#ec4899',
     conjugation: '#f43f5e',
     water_adapt: '#06b6d4',
     thermo: '#facc15',
};

export function getIcon(traitKey) {
     const c = COLORS[traitKey] || '#8b98a8';
     const fn = ICONS[traitKey];
     return fn ? fn(c) : '';
}

export function getIconColor(traitKey) {
     return COLORS[traitKey] || '#8b98a8';
}