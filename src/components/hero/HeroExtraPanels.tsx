import { useState, type FormEvent } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import type { CombatTechnique, Hero, LanguageKnowledge, NamedFeature, ResistanceEntry } from "../../models/Hero";
import { createId } from "../../utils/id";

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

export function CombatPanel({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  const stats: { field: keyof Omit<Hero["combat"], "techniques">; label: string; short: string }[] = [
    { field: "attack", label: "Attacke", short: "AT" }, { field: "parry", label: "Parade", short: "PA" },
    { field: "dodge", label: "Ausweichen", short: "AW" }, { field: "initiative", label: "Initiative", short: "INI" },
    { field: "speed", label: "Geschwindigkeit", short: "GS" }, { field: "armor", label: "Rüstungsschutz", short: "RS" },
  ];
  function setStat(field: keyof Omit<Hero["combat"], "techniques">, value: number) {
    updateHero((current) => ({ ...current, combat: { ...current.combat, [field]: Math.max(0, Math.min(99, Number.isFinite(value) ? value : 0)) } }));
  }
  return <section className="dsa-panel tab-panel combat-panel"><div className="panel-heading"><span>Kampfwerte</span><small>{setup ? "Werte bearbeiten" : "AT, PA und Verteidigung"}</small></div><div className="combat-stat-grid">{stats.map((stat) => <article key={stat.field}><span>{stat.short}</span>{setup ? <input type="number" min={0} max={99} value={hero.combat[stat.field]} onChange={(event) => setStat(stat.field, Number(event.target.value))} /> : <strong>{hero.combat[stat.field]}</strong>}<small>{stat.label}</small></article>)}</div><p className="combat-technique-note">Schwerter, Bögen und weitere Kampftechniken findest du unten im Tab „Talente“.</p></section>;
}

export function CombatTechniquesSection({ hero, updateHero, setup, embedded = false }: { hero: Hero; updateHero: HeroUpdater; setup: boolean; embedded?: boolean }) {
  const [draft, setDraft] = useState({ name: "", kind: "melee" as CombatTechnique["kind"] });
  function patchTechnique(id: string, patch: Partial<CombatTechnique>) {
    updateHero((current) => ({ ...current, combat: { ...current.combat, techniques: current.combat.techniques.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) } }));
  }
  function addTechnique(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const technique: CombatTechnique = { id: createId(), name: draft.name.trim(), kind: draft.kind, skill: 0, attack: 0, parry: draft.kind === "melee" ? 0 : null, damage: "", notes: "" };
    updateHero((current) => ({ ...current, combat: { ...current.combat, techniques: [...current.combat.techniques, technique] } }));
    setDraft({ name: "", kind: "melee" });
  }
  function removeTechnique(id: string) {
    updateHero((current) => ({ ...current, combat: { ...current.combat, techniques: current.combat.techniques.filter((entry) => entry.id !== id) } }));
  }
  return <section className={`subsection-card combat-techniques${embedded ? " embedded" : ""}`}><div className="subsection-heading"><div><span>Kampftechniken</span><small>Schwerter, Bögen und weitere Waffenarten</small></div></div>{setup && <Form className="compact-add-form" onSubmit={addTechnique}><Form.Control required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Dolche" /><Form.Select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as CombatTechnique["kind"] })}><option value="melee">Nahkampf</option><option value="ranged">Fernkampf</option></Form.Select><Button type="submit" className="dsa-primary-button">Hinzufügen</Button></Form>}
    {hero.combat.techniques.length ? <div className="combat-technique-grid">{hero.combat.techniques.map((technique) => <article key={technique.id}>{setup ? <>
      <input className="technique-name" value={technique.name} onChange={(event) => patchTechnique(technique.id, { name: event.target.value })} />
      <label>KTaW<input type="number" min={0} value={technique.skill} onChange={(event) => patchTechnique(technique.id, { skill: Math.max(0, Number(event.target.value)) })} /></label>
      <label>AT<input type="number" min={0} value={technique.attack} onChange={(event) => patchTechnique(technique.id, { attack: Math.max(0, Number(event.target.value)) })} /></label>
      <label>PA<input type="number" min={0} disabled={technique.kind === "ranged"} value={technique.parry ?? ""} onChange={(event) => patchTechnique(technique.id, { parry: Math.max(0, Number(event.target.value)) })} /></label>
      <label>Schaden<input value={technique.damage} onChange={(event) => patchTechnique(technique.id, { damage: event.target.value })} /></label>
      <input className="technique-notes" value={technique.notes} onChange={(event) => patchTechnique(technique.id, { notes: event.target.value })} placeholder="Notiz" />
      <button type="button" className="list-delete" onClick={() => removeTechnique(technique.id)}>Entfernen</button>
    </> : <><div className="technique-title"><strong>{technique.name}</strong><span>{technique.kind === "melee" ? "Nahkampf" : "Fernkampf"}</span></div><dl><div><dt>KTaW</dt><dd>{technique.skill}</dd></div><div><dt>AT</dt><dd>{technique.attack}</dd></div><div><dt>PA</dt><dd>{technique.parry ?? "–"}</dd></div><div><dt>Schaden</dt><dd>{technique.damage || "–"}</dd></div></dl>{technique.notes && <p>{technique.notes}</p>}</>}</article>)}</div> : <p className="empty-status">Noch keine Kampftechniken eingetragen.</p>}
  </section>;
}

export function LanguagesSection({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  const [name, setName] = useState("");
  function patchLanguage(id: string, patch: Partial<LanguageKnowledge>) { updateHero((current) => ({ ...current, languages: current.languages.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) })); }
  function addLanguage(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; updateHero((current) => ({ ...current, languages: [...current.languages, { id: createId(), name: name.trim(), level: 1, script: "", notes: "" }] })); setName(""); }
  return <section className="subsection-card languages-section"><div className="subsection-heading"><div><span>Sprachen & Schriften</span><small>Garethi, Isdira und weitere Kenntnisse</small></div></div>{setup && <Form className="compact-add-form language-add-form" onSubmit={addLanguage}><Form.Control required value={name} onChange={(event) => setName(event.target.value)} placeholder="Neue Sprache" /><Button type="submit" className="dsa-primary-button">Hinzufügen</Button></Form>}
    {hero.languages.length ? <div className="language-grid">{hero.languages.map((language) => <article key={language.id}>{setup ? <><input className="language-name" value={language.name} onChange={(event) => patchLanguage(language.id, { name: event.target.value })} /><label>Stufe<input type="number" min={0} max={3} value={language.level} onChange={(event) => patchLanguage(language.id, { level: Math.max(0, Math.min(3, Number(event.target.value))) })} /></label><label>Schrift<input value={language.script} onChange={(event) => patchLanguage(language.id, { script: event.target.value })} placeholder="optional" /></label><input className="language-notes" value={language.notes} onChange={(event) => patchLanguage(language.id, { notes: event.target.value })} placeholder="Notiz" /><button type="button" className="list-delete" onClick={() => updateHero((current) => ({ ...current, languages: current.languages.filter((entry) => entry.id !== language.id) }))}>Entfernen</button></> : <><strong>{language.name}</strong><span>Stufe {language.level}</span><small>{language.script || "Keine Schrift"}{language.notes ? ` · ${language.notes}` : ""}</small></>}</article>)}</div> : <p className="empty-status">Noch keine Sprachen eingetragen.</p>}
  </section>;
}

function FeatureList({ title, subtitle, entries, setup, onChange }: { title: string; subtitle: string; entries: NamedFeature[]; setup: boolean; onChange: (entries: NamedFeature[]) => void }) {
  const [name, setName] = useState("");
  function add(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; onChange([...entries, { id: createId(), name: name.trim(), description: "" }]); setName(""); }
  return <section className="subsection-card magic-feature-list"><div className="subsection-heading"><div><span>{title}</span><small>{subtitle}</small></div></div>{setup && <Form className="compact-add-form language-add-form" onSubmit={add}><Form.Control required value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" /><Button type="submit" className="dsa-primary-button">Hinzufügen</Button></Form>}{entries.length ? <div className="feature-grid">{entries.map((entry) => <article key={entry.id}>{setup ? <><input value={entry.name} onChange={(event) => onChange(entries.map((candidate) => candidate.id === entry.id ? { ...candidate, name: event.target.value } : candidate))} /><textarea value={entry.description} onChange={(event) => onChange(entries.map((candidate) => candidate.id === entry.id ? { ...candidate, description: event.target.value } : candidate))} placeholder="Beschreibung" /><button type="button" className="list-delete" onClick={() => onChange(entries.filter((candidate) => candidate.id !== entry.id))}>Entfernen</button></> : <><strong>{entry.name}</strong><p>{entry.description || "Keine Beschreibung"}</p></>}</article>)}</div> : <p className="empty-status">Noch keine Einträge vorhanden.</p>}</section>;
}

export function MagicExtrasSection({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  return <div className="magic-extras"><FeatureList title="Magische Sonderfertigkeiten" subtitle="Traditionen, Merkmalskenntnisse und weitere Fähigkeiten" entries={hero.magicalSpecialAbilities} setup={setup} onChange={(entries) => updateHero((current) => ({ ...current, magicalSpecialAbilities: entries }))} /><FeatureList title="Zaubertricks" subtitle="Kleine magische Kunststücke" entries={hero.cantrips} setup={setup} onChange={(entries) => updateHero((current) => ({ ...current, cantrips: entries }))} /></div>;
}

export function ResistancePanel({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  const [name, setName] = useState("");
  function patchEntry(id: string, patch: Partial<ResistanceEntry>) { updateHero((current) => ({ ...current, resistances: current.resistances.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) })); }
  function addEntry(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; updateHero((current) => ({ ...current, resistances: [...current.resistances, { id: createId(), name: name.trim(), protection: 0, immune: false, notes: "" }] })); setName(""); }
  return <section className="dsa-panel tab-panel resistance-panel"><div className="panel-heading"><span>Resistenzen & Immunitäten</span><small>{setup ? "Schutzarten bearbeiten" : "Elementarer und besonderer Schutz"}</small></div>{setup && <Form className="compact-add-form resistance-add-form" onSubmit={addEntry}><Form.Control required value={name} onChange={(event) => setName(event.target.value)} placeholder="z. B. Kälteschutz" /><Button type="submit" className="dsa-primary-button">Schutzart hinzufügen</Button></Form>}
    {hero.resistances.length ? <div className="resistance-grid">{hero.resistances.map((entry) => <article key={entry.id} className={entry.immune ? "immune" : ""}>{setup ? <><input className="resistance-name" value={entry.name} onChange={(event) => patchEntry(entry.id, { name: event.target.value })} /><label>Schutzwert<input type="number" min={0} value={entry.protection} onChange={(event) => patchEntry(entry.id, { protection: Math.max(0, Number(event.target.value)) })} /></label><Form.Check type="switch" id={`immune-${entry.id}`} label="Immun" checked={entry.immune} onChange={(event) => patchEntry(entry.id, { immune: event.target.checked })} /><textarea value={entry.notes} onChange={(event) => patchEntry(entry.id, { notes: event.target.value })} placeholder="Quelle oder Notiz" /><button type="button" className="list-delete" onClick={() => updateHero((current) => ({ ...current, resistances: current.resistances.filter((candidate) => candidate.id !== entry.id) }))}>Entfernen</button></> : <><div><strong>{entry.name}</strong>{entry.immune && <span>Immun</span>}</div><b>{entry.immune ? "∞" : entry.protection}</b><small>{entry.notes || "Kein zusätzlicher Hinweis"}</small></>}</article>)}</div> : <p className="empty-state">Keine Resistenzen oder Immunitäten eingetragen.</p>}
  </section>;
}
