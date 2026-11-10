/**
 * GiiKER Super Slide 3D - Core Interactive Engine
 * Handles Three.js 3D rendering, tactile materials, smooth mouse & touch dragging,
 * collision physics, level management, audio, hints, solver, and responsive layouts.
 */

class GiikerGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.levels = window.GIIKER_LEVELS || [];
    this.currentLevelIndex = 0;
    this.currentLevel = null;
    
    // Board state
    this.cols = 4;
    this.rows = 5;
    this.exit = { x: 1, y: 3 };
    this.pieces = []; // Logical pieces: { id, type, w, h, x, y, color, isGoal, isObstacle }
    this.pieceMeshes = new Map(); // id -> THREE.Group
    this.selectedPieceId = null;

    // History for Undo / Redo
    this.history = [];
    this.redoStack = [];

    // Stats
    this.moveCount = 0;
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.timerRunning = false;
    this.timerVisible = true;
    this.hintsUsed = 0;
    this.isSolved = false;

    // Auto-solve playback
    this.isAutoSolving = false;
    this.autoSolveTimer = null;

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.planeIntersect = new THREE.Vector3();

    // Dragging state
    this.isDragging = false;
    this.draggedPiece = null;
    this.dragStartGridPos = { x: 0, y: 0 };
    this.dragStartHitPoint = new THREE.Vector3();
    this.dragCurrentOffset = new THREE.Vector3();
    this.dragAllowedBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    this.pointerDownPos = { x: 0, y: 0 };
    this.pointerDownTime = 0;

    // 3D Meshes & Lights
    this.boardGroup = null;
    this.consoleCase = null;
    this.exitGateMesh = null;
    this.ledDisplayCanvas = null;
    this.ledDisplayTexture = null;
    this.ledScreenMesh = null;

    // Visual theme
    this.cellSize = 1.0;
    this.pieceGap = 0.04;
    this.pieceHeight = 0.38;

    // Studio instance
    this.studio = null;

    // Goal Highlight Lines state (options: 'duo', 'green', 'red')
    this.goalHighlightColor = localStorage.getItem('giiker_goal_color') || 'duo';
    this.goalLinesGroup = null;

    // Side Level Monitor HUD state
    this.monitorVisible = localStorage.getItem('giiker_monitor_collapsed') !== '1';
    this.monitorDockSide = localStorage.getItem('giiker_monitor_dock') || 'right';

    // Bindings
    this.animate = this.animate.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.toggleMonitorVisibility = this.toggleMonitorVisibility.bind(this);
    this.switchMonitorDockSide = this.switchMonitorDockSide.bind(this);
    this.toggleGoalHighlightColor = this.toggleGoalHighlightColor.bind(this);
  }

  init() {
    this.setupThreeScene();
    this.setupLighting();
    this.setupEventListeners();
    this.initHUD();

    // Initialize custom studio
    if (window.CustomStudio) {
      this.studio = new window.CustomStudio(this);
      this.studio.initDOM();
    }

    // Load initial level
    const savedLevel = parseInt(localStorage.getItem('giiker_current_level') || '1');
    const startIdx = Math.max(0, Math.min(savedLevel - 1, this.levels.length - 1));
    this.loadLevel(startIdx);

    // Start render loop
    requestAnimationFrame(this.animate);
  }

  setupThreeScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d1117');

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Perspective Camera angled like holding a handheld device
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.setCameraPreset('handheld');

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls for laptop/desktop inspection (disabled during piece drag)
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.05; // Don't flip below table
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 18;
    this.controls.target.set(0, 0, 0);
  }

  setupLighting() {
    // Ambient light for soft shadow fill
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.85);
    this.scene.add(ambientLight);

    // Key Directional Light with soft shadows
    const keyLight = new THREE.DirectionalLight('#ffffff', 1.4);
    keyLight.position.set(4, 9, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    const d = 6;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Rim / Specular back light for candy clearcoat reflections
    const rimLight = new THREE.DirectionalLight('#a2d2ff', 0.8);
    rimLight.position.set(-4, 6, -6);
    this.scene.add(rimLight);

    // Exit gate point light for illuminated victory glow
    this.exitLight = new THREE.PointLight('#ef233c', 1.2, 3);
    this.exitLight.position.set(0, 0.3, 2.7);
    this.scene.add(this.exitLight);
  }

  setCameraPreset(preset) {
    if (!this.camera) return;
    this.cameraPreset = preset;
    const isMobile = window.innerWidth <= 768;
    const maxBoardDim = Math.max(this.cols || 4, this.rows || 5);
    const boardScale = Math.max(1.0, maxBoardDim / 5.0);
    const distFactor = (isMobile ? 1.35 : 1.05) * boardScale;

    if (preset === 'topdown') {
      this.camera.position.set(0, 8.8 * distFactor, 0.01);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) this.controls.target.set(0, 0, 0);
    } else if (preset === 'handheld') {
      // Natural angled handheld view centered directly on puzzle board
      this.camera.position.set(0, 6.6 * distFactor, 5.0 * distFactor);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) this.controls.target.set(0, 0, 0);
    } else if (preset === 'isometric') {
      this.camera.position.set(5.5 * distFactor, 6.2 * distFactor, 5.5 * distFactor);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) this.controls.target.set(0, 0, 0);
    }
    if (this.controls) this.controls.update();
  }

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

  // Create high-contrast glowing canvas texture for the Final Goal Target
  createGoalTargetTexture(isBottomExit = true) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const mode = this.goalHighlightColor || 'duo';
    const isGreen = mode === 'green';
    const isRed = mode === 'red';

    const primColor = isGreen ? '#06d6a0' : '#ff1e42';
    const gateColor = isRed ? '#ff1e42' : '#06d6a0';
    const bracketColor = isGreen ? '#55ff99' : (isRed ? '#ffffff' : '#00f59b');
    const bgBase = isGreen ? '#03140f' : '#160508';
    const gridColor = isGreen ? 'rgba(6, 214, 160, 0.25)' : 'rgba(239, 35, 60, 0.25)';

    // Deep tech obsidian / crimson floor
    ctx.fillStyle = bgBase;
    ctx.fillRect(0, 0, 512, 512);

    // Carbon grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 3;
    for (let i = 32; i < 512; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }

    // Outer bold neon glowing border line
    ctx.strokeStyle = primColor;
    ctx.lineWidth = 18;
    ctx.strokeRect(14, 14, 484, 484);

    // Inner secondary accent border line
    ctx.strokeStyle = gateColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, 456, 456);

    // High-contrast corner L-brackets
    ctx.strokeStyle = bracketColor;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    const bLen = 92;
    // Top-left
    ctx.beginPath(); ctx.moveTo(22, 22 + bLen); ctx.lineTo(22, 22); ctx.lineTo(22 + bLen, 22); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(490 - bLen, 22); ctx.lineTo(490, 22); ctx.lineTo(490, 22 + bLen); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(22, 490 - bLen); ctx.lineTo(22, 490); ctx.lineTo(22 + bLen, 490); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(490 - bLen, 490); ctx.lineTo(490, 490); ctx.lineTo(490, 490 - bLen); ctx.stroke();

    // Concentric Target Rings (Matching Goal Block concentric circles)
    ctx.strokeStyle = primColor;
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(256, 256, 128, 0, Math.PI * 2); ctx.stroke();

    ctx.strokeStyle = gateColor;
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(256, 256, 80, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = primColor;
    ctx.beginPath(); ctx.arc(256, 256, 40, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(256, 256, 16, 0, Math.PI * 2); ctx.fill();

    // Text & Directional Exit Arrow
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ FINAL GOAL ★', 256, 75);

    ctx.fillStyle = gateColor;
    ctx.font = 'bold 36px monospace';
    if (isBottomExit) {
      ctx.fillText('▼ ▼  ESCAPE GATE  ▼ ▼', 256, 435);
    } else {
      ctx.fillText('🎯 TARGET ZONE 🎯', 256, 435);
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // Build the 3D GiiKER Console Device Model with 3D Raised Boundaries & Highlighted Goal Target
  buildConsoleChassis() {
    if (this.boardGroup) {
      this.scene.remove(this.boardGroup);
    }

    this.boardGroup = new THREE.Group();
    const boardW = this.cols * this.cellSize;
    const boardH = this.rows * this.cellSize;
    const halfW = (this.cols - 1) / 2;
    const halfH = (this.rows - 1) / 2;
    const halfBoardW = boardW / 2;
    const halfBoardH = boardH / 2;

    // Chassis Dimensions (Symmetrical, sleek handheld console body)
    const chassisW = boardW + 1.1;
    const chassisH = boardH + 1.1;
    const chassisDepth = 0.85;

    // Outer Handheld Console Body (Rounded Box)
    const caseGeo = this.createRoundedBoxGeometry(chassisW, chassisDepth, chassisH, 0.28, 4);
    const caseMat = new THREE.MeshPhysicalMaterial({
      color: '#131620',
      roughness: 0.52,
      metalness: 0.1,
      clearcoat: 0.15,
      clearcoatRoughness: 0.3
    });
    this.consoleCase = new THREE.Mesh(caseGeo, caseMat);
    this.consoleCase.position.set(0, -chassisDepth / 2 - 0.05, 0);
    this.consoleCase.receiveShadow = true;
    this.boardGroup.add(this.consoleCase);

    // Recessed Playfield Tray
    const trayGeo = this.createRoundedBoxGeometry(boardW + 0.08, 0.35, boardH + 0.08, 0.06, 3);
    const trayMat = new THREE.MeshStandardMaterial({
      color: '#0a0d14',
      roughness: 0.8,
      metalness: 0.05
    });
    const trayMesh = new THREE.Mesh(trayGeo, trayMat);
    trayMesh.position.set(0, -0.175, 0);
    trayMesh.receiveShadow = true;
    this.boardGroup.add(trayMesh);

    // 3D Raised Perimeter Boundaries (Walls / Bezels) around the playfield
    const wallThick = 0.34;
    const wallH = 0.44; // Raised above piece height so pieces slide inside a recessed tactile pocket
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: '#1c2130',
      roughness: 0.36,
      metalness: 0.12,
      clearcoat: 0.28,
      clearcoatRoughness: 0.2
    });

    const goalPiece = this.pieces.find(p => p.isGoal);
    const goalW = goalPiece?.w || 2;
    const goalH = goalPiece?.h || 2;
    const exitW = goalW * this.cellSize;
    const exitH = goalH * this.cellSize;
    const exitCenterX = (this.exit.x + goalW / 2 - 0.5 - halfW) * this.cellSize;
    const exitCenterZ = (this.exit.y + goalH / 2 - 0.5 - halfH) * this.cellSize;
    const isBottomExit = this.exit.y >= this.rows - goalH;
    const isTopExit = this.exit.y <= 0;

    // Left Boundary Wall
    const leftWallGeo = this.createRoundedBoxGeometry(wallThick, wallH, boardH + wallThick * 2, 0.06, 3);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-halfBoardW - wallThick / 2, wallH / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    this.boardGroup.add(leftWall);

    // Right Boundary Wall
    const rightWallGeo = this.createRoundedBoxGeometry(wallThick, wallH, boardH + wallThick * 2, 0.06, 3);
    const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
    rightWall.position.set(halfBoardW + wallThick / 2, wallH / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    this.boardGroup.add(rightWall);

    // Top Boundary Wall (with notch if top exit)
    if (isTopExit) {
      const topSeg1W = (exitCenterX - exitW / 2) - (-halfBoardW);
      if (topSeg1W > 0.05) {
        const topSeg1 = new THREE.Mesh(this.createRoundedBoxGeometry(topSeg1W, wallH, wallThick, 0.05, 3), wallMat);
        topSeg1.position.set(-halfBoardW + topSeg1W / 2, wallH / 2, -halfBoardH - wallThick / 2);
        topSeg1.castShadow = true;
        this.boardGroup.add(topSeg1);
      }
      const topSeg2W = halfBoardW - (exitCenterX + exitW / 2);
      if (topSeg2W > 0.05) {
        const topSeg2 = new THREE.Mesh(this.createRoundedBoxGeometry(topSeg2W, wallH, wallThick, 0.05, 3), wallMat);
        topSeg2.position.set(halfBoardW - topSeg2W / 2, wallH / 2, -halfBoardH - wallThick / 2);
        topSeg2.castShadow = true;
        this.boardGroup.add(topSeg2);
      }
    } else {
      const topWallGeo = this.createRoundedBoxGeometry(boardW, wallH, wallThick, 0.05, 3);
      const topWall = new THREE.Mesh(topWallGeo, wallMat);
      topWall.position.set(0, wallH / 2, -halfBoardH - wallThick / 2);
      topWall.castShadow = true;
      topWall.receiveShadow = true;
      this.boardGroup.add(topWall);
    }

    // Bottom Boundary Wall (with Escape Gate Notch opening if bottom exit)
    if (isBottomExit) {
      const btmSeg1W = (exitCenterX - exitW / 2) - (-halfBoardW);
      if (btmSeg1W > 0.05) {
        const btmSeg1 = new THREE.Mesh(this.createRoundedBoxGeometry(btmSeg1W, wallH, wallThick, 0.05, 3), wallMat);
        btmSeg1.position.set(-halfBoardW + btmSeg1W / 2, wallH / 2, halfBoardH + wallThick / 2);
        btmSeg1.castShadow = true;
        this.boardGroup.add(btmSeg1);
      }
      const btmSeg2W = halfBoardW - (exitCenterX + exitW / 2);
      if (btmSeg2W > 0.05) {
        const btmSeg2 = new THREE.Mesh(this.createRoundedBoxGeometry(btmSeg2W, wallH, wallThick, 0.05, 3), wallMat);
        btmSeg2.position.set(halfBoardW - btmSeg2W / 2, wallH / 2, halfBoardH + wallThick / 2);
        btmSeg2.castShadow = true;
        this.boardGroup.add(btmSeg2);
      }

      // Exit Notch Gate Threshold Plate with glowing directional chevrons
      const rampGeo = new THREE.BoxGeometry(exitW - 0.06, 0.04, wallThick + 0.1);
      const rampMat = new THREE.MeshStandardMaterial({
        color: '#ef233c',
        emissive: '#ef233c',
        emissiveIntensity: 0.85,
        roughness: 0.25
      });
      const exitRamp = new THREE.Mesh(rampGeo, rampMat);
      exitRamp.position.set(exitCenterX, 0.02, halfBoardH + wallThick / 2);
      exitRamp.receiveShadow = true;
      this.boardGroup.add(exitRamp);

      // 3 Directional Chevron Arrows pointing outward through gate
      for (let i = -1; i <= 1; i++) {
        const chevGeo = new THREE.BoxGeometry(0.12, 0.02, 0.035);
        const chevMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
        const c1 = new THREE.Mesh(chevGeo, chevMat);
        c1.rotation.y = Math.PI / 4;
        c1.position.set(exitCenterX + i * 0.28 - 0.04, 0.045, halfBoardH + wallThick / 2);
        const c2 = new THREE.Mesh(chevGeo, chevMat);
        c2.rotation.y = -Math.PI / 4;
        c2.position.set(exitCenterX + i * 0.28 + 0.04, 0.045, halfBoardH + wallThick / 2);
        this.boardGroup.add(c1);
        this.boardGroup.add(c2);
      }
    } else {
      const btmWallGeo = this.createRoundedBoxGeometry(boardW, wallH, wallThick, 0.05, 3);
      const btmWall = new THREE.Mesh(btmWallGeo, wallMat);
      btmWall.position.set(0, wallH / 2, halfBoardH + wallThick / 2);
      btmWall.castShadow = true;
      btmWall.receiveShadow = true;
      this.boardGroup.add(btmWall);
    }

    // Board Grid Sockets / Indents with subtle beveled wells
    const gridHelperGroup = new THREE.Group();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = (c - halfW) * this.cellSize;
        const z = (r - halfH) * this.cellSize;
        const socketGeo = new THREE.PlaneGeometry(this.cellSize - 0.06, this.cellSize - 0.06);
        const socketMat = new THREE.MeshBasicMaterial({
          color: '#10141f',
          depthWrite: false
        });
        const socket = new THREE.Mesh(socketGeo, socketMat);
        socket.rotation.x = -Math.PI / 2;
        socket.position.set(x, 0.003, z);
        socket.receiveShadow = true;
        gridHelperGroup.add(socket);
      }
    }
    this.boardGroup.add(gridHelperGroup);

    // ========================================================
    // BOLD 3D GOAL HIGHLIGHT LINES & WALL EXIT POSTS
    // Raised glowing neon goal lines, finish gate threshold, corner reticles & posts
    // ========================================================
    this.buildGoalHighlightElements(exitCenterX, exitCenterZ, exitW, exitH, isBottomExit, isTopExit);

    this.scene.add(this.boardGroup);
  }

  buildGoalHighlightElements(exitCenterX, exitCenterZ, exitW, exitH, isBottomExit, isTopExit) {
    if (this.goalLinesGroup && this.boardGroup) {
      this.boardGroup.remove(this.goalLinesGroup);
    }
    this.goalLinesGroup = new THREE.Group();

    const mode = this.goalHighlightColor || 'duo';
    const isGreen = mode === 'green';
    const isRed = mode === 'red';

    const primColor = isGreen ? '#06d6a0' : '#ff1e42';
    const gateColor = isRed ? '#ff1e42' : '#06d6a0';
    const bracketColor = isGreen ? '#55ff99' : (isRed ? '#ffffff' : '#00f59b');

    // 1. Floor Target Mesh with high-contrast canvas texture
    const targetTex = this.createGoalTargetTexture(isBottomExit);
    const targetGeo = new THREE.PlaneGeometry(exitW - 0.04, exitH - 0.04);
    this.goalTargetPulseMat = new THREE.MeshStandardMaterial({
      map: targetTex,
      emissive: primColor,
      emissiveIntensity: 0.85,
      roughness: 0.22,
      metalness: 0.1
    });
    this.goalTargetMesh = new THREE.Mesh(targetGeo, this.goalTargetPulseMat);
    this.goalTargetMesh.rotation.x = -Math.PI / 2;
    this.goalTargetMesh.position.set(exitCenterX, 0.006, exitCenterZ);
    this.goalTargetMesh.receiveShadow = true;
    this.goalLinesGroup.add(this.goalTargetMesh);

    // 2. Bold, Raised 3D Neon Goal Perimeter Lines on the Board Floor
    const lineThick = 0.075; // Generous, bold line thickness (unmistakable on board)
    const lineH = 0.024;    // Raised above floor
    const lineY = 0.012;

    const primMat = new THREE.MeshStandardMaterial({
      color: primColor,
      emissive: primColor,
      emissiveIntensity: 1.6,
      roughness: 0.18
    });
    const gateMat = new THREE.MeshStandardMaterial({
      color: gateColor,
      emissive: gateColor,
      emissiveIntensity: 1.8,
      roughness: 0.15
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: bracketColor,
      emissive: bracketColor,
      emissiveIntensity: 1.7,
      roughness: 0.15
    });

    const hGeo = new THREE.BoxGeometry(exitW + lineThick, lineH, lineThick);
    const vGeo = new THREE.BoxGeometry(lineThick, lineH, exitH + lineThick);

    // Top Goal Line
    const topBar = new THREE.Mesh(hGeo, isTopExit ? gateMat : primMat);
    topBar.position.set(exitCenterX, lineY, exitCenterZ - exitH / 2);
    this.goalLinesGroup.add(topBar);

    // Bottom Goal Line (Gate threshold line)
    const btmBar = new THREE.Mesh(hGeo, isBottomExit ? gateMat : primMat);
    btmBar.position.set(exitCenterX, lineY, exitCenterZ + exitH / 2);
    this.goalLinesGroup.add(btmBar);

    // Left Goal Line
    const leftBar = new THREE.Mesh(vGeo, primMat);
    leftBar.position.set(exitCenterX - exitW / 2, lineY, exitCenterZ);
    this.goalLinesGroup.add(leftBar);

    // Right Goal Line
    const rightBar = new THREE.Mesh(vGeo, primMat);
    rightBar.position.set(exitCenterX + exitW / 2, lineY, exitCenterZ);
    this.goalLinesGroup.add(rightBar);

    // 3. Four Glowing Corner L-Brackets capping the goal zone
    const bracketArmLen = Math.min(0.24, exitW / 4);
    const armGeoH = new THREE.BoxGeometry(bracketArmLen, lineH + 0.008, lineThick + 0.02);
    const armGeoV = new THREE.BoxGeometry(lineThick + 0.02, lineH + 0.008, bracketArmLen);

    const corners = [
      { x: exitCenterX - exitW / 2, z: exitCenterZ - exitH / 2, sx: 1, sz: 1 },
      { x: exitCenterX + exitW / 2, z: exitCenterZ - exitH / 2, sx: -1, sz: 1 },
      { x: exitCenterX - exitW / 2, z: exitCenterZ + exitH / 2, sx: 1, sz: -1 },
      { x: exitCenterX + exitW / 2, z: exitCenterZ + exitH / 2, sx: -1, sz: -1 }
    ];

    corners.forEach(c => {
      const bh = new THREE.Mesh(armGeoH, accentMat);
      bh.position.set(c.x + c.sx * (bracketArmLen / 2), lineY + 0.004, c.z);
      const bv = new THREE.Mesh(armGeoV, accentMat);
      bv.position.set(c.x, lineY + 0.004, c.z + c.sz * (bracketArmLen / 2));
      this.goalLinesGroup.add(bh);
      this.goalLinesGroup.add(bv);
    });

    // 4. Internal Goal Grid Crosshair Divider Lines (for 2x2 or larger multi-cell goal)
    const goalPiece = this.pieces.find(p => p.isGoal);
    const gw = goalPiece?.w || 2;
    const gh = goalPiece?.h || 2;
    const innerMat = new THREE.MeshStandardMaterial({
      color: gateColor,
      emissive: gateColor,
      emissiveIntensity: 0.85,
      roughness: 0.3
    });

    if (gw > 1) {
      for (let i = 1; i < gw; i++) {
        const divX = exitCenterX - exitW / 2 + i * this.cellSize;
        const divGeo = new THREE.BoxGeometry(0.028, lineH * 0.7, exitH - 0.08);
        const divMesh = new THREE.Mesh(divGeo, innerMat);
        divMesh.position.set(divX, lineY * 0.8, exitCenterZ);
        this.goalLinesGroup.add(divMesh);
      }
    }
    if (gh > 1) {
      for (let j = 1; j < gh; j++) {
        const divZ = exitCenterZ - exitH / 2 + j * this.cellSize;
        const divGeo = new THREE.BoxGeometry(exitW - 0.08, lineH * 0.7, 0.028);
        const divMesh = new THREE.Mesh(divGeo, innerMat);
        divMesh.position.set(exitCenterX, lineY * 0.8, divZ);
        this.goalLinesGroup.add(divMesh);
      }
    }

    // 5. Vertical Goal Post Pillars at Wall Escape Gate Notch
    const boardH = this.rows * this.cellSize;
    const halfBoardH = boardH / 2;
    const wallThick = 0.34;
    const wallH = 0.44;

    if (isBottomExit) {
      const postGeo = new THREE.BoxGeometry(0.06, wallH + 0.04, 0.08);
      const postLeft = new THREE.Mesh(postGeo, gateMat);
      postLeft.position.set(exitCenterX - exitW / 2, wallH / 2, halfBoardH + wallThick / 2);
      const postRight = new THREE.Mesh(postGeo, gateMat);
      postRight.position.set(exitCenterX + exitW / 2, wallH / 2, halfBoardH + wallThick / 2);
      this.goalLinesGroup.add(postLeft);
      this.goalLinesGroup.add(postRight);
    }

    this.boardGroup.add(this.goalLinesGroup);

    // 6. Point Light directly above Goal Target
    if (this.exitLight) {
      this.exitLight.color.set(isGreen ? '#06d6a0' : '#ff1e42');
      this.exitLight.intensity = 1.6;
      this.exitLight.distance = 4.0;
      this.exitLight.position.set(exitCenterX, 0.45, exitCenterZ);
    }
  }

  refreshGoalHighlight() {
    if (!this.boardGroup) return;
    const goalPiece = this.pieces.find(p => p.isGoal);
    const goalW = goalPiece?.w || 2;
    const gh = goalPiece?.h || 2;
    const halfW = (this.cols - 1) / 2;
    const halfH = (this.rows - 1) / 2;
    const exitW = goalW * this.cellSize;
    const exitH = gh * this.cellSize;
    const exitCenterX = (this.exit.x + goalW / 2 - 0.5 - halfW) * this.cellSize;
    const exitCenterZ = (this.exit.y + gh / 2 - 0.5 - halfH) * this.cellSize;
    const isBottomExit = this.exit.y >= this.rows - gh;
    const isTopExit = this.exit.y <= 0;

    this.buildGoalHighlightElements(exitCenterX, exitCenterZ, exitW, exitH, isBottomExit, isTopExit);
  }

  setGoalHighlightColor(color) {
    this.goalHighlightColor = color;
    localStorage.setItem('giiker_goal_color', color);
    this.refreshGoalHighlight();
    this.updateGoalColorUI();
    this.drawMonitorRadar();
    if (window.giikerAudio) window.giikerAudio.playBtnClick();
  }

  toggleGoalHighlightColor() {
    const modes = ['duo', 'green', 'red'];
    const curIdx = modes.indexOf(this.goalHighlightColor);
    const nextMode = modes[(curIdx + 1) % modes.length];
    this.setGoalHighlightColor(nextMode);
  }

  updateGoalColorUI() {
    const pill = document.getElementById('btn-goal-color-pill');
    const label = document.getElementById('goal-pill-label');
    if (pill) {
      pill.className = `goal-pill-btn mode-${this.goalHighlightColor}`;
    }
    if (label) {
      label.textContent = `GOAL: ${this.goalHighlightColor.toUpperCase()}`;
    }
  }

  setupLEDDisplayScreen() {
    // 3D LED screen moved to the retractable DOM Side Level Monitor
    this.updateLEDDisplay();
  }

  updateLEDDisplay(customText = null) {
    // 1. Update Monitor Header Info
    const levelElem = document.getElementById('monitor-level-id');
    if (levelElem) {
      if (this.currentLevel?.name && this.currentLevel.name !== 'Custom Creation') {
        const lvlMatch = this.currentLevel.name.match(/^Level\s+(\d+)$/i);
        if (lvlMatch) {
          levelElem.textContent = `LEVEL ${lvlMatch[1].padStart(3, '0')}`;
        } else {
          const n = this.currentLevel.name.toUpperCase();
          levelElem.textContent = n.length > 15 ? n.slice(0, 13) + '…' : n;
        }
      } else if (String(this.currentLevel?.id).startsWith('custom_')) {
        levelElem.textContent = 'CUSTOM PUZZLE';
      } else {
        levelElem.textContent = `LEVEL ${String(this.currentLevelIndex + 1).padStart(3, '0')}`;
      }
    }

    // 2. Difficulty Badge
    const diffElem = document.getElementById('monitor-level-diff');
    if (diffElem && this.currentLevel) {
      const diff = (this.currentLevel.difficulty || 'Starter').toUpperCase();
      diffElem.textContent = diff;
      diffElem.className = `monitor-diff-tag ${(this.currentLevel.difficulty || 'starter').toLowerCase()}`;
    }

    // 3. Stats Strip (Target & Live Moves)
    const minStepsElem = document.getElementById('monitor-min-steps');
    if (minStepsElem) {
      minStepsElem.textContent = this.currentLevel?.minSteps ? `${this.currentLevel.minSteps}` : '—';
    }

    const liveMovesElem = document.getElementById('monitor-live-moves');
    if (liveMovesElem) {
      liveMovesElem.textContent = this.moveCount;
    }

    // 4. Status Badge
    const statusElem = document.getElementById('monitor-status-badge');
    if (statusElem) {
      if (this.isSolved) {
        statusElem.textContent = 'SOLVED! ★';
        statusElem.className = 'radar-status solved';
      } else if (customText) {
        statusElem.textContent = customText;
        statusElem.className = 'radar-status alert';
      } else if (this.moveCount > 0) {
        statusElem.textContent = 'PLAYING';
        statusElem.className = 'radar-status active';
      } else {
        statusElem.textContent = 'READY';
        statusElem.className = 'radar-status ready';
      }
    }

    // 5. Draw 2D Mini Board Radar Canvas
    this.drawMonitorRadar(customText);
  }

  drawMonitorRadar(customText = null) {
    const canvas = document.getElementById('monitor-radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Deep tech console glass background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    // Dot-matrix grid pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let x = 4; x < w; x += 6) {
      for (let y = 4; y < h; y += 6) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const cols = this.cols || 4;
    const rows = this.rows || 5;
    const pad = 12;
    const availW = w - pad * 2;
    const availH = h - pad * 2;
    const cellDim = Math.min(availW / cols, availH / rows);
    const gridW = cols * cellDim;
    const gridH = rows * cellDim;
    const startX = pad + (availW - gridW) / 2;
    const startY = pad + (availH - gridH) / 2;

    // Grid tray background
    ctx.fillStyle = '#0f1422';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(startX - 5, startY - 5, gridW + 10, gridH + 10, 6);
      ctx.fill();
    } else {
      ctx.fillRect(startX - 5, startY - 5, gridW + 10, gridH + 10);
    }
    ctx.strokeStyle = 'rgba(0, 180, 216, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Socket wells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = startX + c * cellDim;
        const cy = startY + r * cellDim;
        ctx.fillStyle = '#0b0f1a';
        ctx.fillRect(cx + 1, cy + 1, cellDim - 2, cellDim - 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(cx + cellDim / 2, cy + cellDim / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Exit Gate Target on Radar
    if (this.exit) {
      const goalPiece = this.pieces.find(p => p.isGoal);
      const gw = goalPiece?.w || 2;
      const gh = goalPiece?.h || 2;
      const ex = startX + this.exit.x * cellDim;
      const ey = startY + this.exit.y * cellDim;
      const ew = gw * cellDim;
      const eh = gh * cellDim;

      const mode = this.goalHighlightColor || 'duo';
      const isGreen = mode === 'green';
      const isRed = mode === 'red';
      const radarBorderColor = isGreen ? '#06d6a0' : (isRed ? '#ef233c' : '#ff1e42');
      const radarGateColor = isRed ? '#ef233c' : '#06d6a0';
      const radarFill = isGreen ? 'rgba(6, 214, 160, 0.16)' : (isRed ? 'rgba(239, 35, 60, 0.16)' : 'rgba(239, 35, 60, 0.12)');

      ctx.save();
      ctx.fillStyle = radarFill;
      ctx.fillRect(ex, ey, ew, eh);

      // Solid bold neon goal perimeter line
      ctx.strokeStyle = radarBorderColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ex + 1, ey + 1, ew - 2, eh - 2);

      // Accent gate finish line
      ctx.strokeStyle = radarGateColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ex + 1, ey + eh - 1);
      ctx.lineTo(ex + ew - 1, ey + eh - 1);
      ctx.stroke();

      // High-contrast corner brackets on radar
      ctx.strokeStyle = isRed ? '#ffffff' : '#00f59b';
      ctx.lineWidth = 2;
      const rBLen = Math.min(8, ew / 4);
      // Top-left
      ctx.beginPath(); ctx.moveTo(ex + 2, ey + 2 + rBLen); ctx.lineTo(ex + 2, ey + 2); ctx.lineTo(ex + 2 + rBLen, ey + 2); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(ex + ew - 2 - rBLen, ey + 2); ctx.lineTo(ex + ew - 2, ey + 2); ctx.lineTo(ex + ew - 2, ey + 2 + rBLen); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(ex + 2, ey + eh - 2 - rBLen); ctx.lineTo(ex + 2, ey + eh - 2); ctx.lineTo(ex + 2 + rBLen, ey + eh - 2); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(ex + ew - 2 - rBLen, ey + eh - 2); ctx.lineTo(ex + ew - 2, ey + eh - 2); ctx.lineTo(ex + ew - 2, ey + eh - 2 - rBLen); ctx.stroke();

      ctx.fillStyle = radarGateColor;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▼ GATE', ex + ew / 2, ey + eh - 6);
      ctx.restore();
    }

    // Draw Pieces
    this.pieces.forEach(p => {
      const cells = this.getPieceCells(p);
      const baseColor = p.color || (p.isGoal ? '#ef233c' : '#ffb703');

      cells.forEach(c => {
        const cellX = startX + (p.x + c.dx) * cellDim + 1.5;
        const cellY = startY + (p.y + c.dy) * cellDim + 1.5;
        const cellSize = cellDim - 3;
        const radius = Math.min(4, cellSize / 5);

        ctx.save();
        ctx.fillStyle = baseColor;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(cellX, cellY, cellSize, cellSize, radius);
          ctx.fill();
        } else {
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Tactile Markings
        if (p.isGoal) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, cellSize / 3.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.isObstacle) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const d = cellSize / 3;
          ctx.moveTo(cellX + cellSize / 2 - d, cellY + cellSize / 2 - d);
          ctx.lineTo(cellX + cellSize / 2 + d, cellY + cellSize / 2 + d);
          ctx.moveTo(cellX + cellSize / 2 + d, cellY + cellSize / 2 - d);
          ctx.lineTo(cellX + cellSize / 2 - d, cellY + cellSize / 2 + d);
          ctx.stroke();
        } else if (p.w === 1 && p.h === 1) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.beginPath();
          ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.beginPath();
          ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    });

    // Alert or Celebration Banner
    if (customText) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 15, 25, 0.88)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#06d6a0';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(customText, w / 2, h / 2);
      ctx.restore();
    }
  }

  // Create rounded beveled box geometry
  createRoundedBoxGeometry(w, h, d, radius, segments) {
    const shape = new THREE.Shape();
    const x = -w / 2;
    const y = -d / 2;
    const rx = radius;

    shape.moveTo(x + rx, y);
    shape.lineTo(x + w - rx, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + rx);
    shape.lineTo(x + w, y + d - rx);
    shape.quadraticCurveTo(x + w, y + d, x + w - rx, y + d);
    shape.lineTo(x + rx, y + d);
    shape.quadraticCurveTo(x, y + d, x, y + d - rx);
    shape.lineTo(x, y + rx);
    shape.quadraticCurveTo(x, y, x + rx, y);

    const extrudeSettings = {
      depth: h,
      bevelEnabled: true,
      bevelSegments: segments,
      steps: 1,
      bevelSize: rx * 0.4,
      bevelThickness: rx * 0.4
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    geo.rotateX(Math.PI / 2);
    return geo;
  }

  // Build the 3D piece meshes
  buildPieceMeshes() {
    // Clean old piece meshes
    this.pieceMeshes.forEach(mesh => {
      this.boardGroup.remove(mesh);
    });
    this.pieceMeshes.clear();

    const halfW = (this.cols - 1) / 2;
    const halfH = (this.rows - 1) / 2;
    const pieceH = this.pieceHeight;

    this.pieces.forEach(p => {
      const pieceGroup = new THREE.Group();
      pieceGroup.userData = { pieceId: p.id, piece: p };

      const cells = this.getPieceCells(p);
      const isRect = (!p.cells || p.cells.length === p.w * p.h) && p.type !== 'polyomino';

      // Tactile physical candy / plastic material
      const mat = new THREE.MeshPhysicalMaterial({
        color: p.color || '#ffb703',
        roughness: p.isObstacle ? 0.8 : (p.isGoal ? 0.16 : 0.22),
        metalness: p.isObstacle ? 0.3 : 0.06,
        clearcoat: p.isObstacle ? 0.0 : 0.5,
        clearcoatRoughness: 0.15,
        reflectivity: 0.7
      });

      if (isRect) {
        // Standard rectangular piece
        const pieceW = p.w * this.cellSize - this.pieceGap * 2;
        const pieceD = p.h * this.cellSize - this.pieceGap * 2;
        const geo = this.createRoundedBoxGeometry(pieceW, pieceH, pieceD, 0.08, 3);
        const bodyMesh = new THREE.Mesh(geo, mat);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        pieceGroup.add(bodyMesh);

        // Decorative tactile relief details on piece top:
        if (p.isGoal) {
          const ringGeo = new THREE.TorusGeometry(0.32, 0.045, 12, 32);
          const ringMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, metalness: 0.1 });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = pieceH / 2 + 0.02;
          pieceGroup.add(ring);

          const dotGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16);
          const dot = new THREE.Mesh(dotGeo, ringMat);
          dot.position.y = pieceH / 2 + 0.02;
          pieceGroup.add(dot);
        } else if (p.type === 'horizontal') {
          // Double tactile ridges running horizontally lengthwise along the piece (X axis)
          const pillGeo = new THREE.CylinderGeometry(0.03, 0.03, pieceW * 0.62, 16);
          pillGeo.rotateZ(Math.PI / 2); // Lies flat lengthwise along X axis
          const pillMat = new THREE.MeshStandardMaterial({ color: '#ffe49e', roughness: 0.25, metalness: 0.1 });
          const p1 = new THREE.Mesh(pillGeo, pillMat);
          p1.position.set(0, pieceH / 2 + 0.008, -0.12);
          const p2 = new THREE.Mesh(pillGeo, pillMat);
          p2.position.set(0, pieceH / 2 + 0.008, 0.12);
          pieceGroup.add(p1);
          pieceGroup.add(p2);
        } else if (p.type === 'vertical') {
          // Double tactile ridges running vertically lengthwise along the piece (Z axis) - perfectly parallel, lying flat
          const ridgeGeo = new THREE.CylinderGeometry(0.03, 0.03, pieceD * 0.62, 16);
          ridgeGeo.rotateX(Math.PI / 2); // Rotated to lie flat along Z axis lengthwise!
          const ridgeMat = new THREE.MeshStandardMaterial({ color: '#cce3de', roughness: 0.25, metalness: 0.1 });
          const r1 = new THREE.Mesh(ridgeGeo, ridgeMat);
          r1.position.set(-0.12, pieceH / 2 + 0.008, 0);
          const r2 = new THREE.Mesh(ridgeGeo, ridgeMat);
          r2.position.set(0.12, pieceH / 2 + 0.008, 0);
          pieceGroup.add(r1);
          pieceGroup.add(r2);
        } else if (p.type === 'single') {
          const domeGeo = new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
          const domeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 });
          const dome = new THREE.Mesh(domeGeo, domeMat);
          dome.position.y = pieceH / 2;
          pieceGroup.add(dome);
        } else if (p.isObstacle) {
          const xMat = new THREE.MeshBasicMaterial({ color: '#adb5bd' });
          const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.08), xMat);
          b1.rotation.y = Math.PI / 4;
          b1.position.y = pieceH / 2 + 0.01;
          const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.08), xMat);
          b2.rotation.y = -Math.PI / 4;
          b2.position.y = pieceH / 2 + 0.01;
          pieceGroup.add(b1);
          pieceGroup.add(b2);
        }
      } else {
        // Non-regular Polyomino piece (L, M, T, Z, Plus, U, etc.)
        const cellBoxW = this.cellSize - this.pieceGap * 2;
        const cellGeo = this.createRoundedBoxGeometry(cellBoxW, pieceH, cellBoxW, 0.08, 3);
        const bridgeMat = mat;

        cells.forEach(c => {
          const localX = (c.dx - (p.w - 1) / 2) * this.cellSize;
          const localZ = (c.dy - (p.h - 1) / 2) * this.cellSize;

          const unitMesh = new THREE.Mesh(cellGeo, mat);
          unitMesh.position.set(localX, 0, localZ);
          unitMesh.castShadow = true;
          unitMesh.receiveShadow = true;
          pieceGroup.add(unitMesh);

          // Top tactile details
          if (p.isGoal) {
            const ringGeo = new THREE.TorusGeometry(0.24, 0.04, 12, 24);
            const ringMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(localX, pieceH / 2 + 0.02, localZ);
            pieceGroup.add(ring);
          } else if (p.isObstacle) {
            const xMat = new THREE.MeshBasicMaterial({ color: '#adb5bd' });
            const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.06), xMat);
            b1.rotation.y = Math.PI / 4;
            b1.position.set(localX, pieceH / 2 + 0.01, localZ);
            const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.06), xMat);
            b2.rotation.y = -Math.PI / 4;
            b2.position.set(localX, pieceH / 2 + 0.01, localZ);
            pieceGroup.add(b1);
            pieceGroup.add(b2);
          } else {
            const domeGeo = new THREE.SphereGeometry(0.10, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
            const domeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 });
            const dome = new THREE.Mesh(domeGeo, domeMat);
            dome.position.set(localX, pieceH / 2, localZ);
            pieceGroup.add(dome);
          }

          // Connecting bridge to adjacent cell on right
          if (cells.some(other => other.dx === c.dx + 1 && other.dy === c.dy)) {
            const bridgeX = new THREE.Mesh(
              new THREE.BoxGeometry(this.pieceGap * 2.5 + 0.08, pieceH * 0.94, cellBoxW * 0.82),
              bridgeMat
            );
            bridgeX.position.set(localX + this.cellSize / 2, 0, localZ);
            bridgeX.castShadow = true;
            bridgeX.receiveShadow = true;
            pieceGroup.add(bridgeX);
          }

          // Connecting bridge to adjacent cell below
          if (cells.some(other => other.dx === c.dx && other.dy === c.dy + 1)) {
            const bridgeZ = new THREE.Mesh(
              new THREE.BoxGeometry(cellBoxW * 0.82, pieceH * 0.94, this.pieceGap * 2.5 + 0.08),
              bridgeMat
            );
            bridgeZ.position.set(localX, 0, localZ + this.cellSize / 2);
            bridgeZ.castShadow = true;
            bridgeZ.receiveShadow = true;
            pieceGroup.add(bridgeZ);
          }
        });
      }

      // Position in world coordinates
      const worldX = (p.x + p.w / 2 - 0.5 - halfW) * this.cellSize;
      const worldZ = (p.y + p.h / 2 - 0.5 - halfH) * this.cellSize;
      pieceGroup.position.set(worldX, pieceH / 2, worldZ);

      this.boardGroup.add(pieceGroup);
      this.pieceMeshes.set(p.id, pieceGroup);
    });
  }

  // Update a piece mesh's position with optional animation
  updatePieceMeshPosition(pieceId, targetX, targetY, animate = true) {
    const mesh = this.pieceMeshes.get(pieceId);
    const piece = this.pieces.find(p => p.id === pieceId);
    if (!mesh || !piece) return;

    const halfW = (this.cols - 1) / 2;
    const halfH = (this.rows - 1) / 2;
    const pieceH = this.pieceHeight;
    const targetWorldX = (targetX + piece.w / 2 - 0.5 - halfW) * this.cellSize;
    const targetWorldZ = (targetY + piece.h / 2 - 0.5 - halfH) * this.cellSize;
    const targetWorldY = this.pieceHeight / 2;

    if (!animate) {
      mesh.position.set(targetWorldX, targetWorldY, targetWorldZ);
      return;
    }

    // Smooth spring slide animation
    const startX = mesh.position.x;
    const startZ = mesh.position.z;
    const startY = mesh.position.y;
    const startTime = performance.now();
    const duration = 140; // ms

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      mesh.position.x = startX + (targetWorldX - startX) * ease;
      mesh.position.z = startZ + (targetWorldZ - startZ) * ease;
      mesh.position.y = startY + (targetWorldY - startY) * ease;

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        mesh.position.set(targetWorldX, targetWorldY, targetWorldZ);
      }
    };
    requestAnimationFrame(step);
  }

  // Level Management
  loadLevel(index) {
    if (index < 0 || index >= this.levels.length) return;
    this.currentLevelIndex = index;
    const levelData = this.levels[index];
    this.loadLevelData(levelData);
    localStorage.setItem('giiker_current_level', index + 1);
  }

  loadLevelData(levelData) {
    this.currentLevel = levelData;
    this.cols = levelData.board?.cols || 4;
    this.rows = levelData.board?.rows || 5;
    this.exit = levelData.exit || { x: 1, y: 3 };
    this.pieces = JSON.parse(JSON.stringify(levelData.pieces));

    this.history = [];
    this.redoStack = [];
    this.moveCount = 0;
    this.hintsUsed = 0;
    this.isSolved = false;
    this.resetTimer();

    this.buildConsoleChassis();
    this.buildPieceMeshes();
    this.updateHUD();
    this.updateLEDDisplay();
    this.setCameraPreset(this.cameraPreset || 'handheld');

    if (window.giikerAudio) {
      window.giikerAudio.playLevelBeep(levelData.id || 1);
    }
  }

  // Move a piece logically and record history
  executeMove(pieceId, newX, newY, recordHistory = true) {
    const piece = this.pieces.find(p => p.id === pieceId);
    if (!piece) return false;

    const oldX = piece.x;
    const oldY = piece.y;

    if (oldX === newX && oldY === newY) return false;

    // Start timer on first move if not running
    if (!this.timerRunning && !this.isSolved) {
      this.startTimer();
    }

    piece.x = newX;
    piece.y = newY;

    if (recordHistory) {
      this.history.push({ pieceId, from: { x: oldX, y: oldY }, to: { x: newX, y: newY } });
      this.redoStack = [];
      this.moveCount++;
      if (window.giikerAudio) window.giikerAudio.playSnap();
      if (navigator.vibrate) navigator.vibrate(12);
    }

    this.updatePieceMeshPosition(pieceId, newX, newY, true);
    this.updateHUD();
    this.updateLEDDisplay();

    // Check Victory
    if (piece.isGoal && piece.x === this.exit.x && piece.y === this.exit.y) {
      this.handleVictory();
    }

    return true;
  }

  undo() {
    if (this.history.length === 0 || this.isSolved) return;
    const lastMove = this.history.pop();
    const piece = this.pieces.find(p => p.id === lastMove.pieceId);
    if (!piece) return;

    this.redoStack.push({ pieceId: piece.id, from: { x: piece.x, y: piece.y }, to: { ...lastMove.from } });
    piece.x = lastMove.from.x;
    piece.y = lastMove.from.y;
    this.moveCount = Math.max(0, this.moveCount - 1);

    this.updatePieceMeshPosition(piece.id, piece.x, piece.y, true);
    if (window.giikerAudio) window.giikerAudio.playSnap(0.9);
    this.updateHUD();
    this.updateLEDDisplay();
  }

  redo() {
    if (this.redoStack.length === 0 || this.isSolved) return;
    const nextMove = this.redoStack.pop();
    const piece = this.pieces.find(p => p.id === nextMove.pieceId);
    if (!piece) return;

    this.history.push({ pieceId: piece.id, from: { x: piece.x, y: piece.y }, to: { ...nextMove.to } });
    piece.x = nextMove.to.x;
    piece.y = nextMove.to.y;
    this.moveCount++;

    this.updatePieceMeshPosition(piece.id, piece.x, piece.y, true);
    if (window.giikerAudio) window.giikerAudio.playSnap(1.1);
    this.updateHUD();
    this.updateLEDDisplay();
  }

  resetCurrentLevel() {
    if (!this.currentLevel) return;
    this.loadLevelData(this.currentLevel);
    if (window.giikerAudio) window.giikerAudio.playReset();
  }

  // Timer Management
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerRunning = true;
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      this.updateTimerDisplay();
    }, 1000);
  }

  pauseTimer() {
    this.timerRunning = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  resetTimer() {
    this.pauseTimer();
    this.timerSeconds = 0;
    this.updateTimerDisplay();
  }

  toggleTimerVisibility() {
    this.timerVisible = !this.timerVisible;
    const timerElem = document.getElementById('stat-timer-container');
    const eyeBtn = document.getElementById('btn-toggle-timer-vis');
    if (timerElem) {
      if (this.timerVisible) {
        timerElem.classList.remove('hidden-timer');
      } else {
        timerElem.classList.add('hidden-timer');
      }
    }
    if (eyeBtn) {
      eyeBtn.textContent = this.timerVisible ? '👁️' : '🙈';
      eyeBtn.title = this.timerVisible ? 'Hide Timer (Key: T)' : 'Show Timer (Key: T)';
    }
    if (window.giikerAudio) window.giikerAudio.playBtnClick();
  }

  toggleMonitorVisibility(forceState = null) {
    if (forceState !== null) {
      this.monitorVisible = forceState;
    } else {
      this.monitorVisible = !this.monitorVisible;
    }
    const monitor = document.getElementById('side-level-monitor');
    if (monitor) {
      monitor.classList.toggle('collapsed', !this.monitorVisible);
    }
    const toggleBtn = document.getElementById('btn-toggle-monitor');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('.toggle-tab-icon');
      if (icon) icon.textContent = this.monitorVisible ? '👁️' : '🙈';
      toggleBtn.title = this.monitorVisible ? 'Hide Level Info (Key: I)' : 'Show Level Info (Key: I)';
    }
    const headerBtn = document.getElementById('btn-header-monitor-toggle');
    if (headerBtn) {
      headerBtn.classList.toggle('active', this.monitorVisible);
      headerBtn.title = this.monitorVisible ? 'Hide Level Info (Key: I)' : 'Show Level Info (Key: I)';
    }
    localStorage.setItem('giiker_monitor_collapsed', this.monitorVisible ? '0' : '1');
    if (window.giikerAudio) window.giikerAudio.playBtnClick();
  }

  switchMonitorDockSide() {
    this.monitorDockSide = this.monitorDockSide === 'right' ? 'left' : 'right';
    const monitor = document.getElementById('side-level-monitor');
    if (monitor) {
      monitor.classList.toggle('dock-right', this.monitorDockSide === 'right');
      monitor.classList.toggle('dock-left', this.monitorDockSide === 'left');
    }
    localStorage.setItem('giiker_monitor_dock', this.monitorDockSide);
    if (window.giikerAudio) window.giikerAudio.playBtnClick();
  }

  updateTimerDisplay() {
    const statTimer = document.getElementById('stat-timer');
    if (!statTimer) return;
    const mins = Math.floor(this.timerSeconds / 60);
    const secs = this.timerSeconds % 60;
    statTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Victory Handler
  handleVictory() {
    if (this.isSolved) return;
    this.isSolved = true;
    this.pauseTimer();

    if (window.giikerAudio) window.giikerAudio.playVictory();

    // Flash exit gate green
    if (this.exitGateMesh && this.exitGateMesh.material) {
      this.exitGateMesh.material.color.set('#06d6a0');
      this.exitGateMesh.material.emissive.set('#06d6a0');
      this.exitGateMesh.material.emissiveIntensity = 1.0;
    }

    // Scroll LED screen celebration
    this.updateLEDDisplay('★ CLEAR! ★');

    // Confetti burst
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 250);
    }

    // Show Victory Modal
    setTimeout(() => {
      this.showVictoryModal();
    }, 700);
  }

  showVictoryModal() {
    const modal = document.getElementById('victory-modal');
    if (!modal) return;

    const modalTitle = document.getElementById('victory-title');
    const modalTime = document.getElementById('victory-stat-time');
    const modalMoves = document.getElementById('victory-stat-moves');
    const modalOptimal = document.getElementById('victory-stat-optimal');
    const starsContainer = document.getElementById('victory-stars');

    if (modalTitle) modalTitle.textContent = `${this.currentLevel?.name || 'Level'} Cleared!`;
    const mins = Math.floor(this.timerSeconds / 60);
    const secs = this.timerSeconds % 60;
    if (modalTime) modalTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (modalMoves) modalMoves.textContent = this.moveCount;
    if (modalOptimal) modalOptimal.textContent = this.currentLevel?.minSteps || '—';

    // Star calculation
    const optimal = this.currentLevel?.minSteps || 10;
    let stars = 3;
    if (this.moveCount > optimal * 1.5 || this.hintsUsed > 0) stars = 2;
    if (this.moveCount > optimal * 2.2 || this.hintsUsed > 1) stars = 1;

    if (starsContainer) {
      starsContainer.innerHTML = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    }

    modal.classList.add('active');
  }

  // Interactive Dragging and Controls
  calculateAllowedBounds(piece) {
    // Determine how far this piece can slide in all 4 directions into empty spaces
    const bounds = {
      minX: piece.x,
      maxX: piece.x,
      minY: piece.y,
      maxY: piece.y
    };

    // Grid occupancy excluding this piece
    const grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    this.pieces.forEach(p => {
      if (p.id === piece.id) return;
      const pCells = this.getPieceCells(p);
      pCells.forEach(c => {
        const px = p.x + c.dx;
        const py = p.y + c.dy;
        if (py >= 0 && py < this.rows && px >= 0 && px < this.cols) {
          grid[py][px] = true;
        }
      });
    });

    const myCells = this.getPieceCells(piece);

    // Check Left
    for (let nx = piece.x - 1; nx >= 0; nx--) {
      let blocked = false;
      for (const c of myCells) {
        const cellX = nx + c.dx;
        const cellY = piece.y + c.dy;
        if (cellX < 0 || grid[cellY][cellX]) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      bounds.minX = nx;
    }

    // Check Right
    for (let nx = piece.x + 1; nx + piece.w <= this.cols; nx++) {
      let blocked = false;
      for (const c of myCells) {
        const cellX = nx + c.dx;
        const cellY = piece.y + c.dy;
        if (cellX >= this.cols || grid[cellY][cellX]) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      bounds.maxX = nx;
    }

    // Check Up
    for (let ny = piece.y - 1; ny >= 0; ny--) {
      let blocked = false;
      for (const c of myCells) {
        const cellX = piece.x + c.dx;
        const cellY = ny + c.dy;
        if (cellY < 0 || grid[cellY][cellX]) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      bounds.minY = ny;
    }

    // Check Down
    for (let ny = piece.y + 1; ny + piece.h <= this.rows; ny++) {
      let blocked = false;
      for (const c of myCells) {
        const cellX = piece.x + c.dx;
        const cellY = ny + c.dy;
        if (cellY >= this.rows || grid[cellY][cellX]) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      bounds.maxY = ny;
    }

    return bounds;
  }

  onPointerDown(event) {
    if (this.isSolved) return;
    // Don't intercept if clicking UI elements
    if (event.target !== this.renderer.domElement) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.pointerDownPos = { x: event.clientX, y: event.clientY };
    this.pointerDownTime = performance.now();

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = Array.from(this.pieceMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      // Find top-level piece group
      let group = intersects[0].object;
      while (group.parent && !group.userData?.pieceId) {
        group = group.parent;
      }

      if (group.userData?.pieceId) {
        const piece = group.userData.piece;
        if (piece.isObstacle) {
          if (window.giikerAudio) window.giikerAudio.playBump();
          return; // Immovable
        }

        this.isDragging = true;
        this.draggedPiece = piece;
        this.selectedPieceId = piece.id;
        this.dragStartGridPos = { x: piece.x, y: piece.y };
        this.dragAllowedBounds = this.calculateAllowedBounds(piece);

        // Disable OrbitControls while dragging pieces
        if (this.controls) this.controls.enabled = false;

        // Lift piece slightly for tactile grabbed sensation
        group.position.y = this.pieceHeight / 2 + 0.14;

        // Record plane intersect hit point
        this.raycaster.ray.intersectPlane(this.boardPlane, this.dragStartHitPoint);

        if (window.giikerAudio) window.giikerAudio.playSlide(1.2);
      }
    }
  }

  onPointerMove(event) {
    if (!this.isDragging || !this.draggedPiece) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.boardPlane, this.planeIntersect)) return;

    const halfW = (this.cols - 1) / 2;
    const halfH = (this.rows - 1) / 2;
    const pieceH = this.pieceHeight;

    // Displacement in world board units
    const deltaX = (this.planeIntersect.x - this.dragStartHitPoint.x) / this.cellSize;
    const deltaZ = (this.planeIntersect.z - this.dragStartHitPoint.z) / this.cellSize;

    const mesh = this.pieceMeshes.get(this.draggedPiece.id);
    if (!mesh) return;

    // Constrain to orthogonal sliding along allowed axis
    const p = this.draggedPiece;
    const bounds = this.dragAllowedBounds;

    let targetGridX = this.dragStartGridPos.x;
    let targetGridY = this.dragStartGridPos.y;

    if (Math.abs(deltaX) >= Math.abs(deltaZ)) {
      // Primary horizontal motion
      const rawX = this.dragStartGridPos.x + deltaX;
      targetGridX = Math.max(bounds.minX, Math.min(bounds.maxX, rawX));
    } else {
      // Primary vertical motion
      const rawY = this.dragStartGridPos.y + deltaZ;
      targetGridY = Math.max(bounds.minY, Math.min(bounds.maxY, rawY));
    }

    const worldX = (targetGridX + p.w / 2 - 0.5 - halfW) * this.cellSize;
    const worldZ = (targetGridY + p.h / 2 - 0.5 - halfH) * this.cellSize;

    mesh.position.x = worldX;
    mesh.position.z = worldZ;
  }

  onPointerUp(event) {
    if (!this.isDragging || !this.draggedPiece) {
      if (this.controls) this.controls.enabled = true;
      return;
    }

    const piece = this.draggedPiece;
    const mesh = this.pieceMeshes.get(piece.id);

    // Compute drag distance
    const dist = Math.hypot(event.clientX - this.pointerDownPos.x, event.clientY - this.pointerDownPos.y);
    const duration = performance.now() - this.pointerDownTime;

    if (dist < 10 && duration < 300) {
      // This was a quick click / tap!
      this.handlePieceTap(piece);
    } else {
      // Convert current mesh position back to closest integer grid
      const halfW = (this.cols - 1) / 2;
      const halfH = (this.rows - 1) / 2;
      const rawGridX = (mesh.position.x / this.cellSize) - piece.w / 2 + 0.5 + halfW;
      const rawGridY = (mesh.position.z / this.cellSize) - piece.h / 2 + 0.5 + halfH;

      const snappedX = Math.round(rawGridX);
      const snappedY = Math.round(rawGridY);

      const bounds = this.dragAllowedBounds;
      const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, snappedX));
      const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, snappedY));

      if (clampedX !== this.dragStartGridPos.x || clampedY !== this.dragStartGridPos.y) {
        this.executeMove(piece.id, clampedX, clampedY, true);
      } else {
        this.updatePieceMeshPosition(piece.id, piece.x, piece.y, true);
      }
    }

    this.isDragging = false;
    this.draggedPiece = null;
    if (this.controls) this.controls.enabled = true;
  }

  // Quick tap-to-slide: automatically slides into open space if single adjacent opening exists
  handlePieceTap(piece) {
    const bounds = this.calculateAllowedBounds(piece);
    const possibleMoves = [];

    if (bounds.minX < piece.x) possibleMoves.push({ x: piece.x - 1, y: piece.y, dir: 'left' });
    if (bounds.maxX > piece.x) possibleMoves.push({ x: piece.x + 1, y: piece.y, dir: 'right' });
    if (bounds.minY < piece.y) possibleMoves.push({ x: piece.x, y: piece.y - 1, dir: 'up' });
    if (bounds.maxY > piece.y) possibleMoves.push({ x: piece.x, y: piece.y + 1, dir: 'down' });

    if (possibleMoves.length === 1) {
      // Unambiguous move!
      this.executeMove(piece.id, possibleMoves[0].x, possibleMoves[0].y, true);
    } else if (possibleMoves.length > 1) {
      // Pick first open direction or toward exit
      const targetMove = piece.isGoal ? possibleMoves.find(m => m.dir === 'down') || possibleMoves[0] : possibleMoves[0];
      this.executeMove(piece.id, targetMove.x, targetMove.y, true);
    } else {
      // Nowhere to move
      if (window.giikerAudio) window.giikerAudio.playBump();
      this.updatePieceMeshPosition(piece.id, piece.x, piece.y, true);
    }
  }

  // Keyboard navigation
  onKeyDown(event) {
    const key = event.key.toLowerCase();

    // Prevent default scrolling for game keys
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(key)) {
      event.preventDefault();
    }

    if (key === 'z' && (event.ctrlKey || event.metaKey)) {
      this.undo();
      return;
    }
    if (key === 'y' && (event.ctrlKey || event.metaKey)) {
      this.redo();
      return;
    }
    if (key === 'r') {
      this.resetCurrentLevel();
      return;
    }
    if (key === 't') {
      this.toggleTimerVisibility();
      return;
    }
    if (key === 'i' || key === 'm') {
      this.toggleMonitorVisibility();
      return;
    }
    if (key === 'g') {
      this.toggleGoalHighlightColor();
      return;
    }
    if (key === 'h') {
      this.giveHint();
      return;
    }
    if (key === ' ') {
      // Toggle camera presets
      this.cycleCameraView();
      return;
    }

    // Move selected piece with arrow keys / WASD
    if (this.selectedPieceId) {
      const piece = this.pieces.find(p => p.id === this.selectedPieceId);
      if (!piece) return;

      const bounds = this.calculateAllowedBounds(piece);
      if ((key === 'arrowleft' || key === 'a') && bounds.minX < piece.x) {
        this.executeMove(piece.id, piece.x - 1, piece.y, true);
      } else if ((key === 'arrowright' || key === 'd') && bounds.maxX > piece.x) {
        this.executeMove(piece.id, piece.x + 1, piece.y, true);
      } else if ((key === 'arrowup' || key === 'w') && bounds.minY < piece.y) {
        this.executeMove(piece.id, piece.x, piece.y - 1, true);
      } else if ((key === 'arrowdown' || key === 's') && bounds.maxY > piece.y) {
        this.executeMove(piece.id, piece.x, piece.y + 1, true);
      }
    }
  }

  cycleCameraView() {
    if (!this.camState) this.camState = 0;
    this.camState = (this.camState + 1) % 3;
    const presets = ['handheld', 'topdown', 'isometric'];
    this.setCameraPreset(presets[this.camState]);
    if (window.giikerAudio) window.giikerAudio.playBtnClick();
  }

  // Hint & Auto-Solve System
  giveHint() {
    if (this.isSolved || !window.giikerSolver) return;

    const hintMove = window.giikerSolver.getHint(this.pieces, this.cols, this.rows, this.exit);
    if (!hintMove) {
      alert('No valid moves found to solve the board from this state.');
      return;
    }

    this.hintsUsed++;
    if (window.giikerAudio) window.giikerAudio.playHint();

    // Pulse the piece mesh color
    const mesh = this.pieceMeshes.get(hintMove.pieceId);
    if (mesh) {
      mesh.position.y += 0.12;
      setTimeout(() => {
        this.executeMove(hintMove.pieceId, hintMove.to.x, hintMove.to.y, true);
      }, 160);
    } else {
      this.executeMove(hintMove.pieceId, hintMove.to.x, hintMove.to.y, true);
    }
  }

  toggleAutoSolve() {
    if (this.isAutoSolving) {
      this.stopAutoSolve();
    } else {
      this.startAutoSolve();
    }
  }

  startAutoSolve() {
    if (this.isSolved || !window.giikerSolver) return;

    const res = window.giikerSolver.solve(this.pieces, this.cols, this.rows, this.exit);
    if (!res.solved || res.moves.length === 0) {
      alert('Cannot auto-solve: ' + (res.reason || 'No solution found'));
      return;
    }

    this.isAutoSolving = true;
    const btnSolve = document.getElementById('btn-solve');
    if (btnSolve) {
      btnSolve.classList.add('solving');
      btnSolve.innerHTML = '<span>⏹️</span> <span>Stop</span>';
    }

    let moveIdx = 0;
    const playNext = () => {
      if (!this.isAutoSolving || moveIdx >= res.moves.length || this.isSolved) {
        this.stopAutoSolve();
        return;
      }

      const m = res.moves[moveIdx++];
      this.executeMove(m.pieceId, m.to.x, m.to.y, true);
      this.autoSolveTimer = setTimeout(playNext, 220); // 220ms step speed
    };

    playNext();
  }

  stopAutoSolve() {
    this.isAutoSolving = false;
    if (this.autoSolveTimer) clearTimeout(this.autoSolveTimer);
    const btnSolve = document.getElementById('btn-solve');
    if (btnSolve) {
      btnSolve.classList.remove('solving');
      btnSolve.innerHTML = '<span class="tool-icon">⚡</span> <span>Auto Solve</span>';
    }
  }

  // Setup DOM Event Listeners & HUD
  setupEventListeners() {
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('keydown', this.onKeyDown);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);

    // Header buttons
    document.getElementById('btn-prev-level')?.addEventListener('click', () => {
      this.loadLevel(this.currentLevelIndex - 1);
    });
    document.getElementById('btn-next-level')?.addEventListener('click', () => {
      this.loadLevel(this.currentLevelIndex + 1);
    });
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.resetCurrentLevel();
    });
    document.getElementById('btn-undo')?.addEventListener('click', () => {
      this.undo();
    });
    document.getElementById('btn-redo')?.addEventListener('click', () => {
      this.redo();
    });
    document.getElementById('btn-hint')?.addEventListener('click', () => {
      this.giveHint();
    });
    document.getElementById('btn-solve')?.addEventListener('click', () => {
      this.toggleAutoSolve();
    });
    document.getElementById('btn-open-studio')?.addEventListener('click', () => {
      if (this.studio) this.studio.open();
    });
    document.getElementById('btn-open-levels')?.addEventListener('click', () => {
      this.openLevelBrowser();
    });
    document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
      this.toggleSound();
    });
    document.getElementById('btn-toggle-fullscreen')?.addEventListener('click', () => {
      this.toggleFullscreen();
    });
    document.getElementById('btn-toggle-timer-vis')?.addEventListener('click', () => {
      this.toggleTimerVisibility();
    });
    document.getElementById('btn-cam-view')?.addEventListener('click', () => {
      this.cycleCameraView();
    });

    // Side Level Monitor HUD controls
    document.getElementById('btn-toggle-monitor')?.addEventListener('click', () => {
      this.toggleMonitorVisibility();
    });
    document.getElementById('btn-hide-monitor')?.addEventListener('click', () => {
      this.toggleMonitorVisibility(false);
    });
    document.getElementById('btn-dock-switch')?.addEventListener('click', () => {
      this.switchMonitorDockSide();
    });
    document.getElementById('btn-header-monitor-toggle')?.addEventListener('click', () => {
      this.toggleMonitorVisibility();
    });

    // Goal line highlight color toggle
    document.getElementById('btn-goal-color-pill')?.addEventListener('click', () => {
      this.toggleGoalHighlightColor();
    });
    document.getElementById('btn-goal-color-toggle')?.addEventListener('click', () => {
      this.toggleGoalHighlightColor();
    });

    // Victory modal buttons
    document.getElementById('btn-victory-next')?.addEventListener('click', () => {
      document.getElementById('victory-modal')?.classList.remove('active');
      this.loadLevel(this.currentLevelIndex + 1);
    });
    document.getElementById('btn-victory-replay')?.addEventListener('click', () => {
      document.getElementById('victory-modal')?.classList.remove('active');
      this.resetCurrentLevel();
    });
  }

  initHUD() {
    // Populate level select
    const levelSelect = document.getElementById('level-select');
    if (levelSelect && this.levels.length > 0) {
      levelSelect.innerHTML = this.levels.map((lvl, idx) => `
        <option value="${idx}">Lvl ${lvl.id}: ${lvl.name} (${lvl.difficulty})</option>
      `).join('');

      levelSelect.addEventListener('change', (e) => {
        this.loadLevel(parseInt(e.target.value));
      });
    }

    this.updateSoundBtn();

    // Initialize Side Level Monitor HUD UI
    const monitor = document.getElementById('side-level-monitor');
    if (monitor) {
      monitor.classList.toggle('dock-right', this.monitorDockSide === 'right');
      monitor.classList.toggle('dock-left', this.monitorDockSide === 'left');
      monitor.classList.toggle('collapsed', !this.monitorVisible);
    }
    const toggleBtn = document.getElementById('btn-toggle-monitor');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('.toggle-tab-icon');
      if (icon) icon.textContent = this.monitorVisible ? '👁️' : '🙈';
      toggleBtn.title = this.monitorVisible ? 'Hide Level Info (Key: I)' : 'Show Level Info (Key: I)';
    }
    const headerBtn = document.getElementById('btn-header-monitor-toggle');
    if (headerBtn) {
      headerBtn.classList.toggle('active', this.monitorVisible);
      headerBtn.title = this.monitorVisible ? 'Hide Level Info (Key: I)' : 'Show Level Info (Key: I)';
    }

    this.updateGoalColorUI();
  }

  updateHUD() {
    const levelSelect = document.getElementById('level-select');
    if (levelSelect) levelSelect.value = this.currentLevelIndex;

    const diffBadge = document.getElementById('difficulty-badge');
    if (diffBadge && this.currentLevel) {
      diffBadge.textContent = this.currentLevel.difficulty;
      diffBadge.className = `difficulty-badge ${this.currentLevel.difficulty.toLowerCase()}`;
    }

    const statMoves = document.getElementById('stat-moves');
    if (statMoves) statMoves.textContent = this.moveCount;

    const statOptimal = document.getElementById('stat-optimal');
    if (statOptimal) statOptimal.textContent = this.currentLevel?.minSteps || '—';

    this.updateTimerDisplay();
  }

  toggleSound() {
    if (window.giikerAudio) {
      const isMuted = window.giikerAudio.toggleMute();
      this.updateSoundBtn();
      if (!isMuted) window.giikerAudio.playBtnClick();
    }
  }

  updateSoundBtn() {
    const btn = document.getElementById('btn-toggle-sound');
    if (!btn || !window.giikerAudio) return;
    const isMuted = window.giikerAudio.isMuted();
    btn.innerHTML = isMuted ? '<span>🔇</span>' : '<span>🔊</span>';
    btn.title = isMuted ? 'Unmute Sound' : 'Mute Sound';
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  openLevelBrowser() {
    const modal = document.getElementById('level-browser-modal');
    if (!modal) return;

    modal.classList.add('active');
    this.renderLevelBrowserGrid('Starter');
  }

  renderLevelBrowserGrid(selectedPack = 'Starter') {
    const container = document.getElementById('level-browser-grid');
    const tabsContainer = document.getElementById('level-browser-tabs');
    if (!container) return;

    const packs = ['Starter', 'Learner', 'Intermediate', 'Advanced', 'Master', 'Legendary', 'Custom'];
    if (tabsContainer) {
      tabsContainer.innerHTML = packs.map(pack => `
        <button class="level-tab-btn ${pack === selectedPack ? 'active' : ''}" data-pack="${pack}">
          ${pack}
        </button>
      `).join('');

      tabsContainer.querySelectorAll('.level-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.renderLevelBrowserGrid(btn.dataset.pack);
        });
      });
    }

    let levelsToDisplay = [];
    if (selectedPack === 'Custom') {
      levelsToDisplay = JSON.parse(localStorage.getItem('giiker_custom_levels') || '[]');
    } else {
      levelsToDisplay = this.levels.filter(l => l.difficulty === selectedPack);
    }

    if (levelsToDisplay.length === 0) {
      container.innerHTML = `<div class="no-levels-msg">No levels in this category yet. Create one in the Custom Studio!</div>`;
      return;
    }

    container.innerHTML = levelsToDisplay.map((lvl) => {
      const idx = this.levels.findIndex(l => l.id === lvl.id);
      return `
        <div class="level-card ${idx === this.currentLevelIndex ? 'current' : ''}" data-idx="${idx}">
          <div class="level-card-num">${lvl.id}</div>
          <div class="level-card-title">${lvl.name}</div>
          <div class="level-card-steps">★ ${lvl.minSteps || 'Custom'} moves</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.level-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx);
        if (idx >= 0) {
          this.loadLevel(idx);
          document.getElementById('level-browser-modal')?.classList.remove('active');
        }
      });
    });
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);
    if (this.controls) this.controls.update();

    // Gentle breathing pulse on the Goal Target floor marker so it stands out unmistakably
    if (this.goalTargetPulseMat) {
      const t = performance.now() * 0.0035;
      this.goalTargetPulseMat.emissiveIntensity = 0.65 + 0.35 * Math.sin(t);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.GiikerGame = GiikerGame;

// Instantiate and launch game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.giikerGame = new GiikerGame();
  window.giikerGame.init();
});

