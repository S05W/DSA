import { useEffect, useState, type PointerEvent } from "react";
import Button from "react-bootstrap/Button";
import { Link } from "react-router";
import MapStage from "../components/map/MapStage";
import Sidebar from "../components/layout/Sidebar";
import { createId } from "../utils/id";
import type { FogRect, GameMapSnapshot } from "../models/Map";
import { storage } from "../services/storage";

type MapTool = "reveal" | "move";
interface Point { x: number; y: number }

function pointFromEvent(event: PointerEvent<HTMLDivElement>): Point {
  const rectangle = event.currentTarget.getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (event.clientX - rectangle.left) / rectangle.width)), y: Math.max(0, Math.min(1, (event.clientY - rectangle.top) / rectangle.height)) };
}

function rectangleBetween(start: Point, end: Point, id = "preview"): FogRect {
  return { id, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

export default function MasterMapPage() {
  const [snapshot, setSnapshot] = useState<GameMapSnapshot | null>(null);
  const [tool, setTool] = useState<MapTool>("reveal");
  const [zoom, setZoom] = useState(1);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [preview, setPreview] = useState<FogRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void storage.getGameMap().then((result) => { if (active) setSnapshot(result); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Karte konnte nicht geladen werden."); });
    return () => { active = false; };
  }, []);

  async function uploadMap(file: File | undefined) {
    if (!file) return;
    if (file.type !== "image/png") { setError("Bitte wähle eine PNG-Karte aus."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Die Karte darf höchstens 20 MB groß sein."); return; }
    if (snapshot?.imageVersion && !window.confirm("Die bisherige Karte wirklich ersetzen? Die Nebelmaske bleibt zunächst bestehen.")) return;
    setBusy(true); setError("");
    try { setSnapshot(await storage.uploadGameMap(file)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Karte konnte nicht hochgeladen werden."); } finally { setBusy(false); }
  }

  function startReveal(event: PointerEvent<HTMLDivElement>) {
    if (tool !== "reveal") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setDragStart(point);
    setPreview(rectangleBetween(point, point));
  }

  function moveReveal(event: PointerEvent<HTMLDivElement>) {
    if (tool !== "reveal" || !dragStart) return;
    setPreview(rectangleBetween(dragStart, pointFromEvent(event)));
  }

  async function finishReveal(event: PointerEvent<HTMLDivElement>) {
    if (tool !== "reveal" || !dragStart || !snapshot) return;
    const rectangle = rectangleBetween(dragStart, pointFromEvent(event), createId());
    setDragStart(null); setPreview(null);
    if (rectangle.width < 0.002 || rectangle.height < 0.002) return;
    setBusy(true); setError("");
    try { setSnapshot(await storage.saveMapFog([...snapshot.revealed, rectangle])); } catch (reason) { setError(reason instanceof Error ? reason.message : "Bereich konnte nicht aufgedeckt werden."); } finally { setBusy(false); }
  }

  async function saveFog(revealed: FogRect[]) {
    if (!snapshot) return;
    setBusy(true); setError("");
    try { setSnapshot(await storage.saveMapFog(revealed)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Nebelmaske konnte nicht gespeichert werden."); } finally { setBusy(false); }
  }

  async function moveToken(heroId: string, x: number, y: number) {
    setBusy(true); setError("");
    try { setSnapshot(await storage.saveMapTokenPosition(heroId, x, y)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Token konnte nicht bewegt werden."); } finally { setBusy(false); }
  }

  return <div className="app-shell"><Sidebar /><main className="app-main master-map-page"><div className="map-page-heading"><div><span className="page-eyebrow">Spielleitung</span><h1>Karteneditor</h1><p>Decke Bereiche auf und positioniere die aktiven Helden für die gemeinsame Anzeige.</p></div><div><Link className="display-link" to="/karte/anzeige" target="_blank">Fernseheransicht öffnen</Link><Link className="back-link" to="/meister">Zur Meisterübersicht</Link></div></div>
    <section className="dsa-panel map-controls"><div className="map-upload"><label>{busy ? "Bitte warten …" : snapshot?.imageVersion ? "PNG-Karte ersetzen" : "PNG-Karte hochladen"}<input type="file" accept="image/png,.png" disabled={busy} onChange={(event) => { void uploadMap(event.target.files?.[0]); event.target.value = ""; }} /></label><small>Maximal 20 MB</small></div><div className="map-tool-switch"><button type="button" className={tool === "reveal" ? "active" : ""} onClick={() => setTool("reveal")}>Bereich aufdecken</button><button type="button" className={tool === "move" ? "active" : ""} onClick={() => setTool("move")}>Token bewegen</button></div><label className="map-zoom">Zoom <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><span>{Math.round(zoom * 100)} %</span></label><div className="fog-actions"><Button variant="outline-secondary" disabled={!snapshot?.revealed.length || busy} onClick={() => void saveFog(snapshot?.revealed.slice(0, -1) ?? [])}>Letzten Bereich zurücknehmen</Button><Button variant="outline-danger" disabled={!snapshot?.revealed.length || busy} onClick={() => { if (window.confirm("Wirklich wieder die gesamte Karte verbergen?")) void saveFog([]); }}>Alles verbergen</Button></div></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!snapshot ? <section className="dsa-panel empty-state">Kartenstand wird geladen …</section> : snapshot.imageVersion ? <><p className="map-tool-hint">{tool === "reveal" ? "Ziehe mit der Maus oder dem Finger ein Rechteck über den Bereich, den die Spieler sehen dürfen." : "Ziehe ein Heldentoken an seine neue Position. Nur Helden mit aktivierter Sitzung erscheinen."}</p><MapStage snapshot={snapshot} fogMode="master" zoom={zoom} preview={preview} onPointerDown={tool === "reveal" ? startReveal : undefined} onPointerMove={tool === "reveal" ? moveReveal : undefined} onPointerUp={tool === "reveal" ? (event) => { void finishReveal(event); } : undefined} onTokenDrop={tool === "move" ? (heroId, x, y) => { void moveToken(heroId, x, y); } : undefined} /></> : <section className="dsa-panel map-empty"><h2>Noch keine Karte hinterlegt</h2><p>Lade oben eine PNG-Datei hoch. Danach kannst du Bereiche aufdecken und Heldentokens verschieben.</p></section>}
  </main></div>;
}
