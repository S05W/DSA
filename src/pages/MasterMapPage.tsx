import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import Button from "react-bootstrap/Button";
import { Link } from "react-router";
import MapStage from "../components/map/MapStage";
import Sidebar from "../components/layout/Sidebar";
import { createId } from "../utils/id";
import type { FogMode, FogPoint, FogRect, FogShape, GameMapSnapshot, GameMapSummary, MapImageMetrics, MapMonster, MapPin, MapPinType, ResourceDisplay } from "../models/Map";
import { storage } from "../services/storage";

type MapTool = "select" | "revealRect" | "hideRect" | "revealBrush" | "hideBrush" | "pin";
interface Point { x: number; y: number }
type PinDraft = Omit<MapPin, "id"> & { id?: string };
type MonsterDraft = Omit<MapMonster, "id" | "kind" | "tokenVersion"> & { id?: string };

const pinTypes: { value: MapPinType; label: string }[] = [
  { value: "shop", label: "Shop" }, { value: "tavern", label: "Taverne" }, { value: "place", label: "Ort" },
  { value: "npc", label: "NPC" }, { value: "quest", label: "Quest" }, { value: "treasure", label: "Schatz" },
  { value: "door", label: "Tür/Übergang" }, { value: "trap", label: "Falle" },
];

function pointFromEvent(event: PointerEvent<HTMLDivElement>): Point {
  const rectangle = event.currentTarget.getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (event.clientX - rectangle.left) / rectangle.width)), y: Math.max(0, Math.min(1, (event.clientY - rectangle.top) / rectangle.height)) };
}

function rectangleBetween(start: Point, end: Point, mode: FogMode, id = "preview"): FogRect {
  return { id, shape: "rect", mode, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

function brushPointsBetween(previous: FogPoint, next: FogPoint, radiusX: number, radiusY: number) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(next.x - previous.x) / Math.max(radiusX * 0.55, 0.0005), Math.abs(next.y - previous.y) / Math.max(radiusY * 0.55, 0.0005))));
  return Array.from({ length: Math.min(steps, 80) }, (_, index) => { const amount = (index + 1) / steps; return { x: previous.x + (next.x - previous.x) * amount, y: previous.y + (next.y - previous.y) * amount }; });
}

function emptyMonster(): MonsterDraft {
  return { name: "", initials: "?", lifePoints: 10, maxLifePoints: 10, astralPoints: 0, maxAstralPoints: 0, visible: true, notes: "", x: 0.5, y: 0.5 };
}

export default function MasterMapPage() {
  const [maps, setMaps] = useState<GameMapSummary[]>([]);
  const [snapshot, setSnapshot] = useState<GameMapSnapshot | null>(null);
  const [tool, setTool] = useState<MapTool>("select");
  const [zoom, setZoom] = useState(0.75);
  const [autoFit, setAutoFit] = useState(true);
  const [brushSize, setBrushSize] = useState(90);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [preview, setPreview] = useState<FogShape | null>(null);
  const previewRef = useRef<FogShape | null>(null);
  const [undoStack, setUndoStack] = useState<FogShape[][]>([]);
  const [redoStack, setRedoStack] = useState<FogShape[][]>([]);
  const [pinDraft, setPinDraft] = useState<PinDraft | null>(null);
  const [monsterDraft, setMonsterDraft] = useState<MonsterDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadMap = useCallback(async (mapId: string) => {
    const result = await storage.getMasterMap(mapId);
    setSnapshot(result); setUndoStack([]); setRedoStack([]); setPreview(null); setPinDraft(null); setMonsterDraft(null); setAutoFit(true);
  }, []);

  const loadInitial = useCallback(async () => {
    const available = await storage.getMasterMaps();
    setMaps(available);
    const selected = available.find((map) => map.isActive) ?? available[0];
    if (selected) await loadMap(selected.id);
  }, [loadMap]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void loadInitial().catch((reason) => setError(reason instanceof Error ? reason.message : "Karten konnten nicht geladen werden.")); }, 0);
    return () => window.clearTimeout(initial);
  }, [loadInitial]);

  async function refreshMaps() { setMaps(await storage.getMasterMaps()); }
  function showError(reason: unknown, fallback: string) { setError(reason instanceof Error ? reason.message : fallback); }

  async function uploadMap(file: File | undefined) {
    if (!file || !snapshot) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Bitte wähle eine PNG-, JPG- oder WebP-Karte aus."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Die Karte darf höchstens 20 MB groß sein."); return; }
    if (snapshot.imageVersion && !window.confirm("Das bisherige Kartenbild wirklich ersetzen? Nebel, Pins und Tokenpositionen bleiben erhalten.")) return;
    setBusy(true); setError("");
    try { setSnapshot(await storage.uploadGameMap(snapshot.id, file)); await refreshMaps(); setAutoFit(true); } catch (reason) { showError(reason, "Karte konnte nicht hochgeladen werden."); } finally { setBusy(false); }
  }

  async function createMap() {
    const name = window.prompt("Wie soll die neue Karte heißen?", `Karte ${maps.length + 1}`)?.trim();
    if (!name) return;
    setBusy(true); setError("");
    try { const created = await storage.createGameMap(name); await refreshMaps(); setSnapshot(created); setUndoStack([]); setRedoStack([]); setAutoFit(true); } catch (reason) { showError(reason, "Karte konnte nicht erstellt werden."); } finally { setBusy(false); }
  }

  async function renameMap() {
    if (!snapshot) return;
    const name = window.prompt("Neuer Kartenname", snapshot.name)?.trim();
    if (!name || name === snapshot.name) return;
    setBusy(true);
    try { setSnapshot(await storage.updateGameMap(snapshot.id, { name })); await refreshMaps(); } catch (reason) { showError(reason, "Karte konnte nicht umbenannt werden."); } finally { setBusy(false); }
  }

  async function activateMap() {
    if (!snapshot || snapshot.isActive) return;
    setBusy(true);
    try { setSnapshot(await storage.activateGameMap(snapshot.id)); await refreshMaps(); } catch (reason) { showError(reason, "Karte konnte nicht aktiviert werden."); } finally { setBusy(false); }
  }

  async function deleteMap() {
    if (!snapshot || !window.confirm(`Karte „${snapshot.name}“ samt Nebel, Pins und Monstern löschen?`)) return;
    setBusy(true);
    try { await storage.deleteGameMap(snapshot.id); await loadInitial(); } catch (reason) { showError(reason, "Karte konnte nicht gelöscht werden."); } finally { setBusy(false); }
  }

  async function setResourceDisplay(resourceDisplay: ResourceDisplay) {
    if (!snapshot) return;
    try { setSnapshot(await storage.updateGameMap(snapshot.id, { resourceDisplay })); } catch (reason) { showError(reason, "Anzeige konnte nicht gespeichert werden."); }
  }

  function drawingMode(): FogMode { return tool === "hideRect" || tool === "hideBrush" ? "hide" : "reveal"; }
  function isBrush() { return tool === "revealBrush" || tool === "hideBrush"; }
  function isRectangle() { return tool === "revealRect" || tool === "hideRect"; }

  function startDrawing(event: PointerEvent<HTMLDivElement>) {
    if (!isBrush() && !isRectangle()) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event); const mode = drawingMode();
    setDragStart(point);
    if (isRectangle()) previewRef.current = rectangleBetween(point, point, mode);
    else {
      const bounds = event.currentTarget.getBoundingClientRect();
      previewRef.current = { id: "preview", shape: "brush", mode, radiusX: (brushSize / 2) / bounds.width, radiusY: (brushSize / 2) / bounds.height, points: [point] };
    }
    setPreview(previewRef.current);
  }

  function moveDrawing(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart || (!isBrush() && !isRectangle())) return;
    const point = pointFromEvent(event);
    if (isRectangle()) previewRef.current = rectangleBetween(dragStart, point, drawingMode());
    else if (previewRef.current?.shape === "brush") {
      const current = previewRef.current; const previous = current.points.at(-1) ?? point;
      previewRef.current = { ...current, points: [...current.points, ...brushPointsBetween(previous, point, current.radiusX, current.radiusY)].slice(0, 1200) };
    }
    setPreview(previewRef.current);
  }

  async function finishDrawing(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart || !snapshot || !previewRef.current) return;
    moveDrawing(event);
    const shape = { ...previewRef.current, id: createId() } as FogShape;
    setDragStart(null); setPreview(null); previewRef.current = null;
    if (shape.shape === "rect" && (shape.width < 0.002 || shape.height < 0.002)) return;
    await commitFog([...snapshot.fog, shape], true);
  }

  async function commitFog(fog: FogShape[], remember: boolean) {
    if (!snapshot) return;
    const previous = snapshot.fog;
    setBusy(true); setError("");
    try {
      setSnapshot(await storage.saveMapFog(snapshot.id, fog));
      if (remember) { setUndoStack((stack) => [...stack, previous].slice(-40)); setRedoStack([]); }
    } catch (reason) { showError(reason, "Nebelmaske konnte nicht gespeichert werden."); } finally { setBusy(false); }
  }

  async function undoFog() {
    if (!snapshot || !undoStack.length) return;
    const target = undoStack.at(-1) ?? []; const current = snapshot.fog;
    setUndoStack((stack) => stack.slice(0, -1)); setRedoStack((stack) => [...stack, current].slice(-40));
    await commitFog(target, false);
  }

  async function redoFog() {
    if (!snapshot || !redoStack.length) return;
    const target = redoStack.at(-1) ?? []; const current = snapshot.fog;
    setRedoStack((stack) => stack.slice(0, -1)); setUndoStack((stack) => [...stack, current].slice(-40));
    await commitFog(target, false);
  }

  async function moveEntity(kind: "hero" | "monster", entityId: string, x: number, y: number) {
    if (!snapshot) return;
    setBusy(true);
    try { setSnapshot(await storage.saveMapEntityPosition(snapshot.id, kind, entityId, x, y)); } catch (reason) { showError(reason, "Token konnte nicht bewegt werden."); } finally { setBusy(false); }
  }

  function beginPin(x: number, y: number) { setPinDraft({ type: "shop", name: "", description: "", visibility: "public", x, y }); }
  async function savePin() {
    if (!snapshot || !pinDraft?.name.trim()) { setError("Der Pin benötigt einen Namen."); return; }
    setBusy(true);
    try { setSnapshot(pinDraft.id ? await storage.updateMapPin(snapshot.id, pinDraft as MapPin) : await storage.createMapPin(snapshot.id, pinDraft)); setPinDraft(null); setTool("select"); } catch (reason) { showError(reason, "Pin konnte nicht gespeichert werden."); } finally { setBusy(false); }
  }
  async function deletePin() {
    if (!snapshot || !pinDraft?.id) return;
    setBusy(true);
    try { setSnapshot(await storage.deleteMapPin(snapshot.id, pinDraft.id)); setPinDraft(null); } catch (reason) { showError(reason, "Pin konnte nicht gelöscht werden."); } finally { setBusy(false); }
  }

  async function saveMonster() {
    if (!snapshot || !monsterDraft?.name.trim()) { setError("Das Monster benötigt einen Namen."); return; }
    setBusy(true);
    try { setSnapshot(monsterDraft.id ? await storage.updateMapMonster(snapshot.id, { ...monsterDraft, id: monsterDraft.id, kind: "monster", tokenVersion: snapshot.monsters.find((monster) => monster.id === monsterDraft.id)?.tokenVersion ?? 0 }) : await storage.createMapMonster(snapshot.id, monsterDraft)); setMonsterDraft(null); } catch (reason) { showError(reason, "Monster konnte nicht gespeichert werden."); } finally { setBusy(false); }
  }
  async function deleteMonster() {
    if (!snapshot || !monsterDraft?.id || !window.confirm(`Monster „${monsterDraft.name}“ löschen?`)) return;
    setBusy(true);
    try { setSnapshot(await storage.deleteMapMonster(snapshot.id, monsterDraft.id)); setMonsterDraft(null); } catch (reason) { showError(reason, "Monster konnte nicht gelöscht werden."); } finally { setBusy(false); }
  }
  async function uploadMonsterToken(file: File | undefined) {
    if (!file || !monsterDraft?.id) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) { setError("Das Token muss PNG, JPG oder WebP und höchstens 2 MB groß sein."); return; }
    setBusy(true);
    try { setSnapshot(await storage.uploadMonsterToken(monsterDraft.id, file)); } catch (reason) { showError(reason, "Monstertoken konnte nicht hochgeladen werden."); } finally { setBusy(false); }
  }

  function handleMetrics(metrics: MapImageMetrics) {
    if (!autoFit) return;
    const heightAtFullWidth = metrics.viewportWidth * (metrics.naturalHeight / metrics.naturalWidth);
    const fitted = Math.max(0.1, Math.min(1, (metrics.viewportHeight - 12) / Math.max(heightAtFullWidth, 1)));
    setZoom(Number(fitted.toFixed(2)));
  }

  const drawing = isBrush() || isRectangle();
  return <div className="app-shell"><Sidebar /><main className="app-main master-map-page"><div className="map-page-heading"><div><span className="page-eyebrow">Spielleitung</span><h1>Karteneditor</h1><p>Verwalte Karten, Sichtbereiche, Orte, Helden und Gegner.</p></div><div><Link className="display-link" to="/karte/anzeige" target="_blank">Fernseheransicht öffnen</Link><Link className="back-link" to="/meister">Zur Meisterübersicht</Link></div></div>
    <section className="dsa-panel map-manager"><div className="map-tabs">{maps.map((map) => <button key={map.id} type="button" className={snapshot?.id === map.id ? "selected" : ""} onClick={() => void loadMap(map.id)}><span>{map.name}</span>{map.isActive && <b>AKTIV</b>}</button>)}<button type="button" className="map-add" onClick={() => void createMap()}>+ Neue Karte</button></div>{snapshot && <div className="map-manager-actions"><button type="button" onClick={() => void renameMap()}>Umbenennen</button><button type="button" disabled={snapshot.isActive} onClick={() => void activateMap()}>{snapshot.isActive ? "Für Spieler aktiv" : "Für Spieler aktivieren"}</button><button type="button" className="danger" disabled={maps.length <= 1} onClick={() => void deleteMap()}>Karte löschen</button></div>}</section>
    {snapshot && <section className="dsa-panel map-controls"><div className="map-upload"><label>{busy ? "Bitte warten …" : snapshot.imageVersion ? "Bild ersetzen" : "Kartenbild hochladen"}<input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" disabled={busy} onChange={(event) => { void uploadMap(event.target.files?.[0]); event.target.value = ""; }} /></label><small>PNG, JPG oder WebP · max. 20 MB</small></div><div className="map-tool-switch map-tool-grid"><button type="button" className={tool === "select" ? "active" : ""} onClick={() => setTool("select")}>Auswahl</button><button type="button" className={tool === "revealBrush" ? "active" : ""} onClick={() => setTool("revealBrush")}>Pinsel +</button><button type="button" className={tool === "hideBrush" ? "active danger-active" : ""} onClick={() => setTool("hideBrush")}>Pinsel −</button><button type="button" className={tool === "revealRect" ? "active" : ""} onClick={() => setTool("revealRect")}>Rechteck +</button><button type="button" className={tool === "hideRect" ? "active danger-active" : ""} onClick={() => setTool("hideRect")}>Rechteck −</button><button type="button" className={tool === "pin" ? "active" : ""} onClick={() => setTool("pin")}>Pin setzen</button></div><div className="map-sliders"><label className="map-zoom">Zoom <input type="range" min={0.1} max={3} step={0.05} value={zoom} onChange={(event) => { setAutoFit(false); setZoom(Number(event.target.value)); }} /><span>{Math.round(zoom * 100)} %</span></label><button type="button" onClick={() => setAutoFit(true)}>An Bildschirm anpassen</button>{isBrush() && <label className="map-zoom">Pinsel <input type="range" min={20} max={300} step={10} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /><span>{brushSize}px</span></label>}</div><label className="resource-display">Spieler sehen<select value={snapshot.resourceDisplay} onChange={(event) => void setResourceDisplay(event.target.value as ResourceDisplay)}><option value="numbers">LeP/AsP mit Zahlen</option><option value="bars">Nur Balken</option><option value="hidden">Keine Werte</option></select></label><div className="fog-actions"><Button variant="outline-secondary" disabled={!undoStack.length || busy} onClick={() => void undoFog()}>↶ Rückgängig</Button><Button variant="outline-secondary" disabled={!redoStack.length || busy} onClick={() => void redoFog()}>↷ Wiederholen</Button><Button variant="outline-success" disabled={busy} onClick={() => void commitFog([{ id: createId(), shape: "rect", mode: "reveal", x: 0, y: 0, width: 1, height: 1 }], true)}>Alles aufdecken</Button><Button variant="outline-danger" disabled={!snapshot.fog.length || busy} onClick={() => { if (window.confirm("Wirklich wieder die gesamte Karte verbergen?")) void commitFog([], true); }}>Alles verbergen</Button></div></section>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {snapshot && <div className="map-workspace"><aside className="dsa-panel map-object-panel"><section><div className="panel-heading"><span>Pins</span><button type="button" onClick={() => setTool("pin")}>+ Pin</button></div><p className="map-panel-help">Wähle „Pin setzen“ und klicke auf die Karte.</p>{snapshot.pins.map((pin) => <button type="button" className="map-object-row" key={pin.id} onClick={() => setPinDraft(pin)}><span>{pinTypes.find((type) => type.value === pin.type)?.label}</span><strong>{pin.name}</strong><small>{pin.visibility === "public" ? "Sichtbar" : "Geheim"}</small></button>)}</section><section><div className="panel-heading"><span>Monster</span><button type="button" onClick={() => setMonsterDraft(emptyMonster())}>+ Monster</button></div>{snapshot.monsters.map((monster) => <button type="button" className="map-object-row" key={monster.id} onClick={() => setMonsterDraft(monster)}><span>{monster.visible ? "Sichtbar" : "Geheim"}</span><strong>{monster.name}</strong><small>LeP {monster.lifePoints}/{monster.maxLifePoints}</small></button>)}</section></aside><div className="map-canvas-column">{snapshot.imageVersion ? <><p className="map-tool-hint">{tool === "select" ? "Ziehe Helden und Monster an ihre Position. Pins und Monster lassen sich anklicken." : tool === "pin" ? "Klicke auf die gewünschte Stelle, um dort einen Pin anzulegen." : `${tool.includes("hide") ? "Verberge" : "Enthülle"} Bereiche mit ${isBrush() ? "dem runden Pinsel" : "einem Rechteck"}.`}</p><MapStage snapshot={snapshot} fogMode="master" zoom={zoom} preview={preview} onPointerDown={drawing ? startDrawing : undefined} onPointerMove={drawing ? moveDrawing : undefined} onPointerUp={drawing ? (event) => { void finishDrawing(event); } : undefined} onEntityDrop={tool === "select" ? (kind, id, x, y) => { void moveEntity(kind, id, x, y); } : undefined} onMapPoint={tool === "pin" ? beginPin : undefined} onPinSelect={(pin) => setPinDraft(pin)} onMonsterSelect={(monster) => setMonsterDraft(monster)} onMetrics={handleMetrics} /></> : <section className="dsa-panel map-empty"><h2>Noch kein Kartenbild hinterlegt</h2><p>Lade eine PNG-, JPG- oder WebP-Datei hoch. Danach kannst du Nebel, Pins und Tokens bearbeiten.</p></section>}</div></div>}
    {pinDraft && <div className="map-editor-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setPinDraft(null); }}><form className="dsa-panel map-editor-dialog" onSubmit={(event) => { event.preventDefault(); void savePin(); }}><div className="panel-heading"><span>{pinDraft.id ? "Pin bearbeiten" : "Neuen Pin anlegen"}</span><button type="button" onClick={() => setPinDraft(null)}>×</button></div><label>Name<input autoFocus value={pinDraft.name} onChange={(event) => setPinDraft({ ...pinDraft, name: event.target.value })} /></label><label>Art<select value={pinDraft.type} onChange={(event) => setPinDraft({ ...pinDraft, type: event.target.value as MapPinType })}>{pinTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label>Beschreibung<textarea rows={4} value={pinDraft.description} onChange={(event) => setPinDraft({ ...pinDraft, description: event.target.value })} /></label><label>Sichtbarkeit<select value={pinDraft.visibility} onChange={(event) => setPinDraft({ ...pinDraft, visibility: event.target.value as "public" | "master" })}><option value="public">Für Spieler sichtbar</option><option value="master">Nur für den Meister</option></select></label><div className="dialog-actions">{pinDraft.id && <Button variant="outline-danger" type="button" onClick={() => void deletePin()}>Löschen</Button>}<Button variant="success" type="submit">Speichern</Button></div></form></div>}
    {monsterDraft && <div className="map-editor-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setMonsterDraft(null); }}><form className="dsa-panel map-editor-dialog monster-dialog" onSubmit={(event) => { event.preventDefault(); void saveMonster(); }}><div className="panel-heading"><span>{monsterDraft.id ? "Monster bearbeiten" : "Monster einsetzen"}</span><button type="button" onClick={() => setMonsterDraft(null)}>×</button></div><label>Name<input autoFocus value={monsterDraft.name} onChange={(event) => setMonsterDraft({ ...monsterDraft, name: event.target.value })} /></label><div className="monster-resource-fields"><label>LeP aktuell<input type="number" min={0} value={monsterDraft.lifePoints} onChange={(event) => setMonsterDraft({ ...monsterDraft, lifePoints: Number(event.target.value) })} /></label><label>LeP maximal<input type="number" min={1} value={monsterDraft.maxLifePoints} onChange={(event) => setMonsterDraft({ ...monsterDraft, maxLifePoints: Number(event.target.value) })} /></label><label>AsP aktuell<input type="number" min={0} value={monsterDraft.astralPoints} onChange={(event) => setMonsterDraft({ ...monsterDraft, astralPoints: Number(event.target.value) })} /></label><label>AsP maximal<input type="number" min={0} value={monsterDraft.maxAstralPoints} onChange={(event) => setMonsterDraft({ ...monsterDraft, maxAstralPoints: Number(event.target.value) })} /></label></div><label>Notizen<textarea rows={3} value={monsterDraft.notes} onChange={(event) => setMonsterDraft({ ...monsterDraft, notes: event.target.value })} /></label><label className="map-checkbox"><input type="checkbox" checked={monsterDraft.visible} onChange={(event) => setMonsterDraft({ ...monsterDraft, visible: event.target.checked })} />Für Spieler sichtbar</label>{monsterDraft.id && <label className="monster-token-upload">Tokenbild hochladen<input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={(event) => { void uploadMonsterToken(event.target.files?.[0]); event.target.value = ""; }} /></label>}<div className="dialog-actions">{monsterDraft.id && <Button variant="outline-danger" type="button" onClick={() => void deleteMonster()}>Löschen</Button>}<Button variant="success" type="submit">Speichern</Button></div></form></div>}
  </main></div>;
}
