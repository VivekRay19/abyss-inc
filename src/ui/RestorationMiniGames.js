// ============================================================================
// ABYSS INC. — INTERACTIVE REEF RESTORATION MINI-GAMES & PUZZLE VARIATIONS
// Features 4 shuffled solvable puzzle variations & 4 distinct coral outcomes
// ============================================================================

export const PUZZLE_VARIATIONS = [
  {
    id: 'northern_conduit',
    title: 'Variation 1 — Northern Ridge Conduit',
    instruction:
      'Rotate the reef channels to connect Fresh Current Inlet (top-left) to Coral Nursery Outlet (bottom-right) via the central column.',
    clueShort: 'Clue: Connect Top-Left horizontally into the center column.',
    clueFull: 'Route: Top-Left (0,0) → Top-Center (0,1) → Center (1,1) → Bottom-Center (2,1) → Bottom-Right (2,2).',
    solutionIndices: [0, 1, 4, 7, 8],
    outcome: {
      id: 'outcome_staghorn',
      name: 'Crimson Staghorn & Golden Antler Thicket',
      regionName: 'Northern Ridge Sanctuary',
      shapeStyle: 'staghorn',
      primaryColor: 0xff5e7e,
      secondaryColor: 0xffc83d,
      fragments: [
        '🪸 Crimson Staghorn Branch',
        '🪸 Golden Antler Crown',
        '🪸 Rose Pillar Cluster'
      ]
    },
    buildGrid: () => [
      { r: 0, c: 0, type: 'straight', basePorts: [1, 3], rot: 1 },
      { r: 0, c: 1, type: 'corner', basePorts: [2, 3], rot: 2 },
      { r: 0, c: 2, type: 'corner', basePorts: [1, 2], rot: 1 },
      { r: 1, c: 0, type: 'straight', basePorts: [0, 2], rot: 1 },
      { r: 1, c: 1, type: 'straight', basePorts: [0, 2], rot: 1 },
      { r: 1, c: 2, type: 'tee', basePorts: [0, 2, 3], rot: 2 },
      { r: 2, c: 0, type: 'corner', basePorts: [0, 1], rot: 2 },
      { r: 2, c: 1, type: 'corner', basePorts: [0, 1], rot: 3 },
      { r: 2, c: 2, type: 'straight', basePorts: [1, 3], rot: 1 }
    ]
  },
  {
    id: 'trench_siphon',
    title: 'Variation 2 — Deep Trench Thermal Siphon',
    instruction:
      'Route the warm mineral current down the left trench wall and across the lower seabed floor to the nursery.',
    clueShort: 'Clue: Turn the Top-Left channel downward into the left column.',
    clueFull: 'Route: Top-Left (0,0) → Mid-Left (1,0) → Bottom-Left (2,0) → Bottom-Center (2,1) → Bottom-Right (2,2).',
    solutionIndices: [0, 3, 6, 7, 8],
    outcome: {
      id: 'outcome_seafan',
      name: 'Bioluminescent Azure & Violet Sea Fans',
      regionName: 'Western Trench Alcove',
      shapeStyle: 'seafan',
      primaryColor: 0x18c8da,
      secondaryColor: 0xb978ff,
      fragments: [
        '🪸 Azure Gorgonian Sea Fan',
        '🪸 Violet Lace Frond',
        '🪸 Luminous Pearl Polyp'
      ]
    },
    buildGrid: () => [
      { r: 0, c: 0, type: 'corner', basePorts: [2, 3], rot: 1 },
      { r: 0, c: 1, type: 'straight', basePorts: [1, 3], rot: 1 },
      { r: 0, c: 2, type: 'corner', basePorts: [2, 3], rot: 0 },
      { r: 1, c: 0, type: 'straight', basePorts: [0, 2], rot: 1 },
      { r: 1, c: 1, type: 'corner', basePorts: [0, 1], rot: 2 },
      { r: 1, c: 2, type: 'straight', basePorts: [0, 2], rot: 0 },
      { r: 2, c: 0, type: 'corner', basePorts: [0, 1], rot: 3 },
      { r: 2, c: 1, type: 'straight', basePorts: [1, 3], rot: 1 },
      { r: 2, c: 2, type: 'straight', basePorts: [1, 3], rot: 1 }
    ]
  },
  {
    id: 'atoll_perimeter',
    title: 'Variation 3 — Outer Atoll Shelf Circulation',
    instruction:
      'Channel oxygenated surface water across the entire top reef ledge and down the eastern cliff wall.',
    clueShort: 'Clue: Run the current straight across all three top-row tiles first.',
    clueFull: 'Route: Top-Left (0,0) → Top-Center (0,1) → Top-Right (0,2) → Mid-Right (1,2) → Bottom-Right (2,2).',
    solutionIndices: [0, 1, 2, 5, 8],
    outcome: {
      id: 'outcome_brain_pipes',
      name: 'Emerald Brain Dome & Organ-Pipe Sanctuary',
      regionName: 'Eastern Atoll Terrace',
      shapeStyle: 'brain_pipes',
      primaryColor: 0x55d99a,
      secondaryColor: 0x39d9c4,
      fragments: [
        '🪸 Emerald Brain Coral Dome',
        '🪸 Turquoise Organ-Pipe Cluster',
        '🪸 Jade Fluted Reef Tube'
      ]
    },
    buildGrid: () => [
      { r: 0, c: 0, type: 'straight', basePorts: [1, 3], rot: 1 },
      { r: 0, c: 1, type: 'straight', basePorts: [1, 3], rot: 1 },
      { r: 0, c: 2, type: 'corner', basePorts: [2, 3], rot: 2 },
      { r: 1, c: 0, type: 'corner', basePorts: [0, 1], rot: 1 },
      { r: 1, c: 1, type: 'tee', basePorts: [0, 1, 2], rot: 1 },
      { r: 1, c: 2, type: 'straight', basePorts: [0, 2], rot: 1 },
      { r: 2, c: 0, type: 'straight', basePorts: [1, 3], rot: 0 },
      { r: 2, c: 1, type: 'corner', basePorts: [0, 3], rot: 2 },
      { r: 2, c: 2, type: 'corner', basePorts: [0, 1], rot: 3 }
    ]
  },
  {
    id: 'zigzag_cascade',
    title: 'Variation 4 — Cascading Terrace Channels',
    instruction:
      'Weave the nutrient stream through the stepped middle terrace to feed the deep coral nursery.',
    clueShort: 'Clue: Drop from Top-Left to Mid-Left, then cross the middle row.',
    clueFull: 'Route: Top-Left (0,0) → Mid-Left (1,0) → Center (1,1) → Mid-Right (1,2) → Bottom-Right (2,2).',
    solutionIndices: [0, 3, 4, 5, 8],
    outcome: {
      id: 'outcome_table_sunburst',
      name: 'Sunburst Table-Coral & Lavender Rosette Reef',
      regionName: 'Central Stepped Terrace',
      shapeStyle: 'table_sunburst',
      primaryColor: 0xff9b45,
      secondaryColor: 0xd48cff,
      fragments: [
        '🪸 Sunburst Table-Coral Shelf',
        '🪸 Amber Rosette Plate',
        '🪸 Lavender Canopy Disk'
      ]
    },
    buildGrid: () => [
      { r: 0, c: 0, type: 'corner', basePorts: [2, 3], rot: 3 },
      { r: 0, c: 1, type: 'corner', basePorts: [1, 2], rot: 1 },
      { r: 0, c: 2, type: 'straight', basePorts: [1, 3], rot: 0 },
      { r: 1, c: 0, type: 'corner', basePorts: [0, 1], rot: 2 },
      { r: 1, c: 1, type: 'straight', basePorts: [1, 3], rot: 1 },
      { r: 1, c: 2, type: 'corner', basePorts: [2, 3], rot: 1 },
      { r: 2, c: 0, type: 'corner', basePorts: [0, 1], rot: 1 },
      { r: 2, c: 1, type: 'straight', basePorts: [1, 3], rot: 0 },
      { r: 2, c: 2, type: 'corner', basePorts: [0, 1], rot: 2 }
    ]
  }
];

export class RestorationMiniGames {
  constructor(game, sound, onProgressUpdate) {
    this.game = game;
    this.sound = sound;
    this.onProgressUpdate = onProgressUpdate;

    // Mini-Game A state
    this.cleanCanvas = null;
    this.cleanCtx = null;
    this.sedimentBlobs = [];
    this.isScrubbing = false;
    this.cleaningInitialized = false;

    // Shuffled non-repeating deck of puzzle variations
    this.variationOrder = [0, 1, 2, 3];
    this.shuffleDeck();
    this.deckCursor = 0;
    this.currentVariation = null;
    this.grid = [];
    this.coralsPlaced = 0;
    this.coralsRequired = 3;
    this.plantedSlots = new Set();
  }

  shuffleDeck() {
    for (let i = this.variationOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.variationOrder[i];
      this.variationOrder[i] = this.variationOrder[j];
      this.variationOrder[j] = tmp;
    }
  }

  // --------------------------------------------------------------------------
  // MINI-GAME A: CLEAN THE REEF (PRESERVES PROGRESS ON BACK NAVIGATION)
  // --------------------------------------------------------------------------
  initCleanReefGame(canvasEl, forceReset = false) {
    this.cleanCanvas = canvasEl;
    if (!this.cleanCanvas) return;
    this.cleanCtx = this.cleanCanvas.getContext('2d');

    if (!this.cleaningInitialized || forceReset) {
      this.cleaningInitialized = true;
      this.sedimentBlobs = [];
      for (let i = 0; i < 14; i++) {
        this.sedimentBlobs.push({
          x: 55 + ((i * 67) % 370),
          y: 55 + ((Math.floor(i / 4) * 58 + (i % 2) * 20) % 175),
          r: 24 + (i % 3) * 6,
          alpha: 1.0
        });
      }
    }

    const handleScrub = (clientX, clientY) => {
      if (!this.isScrubbing || !this.cleanCanvas) return;
      const rect = this.cleanCanvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * this.cleanCanvas.width;
      const y = ((clientY - rect.top) / rect.height) * this.cleanCanvas.height;
      this.scrubAt(x, y);
    };

    this.cleanCanvas.onmousedown = (e) => {
      this.isScrubbing = true;
      handleScrub(e.clientX, e.clientY);
    };
    window.addEventListener('mouseup', () => {
      this.isScrubbing = false;
    });
    this.cleanCanvas.onmousemove = (e) => handleScrub(e.clientX, e.clientY);

    this.cleanCanvas.ontouchstart = (e) => {
      this.isScrubbing = true;
      if (e.touches[0]) handleScrub(e.touches[0].clientX, e.touches[0].clientY);
    };
    this.cleanCanvas.ontouchmove = (e) => {
      e.preventDefault();
      if (e.touches[0]) handleScrub(e.touches[0].clientX, e.touches[0].clientY);
    };
    this.cleanCanvas.ontouchend = () => {
      this.isScrubbing = false;
    };

    this.renderCleanReefCanvas();
  }

  scrubAt(x, y) {
    const power = 0.24 * this.game.restorationSupplies.cleaningPower;
    let changed = false;

    for (const b of this.sedimentBlobs) {
      if (b.alpha > 0.02 && Math.hypot(b.x - x, b.y - y) < b.r + 22) {
        b.alpha = Math.max(0, b.alpha - power);
        changed = true;
      }
    }

    if (changed) {
      const remaining = this.sedimentBlobs.reduce((s, b) => s + b.alpha, 0);
      const total = this.sedimentBlobs.length;
      const pct = Math.min(100, Math.round(((total - remaining) / total) * 100));
      const delta = Math.max(0, pct - this.game.reefCleanProgress);
      if (delta > 0) {
        this.game.reefCleanProgress = pct;
        this.game.oceanEnv.restoreSectorAt(0, 2, delta * 0.35, delta * 0.55);
        this.game.ecosystem.updateCoralRecoveryVisuals(pct / 100);
        if (Math.random() < 0.25) this.sound.playNoduleCollect();
      }
      this.renderCleanReefCanvas();
      if (this.onProgressUpdate) this.onProgressUpdate('clean', this.game.reefCleanProgress);
    }
  }

  renderCleanReefCanvas() {
    const ctx = this.cleanCtx;
    if (!ctx) return;
    const w = this.cleanCanvas.width;
    const h = this.cleanCanvas.height;

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0b2d43');
    bg.addColorStop(1, '#071c2b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const corals = [
      { x: 90, y: 185, r: 42, color: '#ff6b9d' },
      { x: 180, y: 170, r: 52, color: '#18c8da' },
      { x: 280, y: 185, r: 46, color: '#55d99a' },
      { x: 375, y: 175, r: 44, color: '#ff9b45' }
    ];
    for (const c of corals) {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      for (let b = -1; b <= 1; b++) {
        ctx.beginPath();
        ctx.moveTo(c.x + b * 14, c.y - c.r * 0.4);
        ctx.lineTo(c.x + b * 24, c.y - c.r - 28);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#ffc83d';
    ctx.beginPath();
    ctx.ellipse(340, 72, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const b of this.sedimentBlobs) {
      if (b.alpha <= 0.02) continue;
      ctx.save();
      ctx.globalAlpha = b.alpha;
      ctx.fillStyle = '#3b372e';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#171c20';
      ctx.fillRect(b.x - 6, b.y - 4, 12, 7);
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // MINI-GAME B: SHUFFLED PUZZLE VARIATIONS & VARIED CORAL OUTCOMES
  // --------------------------------------------------------------------------
  initWaterFlowPuzzle(forceNewVariation = false) {
    if (!this.currentVariation || forceNewVariation) {
      const varIdx = this.variationOrder[this.deckCursor % this.variationOrder.length];
      this.deckCursor++;
      if (this.deckCursor % this.variationOrder.length === 0) {
        // Reshuffle for future cycles while avoiding immediate repeat
        const lastIdx = varIdx;
        this.shuffleDeck();
        if (this.variationOrder[0] === lastIdx) {
          const swap = this.variationOrder[1];
          this.variationOrder[1] = this.variationOrder[0];
          this.variationOrder[0] = swap;
        }
      }
      this.currentVariation = PUZZLE_VARIATIONS[varIdx];
      this.grid = this.currentVariation.buildGrid();
      this.coralsPlaced = 0;
      this.plantedSlots.clear();
    }
    return this.currentVariation;
  }

  advanceToNextRestorationCycle() {
    this.cleaningInitialized = false;
    this.game.reefCleanProgress = 0;
    return this.initWaterFlowPuzzle(true);
  }

  getTilePorts(tile) {
    return tile.basePorts.map((p) => (p + tile.rot) % 4);
  }

  rotateTile(index) {
    if (!this.grid[index]) return false;
    this.grid[index].rot = (this.grid[index].rot + 1) % 4;
    this.sound.playSonarPing(660);
    return this.isWaterPathConnected();
  }

  isWaterPathConnected() {
    const start = this.grid[0];
    if (!start || !this.getTilePorts(start).includes(3)) {
      return { connected: false, visited: new Set() };
    }

    const visited = new Set([0]);
    const queue = [0];
    const dirs = [
      { dr: -1, dc: 0, port: 0, opp: 2 },
      { dr: 0, dc: 1, port: 1, opp: 3 },
      { dr: 1, dc: 0, port: 2, opp: 0 },
      { dr: 0, dc: -1, port: 3, opp: 1 }
    ];

    while (queue.length > 0) {
      const idx = queue.shift();
      const tile = this.grid[idx];
      const ports = this.getTilePorts(tile);

      for (const d of dirs) {
        if (!ports.includes(d.port)) continue;
        const nr = tile.r + d.dr;
        const nc = tile.c + d.dc;
        if (nr < 0 || nr >= 3 || nc < 0 || nc >= 3) continue;
        const nIdx = nr * 3 + nc;
        if (visited.has(nIdx)) continue;
        const nPorts = this.getTilePorts(this.grid[nIdx]);
        if (nPorts.includes(d.opp)) {
          visited.add(nIdx);
          queue.push(nIdx);
        }
      }
    }

    const end = this.grid[8];
    const connected = visited.has(8) && this.getTilePorts(end).includes(1);
    return { connected, visited };
  }
}
