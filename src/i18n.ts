export const i18n = {
  en: {
    title: "God Mode",
    timeControls: "Time Controls",
    play: "Play",
    pause: "Pause",
    godActions: "God Actions",
    inspect: "Inspect",
    spawnRace: "Spawn Race",
    buildWall: "Build Mountain (Left: Build, Right: Erase)",
    meteor: "Meteor Strike",
    worldStats: "World Stats",
    races: "Races:",
    worldPop: "World Pop:",
    year: "Year:",
    promptRaceName: "Enter name for the new race:",
    unnamedRace: "Unnamed Race",
    lang: "TR", // The button switches TO Turkish
    racesList: "Active Races",
    atWarWith: "At war with:",
    alliedWith: "Allied with:",
    modalOk: "OK",
    modalCancel: "Cancel"
  },
  tr: {
    title: "Tanrı Modu",
    timeControls: "Zaman Kontrolü",
    play: "Başlat",
    pause: "Durdur",
    godActions: "Tanrı Yetenekleri",
    inspect: "İncele",
    spawnRace: "Irk Yarat",
    buildWall: "Sıradağ Çek (Sol: Yap, Sağ: Yık)",
    meteor: "Meteor Düşür",
    worldStats: "Dünya İstatistikleri",
    races: "Irklar:",
    worldPop: "Dünya Nüfusu:",
    year: "Yıl:",
    promptRaceName: "Yeni ırk için isim girin:",
    unnamedRace: "İsimsiz Irk",
    lang: "EN", // The button switches TO English
    racesList: "Aktif Irklar",
    atWarWith: "Savaşılan:",
    alliedWith: "Müttefik:",
    modalOk: "Tamam",
    modalCancel: "İptal"
  }
};

export let currentLang: 'en' | 'tr' = 'tr'; // Default to Turkish per user request

export function setLang(lang: 'en' | 'tr') {
  currentLang = lang;
}

export function t(key: keyof typeof i18n['en']): string {
  return i18n[currentLang][key];
}
