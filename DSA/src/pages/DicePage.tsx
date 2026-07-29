import { useRef, useState, type FormEvent } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";

interface RollResult {
  id: string;
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
  timestamp: Date;
}

const quickDice = [4, 6, 8, 10, 12, 20, 100];

function DicePage() {
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState(20);
  const [modifier, setModifier] = useState(0);
  const [history, setHistory] = useState<RollResult[]>([]);
  const resultId = useRef(0);

  function roll(diceCount: number, dieSides: number, rollModifier = 0) {
    const safeCount = Math.max(1, Math.min(100, Math.floor(diceCount)));
    const safeSides = Math.max(2, Math.min(10000, Math.floor(dieSides)));
    const rolls = Array.from({ length: safeCount }, () => Math.floor(Math.random() * safeSides) + 1);
    const total = rolls.reduce((sum, value) => sum + value, 0) + rollModifier;
    resultId.current += 1;
    const result: RollResult = { id: String(resultId.current), notation: `${safeCount}W${safeSides}${rollModifier > 0 ? `+${rollModifier}` : rollModifier < 0 ? rollModifier : ""}`, rolls, modifier: rollModifier, total, timestamp: new Date() };
    setHistory((current) => [result, ...current].slice(0, 30));
  }

  function rollCustom(event: FormEvent) {
    event.preventDefault();
    roll(count, sides, modifier);
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main dice-page">
        <Header eyebrow="Werkzeug" title="Würfel" subtitle="Schnelle Standardwürfe oder eine eigene Würfelkombination." />
        <section className="dsa-panel dice-quick-panel">
          <div className="panel-heading"><span>Schnellauswahl</span><small>Ein Würfel</small></div>
          <div className="dice-quick-grid">{quickDice.map((die) => <button type="button" key={die} onClick={() => roll(1, die)}><span>W{die}</span><small>1–{die}</small></button>)}</div>
        </section>

        <section className="dsa-panel dice-custom-panel">
          <div className="panel-heading"><span>Eigener Wurf</span><small>Benutzerdefiniert</small></div>
          <Form className="dice-custom-form" onSubmit={rollCustom}>
            <Form.Group><Form.Label>Anzahl</Form.Label><Form.Control type="number" min={1} max={100} value={count} onChange={(event) => setCount(Number(event.target.value))} /></Form.Group>
            <Form.Group><Form.Label>Seiten</Form.Label><Form.Control type="number" min={2} max={10000} value={sides} onChange={(event) => setSides(Number(event.target.value))} /></Form.Group>
            <Form.Group><Form.Label>Modifikator</Form.Label><Form.Control type="number" value={modifier} onChange={(event) => setModifier(Number(event.target.value))} /></Form.Group>
            <Button type="submit" className="dsa-primary-button">Würfeln</Button>
          </Form>
        </section>

        <section className="dsa-panel dice-history-panel">
          <div className="panel-heading"><span>Wurfergebnisse</span><small>Letzte 30 Würfe</small></div>
          {history.length ? <ol className="dice-history">{history.map((result) => <li key={result.id}><div><strong>{result.notation}</strong><time>{result.timestamp.toLocaleTimeString("de-DE")}</time></div><p>{result.rolls.join(" + ")}{result.modifier ? ` ${result.modifier > 0 ? "+" : "−"} ${Math.abs(result.modifier)}` : ""}</p><b>{result.total}</b></li>)}</ol> : <p className="empty-state">Noch wurde nicht gewürfelt.</p>}
        </section>
      </main>
    </div>
  );
}

export default DicePage;
