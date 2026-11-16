// ============================================================================
// ABYSS INC. — INTERACTIVE REEF RESTORATION MINI-GAMES
// Mini-Game A: Clean the Reef (Interactive Sediment Scrubbing)
// Mini-Game B: Rebuild the Reef (Water-Flow Logic Puzzle + Coral Placement)
// ============================================================================

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

    // Mini-Game B state (3x3 Water-Flow Grid)
    // Directions: 0=Top, 1=Right, 2=Bottom, 3=Left
    // Tile types: 'straight' ([0,2]), 'corner' ([0,1]), 'tee' ([0,1,2])
    this.grid = [];
    this.coralsPlaced = 0;
    this.coralsRequired = 3;
  }

  // --------------------------------------------------------------------------
  // MINI-GAME A: CLEAN THE REEF
  // --------------------------------------------------------------------------
  initCleanReefGame(canvasEl) {
    this.cleanCanvas = canvasEl;
    if (!this.cleanCanvas) return;
    this.cleanCtx = this.cleanCanvas.getContext('2d');

    // Generate 14 sediment & debris blobs covering the coral
    this.sedimentBlobs = [];
    for (let i = 0; i < 14; i++) {
      this.sedimentBlobs.push({
        x: 55 + ((i * 67) % 370),
        y: 55 + ((Math.floor(i / 4) * 58 + (i % 2) * 20) % 175),
        r: 24 + (i % 3) * 6,
        alpha: 1.0
      });
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

    // Touch support
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
    const power = 0.22 * this.game.restorationSupplies.cleaningPower;
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

    // Background water gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0b2d43');
    bg.addColorStop(1, '#071c2b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Draw vibrant coral underneath
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
      // Coral branches
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

    // Small surviving fish
    ctx.fillStyle = '#ffc83d';
    ctx.beginPath();
    ctx.ellipse(340, 72, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw sediment & debris blobs on top
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
  // MINI-GAME B: WATER-FLOW LOGIC PUZZLE + CORAL PLACEMENT
  // --------------------------------------------------------------------------
  initWaterFlowPuzzle() {
    // 3x3 grid where (0,0) has Inlet on Left (3) and (2,2) has Outlet on Right (1).
    // Guaranteed solvable path: (0,0)->(0,1)->(1,1)->(2,1)->(2,2)
    // We scramble initial rotations so the player solves it in 30-60s!
    const layout = [
      // Row 0
      { r: 0, c: 0, type: 'corner', basePorts: [3, 1], rot: 1 }, // straight-ish L->R actually let's use straight [1,3]
      { r: 0, c: 1, type: 'corner', basePorts: [2, 3], rot: 2 },
      { r: 0, c: 2, type: 'corner', basePorts: [1, 2], rot: 0 },
      // Row 1
      { r: 1, c: 0, type: 'straight', basePorts: [0, 2], rot: 1 },
      { r: 1, c: 1, type: 'straight', basePorts: [0, 2], rot: 1 },
      { r: 1, c: 2, type: 'tee', basePorts: [0, 2, 3], rot: 0 },
      // Row 2
      { r: 2, c: 0, type: 'corner', basePorts: [0, 1], rot: 2 },
      { r: 2, c: 1, type: 'corner', basePorts: [0, 1], rot: 3 },
      { r: 2, c: 2, type: 'straight', basePorts: [1, 3], rot: 1 }
    ];
    // Fix (0,0) to straight [1,3] so it connects Left Inlet (3) to Right (1) when rot=0
    layout[0] = { r: 0, c: 0, type: 'straight', basePorts: [1, 3], rot: 1 };

    this.grid = layout;
    this.coralsPlaced = 0;
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
    // BFS from (0,0) requiring port 3 (Left Inlet) to (2,2) requiring port 1 (Right Outlet)
    const start = this.grid[0];
    if (!this.getTilePorts(start).includes(3)) return { connected: false, visited: new Set() };

    const visited = new Set([0]);
    const queue = [0];
    const dirs = [
      { dr: -1, dc: 0, port: 0, opp: 2 }, // Top
      { dr: 0, dc: 1, port: 1, opp: 3 },  // Right
      { dr: 1, dc: 0, port: 2, opp: 0 },  // Bottom
      { dr: 0, dc: -1, port: 3, opp: 1 }  // Left
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
