import './style.css';
import { GameEngine, GodAction } from './engine';
import { ResourceType } from './map';
import { currentLang, setLang, t } from './i18n';
import { Diplomacy } from './civilization';
import { Biome } from './map';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  const engine = new GameEngine(canvas);

  // --- UI Elements ---
  const btnPlayPause = document.getElementById('btn-play-pause') as HTMLButtonElement;
  const speedButtons = document.querySelectorAll('.btn-speed');
  const actionButtons = document.querySelectorAll('.btn-action');
  const btnLang = document.getElementById('btn-lang') as HTMLButtonElement;
  
  const statRaces = document.getElementById('stat-races')!;
  const statPop = document.getElementById('stat-pop')!;
  const statYear = document.getElementById('stat-year')!;
  const racesList = document.getElementById('races-list')!;
  const notificationsContainer = document.getElementById('notifications-container')!;

  // DOM Elements for i18n
  const uiTitle = document.getElementById('ui-title')!;
  const uiTimeControls = document.getElementById('ui-time-controls')!;
  const uiGodActions = document.getElementById('ui-god-actions')!;
  const uiWorldStats = document.getElementById('ui-world-stats')!;
  const uiRacesListTitle = document.getElementById('ui-races-list-title')!;
  
  const uiInspect = document.getElementById('ui-inspect')!;
  const uiSpawn = document.getElementById('ui-spawn')!;
  const uiBuild = document.getElementById('ui-build')!;
  const uiMeteor = document.getElementById('ui-meteor')!;

  const uiStatRaces = document.getElementById('ui-stat-races')!;
  const uiStatPop = document.getElementById('ui-stat-pop')!;
  const uiStatYear = document.getElementById('ui-stat-year')!;

  const raceModal = document.getElementById('race-modal')!;
  const uiModalTitle = document.getElementById('ui-modal-title')!;
  const modalInput = document.getElementById('modal-input') as HTMLInputElement;
  const modalCancel = document.getElementById('modal-cancel')!;
  const modalOk = document.getElementById('modal-ok')!;

  const inspectModal = document.getElementById('inspect-modal')!;
  const inspectClose = document.getElementById('inspect-close')!;
  const inspectName = document.getElementById('inspect-name')!;
  const inspectPop = document.getElementById('inspect-pop')!;
  const inspectArea = document.getElementById('inspect-area')!;
  const inspectHome = document.getElementById('inspect-home')!;
  const inspectBuff = document.getElementById('inspect-buff')!;
  const inspectTech = document.getElementById('inspect-tech')!;
  const inspectDiplomacy = document.getElementById('inspect-diplomacy')!;
  const inspectRename = document.getElementById('inspect-rename')!;
  const inspectDelete = document.getElementById('inspect-delete')!;

  let pendingSpawn: {x: number, y: number} | null = null;
  let currentInspectedRaceId: number | null = null;
  
  // Notification history
  interface NotificationRecord { msg: string; type?: string; time: number; }
  const notificationHistory: NotificationRecord[] = [];
  const btnNotifHistory = document.getElementById('btn-notif-history')!;
  const notifHistoryPanel = document.getElementById('notif-history-panel')!;
  const notifHistoryList = document.getElementById('notif-history-list')!;
  const btnCloseNotif = document.getElementById('btn-close-notif')!;

  // Game over
  const gameOverModal = document.getElementById('game-over-modal')!;
  const gameOverText = document.getElementById('game-over-text')!;
  const gameOverClose = document.getElementById('game-over-close')!;

  function applyLanguage() {
    uiTitle.textContent = t('title');
    uiTimeControls.textContent = t('timeControls');
    uiGodActions.textContent = t('godActions');
    uiWorldStats.textContent = t('worldStats');
    uiRacesListTitle.textContent = t('racesList');

    uiInspect.textContent = t('inspect');
    uiSpawn.textContent = t('spawnRace');
    uiBuild.textContent = t('buildWall');
    uiMeteor.textContent = t('meteor');

    uiStatRaces.textContent = t('races');
    uiStatPop.textContent = t('worldPop');
    uiStatYear.textContent = t('year');
    
    uiModalTitle.textContent = t('promptRaceName');
    modalInput.placeholder = t('promptRaceName');
    modalCancel.textContent = t('modalCancel');
    modalOk.textContent = t('modalOk');

    btnLang.textContent = t('lang');
    updatePlayPauseButton();
    updateRacesList(); // refresh translated strings in list
  }

  btnLang.addEventListener('click', () => {
    setLang(currentLang === 'tr' ? 'en' : 'tr');
    applyLanguage();
  });

  // --- Resource Inspect Modal ---
  const inspectResModal = document.getElementById('inspect-res-modal') as HTMLElement;
  const inspectResName = document.getElementById('inspect-res-name') as HTMLElement;
  const inspectResDesc = document.getElementById('inspect-res-desc') as HTMLElement;
  const inspectResBuff = document.getElementById('inspect-res-buff') as HTMLElement;
  const inspectResClose = document.getElementById('inspect-res-close') as HTMLButtonElement;

  inspectResClose.addEventListener('click', () => {
    inspectResModal.style.display = 'none';
  });

  // --- Person Inspect Modal ---
  const inspectPersonModal = document.getElementById('inspect-person-modal') as HTMLElement;
  const inspectPersonRace = document.getElementById('inspect-person-race') as HTMLElement;
  const inspectPersonAge = document.getElementById('inspect-person-age') as HTMLElement;
  const inspectPersonHp = document.getElementById('inspect-person-hp') as HTMLElement;
  const inspectPersonClose = document.getElementById('inspect-person-close') as HTMLButtonElement;

  inspectPersonClose.addEventListener('click', () => {
    inspectPersonModal.style.display = 'none';
  });

  engine.onInspectPersonRequest = (person, raceId) => {
    engine.pause();
    updatePlayPauseButton();
    const race = engine.civManager.races.get(raceId);
    if (!race) return;

    inspectPersonRace.innerHTML = `<span style="display:inline-block; width:12px; height:12px; background:${race.color}; border-radius:50%;"></span> ${race.name}`;
    inspectPersonAge.textContent = Math.floor(person.age).toString();
    inspectPersonHp.innerHTML = `${Math.floor(person.hp)} / ${person.maxHp} <div style="width:100%; height:5px; background:#333; margin-top:3px; border-radius:2px;"><div style="width:${Math.max(0, (person.hp / person.maxHp) * 100)}%; height:100%; background:#4ecca3; border-radius:2px;"></div></div>`;
    
    inspectPersonModal.style.display = 'flex';
  };

  engine.onInspectResourceRequest = (res) => {
    engine.pause();
    updatePlayPauseButton();
    
    if (res.type === ResourceType.GOLD) {
      inspectResName.innerHTML = '💰 Altın Madeni';
      inspectResDesc.textContent = 'Parıltılı ve değerli bir maden yatağı. Bu madenin etrafına yerleşen veya keşfeden ırklar zenginleşir.';
      inspectResBuff.textContent = 'Keşfeden ırkın nüfusu %20 daha hızlı artar.';
    } else {
      inspectResName.innerHTML = '⛏️ Demir Madeni';
      inspectResDesc.textContent = 'Sert ve dayanıklı metallerin çıkarılabildiği bir maden yatağı. Silah yapımı için vazgeçilmezdir.';
      inspectResBuff.textContent = 'Keşfeden ırkın askerleri yakın ve uzak mesafe saldırılarında +10 Bonus Hasar vurur.';
    }
    
    inspectResModal.style.display = 'flex';
  };

  // --- Controls ---
  btnPlayPause.addEventListener('click', () => {
    engine.togglePause();
    updatePlayPauseButton();
  });

  function updatePlayPauseButton() {
    if (engine.isRunning) {
      btnPlayPause.textContent = t('pause');
      btnPlayPause.classList.add('playing');
    } else {
      btnPlayPause.textContent = t('play');
      btnPlayPause.classList.remove('playing');
    }
  }

  speedButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      const speed = parseInt(target.getAttribute('data-speed') || '1');
      engine.setSpeed(speed);
      
      // Update UI
      speedButtons.forEach(b => b.classList.remove('active'));
      target.classList.add('active');
    });
  });

  actionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      const actionStr = target.getAttribute('data-action');
      
      let action: GodAction = GodAction.NONE;
      if (actionStr === 'spawn_race') action = GodAction.SPAWN_RACE;
      if (actionStr === 'build_mountain') action = GodAction.BUILD_MOUNTAIN;
      if (actionStr === 'disaster_meteor') action = GodAction.METEOR;

      engine.setAction(action);

      // Update UI
      actionButtons.forEach(b => b.classList.remove('active'));
      target.classList.add('active');
    });
  });

  function formatPop(pop: number): string {
    return Math.floor(pop).toString();
  }

  function updateRacesList() {
    racesList.innerHTML = '';
    
    // Sort by population descending
    const races = Array.from(engine.civManager.races.values())
      .filter(r => r.population > 0)
      .sort((a, b) => b.population - a.population);
      
    for (const race of races) {
      
      const el = document.createElement('div');
      el.style.backgroundColor = 'rgba(0,0,0,0.2)';
      el.style.padding = '8px';
      el.style.borderRadius = '4px';
      el.style.borderLeft = `4px solid ${race.color}`;

      let relationsText = '';
      let enemies: string[] = [];
      let allies: string[] = [];
      
      for (const [otherId, state] of race.relations.entries()) {
        const otherRace = engine.civManager.races.get(otherId);
        if (otherRace && otherRace.population > 0) {
          if (state === Diplomacy.WAR) enemies.push(otherRace.name);
          if (state === Diplomacy.ALLY) allies.push(otherRace.name);
        }
      }

      if (enemies.length > 0) {
        relationsText += `<br/><small style="color:#ff6b6b">${t('atWarWith')} ${enemies.join(', ')}</small>`;
      }
      if (allies.length > 0) {
        relationsText += `<br/><small style="color:#4ecca3">${t('alliedWith')} ${allies.join(', ')}</small>`;
      }

      el.innerHTML = `<strong>${race.name}</strong> (Pop: ${formatPop(race.population)})${relationsText}`;
      racesList.appendChild(el);
    }
  }

  // --- Modal Logic ---
  engine.onSpawnRequest = (x, y) => {
    pendingSpawn = {x, y};
    modalInput.value = '';
    raceModal.style.display = 'flex';
    setTimeout(() => modalInput.focus(), 50);
  };

  function closeModal() {
    raceModal.style.display = 'none';
    pendingSpawn = null;
  }

  modalCancel.addEventListener('click', closeModal);
  
  modalOk.addEventListener('click', () => {
    if (pendingSpawn) {
      const name = modalInput.value.trim() || t('unnamedRace');
      if (engine.civManager.spawnRace(pendingSpawn.x, pendingSpawn.y, name)) {
        showNotification(`✨ ${name} ırkı dünyaya ayak bastı.`);
      }
      // force draw to see it immediately since engine might be paused
      engine.draw();
    }
    closeModal();
  });

  modalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      modalOk.click();
    }
    if (e.key === 'Escape') {
      modalCancel.click();
    }
  });

  inspectClose.addEventListener('click', () => {
    inspectModal.style.display = 'none';
    currentInspectedRaceId = null;
  });

  engine.onInspectRequest = (raceId) => {
    const race = engine.civManager.races.get(raceId);
    if (!race) return;
    currentInspectedRaceId = raceId;

    inspectName.innerHTML = `<span style="display:inline-block; width:12px; height:12px; background:${race.color}; border-radius:50%;"></span> ${race.name}`;
    inspectPop.textContent = Math.floor(race.population).toString();
    inspectArea.textContent = 'Göçebe (Nomad)';

    let biomeStr = '';
    let buffStr = '';
    if (race.originBiome === Biome.FOREST) {
      biomeStr = 'Orman (Forest)';
      buffStr = '%20 daha hızlı nüfus artışı';
    } else if (race.originBiome === Biome.SAND) {
      biomeStr = 'Çöl (Sand)';
      buffStr = 'Savaşlarda %15 saldırı avantajı';
    } else if (race.originBiome === Biome.SNOW) {
      biomeStr = 'Kutup (Snow)';
      buffStr = 'Toprak savunmasında %15 avantaj';
    } else {
      biomeStr = 'Çimenlik (Grass)';
      buffStr = 'Dengeli (Bonus yok)';
    }
    
    inspectHome.textContent = biomeStr;
    inspectBuff.textContent = buffStr;

    const techs = [];
    if (race.seafaring) techs.push('Denizcilik (Seafaring)');
    if (race.heatResistance) techs.push('Sıcak Direnci (Heat Res)');
    if (race.coldResistance) techs.push('Soğuk Direnci (Cold Res)');
    if (race.hasSwords) techs.push('Kılıç (Sword)');
    if (race.hasRifles) techs.push('Tüfek (Rifle)');
    if (race.hasBombs) techs.push('Bomba (Bomb)');
    if (race.hasGold) techs.push('Altın (Nüfus Artışı)');
    if (race.hasIron) techs.push('Demir (Ekstra Hasar)');
    inspectTech.textContent = techs.length > 0 ? techs.join(', ') : 'Yok';

    let diplomacyHtml = '';
    let hasRelations = false;
    for (const [otherId, state] of race.relations.entries()) {
      const otherRace = engine.civManager.races.get(otherId);
      if (otherRace && otherRace.population > 0) {
        hasRelations = true;
        if (state === Diplomacy.WAR) {
          diplomacyHtml += `<div style="color:#ff6b6b">⚔️ Savaşta: ${otherRace.name}</div>`;
        } else if (state === Diplomacy.ALLY) {
          diplomacyHtml += `<div style="color:#4ecca3">🤝 Dost: ${otherRace.name}</div>`;
        }
      }
    }
    if (!hasRelations) diplomacyHtml = '<div>Henüz bir ilişki yok.</div>';
    
    inspectDiplomacy.innerHTML = diplomacyHtml;
    
    inspectModal.style.display = 'flex';
  };

  inspectRename.addEventListener('click', () => {
    if (currentInspectedRaceId === null) return;
    const race = engine.civManager.races.get(currentInspectedRaceId);
    if (race) {
      const newName = prompt(t('promptRaceName') || 'Yeni isim girin:', race.name);
      if (newName && newName.trim() !== '') {
        race.name = newName.trim();
        inspectName.innerHTML = `<span style="display:inline-block; width:12px; height:12px; background:${race.color}; border-radius:50%;"></span> ${race.name}`;
      }
    }
  });

  inspectDelete.addEventListener('click', () => {
    if (currentInspectedRaceId === null) return;
    const race = engine.civManager.races.get(currentInspectedRaceId);
    if (race) {
      if (confirm(`"${race.name}" ırkını silmek istediğinize emin misiniz?`)) {
        race.persons = [];
        engine.civManager.races.delete(currentInspectedRaceId);
        
        inspectModal.style.display = 'none';
        currentInspectedRaceId = null;
        engine.draw();
      }
    }
  });

  // --- Update UI Stats Loop ---
  const uiFps = document.getElementById('ui-fps')!;
  
  function updateUI() {
    statRaces.textContent = `${engine.civManager.races.size}/${engine.civManager.maxRaces}`;
    statPop.textContent = formatPop(engine.civManager.getTotalPopulation());
    statYear.textContent = engine.year.toString();
    uiFps.textContent = `FPS: ${engine.fps}`;
    updateRacesList();
    requestAnimationFrame(updateUI);
  }

  // --- Notifications ---
  function showNotification(msg: string, type?: string) {
    // Save to history
    notificationHistory.push({ msg, type, time: Date.now() });
    if (notifHistoryPanel.style.display !== 'none') {
      renderNotificationHistory();
    }

    const el = document.createElement('div');
    el.textContent = msg;
    
    // Apply styling based on type
    el.className = `notif-item notif-${type || 'default'}`;
    el.style.fontFamily = 'monospace';
    el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
    el.style.opacity = '1';
    el.style.transition = 'opacity 1s ease-out';
    
    notificationsContainer.appendChild(el);
    
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 1000);
    }, 4000);
  }

  engine.onEvent = (msg, type) => {
    showNotification(msg, type);
  };

  btnNotifHistory.addEventListener('click', () => {
    if (notifHistoryPanel.style.display === 'none') {
      notifHistoryPanel.style.display = 'flex';
      renderNotificationHistory();
    } else {
      notifHistoryPanel.style.display = 'none';
    }
  });

  btnCloseNotif.addEventListener('click', () => {
    notifHistoryPanel.style.display = 'none';
  });

  function renderNotificationHistory() {
    notifHistoryList.innerHTML = '';
    // Reverse to show newest first
    const reversed = [...notificationHistory].reverse();
    for (const notif of reversed) {
      const el = document.createElement('div');
      el.className = `notif-item notif-${notif.type || 'default'}`;
      el.textContent = notif.msg;
      notifHistoryList.appendChild(el);
    }
  }

  // --- Game Over ---
  engine.onGameOver = (winnerName: string) => {
    engine.pause();
    updatePlayPauseButton();
    gameOverText.textContent = `${winnerName} Dünyaya Hakim Oldu!`;
    gameOverModal.style.display = 'flex';
  };

  gameOverClose.addEventListener('click', () => {
    gameOverModal.style.display = 'none';
  });

  // --- Start Game ---
  applyLanguage();
  updateUI();
  
  // Start the render loop, but isRunning is false by default, so it's paused
  engine.start(); 
});
