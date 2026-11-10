/**
 * GiiKER Super Slide - Fast BFS In-Browser Solver & Hint Engine
 * Supports arbitrary boards, flexible exit locations, and arbitrary polyomino shapes (L, M, T, Z, Plus, U, etc.).
 */

class GiikerSolver {
  constructor() {
    this.maxStates = 45000; // Search ceiling to ensure high-performance responsiveness
  }

  // Get {dx, dy} cell offsets for a piece
  getCells(piece) {
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

  /**
   * Solves a board from current layout to goalTarget
   * @param {Array} pieces - Array of piece objects { id, x, y, w, h, cells, isGoal, isObstacle }
   * @param {number} cols - Board column count (default 4)
   * @param {number} rows - Board row count (default 5)
   * @param {Object} goalTarget - { x, y } target coordinate for Goal piece top-left
   * @returns {Object} { solved: boolean, minSteps: number, moves: Array, statesExplored: number }
   */
  solve(pieces, cols = 4, rows = 5, goalTarget = { x: 1, y: 3 }) {
    const goalIdx = pieces.findIndex(p => p.isGoal || p.type === 'goal');
    if (goalIdx === -1) {
      return { solved: false, minSteps: -1, moves: [], reason: 'No goal piece found on board' };
    }

    const targetX = goalTarget.x;
    const targetY = goalTarget.y;

    // Check if already at goal
    if (pieces[goalIdx].x === targetX && pieces[goalIdx].y === targetY) {
      return { solved: true, minSteps: 0, moves: [], statesExplored: 1 };
    }

    // Piece metadata for fast iteration
    const pMeta = pieces.map((p, idx) => {
      const cells = this.getCells(p);
      // Shape signature for canonical hashing
      const shapeSig = cells.map(c => `${c.dx},${c.dy}`).sort().join(';');
      return {
        id: p.id,
        w: p.w || 1,
        h: p.h || 1,
        cells,
        isGoal: idx === goalIdx,
        isObstacle: !!p.isObstacle,
        typeKey: idx === goalIdx ? 'G' : (p.isObstacle ? `OBS:${shapeSig}` : `P:${shapeSig}`)
      };
    });

    // Group movable pieces by typeKey for canonical isomorphic hashing
    const typeGroups = {};
    pMeta.forEach((meta, idx) => {
      if (meta.isObstacle) return; // Obstacles don't move
      if (!typeGroups[meta.typeKey]) typeGroups[meta.typeKey] = [];
      typeGroups[meta.typeKey].push(idx);
    });

    // Helper: canonical state string
    const toCanon = (state) => {
      const parts = [];
      for (const key in typeGroups) {
        const group = typeGroups[key];
        if (key === 'G') {
          const idx = group[0];
          parts.push(`G:${state[idx].x},${state[idx].y}`);
        } else {
          const coords = group.map(idx => `${state[idx].x},${state[idx].y}`);
          coords.sort();
          parts.push(`${key}:${coords.join(';')}`);
        }
      }
      return parts.join('|');
    };

    // Initial state: array of { x, y }
    const initState = pieces.map(p => ({ x: p.x, y: p.y }));
    const initCanon = toCanon(initState);

    // BFS Queue: elements are { state, moveInfo, parentNode }
    const rootNode = { state: initState, move: null, parent: null };
    const queue = [rootNode];
    let queueHead = 0;

    const visited = new Set();
    visited.add(initCanon);

    const DIRS = [
      { dx: -1, dy: 0, name: 'left' },
      { dx: 1, dy: 0, name: 'right' },
      { dx: 0, dy: -1, name: 'up' },
      { dx: 0, dy: 1, name: 'down' }
    ];

    let targetNode = null;
    let statesExplored = 0;

    // Fast 1D grid array for collision testing
    const grid = new Int16Array(cols * rows);

    while (queueHead < queue.length) {
      const currNode = queue[queueHead++];
      const currState = currNode.state;
      statesExplored++;

      if (statesExplored > this.maxStates) {
        break; // Timeout safeguard
      }

      // Check victory
      if (currState[goalIdx].x === targetX && currState[goalIdx].y === targetY) {
        targetNode = currNode;
        break;
      }

      // Fill occupancy grid
      grid.fill(-1);
      for (let i = 0; i < currState.length; i++) {
        const px = currState[i].x;
        const py = currState[i].y;
        const cells = pMeta[i].cells;
        for (let k = 0; k < cells.length; k++) {
          const cx = px + cells[k].dx;
          const cy = py + cells[k].dy;
          if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
            grid[cy * cols + cx] = i;
          }
        }
      }

      // Try moving each movable piece
      for (let i = 0; i < currState.length; i++) {
        if (pMeta[i].isObstacle) continue; // Immovable

        const px = currState[i].x;
        const py = currState[i].y;
        const cells = pMeta[i].cells;

        for (let d = 0; d < 4; d++) {
          const { dx, dy, name } = DIRS[d];
          const nx = px + dx;
          const ny = py + dy;

          // Check if all cells of the piece can translate by (dx, dy)
          let collision = false;
          for (let k = 0; k < cells.length; k++) {
            const cellX = nx + cells[k].dx;
            const cellY = ny + cells[k].dy;

            // Boundary check
            if (cellX < 0 || cellX >= cols || cellY < 0 || cellY >= rows) {
              collision = true;
              break;
            }

            // Cell collision with another piece
            const occupant = grid[cellY * cols + cellX];
            if (occupant !== -1 && occupant !== i) {
              collision = true;
              break;
            }
          }

          if (!collision) {
            // Valid step!
            const nextState = currState.map((pos, idx) => (idx === i ? { x: nx, y: ny } : pos));
            const canon = toCanon(nextState);

            if (!visited.has(canon)) {
              visited.add(canon);
              const nextNode = {
                state: nextState,
                move: {
                  pieceId: pMeta[i].id,
                  pieceIndex: i,
                  from: { x: px, y: py },
                  to: { x: nx, y: ny },
                  dir: name,
                  dx,
                  dy
                },
                parent: currNode
              };
              queue.push(nextNode);
            }
          }
        }
      }
    }

    if (!targetNode) {
      return {
        solved: false,
        minSteps: -1,
        moves: [],
        statesExplored,
        reason: statesExplored > this.maxStates ? 'Search limit reached (complex puzzle)' : 'No solution exists'
      };
    }

    // Reconstruct moves list from targetNode back to root
    const rawMoves = [];
    let curr = targetNode;
    while (curr.parent) {
      rawMoves.push(curr.move);
      curr = curr.parent;
    }
    rawMoves.reverse();

    // Consolidate consecutive slides of the same piece in the same direction
    const compressedMoves = [];
    for (let i = 0; i < rawMoves.length; i++) {
      const m = rawMoves[i];
      if (
        compressedMoves.length > 0 &&
        compressedMoves[compressedMoves.length - 1].pieceId === m.pieceId &&
        compressedMoves[compressedMoves.length - 1].dir === m.dir
      ) {
        compressedMoves[compressedMoves.length - 1].to = { x: m.to.x, y: m.to.y };
      } else {
        compressedMoves.push({
          pieceId: m.pieceId,
          pieceIndex: m.pieceIndex,
          from: { ...m.from },
          to: { ...m.to },
          dir: m.dir
        });
      }
    }

    return {
      solved: true,
      minSteps: compressedMoves.length,
      rawStepCount: rawMoves.length,
      moves: compressedMoves,
      statesExplored
    };
  }

  /**
   * Returns the next recommended optimal move for the player
   */
  getHint(pieces, cols = 4, rows = 5, goalTarget = { x: 1, y: 3 }) {
    const res = this.solve(pieces, cols, rows, goalTarget);
    if (res.solved && res.moves.length > 0) {
      return res.moves[0];
    }
    return null;
  }

  /**
   * Fast solvability validator for custom boards
   */
  validate(pieces, cols = 4, rows = 5, goalTarget = { x: 1, y: 3 }) {
    const res = this.solve(pieces, cols, rows, goalTarget);
    return {
      solvable: res.solved,
      steps: res.minSteps,
      reason: res.reason || `Solvable in ${res.minSteps} moves!`
    };
  }
}

window.giikerSolver = new GiikerSolver();
