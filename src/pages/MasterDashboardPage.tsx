import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import { normalizeHero } from "../data/body";
import type { MasterHeroRecord } from "../models/User";
import { storage } from "../services/storage";

export default function MasterDashboardPage() {
  const [records, setRecords] = useState<MasterHeroRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHeroes = useCallback(async () => {
    try {
      const result = await storage.getActiveMasterHeroes();
      setRecords(result.map((record) => ({ ...record, hero: normalizeHero(record.hero) })));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Die aktiven Helden konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void loadHeroes(); }, 0);
    const interval = window.setInterval(() => { void loadHeroes(); }, 5000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [loadHeroes]);

  return <div className="app-shell"><Sidebar /><main className="app-main master-dashboard"><Header eyebrow="Spielleitung" title="Meisterübersicht" subtitle="Alle Helden, die ihre Teilnahme an der aktuellen Sitzung aktiviert haben." />
    <section className="master-session-bar"><div><span className="live-indicator" />Aktuelle Sitzung</div><strong>{records.length} {records.length === 1 ? "aktiver Held" : "aktive Helden"}</strong><button type="button" onClick={() => void loadHeroes()}>Jetzt aktualisieren</button></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <section className="dsa-panel empty-state">Aktive Helden werden geladen …</section> : records.length ? <section className="master-hero-grid" aria-label="Aktive Helden">{records.map(({ hero, username, updatedAt }) => <Link key={hero.id} to={`/meister/helden/${hero.id}`} className={`master-hero-card master-hero-${hero.accent}`}>
      <div className="master-card-heading"><div className="master-portrait">{hero.initials}</div><div><span>Spieler: {username}</span><h2>{hero.name}</h2><p>{hero.profession}</p></div><b>Aktiv</b></div>
      <div className="master-resource-row"><article><span>LeP</span><strong>{hero.lifePoints}</strong><small>/ {hero.maxLifePoints}</small></article><article><span>AsP</span><strong>{hero.astralPoints}</strong><small>/ {hero.maxAstralPoints}</small></article><article><span>Status</span><strong>{hero.body.statuses.length}</strong><small>Effekte</small></article></div>
      <footer><span>Zuletzt aktualisiert: {new Date(updatedAt).toLocaleTimeString("de-DE")}</span><b>Heldenansicht öffnen →</b></footer>
    </Link>)}</section> : <section className="dsa-panel master-empty"><span className="live-indicator inactive" /><h2>Gerade spielt noch kein Held</h2><p>Ein Spieler erscheint hier, sobald er in seinem Heldenbogen „In der Sitzung“ aktiviert.</p></section>}
    <Link to="/meister/karte" className="dsa-panel map-roadmap"><div><span>Kartenansicht</span><small>PNG, Nebel und Heldentokens</small></div><p>Öffne den Karteneditor, decke erkundete Bereiche auf und positioniere die aktiven Helden.</p><b>Karteneditor öffnen →</b></Link>
  </main></div>;
}
