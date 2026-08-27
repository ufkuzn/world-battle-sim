import { WorldMap, Biome, ResourceNode } from './map';
import { CivilizationManager, Person } from './civilization';

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
  fps: number = 0;
  frameCount: number = 0;
  lastFpsTime: number = 0;
  tickCount: number = 0;
  
  // Camera
  cameraX: number;
  cameraY: number;
  zoom: number = 1;
  isPanning: boolean = false;
  panStartX: number = 0;
  panStartY: number = 0;
  
  // Controls
  isRunning: boolean = false;
  speedMultiplier: number = 1;
  currentAction: GodAction = GodAction.NONE;

  onSpawnRequest: ((x: number, y: number) => void) | null = null;
  onInspectRequest: ((raceId: number) => void) | null = null;
  onInspectResourceRequest: ((res: ResourceNode) => void) | null = null;
  onInspectPersonRequest: ((person: Person, raceId: number) => void) | null = null;
  onEvent: ((msg: string, type?: string) => void) | null = null;
  onGameOver: ((winnerName: string) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // Fit canvas to container
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Initialize Map and Civs
    // 600x300 provides a much smoother, higher resolution map
    this.map = new WorldMap(600, 300);
    this.civManager = new CivilizationManager(this.map);
    this.civManager.onEvent = (msg, type) => { if (this.onEvent) this.onEvent(msg, type); };

    this.cameraX = this.canvas.width / 2;
    this.cameraY = this.canvas.height / 2;

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
    
    this.frameCount++;
    if (timestamp - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = timestamp;
    }

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
    this.tickCount++;
    if (this.tickCount % 10 === 0) { // 1 year per 10 ticks (slower)
      this.year++;
    }
    
    this.map.update();
    
    const wasGameOver = this.civManager.gameOver;
    this.civManager.update();
    
    if (!wasGameOver && this.civManager.gameOver) {
      // Game just ended
      this.pause(); // Stop simulation
      if (this.onGameOver) {
        this.onGameOver(this.civManager.winnerName || 'Kimse');
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    // Center camera on screen
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(-this.cameraX, -this.cameraY);
    
    // Draw Base Map
    this.map.draw(this.ctx, this.canvas.width, this.canvas.height);
    
    // Draw Territories over map
    this.civManager.draw(this.ctx, this.canvas.width, this.canvas.height);
    
    this.ctx.restore();
  }

  setupInput() {
    let isDragging = false;

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Prevent right-click menu
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) { 
        // Middle click = PAN only
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        e.preventDefault(); 
      } else if (this.currentAction === GodAction.NONE) {
        // Left click in Inspect mode = Inspect + PAN
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.handleMouse(e, true);
      } else {
        isDragging = true;
        this.handleMouse(e, true);
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = (e.clientX - this.panStartX) / this.zoom;
        const dy = (e.clientY - this.panStartY) / this.zoom;
        this.cameraX -= dx;
        this.cameraY -= dy;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        if (!this.isRunning) this.draw();
      } else if (isDragging) {
        this.handleMouse(e, false);
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      this.isPanning = false;
    });
    
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      if (e.deltaY < 0) {
        this.zoom *= zoomFactor;
      } else {
        this.zoom /= zoomFactor;
      }
      this.zoom = Math.max(1, Math.min(this.zoom, 10)); // Limit zoom out to 1 (screen size)
      
      // Also clamp camera so it doesn't go completely out of bounds when zoomed out to 1
      if (this.zoom === 1) {
        this.cameraX = this.canvas.width / 2;
        this.cameraY = this.canvas.height / 2;
      }
      
      if (!this.isRunning) this.draw();
    });
  }

  handleMouse(e: MouseEvent, isClick: boolean) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const worldX = (x - this.canvas.width / 2) / this.zoom + this.cameraX;
    const worldY = (y - this.canvas.height / 2) / this.zoom + this.cameraY;
    
    const cellW = this.canvas.width / this.map.cols;
    const cellH = this.canvas.height / this.map.rows;

    const gridX = Math.floor(worldX / cellW);
    const gridY = Math.floor(worldY / cellH);

    const isRightClick = (e.buttons === 2 || e.button === 2);

    switch(this.currentAction) {
      case GodAction.NONE:
        if (isClick) {
          let closestPersonDist = 9999;
          let closestPerson: Person | null = null;
          let closestRaceId: number | null = null;
          
          for (const race of this.civManager.races.values()) {
            for (const p of race.persons) {
              const dx = p.x - gridX;
              const dy = p.y - gridY;
              const dist = dx*dx + dy*dy;
              if (dist < 10 && dist < closestPersonDist) {
                closestPersonDist = dist;
                closestPerson = p;
                closestRaceId = race.id;
              }
            }
          }
          
          let closestResDist = 9999;
          let closestRes: ResourceNode | null = null;
          for (const res of this.map.resources) {
            const dx = res.x - gridX;
            const dy = res.y - gridY;
            const dist = dx*dx + dy*dy;
            if (dist < 10 && dist < closestResDist) {
              closestResDist = dist;
              closestRes = res;
            }
          }
          
          // Prioritize resource if it's closer than a person
          if (closestRes && closestResDist < closestPersonDist) {
            if (this.onInspectResourceRequest) {
              this.onInspectResourceRequest(closestRes);
            }
          } else if (closestPerson && closestRaceId !== null) {
            // Check if they zoomed in enough to click a specific person,
            // else fall back to inspecting the whole race
            if (this.zoom > 2) {
              if (this.onInspectPersonRequest) {
                this.onInspectPersonRequest(closestPerson, closestRaceId);
              }
            } else {
              if (this.onInspectRequest) {
                this.onInspectRequest(closestRaceId);
              }
            }
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
    // Build or erase a mountain wall
    const radius = 4;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx*dx + dy*dy <= radius*radius) {
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
    // Destroy map in radius
    const radius = 12;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx*dx + dy*dy <= radius*radius) {
          const cell = this.map.getCell(gridX + dx, gridY + dy);
          if (cell && cell.biome !== Biome.WATER) {
            cell.biome = Biome.WATER;
            if (cell.recoveryTimer <= 0) {
              this.map.recoveringCells.push(cell);
            }
            cell.recoveryTimer = 200 + Math.random() * 100;
            this.map.isDirty = true;
          }
        }
      }
    }
    // Kill persons in radius
    for (const race of this.civManager.races.values()) {
      for (let i = race.persons.length - 1; i >= 0; i--) {
        const p = race.persons[i];
        const dx = p.x - gridX;
        const dy = p.y - gridY;
        if (dx*dx + dy*dy <= radius*radius) {
          race.persons.splice(i, 1);
        }
      }
    }
  }
}
