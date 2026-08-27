import { createNoise2D } from 'simplex-noise';

export const Biome = {
  WATER: 0,
  SAND: 1,
  GRASS: 2,
  FOREST: 3,
  SNOW: 4,
  MOUNTAIN: 5,
} as const;
export type Biome = typeof Biome[keyof typeof Biome];

export const ResourceType = {
  GOLD: 0,
  IRON: 1
} as const;
export type ResourceType = typeof ResourceType[keyof typeof ResourceType];

export class ResourceNode {
  x: number;
  y: number;
  type: ResourceType;
  constructor(x: number, y: number, type: ResourceType) {
    this.x = x;
    this.y = y;
    this.type = type;
  }
}

export const BIOME_COLORS: Record<Biome, string> = {
  [Biome.WATER]: '#1a3c5e', // deep modern blue
  [Biome.SAND]: '#d4b872',  // warm sand
  [Biome.GRASS]: '#4f8f4f', // vibrant green
  [Biome.FOREST]: '#205220', // deep forest
  [Biome.SNOW]: '#e0e8f0',   // crisp white/blue snow
  [Biome.MOUNTAIN]: '#3a3a3a', // dark rock
};

export class Cell {
  x: number;
  y: number;
  biome: Biome;
  originalBiome: Biome;
  recoveryTimer: number = 0;

  constructor(x: number, y: number, biome: Biome) {
    this.x = x;
    this.y = y;
    this.biome = biome;
    this.originalBiome = biome;
  }
}

export class WorldMap {
  cols: number;
  rows: number;
  grid: Cell[][] = [];
  
  offscreenCanvas: HTMLCanvasElement | null = null;
  offscreenCtx: CanvasRenderingContext2D | null = null;
  isDirty: boolean = true;
  recoveringCells: Cell[] = [];
  resources: ResourceNode[] = [];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.generate();
  }

  generate() {
    this.grid = [];
    const noise2D = createNoise2D();

    for (let y = 0; y < this.rows; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < this.cols; x++) {
        
        // Use Simplex Noise to create islands and continents
        // Lower frequency for larger landmasses
        const nx = (x / this.cols) * 2;
        const ny = (y / this.rows) * 1;
        
        // Base elevation
        let e = 1 * noise2D(1 * nx, 1 * ny) 
              + 0.5 * noise2D(2 * nx, 2 * ny) 
              + 0.25 * noise2D(4 * nx, 4 * ny);
              
        // Normalize e approximately to -1 .. 1
        e = e / (1 + 0.5 + 0.25);
        
        // calculate distance from center (0 to 1)
        const dx = (x / this.cols) * 2 - 1;
        const dy = (y / this.rows) * 2 - 1;
        const d = Math.sqrt(dx*dx + dy*dy);
        
        // Bias center to be land, edges to be water
        e = e + 0.4 - d * 0.8; 

        let biome: Biome = Biome.WATER;
        
        if (e > -0.1) {
          // It's land
          const normalizedY = y / this.rows;
          const distFromEquator = Math.abs(normalizedY - 0.5);
          
          // Temperature noise
          const tempNoise = noise2D(nx * 2, ny * 2);
          
          if (distFromEquator > 0.35 - tempNoise * 0.1) {
            biome = Biome.SNOW;
          } else if (distFromEquator < 0.15 + tempNoise * 0.1) {
            biome = Biome.FOREST;
          } else {
            // Moisture noise for sand vs grass
            const moisture = noise2D(nx * 3 + 10, ny * 3 + 10);
            if (moisture < -0.2 && distFromEquator > 0.15) {
              biome = Biome.SAND;
            } else {
              biome = Biome.GRASS;
            }
          }
          
          // Add some random mountain peaks
          if (e > 0.55) {
            biome = Biome.MOUNTAIN;
          }
        }

        row.push(new Cell(x, y, biome));
      }
      this.grid.push(row);
    }

    // Place resources
    this.resources = [];
    let placed = 0;
    while (placed < 8) {
      const rx = Math.floor(Math.random() * this.cols);
      const ry = Math.floor(Math.random() * this.rows);
      const cell = this.grid[ry][rx];
      if (cell.biome !== Biome.WATER && cell.biome !== Biome.MOUNTAIN) {
        const type = Math.random() > 0.5 ? ResourceType.GOLD : ResourceType.IRON;
        this.resources.push(new ResourceNode(rx, ry, type));
        placed++;
      }
    }
  }

  getCell(x: number, y: number): Cell | null {
    if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) {
      return this.grid[Math.floor(y)][Math.floor(x)];
    }
    return null;
  }

  update() {
    let recovered = false;
    for (let i = this.recoveringCells.length - 1; i >= 0; i--) {
      const cell = this.recoveringCells[i];
      cell.recoveryTimer--;
      if (cell.recoveryTimer <= 0) {
        cell.biome = cell.originalBiome;
        this.recoveringCells.splice(i, 1);
        recovered = true;
      }
    }
    if (recovered) {
      this.isDirty = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
    if (!this.offscreenCanvas || this.offscreenCanvas.width !== canvasWidth || this.offscreenCanvas.height !== canvasHeight) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = canvasWidth;
      this.offscreenCanvas.height = canvasHeight;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
      this.isDirty = true;
    }

    if (this.isDirty && this.offscreenCtx) {
      const cellW = canvasWidth / this.cols;
      const cellH = canvasHeight / this.rows;
      
      this.offscreenCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const cell = this.grid[y][x];
          this.offscreenCtx.fillStyle = BIOME_COLORS[cell.biome];
          
          // Draw slightly larger to avoid anti-aliasing gaps between cells
          this.offscreenCtx.fillRect(
            Math.floor(x * cellW), 
            Math.floor(y * cellH), 
            Math.ceil(cellW) + 1, 
            Math.ceil(cellH) + 1
          );
        }
      }
      this.isDirty = false;
    }

    if (this.offscreenCanvas) {
      ctx.drawImage(this.offscreenCanvas, 0, 0);
      
      // Draw resources
      const cellW = canvasWidth / this.cols;
      const cellH = canvasHeight / this.rows;
      for (const res of this.resources) {
        ctx.fillStyle = res.type === ResourceType.GOLD ? '#ffd700' : '#b0c4de';
        ctx.fillRect((res.x + 0.5) * cellW - 5, (res.y + 0.5) * cellH - 5, 10, 10);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect((res.x + 0.5) * cellW - 5, (res.y + 0.5) * cellH - 5, 10, 10);
      }
    }
  }
}
