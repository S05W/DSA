import { useCallback, useEffect, useState } from "react";
import MapStage from "../components/map/MapStage";
import type { GameMapSnapshot } from "../models/Map";
import { storage } from "../services/storage";

export default function MapDisplayPage() {
  const [snapshot, setSnapshot] = useState<GameMapSnapshot | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setSnapshot(await storage.getGameMap()); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Karte konnte nicht geladen werden."); }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const interval = window.setInterval(() => { void load(); }, 2000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [load]);
  return <main className="map-display-page"><div className="display-toolbar"><span>{snapshot?.name ?? "Gemeinsame Kartenansicht"}</span><button type="button" onClick={() => void document.documentElement.requestFullscreen()}>Vollbild</button></div>{error ? <p>{error}</p> : !snapshot ? <p>Karte wird geladen …</p> : !snapshot.imageVersion ? <p>Der Meister hat für „{snapshot.name}“ noch kein Kartenbild hochgeladen.</p> : <MapStage snapshot={snapshot} fogMode="display" />}</main>;
}
