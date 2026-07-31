import { useEffect, useMemo, useState, type FormEvent } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { Link, Navigate, useParams } from "react-router";
import { BodyFigure } from "../components/hero/BodyPanel";
import Sidebar from "../components/layout/Sidebar";
import { bodyPartDefinitions } from "../data/body";
import { normalizeHero } from "../data/body";
import { talentCategories } from "../data/talents";
import type { Hero } from "../models/Hero";
import type { MasterHeroRecord } from "../models/User";
import { storage } from "../services/storage";

type MasterTab = "overview" | "attributes" | "talents" | "traits" | "combat" | "spells" | "equipment" | "body" | "resistances";
const tabs: { id: MasterTab; label: string }[] = [
  { id: "overview", label: "Übersicht" }, { id: "attributes", label: "Eigenschaften" }, { id: "talents", label: "Talente" },
  { id: "traits", label: "Vor- & Nachteile" }, { id: "combat", label: "Kampf" }, { id: "spells", label: "Zauber" }, { id: "equipment", label: "Ausrüstung" },
  { id: "body", label: "Körper" }, { id: "resistances", label: "Resistenzen" },
];

export default function MasterHeroPage() {
  const { heroId } = useParams();
  const [record, setRecord] = useState<MasterHeroRecord | null>(null);
  const [activeTab, setActiveTab] = useState<MasterTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!heroId) return;
    let active = true;
    void storage.getMasterHero(heroId).then((result) => { if (active) setRecord({ ...result, hero: normalizeHero(result.hero) }); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Held konnte nicht geladen werden."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [heroId]);

  if (!heroId) return <Navigate to="/meister" replace />;
  if (loading) return <div className="app-shell"><Sidebar /><main className="app-main"><section className="dsa-panel empty-state">Heldenansicht wird geladen …</section></main></div>;
  if (!record) return <div className="app-shell"><Sidebar /><main className="app-main"><Link to="/meister" className="back-link">← Zur Meisterübersicht</Link><p className="form-error">{error || "Held nicht gefunden."}</p></main></div>;
  const hero = record.hero;

  return <div className="app-shell"><Sidebar heroName={hero.name} /><main className="app-main master-hero-page">
    <div className="hero-page-toolbar"><Link className="back-link" to="/meister">← Zur Meisterübersicht</Link><span className="master-readonly-badge">Meisteransicht · Daten schreibgeschützt</span></div>
    <section className={`hero-banner hero-banner-${hero.accent}`}><div className="hero-banner-portrait">{hero.initials}</div><div className="hero-banner-copy"><p className="page-eyebrow">Spieler: {record.username}</p><h1>{hero.name}</h1><p className="hero-title">{hero.profession} · {hero.culture}</p></div><blockquote>„{hero.quote}“</blockquote></section>
    <nav className="hero-tabs" aria-label="Meisterbereiche">{tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
    {activeTab === "overview" && <MasterOverview hero={hero} />}
    {activeTab === "attributes" && <MasterAttributes hero={hero} />}
    {activeTab === "talents" && <MasterTalents hero={hero} />}
    {activeTab === "traits" && <MasterTraits hero={hero} />}
    {activeTab === "combat" && <MasterCombat hero={hero} />}
    {activeTab === "spells" && <MasterSpells hero={hero} />}
    {activeTab === "equipment" && <MasterEquipment hero={hero} />}
    {activeTab === "body" && <MasterBody hero={hero} onHeroChange={(updated) => setRecord({ ...record, hero: normalizeHero(updated), updatedAt: new Date().toISOString() })} />}
    {activeTab === "resistances" && <MasterResistances hero={hero} />}
  </main></div>;
}

function MasterOverview({ hero }: { hero: Hero }) {
  return <div className="master-detail-grid"><section className="dsa-panel"><div className="panel-heading"><span>Ressourcen</span><small>Live-Werte</small></div><div className="master-live-resources"><article><span>LeP</span><strong>{hero.lifePoints}</strong><small>/ {hero.maxLifePoints}</small></article><article><span>AsP</span><strong>{hero.astralPoints}</strong><small>/ {hero.maxAstralPoints}</small></article><article><span>Schip</span><strong>{hero.fatePoints}</strong><small>/ {hero.maxFatePoints}</small></article></div></section><section className="dsa-panel"><div className="panel-heading"><span>Grunddaten</span><small>Held</small></div><dl className="detail-list"><div><dt>Spezies</dt><dd>{hero.species}</dd></div><div><dt>Kultur</dt><dd>{hero.culture}</dd></div><div><dt>Profession</dt><dd>{hero.profession}</dd></div><div><dt>Erfahrung</dt><dd>{hero.experienceLevel}</dd></div></dl></section><section className="dsa-panel master-description"><div className="panel-heading"><span>Hintergrund</span><small>Beschreibung</small></div><p>{hero.description}</p></section><section className="dsa-panel"><div className="panel-heading"><span>Geldbeutel</span><small>Münzen</small></div><div className="master-money"><span><b>{hero.money.ducats}</b>Dukaten</span><span><b>{hero.money.silver}</b>Silbertaler</span><span><b>{hero.money.heller}</b>Heller</span></div></section></div>;
}

function MasterAttributes({ hero }: { hero: Hero }) { return <section className="dsa-panel tab-panel"><div className="panel-heading"><span>Eigenschaften</span><small>Schreibgeschützt</small></div><div className="attribute-grid">{hero.attributes.map((attribute) => <article className="attribute-card" key={attribute.short}><span>{attribute.short}</span><strong>{attribute.value}</strong><small>{attribute.name}</small></article>)}</div></section>; }

function MasterTalents({ hero }: { hero: Hero }) {
  const grouped = useMemo(() => talentCategories.map((category) => ({ category, talents: hero.talents.filter((talent) => talent.category === category) })), [hero.talents]);
  return <section className="dsa-panel tab-panel"><div className="panel-heading"><span>Talente & Sprachen</span><small>Schreibgeschützt</small></div><div className="talent-category-grid">{grouped.map(({ category, talents }) => <section className="talent-category" key={category}><h2>{category}</h2>{talents.map((talent) => <div className="master-talent-row" key={talent.name}><span>{talent.name}</span><small>{talent.check}</small><b>{talent.value}</b></div>)}</section>)}</div><section className="subsection-card"><div className="subsection-heading"><div><span>Sprachen & Schriften</span><small>Kenntnisse</small></div></div><div className="master-simple-grid">{hero.languages.map((entry) => <article key={entry.id}><strong>{entry.name}</strong><span>Stufe {entry.level}</span><small>{entry.script || "Keine Schrift"}{entry.notes ? ` · ${entry.notes}` : ""}</small></article>)}</div></section></section>;
}

function MasterTraits({ hero }: { hero: Hero }) {
  const groups = [{ title: "Vorteile", entries: hero.advantages }, { title: "Nachteile", entries: hero.disadvantages }];
  return <section className="dsa-panel tab-panel"><div className="panel-heading"><span>Vorteile & Nachteile</span><small>Schreibgeschützt</small></div><div className="trait-columns">{groups.map((group) => <section key={group.title} className="subsection-card trait-list"><div className="subsection-heading"><div><span>{group.title}</span></div><b>{group.entries.reduce((sum, entry) => sum + entry.apValue * entry.level, 0)} AP</b></div><div className="trait-grid">{group.entries.map((entry) => <article key={entry.id}><div className="trait-card-heading"><div><strong>{entry.name}</strong><small>Stufe {entry.level}</small></div><b>{entry.apValue * entry.level} AP</b></div><p>{entry.description || "Keine Regelbeschreibung eingetragen."}</p>{entry.requirements && <small>Voraussetzungen: {entry.requirements}</small>}</article>)}</div></section>)}</div><section className="subsection-card"><div className="subsection-heading"><div><span>Allgemeine Sonderfertigkeiten</span><small>Spezialisierungen und nichtmagische Fähigkeiten</small></div></div><div className="master-simple-grid">{hero.specialAbilities.map((entry) => <article key={entry.id}><strong>{entry.name}</strong><small>{entry.description || "Keine Beschreibung"}</small></article>)}</div></section></section>;
}

function MasterCombat({ hero }: { hero: Hero }) {
  const values = [["AT", hero.combat.attack, "Attacke"], ["PA", hero.combat.parry, "Parade"], ["AW", hero.combat.dodge, "Ausweichen"], ["INI", hero.combat.initiative, "Initiative"], ["GS", hero.combat.speed, "Geschwindigkeit"], ["RS", hero.combat.armor, "Rüstungsschutz"]] as const;
  const combatItems = hero.equipment.filter((item) => item.itemType === "weapon" || item.itemType === "shield" || item.itemType === "armor");
  return <section className="dsa-panel tab-panel"><div className="panel-heading"><span>Kampf</span><small>Schreibgeschützt</small></div><div className="combat-stat-grid">{values.map(([short, value, label]) => <article key={short}><span>{short}</span><strong>{value}</strong><small>{label}</small></article>)}</div><section className="subsection-card"><div className="subsection-heading"><div><span>Kampftechniken</span><small>AT, PA, KTaW und Leiteigenschaft</small></div></div><div className="master-simple-grid">{hero.combat.techniques.map((entry) => <article key={entry.id}><strong>{entry.name}</strong><span>KTaW {entry.skill}</span><span>AT {entry.attack} · PA {entry.parry ?? "–"}</span><span>Leiteigenschaft {entry.primaryAttribute || "–"} · Steigerung {entry.improvementCost || "–"}</span><small>{entry.notes || (entry.kind === "melee" ? "Nahkampf" : "Fernkampf")}</small></article>)}</div></section><section className="subsection-card"><div className="subsection-heading"><div><span>Waffen, Schilde & Rüstung</span><small>Aus dem Inventar</small></div></div><div className="master-simple-grid">{combatItems.map((item) => <article key={item.id}><strong>{item.name}</strong><span>{item.combatTechnique || item.category || "Kampfausrüstung"}</span>{item.itemType === "weapon" && <span>TP {item.damage || "–"} · AT {item.attackModifier ?? 0} · PA {item.parryModifier ?? 0}</span>}{item.itemType === "shield" && <span>PA {item.parryModifier ?? 0}</span>}{item.itemType === "armor" && <span>RS {item.armor ?? 0} · BE {item.encumbrance ?? 0}</span>}<small>{item.notes || "Keine Notiz"}</small></article>)}</div></section></section>;
}

function MasterSpells({ hero }: { hero: Hero }) { return <section className="dsa-panel tab-panel"><div className="panel-heading"><span>Magie</span><small>Zauber und Sonderfertigkeiten</small></div><div className="master-simple-grid">{hero.spells.map((spell, index) => <article key={`${spell.name}-${index}`}><strong>{spell.name}</strong><span>{spell.check} · FW {spell.value}</span><small>{spell.cost || "Keine Kosten"}</small></article>)}</div><section className="subsection-card"><div className="subsection-heading"><div><span>Magische Sonderfertigkeiten</span></div></div><div className="master-simple-grid">{hero.magicalSpecialAbilities.map((entry) => <article key={entry.id}><strong>{entry.name}</strong><small>{entry.description || "Keine Beschreibung"}</small></article>)}</div></section><section className="subsection-card"><div className="subsection-heading"><div><span>Zaubertricks</span></div></div><div className="master-simple-grid">{hero.cantrips.map((entry) => <article key={entry.id}><strong>{entry.name}</strong><small>{entry.description || "Keine Beschreibung"}</small></article>)}</div></section></section>; }

function MasterEquipment({ hero }: { hero: Hero }) { return <section className="dsa-panel tab-panel"><div className="panel-heading"><span>Ausrüstung</span><small>{hero.equipment.length} Gegenstände</small></div><div className="master-simple-grid">{hero.equipment.map((item) => <article key={item.id}><strong>{item.quantity}× {item.name}</strong><span>{item.category || "Ohne Kategorie"}</span><small>{item.notes || item.description || "Keine Notiz"}</small></article>)}</div></section>; }

function MasterResistances({ hero }: { hero: Hero }) { return <section className="dsa-panel tab-panel"><div className="panel-heading"><span>Resistenzen & Immunitäten</span><small>Schreibgeschützt</small></div><div className="master-simple-grid">{hero.resistances.map((entry) => <article key={entry.id} className={entry.immune ? "master-immune" : ""}><strong>{entry.name}</strong><span>{entry.immune ? "Immun" : `Schutz ${entry.protection}`}</span><small>{entry.notes || "Keine Notiz"}</small></article>)}</div></section>; }

function MasterBody({ hero, onHeroChange }: { hero: Hero; onHeroChange: (hero: Hero) => void }) {
  const [draft, setDraft] = useState({ name: "", level: 1, cause: "", duration: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function addStatus(event: FormEvent) { event.preventDefault(); if (!draft.name.trim()) return; setSaving(true); setError(""); try { onHeroChange(await storage.addMasterStatus(hero.id, draft)); setDraft({ name: "", level: 1, cause: "", duration: "", notes: "" }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Status konnte nicht gesetzt werden."); } finally { setSaving(false); } }
  async function removeStatus(statusId: string) { setSaving(true); setError(""); try { onHeroChange(await storage.removeMasterStatus(hero.id, statusId)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Status konnte nicht entfernt werden."); } finally { setSaving(false); } }
  return <section className="dsa-panel master-body-panel"><div className="panel-heading"><span>Körper & Meistereffekte</span><small>Nur Statuseffekte sind veränderbar</small></div><div className="master-body-grid"><div className="body-figure-card"><div className="body-figure-title"><span>Körperzustand</span><small>Live vom Spielerbogen</small></div><BodyFigure hero={hero} /></div><section className="master-body-parts"><h2>Verletzungen</h2>{bodyPartDefinitions.map((definition) => { const part = hero.body.parts.find((entry) => entry.id === definition.id); return <article key={definition.id}><div><strong>{definition.label}</strong><span>{part?.damage ?? 0} / {part?.maxDamage ?? 4}</span></div><small>{part?.notes || "Keine Verletzungsnotiz"}</small></article>; })}</section></div>
    <section className="master-effects"><div className="subsection-heading"><div><span>Statuseffekt als Meister setzen</span><small>Beim Spieler erscheint dieser Effekt mit einem roten Ausrufezeichen.</small></div></div><Form className="status-form" onSubmit={addStatus}><Form.Group><Form.Label>Status</Form.Label><Form.Control required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Vergiftet" /></Form.Group><Form.Group><Form.Label>Stufe</Form.Label><Form.Control type="number" min={1} value={draft.level} onChange={(event) => setDraft({ ...draft, level: Math.max(1, Number(event.target.value)) })} /></Form.Group><Form.Group><Form.Label>Ursache</Form.Label><Form.Control value={draft.cause} onChange={(event) => setDraft({ ...draft, cause: event.target.value })} /></Form.Group><Form.Group><Form.Label>Dauer</Form.Label><Form.Control value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} /></Form.Group><Form.Group><Form.Label>Notiz</Form.Label><Form.Control value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Form.Group><Button type="submit" disabled={saving} className="dsa-primary-button">Meistereffekt setzen</Button></Form>{error && <p className="form-error">{error}</p>}
      <div className="master-status-list">{hero.body.statuses.map((status) => <article key={status.id} className={status.source === "master" ? "from-master" : "from-player"}><div><strong>{status.source === "master" && <b>!</b>}{status.name}</strong><span>Stufe {status.level}</span></div><p>{status.cause || "Keine Ursache"} · {status.duration || "Unbegrenzt"}</p>{status.notes && <small>{status.notes}</small>}{status.source === "master" ? <button type="button" disabled={saving} onClick={() => void removeStatus(status.id)}>Meistereffekt entfernen</button> : <em>Vom Spieler verwaltet</em>}</article>)}</div>
    </section></section>;
}
