# Ahwaz

> An open-ended neuro-evolution sandbox. No scripts. Only energy, mutation
> and natural selection.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-Proprietary-red)
![Language](https://img.shields.io/badge/language-JavaScript-yellow)
![Platform](https://img.shields.io/badge/platform-Web-lightgrey)

**Live demo:** https://mohammademamifakhr-7.github.io/Ahwaz/

_Ahwaz_ is a browser-based artificial-life simulator. It begins with a hundred
identical digital bacteria, each carrying nothing but a small neural network
and two slots for biological traits. There is no food scripted into the world,
no "prey" and no "predator" — those are words an observer invents _after_ they
appear. Everything emerges from a closed energy economy, mutation, and the
simple fact that the cells which survive are the ones that reproduce.

---

## Table of contents

- [What makes it different](#what-makes-it-different)
- [Features](#features)
- [Running locally](#running-locally)
- [Controls](#controls)
- [The brain](#the-brain)
- [Traits](#traits)
- [Energy economy](#energy-economy)
- [Architecture](#architecture)
- [Persistence](#persistence)
- [Versioning](#versioning)
- [Roadmap](#roadmap)
- [Inspirations](#inspirations)
- [License](#license)
- [Author](#author)

---

## What makes it different

Most evolution simulators hand you a world with pre-defined roles — plants
here, herbivores there, predators in the corner — and ask the neural networks
to learn behaviours inside that box. Ahwaz starts from the opposite end:

1. **No behaviour is programmed.** There is no "go to food" or "flee from
   threat" routine anywhere in the codebase. Every decision a cell makes is a
   raw output of its own neural network.
2. **Energy is the only currency.** No HP, no separate life, no hidden buffs.
   A cell with zero energy is dead — the code enforces this literally.
3. **The total energy of the world never changes.** Photosynthesis draws from
   a central pool. Metabolism returns to it. Death converts to a corpse.
   Corpse decay returns it to the pool. Reproduction transfers it between
   parent and child. Nothing is created or destroyed.

A "plant" is a cell that happened to mutate a photosynthesis slot. A "hunter"
is a cell whose network learned to press the aggression output near a smaller
neighbour. Those are outcomes, not assignments.

---

## Features

- **Autonomous cells** — each has a 24 → 20 → 6 feed-forward neural network
  with two recurrent memory channels.
- **Closed energy economy** — `pool + cells + corpses` is a conserved
  quantity. You can verify it live in the console.
- **Fourteen biological traits** in six categories: feeding, sensing,
  movement, defense, reproduction, environmental adaptation.
- **Binary fission** — reproduction splits a cell into two; the parent
  _becomes_ one child and a new cell is born next to it. No corpse is left
  behind.
- **Live brain viewer** — a labelled diagram of the selected cell's network,
  with real-time activations and signal flow.
- **Phylogenetic tree** — every species is tracked, coloured by genomic
  similarity, and inspectable with a click.
- **Persistent world** — auto-saves to IndexedDB every 30 seconds; reloads on
  open.
- **Density pressure** — a soft population cap keeps the world from blowing up
  without manually killing cells.
- **Biofilm bonus** — photosynthesizers gain extra energy from neighbours,
  which makes cooperation (and clustering) an emergent advantage.

---

## Running locally

Ahwaz is a static site. No bundler, no dependencies, no build step.

```bash
# any static file server works
python3 -m http.server 8080
# or
npx http-server . -p 8080
# or use the VS Code "Live Server" extension
```

Then open <http://localhost:8080>.

Requires a modern browser (Chrome, Edge, Firefox, Safari 16+).

---

## Controls

| Action              | How                                      |
| ------------------- | ---------------------------------------- |
| Inspect a cell      | Click or tap any cell in the world       |
| Pan the camera      | Drag with one finger or the left mouse   |
| Zoom                | Mouse wheel, or pinch with two fingers   |
| Pause / Resume      | Play button in the Settings tab          |
| Change speed        | 1× / 2× / 4× / 8× buttons                |
| Reset the world     | Settings tab → Reset World               |
| Regenerate zones    | Settings tab → Zones → Regenerate Zones  |
| Reset all sliders   | Settings tab → Reset Settings            |
| Save now            | Save button (also auto-saves every 30 s) |
| Fullscreen          | ⛶ button, top-right of the world         |
| Fit world to screen | expand button, next to fullscreen        |

---

## The brain

A small fixed-topology network, small enough to read on screen but big
enough to drive real decisions.

```text
24 inputs  →  20 hidden (tanh)  →  6 outputs
```

### Inputs (all egocentric — relative to the cell's own heading)

| #     | Input                  | Meaning                         |
| ----- | ---------------------- | ------------------------------- |
| 0     | energy                 | own energy / capacity           |
| 1     | hunger                 | 1 − energy fraction             |
| 2     | light                  | current light multiplier        |
| 3     | zone                   | −1 slow, 0 neutral, +1 water    |
| 4     | wall                   | proximity of the nearest wall   |
| 5–7   | corpse sig / sin / cos | nearest corpse                  |
| 8–10  | cell sig / sin / cos   | nearest other cell              |
| 11    | size ratio             | (my body − their body) / 5      |
| 12–13 | rel. velocity          | their velocity in my frame      |
| 14    | genetic similarity     | weight-space cosine             |
| 15–16 | kin / stranger         | my social genes toward them     |
| 17    | has photo              | 0 or 1                          |
| 18    | has stomach            | 0 or 1                          |
| 19    | has hunt               | 0 or 1                          |
| 20    | age                    | normalized                      |
| 21    | offspring              | normalized                      |
| 22–23 | memory                 | previous tick's outputs 4 and 5 |

### Outputs

| #   | Output     | Meaning                                |
| --- | ---------- | -------------------------------------- |
| 0   | turn       | −1 .. +1 (applied at 2.5 rad/s)        |
| 1   | throttle   | 0 .. 1 (scaled by base speed)          |
| 2   | aggression | negative = flee, positive = attack     |
| 3   | share      | negative = reject, positive = share    |
| 4–5 | memory     | fed back as inputs 22 and 23 next tick |

Mutation is Gaussian noise on every weight, plus a rare full rewire
(probability per weight, exposed in the sliders). There is no crossover in
asexual reproduction — children are mutated copies of a single parent.
Sexual reproduction (conjugation) uses uniform crossover.

---

## Traits

Fourteen traits, all with concrete effects. Traits that do nothing were
removed; if a trait costs energy, it must change behaviour.

| Category     | Trait          | Effect                                           |
| ------------ | -------------- | ------------------------------------------------ |
| Feeding      | Photosynthesis | extracts energy from the pool × light multiplier |
| Feeding      | Stomach        | auto-eats corpses on contact                     |
| Feeding      | Hunt           | drains energy from smaller cells on contact      |
| Sensing      | Eye            | vision radius 150 → 250                          |
| Sensing      | Chemotaxis     | senses corpses up to 400 px                      |
| Movement     | Flagellum      | base speed + 50 %                                |
| Movement     | Jet            | burst ×2 speed at ×3 metabolic cost              |
| Defense      | Shield         | −70 % damage taken (directional)                 |
| Defense      | Thorn          | attacker loses 30 % of its energy                |
| Defense      | Camouflage     | detection radius −40 %                           |
| Reproduction | Fission        | binary fission, 1 cell → 2 cells                 |
| Reproduction | Conjugation    | sexual reproduction (needs a partner)            |
| Environment  | Water Adapt    | −30 % cost in water zones                        |
| Environment  | Thermophile    | +30 % speed inside the light zone                |

Every trait is paid for in energy the moment it is acquired. A cell must
accumulate enough energy to afford a mutation before evolution can install
it — that is what makes trait acquisition meaningful instead of a lottery.

---

## Energy economy

The invariant the whole simulation depends on:

```text
energyPool + Σ(cells.energy) + Σ(corpses.energy)  =  constant
```

Everything that moves energy does so across that boundary:

- **Photosynthesis** takes from the pool (bounded by what is actually there).
- **Metabolism** sends the spent amount back to the pool.
- **Death** converts leftover energy into a corpse.
- **Corpse decay** returns to the pool.
- **Fission** transfers 45 % to each child, 10 % to the pool.
- **Conjugation** transfers roughly a third of each parent's energy to the
  child.
- **Density pressure** can kill a cell; that cell's leftover energy is split
  between a corpse and the pool.

You can verify this at any moment from the console:

```js
__EVO__.world.assertEnergyInvariant(); // → true
__EVO__.world.getEnergyBreakdown(); // → { total, pool, cells, corpses, … }
```

The Energy Budget panel in the UI shows the same numbers live.

---

## Architecture

```text
ahwaz/
├── index.html
├── style.css
├── README.md
├── CHANGELOG.md
├── LICENSE
├── package.json
├── .gitignore
└── src/
    ├── main.js                 bootstrap and main loop
    ├── core/
    │   ├── config.js           settings, CFG, traits, sliders
    │   ├── rng.js              seeded PRNG (Mulberry32)
    │   ├── utils.js            safe math + time formatting
    │   ├── names.js            unique cell / species names
    │   └── db.js               IndexedDB persistence
    ├── biology/
    │   ├── brain.js            24 → 20 → 6 network
    │   ├── genome.js           brain + slots + social genes + body size
    │   └── cell.js             sense → think → act → reproduce
    ├── world/
    │   ├── world.js            tick loop, energy pool, corpses, density
    │   ├── zones.js            water / slow / light zones
    │   └── camera.js           pan, zoom, fit-to-screen
    ├── evolution/
    │   ├── naming.js           projection → species ID + hue
    │   ├── species.js          species tracking
    │   ├── phylogeny.js        tree layout + hit testing
    │   └── gene-bank.js        saved genomes in localStorage
    ├── render/
    │   ├── renderer.js         canvas rendering
    │   ├── brain-view.js       neural network diagram
    │   ├── tree-view.js        phylogenetic tree
    │   └── chart.js            population / energy chart
    └── ui/
        ├── panel.js            wiring of tabs, sliders, buttons
        ├── stats.js            live stats and energy breakdown
        ├── inspector.js        cell and species inspector
        ├── gene-bank-panel.js  gene bank list
        └── icons.js            inline SVG trait icons
```

**Layering rule:** `ui` and `render` may import from `evolution`, `world`,
`biology`, `core`. `biology` and `world` may import from `core` only.
The simulation never imports from the UI.

---

## Persistence

- **Settings and gene bank** live in `localStorage` (small, fast).
- **World snapshots** live in `IndexedDB` under the `evogenesis` database.
  The five most recent autosaves are kept; older ones are pruned.
- A snapshot contains: simulation time, every cell (position, energy, age,
  full neural network weights, all slots, its life-history events), every
  corpse, every zone, and the last 100 chart samples.

To wipe everything and start fresh, open DevTools and run:

```js
indexedDB.deleteDatabase("evogenesis");
localStorage.clear();
```

---

## Versioning

Ahwaz follows [Semantic Versioning](https://semver.org/):

- **MAJOR** — incompatible world format, breaking change to the neural network
  topology, or a change that invalidates saved snapshots.
- **MINOR** — new traits, new brain inputs/outputs, new UI panels, new
  persistence layer.
- **PATCH** — bug fixes, balance tweaks, small UI polish.

The current version is **v1.0.0**. See `CHANGELOG.md` for the full history
and the _Roadmap_ section below for what's coming.

---

## Roadmap

### v1.1.0 — Stability & clarity

- Fix edge cases in fission energy accounting
- Improve long-run population stability past 30 minutes
- Add hover tooltips to brain-view inputs and outputs
- Save / load selected cell state

### v1.2.0 — Brain optimization

- Reduce hidden layer to 16 neurons (faster evolution, cleaner behavior)
- Optional third memory channel
- Per-layer mutation weighting

### v1.3.0 — Observation tools

- Timeline scrubber (replay the last N minutes)
- Lineage colour overlay in the world (not just in the tree)
- Export a species' genome as JSON

### v2.0.0 — New foundations

- Configurable brain topology (inputs / hidden / outputs)
- Multi-species ecosystems with explicit speciation pressure
- Optional worker-based headless training

---

## Inspirations

Ahwaz is not a fork and contains no third-party code. Its design borrows
ideas from a small set of well-known projects, each for one specific reason:

- **biosim4** (David Miller) — the philosophical frame: an evolution simulator
  with no fitness function, no roles, and no food script.
- **EcoSim** by _mahan-bst_ — the idea of egocentric inputs, relative-velocity
  sensors, and short-term memory as a first-class part of the network.
- **The Bibites** (Léo Caussan) — UI design for observability: brain viewers,
  lineage colours, population charts.
- **Flow-Lenia** — the discipline of strict mass / energy conservation in an
  artificial-life simulation.

---

## License

**Proprietary — All rights reserved.**

Copyright © 2026 Mohammad Emami Fakhr.

This repository is made publicly viewable **for demonstration and evaluation
purposes only**. No license is granted for reuse, modification, distribution,
or commercial use of any part of the source code, documentation, or assets.
See [`LICENSE`](LICENSE) for the full terms.

If you would like to use Ahwaz in your own project, please contact the author.

---

## Author

**Mohammad Emami Fakhr**

- GitHub: [@mohammademamifakhr-7](https://github.com/mohammademamifakhr-7)
- Live demo: [mohammademamifakhr-7.github.io/Ahwaz](https://mohammademamifakhr-7.github.io/Ahwaz/)

Version 1.0.0 — 2026.
