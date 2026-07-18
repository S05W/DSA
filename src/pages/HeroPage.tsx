import { useMemo, useState, type FormEvent } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import ProgressBar from "react-bootstrap/ProgressBar";
import { Link, Navigate, useParams } from "react-router";
import Sidebar from "../components/layout/Sidebar";
import { useApp } from "../context/app-context";
import { talentCategories } from "../data/talents";
import type { EquipmentItem, Hero, SpellValue, TalentCategory } from "../models/Hero";
import { createId } from "../utils/id";

type HeroTab = "overview" | "attributes" | "talents" | "spells" | "equipment";
type HeroMode = "play" | "setup";
type HeroUpdater = (updater: (hero: Hero) => Hero) => void;

const tabs: { id: HeroTab; label: string }[] = [
  { id: "overview", label: "Übersicht" },
  { id: "attributes", label: "Eigenschaften" },
  { id: "talents", label: "Talente" },
  { id: "spells", label: "Zauber" },
  { id: "equipment", label: "Ausrüstung" },
];

function initialsFor(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function HeroPage() {
  const { heroId } = useParams();
  const { heroes, updateHero } = useApp();
  const [activeTab, setActiveTab] = useState<HeroTab>("overview");
  const [mode, setMode] = useState<HeroMode>("play");
  const hero = heroes.find((candidate) => candidate.id === heroId);
  if (!hero) return <Navigate to="/" replace />;
  const patchHero: HeroUpdater = (updater) => updateHero(hero.id, updater);
  const setup = mode === "setup";
  const freeAp = hero.adventurePoints - hero.spentAdventurePoints;
  const apPercentage = hero.adventurePoints > 0 ? (hero.spentAdventurePoints / hero.adventurePoints) * 100 : 0;

  return (
    <div className="app-shell">
      <Sidebar heroName={hero.name} />
      <main className="app-main hero-page">
        <div className="hero-page-toolbar">
          <Link className="back-link" to="/">← Zurück zur Übersicht</Link>
          <div className="mode-switch" role="group" aria-label="Modus des Heldenbogens">
            <button type="button" className={!setup ? "active" : ""} onClick={() => setMode("play")}>Spielmodus</button>
            <button type="button" className={setup ? "active" : ""} onClick={() => setMode("setup")}>Setup-Modus</button>
          </div>
        </div>
        <p className={`mode-note mode-note-${mode}`}>{setup ? "Setup-Modus: Grunddaten, Werte, Talente, Zauber und Ausrüstung können verändert werden." : "Spielmodus: Nur aktuelle LeP, AsP und Schicksalspunkte können verändert werden."}</p>

        <section className={`hero-banner hero-banner-${hero.accent}`}>
          <div className="hero-banner-portrait">{hero.initials}</div>
          <div className="hero-banner-copy">
            <div className="hero-badges"><Badge bg="light" text="dark">{hero.experienceLevel}</Badge><span>{hero.culture}</span></div>
            <p className="page-eyebrow">{hero.profession}</p>
            <h1>{hero.name}</h1>
            {hero.title && <p className="hero-title">{hero.title}</p>}
          </div>
          <blockquote>„{hero.quote}“</blockquote>
        </section>

        <nav className="hero-tabs" aria-label="Bereiche des Heldenbogens">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
          ))}
        </nav>

        {activeTab === "overview" && (
          <>
            {setup && <HeroSetupPanel hero={hero} updateHero={patchHero} />}
            <div className="hero-content-grid">
              <section className="content-column">
                <div className="resource-grid">
                  <EditableResourceCard label="Lebensenergie" field="lifePoints" maxField="maxLifePoints" hero={hero} updateHero={patchHero} unit="LeP" setup={setup} />
                  <EditableResourceCard label="Astralenergie" field="astralPoints" maxField="maxAstralPoints" hero={hero} updateHero={patchHero} unit="AsP" setup={setup} />
                  <EditableResourceCard label="Schicksalspunkte" field="fatePoints" maxField="maxFatePoints" hero={hero} updateHero={patchHero} unit="Schip" setup={setup} />
                </div>

                <article className="dsa-panel">
                  <div className="panel-heading"><span>Charakter</span><small>Hintergrund</small></div>
                  <p className="hero-description">{hero.description}</p>
                  <dl className="detail-list">
                    <div><dt>Spezies</dt><dd>{hero.species}</dd></div>
                    <div><dt>Kultur</dt><dd>{hero.culture}</dd></div>
                    <div><dt>Profession</dt><dd>{hero.profession}</dd></div>
                  </dl>
                </article>
              </section>

              <aside className="content-column">
                <article className="dsa-panel ap-panel">
                  <div className="panel-heading"><span>Abenteuerpunkte</span><small>Fortschritt</small></div>
                  <div className="ap-number">{freeAp}<small>frei</small></div>
                  <ProgressBar now={apPercentage} />
                  <div className="ap-details"><span>{hero.spentAdventurePoints} ausgegeben</span><span>{hero.adventurePoints} gesamt</span></div>
                  {setup && (
                    <div className="ap-editor">
                      <label>Gesamt<input type="number" min={0} value={hero.adventurePoints} onChange={(event) => patchHero((current) => ({ ...current, adventurePoints: Math.max(0, Number(event.target.value)) }))} /></label>
                      <label>Ausgegeben<input type="number" min={0} value={hero.spentAdventurePoints} onChange={(event) => patchHero((current) => ({ ...current, spentAdventurePoints: Math.max(0, Number(event.target.value)) }))} /></label>
                    </div>
                  )}
                </article>

                <article className="dsa-panel">
                  <div className="panel-heading"><span>Schnellzugriff</span><small>Höchste Werte</small></div>
                  <div className="quick-list">
                    {[...hero.attributes].sort((a, b) => b.value - a.value).slice(0, 4).map((attribute) => (
                      <div key={attribute.short}><span><b>{attribute.short}</b>{attribute.name}</span><strong>{attribute.value}</strong></div>
                    ))}
                  </div>
                </article>
              </aside>
            </div>
          </>
        )}

        {activeTab === "attributes" && <AttributePanel hero={hero} updateHero={patchHero} setup={setup} />}
        {activeTab === "talents" && <TalentPanel hero={hero} updateHero={patchHero} setup={setup} />}
        {activeTab === "spells" && <SpellPanel hero={hero} updateHero={patchHero} setup={setup} />}
        {activeTab === "equipment" && <EquipmentPanel hero={hero} updateHero={patchHero} setup={setup} />}
      </main>
    </div>
  );
}

function HeroSetupPanel({ hero, updateHero }: { hero: Hero; updateHero: HeroUpdater }) {
  function patch(field: keyof Hero, value: string) {
    updateHero((current) => ({ ...current, [field]: value, ...(field === "name" ? { initials: initialsFor(value) } : {}) }));
  }

  return (
    <section className="dsa-panel hero-setup-panel">
      <div className="panel-heading"><span>Grunddaten bearbeiten</span><small>Setup</small></div>
      <div className="hero-setup-grid">
        <Form.Group><Form.Label>Name</Form.Label><Form.Control maxLength={80} value={hero.name} onChange={(event) => patch("name", event.target.value)} /></Form.Group>
        <Form.Group><Form.Label>Titel</Form.Label><Form.Control value={hero.title ?? ""} onChange={(event) => patch("title", event.target.value)} /></Form.Group>
        <Form.Group><Form.Label>Spezies</Form.Label><Form.Control value={hero.species} onChange={(event) => patch("species", event.target.value)} /></Form.Group>
        <Form.Group><Form.Label>Kultur</Form.Label><Form.Control value={hero.culture} onChange={(event) => patch("culture", event.target.value)} /></Form.Group>
        <Form.Group><Form.Label>Profession</Form.Label><Form.Control value={hero.profession} onChange={(event) => patch("profession", event.target.value)} /></Form.Group>
        <Form.Group><Form.Label>Erfahrungsgrad</Form.Label><Form.Select value={hero.experienceLevel} onChange={(event) => patch("experienceLevel", event.target.value)}><option>Unerfahren</option><option>Durchschnittlich</option><option>Erfahren</option><option>Kompetent</option><option>Meisterlich</option><option>Brillant</option><option>Legendär</option></Form.Select></Form.Group>
        <Form.Group><Form.Label>Farbstil</Form.Label><Form.Select value={hero.accent} onChange={(event) => updateHero((current) => ({ ...current, accent: event.target.value as Hero["accent"] }))}><option value="emerald">Smaragd</option><option value="ruby">Rubin</option><option value="gold">Gold</option></Form.Select></Form.Group>
        <Form.Group className="setup-wide"><Form.Label>Zitat</Form.Label><Form.Control value={hero.quote} onChange={(event) => patch("quote", event.target.value)} /></Form.Group>
        <Form.Group className="setup-wide"><Form.Label>Beschreibung</Form.Label><Form.Control as="textarea" rows={4} value={hero.description} onChange={(event) => patch("description", event.target.value)} /></Form.Group>
      </div>
    </section>
  );
}

interface EditableResourceCardProps {
  label: string;
  field: "lifePoints" | "astralPoints" | "fatePoints";
  maxField: "maxLifePoints" | "maxAstralPoints" | "maxFatePoints";
  hero: Hero;
  unit: string;
  setup: boolean;
  updateHero: HeroUpdater;
}

function EditableResourceCard({ label, field, maxField, hero, unit, setup, updateHero }: EditableResourceCardProps) {
  const [amount, setAmount] = useState("1");
  const value = hero[field];
  const max = hero[maxField];
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const setValue = (next: number) => updateHero((current) => ({ ...current, [field]: Math.max(0, Math.min(current[maxField], Number.isFinite(next) ? next : 0)) }));
  const applyAmount = (direction: -1 | 1) => setValue(value + direction * Math.max(0, Number(amount) || 0));

  function setMaximum(next: number) {
    const safeMaximum = Math.max(0, Number.isFinite(next) ? next : 0);
    updateHero((current) => ({ ...current, [maxField]: safeMaximum, [field]: Math.min(current[field], safeMaximum) }));
  }

  return (
    <article className="resource-card editable-resource-card">
      <div className="resource-title"><span>{label}</span><small>{unit}</small></div>
      <strong>{value}<small> / {max}</small></strong>
      <ProgressBar now={percentage} />
      {setup && (
        <div className="resource-setup-values">
          <label>Aktuell<input type="number" min={0} max={max} value={value} onChange={(event) => setValue(Number(event.target.value))} /></label>
          <label>Maximum<input type="number" min={0} value={max} onChange={(event) => setMaximum(Number(event.target.value))} /></label>
        </div>
      )}
      <div className="resource-delta">
        <label>Änderung<input type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <button type="button" className="resource-damage" onClick={() => applyAmount(-1)}>− Abziehen</button>
        <button type="button" className="resource-heal" onClick={() => applyAmount(1)}>+ Addieren</button>
      </div>
    </article>
  );
}

function AttributePanel({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  function setAttribute(short: string, value: number) {
    updateHero((current) => ({ ...current, attributes: current.attributes.map((attribute) => attribute.short === short ? { ...attribute, value: Math.max(0, Math.min(99, value)) } : attribute) }));
  }
  return (
    <section className="dsa-panel tab-panel">
      <div className="panel-heading"><span>Eigenschaften</span><small>{setup ? "Werte bearbeiten" : "Grundwerte"}</small></div>
      <div className="attribute-grid">
        {hero.attributes.map((attribute) => (
          <article key={attribute.short} className={`attribute-card${setup ? " editable" : ""}`}>
            <span>{attribute.short}</span>
            {setup ? <input type="number" min={0} max={99} value={attribute.value} onChange={(event) => setAttribute(attribute.short, Number(event.target.value))} aria-label={attribute.name} /> : <strong>{attribute.value}</strong>}
            <small>{attribute.name}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function TalentPanel({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  const grouped = useMemo(() => talentCategories.map((category) => ({ category, talents: hero.talents.filter((talent) => talent.category === category) })), [hero.talents]);
  function setTalent(category: TalentCategory, name: string, value: number) {
    updateHero((current) => ({ ...current, talents: current.talents.map((talent) => talent.category === category && talent.name === name ? { ...talent, value: Math.max(0, Math.min(30, value)) } : talent) }));
  }
  return (
    <section className="dsa-panel tab-panel">
      <div className="panel-heading"><span>Talente</span><small>{setup ? "Werte bearbeiten" : "Alle Talentgruppen"}</small></div>
      <p className="panel-intro">{setup ? "Talentwerte können jetzt geändert werden." : "Zum Ändern der Talentwerte in den Setup-Modus wechseln."}</p>
      <div className="talent-category-grid">
        {grouped.map(({ category, talents }) => (
          <section className="talent-category" key={category}><h2>{category}</h2><div className="talent-rows">
            {talents.map((talent) => <label key={talent.name} className="talent-row"><span>{talent.name}</span><input type="number" min={0} max={30} disabled={!setup} value={talent.value} onChange={(event) => setTalent(category, talent.name, Number(event.target.value))} /></label>)}
          </div></section>
        ))}
      </div>
    </section>
  );
}

function SpellPanel({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  const [draft, setDraft] = useState<SpellValue>({ name: "", check: "", value: 0, cost: "" });
  function addSpell(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    updateHero((current) => ({ ...current, spells: [...current.spells, { ...draft, name: draft.name.trim(), value: Math.max(0, draft.value) }] }));
    setDraft({ name: "", check: "", value: 0, cost: "" });
  }
  function patchSpell(index: number, patch: Partial<SpellValue>) {
    updateHero((current) => ({ ...current, spells: current.spells.map((spell, currentIndex) => currentIndex === index ? { ...spell, ...patch } : spell) }));
  }
  function removeSpell(index: number) {
    updateHero((current) => ({ ...current, spells: current.spells.filter((_, currentIndex) => currentIndex !== index) }));
  }
  return (
    <section className="dsa-panel tab-panel">
      <div className="panel-heading"><span>Zauber</span><small>{setup ? "Bearbeiten und ergänzen" : "Magisches Repertoire"}</small></div>
      {setup && (
        <Form className="spell-form" onSubmit={addSpell}>
          <Form.Group><Form.Label>Name</Form.Label><Form.Control required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Ignifaxius" /></Form.Group>
          <Form.Group><Form.Label>Probe</Form.Label><Form.Control value={draft.check} onChange={(event) => setDraft({ ...draft, check: event.target.value })} placeholder="MU / KL / CH" /></Form.Group>
          <Form.Group><Form.Label>FW</Form.Label><Form.Control type="number" min={0} value={draft.value} onChange={(event) => setDraft({ ...draft, value: Number(event.target.value) })} /></Form.Group>
          <Form.Group><Form.Label>Kosten</Form.Label><Form.Control value={draft.cost} onChange={(event) => setDraft({ ...draft, cost: event.target.value })} placeholder="8 AsP" /></Form.Group>
          <Button type="submit" className="dsa-primary-button">Zauber hinzufügen</Button>
        </Form>
      )}
      {hero.spells.length ? (
        <div className="spell-grid">
          {hero.spells.map((spell, index) => setup ? (
            <article key={`${index}-${spell.name}`} className="spell-card spell-editor-card">
              <label>Name<input value={spell.name} onChange={(event) => patchSpell(index, { name: event.target.value })} /></label>
              <label>Probe<input value={spell.check} onChange={(event) => patchSpell(index, { check: event.target.value })} /></label>
              <label>FW<input type="number" min={0} value={spell.value} onChange={(event) => patchSpell(index, { value: Math.max(0, Number(event.target.value)) })} /></label>
              <label>Kosten<input value={spell.cost} onChange={(event) => patchSpell(index, { cost: event.target.value })} /></label>
              <button type="button" className="equipment-delete" onClick={() => removeSpell(index)}>Zauber entfernen</button>
            </article>
          ) : (
            <article key={`${index}-${spell.name}`} className="spell-card"><div><span>Zauber</span><strong>{spell.name}</strong></div><dl><div><dt>Probe</dt><dd>{spell.check || "–"}</dd></div><div><dt>FW</dt><dd>{spell.value}</dd></div><div><dt>Kosten</dt><dd>{spell.cost || "–"}</dd></div></dl></article>
          ))}
        </div>
      ) : <p className="empty-state">Dieser Held beherrscht noch keine Zauber.</p>}
    </section>
  );
}

function EquipmentPanel({ hero, updateHero, setup }: { hero: Hero; updateHero: HeroUpdater; setup: boolean }) {
  const [draft, setDraft] = useState({ name: "", quantity: 1, notes: "" });
  function addItem(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const item: EquipmentItem = { id: createId(), name: draft.name.trim(), quantity: Math.max(1, draft.quantity), notes: draft.notes.trim() };
    updateHero((current) => ({ ...current, equipment: [...current.equipment, item] }));
    setDraft({ name: "", quantity: 1, notes: "" });
  }
  function patchItem(id: string, patch: Partial<EquipmentItem>) {
    updateHero((current) => ({ ...current, equipment: current.equipment.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }
  function removeItem(id: string) {
    updateHero((current) => ({ ...current, equipment: current.equipment.filter((item) => item.id !== id) }));
  }
  return (
    <section className="dsa-panel tab-panel">
      <div className="panel-heading"><span>Ausrüstung</span><small>{setup ? "Bearbeiten und ergänzen" : "Inventar"}</small></div>
      {setup && (
        <Form className="equipment-form" onSubmit={addItem}>
          <Form.Group><Form.Label>Gegenstand</Form.Label><Form.Control value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Heiltrank" /></Form.Group>
          <Form.Group><Form.Label>Anzahl</Form.Label><Form.Control type="number" min={1} value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} /></Form.Group>
          <Form.Group><Form.Label>Notiz</Form.Label><Form.Control value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="optional" /></Form.Group>
          <Button type="submit" className="dsa-primary-button">Hinzufügen</Button>
        </Form>
      )}
      {setup ? (
        <div className="equipment-editor-list">
          {hero.equipment.map((item) => <article key={item.id} className="equipment-editor-row"><input className="equipment-name" value={item.name} onChange={(event) => patchItem(item.id, { name: event.target.value })} aria-label="Gegenstandsname" /><input className="equipment-quantity" type="number" min={1} value={item.quantity} onChange={(event) => patchItem(item.id, { quantity: Math.max(1, Number(event.target.value)) })} aria-label="Anzahl" /><input className="equipment-notes" value={item.notes} onChange={(event) => patchItem(item.id, { notes: event.target.value })} placeholder="Notiz" aria-label="Notiz" /><button type="button" className="equipment-delete" onClick={() => removeItem(item.id)}>Entfernen</button></article>)}
        </div>
      ) : hero.equipment.length ? (
        <div className="equipment-list">{hero.equipment.map((item) => <div key={item.id}><span>{item.quantity}×</span><strong>{item.name}</strong>{item.notes && <small>{item.notes}</small>}</div>)}</div>
      ) : <p className="empty-state">Das Inventar ist noch leer.</p>}
    </section>
  );
}

export default HeroPage;
