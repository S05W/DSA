import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import { equipmentSlots } from "../../data/body";
import type { EquipmentItem, EquipmentItemType, EquipmentSlotId, SpellValue, WeaponKind } from "../../models/Hero";

interface SpellDetailModalProps {
  spell: SpellValue | null;
  setup: boolean;
  onHide: () => void;
  onChange: (patch: Partial<SpellValue>) => void;
  onDelete: () => void;
}

export function SpellDetailModal({ spell, setup, onHide, onChange, onDelete }: SpellDetailModalProps) {
  return (
    <Modal show={Boolean(spell)} onHide={onHide} centered size="lg">
      <Modal.Header closeButton><div><span className="detail-kicker">Zauberdetails</span><Modal.Title>{spell?.name || "Zauber"}</Modal.Title></div></Modal.Header>
      {spell && <Modal.Body><div className="detail-form-grid">
        <DetailField label="Name" value={spell.name} setup={setup} onChange={(value) => onChange({ name: value })} />
        <DetailField label="Fertigkeitswert" value={String(spell.value)} type="number" setup={setup} onChange={(value) => onChange({ value: Math.max(0, Number(value)) })} />
        <DetailField label="Probe" value={spell.check} setup={setup} onChange={(value) => onChange({ check: value })} placeholder="MU / KL / CH" />
        <DetailField label="Kosten" value={spell.cost} setup={setup} onChange={(value) => onChange({ cost: value })} placeholder="8 AsP" />
        <DetailField label="Reichweite" value={spell.range ?? ""} setup={setup} onChange={(value) => onChange({ range: value })} />
        <DetailField label="Zauberdauer" value={spell.castingTime ?? ""} setup={setup} onChange={(value) => onChange({ castingTime: value })} />
        <DetailField label="Wirkungsdauer" value={spell.duration ?? ""} setup={setup} onChange={(value) => onChange({ duration: value })} />
        <DetailField label="Wirkung" value={spell.effect ?? ""} setup={setup} onChange={(value) => onChange({ effect: value })} wide multiline />
        <DetailField label="Notizen" value={spell.notes ?? ""} setup={setup} onChange={(value) => onChange({ notes: value })} wide multiline />
      </div></Modal.Body>}
      <Modal.Footer>{setup && <Button variant="outline-danger" onClick={onDelete}>Zauber entfernen</Button>}<Button variant="secondary" onClick={onHide}>Schließen</Button></Modal.Footer>
    </Modal>
  );
}

interface EquipmentDetailModalProps {
  item: EquipmentItem | null;
  setup: boolean;
  equippedAt?: string;
  onHide: () => void;
  onChange: (patch: Partial<EquipmentItem>) => void;
  onDelete: () => void;
}

export function EquipmentDetailModal({ item, setup, equippedAt, onHide, onChange, onDelete }: EquipmentDetailModalProps) {
  function toggleSlot(slotId: EquipmentSlotId) {
    if (!item) return;
    const current = item.allowedSlots ?? [];
    onChange({ allowedSlots: current.includes(slotId) ? current.filter((id) => id !== slotId) : [...current, slotId] });
  }
  return (
    <Modal show={Boolean(item)} onHide={onHide} centered size="lg">
      <Modal.Header closeButton><div><span className="detail-kicker">Gegenstandsdetails</span><Modal.Title>{item?.name || "Ausrüstung"}</Modal.Title></div></Modal.Header>
      {item && <Modal.Body>
        {equippedAt && <p className="equipped-note">Ausgerüstet: {equippedAt}</p>}
        <div className="detail-form-grid">
          <DetailField label="Name" value={item.name} setup={setup} onChange={(value) => onChange({ name: value })} />
          <DetailField label="Anzahl" value={String(item.quantity)} type="number" setup={setup} onChange={(value) => onChange({ quantity: Math.max(1, Number(value)) })} />
          <Form.Group><Form.Label>Gegenstandsart</Form.Label><Form.Select value={item.itemType ?? "general"} disabled={!setup} onChange={(event) => onChange({ itemType: event.target.value as EquipmentItemType })}><option value="general">Allgemein</option><option value="weapon">Waffe</option><option value="armor">Rüstung</option><option value="shield">Schild</option></Form.Select></Form.Group>
          <DetailField label="Kategorie" value={item.category ?? ""} setup={setup} onChange={(value) => onChange({ category: value })} placeholder="Waffe, Rüstung, Werkzeug …" />
          <DetailField label="Gewicht" value={item.weight ?? ""} setup={setup} onChange={(value) => onChange({ weight: value })} />
          <DetailField label="Wert" value={item.value ?? ""} setup={setup} onChange={(value) => onChange({ value })} placeholder="z. B. 15 Silbertaler" />
          {item.itemType === "weapon" && <>
            <Form.Group><Form.Label>Einsatzart</Form.Label><Form.Select value={item.weaponKind ?? "melee"} disabled={!setup} onChange={(event) => onChange({ weaponKind: event.target.value as WeaponKind })}><option value="melee">Nahkampf</option><option value="ranged">Fernkampf</option></Form.Select></Form.Group>
            <DetailField label="Kampftechnik" value={item.combatTechnique ?? ""} setup={setup} onChange={(value) => onChange({ combatTechnique: value })} placeholder="z. B. Schwerter" />
            <DetailField label="Trefferpunkte" value={item.damage ?? ""} setup={setup} onChange={(value) => onChange({ damage: value })} placeholder="z. B. 1W6+4" />
            <DetailField label="Schadensschwelle" value={item.damageThreshold ?? ""} setup={setup} onChange={(value) => onChange({ damageThreshold: value })} placeholder="z. B. KK 14" />
            <DetailField label="AT-Modifikator" value={String(item.attackModifier ?? 0)} type="number" setup={setup} onChange={(value) => onChange({ attackModifier: Number(value) || 0 })} />
            <DetailField label="PA-Modifikator" value={String(item.parryModifier ?? 0)} type="number" setup={setup} onChange={(value) => onChange({ parryModifier: Number(value) || 0 })} />
            {item.weaponKind === "ranged" ? <>
              <DetailField label="Reichweiten" value={item.range ?? ""} setup={setup} onChange={(value) => onChange({ range: value })} placeholder="nah / mittel / weit" />
              <DetailField label="Ladezeit" value={item.reloadTime ?? ""} setup={setup} onChange={(value) => onChange({ reloadTime: value })} />
              <DetailField label="Munition" value={String(item.ammunition ?? 0)} type="number" setup={setup} onChange={(value) => onChange({ ammunition: Math.max(0, Number(value)) })} />
            </> : <DetailField label="Reichweite" value={item.reach ?? ""} setup={setup} onChange={(value) => onChange({ reach: value })} placeholder="kurz / mittel / lang" />}
          </>}
          {item.itemType === "armor" && <>
            <DetailField label="Rüstungsschutz" value={String(item.armor ?? 0)} type="number" setup={setup} onChange={(value) => onChange({ armor: Math.max(0, Number(value)) })} />
            <DetailField label="Belastung" value={String(item.encumbrance ?? 0)} type="number" setup={setup} onChange={(value) => onChange({ encumbrance: Math.max(0, Number(value)) })} />
            <DetailField label="Zusätzliche Abzüge" value={item.additionalPenalties ?? ""} setup={setup} onChange={(value) => onChange({ additionalPenalties: value })} />
          </>}
          {item.itemType === "shield" && <>
            <DetailField label="Kampftechnik" value={item.combatTechnique ?? ""} setup={setup} onChange={(value) => onChange({ combatTechnique: value })} placeholder="Schilde" />
            <DetailField label="AT-Modifikator" value={String(item.attackModifier ?? 0)} type="number" setup={setup} onChange={(value) => onChange({ attackModifier: Number(value) || 0 })} />
            <DetailField label="PA-Modifikator" value={String(item.parryModifier ?? 0)} type="number" setup={setup} onChange={(value) => onChange({ parryModifier: Number(value) || 0 })} />
          </>}
          <DetailField label="Beschreibung" value={item.description ?? ""} setup={setup} onChange={(value) => onChange({ description: value })} wide multiline />
          <DetailField label="Notizen" value={item.notes} setup={setup} onChange={(value) => onChange({ notes: value })} wide multiline />
          <div className="detail-wide body-visibility-setting">
            <Form.Check type="switch" id={`body-visible-${item.id}`} label="Im Körperbereich anzeigen und ausrüsten" checked={Boolean(item.showOnBody)} disabled={!setup} onChange={(event) => onChange({ showOnBody: event.target.checked })} />
            {item.showOnBody && <div className="allowed-slots"><span>Erlaubte Ausrüstungsplätze</span><div>{equipmentSlots.map((slot) => <button type="button" key={slot.id} disabled={!setup} className={(item.allowedSlots ?? []).includes(slot.id) ? "selected" : ""} onClick={() => toggleSlot(slot.id)}>{slot.label}</button>)}</div></div>}
          </div>
        </div>
      </Modal.Body>}
      <Modal.Footer>{setup && <Button variant="outline-danger" onClick={onDelete}>Gegenstand entfernen</Button>}<Button variant="secondary" onClick={onHide}>Schließen</Button></Modal.Footer>
    </Modal>
  );
}

interface DetailFieldProps {
  label: string;
  value: string;
  setup: boolean;
  onChange: (value: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  wide?: boolean;
  multiline?: boolean;
}

function DetailField({ label, value, setup, onChange, type = "text", placeholder, wide, multiline }: DetailFieldProps) {
  return <Form.Group className={wide ? "detail-wide" : ""}><Form.Label>{label}</Form.Label>{multiline
    ? <Form.Control as="textarea" rows={3} value={value} readOnly={!setup} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    : <Form.Control type={type} value={value} readOnly={!setup} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
  </Form.Group>;
}
