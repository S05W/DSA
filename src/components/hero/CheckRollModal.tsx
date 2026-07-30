import { useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import type { AttributeValue } from "../../models/Hero";

export interface CheckRequest {
  name: string;
  check: string;
  value: number;
  kind: "Talent" | "Zauber";
}

interface CheckRollModalProps {
  request: CheckRequest | null;
  attributes: AttributeValue[];
  onHide: () => void;
}

interface RollLine {
  code: string;
  attribute: number;
  target: number;
  roll: number;
  spent: number;
}

interface CheckResult {
  lines: RollLine[];
  skillValue: number;
  spent: number;
  remaining: number;
  quality: number;
  outcome: "success" | "failure" | "critical" | "botch";
}

const attributeCodes = ["MU", "KL", "IN", "CH", "FF", "GE", "KO", "KK"];

function qualityFor(points: number) {
  return Math.min(6, Math.max(1, Math.ceil(Math.max(1, points) / 3)));
}

export default function CheckRollModal({ request, attributes, onHide }: CheckRollModalProps) {
  const [modifier, setModifier] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const codes = request?.check.toUpperCase().match(/MU|KL|IN|CH|FF|GE|KO|KK/g)?.slice(0, 3) ?? [];
  const valid = codes.length === 3 && codes.every((code) => attributeCodes.includes(code) && attributes.some((attribute) => attribute.short === code));

  function close() {
    setResult(null);
    setModifier(0);
    onHide();
  }

  function rollCheck() {
    if (!request || !valid) return;
    const skillValue = Math.max(0, Number.isFinite(request.value) ? request.value : 0);
    const rolls = Array.from({ length: 3 }, () => Math.floor(Math.random() * 20) + 1);
    const lines = codes.map((code, index) => {
      const attribute = attributes.find((candidate) => candidate.short === code)?.value ?? 0;
      const target = Math.max(1, attribute + modifier);
      const roll = rolls[index];
      return { code, attribute, target, roll, spent: Math.max(0, roll - target) };
    });
    const spent = lines.reduce((sum, line) => sum + line.spent, 0);
    const normalRemaining = skillValue - spent;
    const ones = rolls.filter((roll) => roll === 1).length;
    const twenties = rolls.filter((roll) => roll === 20).length;
    const outcome = twenties >= 2 ? "botch" : ones >= 2 ? "critical" : normalRemaining >= 0 ? "success" : "failure";
    const remaining = outcome === "critical" ? Math.max(0, normalRemaining) : normalRemaining;
    setResult({ lines, skillValue, spent, remaining, quality: outcome === "success" || outcome === "critical" ? qualityFor(remaining) : 0, outcome });
  }

  const resultLabel = result?.outcome === "critical" ? "Kritischer Erfolg" : result?.outcome === "botch" ? "Patzer" : result?.outcome === "success" ? "Probe gelungen" : "Probe misslungen";

  return (
    <Modal show={Boolean(request)} onHide={close} centered size="lg">
      <Modal.Header closeButton><div><span className="detail-kicker">Automatische 3W20-Probe</span><Modal.Title>{request?.name}</Modal.Title></div></Modal.Header>
      <Modal.Body>
        {request && <>
          <div className="check-summary"><span>{request.kind}</span><strong>{request.check}</strong><span>FW {request.value}</span></div>
          <Form.Group className="check-modifier"><Form.Label>Modifikator</Form.Label><Form.Control type="number" min={-20} max={20} value={modifier} onChange={(event) => { setModifier(Math.max(-20, Math.min(20, Number(event.target.value)))); setResult(null); }} /><Form.Text>Erleichterung positiv, Erschwernis negativ. Der Wert verändert alle drei Eigenschaftswerte.</Form.Text></Form.Group>
          {!valid && <p className="check-invalid">Die Probe benötigt genau drei gültige Eigenschaften, zum Beispiel „KL / IN / CH“.</p>}
          {result && <section className={`check-result check-result-${result.outcome}`}>
            <div className="check-result-heading"><strong>{resultLabel}</strong>{result.quality > 0 && <span>QS {result.quality}</span>}</div>
            <div className="check-dice-lines">{result.lines.map((line, index) => <article key={`${line.code}-${index}`}><span>{line.code}</span><b>{line.roll}</b><small>Ziel {line.target}{line.target !== line.attribute ? ` (${line.attribute} ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)})` : ""}</small><em>{line.spent > 0 ? `${line.spent} FP verbraucht` : "bestanden"}</em></article>)}</div>
            <p>{result.outcome === "success" || result.outcome === "critical"
              ? `FW ${result.skillValue} − ${result.spent} verbraucht = ${result.remaining} Fertigkeitspunkte übrig.${result.remaining === 0 ? " Eine gelungene Probe mit 0 FP zählt als QS 1." : ""}`
              : result.outcome === "botch"
                ? "Mindestens zwei Würfel zeigen eine 20."
                : `FW ${result.skillValue} − ${result.spent} verbraucht: ${Math.abs(result.remaining)} Fertigkeitspunkte fehlen.`}</p>
          </section>}
        </>}
      </Modal.Body>
      <Modal.Footer><Button variant="outline-secondary" onClick={close}>Schließen</Button><Button className="dsa-primary-button" disabled={!valid} onClick={rollCheck}>3W20 würfeln</Button></Modal.Footer>
    </Modal>
  );
}
