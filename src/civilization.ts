import { Cell, WorldMap, Biome } from './map';

export const Diplomacy = {
  NEUTRAL: 0,
  ALLY: 1,
  WAR: 2,
} as const;
export type Diplomacy = typeof Diplomacy[keyof typeof Diplomacy];

export class Race {
  id: number;
  name: string;
  color: string;
  cells: Cell[] = [];
  population: number = 0;
  originBiome: Biome;
  heatResistance: boolean = false;
  coldResistance: boolean = false;
  seafaring: boolean = false;
  hasSwords: boolean = false;
  hasRifles: boolean = false;
  hasBombs: boolean = false;
  relations: Map<number, Diplomacy> = new Map();

  constructor(id: number, name: string, color: string, originBiome: Biome) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.originBiome = originBiome;
    
    // Adapt to biome
    if (originBiome === Biome.SAND) this.heatResistance = true;
    if (originBiome === Biome.SNOW) this.coldResistance = true;
  }

  addCell(cell: Cell) {
    if (cell.raceId !== this.id) {
      cell.raceId = this.id;
      this.cells.push(cell);
    }
  }

  removeCell(cell: Cell) {
    if (cell.raceId === this.id) {
      cell.raceId = null;
      this.cells = this.cells.filter(c => c !== cell);
    }
  }

  getRelation(otherId: number): Diplomacy {
    return this.relations.get(otherId) || Diplomacy.NEUTRAL;
  }

  setRelation(otherId: number, state: Diplomacy) {
    this.relations.set(otherId, state);
  }
}

export class CivilizationManager {
  races: Map<number, Race> = new Map();
  map: WorldMap;
  maxRaces: number = 30;
  nextRaceId: number = 1;
  onEvent: ((msg: string, type?: string) => void) | null = null;
  
  // Game state
  hasStarted: boolean = false;
  gameOver: boolean = false;

  availableColors: string[] = [
    'rgba(255, 50, 50, 0.85)', 'rgba(50, 255, 50, 0.85)', 'rgba(50, 50, 255, 0.85)',
    'rgba(255, 255, 50, 0.85)', 'rgba(255, 50, 255, 0.85)', 'rgba(50, 255, 255, 0.85)',
    'rgba(255, 150, 150, 0.85)', 'rgba(150, 255, 150, 0.85)', 'rgba(150, 150, 255, 0.85)',
    'rgba(150, 50, 50, 0.85)', 'rgba(50, 150, 50, 0.85)', 'rgba(50, 50, 150, 0.85)',
    'rgba(255, 150, 50, 0.85)', 'rgba(150, 255, 50, 0.85)', 'rgba(50, 255, 150, 0.85)',
    'rgba(150, 50, 255, 0.85)', 'rgba(255, 50, 150, 0.85)', 'rgba(200, 200, 200, 0.85)',
    'rgba(255, 100, 50, 0.85)', 'rgba(50, 255, 100, 0.85)', 'rgba(100, 50, 255, 0.85)',
    'rgba(255, 200, 100, 0.85)', 'rgba(100, 255, 200, 0.85)', 'rgba(200, 100, 255, 0.85)',
    'rgba(200, 50, 50, 0.85)', 'rgba(50, 200, 50, 0.85)', 'rgba(50, 50, 200, 0.85)',
    'rgba(200, 100, 255, 0.85)', 'rgba(255, 100, 200, 0.85)', 'rgba(150, 150, 150, 0.85)'
  ];

  constructor(map: WorldMap) {
    this.map = map;
  }

  spawnRace(x: number, y: number, name: string): boolean {
    if (this.races.size >= this.maxRaces) return false;
    
    const cell = this.map.getCell(x, y);
    if (!cell || cell.biome === Biome.WATER || cell.biome === Biome.MOUNTAIN || cell.raceId !== null) {
      return false; // Can't spawn in water, mountains, or existing borders
    }

    const color = this.availableColors[this.nextRaceId - 1] || 'rgba(255,255,255,0.85)';
    const race = new Race(this.nextRaceId, name, color, cell.biome);
    
    // Initial spawn
    race.addCell(cell);
    cell.population = 10;
    race.population = 10;
    
    this.races.set(this.nextRaceId, race);
    this.nextRaceId++;
    
    if (this.nextRaceId > 2) {
      this.hasStarted = true;
    }
    
    return true;
  }

  update() {
    // Each update, races grow population and try to expand
    for (const race of Array.from(this.races.values())) {
      if (race.cells.length === 0) {
        if (this.onEvent) this.onEvent(`❌ ${race.name} tarih sahnesinden silindi.`, 'error');
        this.races.delete(race.id);
        continue;
      }
      
      // Calculate capacity
      let capacity = 0;
      for (const cell of race.cells) {
        if (cell.biome === Biome.FOREST || cell.biome === Biome.GRASS) capacity += 1200000;
        else if (cell.biome === Biome.WATER) capacity += 500000;
        else capacity += 800000; // Snow/Sand
      }

      // 1. Population growth
      if (race.population < capacity) {
        let growthRate = 0.1;
        if (race.originBiome === Biome.FOREST) {
          growthRate = 0.12; // +20% faster growth for forest origin
        }
        race.population += race.cells.length * growthRate;
        if (race.population > capacity) {
          race.population = capacity;
        }
      } else {
        // Can lose population if over capacity (e.g. from lost territory)
        race.population -= (race.population - capacity) * 0.1;
      }

      // Discover seafaring
      if (!race.seafaring && race.population > 300000) {
        race.seafaring = true;
        if (this.onEvent) this.onEvent(`⛵ ${race.name} Denizcilik teknolojisini keşfetti!`, 'tech');
      }

      // Discover Swords
      if (!race.hasSwords && race.population > 400000 && Math.random() < 0.01) {
        race.hasSwords = true;
        if (this.onEvent) this.onEvent(`⚔️ ${race.name} Kılıç üretimine başladı! (Saldırı +%5)`, 'tech');
      }

      // Discover Rifles
      if (!race.hasRifles && race.population > 600000 && Math.random() < 0.01) {
        race.hasRifles = true;
        if (this.onEvent) this.onEvent(`🔫 ${race.name} Tüfek icat etti! (Saldırı +%5)`, 'tech');
      }

      // Discover Bombs
      if (!race.hasBombs && race.population > 1500000 && Math.random() < 0.01) {
        race.hasBombs = true;
        if (this.onEvent) this.onEvent(`💣 ${race.name} Bomba icat etti! (Saldırı +%15)`, 'tech');
      }
      
      // Dynamic Alliances: Small chance to break alliances
      for (const [otherId, state] of race.relations.entries()) {
        if (state === Diplomacy.ALLY && Math.random() < 0.005) { // 0.5% chance per tick to reconsider
          const otherRace = this.races.get(otherId);
          if (otherRace) {
            // Check power difference
            const ratio = race.population / Math.max(1, otherRace.population);
            // More likely to break if one is much more powerful
            if (ratio > 2.0 || ratio < 0.5) {
              race.setRelation(otherId, Diplomacy.NEUTRAL);
              otherRace.setRelation(race.id, Diplomacy.NEUTRAL);
              if (this.onEvent) this.onEvent(`💔 İTTİFAK BOZULDU: ${race.name} ile ${otherRace.name} artık müttefik değil.`, 'diplomacy');
            }
          }
        }
      }

      // 2. Expansion logic
      // Base expansion chance is 10% per tick. Higher population allows multiple expansion attempts.
      const baseExpandChance = 0.1;
      const expandAttempts = 1 + Math.floor(race.population / 2000000); // 1 extra attempt per 2m pop
      for (let i = 0; i < expandAttempts; i++) {
        if (Math.random() < baseExpandChance) {
          this.expandBorders(race);
        }
      }
    }

    // Check game over
    if (this.hasStarted && !this.gameOver && this.races.size === 1) {
      this.gameOver = true;
      const winner = Array.from(this.races.values())[0];
      if (this.onEvent) this.onEvent(`🏆 ${winner.name} DÜNYAYA HAKİM OLDU!`, 'diplomacy');
    }
  }

  private expandBorders(race: Race) {
    if (race.cells.length === 0) return;
    
    // Pick a random border cell to expand from
    const borderCell = race.cells[Math.floor(Math.random() * race.cells.length)];
    const neighbors = this.getNeighbors(borderCell.x, borderCell.y);
    
    for (const n of neighbors) {
      // Can't expand into user-built mountains
      if (n.biome === Biome.MOUNTAIN) continue;
      
      // Water logic
      if (n.biome === Biome.WATER) {
        if (!race.seafaring) continue; // Cannot enter water without tech
        
        // Launch a naval expedition across the ocean instead of claiming water
        if (Math.random() < 0.05) { 
          this.launchExpedition(race, borderCell.x, borderCell.y);
        }
        continue; // Never claim the water cell itself
      }
      
      // Adaptation penalties (slower expansion into hostile biomes)
      if (n.biome === Biome.SAND && !race.heatResistance && Math.random() < 0.8) continue;
      if (n.biome === Biome.SNOW && !race.coldResistance && Math.random() < 0.8) continue;

      if (n.raceId === null) {
        // Unclaimed land -> claim it
        race.addCell(n);
        break; // Expand one cell at a time per tick
      } else if (n.raceId !== race.id) {
        // Encountered another race
        this.handleEncounter(race, this.races.get(n.raceId)!);
        
        // If at war, try to take over the cell
        if (race.getRelation(n.raceId) === Diplomacy.WAR) {
          const enemyRace = this.races.get(n.raceId)!;
          let winChance = 0.3; // Base 30% chance to win
          
          // Population ratio bonus (up to +/- 30%)
          const popRatio = race.population / Math.max(1, enemyRace.population);
          const popBonus = Math.max(-0.3, Math.min(0.3, Math.log10(popRatio) * 0.15));
          winChance += popBonus;
          
          if (race.originBiome === Biome.SAND) {
            winChance += 0.15; // +15% aggressive bonus
          }
          if (enemyRace.originBiome === Biome.SNOW) {
            winChance -= 0.15; // -15% against defensive snow races
          }
          
          if (race.hasSwords) winChance += 0.05;
          if (race.hasRifles) winChance += 0.05;
          if (race.hasBombs) winChance += 0.15;
          
          if (enemyRace.hasSwords) winChance -= 0.05;
          if (enemyRace.hasRifles) winChance -= 0.05;
          if (enemyRace.hasBombs) winChance -= 0.15;
          
          if (Math.random() < winChance) { 
            // Decrease population based on lost territory
            const lostPop = enemyRace.population / Math.max(1, enemyRace.cells.length);
            enemyRace.population = Math.max(0, enemyRace.population - lostPop);
            
            enemyRace.removeCell(n);
            race.addCell(n);
            break;
          }
        }
      }
    }
  }

  private handleEncounter(race1: Race, race2: Race) {
    if (race1.getRelation(race2.id) === Diplomacy.NEUTRAL) {
      // Check alliance conflicts (Enemy of my ally is my enemy)
      let canAlly = true;
      for (const [otherId, state] of race1.relations.entries()) {
        if (state === Diplomacy.ALLY && race2.getRelation(otherId) === Diplomacy.WAR) canAlly = false;
      }
      for (const [otherId, state] of race2.relations.entries()) {
        if (state === Diplomacy.ALLY && race1.getRelation(otherId) === Diplomacy.WAR) canAlly = false;
      }

      // Decide fate randomly initially
      let isWar = Math.random() < 0.5; // 50% chance for war
      if (!canAlly) {
        isWar = true; // Forced war due to conflicting alliances
      }
      
      const state = isWar ? Diplomacy.WAR : Diplomacy.ALLY;
      
      race1.setRelation(race2.id, state);
      race2.setRelation(race1.id, state);
      
      if (this.onEvent) {
        if (state === Diplomacy.WAR) {
          this.onEvent(`⚔️ SAVAŞ: ${race1.name} ile ${race2.name} arasında savaş başladı!`, 'war');
        } else {
          this.onEvent(`🤝 İTTİFAK: ${race1.name} ile ${race2.name} müttefik oldu.`, 'diplomacy');
        }
      }
    }
  }

  private launchExpedition(race: Race, startX: number, startY: number) {
    // Pick a random direction
    const dx = Math.random() < 0.5 ? (Math.random() < 0.5 ? 1 : -1) : 0;
    const dy = dx === 0 ? (Math.random() < 0.5 ? 1 : -1) : 0;
    
    if (dx === 0 && dy === 0) return;

    let cx = startX;
    let cy = startY;
    let distance = 0;
    
    while (distance < 100) { // Max expedition range
      cx += dx;
      cy += dy;
      distance++;
      
      const cell = this.map.getCell(cx, cy);
      if (!cell) break; // Off map
      if (cell.biome === Biome.MOUNTAIN) break; // Crashed into mountain
      
      if (cell.biome !== Biome.WATER) {
        // Landfall!
        if (cell.raceId === null) {
          // Unclaimed land
          if (race.population > 50) {
            race.population -= 10; // Send settlers
            race.addCell(cell);
            cell.population = 10;
          }
        } else if (cell.raceId !== race.id) {
          // Encountered another race via sea
          const enemyRace = this.races.get(cell.raceId)!;
          this.handleEncounter(race, enemyRace);
          
          if (race.getRelation(cell.raceId) === Diplomacy.WAR) {
            // Naval invasion is hard
            if (Math.random() < 0.15 && race.population > 100) { 
              race.population -= 50; // High cost
              enemyRace.removeCell(cell);
              race.addCell(cell);
            }
          }
        }
        break; // Stop expedition after hitting land
      }
    }
  }

  private getNeighbors(x: number, y: number): Cell[] {
    const neighbors: Cell[] = [];
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W
    
    for (const [dx, dy] of dirs) {
      const cell = this.map.getCell(x + dx, y + dy);
      if (cell) neighbors.push(cell);
    }
    
    return neighbors;
  }

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
    const cellW = canvasWidth / this.map.cols;
    const cellH = canvasHeight / this.map.rows;

    // Draw territories
    for (const race of this.races.values()) {
      for (const cell of race.cells) {
        if (cell.biome === Biome.WATER) {
          // Water territories are more translucent to not obscure the ocean
          ctx.fillStyle = race.color.replace('0.85', '0.35');
        } else {
          ctx.fillStyle = race.color;
        }
        ctx.fillRect(Math.floor(cell.x * cellW), Math.floor(cell.y * cellH), Math.ceil(cellW), Math.ceil(cellH));
      }
    }
  }

  getTotalPopulation(): number {
    let total = 0;
    for (const race of this.races.values()) {
      total += Math.floor(race.population);
    }
    return total;
  }
}
