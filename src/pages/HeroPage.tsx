import { useMemo, useState, type FormEvent } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import ProgressBar from "react-bootstrap/ProgressBar";
import { Link, Navigate, useParams } from "react-router";
import BodyPanel from "../components/hero/BodyPanel";
import CheckRollModal, { type CheckRequest } from "../components/hero/CheckRollModal";
import { CombatPanel, LanguagesSection, MagicExtrasSection, MoneyPouchPanel, ResistancePanel, TraitsPanel } from "../components/hero/HeroExtraPanels";
import { EquipmentDetailModal, SpellDetailModal } from "../components/hero/HeroDetailModals";
import Sidebar from "../components/layout/Sidebar";
import { useApp } from "../context/app-context";
import { equipmentSlots } from "../data/body";
import { talentCategories } from "../data/talents";
import type { EquipmentItem, EquipmentItemType, EquipmentSlotId, Hero, SpellValue, TalentCategory, WeaponKind } from "../models/Hero";
import { createId } from "../utils/id";
import { storage } from "../services/storage";

type HeroTab = "overview" | "attributes" | "talents" | "traits" | "combat" | "spells" | "equipment" | "body" | "resistances";
type HeroMode = "play" | "setup";
type HeroUpdater = (updater: (hero: Hero) => Hero) => void;

const tabs: { id: HeroTab; label: string }[] = [
  { id: "overview", label: "Übersicht" },
  { id: "attributes", label: "Eigenschaften" },
  { id: "talents", label: "Talente" },
  { id: "traits", label: "Vor- & Nachteile" },
  { id: "combat", label: "Kampf" },
  { id: "spells", label: "Zauber" },
  { id: "equipment", label: "Ausrüstung" },
  { id: "body", label: "Körper" },
  { id: "resistances", label: "Resistenzen" },
];

function initialsFor(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function HeroPage() {
  const { heroId } = useParams();
  const { heroes, updateHero } = useApp();
  const [activeTab, setActiveTab] = useState<HeroTab>("overview");
  const [mode, setMode] = useState<HeroMode>("play");
  const [equipmentDetailId, setEquipmentDetailId] = useState<string | null>(null);
  const [checkRequest, setCheckRequest] = useState<CheckRequest | null>(null);
  const hero = heroes.find((candidate) => candidate.id === heroId);
  if (!hero) return <Navigate to="/" replace />;
  const patchHero: HeroUpdater = (updater) => updateHero(hero.id, updater);
  const setup = mode === "setup";
  const freeAp = Math.max(0, hero.adventurePoints - hero.spentAdventurePoints);
  const detailItem = hero.equipment.find((item) => item.id === equipmentDetailId) ?? null;
  const equippedSlot = equipmentSlots.find((slot) => hero.body.equipped[slot.id] === equipmentDetailId)?.label;

  function patchEquipment(itemId: string, patch: Partial<EquipmentItem>) {
    patchHero((current) => {
      const equipment = current.equipment.map((item) => item.id === itemId ? { ...item, ...patch } : item);
      const equipped = Object.fromEntries(Object.entries(current.body.equipped).filter(([slotId, equippedId]) => {
        if (equippedId !== itemId) return true;
        if (patch.showOnBody === false) return false;
        if (patch.allowedSlots && !patch.allowedSlots.includes(slotId as EquipmentSlotId)) return false;
        return true;
      }));
      return { ...current, equipment, body: { ...current.body, equipped } };
    });
  }

  function removeEquipment(itemId: string) {
    patchHero((current) => ({
      ...current,
      equipment: current.equipment.filter((item) => item.id !== itemId),
      body: { ...current.body, equipped: Object.fromEntries(Object.entries(current.body.equipped).filter(([, equippedId]) => equippedId !== itemId)) },
    }));
    setEquipmentDetailId(null);
  }

  return (
    <div className="app-shell">
      <Sidebar heroName={hero.name} />
      <main className="app-main hero-page">
        <div className="hero-page-toolbar">
          <Link className="back-link" to="/">← Zurück zur Übersicht</Link>
          <div className="hero-toolbar-actions">
            <button type="button" className={`session-toggle${hero.sessionActive ? " active" : ""}`} onClick={() => patchHero((current) => ({ ...current, sessionActive: !current.sessionActive }))}><span className="session-toggle-dot" />{hero.sessionActive ? "In der Sitzung" : "Nicht in der Sitzung"}</button>
            <div className="mode-switch" role="group" aria-label="Modus des Heldenbogens">
              <button type="button" className={!setup ? "active" : ""} onClick={() => setMode("play")}>Spielmodus</button>
              <button type="button" className={setup ? "active" : ""} onClick={() => setMode("setup")}>Setup-Modus</button>
            </div>
          </div>
        </div>
        <p className={`mode-note mode-note-${mode}`}>{setup ? "Setup-Modus: Grunddaten, Werte, Talente, Zauber, Ausrüstung und Belastungsgrenzen können verändert werden." : "Spielmodus: Laufende Ressourcen, Körperschäden, Statuseffekte und angelegte Ausrüstung können verändert werden."}</p>

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
                  <div className="panel-heading"><span>Verfügbare Abenteuerpunkte</span><small>Noch frei</small></div>
                  <div className="ap-number">{freeAp}<small>AP</small></div>
                  {setup && (
                    <div className="ap-editor">
                      <label>Frei verfügbar<input type="number" min={0} value={freeAp} onChange={(event) => patchHero((current) => ({ ...current, adventurePoints: current.spentAdventurePoints + Math.max(0, Number(event.target.value) || 0) }))} /></label>
                    </div>
                  )}
                </article>

                <MoneyPouchPanel hero={hero} updateHero={patchHero} />
                <HeroTokenPanel hero={hero} updateHero={patchHero} />
              </aside>
            </div>
          </>
        )}

        {activeTab === "attributes" && <AttributePanel hero={hero} updateHero={patchHero} setup={setup} />}
        {activeTab === "talents" && <TalentPanel hero={hero} updateHero={patchHero} setup={setup} onRoll={setCheckRequest} />}
        {activeTab === "traits" && <TraitsPanel hero={hero} updateHero={patchHero} setup={setup} />}
        {activeTab === "combat" && <CombatPanel hero={hero} updateHero={patchHero} setup={setup} onInspectItem={setEquipmentDetailId} />}
        {activeTab === "spells" && <SpellPanel hero={hero} updateHero={patchHero} setup={setup} onRoll={setCheckRequest} />}
        {activeTab === "equipment" && <EquipmentPanel hero={hero} updateHero={patchHero} setup={setup} onInspectItem={setEquipmentDetailId} onPatchItem={patchEquipment} />}
        {activeTab === "body" && <BodyPanel hero={hero} updateHero={patchHero} setup={setup} onInspectItem={setEquipmentDetailId} />}
        {activeTab === "resistances" && <ResistancePanel hero={hero} updateHero={patchHero} setup={setup} />}

        <EquipmentDetailModal item={detailItem} setup={setup} equippedAt={equippedSlot} onHide={() => setEquipmentDetailId(null)} onChange={(patch) => { if (equipmentDetailId) patchEquipment(equipmentDetailId, patch); }} onDelete={() => { if (equipmentDetailId) removeEquipment(equipmentDetailId); }} />
        <CheckRollModal key={checkRequest ? `${checkRequest.kind}-${checkRequest.name}` : "closed"} request={checkRequest} attributes={hero.attributes} onHide={() => setCheckRequest(null)} />
      </main>
    </div>
  );
}

function HeroTokenPanel({ hero, updateHero }: { hero: Hero; updateHero: HeroUpdater }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Bitte wähle eine PNG-, JPG- oder WebP-Datei aus."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Das Token darf höchstens 2 MB groß sein."); return; }
    setUploading(true);
    setError("");
    try {
      const updated = await storage.uploadHeroToken(hero.id, file);
      updateHero((current) => ({ ...current, mapTokenVersion: updated.mapTokenVersion }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Das Token konnte nicht hochgeladen werden.");
    } finally {
      setUploading(false);
    }
  }
  return <article className="dsa-panel hero-token-panel"><div className="panel-heading"><span>Karten-Token</span><small>PNG, JPG oder WebP · maximal 2 MB</small></div><div className="hero-token-content">{hero.mapTokenVersion ? <img src={`/api/heroes/${encodeURIComponent(hero.id)}/token?v=${hero.mapTokenVersion}`} alt={`Karten-Token von ${hero.name}`} /> : <div className="token-placeholder">{hero.initials}</div>}<div><p>Dieses Bild stellt deinen Helden später auf der Karte dar.</p><label className="token-upload-button">{uploading ? "Wird hochgeladen …" : hero.mapTokenVersion ? "Token ersetzen" : "Token hochladen"}<input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" disabled={uploading} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label></div></div>{error && <p className="form-error">{error}</p>}</article>;
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

function TalentPanel({ hero, updateHero, setup, onRoll }: { hero: Hero; updateHero: HeroUpdater; setup: boolean; onRoll: (request: CheckRequest) => void }) {
  const grouped = useMemo(() => talentCategories.map((category) => ({ category, talents: hero.talents.filter((talent) => talent.category === category) })), [hero.talents]);
  function patchTalent(category: TalentCategory, name: string, patch: Partial<(typeof hero.talents)[number]>) {
    updateHero((current) => ({ ...current, talents: current.talents.map((talent) => talent.category === category && talent.name === name ? { ...talent, ...patch } : talent) }));
  }
  return (
    <section className="dsa-panel tab-panel">
      <div className="panel-heading"><span>Talente</span><small>{setup ? "Werte bearbeiten" : "Alle Talentgruppen"}</small></div>
      <AttributeReference hero={hero} />
      <p className="panel-intro">{setup ? "Talentwerte können jetzt geändert werden." : "Zum Ändern der Talentwerte in den Setup-Modus wechseln."}</p>
      <div className="talent-category-grid">
        {grouped.map(({ category, talents }) => (
          <section className="talent-category" key={category}><h2>{category}</h2><div className="talent-rows">
            {talents.map((talent) => <div key={talent.name} className="talent-row"><span className="talent-name">{talent.name}</span>{setup ? <input className="talent-check-input" value={talent.check} onChange={(event) => patchTalent(category, talent.name, { check: event.target.value })} aria-label={`Probe für ${talent.name}`} /> : <small className="talent-check">{talent.check}</small>}<input className="talent-value-input" type="number" min={0} max={30} disabled={!setup} value={talent.value} onChange={(event) => patchTalent(category, talent.name, { value: Math.max(0, Math.min(30, Number(event.target.value))) })} aria-label={`Talentwert für ${talent.name}`} /><button type="button" className="talent-roll-button" onClick={() => onRoll({ name: talent.name, check: talent.check, value: talent.value, kind: "Talent" })}>3W20</button></div>)}
          </div></section>
        ))}
      </div>
      <LanguagesSection hero={hero} updateHero={updateHero} setup={setup} />
    </section>
  );
}

function SpellPanel({ hero, updateHero, setup, onRoll }: { hero: Hero; updateHero: HeroUpdater; setup: boolean; onRoll: (request: CheckRequest) => void }) {
  const [draft, setDraft] = useState<SpellValue>({ name: "", check: "", value: 0, cost: "" });
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const detailSpell = detailIndex === null ? null : hero.spells[detailIndex] ?? null;
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
    setDetailIndex(null);
  }
  return (
    <section className="dsa-panel tab-panel">
      <div className="panel-heading"><span>Zauber</span><small>{setup ? "Bearbeiten und ergänzen" : "Magisches Repertoire"}</small></div>
      <AttributeReference hero={hero} />
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
          {hero.spells.map((spell, index) => (
            <article key={`${index}-${spell.name}`} className="spell-card spell-detail-card">
              <button type="button" className="spell-detail-open" onClick={() => setDetailIndex(index)}><div><span>Zauber</span><strong>{spell.name}</strong></div><dl><div><dt>Probe</dt><dd>{spell.check || "–"}</dd></div><div><dt>FW</dt><dd>{spell.value}</dd></div><div><dt>Kosten</dt><dd>{spell.cost || "–"}</dd></div></dl><small>Für Details öffnen →</small></button>
              <button type="button" className="spell-roll-button" onClick={() => onRoll({ name: spell.name, check: spell.check, value: spell.value, kind: "Zauber" })}>3W20-Probe würfeln</button>
            </article>
          ))}
        </div>
      ) : <p className="empty-state">Dieser Held beherrscht noch keine Zauber.</p>}
      <SpellDetailModal spell={detailSpell} setup={setup} onHide={() => setDetailIndex(null)} onChange={(patch) => { if (detailIndex !== null) patchSpell(detailIndex, patch); }} onDelete={() => { if (detailIndex !== null) removeSpell(detailIndex); }} />
      <MagicExtrasSection hero={hero} updateHero={updateHero} setup={setup} />
    </section>
  );
}

function AttributeReference({ hero }: { hero: Hero }) {
  return <section className="attribute-reference" aria-label="Eigenschaftswerte für Proben"><div className="attribute-reference-heading"><strong>Eigenschaften für die Probe</strong><span>Die drei genannten Werte werden jeweils mit 1W20 geprüft.</span></div><div>{hero.attributes.map((attribute) => <article key={attribute.short}><span>{attribute.short}</span><strong>{attribute.value}</strong><small>{attribute.name}</small></article>)}</div></section>;
}

function EquipmentPanel({ hero, updateHero, setup, onInspectItem, onPatchItem }: { hero: Hero; updateHero: HeroUpdater; setup: boolean; onInspectItem: (itemId: string) => void; onPatchItem: (itemId: string, patch: Partial<EquipmentItem>) => void }) {
  const [draft, setDraft] = useState({ name: "", quantity: 1, notes: "", itemType: "general" as EquipmentItemType, weaponKind: "melee" as WeaponKind, combatTechnique: "", damage: "", armor: 0, encumbrance: 0, parryModifier: 0 });
  function addItem(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const category = draft.itemType === "weapon" ? "Waffe" : draft.itemType === "armor" ? "Rüstung" : draft.itemType === "shield" ? "Schild" : "";
    const handItem = draft.itemType === "weapon" || draft.itemType === "shield";
    const item: EquipmentItem = {
      id: createId(),
      name: draft.name.trim(),
      quantity: Math.max(1, draft.quantity),
      notes: draft.notes.trim(),
      itemType: draft.itemType,
      category,
      weaponKind: draft.weaponKind,
      combatTechnique: draft.combatTechnique.trim(),
      damage: draft.damage.trim(),
      armor: Math.max(0, draft.armor),
      encumbrance: Math.max(0, draft.encumbrance),
      attackModifier: 0,
      parryModifier: draft.parryModifier,
      ammunition: 0,
      showOnBody: draft.itemType !== "general",
      allowedSlots: handItem ? ["rightHand", "leftHand"] : draft.itemType === "armor" ? ["torso"] : [],
    };
    updateHero((current) => ({ ...current, equipment: [...current.equipment, item] }));
    setDraft({ name: "", quantity: 1, notes: "", itemType: "general", weaponKind: "melee", combatTechnique: "", damage: "", armor: 0, encumbrance: 0, parryModifier: 0 });
  }
  return (
    <section className="dsa-panel tab-panel">
      <div className="panel-heading"><span>Ausrüstung</span><small>{setup ? "Bearbeiten und ergänzen" : "Inventar"}</small></div>
      {setup && (
        <Form className="equipment-form equipment-create-form" onSubmit={addItem}>
          <Form.Group><Form.Label>Gegenstand</Form.Label><Form.Control value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Heiltrank" /></Form.Group>
          <Form.Group><Form.Label>Art</Form.Label><Form.Select value={draft.itemType} onChange={(event) => setDraft({ ...draft, itemType: event.target.value as EquipmentItemType })}><option value="general">Allgemein</option><option value="weapon">Waffe</option><option value="armor">Rüstung</option><option value="shield">Schild</option></Form.Select></Form.Group>
          <Form.Group><Form.Label>Anzahl</Form.Label><Form.Control type="number" min={1} value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} /></Form.Group>
          {draft.itemType === "weapon" && <><Form.Group><Form.Label>Einsatz</Form.Label><Form.Select value={draft.weaponKind} onChange={(event) => setDraft({ ...draft, weaponKind: event.target.value as WeaponKind })}><option value="melee">Nahkampf</option><option value="ranged">Fernkampf</option></Form.Select></Form.Group><Form.Group><Form.Label>Kampftechnik</Form.Label><Form.Control value={draft.combatTechnique} onChange={(event) => setDraft({ ...draft, combatTechnique: event.target.value })} placeholder="z. B. Schwerter" /></Form.Group><Form.Group><Form.Label>Trefferpunkte</Form.Label><Form.Control value={draft.damage} onChange={(event) => setDraft({ ...draft, damage: event.target.value })} placeholder="1W6+4" /></Form.Group></>}
          {draft.itemType === "armor" && <><Form.Group><Form.Label>Rüstungsschutz</Form.Label><Form.Control type="number" min={0} value={draft.armor} onChange={(event) => setDraft({ ...draft, armor: Number(event.target.value) })} /></Form.Group><Form.Group><Form.Label>Belastung</Form.Label><Form.Control type="number" min={0} value={draft.encumbrance} onChange={(event) => setDraft({ ...draft, encumbrance: Number(event.target.value) })} /></Form.Group></>}
          {draft.itemType === "shield" && <><Form.Group><Form.Label>Kampftechnik</Form.Label><Form.Control value={draft.combatTechnique} onChange={(event) => setDraft({ ...draft, combatTechnique: event.target.value })} placeholder="Schilde" /></Form.Group><Form.Group><Form.Label>PA-Modifikator</Form.Label><Form.Control type="number" value={draft.parryModifier} onChange={(event) => setDraft({ ...draft, parryModifier: Number(event.target.value) })} /></Form.Group></>}
          <Form.Group><Form.Label>Notiz</Form.Label><Form.Control value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="optional" /></Form.Group>
          <Button type="submit" className="dsa-primary-button">Hinzufügen</Button>
        </Form>
      )}
      {hero.equipment.length ? (
        <div className="equipment-detail-grid">{hero.equipment.map((item) => <article key={item.id} className={`equipment-config-card item-${item.itemType ?? "general"}`}><button type="button" className="equipment-detail-card" onClick={() => onInspectItem(item.id)}><span>{item.quantity}×</span><div><strong>{item.name}</strong><small>{item.category || item.notes || "Allgemeiner Gegenstand"}</small>{item.itemType === "weapon" && <em>{item.combatTechnique || "Keine Kampftechnik"} · {item.damage || "keine TP"}</em>}{item.itemType === "armor" && <em>RS {item.armor ?? 0} · BE {item.encumbrance ?? 0}</em>}{item.itemType === "shield" && <em>PA {item.parryModifier && item.parryModifier > 0 ? "+" : ""}{item.parryModifier ?? 0}</em>}</div><b>Details →</b></button>{setup && <div className="inline-body-config"><Form.Check type="checkbox" id={`inline-body-${item.id}`} label="Im Körperbereich anzeigen" checked={Boolean(item.showOnBody)} onChange={(event) => onPatchItem(item.id, { showOnBody: event.target.checked })} />{item.showOnBody && <div className="inline-slot-picker"><span>Wo kann es ausgerüstet werden?</span><div>{equipmentSlots.map((slot) => { const selected = item.allowedSlots?.includes(slot.id) ?? false; return <button type="button" key={slot.id} className={selected ? "selected" : ""} onClick={() => onPatchItem(item.id, { allowedSlots: selected ? item.allowedSlots?.filter((id) => id !== slot.id) : [...(item.allowedSlots ?? []), slot.id] })}>{slot.label}</button>; })}</div></div>}</div>}</article>)}</div>
      ) : <p className="empty-state">Das Inventar ist noch leer.</p>}
    </section>
  );
}

export default HeroPage;
