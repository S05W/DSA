import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import type { EquipmentItem, SpellValue } from "../../models/Hero";

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
  return (
    <Modal show={Boolean(item)} onHide={onHide} centered size="lg">
      <Modal.Header closeButton><div><span className="detail-kicker">Gegenstandsdetails</span><Modal.Title>{item?.name || "Ausrüstung"}</Modal.Title></div></Modal.Header>
      {item && <Modal.Body>
        {equippedAt && <p className="equipped-note">Ausgerüstet: {equippedAt}</p>}
        <div className="detail-form-grid">
          <DetailField label="Name" value={item.name} setup={setup} onChange={(value) => onChange({ name: value })} />
          <DetailField label="Anzahl" value={String(item.quantity)} type="number" setup={setup} onChange={(value) => onChange({ quantity: Math.max(1, Number(value)) })} />
          <DetailField label="Kategorie" value={item.category ?? ""} setup={setup} onChange={(value) => onChange({ category: value })} placeholder="Waffe, Rüstung, Werkzeug …" />
          <DetailField label="Gewicht" value={item.weight ?? ""} setup={setup} onChange={(value) => onChange({ weight: value })} />
          <DetailField label="Rüstungsschutz" value={String(item.armor ?? 0)} type="number" setup={setup} onChange={(value) => onChange({ armor: Math.max(0, Number(value)) })} />
          <DetailField label="Wert" value={item.value ?? ""} setup={setup} onChange={(value) => onChange({ value })} placeholder="z. B. 15 Silbertaler" />
          <DetailField label="Beschreibung" value={item.description ?? ""} setup={setup} onChange={(value) => onChange({ description: value })} wide multiline />
          <DetailField label="Notizen" value={item.notes} setup={setup} onChange={(value) => onChange({ notes: value })} wide multiline />
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
