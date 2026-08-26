import { WorldMap, Biome } from './map';
import { CivilizationManager } from './civilization';

export const GodAction = {
  NONE: 0,
  SPAWN_RACE: 1,
  BUILD_MOUNTAIN: 2,
  METEOR: 3
} as const;
export type GodAction = typeof GodAction[keyof typeof GodAction];

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  map: WorldMap;
  civManager: CivilizationManager;
  
  lastTime: number = 0;
  timer: number = 0;
  year: number = 0;
  
  // Controls
  isRunning: boolean = false;
  speedMultiplier: number = 1;
  currentAction: GodAction = GodAction.NONE;

  onSpawnRequest: ((x: number, y: number) => void) | null = null;
  onInspectRequest: ((raceId: number) => void) | null = null;
  onEvent: ((msg: string, type?: string) => void) | null = null;
  onGameOver: ((winnerName: string) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // Fit canvas to container
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Initialize Map and Civs
    // 200x100 provides a faster simulation
    this.map = new WorldMap(200, 100);
    this.civManager = new CivilizationManager(this.map);
    this.civManager.onEvent = (msg, type) => { if (this.onEvent) this.onEvent(msg, type); };

    // Setup input
    this.setupInput();
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }
  }

  start() {
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  pause() {
    this.isRunning = false;
  }

  togglePause() {
    this.isRunning = !this.isRunning;
  }

  setSpeed(speed: number) {
    this.speedMultiplier = speed;
  }

  setAction(action: GodAction) {
    this.currentAction = action;
  }

  loop(timestamp: number) {
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (this.isRunning) {
      // Accumulate simulated milliseconds
      this.timer += deltaTime * this.speedMultiplier;
      
      const updateInterval = 100; // 1 tick = 100ms simulated time (10 ticks/sec at 1x)
      
      // Prevent death spiral if tab is inactive
      if (this.timer > updateInterval * 200) {
        this.timer = updateInterval * 200;
      }
      
      while (this.timer >= updateInterval) {
        this.update();
        this.timer -= updateInterval;
      }
    }

    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  update() {
    this.year++;
    this.map.update();
    
    const wasGameOver = this.civManager.gameOver;
    this.civManager.update();
    
    if (!wasGameOver && this.civManager.gameOver) {
      // Game just ended
      this.pause(); // Stop simulation
      if (this.onGameOver) {
        const winner = Array.from(this.civManager.races.values())[0];
        this.onGameOver(winner ? winner.name : 'Kimse');
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw Base Map
    this.map.draw(this.ctx, this.canvas.width, this.canvas.height);
    
    // Draw Territories over map
    this.civManager.draw(this.ctx, this.canvas.width, this.canvas.height);
  }

  setupInput() {
    let isDragging = false;

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Prevent right-click menu
    });

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      this.handleMouse(e, true);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging) this.handleMouse(e, false);
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  handleMouse(e: MouseEvent, isClick: boolean) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const cellW = this.canvas.width / this.map.cols;
    const cellH = this.canvas.height / this.map.rows;

    const gridX = Math.floor(x / cellW);
    const gridY = Math.floor(y / cellH);

    const isRightClick = (e.buttons === 2 || e.button === 2);

    switch(this.currentAction) {
      case GodAction.NONE:
        if (isClick && this.onInspectRequest) {
          const cell = this.map.getCell(gridX, gridY);
          if (cell && cell.raceId !== null) {
            this.onInspectRequest(cell.raceId);
          }
        }
        break;
      case GodAction.SPAWN_RACE:
        if (isClick && this.onSpawnRequest) {
          this.onSpawnRequest(gridX, gridY);
        }
        break;
      case GodAction.BUILD_MOUNTAIN:
        this.buildMountain(gridX, gridY, isRightClick);
        break;
      case GodAction.METEOR:
        this.meteorStrike(gridX, gridY);
        break;
    }

    // Force draw if paused so user sees immediate feedback
    if (!this.isRunning) {
      this.draw();
    }
  }

  buildMountain(gridX: number, gridY: number, erase: boolean = false) {
    // Build or erase a 3x3 mountain wall
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cell = this.map.getCell(gridX + dx, gridY + dy);
        if (cell) {
          if (erase) {
            if (cell.biome === Biome.MOUNTAIN) {
              cell.biome = cell.originalBiome;
              this.map.isDirty = true;
            }
          } else {
            cell.biome = Biome.MOUNTAIN;
            this.map.isDirty = true;
            // Clear any race claims on these tiles
            if (cell.raceId !== null) {
              const race = this.civManager.races.get(cell.raceId);
              if (race) race.removeCell(cell);
            }
          }
        }
      }
    }
  }

  meteorStrike(gridX: number, gridY: number) {
    if (this.onEvent) {
      this.onEvent(`☄️ BÜYÜK FELAKET: Dünya'ya bir meteor düştü!`, 'disaster');
    }
    // Destroy everything in a 3x3 radius and turn it into crater
    const radius = 3;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Circle shape
        if (dx*dx + dy*dy <= radius*radius) {
          const cell = this.map.getCell(gridX + dx, gridY + dy);
          // Don't meteor deep ocean or already destroyed areas
          if (cell && cell.biome !== Biome.WATER) {
            cell.biome = Biome.WATER;
            
            if (cell.recoveryTimer <= 0) {
              this.map.recoveringCells.push(cell);
            }
            cell.recoveryTimer = 200 + Math.random() * 100; // 20-30 seconds at 1x speed
            
            this.map.isDirty = true;
            if (cell.raceId !== null) {
              const race = this.civManager.races.get(cell.raceId);
              if (race) {
                // Population is distributed across cells
                const popPerCell = race.population / Math.max(1, race.cells.length);
                race.population = Math.max(0, race.population - popPerCell);
                race.removeCell(cell);
              }
            }
          }
        }
      }
    }
  }
}
