const feature = (prefix, index, name, apCost, ruleText, notes) => ({
  id: `konohiko-${prefix}-${index + 1}`,
  name,
  description: [Number.isFinite(apCost) ? `${apCost} AP.` : "", ruleText, notes].filter(Boolean).join(" "),
});

const trait = (kind, index, entry) => ({
  id: `konohiko-${kind}-${index + 1}`,
  name: entry.name,
  level: Number(entry.level) || 1,
  apValue: Math.abs(Number(entry.apValue ?? entry.apCost) || 0),
  description: [entry.ruleText, entry.notes].filter(Boolean).join(" "),
  requirements: "",
});

const spell = (entry, index, ritual = false) => ({
  name: entry.name,
  check: entry.check,
  value: entry.value,
  cost: entry.cost ?? "",
  effect: entry.effect ?? "",
  range: entry.range ?? "",
  duration: entry.duration ?? "",
  castingTime: entry.castingTime ?? "",
  notes: [
    ritual ? "Ritual / Elfenlied." : "",
    entry.improvementFactor ? `Steigerungsfaktor ${entry.improvementFactor}.` : "",
    entry.property ? `Merkmal: ${entry.property}.` : "",
    entry.extensions?.length ? `Erweiterungen: ${entry.extensions.join(", ")}.` : "",
    entry.notes,
  ].filter(Boolean).join(" "),
  id: `konohiko-${ritual ? "ritual" : "spell"}-${index + 1}`,
});

const advantages = [
  { name: "Zauberer", apCost: 25, notes: "Automatischer Vorteil." },
  { name: "Zweistimmiger Gesang", apCost: 5, notes: "Automatischer Vorteil." },
  {
    name: "Drachenblut: Purpurwurm",
    apCost: 40,
    ruleText: "Magiekunde-Proben sind um 2 erleichtert. Elementarzauber sind um 1 erleichtert. Feuerschaden gegen den Charakter wird um 2 TP gesenkt.",
    notes: "Gewähltes Zaubermerkmal: Elementar.",
  },
  { name: "Dunkelsicht", level: 1, apCost: 10 },
];

const disadvantages = [
  { name: "Pech", level: 1, apValue: -20, ruleText: "Reduziert den Startwert und das Maximum der Schicksalspunkte um 1." },
  { name: "Artefaktgebunden", apValue: -10, ruleText: "Ohne Hautkontakt zum Magierstab wirkt sich Artefaktgebunden auf die Magie aus.", notes: "Gebundenes Artefakt: Magierstab." },
  { name: "Wahrer Name", apValue: -10 },
  { name: "Weltfremd", apValue: -10, notes: "Bezug: Adel." },
  { name: "Jähzorn", apValue: -10, notes: "Voraussetzung für Blutrausch." },
  { name: "Blutrausch", apValue: -10, notes: "Setzt Jähzorn voraus." },
  { name: "Körpergebundene Kraft", apValue: -5, ruleText: "Die magische Kraft ist an die Haare gebunden.", notes: "Körperteil: Haare." },
  { name: "Goldgier", apValue: -5 },
];

const magicalSpecialAbilities = [
  ["Tradition: Gildenmagier", 155, "Leiteigenschaft ist KL. Ermöglicht die Nutzung gildenmagischer Traditionsartefakte. Zauber können schriftlich festgehalten und aus Büchern gelernt werden."],
  ["Scholar des Agrimeton", 12, "Zauber, die Feuer erzeugen, verursachen zusätzlich 2 TP.", "Aktuell profitiert insbesondere Ignifaxius."],
  ["Bindung des Stabes", 14, "Der Magierstab ist gebunden, magisch und nahezu unzerbrechlich.", "Die 2 permanenten AsP wurden zurückgekauft."],
  ["Kraftfokus", 30, "Solange der Charakter den Magierstab berührt, kosten Zauber 1 AsP weniger. Die Kosten können dadurch nicht unter 1 AsP sinken.", "Belegt 6 Volumenpunkte."],
  ["Seil des Adepten", 10, "", "Belegt 2 Volumenpunkte."],
  ["Seil des Magus", 15, "", "Belegt 4 Volumenpunkte. Setzt Seil des Adepten voraus."],
  ["Seilpeitsche", 15, "", "Belegt 5 Volumenpunkte. Teil der Voraussetzungskette zur Seilschlange."],
  ["Seilschlange", 10, "Der Magierstab kann in eine Seilschlange verwandelt werden.", "Belegt 5 Volumenpunkte. Während der Verwandlung kann der Kraftfokus nicht als normal gehaltener Stab genutzt werden."],
  ["Volumenerweiterung des Zauberstabes IV", 20, "Erhöht das Volumen des Magierstabes um 4.", "Der Stab besitzt dadurch insgesamt 22 Volumenpunkte. Die Erweiterung kostete 4 permanente AsP."],
  ["Rückkauf permanenter AsP der Volumenerweiterung", 8, "", "Die 4 permanenten AsP wurden zurückgekauft."],
  ["Bindung des Bannschwerts", 28, "Das Bannschwert ist gebunden, magisch und nahezu unzerbrechlich.", "Kategorie Schwerter. Enthält 20 AP für die Bindung und 8 AP für den Rückkauf der 4 permanenten AsP."],
  ["Verbotene Pforten", 10, "Zauberkosten können teilweise mit eigenen LeP bezahlt werden. Mindestens 1 AsP muss weiterhin eingesetzt werden."],
  ["Blutmagie: Selbstopfer", 12, "Nach einer Probe auf Selbstbeherrschung erzeugt 1 eigener LeP 1 AsP. Zusätzlich verliert der Charakter 1W3+1 LeP."],
  ["Blutmagie: Fremdopfer", 20, "Nach einer Probe auf Willenskraft erzeugt 1 LeP des Opfers 2 AsP. Zusätzlich verliert das Opfer 1W3+1 LeP."],
];

const spells = [
  {
    name: "Balsam Salabunde", check: "KL / IN / FF", value: 4, improvementFactor: "B",
    effect: "Heilt Lebenspunkte durch den Einsatz von Astralpunkten.",
    notes: "Eigenschaftswerte der Probe: 14/15/10. Gesamtkosten bis FW 4: 10 AP.",
  },
  {
    name: "Klarum Purum", check: "KL / IN / CH", value: 0, improvementFactor: "B",
    effect: "Neutralisiert Gifte abhängig von der erzielten Qualitätsstufe.",
    notes: "Eigenschaftswerte der Probe: 14/15/10. Aktivierungskosten: 2 AP.",
  },
  {
    name: "Blick in die Gedanken", check: "MU / KL / IN", value: 4, improvementFactor: "C",
    effect: "Liest die gegenwärtigen Gedanken des Ziels und kann Lügen, Absichten oder verborgene Informationen aufdecken.",
    notes: "Eigenschaftswerte der Probe: 12/14/15. Gesamtkosten bis FW 4: 15 AP.",
  },
  {
    name: "Ignifaxius", check: "MU / KL / CH", value: 10, improvementFactor: "C", property: "Elementar",
    effect: "Feuerangriff gegen ein einzelnes Ziel.",
    notes: "Eigenschaftswerte der Probe: 12/14/10. Durch Drachenblut: Purpurwurm um 1 erleichtert. Verursacht durch Scholar des Agrimeton zusätzlich 2 TP. Gesamtkosten bis FW 10: 33 AP.",
  },
  {
    name: "Odem Arcanum", check: "KL / IN / IN", value: 3, improvementFactor: "A", effect: "Erkennt Magie.",
    notes: "Eigenschaftswerte der Probe: 14/15/15. Gesamtkosten bis FW 3: 4 AP.",
  },
  {
    name: "Armatrutz", check: "KL / IN / FF", value: 0, improvementFactor: "A", effect: "Erzeugt magischen Rüstungsschutz.",
    notes: "Eigenschaftswerte der Probe: 14/15/10. Aktivierungskosten: 1 AP.",
  },
  {
    name: "Ecliptifactus", check: "MU / IN / CH", value: 0, cost: "4 AsP bei Aktivierung und 2 AsP pro Kampfrunde", improvementFactor: "C", property: "Dämonisch",
    effect: "Belebt den eigenen Schatten als kämpfende Kreatur.",
    notes: "Eigenschaftswerte der Probe: 12/15/10. Die Kosten sind nicht modifizierbar und werden nicht durch den Kraftfokus gesenkt. Aktivierungskosten: 3 AP.",
  },
  {
    name: "Gardianum", check: "MU / KL / CH", value: 0, improvementFactor: "B", effect: "Schützt gegen magischen Schaden.",
    notes: "Eigenschaftswerte der Probe: 12/14/10. Aktivierungskosten: 2 AP.",
  },
  {
    name: "Foramen", check: "KL / IN / FF", value: 8, improvementFactor: "C", extensions: ["Wiederverschließbar"],
    effect: "Öffnet einfache Schlösser und erleichtert bei komplizierten Schlössern das Schlösserknacken.",
    notes: "Eigenschaftswerte der Probe: 14/15/10. Zauber bis FW 8: 27 AP. Erweiterung Wiederverschließbar: 3 AP. Ein unbeschädigtes Schloss kann sich nach Ende der Wirkung wieder verschließen.",
  },
  {
    name: "Ignorantia", check: "IN / CH / GE", value: 8, improvementFactor: "B", property: "Einfluss",
    effect: "Das Ziel ignoriert den Zauberer und seine Handlungen, solange keine direkte Interaktion oder ein Angriff erfolgt.",
    notes: "Eigenschaftswerte der Probe: 15/10/8. Scharlatanischer Fremdzauber. Die Probe ist als Fremdzauber regulär um 2 erschwert. Eine ausdrücklich bewachte Tür oder ein bewachter Gegenstand kann weiterhin als verändert bemerkt werden. Gesamtkosten bis FW 8: 18 AP.",
  },
  {
    name: "Duplicatus", check: "KL / IN / CH", value: 0, improvementFactor: "C",
    effect: "Erzeugt illusionäre Doppelgänger, sodass Angriffe möglicherweise nur eine Illusion treffen.",
    notes: "Eigenschaftswerte der Probe: 14/15/10. Hilft nicht gegen Flächenangriffe. Aktivierungskosten: 3 AP.",
  },
  {
    name: "Spurlos", check: "KL / FF / KK", value: 8, improvementFactor: "B",
    effect: "Verhindert beziehungsweise verschleiert Bewegungs- und Verfolgungsspuren. Hinterlässt keine Fußabdrücke, keine geknickten Pflanzen und keinen verräterischen Geruch. Fährtensuchen ist um die Qualitätsstufe erschwert.",
    notes: "Eigenschaftswerte der Probe: 14/10/6. Gesamtkosten bis FW 8: 18 AP.",
  },
];

const rituals = [
  {
    name: "Freundschaftslied", check: "IN / CH / CH", value: 0, improvementFactor: "A",
    cost: "4 AsP pro Stunde und zusätzlich 1 permanenter AsP bei der letzten Strophe",
    castingTime: "Je 1 Stunde an 3 aufeinanderfolgenden Tagen", duration: "Dauerhaftes Freundschaftsband",
    effect: "Zwei Elfen knüpfen ein Freundschaftsband. Sie spüren ihre gegenseitige Anwesenheit und starke Emotionen auch über große Entfernungen. Sie können Balsam Salabunde gegenseitig ohne verbleibende AsP wirken und dabei eigene Lebensenergie übertragen.",
    notes: "Eigenschaftswerte der Probe: 15/10/10. Jeder Elf kann dieses Band nur einmal im Leben eingehen. Aktivierungskosten: 1 AP. Verwendetes Talent: Musizieren.",
  },
  {
    name: "Lied des Schmerzes", check: "MU / KL / IN", value: 0, improvementFactor: "D",
    notes: "Eigenschaftswerte der Probe: 12/14/15. Aktivierungskosten: 4 AP. Verwendetes Talent: Singen. Verzerrtes Elfenlied.",
  },
  {
    name: "Schlachtlied", check: "MU / IN / CH", value: 0, improvementFactor: "B",
    notes: "Eigenschaftswerte der Probe: 12/15/10. Aktivierungskosten: 2 AP. Verwendetes Talent: Singen oder Musizieren. Verzerrtes Elfenlied.",
  },
  {
    name: "Sklavenlied", check: "MU / IN / CH", value: 0, improvementFactor: "D",
    notes: "Eigenschaftswerte der Probe: 12/15/10. Aktivierungskosten: 4 AP. Verwendetes Talent: Musizieren. Verzerrtes Elfenlied.",
  },
];

const bodyParts = [
  ["head", "Kopf", 4], ["torso", "Oberkörper", 6],
  ["leftArm", "Linker Arm", 4], ["rightArm", "Rechter Arm", 4],
  ["leftLeg", "Linkes Bein", 5], ["rightLeg", "Rechtes Bein", 5],
  ["leftFoot", "Linker Fuß", 3], ["rightFoot", "Rechter Fuß", 3],
];

export function createKonohiko(ownerId) {
  return {
    id: "konohiko",
    ownerId,
    sessionActive: false,
    name: "Konohiko",
    title: "Nachtalbischer Schüler Agrimetons",
    profession: "Individuell erstellter Gildenmagier",
    species: "Nachtalb",
    culture: "Nachtalben der Nai Ashyrr",
    experienceLevel: "Erfahren",
    adventurePoints: 1100,
    spentAdventurePoints: 1090,
    lifePoints: 30,
    maxLifePoints: 30,
    astralPoints: 34,
    maxAstralPoints: 34,
    fatePoints: 2,
    maxFatePoints: 2,
    description: "Schüler des Agrimeton. Das Kulturpaket wurde nicht gekauft. Merkmale: Heiler, Betrüger, Blutmagier, Feuermagier und magischer Dieb. Abgeleitete Werte: Seelenkraft 3, Zähigkeit 0, Initiative 10+1W6, Ausweichen 4 und Geschwindigkeit 8.",
    quote: "",
    initials: "K",
    accent: "ruby",
    attributes: [
      { short: "MU", name: "Mut", value: 12 },
      { short: "KL", name: "Klugheit", value: 14 },
      { short: "IN", name: "Intuition", value: 15 },
      { short: "CH", name: "Charisma", value: 10 },
      { short: "FF", name: "Fingerfertigkeit", value: 10 },
      { short: "GE", name: "Gewandtheit", value: 8 },
      { short: "KO", name: "Konstitution", value: 14 },
      { short: "KK", name: "Körperkraft", value: 6 },
    ],
    talents: Object.entries({
      Selbstbeherrschung: 6,
      Willenskraft: 6,
      Überreden: 8,
      Menschenkenntnis: 2,
      "Heilkunde Wunden": 4,
      "Heilkunde Gift": 4,
      "Heilkunde Krankheiten": 2,
      Magiekunde: 7,
      Sphärenkunde: 4,
      Sinnesschärfe: 4,
    }).map(([name, value]) => ({ name, value })),
    spells: [...spells.map((entry, index) => spell(entry, index)), ...rituals.map((entry, index) => spell(entry, index, true))],
    combat: {
      attack: 13,
      parry: 6,
      dodge: 4,
      initiative: 10,
      speed: 8,
      armor: 0,
      techniques: [
        { id: "konohiko-technique-1", name: "Schwerter", kind: "melee", skill: 12, attack: 13, parry: 6, primaryAttribute: "GE oder KK", improvementCost: "", notes: "" },
        { id: "konohiko-technique-2", name: "Dolche", kind: "melee", skill: 6, attack: 0, parry: 0, primaryAttribute: "", improvementCost: "", notes: "AT und PA wurden nicht angegeben." },
        { id: "konohiko-technique-3", name: "Raufen", kind: "melee", skill: 6, attack: 0, parry: 0, primaryAttribute: "", improvementCost: "", notes: "AT und PA wurden nicht angegeben." },
        { id: "konohiko-technique-4", name: "Stangenwaffen", kind: "melee", skill: 6, attack: 0, parry: 0, primaryAttribute: "", improvementCost: "", notes: "AT und PA wurden nicht angegeben." },
      ],
    },
    languages: [
      { id: "konohiko-language-1", name: "Asdharia", level: 3, script: "Isdira-Zeichen", notes: "Muttersprache; Schrift vollständig erlernt." },
      { id: "konohiko-language-2", name: "Garethi", level: 3, script: "Kusliker Zeichen", notes: "6 AP; Schrift vollständig erlernt (2 AP)." },
    ],
    money: { ducats: 0, silver: 0, heller: 0 },
    advantages: advantages.map((entry, index) => trait("advantage", index, entry)),
    disadvantages: disadvantages.map((entry, index) => trait("disadvantage", index, entry)),
    specialAbilities: [
      feature("special", 0, "Fertigkeitsspezialisierung Überreden: Manipulieren", 3, "Bei passenden Proben auf Manipulieren gilt Überreden effektiv als FW 10.", ""),
    ],
    magicalSpecialAbilities: magicalSpecialAbilities.map(([name, apCost, ruleText, notes], index) => feature("magic", index, name, apCost, ruleText, notes)),
    cantrips: [
      feature("cantrip", 0, "Flammenhaar", null, "", ""),
      feature("cantrip", 1, "Wind im Haar", null, "", ""),
    ],
    resistances: [
      { id: "konohiko-resistance-1", name: "Feuerschaden", protection: 2, immune: false, weak: false, notes: "Drachenblut: Purpurwurm" },
    ],
    equipment: [
      {
        id: "konohiko-equipment-1", name: "Magierstab", quantity: 1, itemType: "weapon", category: "Waffe",
        weaponKind: "melee", combatTechnique: "Stangenwaffen", damage: "", damageThreshold: "", attackModifier: 0,
        parryModifier: 0, reach: "", weight: "", value: "", showOnBody: true, allowedSlots: ["rightHand", "leftHand"],
        notes: "Gebundenes magisches Traditionsartefakt mit Kraftfokus, vollständiger Seilschlangen-Kette und 22 von 22 belegten Volumenpunkten; nahezu unzerbrechlich.",
      },
      {
        id: "konohiko-equipment-2", name: "Mittleres Bannschwert", quantity: 1, itemType: "weapon", category: "Waffe",
        weaponKind: "melee", combatTechnique: "Schwerter", damage: "1W6+4", damageThreshold: "GE/KK 15", attackModifier: 0,
        parryModifier: 0, reach: "mittel", weight: "1 Stein", value: "200 Silbertaler", showOnBody: true, allowedSlots: ["rightHand", "leftHand", "belt"],
        notes: "Gebundenes magisches Traditionsartefakt; nahezu unzerbrechlich. Bannschwert des Adepten ist nicht gewählt.",
      },
    ],
    body: {
      equipmentVisibilityVersion: 1,
      parts: bodyParts.map(([id, label, maxDamage]) => ({ id, label, damage: 0, maxDamage, notes: "" })),
      statuses: [],
      equipped: {},
      history: [],
    },
  };
}
