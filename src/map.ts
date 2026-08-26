import { EARTH_ASCII } from './earth_data';
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

export const BIOME_COLORS: Record<Biome, string> = {
  [Biome.WATER]: '#0d2847', // Very dark blue for oceans
  [Biome.SAND]: '#8c7746',  // Muted dark sand
  [Biome.GRASS]: '#274a27', // Dark muted grass
  [Biome.FOREST]: '#122e12', // Deep dark forest
  [Biome.SNOW]: '#8a949e',   // Muted grayish snow
  [Biome.MOUNTAIN]: '#2a2a2a', // Dark grey mountains
};

export class Cell {
  x: number;
  y: number;
  biome: Biome;
  originalBiome: Biome;
  raceId: number | null = null;
  population: number = 0;
  isWall: boolean = false; // User built mountain
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

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.generate();
  }

  generate() {
    this.grid = [];
    const cols = this.cols;
    const rows = this.rows;
    
    // We map our grid to the 100x50 EARTH_ASCII
    const asciiWidth = EARTH_ASCII[0].length; // 100
    const asciiHeight = EARTH_ASCII.length;   // 50
    const noise2D = createNoise2D();

    for (let y = 0; y < rows; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < cols; x++) {
        // Map x,y to the ascii grid
        const asciiX = Math.floor((x / cols) * asciiWidth);
        const asciiY = Math.floor((y / rows) * asciiHeight);
        
        let char = 'W';
        if (asciiY >= 0 && asciiY < asciiHeight && asciiX >= 0 && asciiX < asciiWidth) {
          char = EARTH_ASCII[asciiY][asciiX];
        }

        // Use Simplex Noise to create organic coastlines
        const nx = x * 0.05;
        const ny = y * 0.05;
        
        let isLand = char === 'L';
        
        let biome: Biome = Biome.WATER;
        
        if (isLand) {
          // Equator is exactly at normalizedY = 0.5
          const normalizedY = asciiY / asciiHeight;
          const distFromEquator = Math.abs(normalizedY - 0.5);
          
          // Noise for biome mixing to make it organic
          const biomeNoise = noise2D(nx * 3, ny * 3);
          
          if (distFromEquator > 0.35 - biomeNoise * 0.05) biome = Biome.SNOW; // Poles
          else if (distFromEquator < 0.12 + biomeNoise * 0.05) biome = Biome.FOREST; // Equatorial Jungles
          else if (distFromEquator < 0.22 - biomeNoise * 0.05) biome = Biome.SAND; // Deserts
          else biome = Biome.GRASS; // Temperate Zones
        }

        row.push(new Cell(x, y, biome));
      }
      this.grid.push(row);
    }
  }

  getCell(x: number, y: number): Cell | null {
    if (y >= 0 && y < this.grid.length && x >= 0 && x < this.grid[0].length) {
      return this.grid[y][x];
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
          this.offscreenCtx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW), Math.ceil(cellH));
        }
      }
      this.isDirty = false;
    }

    if (this.offscreenCanvas) {
      ctx.drawImage(this.offscreenCanvas, 0, 0);
    }
  }
}
