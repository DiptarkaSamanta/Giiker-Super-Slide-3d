/**
 * GiiKER Super Slide - Custom Studio Module
 * Full custom board dimensions, flexible exit targets (presets & click-to-place),
 * interactive Polyomino Shape Forge (L-shape, M-shape, T-shape, Z-shape, Plus, U-shape & custom drawing),
 * dynamic cell scaling to prevent overflow, and real-time AI BFS solvability validator.
 */

class CustomStudio {
  constructor(gameApp) {
    this.gameApp = gameApp;
    this.modal = null;
    this.gridContainer = null;
    
    // Custom board settings
    this.cols = 4;
    this.rows = 5;
    this.exit = { x: 1, y: 3 }; // Top-left of goal exit
    this.settingExitMode = false;
    this.pieces = [];
    
    // Current piece being placed from palette / forge
    this.selectedPalettePiece = {
      type: 'goal',
      w: 2,
      h: 2,
      cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }],
      color: '#ef233c',
      isGoal: true,
      isObstacle: false,
      name: 'Goal (2×2)'
    };

    // 4x4 Polyomino Matrix Forge State
    this.forgeMatrix = Array.from({ length: 4 }, () => Array(4).fill(false));
    // Default forge preset: L-Shape 3 cells
    this.forgeMatrix[0][0] = true;
    this.forgeMatrix[1][0] = true;
    this.forgeMatrix[1][1] = true;

    this.forgeColor = '#ffb703';
    this.forgeIsGoal = false;
    this.forgeIsObstacle = false;

    // Presets
    this.presets = [
      {
        name: 'Classic GiiKER (4×5 Standard)',
        cols: 4,
        rows: 5,
        exit: { x: 1, y: 3 },
        pieces: [
          { id: 'goal', type: 'goal', w: 2, h: 2, x: 1, y: 0, isGoal: true, color: '#ef233c' },
          { id: 'h1', type: 'horizontal', w: 2, h: 1, x: 1, y: 2, color: '#ffb703' },
          { id: 'h2', type: 'horizontal', w: 2, h: 1, x: 0, y: 3, color: '#ffb703' },
          { id: 'h3', type: 'horizontal', w: 2, h: 1, x: 2, y: 3, color: '#ffb703' },
          { id: 's1', type: 'single', w: 1, h: 1, x: 0, y: 0, color: '#06d6a0' },
          { id: 's2', type: 'single', w: 1, h: 1, x: 3, y: 0, color: '#118ab2' },
          { id: 's3', type: 'single', w: 1, h: 1, x: 0, y: 1, color: '#8338ec' },
          { id: 's4', type: 'single', w: 1, h: 1, x: 3, y: 1, color: '#fb5607' }
        ]
      },
      {
        name: 'Mini Quick Slide (3×4 Pocket)',
        cols: 3,
        rows: 4,
        exit: { x: 0, y: 2 },
        pieces: [
          { id: 'goal', type: 'goal', w: 2, h: 2, x: 0, y: 0, isGoal: true, color: '#ef233c' },
          { id: 'v1', type: 'vertical', w: 1, h: 2, x: 2, y: 0, color: '#2a9d8f' },
          { id: 's1', type: 'single', w: 1, h: 1, x: 0, y: 3, color: '#06d6a0' },
          { id: 's2', type: 'single', w: 1, h: 1, x: 1, y: 3, color: '#118ab2' }
        ]
      },
      {
        name: 'Square Arena (4×4 Grid)',
        cols: 4,
        rows: 4,
        exit: { x: 1, y: 2 },
        pieces: [
          { id: 'goal', type: 'goal', w: 2, h: 2, x: 1, y: 0, isGoal: true, color: '#ef233c' },
          { id: 'h1', type: 'horizontal', w: 2, h: 1, x: 1, y: 3, color: '#ffb703' },
          { id: 's1', type: 'single', w: 1, h: 1, x: 0, y: 0, color: '#06d6a0' },
          { id: 's2', type: 'single', w: 1, h: 1, x: 3, y: 0, color: '#118ab2' },
          { id: 's3', type: 'single', w: 1, h: 1, x: 0, y: 1, color: '#8338ec' },
          { id: 's4', type: 'single', w: 1, h: 1, x: 3, y: 1, color: '#fb5607' }
        ]
      },
      {
        name: 'L-Shape Challenge (Custom Pieces)',
        cols: 5,
        rows: 5,
        exit: { x: 2, y: 3 },
        pieces: [
          { id: 'goal', type: 'goal', w: 2, h: 2, x: 0, y: 0, isGoal: true, color: '#ef233c' },
          {
            id: 'l1',
            type: 'polyomino',
            w: 2,
            h: 3,
            cells: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }],
            x: 3,
            y: 0,
            color: '#8338ec',
            name: 'L-Shape (4)'
          },
          {
            id: 'm1',
            type: 'polyomino',
            w: 3,
            h: 2,
            cells: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 2, dy: 1 }],
            x: 1,
            y: 3,
            color: '#06d6a0',
            name: 'M-Shape'
          },
          { id: 's1', type: 'single', w: 1, h: 1, x: 0, y: 2, color: '#00b4d8' },
          { id: 's2', type: 'single', w: 1, h: 1, x: 4, y: 3, color: '#ffb703' }
        ]
      },
      {
        name: 'Donut Island (With Immovable Barrier)',
        cols: 5,
        rows: 5,
        exit: { x: 1, y: 3 },
        pieces: [
          { id: 'goal', type: 'goal', w: 2, h: 2, x: 1, y: 0, isGoal: true, color: '#ef233c' },
          { id: 'obs1', type: 'obstacle', w: 1, h: 1, x: 2, y: 2, isObstacle: true, color: '#495057' },
          { id: 'h1', type: 'horizontal', w: 2, h: 1, x: 0, y: 2, color: '#ffb703' },
          { id: 'h2', type: 'horizontal', w: 2, h: 1, x: 3, y: 2, color: '#ffb703' },
          { id: 'v1', type: 'vertical', w: 1, h: 2, x: 0, y: 3, color: '#2a9d8f' },
          { id: 'v2', type: 'vertical', w: 1, h: 2, x: 4, y: 3, color: '#2a9d8f' },
          { id: 's1', type: 'single', w: 1, h: 1, x: 0, y: 0, color: '#06d6a0' },
          { id: 's2', type: 'single', w: 1, h: 1, x: 4, y: 0, color: '#118ab2' }
        ]
      }
    ];
  }

  initDOM() {
    this.modal = document.getElementById('custom-studio-modal');
    this.gridContainer = document.getElementById('studio-grid-canvas');
    if (!this.modal || !this.gridContainer) return;

    this.setupEvents();
    this.initForgeMatrixDOM();
    this.loadPreset(0); // Load default GiiKER 4x5
  }

  // Get array of {dx, dy} cell offsets for any piece
  getPieceCells(piece) {
    if (piece.cells && piece.cells.length > 0) {
      return piece.cells;
    }
    const cells = [];
    const w = piece.w || 1;
    const h = piece.h || 1;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        cells.push({ dx: c, dy: r });
      }
    }
    return cells;
  }

  setupEvents() {
    // Dimension sliders
    const colSlider = document.getElementById('studio-cols-input');
    const rowSlider = document.getElementById('studio-rows-input');
    const colVal = document.getElementById('studio-cols-val');
    const rowVal = document.getElementById('studio-rows-val');

    if (colSlider && rowSlider) {
      colSlider.addEventListener('input', (e) => {
        this.cols = parseInt(e.target.value);
        if (colVal) colVal.textContent = this.cols;
        this.clampExitToBounds();
        this.pruneOutOfBoundsPieces();
        this.renderGrid();
      });

      rowSlider.addEventListener('input', (e) => {
        this.rows = parseInt(e.target.value);
        if (rowVal) rowVal.textContent = this.rows;
        this.clampExitToBounds();
        this.pruneOutOfBoundsPieces();
        this.renderGrid();
      });
    }

    // Expanded Exit Position Presets
    const exitBtns = document.querySelectorAll('.studio-exit-btn');
    exitBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.settingExitMode = false;
        document.getElementById('btn-set-exit-click')?.classList.remove('active');
        exitBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyExitPreset(btn.dataset.exit);
        this.renderGrid();
        if (window.giikerAudio) window.giikerAudio.playBtnClick();
      });
    });

    // "Click Grid to Set Exit Target" toggle button
    const btnSetExitClick = document.getElementById('btn-set-exit-click');
    if (btnSetExitClick) {
      btnSetExitClick.addEventListener('click', () => {
        this.settingExitMode = !this.settingExitMode;
        btnSetExitClick.classList.toggle('active', this.settingExitMode);
        exitBtns.forEach(b => b.classList.remove('active'));
        if (this.settingExitMode) {
          btnSetExitClick.textContent = '🎯 Click any grid cell to set exit...';
        } else {
          btnSetExitClick.textContent = '📍 Click Grid to Place Exit Target';
        }
        this.renderGrid();
      });
    }

    // Preset Select dropdown
    const presetSelect = document.getElementById('studio-preset-select');
    if (presetSelect) {
      presetSelect.innerHTML = this.presets.map((p, idx) => `<option value="${idx}">${p.name}</option>`).join('');
      presetSelect.addEventListener('change', (e) => {
        this.loadPreset(parseInt(e.target.value));
      });
    }

    // Standard Piece Palette buttons
    const paletteBtns = document.querySelectorAll('.palette-piece-card');
    paletteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        paletteBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.type;
        if (type === 'goal') {
          this.selectedPalettePiece = {
            type: 'goal',
            w: 2,
            h: 2,
            cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }],
            color: '#ef233c',
            isGoal: true,
            isObstacle: false,
            name: 'Goal (2×2)'
          };
        } else if (type === 'horizontal') {
          this.selectedPalettePiece = {
            type: 'horizontal',
            w: 2,
            h: 1,
            cells: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }],
            color: '#ffb703',
            isGoal: false,
            isObstacle: false,
            name: 'Horizontal (2×1)'
          };
        } else if (type === 'vertical') {
          this.selectedPalettePiece = {
            type: 'vertical',
            w: 1,
            h: 2,
            cells: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }],
            color: '#2a9d8f',
            isGoal: false,
            isObstacle: false,
            name: 'Vertical (1×2)'
          };
        } else if (type === 'single') {
          this.selectedPalettePiece = {
            type: 'single',
            w: 1,
            h: 1,
            cells: [{ dx: 0, dy: 0 }],
            color: '#06d6a0',
            isGoal: false,
            isObstacle: false,
            name: 'Single (1×1)'
          };
        } else if (type === 'obstacle') {
          this.selectedPalettePiece = {
            type: 'obstacle',
            w: 1,
            h: 1,
            cells: [{ dx: 0, dy: 0 }],
            color: '#495057',
            isGoal: false,
            isObstacle: true,
            name: 'Obstacle (1×1)'
          };
        }
        if (window.giikerAudio) window.giikerAudio.playBtnClick();
      });
    });

    // Custom Piece Forge Shape Presets
    const forgePresetBtns = document.querySelectorAll('.forge-preset-pill');
    forgePresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        forgePresetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadForgePreset(btn.dataset.shape);
      });
    });

    // Color Swatches in Forge
    const swatchBtns = document.querySelectorAll('.swatch-dot');
    const forgeColorInput = document.getElementById('forge-color-input');
    swatchBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.color;
        this.forgeColor = c;
        if (forgeColorInput) forgeColorInput.value = c;
        this.updateForgeGridUI();
      });
    });

    if (forgeColorInput) {
      forgeColorInput.addEventListener('input', (e) => {
        this.forgeColor = e.target.value;
        this.updateForgeGridUI();
      });
    }

    // "Use Forged Shape" Button
    const btnAddForge = document.getElementById('btn-add-forge-piece');
    if (btnAddForge) {
      btnAddForge.addEventListener('click', () => {
        this.activateForgedPiece();
      });
    }

    // Action buttons in Studio
    document.getElementById('btn-studio-clear')?.addEventListener('click', () => {
      this.pieces = [];
      this.renderGrid();
      if (window.giikerAudio) window.giikerAudio.playReset();
    });

    document.getElementById('btn-studio-validate')?.addEventListener('click', () => {
      this.validateSolvability();
    });

    document.getElementById('btn-studio-play')?.addEventListener('click', () => {
      this.playCustomBoard();
    });

    document.getElementById('btn-studio-save')?.addEventListener('click', () => {
      this.saveCustomBoard();
    });

    document.getElementById('btn-studio-export')?.addEventListener('click', () => {
      this.exportJSON();
    });

    document.getElementById('btn-studio-import')?.addEventListener('click', () => {
      this.importJSON();
    });

    document.getElementById('btn-close-studio')?.addEventListener('click', () => {
      this.close();
    });
  }

  // Initialize the 4x4 matrix drawing grid in the Forge
  initForgeMatrixDOM() {
    const gridEl = document.getElementById('forge-matrix-grid');
    if (!gridEl) return;

    gridEl.innerHTML = '';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = document.createElement('button');
        cell.className = 'forge-matrix-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener('click', () => {
          this.forgeMatrix[r][c] = !this.forgeMatrix[r][c];
          this.updateForgeGridUI();
        });
        gridEl.appendChild(cell);
      }
    }
    this.updateForgeGridUI();
  }

  updateForgeGridUI() {
    const gridEl = document.getElementById('forge-matrix-grid');
    const badge = document.getElementById('forge-cells-badge');
    if (!gridEl) return;

    let cellCount = 0;
    const cells = gridEl.querySelectorAll('.forge-matrix-cell');
    cells.forEach(btn => {
      const r = parseInt(btn.dataset.r);
      const c = parseInt(btn.dataset.c);
      const active = !!this.forgeMatrix[r][c];
      btn.classList.toggle('active', active);
      btn.style.setProperty('--forge-active-color', this.forgeColor);
      if (active) cellCount++;
    });

    if (badge) {
      badge.textContent = `${cellCount} Cell${cellCount === 1 ? '' : 's'}`;
    }
  }

  // Load a quick polyomino shape preset into the forge matrix
  loadForgePreset(shapeKey) {
    this.forgeMatrix = Array.from({ length: 4 }, () => Array(4).fill(false));

    if (shapeKey === 'L3') {
      // 3-cell corner L
      this.forgeMatrix[0][0] = true;
      this.forgeMatrix[1][0] = true;
      this.forgeMatrix[1][1] = true;
    } else if (shapeKey === 'L4') {
      // 4-cell tall L
      this.forgeMatrix[0][0] = true;
      this.forgeMatrix[1][0] = true;
      this.forgeMatrix[2][0] = true;
      this.forgeMatrix[2][1] = true;
    } else if (shapeKey === 'T') {
      // 4-cell T
      this.forgeMatrix[0][0] = true;
      this.forgeMatrix[0][1] = true;
      this.forgeMatrix[0][2] = true;
      this.forgeMatrix[1][1] = true;
    } else if (shapeKey === 'Z') {
      // 4-cell Z
      this.forgeMatrix[0][0] = true;
      this.forgeMatrix[0][1] = true;
      this.forgeMatrix[1][1] = true;
      this.forgeMatrix[1][2] = true;
    } else if (shapeKey === 'Plus') {
      // 5-cell Plus (+)
      this.forgeMatrix[0][1] = true;
      this.forgeMatrix[1][0] = true;
      this.forgeMatrix[1][1] = true;
      this.forgeMatrix[1][2] = true;
      this.forgeMatrix[2][1] = true;
    } else if (shapeKey === 'U') {
      // 5-cell U-Shape
      this.forgeMatrix[0][0] = true;
      this.forgeMatrix[1][0] = true;
      this.forgeMatrix[1][1] = true;
      this.forgeMatrix[1][2] = true;
      this.forgeMatrix[0][2] = true;
    } else if (shapeKey === 'M') {
      // 5-cell M-Shape with two peaks and a center valley
      this.forgeMatrix[0][0] = true;
      this.forgeMatrix[1][0] = true;
      this.forgeMatrix[0][1] = true;
      this.forgeMatrix[0][2] = true;
      this.forgeMatrix[1][2] = true;
    } else if (shapeKey === 'Square') {
      // 2x2 Square
      this.forgeMatrix[0][0] = true;
      this.forgeMatrix[0][1] = true;
      this.forgeMatrix[1][0] = true;
      this.forgeMatrix[1][1] = true;
    }

    this.updateForgeGridUI();
    if (window.giikerAudio) window.giikerAudio.playBtnClick();
  }

  // Activate the drawn polyomino piece from the forge
  activateForgedPiece() {
    const rawCells = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (this.forgeMatrix[r][c]) {
          rawCells.push({ c, r });
        }
      }
    }

    if (rawCells.length === 0) {
      alert('Please click on the 4×4 grid to draw at least 1 cell for your custom piece!');
      return;
    }

    // Normalize coordinates so minC = 0, minR = 0
    const minC = Math.min(...rawCells.map(p => p.c));
    const maxC = Math.max(...rawCells.map(p => p.c));
    const minR = Math.min(...rawCells.map(p => p.r));
    const maxR = Math.max(...rawCells.map(p => p.r));

    const normCells = rawCells.map(p => ({
      dx: p.c - minC,
      dy: p.r - minR
    }));

    const w = maxC - minC + 1;
    const h = maxR - minR + 1;

    const isGoal = document.getElementById('forge-is-goal')?.checked || false;
    const isObstacle = document.getElementById('forge-is-obstacle')?.checked || false;

    this.selectedPalettePiece = {
      type: isGoal ? 'goal' : (isObstacle ? 'obstacle' : 'polyomino'),
      w,
      h,
      cells: normCells,
      color: this.forgeColor || '#ffb703',
      isGoal,
      isObstacle,
      name: isGoal ? 'Goal (Custom)' : (isObstacle ? 'Obstacle (Custom)' : `Polyomino (${normCells.length}c)`)
    };

    // Deselect standard palette pills
    document.querySelectorAll('.palette-piece-card').forEach(b => b.classList.remove('active'));

    if (window.giikerAudio) window.giikerAudio.playBtnClick();
    this.updateStats();
  }

  // Expanded Exit Target Placement
  applyExitPreset(presetKey) {
    const goalW = this.getGoalDimensions().w;
    const goalH = this.getGoalDimensions().h;

    const maxExitX = Math.max(0, this.cols - goalW);
    const maxExitY = Math.max(0, this.rows - goalH);
    const centerX = Math.floor((this.cols - goalW) / 2);
    const centerY = Math.floor((this.rows - goalH) / 2);

    if (presetKey === 'bottom-center') {
      this.exit = { x: centerX, y: maxExitY };
    } else if (presetKey === 'bottom-left') {
      this.exit = { x: 0, y: maxExitY };
    } else if (presetKey === 'bottom-right') {
      this.exit = { x: maxExitX, y: maxExitY };
    } else if (presetKey === 'top-center') {
      this.exit = { x: centerX, y: 0 };
    } else if (presetKey === 'top-left') {
      this.exit = { x: 0, y: 0 };
    } else if (presetKey === 'top-right') {
      this.exit = { x: maxExitX, y: 0 };
    } else if (presetKey === 'center') {
      this.exit = { x: centerX, y: centerY };
    } else if (presetKey === 'middle-left') {
      this.exit = { x: 0, y: centerY };
    } else if (presetKey === 'middle-right') {
      this.exit = { x: maxExitX, y: centerY };
    }

    this.clampExitToBounds();
    this.updateExitBadge();
  }

  clampExitToBounds() {
    const goalW = this.getGoalDimensions().w;
    const goalH = this.getGoalDimensions().h;
    this.exit.x = Math.max(0, Math.min(this.exit.x, this.cols - goalW));
    this.exit.y = Math.max(0, Math.min(this.exit.y, this.rows - goalH));
    this.updateExitBadge();
  }

  updateExitBadge() {
    const badge = document.getElementById('exit-coord-badge');
    if (badge) {
      badge.textContent = `Exit: (${this.exit.x}, ${this.exit.y})`;
    }
  }

  getGoalDimensions() {
    const goal = this.pieces.find(p => p.isGoal) || this.selectedPalettePiece;
    return {
      w: goal?.w || 2,
      h: goal?.h || 2
    };
  }

  open() {
    if (!this.modal) return;
    this.modal.classList.add('active');
    this.renderGrid();
    if (window.giikerAudio) window.giikerAudio.playBtnClick();
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('active');
  }

  loadPreset(index) {
    const preset = this.presets[index];
    if (!preset) return;

    this.cols = preset.cols;
    this.rows = preset.rows;
    this.exit = { ...preset.exit };
    this.pieces = JSON.parse(JSON.stringify(preset.pieces));

    // Update slider UI
    const colSlider = document.getElementById('studio-cols-input');
    const rowSlider = document.getElementById('studio-rows-input');
    const colVal = document.getElementById('studio-cols-val');
    const rowVal = document.getElementById('studio-rows-val');
    if (colSlider) colSlider.value = this.cols;
    if (rowSlider) rowSlider.value = this.rows;
    if (colVal) colVal.textContent = this.cols;
    if (rowVal) rowVal.textContent = this.rows;

    this.updateExitBadge();
    this.renderGrid();
  }

  pruneOutOfBoundsPieces() {
    this.pieces = this.pieces.filter(p => {
      const cells = this.getPieceCells(p);
      return cells.every(c => p.x + c.dx < this.cols && p.y + c.dy < this.rows);
    });
  }

  renderGrid() {
    if (!this.gridContainer) return;

    this.gridContainer.innerHTML = '';
    this.gridContainer.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    this.gridContainer.style.gridTemplateRows = `repeat(${this.rows}, 1fr)`;

    // Dynamic cell sizing so board NEVER overflows or collides with buttons
    const maxDim = Math.max(this.cols, this.rows);
    const cellSize = Math.max(28, Math.min(48, Math.floor(340 / maxDim)));
    const gap = Math.max(4, Math.min(6, Math.floor(cellSize / 8)));
    this.gridContainer.style.setProperty('--cell-size', `${cellSize}px`);
    this.gridContainer.style.setProperty('--grid-gap', `${gap}px`);

    // Map which cell has which piece
    const cellMap = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.pieces.forEach(p => {
      const cells = this.getPieceCells(p);
      cells.forEach(c => {
        const px = p.x + c.dx;
        const py = p.y + c.dy;
        if (py < this.rows && px < this.cols) {
          cellMap[py][px] = p;
        }
      });
    });

    const goalDims = this.getGoalDimensions();

    // Render cells
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'studio-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        if (this.settingExitMode) {
          cell.classList.add('setting-exit-target');
          cell.title = `Click to set Exit at (${c}, ${r})`;
        }

        // Highlight Exit Target Zone
        if (c >= this.exit.x && c < this.exit.x + goalDims.w && r >= this.exit.y && r < this.exit.y + goalDims.h) {
          cell.classList.add('exit-zone');
        }

        const occupant = cellMap[r][c];
        if (occupant) {
          // Cell is part of a piece
          cell.classList.add('occupied');
          cell.title = `Click to remove ${occupant.name || 'piece'}`;
          cell.style.backgroundColor = occupant.color || '#ffb703';
          cell.style.borderColor = occupant.isGoal ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.15)';
          cell.style.boxShadow = occupant.isGoal ? '0 0 10px rgba(239, 35, 60, 0.4)' : 'none';

          // Click ANY cell of a placed piece to remove/cancel it instantly!
          cell.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removePiece(occupant.id);
          });

          // If this is the root / top-left cell of the piece, render label and sleek delete button
          if (occupant.x === c && occupant.y === r) {
            const label = document.createElement('span');
            label.className = 'piece-label';
            label.textContent = occupant.isGoal ? '★ GOAL' : (occupant.isObstacle ? 'BLOCK' : (occupant.name || `${occupant.w}×${occupant.h}`));
            cell.appendChild(label);

            const btnDelete = document.createElement('button');
            btnDelete.className = 'piece-del-btn';
            btnDelete.textContent = '×';
            btnDelete.title = 'Remove Piece';
            btnDelete.addEventListener('click', (e) => {
              e.stopPropagation();
              this.removePiece(occupant.id);
            });
            cell.appendChild(btnDelete);
          }
        } else {
          // Empty cell: click to place selected piece (or set exit if in settingExitMode)
          cell.addEventListener('click', () => {
            if (this.settingExitMode) {
              this.exit = { x: c, y: r };
              this.clampExitToBounds();
              this.settingExitMode = false;
              document.getElementById('btn-set-exit-click')?.classList.remove('active');
              if (window.giikerAudio) window.giikerAudio.playSnap();
              this.renderGrid();
            } else {
              this.tryPlacePiece(c, r);
            }
          });
        }

        this.gridContainer.appendChild(cell);
      }
    }

    this.updateStats();
  }

  tryPlacePiece(x, y) {
    const p = this.selectedPalettePiece;
    if (!p) return;

    const cells = this.getPieceCells(p);

    // Check bounds for all cells of the piece
    for (const c of cells) {
      const px = x + c.dx;
      const py = y + c.dy;
      if (px < 0 || px >= this.cols || py < 0 || py >= this.rows) {
        if (window.giikerAudio) window.giikerAudio.playBump();
        return;
      }
    }

    // Check collision with existing pieces
    for (const ep of this.pieces) {
      const epCells = this.getPieceCells(ep);
      for (const c of cells) {
        const px = x + c.dx;
        const py = y + c.dy;
        for (const ec of epCells) {
          if (px === ep.x + ec.dx && py === ep.y + ec.dy) {
            if (window.giikerAudio) window.giikerAudio.playBump();
            return;
          }
        }
      }
    }

    // If placing a goal piece and one already exists, replace it
    if (p.isGoal) {
      this.pieces = this.pieces.filter(item => !item.isGoal);
    }

    // Add piece
    const newId = p.isGoal ? 'goal' : `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.pieces.push({
      id: newId,
      type: p.type,
      w: p.w,
      h: p.h,
      cells: JSON.parse(JSON.stringify(cells)),
      x,
      y,
      color: p.color,
      isGoal: !!p.isGoal,
      isObstacle: !!p.isObstacle,
      name: p.name || `${p.w}×${p.h}`
    });

    if (window.giikerAudio) window.giikerAudio.playSnap();
    this.renderGrid();
  }

  removePiece(pieceId) {
    this.pieces = this.pieces.filter(p => p.id !== pieceId);
    if (window.giikerAudio) window.giikerAudio.playBtnClick();
    this.renderGrid();
  }

  updateStats() {
    const totalCells = this.cols * this.rows;
    let filledCells = 0;
    let hasGoal = false;

    this.pieces.forEach(p => {
      const cells = this.getPieceCells(p);
      filledCells += cells.length;
      if (p.isGoal) hasGoal = true;
    });

    const emptyCells = totalCells - filledCells;

    const statTotal = document.getElementById('studio-stat-total');
    const statFilled = document.getElementById('studio-stat-filled');
    const statEmpty = document.getElementById('studio-stat-empty');
    const statGoal = document.getElementById('studio-stat-goal');

    if (statTotal) statTotal.textContent = totalCells;
    if (statFilled) statFilled.textContent = filledCells;
    if (statEmpty) {
      statEmpty.textContent = emptyCells;
      statEmpty.style.color = emptyCells >= 2 ? '#06d6a0' : (emptyCells > 0 ? '#ffb703' : '#ef233c');
    }
    if (statGoal) {
      statGoal.textContent = hasGoal ? '✅ Active' : '❌ Missing';
      statGoal.style.color = hasGoal ? '#06d6a0' : '#ef233c';
    }
  }

  validateSolvability() {
    const statusBox = document.getElementById('studio-solvability-status');
    const goal = this.pieces.find(p => p.isGoal);
    if (!goal) {
      if (statusBox) {
        statusBox.className = 'solvability-status error';
        statusBox.innerHTML = '❌ <strong>Missing Goal Piece:</strong> Please place a Goal piece on the board!';
      }
      if (window.giikerAudio) window.giikerAudio.playBump();
      return null;
    }

    const totalCells = this.cols * this.rows;
    const filledCells = this.pieces.reduce((acc, p) => acc + this.getPieceCells(p).length, 0);
    const emptyCells = totalCells - filledCells;

    if (emptyCells < 1) {
      if (statusBox) {
        statusBox.className = 'solvability-status error';
        statusBox.innerHTML = '❌ <strong>No Empty Space:</strong> A sliding puzzle needs at least 1 or 2 empty cells to move!';
      }
      if (window.giikerAudio) window.giikerAudio.playBump();
      return null;
    }

    if (statusBox) {
      statusBox.className = 'solvability-status checking';
      statusBox.innerHTML = '⚡ <strong>Analyzing Board...</strong> Running BFS solver...';
    }

    setTimeout(() => {
      const solverResult = window.giikerSolver.solve(this.pieces, this.cols, this.rows, this.exit);
      if (solverResult.solved) {
        if (statusBox) {
          statusBox.className = 'solvability-status success';
          statusBox.innerHTML = `🎉 <strong>100% Solvable!</strong> Optimal solution requires <strong>${solverResult.minSteps}</strong> moves (${solverResult.statesExplored} states explored).`;
        }
        if (window.giikerAudio) window.giikerAudio.playHint();
      } else {
        if (statusBox) {
          statusBox.className = 'solvability-status warning';
          statusBox.innerHTML = `⚠️ <strong>Unsolvable with current layout:</strong> ${solverResult.reason}. Try rearranging blocks or adding more empty spaces.`;
        }
        if (window.giikerAudio) window.giikerAudio.playBump();
      }
    }, 50);
  }

  playCustomBoard() {
    const goal = this.pieces.find(p => p.isGoal);
    if (!goal) {
      alert('Please place a Goal piece on the board before playing!');
      return;
    }

    const customLevel = {
      id: 'custom_' + Date.now(),
      name: 'Custom Creation',
      difficulty: 'Custom',
      minSteps: 0,
      board: { cols: this.cols, rows: this.rows },
      exit: { ...this.exit },
      pieces: JSON.parse(JSON.stringify(this.pieces))
    };

    this.close();
    if (this.gameApp) {
      this.gameApp.loadLevelData(customLevel);
    }
  }

  saveCustomBoard() {
    const name = prompt('Enter a name for your custom puzzle:', `My Custom Level ${new Date().toLocaleDateString()}`);
    if (!name) return;

    const savedLevels = JSON.parse(localStorage.getItem('giiker_custom_levels') || '[]');
    const newCustom = {
      id: 'custom_' + Date.now(),
      name,
      difficulty: 'Custom',
      createdAt: new Date().toISOString(),
      board: { cols: this.cols, rows: this.rows },
      exit: { ...this.exit },
      pieces: this.pieces
    };

    savedLevels.push(newCustom);
    localStorage.setItem('giiker_custom_levels', JSON.stringify(savedLevels));
    alert(`Level "${name}" saved successfully to your browser storage!`);
    if (window.giikerAudio) window.giikerAudio.playHint();
  }

  exportJSON() {
    const customData = {
      name: 'Custom GiiKER Puzzle',
      board: { cols: this.cols, rows: this.rows },
      exit: this.exit,
      pieces: this.pieces
    };

    const jsonStr = JSON.stringify(customData, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      alert('Puzzle JSON copied to clipboard!');
    }).catch(() => {
      prompt('Copy your puzzle JSON:', jsonStr);
    });
  }

  importJSON() {
    const input = prompt('Paste your puzzle JSON here:');
    if (!input) return;

    try {
      const data = JSON.parse(input);
      if (data.board && data.pieces) {
        this.cols = data.board.cols || 4;
        this.rows = data.board.rows || 5;
        this.exit = data.exit || { x: 1, y: 3 };
        this.pieces = data.pieces;
        this.renderGrid();
        alert('Puzzle imported successfully!');
      } else {
        alert('Invalid JSON format: missing board or pieces array.');
      }
    } catch (e) {
      alert('Error parsing JSON: ' + e.message);
    }
  }
}

window.CustomStudio = CustomStudio;
