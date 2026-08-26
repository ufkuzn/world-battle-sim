import { WorldMap, Biome, ResourceType } from './map';

export class FlowField {
  width: number;
  height: number;
  dirs: Int8Array;
  targetX: number = -1;
  targetY: number = -1;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.dirs = new Int8Array(width * height);
  }

  calculate(map: WorldMap, tx: number, ty: number, canSwim: boolean) {
    this.targetX = tx;
    this.targetY = ty;
    this.dirs.fill(0);

    const startX = Math.floor(tx / 4);
    const startY = Math.floor(ty / 4);
    if (startX < 0 || startX >= this.width || startY < 0 || startY >= this.height) return;

    const maxDist = this.width * this.height * 20;
    const distances = new Int32Array(this.width * this.height).fill(maxDist);
    const buckets: {x: number, y: number}[][] = [];
    buckets[0] = [{x: startX, y: startY}];
    distances[startY * this.width + startX] = 0;

    let currentDist = 0;
    let processed = 0;

    const neighbors = [
      {dx: 0, dy: -1, dir: 5},
      {dx: 1, dy: -1, dir: 6},
      {dx: 1, dy: 0, dir: 7},
      {dx: 1, dy: 1, dir: 8},
      {dx: 0, dy: 1, dir: 1},
      {dx: -1, dy: 1, dir: 2},
      {dx: -1, dy: 0, dir: 3},
      {dx: -1, dy: -1, dir: 4},
    ];

    while(processed < this.width * this.height && currentDist < buckets.length) {
      const bucket = buckets[currentDist];
      if (!bucket || bucket.length === 0) {
        currentDist++;
        continue;
      }
      
      const curr = bucket.pop()!;
      if (distances[curr.y * this.width + curr.x] < currentDist) continue;
      
      processed++;

      for (const n of neighbors) {
        const nx = curr.x + n.dx;
        const ny = curr.y + n.dy;
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          const idx = ny * this.width + nx;
          const cell = map.getCell(nx * 4 + 2, ny * 4 + 2);
          let cost = -1;
          if (cell && cell.biome !== Biome.MOUNTAIN) {
             if (cell.biome === Biome.WATER) {
                if (canSwim) cost = 4; // penalize water pathing moderately
             } else {
                cost = 1;
             }
          }
          if (cost > 0) {
             const newDist = currentDist + cost;
             if (newDist < distances[idx]) {
               distances[idx] = newDist;
               this.dirs[idx] = n.dir;
               if (!buckets[newDist]) buckets[newDist] = [];
               buckets[newDist].push({x: nx, y: ny});
             }
          }
        }
      }
    }
  }

  getDir(x: number, y: number): {vx: number, vy: number} | null {
    const cx = Math.floor(x / 4);
    const cy = Math.floor(y / 4);
    if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) return null;

    const d = this.dirs[cy * this.width + cx];
    switch (d) {
      case 1: return {vx: 0, vy: -1};
      case 2: return {vx: 0.707, vy: -0.707};
      case 3: return {vx: 1, vy: 0};
      case 4: return {vx: 0.707, vy: 0.707};
      case 5: return {vx: 0, vy: 1};
      case 6: return {vx: -0.707, vy: 0.707};
      case 7: return {vx: -1, vy: 0};
      case 8: return {vx: -0.707, vy: -0.707};
      default: return null;
    }
  }
}

export const Diplomacy = {
  NEUTRAL: 0,
  ALLY: 1,
  WAR: 2,
} as const;
export type Diplomacy = typeof Diplomacy[keyof typeof Diplomacy];

export class Person {
  x: number;
  y: number;
  raceId: number;
  hp: number = 100;
  maxHp: number = 100;

  // movement
  vx: number = 0;
  vy: number = 0;
  targetX: number | null = null;
  targetY: number | null = null;
  laneOffset: number = (Math.random() - 0.5) * 2.0;

  // combat
  attackCooldown: number = 0;

  age: number = 0;

  constructor(x: number, y: number, raceId: number, initialAge: number = 0) {
    this.x = x;
    this.y = y;
    this.raceId = raceId;
    this.age = initialAge;
  }
}

// Visual projectiles
export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  isBomb: boolean;
}

export class Race {
  id: number;
  name: string;
  color: string;
  persons: Person[] = [];
  originBiome: Biome;

  // Techs
  hasSwords: boolean = false;
  hasRifles: boolean = false;
  hasBombs: boolean = false;
  seafaring: boolean = false;
  heatResistance: boolean = false;
  coldResistance: boolean = false;
  flowField: FlowField | null = null;

  // Resources
  hasGold: boolean = false;
  hasIron: boolean = false;

  relations: Map<number, Diplomacy> = new Map();

  constructor(id: number, name: string, color: string, originBiome: Biome) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.originBiome = originBiome;
  }

  get population(): number {
    return this.persons.length;
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
  winnerName: string = '';

  maxPopulation: number = 1500;
  tickCount: number = 0;

  projectiles: Projectile[] = [];

  availableColors: string[] = [
    '#ff3232', '#32ff32', '#3232ff',
    '#ffff32', '#ff32ff', '#32ffff',
    '#ff9696', '#96ff96', '#9696ff',
    '#963232', '#329632', '#323296',
    '#ff9632', '#96ff32', '#32ff96',
    '#9632ff', '#ff3296', '#c8c8c8'
  ];

  constructor(map: WorldMap) {
    this.map = map;
  }

  spawnRace(x: number, y: number, name: string): boolean {
    if (this.races.size >= this.maxRaces) return false;

    const cell = this.map.getCell(x, y);
    if (!cell || cell.biome === Biome.WATER || cell.biome === Biome.MOUNTAIN) {
      return false;
    }

    const color = this.availableColors[this.nextRaceId - 1] || '#ffffff';
    const race = new Race(this.nextRaceId, name, color, cell.biome);

    // Check if it's a small island via flood fill
    let landCount = 0;
    const visited = new Set<string>();
    const stack: { cx: number, cy: number }[] = [{ cx: x, cy: y }];
    visited.add(`${x},${y}`);

    while (stack.length > 0 && landCount < 10000) {
      const curr = stack.pop()!;
      landCount++;
      const neighbors = [
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
      ];
      for (const n of neighbors) {
        const nx = curr.cx + n.dx;
        const ny = curr.cy + n.dy;
        const key = `${nx},${ny}`;
        if (!visited.has(key)) {
          visited.add(key);
          const nCell = this.map.getCell(nx, ny);
          if (nCell && nCell.biome !== Biome.WATER && nCell.biome !== Biome.MOUNTAIN) {
            stack.push({ cx: nx, cy: ny });
          }
        }
      }
    }

    // If island is smaller than 10000 tiles, they start with seafaring
    if (landCount < 10000) {
      race.seafaring = true;
    }

    // Start with 2 people
    for (let i = 0; i < 2; i++) {
      const px = x + 0.5 + (Math.random() * 0.4 - 0.2);
      const py = y + 0.5 + (Math.random() * 0.4 - 0.2);
      race.persons.push(new Person(px, py, race.id, 15 + Math.random() * 10)); // Founders start at age 15-25
    }

    this.races.set(this.nextRaceId, race);
    this.nextRaceId++;

    if (this.nextRaceId > 2) {
      this.hasStarted = true;
    }

    return true;
  }

  update() {
    this.updateAgents();
    this.checkGameOver();
  }

  getTotalPopulation(): number {
    let t = 0;
    for (const r of this.races.values()) t += r.population;
    return t;
  }

  private updateAgents() {
    this.tickCount++;
    let currentTotalPop = this.getTotalPopulation();

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        if (p.isBomb) {
          // explosion effect in next logic
        }
        this.projectiles.splice(i, 1);
      }
    }

    // Process each person
    const allPersons: Person[] = [];
    for (const race of this.races.values()) {
      allPersons.push(...race.persons);
    }

    // Calculate centers of mass for each race for coordinated attacks
    const raceCenters = new Map<number, { x: number, y: number }>();
    for (const race of this.races.values()) {
      let sumX = 0, sumY = 0;
      for (const p of race.persons) {
        sumX += p.x;
        sumY += p.y;
      }
      if (race.persons.length > 0) {
        raceCenters.set(race.id, { x: sumX / race.persons.length, y: sumY / race.persons.length });
      }
    }

    const maxSpeed = 0.15;

    for (const race of Array.from(this.races.values())) {
      if (race.population === 0) {
        if (this.onEvent) this.onEvent(`❌ ${race.name} soyu tükendi.`, 'error');
        this.races.delete(race.id);
        continue;
      }

      // Technology thresholds
      if (!race.hasSwords && race.population > 50) {
        race.hasSwords = true;
        if (this.onEvent) this.onEvent(`⚔️ ${race.name} Kılıç üretimine başladı!`, 'tech');
      }
      if (!race.seafaring && race.population > 80) {
        race.seafaring = true;
        if (this.onEvent) this.onEvent(`⛵ ${race.name} Denizcilik (Gemi) icat etti!`, 'tech');
      }
      if (!race.hasRifles && race.population > 150) {
        race.hasRifles = true;
        if (this.onEvent) this.onEvent(`🔫 ${race.name} Tüfek icat etti!`, 'tech');
      }
      if (!race.hasBombs && race.population > 250) {
        race.hasBombs = true;
        if (this.onEvent) this.onEvent(`💣 ${race.name} Bomba icat etti!`, 'tech');
      }

      for (let i = race.persons.length - 1; i >= 0; i--) {
        const p = race.persons[i];

        p.age += 0.1; // 1 year per 10 ticks
        if (p.age > 170 && Math.random() < 0.05) { // 5% chance per tick to die over 100
          race.persons.splice(i, 1);
          continue;
        }

        if (p.hp <= 0) {
          race.persons.splice(i, 1);
          continue;
        }

        // Find nearest enemy and calculate friendly repulsion
        let nearestEnemy: Person | null = null;
        let minDist = 9999;
        let repX = 0;
        let repY = 0;

        // Optimize: just pick a random subset to check for performance, or check all if < 2000
        for (const other of allPersons) {
          if (other.hp <= 0) continue;
          
          if (race.getRelation(other.raceId) === Diplomacy.WAR) {
            const dx = other.x - p.x;
            const dy = other.y - p.y;
            const dist = dx * dx + dy * dy;
            if (dist < minDist && dist < 100) { // detection radius 10 tiles
              minDist = dist;
              nearestEnemy = other;
            }
          } else if (other.raceId === race.id && other !== p) {
            // Friendly repulsion to break up single-file lines
            const dx = p.x - other.x;
            const dy = p.y - other.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 9.0 && distSq > 0.001) { // Repel within 3 tiles radius
              repX += dx * 0.5; // Push away from friendly
              repY += dy * 0.5;
            }
          }
        }

        // Resource discovery
        for (const res of this.map.resources) {
          if ((!race.hasGold && res.type === ResourceType.GOLD) || (!race.hasIron && res.type === ResourceType.IRON)) {
            const dx = res.x - p.x;
            const dy = res.y - p.y;
            if (dx * dx + dy * dy < 25) { // within 5 tiles
              if (res.type === ResourceType.GOLD) {
                race.hasGold = true;
                if (this.onEvent) this.onEvent(`💰 ${race.name} bir ALTIN madeni buldu! (Nüfus Artışı +)`, 'tech');
              } else {
                race.hasIron = true;
                if (this.onEvent) this.onEvent(`⛏️ ${race.name} bir DEMİR madeni buldu! (Saldırı Gücü +)`, 'tech');
              }
            }
          }
        }

        // Reproduction (grow towards max cap)
        const growthChance = race.hasGold ? 0.0016 : 0.0012; // increased reproduction
        if (currentTotalPop < this.maxPopulation && Math.random() < growthChance) {
          const px = p.x + (Math.random() * 0.4 - 0.2);
          const py = p.y + (Math.random() * 0.4 - 0.2);
          race.persons.push(new Person(px, py, race.id, 0)); // Newborns start at age 0
          currentTotalPop++;
        }

        if (nearestEnemy) {
          // Move towards enemy
          const dx = nearestEnemy.x - p.x;
          const dy = nearestEnemy.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let attackRange = race.hasRifles ? 4 : 0.8;
          if (race.hasBombs) attackRange = 5;

          if (dist > attackRange) {
            p.vx = (dx / dist) * maxSpeed;
            p.vy = (dy / dist) * maxSpeed;
          } else {
            p.vx = 0;
            p.vy = 0;
            // Attack
            if (p.attackCooldown <= 0) {
              if (race.hasBombs && Math.random() < 0.2) {
                // throw bomb
                const bvx = (dx / dist) * 0.3;
                const bvy = (dy / dist) * 0.3;
                this.projectiles.push({ x: p.x, y: p.y, vx: bvx, vy: bvy, color: '#000', life: 15, isBomb: true });
                // deal immediate area damage
                for (const splashTarget of allPersons) {
                  if (splashTarget.raceId !== race.id) {
                    const sdx = splashTarget.x - nearestEnemy.x;
                    const sdy = splashTarget.y - nearestEnemy.y;
                    if (sdx * sdx + sdy * sdy < 4) {
                      splashTarget.hp -= 50;
                    }
                  }
                }
                p.attackCooldown = 30; // 3 seconds
              } else if (race.hasRifles) {
                // shoot
                const bvx = (dx / dist) * 0.6;
                const bvy = (dy / dist) * 0.6;
                this.projectiles.push({ x: p.x, y: p.y, vx: bvx, vy: bvy, color: '#ffff00', life: 8, isBomb: false });
                nearestEnemy.hp -= race.hasIron ? 35 : 25;
                p.attackCooldown = 10; // 1 second
              } else {
                // melee
                const baseDmg = race.hasSwords ? 35 : 15;
                nearestEnemy.hp -= race.hasIron ? baseDmg + 10 : baseDmg;
                p.attackCooldown = 8;
              }
            }
          }
        } else {
          // No immediate enemy, try to coordinate attack towards enemy nation center
          let targetCenter: { x: number, y: number } | null = null;
          for (const [otherId, state] of race.relations.entries()) {
            if (state === Diplomacy.WAR) {
              const center = raceCenters.get(otherId);
              if (center) {
                targetCenter = center;
                break;
              }
            }
          }

          if (targetCenter) {
            if (!race.flowField) {
              race.flowField = new FlowField(Math.ceil(this.map.cols / 4), Math.ceil(this.map.rows / 4));
            }
            const distToTarget = Math.hypot(race.flowField.targetX - targetCenter.x, race.flowField.targetY - targetCenter.y);
            if (distToTarget > 10 || this.tickCount % 100 === 0) {
              race.flowField.calculate(this.map, targetCenter.x, targetCenter.y, race.seafaring);
            }
          } else {
            race.flowField = null;
          }

          if (targetCenter) {
            // March towards enemy center using Flow Field
            if (race.flowField) {
              const dir = race.flowField.getDir(p.x, p.y);
              if (dir) {
                // Apply laneOffset perpendicular to the flow vector for spreading
                p.vx = dir.vx * maxSpeed - dir.vy * p.laneOffset;
                p.vy = dir.vy * maxSpeed + dir.vx * p.laneOffset;
              } else {
                // fallback to direct line if flowfield has no data (e.g. enclosed area)
                const dx = targetCenter.x - p.x;
                const dy = targetCenter.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) {
                  p.vx = (dx / dist) * maxSpeed;
                  p.vy = (dy / dist) * maxSpeed;
                }
              }
            }
            // If roughly reached center, wander slightly
            const dx = targetCenter.x - p.x;
            const dy = targetCenter.y - p.y;
            if (Math.sqrt(dx*dx + dy*dy) <= 5 && (Math.random() < 0.05 || (p.vx === 0 && p.vy === 0))) {
                const angle = Math.random() * Math.PI * 2;
                p.vx = Math.cos(angle) * maxSpeed * 0.5;
                p.vy = Math.sin(angle) * maxSpeed * 0.5;
            }
          } else {
              // Peaceful exploration
              if (p.targetX === null || p.targetY === null || Math.random() < 0.005) {
                if (race.seafaring && Math.random() < 0.1) {
                  // 10% chance to explore far across the sea (colonization)
                  p.targetX = Math.random() * this.map.cols;
                  p.targetY = Math.random() * this.map.rows;
                } else {
                  // 90% chance to expand locally
                  p.targetX = p.x + (Math.random() - 0.5) * 50;
                  p.targetY = p.y + (Math.random() - 0.5) * 50;
                }
              }

              const dx = p.targetX - p.x;
              const dy = p.targetY - p.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 2) {
                p.vx = (dx / dist) * maxSpeed * 0.5; // Walk slowly when exploring
                p.vy = (dy / dist) * maxSpeed * 0.5;
              } else {
                p.targetX = null;
                p.targetY = null;
              }
            }
          }

        if (p.attackCooldown > 0) p.attackCooldown--;

        // Apply Boids separation
        p.vx += repX;
        p.vy += repY;

        // Add a bit of jitter to avoid overlapping perfectly
        p.vx += (Math.random() - 0.5) * 0.1;
        p.vy += (Math.random() - 0.5) * 0.1;

        // Normalize again to avoid jitter pushing over maxSpeed
        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed > maxSpeed) {
          p.vx = (p.vx / currentSpeed) * maxSpeed;
          p.vy = (p.vy / currentSpeed) * maxSpeed;
        }

        // Attempt to move
        const nextX = p.x + p.vx;
        const nextY = p.y + p.vy;

        // Collision with map bounds & water/mountains
        const cell = this.map.getCell(Math.floor(nextX), Math.floor(nextY));
        const isBlocked = !cell || cell.biome === Biome.MOUNTAIN || (cell.biome === Biome.WATER && !race.seafaring);

        if (isBlocked) {
          // Flow Field handles main routing. This just prevents micro-stuck near pixel edges.
          const cellX = this.map.getCell(Math.floor(nextX), Math.floor(p.y));
          const blockedX = !cellX || cellX.biome === Biome.MOUNTAIN || (cellX.biome === Biome.WATER && !race.seafaring);

          const cellY = this.map.getCell(Math.floor(p.x), Math.floor(nextY));
          const blockedY = !cellY || cellY.biome === Biome.MOUNTAIN || (cellY.biome === Biome.WATER && !race.seafaring);

          if (!blockedX) {
            p.x = nextX;
          } else if (!blockedY) {
            p.y = nextY;
          } else {
            p.vx *= -1;
            p.vy *= -1;
            p.targetX = null; // give up and pick new target
            p.targetY = null;
          }
        } else {
          p.x = nextX;
          p.y = nextY;
        }

        // Randomly encounter other races and declare war/peace
        if (Math.random() < 0.01) {
          for (const otherRace of this.races.values()) {
            if (otherRace.id !== race.id && race.getRelation(otherRace.id) === Diplomacy.NEUTRAL) {
              // only encounter if they have a person nearby
              for (const op of otherRace.persons) {
                const distSq = (op.x - p.x) * (op.x - p.x) + (op.y - p.y) * (op.y - p.y);
                if (distSq < 25) {
                  this.handleEncounter(race, otherRace);
                  break;
                }
              }
            }
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

      if (isWar) {
        this.declareWar(race1, race2, true);
      } else {
        this.formAlliance(race1, race2);
      }
    }
  }

  public declareWar(raceA: Race, raceB: Race, isMain: boolean = true) {
    if (raceA.getRelation(raceB.id) === Diplomacy.WAR) return;
    
    raceA.setRelation(raceB.id, Diplomacy.WAR);
    raceB.setRelation(raceA.id, Diplomacy.WAR);

    if (isMain && this.onEvent) {
      this.onEvent(`⚔️ SAVAŞ: ${raceA.name} ile ${raceB.name} karşılaştı ve savaşa başladı!`, 'war');
    }

    // Call allies of A to war against B
    for (const [otherId, state] of raceA.relations.entries()) {
      if (state === Diplomacy.ALLY) {
        const ally = this.races.get(otherId);
        if (ally && ally.getRelation(raceB.id) !== Diplomacy.WAR) {
           if (this.onEvent) this.onEvent(`🎺 ${ally.name}, müttefiki ${raceA.name} için savaşa katıldı! Hedef: ${raceB.name}`, 'war');
           this.declareWar(ally, raceB, false);
        }
      }
    }

    // Call allies of B to war against A
    for (const [otherId, state] of raceB.relations.entries()) {
      if (state === Diplomacy.ALLY) {
        const ally = this.races.get(otherId);
        if (ally && ally.getRelation(raceA.id) !== Diplomacy.WAR) {
           if (this.onEvent) this.onEvent(`🎺 ${ally.name}, müttefiki ${raceB.name} için savaşa katıldı! Hedef: ${raceA.name}`, 'war');
           this.declareWar(ally, raceA, false);
        }
      }
    }
  }

  public formAlliance(raceA: Race, raceB: Race) {
    if (raceA.getRelation(raceB.id) === Diplomacy.ALLY) return;

    raceA.setRelation(raceB.id, Diplomacy.ALLY);
    raceB.setRelation(raceA.id, Diplomacy.ALLY);

    if (this.onEvent) {
      this.onEvent(`🤝 İTTİFAK: ${raceA.name} ile ${raceB.name} barış imzaladı.`, 'diplomacy');
    }

    // A joins B's wars
    for (const [otherId, state] of raceB.relations.entries()) {
      if (state === Diplomacy.WAR) {
        const enemy = this.races.get(otherId);
        if (enemy && raceA.getRelation(otherId) !== Diplomacy.WAR) {
          if (this.onEvent) this.onEvent(`🎺 ${raceA.name}, yeni müttefiki ${raceB.name}'nin savaşına katıldı! Hedef: ${enemy.name}`, 'war');
          this.declareWar(raceA, enemy, false);
        }
      }
    }

    // B joins A's wars
    for (const [otherId, state] of raceA.relations.entries()) {
      if (state === Diplomacy.WAR) {
        const enemy = this.races.get(otherId);
        if (enemy && raceB.getRelation(otherId) !== Diplomacy.WAR) {
          if (this.onEvent) this.onEvent(`🎺 ${raceB.name}, yeni müttefiki ${raceA.name}'nin savaşına katıldı! Hedef: ${enemy.name}`, 'war');
          this.declareWar(raceB, enemy, false);
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
    const cellW = canvasWidth / this.map.cols;
    const cellH = canvasHeight / this.map.rows;

    // Draw projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * cellW, p.y * cellH, p.isBomb ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw people
    for (const race of this.races.values()) {
      ctx.fillStyle = race.color;
      for (const p of race.persons) {
        const px = p.x * cellW;
        const py = p.y * cellH;

        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2); // Radius increased from 3 to 6
        ctx.fill();

        // Draw weapon
        if (race.hasSwords || race.hasRifles) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2; // Weapon thicker
          ctx.beginPath();
          ctx.moveTo(px, py);

          let angle = Math.atan2(p.vy, p.vx);
          if (p.vx === 0 && p.vy === 0) angle = 0;

          const weaponLen = race.hasRifles ? 12 : 8; // Weapon longer
          ctx.lineTo(px + Math.cos(angle) * weaponLen, py + Math.sin(angle) * weaponLen);
          ctx.stroke();
        }

        // Draw HP bar if hurt
        if (p.hp < p.maxHp) {
          ctx.fillStyle = '#f00';
          ctx.fillRect(px - 6, py - 10, 12, 3);
          ctx.fillStyle = '#0f0';
          ctx.fillRect(px - 6, py - 10, 12 * (p.hp / p.maxHp), 3);
          ctx.fillStyle = race.color; // restore
        }
      }
    }
  }

  private checkGameOver() {
    if (!this.hasStarted || this.gameOver || this.races.size === 0) return;

    const raceArray = Array.from(this.races.values());

    if (raceArray.length === 1) {
      // Single winner
      this.gameOver = true;
      const winner = raceArray[0];
      this.winnerName = winner.name;
      if (this.onEvent) this.onEvent(`🏆 ${winner.name} DÜNYAYA HAKİM OLDU!`, 'diplomacy');
      return;
    }

    // Multiple races: Game is over ONLY if ALL of them are allies with each other.
    let allAllied = true;
    for (let i = 0; i < raceArray.length; i++) {
      for (let j = i + 1; j < raceArray.length; j++) {
        if (raceArray[i].getRelation(raceArray[j].id) !== Diplomacy.ALLY) {
          allAllied = false;
          break;
        }
      }
      if (!allAllied) break;
    }

    if (allAllied) {
      this.gameOver = true;
      const names = raceArray.map(r => r.name).join(", ");
      this.winnerName = names + " ittifakı";
      if (this.onEvent) this.onEvent(`🏆 DÜNYA BARIŞI: ${names} ittifakı dünyaya hakim oldu!`, 'diplomacy');
    }
  }
}
