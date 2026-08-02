import { useState, type FormEvent } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import type { CharacterTrait, CombatTechnique, EquipmentItem, EquipmentItemType, Hero, LanguageKnowledge, NamedFeature, ResistanceEntry, WeaponKind } from "../../models/Hero";
import { createId } from "../../utils/id";
import { NamedFeatureDetailModal, TraitDetailModal } from "./HeroDetailModals";
import ReorderButtons from "./ReorderButtons";
import { moveEntry } from "../../utils/array";

type HeroUpdater = (updater: (hero: Hero) => Hero) => void;

export function MoneyPouchPanel({ hero, updateHero }: { hero: Hero; updateHero: HeroUpdater }) {
  function setCoin(field: keyof Hero["money"], value: number) {
    updateHero((current) => ({ ...current, money: { ...current.money, [field]: Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)) } }));
  }
  return <article className="dsa-panel money-panel"><div className="panel-heading"><span>Geldbeutel</span><small>Münzen</small></div><div className="money-grid">
    <label><span>Dukaten</span><input type="number" min={0} value={hero.money.ducats} onChange={(event) => setCoin("ducats", Number(event.target.value))} /><small>D</small></label>
    <label><span>Silbertaler</span><input type="number" min={0} value={hero.money.silver} onChange={(event) => setCoin("silver", Number(event.target.value))} /><small>S</small></label>
    <label><span>Heller</span><input type="number" min={0} value={hero.money.heller} onChange={(event) => setCoin("heller", Number(event.target.value))} /><small>H</small></label>
  </div></article>;
}

export function CombatPanel({ hero, updateHero, setup, onInspectItem }: { hero: Hero; updateHero: HeroUpdater; setup: boolean; onInspectItem: (itemId: string) => void }) {
  const stats: { field: keyof Omit<Hero["combat"], "techniques">; label: string; short: string }[] = [
    { field: "soulpower", label: "Seelenkraft", short: "SK" }, { field: "tenacity", label: "Zähigkeit", short: "ZK" },
    { field: "dodge", label: "Ausweichen", short: "AW" }, { field: "initiative", label: "Initiative", short: "INI" },
    { field: "speed", label: "Geschwindigkeit", short: "GS" }, { field: "armor", label: "Rüstungsschutz", short: "RS" },
  ];
  function setStat(field: keyof Omit<Hero["combat"], "techniques">, value: number) {
    updateHero((current) => ({ ...current, combat: { ...current.combat, [field]: Math.max(0, Math.min(99, Number.isFinite(value) ? value : 0)) } }));
  }
  return <section className="dsa-panel tab-panel combat-panel">
    <div className="panel-heading"><span>Kampf</span><small>{setup ? "Kampfwerte, Techniken und Ausrüstung bearbeiten" : "Alle kampfrelevanten Werte"}</small></div>
    <div className="combat-stat-grid">{stats.map((stat) => <article key={stat.field}><span>{stat.short}</span>{setup ? <input type="number" min={0} max={99} value={hero.combat[stat.field]} onChange={(event) => setStat(stat.field, Number(event.target.value))} /> : <strong>{hero.combat[stat.field]}</strong>}<small>{stat.label}</small></article>)}</div>
    <CombatTechniquesSection hero={hero} updateHero={updateHero} setup={setup} embedded />
    <CombatEquipmentSection hero={hero} updateHero={updateHero} setup={setup} onInspectItem={onInspectItem} />
  </section>;
}

function signed(value: number | undefined) {
  const safe = Number(value) || 0;
  return safe > 0 ? `+${safe}` : String(safe);
}

function CombatEquipmentSection({ hero, updateHero, setup, onInspectItem }: { hero: Hero; updateHero: HeroUpdater; setup: boolean; onInspectItem: (itemId: string) => void }) {
  const [draft, setDraft] = useState({ name: "", itemType: "weapon" as Extract<EquipmentItemType, "weapon" | "shield">, weaponKind: "melee" as WeaponKind, combatTechnique: "", damage: "" });
  const combatItems = hero.equipment.filter((item) => item.itemType === "weapon" || item.itemType === "shield" || item.itemType === "armor");

  function addItem(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const item: EquipmentItem = {
      id: createId(),
      name: draft.name.trim(),
      quantity: 1,
      notes: "",
      itemType: draft.itemType,
      category: draft.itemType === "shield" ? "Schild" : "Waffe",
      weaponKind: draft.weaponKind,
      combatTechnique: draft.combatTechnique.trim(),
      damage: draft.damage.trim(),
      attackModifier: 0,
      parryModifier: 0,
      ammunition: 0,
      showOnBody: true,
      allowedSlots: ["rightHand", "leftHand"],
    };
    updateHero((current) => ({ ...current, equipment: [...current.equipment, item] }));
    setDraft({ name: "", itemType: "weapon", weaponKind: "melee", combatTechnique: "", damage: "" });
  }

  return <section className="subsection-card combat-equipment-section">
    <div className="subsection-heading"><div><span>Waffen, Schilde & Rüstung</span><small>Diese Einträge stammen direkt aus dem Inventar.</small></div></div>
    {setup && <Form className="combat-item-add-form" onSubmit={addItem}>
      <Form.Control required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Langschwert" />
      <Form.Select value={draft.itemType} onChange={(event) => setDraft({ ...draft, itemType: event.target.value as typeof draft.itemType })}><option value="weapon">Waffe</option><option value="shield">Schild</option></Form.Select>
      {draft.itemType === "weapon" && <Form.Select value={draft.weaponKind} onChange={(event) => setDraft({ ...draft, weaponKind: event.target.value as WeaponKind })}><option value="melee">Nahkampf</option><option value="ranged">Fernkampf</option></Form.Select>}
      <Form.Control value={draft.combatTechnique} onChange={(event) => setDraft({ ...draft, combatTechnique: event.target.value })} placeholder="Kampftechnik" />
      {draft.itemType === "weapon" && <Form.Control value={draft.damage} onChange={(event) => setDraft({ ...draft, damage: event.target.value })} placeholder="Schaden, z. B. 1W6+4" />}
      <Button type="submit" className="dsa-primary-button">Ins Inventar</Button>
    </Form>}
    {combatItems.length ? <div className="combat-item-grid">{combatItems.map((item) => <article key={item.id} className={`combat-item-card ${item.itemType}`}>
      <div className="combat-item-title"><div><span>{item.itemType === "weapon" ? item.weaponKind === "ranged" ? "Fernkampfwaffe" : "Nahkampfwaffe" : item.itemType === "shield" ? "Schild" : "Rüstung"}</span><strong>{item.name}</strong></div><button type="button" onClick={() => onInspectItem(item.id)}>{setup ? "Bearbeiten" : "Details"}</button></div>
      {item.itemType === "armor"
        ? <dl><div><dt>RS</dt><dd>{item.armor ?? 0}</dd></div><div><dt>BE</dt><dd>{item.encumbrance ?? 0}</dd></div><div><dt>Gewicht</dt><dd>{item.weight || "–"}</dd></div></dl>
        : <dl><div><dt>Technik</dt><dd>{item.combatTechnique || "–"}</dd></div>{item.itemType === "weapon" && <div><dt>TP</dt><dd>{item.damage || "–"}</dd></div>}<div><dt>AT</dt><dd>{signed(item.attackModifier)}</dd></div><div><dt>PA</dt><dd>{signed(item.parryModifier)}</dd></div>{item.weaponKind === "ranged" && <div><dt>Munition</dt><dd>{item.ammunition ?? 0}</dd></div>}</dl>}
      {(item.reach || item.range || item.reloadTime || item.notes) && <p>{[item.reach && `Reichweite ${item.reach}`, item.range && `Distanzen ${item.range}`, item.reloadTime && `Ladezeit ${item.reloadTime}`, item.notes].filter(Boolean).join(" · ")}</p>}
    </article>)}</div> : <p className="empty-status">Noch keine Waffen, Schilde oder Rüstungen im Inventar.</p>}
  </section>;
}

export function CombatTechniquesSection({ hero, updateHero, setup, embedded = false }: { hero: Hero; updateHero: HeroUpdater; setup: boolean; embedded?: boolean }) {
  const [draft, setDraft] = useState({ name: "", kind: "melee" as CombatTechnique["kind"] });
  function patchTechnique(id: string, patch: Partial<CombatTechnique>) {
    updateHero((current) => ({ ...current, combat: { ...current.combat, techniques: current.combat.techniques.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) } }));
  }
  function addTechnique(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const technique: CombatTechnique = { id: createId(), name: draft.name.trim(), kind: draft.kind, skill: 0, attack: 0, parry: draft.kind === "melee" ? 0 : null, primaryAttribute: "", improvementCost: "", notes: "" };
    updateHero((current) => ({ ...current, combat: { ...current.combat, techniques: [...current.combat.techniques, technique] } }));
    setDraft({ name: "", kind: "melee" });
  }
  function removeTechnique(id: string) {
    updateHero((current) => ({ ...current, combat: { ...current.combat, techniques: current.combat.techniques.filter((entry) => entry.id !== id) } }));
  }
  return <section className={`subsection-card combat-techniques${embedded ? " embedded" : ""}`}><div className="subsection-heading"><div><span>Kampftechniken</span><small>Schwerter, Bögen und weitere Waffenarten</small></div></div>{setup && <Form className="compact-add-form" onSubmit={addTechnique}><Form.Control required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Dolche" /><Form.Select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as CombatTechnique["kind"] })}><option value="melee">Nahkampf</option><option value="ranged">Fernkampf</option></Form.Select><Button type="submit" className="dsa-primary-button">Hinzufügen</Button></Form>}
    {hero.combat.techniques.length ? <div className="combat-technique-grid">{hero.combat.techniques.map((technique, index) => <article key={technique.id}>{setup ? <>
      <input className="technique-name" value={technique.name} onChange={(event) => patchTechnique(technique.id, { name: event.target.value })} />
      <label>KTaW<input type="number" min={0} value={technique.skill} onChange={(event) => patchTechnique(technique.id, { skill: Math.max(0, Number(event.target.value)) })} /></label>
      <label>AT<input type="number" min={0} value={technique.attack} onChange={(event) => patchTechnique(technique.id, { attack: Math.max(0, Number(event.target.value)) })} /></label>
      <label>PA<input type="number" min={0} disabled={technique.kind === "ranged"} value={technique.parry ?? ""} onChange={(event) => patchTechnique(technique.id, { parry: Math.max(0, Number(event.target.value)) })} /></label>
      <label>Leiteigenschaft<input value={technique.primaryAttribute} onChange={(event) => patchTechnique(technique.id, { primaryAttribute: event.target.value })} placeholder="GE/KK" /></label>
      <label>Steigerung<input value={technique.improvementCost} onChange={(event) => patchTechnique(technique.id, { improvementCost: event.target.value })} placeholder="C" /></label>
      <input className="technique-notes" value={technique.notes} onChange={(event) => patchTechnique(technique.id, { notes: event.target.value })} placeholder="Notiz" />
      <button type="button" className="list-delete" onClick={() => removeTechnique(technique.id)}>Entfernen</button>
      <ReorderButtons index={index} length={hero.combat.techniques.length} label={technique.name} onMove={(from, to) => updateHero((current) => ({ ...current, combat: { ...current.combat, techniques: moveEntry(current.combat.techniques, from, to) } }))} />
    </> : <><div className="technique-title"><strong>{technique.name}</strong><span>{technique.kind === "melee" ? "Nahkampf" : "Fernkampf"}</span></div><dl><div><dt>KTaW</dt><dd>{technique.skill}</dd></div><div><dt>AT</dt><dd>{technique.attack}</dd></div><div><dt>PA</dt><dd>{technique.parry ?? "–"}</dd></div><div><dt>Leiteig.</dt><dd>{technique.primaryAttribute || "–"}</dd></div><div><dt>Steigerung</dt><dd>{technique.improvementCost || "–"}</dd></div></dl>{technique.notes && <p>{technique.notes}</p>}</>}</article>)}</div> : <p className="empty-status">Noch keine Kampftechniken eingetragen.</p>}
  </section>;
}

export function LanguagesSection({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  const [name, setName] = useState("");
  function patchLanguage(id: string, patch: Partial<LanguageKnowledge>) { updateHero((current) => ({ ...current, languages: current.languages.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) })); }
  function addLanguage(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; updateHero((current) => ({ ...current, languages: [...current.languages, { id: createId(), name: name.trim(), level: 1, script: "", notes: "" }] })); setName(""); }
  return <section className="subsection-card languages-section"><div className="subsection-heading"><div><span>Sprachen & Schriften</span><small>Garethi, Isdira und weitere Kenntnisse</small></div></div>{setup && <Form className="compact-add-form language-add-form" onSubmit={addLanguage}><Form.Control required value={name} onChange={(event) => setName(event.target.value)} placeholder="Neue Sprache" /><Button type="submit" className="dsa-primary-button">Hinzufügen</Button></Form>}
    {hero.languages.length ? <div className="language-grid">{hero.languages.map((language, index) => <article key={language.id}>{setup ? <><input className="language-name" value={language.name} onChange={(event) => patchLanguage(language.id, { name: event.target.value })} /><label>Stufe<input type="number" min={0} max={3} value={language.level} onChange={(event) => patchLanguage(language.id, { level: Math.max(0, Math.min(3, Number(event.target.value))) })} /></label><label>Schrift<input value={language.script} onChange={(event) => patchLanguage(language.id, { script: event.target.value })} placeholder="optional" /></label><input className="language-notes" value={language.notes} onChange={(event) => patchLanguage(language.id, { notes: event.target.value })} placeholder="Notiz" /><button type="button" className="list-delete" onClick={() => updateHero((current) => ({ ...current, languages: current.languages.filter((entry) => entry.id !== language.id) }))}>Entfernen</button><ReorderButtons index={index} length={hero.languages.length} label={language.name} onMove={(from, to) => updateHero((current) => ({ ...current, languages: moveEntry(current.languages, from, to) }))} /></> : <><strong>{language.name}</strong><span>Stufe {language.level}</span><small>{language.script || "Keine Schrift"}{language.notes ? ` · ${language.notes}` : ""}</small></>}</article>)}</div> : <p className="empty-status">Noch keine Sprachen eingetragen.</p>}
  </section>;
}

function FeatureList({ title, subtitle, entries, setup, onChange }: { title: string; subtitle: string; entries: NamedFeature[]; setup: boolean; onChange: (entries: NamedFeature[]) => void }) {
  const [name, setName] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailEntry = entries.find((entry) => entry.id === detailId) ?? null;
  function add(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; onChange([...entries, { id: createId(), name: name.trim(), description: "" }]); setName(""); }
  function patch(patchValue: Partial<NamedFeature>) { if (detailId) onChange(entries.map((entry) => entry.id === detailId ? { ...entry, ...patchValue } : entry)); }
  function remove() { if (!detailId) return; onChange(entries.filter((entry) => entry.id !== detailId)); setDetailId(null); }
  return <section className="subsection-card magic-feature-list"><div className="subsection-heading"><div><span>{title}</span><small>{subtitle}</small></div></div>{setup && <Form className="compact-add-form language-add-form" onSubmit={add}><Form.Control required value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" /><Button type="submit" className="dsa-primary-button">Hinzufügen</Button></Form>}{entries.length ? <div className="feature-grid">{entries.map((entry, index) => <article key={entry.id}><button type="button" className="detail-list-card" onClick={() => setDetailId(entry.id)}><strong>{entry.name}</strong><p>{entry.description || "Details öffnen"}</p></button>{setup && <ReorderButtons index={index} length={entries.length} label={entry.name} onMove={(from, to) => onChange(moveEntry(entries, from, to))} />}</article>)}</div> : <p className="empty-status">Noch keine Einträge vorhanden.</p>}<NamedFeatureDetailModal feature={detailEntry} title={title} setup={setup} onHide={() => setDetailId(null)} onChange={patch} onDelete={remove} /></section>;
}

function TraitList({ title, subtitle, entries, setup, onChange, disadvantage = false }: { title: string; subtitle: string; entries: CharacterTrait[]; setup: boolean; onChange: (entries: CharacterTrait[]) => void; disadvantage?: boolean }) {
  const [draft, setDraft] = useState({ name: "", level: 1, apValue: 0 });
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailEntry = entries.find((entry) => entry.id === detailId) ?? null;
  function add(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    onChange([...entries, { id: createId(), name: draft.name.trim(), level: Math.max(1, draft.level), apValue: Math.max(0, draft.apValue), description: "", requirements: "" }]);
    setDraft({ name: "", level: 1, apValue: 0 });
  }
  const total = entries.reduce((sum, entry) => sum + entry.apValue * entry.level, 0);
  return <section className={`subsection-card trait-list ${disadvantage ? "disadvantage" : "advantage"}`}>
    <div className="subsection-heading"><div><span>{title}</span><small>{subtitle}</small></div><b>{total} AP</b></div>
    {setup && <Form className="trait-add-form" onSubmit={add}>
      <Form.Control required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={disadvantage ? "z. B. Verpflichtungen" : "z. B. Hohe Lebenskraft"} />
      <Form.Group><Form.Label>Stufe</Form.Label><Form.Control type="number" min={1} value={draft.level} onChange={(event) => setDraft({ ...draft, level: Math.max(1, Number(event.target.value)) })} /></Form.Group>
      <Form.Group><Form.Label>AP je Stufe</Form.Label><Form.Control type="number" min={0} value={draft.apValue} onChange={(event) => setDraft({ ...draft, apValue: Math.max(0, Number(event.target.value)) })} /></Form.Group>
      <Button type="submit" className="dsa-primary-button">Hinzufügen</Button>
    </Form>}
    {entries.length ? <div className="trait-grid">{entries.map((entry, index) => <article key={entry.id}>
      <button type="button" className="trait-detail-button" onClick={() => setDetailId(entry.id)}><div className="trait-card-heading"><div><strong>{entry.name}</strong><small>Stufe {entry.level}</small></div><b>{entry.apValue * entry.level} AP</b></div><p>{entry.description || "Details öffnen"}</p>{entry.requirements && <small>Voraussetzungen: {entry.requirements}</small>}</button>
      {setup && <ReorderButtons index={index} length={entries.length} label={entry.name} onMove={(from, to) => onChange(moveEntry(entries, from, to))} />}
    </article>)}</div> : <p className="empty-status">Noch keine {title.toLowerCase()} eingetragen.</p>}
    <TraitDetailModal trait={detailEntry} title={title} setup={setup} onHide={() => setDetailId(null)} onChange={(patch) => { if (detailId) onChange(entries.map((entry) => entry.id === detailId ? { ...entry, ...patch } : entry)); }} onDelete={() => { if (detailId) onChange(entries.filter((entry) => entry.id !== detailId)); setDetailId(null); }} />
  </section>;
}

export function TraitsPanel({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  const advantageAp = hero.advantages.reduce((sum, entry) => sum + entry.apValue * entry.level, 0);
  const disadvantageAp = hero.disadvantages.reduce((sum, entry) => sum + entry.apValue * entry.level, 0);
  return <section className="dsa-panel tab-panel traits-panel">
    <div className="panel-heading"><span>Vorteile & Nachteile</span><small>{setup ? "Einträge und AP-Werte bearbeiten" : "Besondere Eigenschaften des Helden"}</small></div>
    <div className="trait-summary"><article><span>Vorteile</span><strong>{advantageAp} AP</strong><small>{hero.advantages.length} Einträge</small></article><article><span>Nachteile</span><strong>{disadvantageAp} AP</strong><small>{hero.disadvantages.length} Einträge</small></article><article><span>Differenz</span><strong>{advantageAp - disadvantageAp} AP</strong><small>Nur als Übersicht, keine automatische AP-Buchung</small></article></div>
    <div className="trait-columns">
      <TraitList title="Vorteile" subtitle="Begabungen, besondere Herkunft und körperliche Vorzüge" entries={hero.advantages} setup={setup} onChange={(entries) => updateHero((current) => ({ ...current, advantages: entries }))} />
      <TraitList title="Nachteile" subtitle="Verpflichtungen, Ängste und sonstige Einschränkungen" entries={hero.disadvantages} setup={setup} disadvantage onChange={(entries) => updateHero((current) => ({ ...current, disadvantages: entries }))} />
    </div>
    <FeatureList title="Allgemeine Sonderfertigkeiten" subtitle="Spezialisierungen und weitere nichtmagische Fähigkeiten" entries={hero.specialAbilities} setup={setup} onChange={(entries) => updateHero((current) => ({ ...current, specialAbilities: entries }))} />
  </section>;
}

export function MagicExtrasSection({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  return <div className="magic-extras"><FeatureList title="Magische Sonderfertigkeiten" subtitle="Merkmalskenntnisse und weitere magische Fähigkeiten" entries={hero.magicalSpecialAbilities} setup={setup} onChange={(entries) => updateHero((current) => ({ ...current, magicalSpecialAbilities: entries }))} /><FeatureList title="Zaubertricks" subtitle="Kleine magische Kunststücke" entries={hero.cantrips} setup={setup} onChange={(entries) => updateHero((current) => ({ ...current, cantrips: entries }))} /></div>;
}

export function ResistancePanel({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  const [name, setName] = useState("");
  function patchEntry(id: string, patch: Partial<ResistanceEntry>) { updateHero((current) => ({ ...current, resistances: current.resistances.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) })); }
  function addEntry(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; updateHero((current) => ({ ...current, resistances: [...current.resistances, { id: createId(), name: name.trim(), protection: 0, immune: false, weak: false, notes: "" }] })); setName(""); }
  return <section className="dsa-panel tab-panel resistance-panel"><div className="panel-heading"><span>Resistenzen, Immunitäten & Schwächen</span><small>{setup ? "Schutzarten und Schwächen bearbeiten" : "Elementare und besondere Widerstände"}</small></div>{setup && <Form className="compact-add-form resistance-add-form" onSubmit={addEntry}><Form.Control required value={name} onChange={(event) => setName(event.target.value)} placeholder="z. B. Kälte" /><Button type="submit" className="dsa-primary-button">Eintrag hinzufügen</Button></Form>}
    {hero.resistances.length ? <div className="resistance-grid">{hero.resistances.map((entry) => <article key={entry.id} className={entry.immune ? "immune" : entry.weak ? "weak" : ""}>{setup ? <><input className="resistance-name" value={entry.name} onChange={(event) => patchEntry(entry.id, { name: event.target.value })} /><label>Schutzwert<input type="number" min={0} disabled={entry.immune || entry.weak} value={entry.protection} onChange={(event) => patchEntry(entry.id, { protection: Math.max(0, Number(event.target.value)) })} /></label><div className="resistance-switches"><Form.Check type="switch" id={`immune-${entry.id}`} label="Immun" checked={entry.immune} onChange={(event) => patchEntry(entry.id, { immune: event.target.checked, weak: event.target.checked ? false : entry.weak })} /><Form.Check type="switch" id={`weak-${entry.id}`} label="Schwäche" checked={entry.weak} onChange={(event) => patchEntry(entry.id, { weak: event.target.checked, immune: event.target.checked ? false : entry.immune })} /></div><textarea value={entry.notes} onChange={(event) => patchEntry(entry.id, { notes: event.target.value })} placeholder="Auswirkung, Quelle oder Notiz" /><button type="button" className="list-delete" onClick={() => updateHero((current) => ({ ...current, resistances: current.resistances.filter((candidate) => candidate.id !== entry.id) }))}>Entfernen</button></> : <><div><strong>{entry.name}</strong>{entry.immune && <span>Immun</span>}{entry.weak && <span className="weak-badge">Schwäche</span>}</div><b>{entry.immune ? "∞" : entry.weak ? "!" : entry.protection}</b><small>{entry.notes || "Kein zusätzlicher Hinweis"}</small></>}</article>)}</div> : <p className="empty-state">Keine Resistenzen, Immunitäten oder Schwächen eingetragen.</p>}
  </section>;
}
