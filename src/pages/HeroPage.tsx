import { useMemo, useState } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import ProgressBar from "react-bootstrap/ProgressBar";
import { Link, Navigate, useParams } from "react-router";
import Sidebar from "../components/layout/Sidebar";
import { useApp } from "../context/app-context";
import { talentCategories } from "../data/talents";
import type { EquipmentItem, Hero, TalentCategory } from "../models/Hero";
import { createId } from "../utils/id";

type HeroTab = "overview" | "attributes" | "talents" | "spells" | "equipment";

const tabs: { id: HeroTab; label: string }[] = [
  { id: "overview", label: "Übersicht" },
  { id: "attributes", label: "Eigenschaften" },
  { id: "talents", label: "Talente" },
  { id: "spells", label: "Zauber" },
  { id: "equipment", label: "Ausrüstung" },
];

function HeroPage() {
  const { heroId } = useParams();
  const { heroes, updateHero } = useApp();
  const [activeTab, setActiveTab] = useState<HeroTab>("overview");
  const hero = heroes.find((candidate) => candidate.id === heroId);
  if (!hero) return <Navigate to="/" replace />;
  const patchHero = (updater: (current: Hero) => Hero) => updateHero(hero.id, updater);

  const freeAp = hero.adventurePoints - hero.spentAdventurePoints;

  return (
    <div className="app-shell">
      <Sidebar heroName={hero.name} />
      <main className="app-main hero-page">
        <Link className="back-link" to="/">← Zurück zur Übersicht</Link>

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
            <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "overview" && (
          <div className="hero-content-grid">
            <section className="content-column">
              <div className="resource-grid">
                <EditableResourceCard label="Lebensenergie" field="lifePoints" maxField="maxLifePoints" hero={hero} updateHero={patchHero} unit="LeP" />
                <EditableResourceCard label="Astralenergie" field="astralPoints" maxField="maxAstralPoints" hero={hero} updateHero={patchHero} unit="AsP" />
                <EditableResourceCard label="Schicksalspunkte" field="fatePoints" maxField="maxFatePoints" hero={hero} updateHero={patchHero} unit="Schip" />
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
                <ProgressBar now={(hero.spentAdventurePoints / hero.adventurePoints) * 100} />
                <div className="ap-details"><span>{hero.spentAdventurePoints} ausgegeben</span><span>{hero.adventurePoints} gesamt</span></div>
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
        )}

        {activeTab === "attributes" && (
          <section className="dsa-panel tab-panel">
            <div className="panel-heading"><span>Eigenschaften</span><small>Grundwerte</small></div>
            <div className="attribute-grid">
              {hero.attributes.map((attribute) => (
                <article key={attribute.short} className="attribute-card">
                  <span>{attribute.short}</span><strong>{attribute.value}</strong><small>{attribute.name}</small>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "talents" && <TalentEditor hero={hero} updateHero={patchHero} />}
        {activeTab === "spells" && <SpellPanel hero={hero} />}
        {activeTab === "equipment" && <EquipmentEditor hero={hero} updateHero={patchHero} />}
      </main>
    </div>
  );
}

interface EditableResourceCardProps {
  label: string;
  field: "lifePoints" | "astralPoints" | "fatePoints";
  maxField: "maxLifePoints" | "maxAstralPoints" | "maxFatePoints";
  hero: Hero;
  unit: string;
  updateHero: (updater: (hero: Hero) => Hero) => void;
}

function EditableResourceCard({ label, field, maxField, hero, unit, updateHero }: EditableResourceCardProps) {
  const value = hero[field];
  const max = hero[maxField];
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const setValue = (next: number) => updateHero((current) => ({ ...current, [field]: Math.max(0, Math.min(current[maxField], next)) }));

  return (
    <article className="resource-card editable-resource-card">
      <div className="resource-title"><span>{label}</span><small>{unit}</small></div>
      <strong>{value}<small> / {max}</small></strong>
      <ProgressBar now={percentage} />
      <div className="resource-actions">
        <button type="button" onClick={() => setValue(value - 1)} aria-label={`${label} um eins verringern`}>−</button>
        <input type="number" value={value} min={0} max={max} onChange={(event) => setValue(Number(event.target.value))} aria-label={label} />
        <button type="button" onClick={() => setValue(value + 1)} aria-label={`${label} um eins erhöhen`}>+</button>
        <button type="button" className="resource-reset" onClick={() => setValue(max)}>Reset</button>
      </div>
    </article>
  );
}

function TalentEditor({ hero, updateHero }: { hero: Hero; updateHero: (updater: (hero: Hero) => Hero) => void }) {
  const grouped = useMemo(() => talentCategories.map((category) => ({
    category,
    talents: hero.talents.filter((talent) => talent.category === category),
  })), [hero.talents]);

  function setTalent(category: TalentCategory, name: string, value: number) {
    updateHero((current) => ({
      ...current,
      talents: current.talents.map((talent) => talent.category === category && talent.name === name
        ? { ...talent, value: Math.max(0, Math.min(30, value)) }
        : talent),
    }));
  }

  return (
    <section className="dsa-panel tab-panel">
      <div className="panel-heading"><span>Talente</span><small>Alle Talentgruppen</small></div>
      <p className="panel-intro">Die Talentwerte können direkt geändert werden. Jede Änderung wird automatisch gespeichert.</p>
      <div className="talent-category-grid">
        {grouped.map(({ category, talents }) => (
          <section className="talent-category" key={category}>
            <h2>{category}</h2>
            <div className="talent-rows">
              {talents.map((talent) => (
                <label key={talent.name} className="talent-row">
                  <span>{talent.name}</span>
                  <input type="number" min={0} max={30} value={talent.value} onChange={(event) => setTalent(category, talent.name, Number(event.target.value))} />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function SpellPanel({ hero }: { hero: Hero }) {
  return (
    <section className="dsa-panel tab-panel">
      <div className="panel-heading"><span>Zauber</span><small>Magisches Repertoire</small></div>
      {hero.spells.length ? (
        <div className="spell-grid">
          {hero.spells.map((spell) => (
            <article key={spell.name} className="spell-card">
              <div><span>Zauber</span><strong>{spell.name}</strong></div>
              <dl><div><dt>Probe</dt><dd>{spell.check}</dd></div><div><dt>FW</dt><dd>{spell.value}</dd></div><div><dt>Kosten</dt><dd>{spell.cost}</dd></div></dl>
            </article>
          ))}
        </div>
      ) : <p className="empty-state">Dieser Held beherrscht keine Zauber.</p>}
    </section>
  );
}

function EquipmentEditor({ hero, updateHero }: { hero: Hero; updateHero: (updater: (hero: Hero) => Hero) => void }) {
  const [draft, setDraft] = useState({ name: "", quantity: 1, notes: "" });

  function addItem(event: React.FormEvent) {
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
      <div className="panel-heading"><span>Ausrüstung</span><small>Bearbeiten und ergänzen</small></div>
      <Form className="equipment-form" onSubmit={addItem}>
        <Form.Group><Form.Label>Gegenstand</Form.Label><Form.Control value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Heiltrank" /></Form.Group>
        <Form.Group><Form.Label>Anzahl</Form.Label><Form.Control type="number" min={1} value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} /></Form.Group>
        <Form.Group><Form.Label>Notiz</Form.Label><Form.Control value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="optional" /></Form.Group>
        <Button type="submit" className="dsa-primary-button">Hinzufügen</Button>
      </Form>

      <div className="equipment-editor-list">
        {hero.equipment.map((item) => (
          <article key={item.id} className="equipment-editor-row">
            <input className="equipment-name" value={item.name} onChange={(event) => patchItem(item.id, { name: event.target.value })} aria-label="Gegenstandsname" />
            <input className="equipment-quantity" type="number" min={1} value={item.quantity} onChange={(event) => patchItem(item.id, { quantity: Math.max(1, Number(event.target.value)) })} aria-label="Anzahl" />
            <input className="equipment-notes" value={item.notes} onChange={(event) => patchItem(item.id, { notes: event.target.value })} placeholder="Notiz" aria-label="Notiz" />
            <button type="button" className="equipment-delete" onClick={() => removeItem(item.id)}>Entfernen</button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HeroPage;
