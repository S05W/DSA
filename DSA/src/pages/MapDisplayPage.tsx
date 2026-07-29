import { useCallback, useEffect, useRef, useState } from "react";
import MapStage from "../components/map/MapStage";
import type { GameMapSnapshot } from "../models/Map";
import { storage } from "../services/storage";

export default function MapDisplayPage() {
  const [snapshot, setSnapshot] = useState<GameMapSnapshot | null>(null);
  const [error, setError] = useState("");
  const revision = useRef("");
  const loading = useRef(false);
  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const result = revision.current ? await storage.pollGameMap(revision.current) : await storage.getGameMap();
      if (result) {
        revision.current = result.updatedAt;
        setSnapshot(result);
      }
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Karte konnte nicht geladen werden.");
    } finally {
      loading.current = false;
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const interval = window.setInterval(() => { void load(); }, 2000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [load]);
  return <main className="map-display-page"><div className="display-toolbar"><span>{snapshot?.name ?? "Gemeinsame Kartenansicht"}</span><button type="button" onClick={() => void document.documentElement.requestFullscreen()}>Vollbild</button></div>{error ? <p>{error}</p> : !snapshot ? <p>Karte wird geladen …</p> : !snapshot.imageVersion ? <p>Der Meister hat für „{snapshot.name}“ noch kein Kartenbild hochgeladen.</p> : <MapStage snapshot={snapshot} fogMode="display" />}</main>;
}
