import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import type { ServerStatus } from "../models/ServerStatus";
import { storage } from "../services/storage";

const byteFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${byteFormatter.format(bytes / (1024 ** unit))} ${units[unit]}`;
}

function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days} T` : "", `${hours} Std`, `${minutes} Min`].filter(Boolean).join(" ");
}

function Meter({ value, warning = 80, danger = 92 }: { value: number; warning?: number; danger?: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const level = safeValue >= danger ? "danger" : safeValue >= warning ? "warning" : "healthy";
  return <div className={`server-meter ${level}`} aria-label={`${safeValue.toFixed(1)} Prozent`}>
    <span style={{ width: `${safeValue}%` }} />
  </div>;
}

export default function ServerStatusPage() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [error, setError] = useState("");
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      setStatus(await storage.getServerStatus());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Der Serverstatus konnte nicht geladen werden.");
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const interval = window.setInterval(() => { void load(); }, 5000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [load]);

  return <div className="app-shell">
    <Sidebar />
    <main className="app-main server-status-page">
      <header className="map-page-heading">
        <div>
          <span className="page-eyebrow">Spielleitung</span>
          <h1>Raspberry-Pi-Status</h1>
          <p>Leichtgewichtige Live-Übersicht über Auslastung, Temperatur und Speicher.</p>
        </div>
        {status && <div className="server-live-state"><span className="live-indicator" />Aktualisiert {new Date(status.sampledAt).toLocaleTimeString("de-DE")}</div>}
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!status ? <section className="dsa-panel server-loading">Serverwerte werden geladen …</section> : <>
        <section className="server-summary-grid">
          <article className="dsa-panel server-metric-card">
            <div><span>CPU</span><strong>{status.cpu.usagePercent.toFixed(1)} %</strong></div>
            <Meter value={status.cpu.usagePercent} />
            <small>{status.cpu.coreCount} Kerne · Load {status.cpu.load1.toFixed(2)} / {status.cpu.load5.toFixed(2)} / {status.cpu.load15.toFixed(2)}</small>
          </article>
          <article className="dsa-panel server-metric-card">
            <div><span>Arbeitsspeicher</span><strong>{status.memory.usagePercent.toFixed(1)} %</strong></div>
            <Meter value={status.memory.usagePercent} />
            <small>{formatBytes(status.memory.usedBytes)} von {formatBytes(status.memory.totalBytes)}</small>
          </article>
          <article className="dsa-panel server-metric-card">
            <div><span>Datenträger</span><strong>{status.storage.usagePercent.toFixed(1)} %</strong></div>
            <Meter value={status.storage.usagePercent} warning={75} danger={90} />
            <small>{formatBytes(status.storage.usedBytes)} von {formatBytes(status.storage.totalBytes)}</small>
          </article>
          <article className={`dsa-panel server-metric-card${status.temperatureC !== null && status.temperatureC >= 75 ? " hot" : ""}`}>
            <div><span>Temperatur</span><strong>{status.temperatureC === null ? "–" : `${status.temperatureC.toFixed(1)} °C`}</strong></div>
            {status.temperatureC === null
              ? <p className="server-unavailable">Auf diesem System ist kein Temperatursensor verfügbar.</p>
              : <Meter value={(status.temperatureC / 85) * 100} warning={82} danger={92} />}
            <small>{status.temperatureC !== null && status.temperatureC < 70 ? "Temperatur im normalen Bereich" : "Kühlung und Luftzufuhr prüfen"}</small>
          </article>
        </section>

        <section className="dsa-panel server-detail-panel">
          <div className="panel-heading"><span>Serverdetails</span><small>Messung alle 5 Sekunden, serverseitig zwischengespeichert</small></div>
          <dl className="server-detail-grid">
            <div><dt>Hostname</dt><dd>{status.hostname}</dd></div>
            <div><dt>System</dt><dd>{status.platform}</dd></div>
            <div><dt>Server läuft seit</dt><dd>{formatDuration(status.uptimeSeconds)}</dd></div>
            <div><dt>DSA-Prozess läuft seit</dt><dd>{formatDuration(status.process.uptimeSeconds)}</dd></div>
            <div><dt>DSA-Prozess RAM</dt><dd>{formatBytes(status.process.memoryBytes)}</dd></div>
            <div><dt>Datenbankgröße</dt><dd>{formatBytes(status.databaseBytes)}</dd></div>
            <div><dt>Node.js</dt><dd>{status.nodeVersion}</dd></div>
          </dl>
        </section>
      </>}
    </main>
  </div>;
}
