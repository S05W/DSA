import { useState, type DragEvent, type FormEvent } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { bodyPartDefinitions, commonStatuses, equipmentSlots } from "../../data/body";
import type { BodyPartId, EquipmentSlotId, Hero } from "../../models/Hero";
import { createId } from "../../utils/id";

type HeroUpdater = (updater: (hero: Hero) => Hero) => void;

interface BodyPanelProps {
  hero: Hero;
  setup: boolean;
  updateHero: HeroUpdater;
  onInspectItem: (itemId: string) => void;
}

export default function BodyPanel({ hero, setup, updateHero, onInspectItem }: BodyPanelProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState({ name: "", level: 1, cause: "", duration: "", notes: "" });

  function patchBody(updater: (body: Hero["body"]) => Hero["body"], historyMessage?: string) {
    updateHero((current) => {
      const updated = updater(current.body);
      const body = historyMessage ? { ...updated, history: [...updated.history, { id: createId(), timestamp: new Date().toISOString(), actor: "player" as const, message: historyMessage }].slice(-100) } : updated;
      return { ...current, body };
    });
  }

  function equip(slot: EquipmentSlotId, itemId: string) {
    const item = hero.equipment.find((candidate) => candidate.id === itemId);
    if (!item?.showOnBody || !item.allowedSlots?.includes(slot)) return;
    patchBody((body) => {
      const equipped = Object.fromEntries(Object.entries(body.equipped).filter(([, currentItemId]) => currentItemId !== itemId)) as Hero["body"]["equipped"];
      equipped[slot] = itemId;
      return { ...body, equipped };
    }, `${item.name} wurde an „${equipmentSlots.find((candidate) => candidate.id === slot)?.label}“ ausgerüstet.`);
    setSelectedItemId(null);
  }

  function unequip(slot: EquipmentSlotId) {
    const item = hero.equipment.find((candidate) => candidate.id === hero.body.equipped[slot]);
    patchBody((body) => {
      const equipped = { ...body.equipped };
      delete equipped[slot];
      return { ...body, equipped };
    }, item ? `${item.name} wurde abgelegt.` : undefined);
  }

  function dropOnSlot(event: DragEvent, slot: EquipmentSlotId) {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/equipment-id");
    if (itemId) equip(slot, itemId);
  }

  function patchPart(partId: BodyPartId, patch: Partial<Hero["body"]["parts"][number]>) {
    patchBody((body) => ({ ...body, parts: body.parts.map((part) => part.id === partId ? { ...part, ...patch } : part) }));
  }

  function setPartDamage(partId: BodyPartId, nextDamage: number) {
    const part = hero.body.parts.find((candidate) => candidate.id === partId)!;
    const damage = Math.max(0, Math.min(part.maxDamage, nextDamage));
    if (damage === part.damage) return;
    patchBody((body) => ({ ...body, parts: body.parts.map((current) => current.id === partId ? { ...current, damage } : current) }), `${part.label}: Schaden von ${part.damage} auf ${damage} geändert.`);
  }

  function addStatus(event: FormEvent) {
    event.preventDefault();
    if (!statusDraft.name.trim()) return;
    const status = { id: createId(), name: statusDraft.name.trim(), level: Math.max(1, statusDraft.level), cause: statusDraft.cause.trim(), duration: statusDraft.duration.trim(), notes: statusDraft.notes.trim(), source: "player" as const };
    patchBody((body) => ({ ...body, statuses: [...body.statuses, status] }), `Status „${status.name}“ (Stufe ${status.level}) hinzugefügt.`);
    setStatusDraft({ name: "", level: 1, cause: "", duration: "", notes: "" });
  }

  function patchStatus(id: string, patch: Partial<Hero["body"]["statuses"][number]>) {
    patchBody((body) => ({ ...body, statuses: body.statuses.map((status) => status.id === id ? { ...status, ...patch } : status) }));
  }

  function setStatusLevel(id: string, level: number) {
    const status = hero.body.statuses.find((candidate) => candidate.id === id);
    if (!status) return;
    const safeLevel = Math.max(1, level);
    patchBody((body) => ({ ...body, statuses: body.statuses.map((current) => current.id === id ? { ...current, level: safeLevel } : current) }), `Status „${status.name}“ auf Stufe ${safeLevel} gesetzt.`);
  }

  function removeStatus(id: string) {
    const status = hero.body.statuses.find((candidate) => candidate.id === id);
    patchBody((body) => ({ ...body, statuses: body.statuses.filter((current) => current.id !== id) }), status ? `Status „${status.name}“ entfernt.` : undefined);
  }

  const equippedIds = new Set(Object.values(hero.body.equipped));
  const bodyEquipment = hero.equipment.filter((item) => item.showOnBody);
  const selectedItem = hero.equipment.find((item) => item.id === selectedItemId);

  return (
    <section className="dsa-panel body-panel">
      <div className="panel-heading"><span>Körper & Ausrüstung</span><small>Zustand und getragene Gegenstände</small></div>
      <p className="panel-intro">Ziehe einen Gegenstand aus dem Inventar auf einen Ausrüstungsplatz. Auf Touch-Geräten zuerst den Gegenstand und danach den Platz antippen.</p>

      <div className="body-workspace">
        <section className="equipment-slots" aria-label="Ausrüstungsplätze">
          <h2>Ausrüstungsplätze</h2>
          {equipmentSlots.map((slot) => {
            const itemId = hero.body.equipped[slot.id];
            const item = hero.equipment.find((candidate) => candidate.id === itemId);
            const compatible = !selectedItem || Boolean(selectedItem.showOnBody && selectedItem.allowedSlots?.includes(slot.id));
            return (
              <div key={slot.id} className={`equipment-slot${item ? " occupied" : ""}${selectedItemId && compatible ? " ready" : ""}${selectedItemId && !compatible ? " incompatible" : ""}`} onDragOver={(event) => { if (compatible) event.preventDefault(); }} onDrop={(event) => dropOnSlot(event, slot.id)} onClick={() => { if (!item && selectedItemId && compatible) equip(slot.id, selectedItemId); }}>
                <span>{slot.label}</span>
                {item ? <><button type="button" className="slot-item" onClick={(event) => { event.stopPropagation(); onInspectItem(item.id); }}>{item.name}</button><button type="button" className="slot-remove" onClick={(event) => { event.stopPropagation(); unequip(slot.id); }} aria-label={`${item.name} ablegen`}>×</button></> : <small>Leer</small>}
              </div>
            );
          })}
        </section>

        <section className="body-figure-card" aria-label="Körperzustand">
          <div className="body-figure-title"><span>Körperzustand</span><small>Grün gesund · Rot verletzt</small></div>
          <div className="body-status-overlay">{hero.body.statuses.length ? hero.body.statuses.map((status) => <span key={status.id} className={status.source === "master" ? "master-status-warning" : ""}>{status.source === "master" && <b aria-label="Vom Meister gesetzt">!</b>}{status.name} {status.level}</span>) : <span className="status-clear">Keine Statuseffekte</span>}</div>
          <BodyFigure hero={hero} />
        </section>

        <section className="body-part-list">
          <h2>Körperzonen</h2>
          {bodyPartDefinitions.map((definition) => {
            const part = hero.body.parts.find((candidate) => candidate.id === definition.id)!;
            const severity = damageSeverity(part.damage, part.maxDamage);
            return (
              <article key={part.id} className={`body-part-card ${severity}`}>
                <div><strong>{part.label}</strong><span>{part.damage} / {part.maxDamage} Schaden</span></div>
                <div className="body-damage-actions"><button type="button" onClick={() => setPartDamage(part.id, part.damage - 1)}>−</button><input type="number" min={0} max={part.maxDamage} value={part.damage} onChange={(event) => setPartDamage(part.id, Number(event.target.value))} /><button type="button" onClick={() => setPartDamage(part.id, part.damage + 1)}>+</button></div>
                {setup && <label className="body-max-damage">Grenzwert<input type="number" min={1} value={part.maxDamage} onChange={(event) => patchPart(part.id, { maxDamage: Math.max(1, Number(event.target.value)), damage: Math.min(part.damage, Math.max(1, Number(event.target.value))) })} /></label>}
                <input className="body-part-notes" value={part.notes} onChange={(event) => patchPart(part.id, { notes: event.target.value })} placeholder="Verletzung oder Notiz" />
              </article>
            );
          })}
        </section>
      </div>

      <section className="body-inventory">
        <div className="body-section-heading"><h2>Inventar zum Ausrüsten</h2><span>{selectedItemId ? "Gegenstand ausgewählt – jetzt Platz antippen" : "Ziehen oder antippen"}</span></div>
        {bodyEquipment.length ? <div className="body-inventory-grid">{bodyEquipment.map((item) => (
          <article key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/equipment-id", item.id)} className={`draggable-item${selectedItemId === item.id ? " selected" : ""}${equippedIds.has(item.id) ? " equipped" : ""}`}>
            <button type="button" onClick={() => setSelectedItemId((current) => current === item.id ? null : item.id)}><strong>{item.name}</strong><span>{equippedIds.has(item.id) ? "Ausgerüstet" : `${item.quantity}× vorhanden`}</span></button>
            <button type="button" className="item-details-button" onClick={() => onInspectItem(item.id)}>Details</button>
          </article>
        ))}</div> : <p className="empty-state">Aktiviere bei einem Gegenstand im Setup-Modus „Im Körperbereich anzeigen“.</p>}
      </section>

      <section className="status-section">
        <div className="body-section-heading"><h2>Statuseffekte</h2><span>Gelten für den gesamten Helden</span></div>
        <Form className="status-form" onSubmit={addStatus}>
          <Form.Group><Form.Label>Status</Form.Label><Form.Control list="common-statuses" value={statusDraft.name} onChange={(event) => setStatusDraft({ ...statusDraft, name: event.target.value })} placeholder="z. B. Müde" /><datalist id="common-statuses">{commonStatuses.map((status) => <option key={status} value={status} />)}</datalist></Form.Group>
          <Form.Group><Form.Label>Stufe</Form.Label><Form.Control type="number" min={1} value={statusDraft.level} onChange={(event) => setStatusDraft({ ...statusDraft, level: Number(event.target.value) })} /></Form.Group>
          <Form.Group><Form.Label>Ursache</Form.Label><Form.Control value={statusDraft.cause} onChange={(event) => setStatusDraft({ ...statusDraft, cause: event.target.value })} placeholder="z. B. Gift" /></Form.Group>
          <Form.Group><Form.Label>Dauer</Form.Label><Form.Control value={statusDraft.duration} onChange={(event) => setStatusDraft({ ...statusDraft, duration: event.target.value })} placeholder="z. B. 3 Runden" /></Form.Group>
          <Form.Group><Form.Label>Notiz</Form.Label><Form.Control value={statusDraft.notes} onChange={(event) => setStatusDraft({ ...statusDraft, notes: event.target.value })} placeholder="optional" /></Form.Group>
          <Button type="submit" className="dsa-primary-button">Status hinzufügen</Button>
        </Form>
        {hero.body.statuses.length ? <div className="status-grid">{hero.body.statuses.map((status) => <article key={status.id} className={`status-card${status.source === "master" ? " master-status-card" : ""}`}><div><strong>{status.source === "master" && <b className="master-exclamation" title="Vom Meister gesetzt">!</b>}{status.name}</strong><span>Stufe {status.level}</span></div>{status.source === "master" && <small className="master-source">Vom Meister gesetzt</small>}<div className="status-meta"><span>{status.cause || "Keine Ursache angegeben"}</span><span>{status.duration || "Unbegrenzte Dauer"}</span></div><div className="status-actions"><button type="button" onClick={() => setStatusLevel(status.id, status.level - 1)}>−</button><button type="button" onClick={() => setStatusLevel(status.id, status.level + 1)}>+</button><button type="button" className="status-delete" onClick={() => removeStatus(status.id)}>Entfernen</button></div><input value={status.notes} onChange={(event) => patchStatus(status.id, { notes: event.target.value })} placeholder="Notiz" /></article>)}</div> : <p className="empty-status">Keine Statuseffekte aktiv.</p>}
      </section>

      <section className="body-history-section">
        <div className="body-section-heading"><h2>Körper-Verlauf</h2><span>Die letzten Änderungen</span></div>
        {hero.body.history.length ? <ol className="body-history-list">{[...hero.body.history].reverse().slice(0, 20).map((entry) => <li key={entry.id} className={entry.actor === "master" ? "master-entry" : ""}><time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString("de-DE")}</time><span>{entry.actor === "master" && <b>!</b>}{entry.message}</span></li>)}</ol> : <p className="empty-status">Noch keine Körperänderungen protokolliert.</p>}
        {setup && hero.body.history.length > 0 && <button type="button" className="clear-history" onClick={() => patchBody((body) => ({ ...body, history: [] }))}>Verlauf leeren</button>}
      </section>
    </section>
  );
}

function damageSeverity(damage: number, maximum: number) {
  if (damage <= 0) return "healthy";
  if (damage >= maximum) return "critical";
  if (damage / maximum >= 0.5) return "injured";
  return "hurt";
}

export function BodyFigure({ hero }: { hero: Hero }) {
  const severity = (id: BodyPartId) => {
    const part = hero.body.parts.find((candidate) => candidate.id === id)!;
    return damageSeverity(part.damage, part.maxDamage);
  };
  const equipped = (partId: BodyPartId) => {
    const slotsByPart: Record<BodyPartId, EquipmentSlotId[]> = {
      head: ["head", "neck"],
      torso: ["torso", "back", "belt"],
      leftArm: ["leftHand"],
      rightArm: ["rightHand"],
      leftLeg: ["legs"],
      rightLeg: ["legs"],
      leftFoot: ["feet"],
      rightFoot: ["feet"],
    };
    return slotsByPart[partId].some((slot) => Boolean(hero.body.equipped[slot]));
  };
  const zoneClass = (partId: BodyPartId) => `body-zone ${severity(partId)}${equipped(partId) ? " equipped-zone" : ""}`;
  return (
    <svg className="body-figure" viewBox="0 0 240 500" role="img" aria-label="Stilisierte menschliche Körperfigur mit markierten Verletzungen">
      <circle className={zoneClass("head")} cx="120" cy="47" r="34" />
      <path className={zoneClass("torso")} d="M82 91 Q120 73 158 91 L170 245 Q120 274 70 245 Z" />
      <path className={zoneClass("leftArm")} d="M75 101 Q54 105 45 135 L17 278 Q14 299 31 304 Q47 305 54 283 L87 146 Z" />
      <path className={zoneClass("rightArm")} d="M165 101 Q186 105 195 135 L223 278 Q226 299 209 304 Q193 305 186 283 L153 146 Z" />
      <path className={zoneClass("leftLeg")} d="M75 247 Q98 257 117 255 L108 432 Q88 441 69 430 L55 287 Z" />
      <path className={zoneClass("rightLeg")} d="M165 247 Q142 257 123 255 L132 432 Q152 441 171 430 L185 287 Z" />
      <path className={zoneClass("leftFoot")} d="M69 426 Q88 437 108 428 L110 473 Q106 492 77 490 Q55 486 62 468 Z" />
      <path className={zoneClass("rightFoot")} d="M171 426 Q152 437 132 428 L130 473 Q134 492 163 490 Q185 486 178 468 Z" />
      <path className="body-skeleton-line" d="M120 82 L120 255 M91 132 L149 132 M83 200 L157 200 M87 313 L108 313 M132 313 L153 313" />
    </svg>
  );
}
