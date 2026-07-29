import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import type { Handout, HandoutCategory, HandoutInput, HandoutRecipient } from "../models/Handout";
import { storage } from "../services/storage";

const categoryOptions: { value: HandoutCategory; label: string; short: string }[] = [
  { value: "letter", label: "Brief", short: "B" },
  { value: "clue", label: "Hinweis", short: "H" },
  { value: "portrait", label: "Porträt", short: "P" },
  { value: "document", label: "Dokument", short: "D" },
  { value: "illustration", label: "Illustration", short: "I" },
  { value: "other", label: "Sonstiges", short: "S" },
];

const emptyInput: HandoutInput = {
  title: "",
  description: "",
  category: "letter",
  recipientUserId: null,
  isPublished: true,
  isFeatured: false,
};

function categoryInfo(category: HandoutCategory) {
  return categoryOptions.find((entry) => entry.value === category) ?? categoryOptions.at(-1)!;
}

function imageUrl(handout: Handout, download = false) {
  const suffix = download ? "&download=1" : "";
  return `/api/handouts/${encodeURIComponent(handout.id)}/image?v=${handout.assetVersion}${suffix}`;
}

function formattedDate(value: string | null) {
  if (!value) return "Noch nicht freigegeben";
  return new Date(value).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

function formattedSize(bytes: number) {
  if (!bytes) return "Keine Datei";
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function validateImage(file: File | null) {
  if (!file) return "Bitte wähle ein Bild aus.";
  const isSvg = file.name.toLowerCase().endsWith(".svg");
  if (!["image/png", "image/jpeg", "image/jpg", "image/svg+xml"].includes(file.type) && !isSvg) {
    return "Erlaubt sind PNG, JPG, JPEG und SVG.";
  }
  if (file.size > 12 * 1024 * 1024) return "Das Bild darf höchstens 12 MB groß sein.";
  return "";
}

interface MetadataFieldsProps {
  value: HandoutInput;
  recipients: HandoutRecipient[];
  onChange: (value: HandoutInput) => void;
  prefix: string;
}

function MetadataFields({ value, recipients, onChange, prefix }: MetadataFieldsProps) {
  return <>
    <label htmlFor={`${prefix}-title`}>Titel
      <input id={`${prefix}-title`} value={value.title} maxLength={100} required placeholder="z. B. Brief des Barons" onChange={(event) => onChange({ ...value, title: event.target.value })} />
    </label>
    <label htmlFor={`${prefix}-category`}>Art
      <select id={`${prefix}-category`} value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value as HandoutCategory })}>
        {categoryOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
      </select>
    </label>
    <label htmlFor={`${prefix}-recipient`}>Sichtbar für
      <select id={`${prefix}-recipient`} value={value.recipientUserId ?? ""} onChange={(event) => onChange({ ...value, recipientUserId: event.target.value || null })}>
        <option value="">Alle Spieler</option>
        {recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>Nur {recipient.username}</option>)}
      </select>
    </label>
    <label className="handout-description-field" htmlFor={`${prefix}-description`}>Beschreibung oder Hinweis
      <textarea id={`${prefix}-description`} value={value.description} maxLength={2000} rows={3} placeholder="Was sehen die Spieler? Warum ist das wichtig?" onChange={(event) => onChange({ ...value, description: event.target.value })} />
    </label>
    <div className="handout-checks">
      <label><input type="checkbox" checked={value.isPublished} onChange={(event) => onChange({ ...value, isPublished: event.target.checked })} /> Sofort für Spieler freigeben</label>
      <label><input type="checkbox" checked={value.isFeatured} onChange={(event) => onChange({ ...value, isFeatured: event.target.checked })} /> Oben hervorheben</label>
    </div>
  </>;
}

function MasterHandouts() {
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [recipients, setRecipients] = useState<HandoutRecipient[]>([]);
  const [draft, setDraft] = useState<HandoutInput>(emptyInput);
  const [file, setFile] = useState<File | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ handout: Handout; input: HandoutInput; file: File | null } | null>(null);
  const [preview, setPreview] = useState<Handout | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await storage.getMasterHandouts();
      setHandouts(result.handouts);
      setRecipients(result.recipients);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Die Handouts konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("de");
    return handouts.filter((handout) => {
      if (statusFilter === "published" && !handout.isPublished) return false;
      if (statusFilter === "draft" && handout.isPublished) return false;
      return !term || `${handout.title} ${handout.description} ${handout.recipientUsername ?? ""}`.toLocaleLowerCase("de").includes(term);
    });
  }, [handouts, search, statusFilter]);

  async function createHandout(event: FormEvent) {
    event.preventDefault();
    const fileError = validateImage(file);
    if (fileError) { setError(fileError); return; }
    setBusy(true); setError("");
    let created: Handout | null = null;
    try {
      created = await storage.createHandout(draft);
      await storage.uploadHandoutFile(created.id, file!);
      await storage.updateHandout(created.id, draft);
      setDraft(emptyInput);
      setFile(null);
      const fileInput = document.getElementById("handout-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      await load();
    } catch (reason) {
      if (created && !created.assetVersion) {
        try { await storage.deleteHandout(created.id); } catch { /* Der Entwurf bleibt als sichere Rückfallebene bestehen. */ }
      }
      setError(reason instanceof Error ? reason.message : "Das Handout konnte nicht angelegt werden.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function updateMetadata(handout: Handout, input: HandoutInput, replacement?: File | null) {
    setBusy(true); setError("");
    try {
      if (replacement) {
        const fileError = validateImage(replacement);
        if (fileError) throw new Error(fileError);
        await storage.uploadHandoutFile(handout.id, replacement);
      }
      await storage.updateHandout(handout.id, input);
      setEditing(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Das Handout konnte nicht geändert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function changeVisibility(handout: Handout) {
    await updateMetadata(handout, {
      title: handout.title,
      description: handout.description,
      category: handout.category,
      recipientUserId: handout.recipientUserId,
      isPublished: !handout.isPublished,
      isFeatured: handout.isFeatured,
    });
  }

  async function toggleFeatured(handout: Handout) {
    await updateMetadata(handout, {
      title: handout.title,
      description: handout.description,
      category: handout.category,
      recipientUserId: handout.recipientUserId,
      isPublished: handout.isPublished,
      isFeatured: !handout.isFeatured,
    });
  }

  async function remove(handout: Handout) {
    if (!window.confirm(`„${handout.title}“ wirklich dauerhaft löschen?`)) return;
    setBusy(true); setError("");
    try {
      await storage.deleteHandout(handout.id);
      if (preview?.id === handout.id) setPreview(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Das Handout konnte nicht gelöscht werden.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="dsa-panel handout-create-panel">
      <div className="panel-heading">
        <div><span>Neues Material</span><h2>Handout vorbereiten</h2></div>
        <small>PNG, JPG, JPEG oder SVG · max. 12 MB</small>
      </div>
      <form className="handout-form" onSubmit={createHandout}>
        <MetadataFields value={draft} recipients={recipients} onChange={setDraft} prefix="create-handout" />
        <label className="handout-file-field" htmlFor="handout-file">Bilddatei
          <input id="handout-file" type="file" required accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <span>{file ? `${file.name} · ${formattedSize(file.size)}` : "Datei auswählen"}</span>
        </label>
        <button className="handout-primary-action" type="submit" disabled={busy}>{busy ? "Wird gespeichert …" : draft.isPublished ? "Hochladen und enthüllen" : "Als Entwurf speichern"}</button>
      </form>
    </section>

    <section className="handout-manager-heading">
      <div>
        <h2>Vorbereitete Handouts</h2>
        <p>{handouts.filter((entry) => entry.isPublished).length} freigegeben · {handouts.filter((entry) => !entry.isPublished).length} Entwürfe</p>
      </div>
      <div className="handout-filters">
        <div className="handout-filter-tabs">
          {(["all", "published", "draft"] as const).map((value) => <button key={value} type="button" className={statusFilter === value ? "active" : ""} onClick={() => setStatusFilter(value)}>
            {value === "all" ? "Alle" : value === "published" ? "Freigegeben" : "Entwürfe"}
          </button>)}
        </div>
        <input value={search} placeholder="Handouts durchsuchen" aria-label="Handouts durchsuchen" onChange={(event) => setSearch(event.target.value)} />
      </div>
    </section>

    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <section className="dsa-panel empty-state">Handouts werden geladen …</section> : filtered.length ? <section className="handout-master-grid">
      {filtered.map((handout) => {
        const info = categoryInfo(handout.category);
        return <article key={handout.id} className={`handout-master-card${handout.isPublished ? " published" : " draft"}${handout.isFeatured ? " featured" : ""}`}>
          <button type="button" className="handout-image-button" onClick={() => setPreview(handout)} disabled={!handout.assetVersion}>
            {handout.assetVersion ? <img src={imageUrl(handout)} alt="" /> : <span>Kein Bild</span>}
            <i>{info.short}</i>
          </button>
          <div className="handout-card-copy">
            <div className="handout-card-meta">
              <span>{info.label}</span>
              <b className={handout.isPublished ? "visible" : "hidden"}>{handout.isPublished ? "Freigegeben" : "Entwurf"}</b>
            </div>
            <h3>{handout.title}</h3>
            <p>{handout.description || "Keine zusätzliche Beschreibung."}</p>
            <dl>
              <div><dt>Empfänger</dt><dd>{handout.recipientUsername ? `Nur ${handout.recipientUsername}` : "Alle Spieler"}</dd></div>
              <div><dt>Datei</dt><dd>{formattedSize(handout.fileSize)}</dd></div>
              <div><dt>Zeitpunkt</dt><dd>{formattedDate(handout.revealedAt)}</dd></div>
            </dl>
          </div>
          <div className="handout-card-actions">
            <button type="button" className={handout.isPublished ? "retract" : "reveal"} disabled={busy || !handout.assetVersion} onClick={() => void changeVisibility(handout)}>
              {handout.isPublished ? "Zurückziehen" : "Jetzt enthüllen"}
            </button>
            <button type="button" onClick={() => setEditing({ handout, input: {
              title: handout.title, description: handout.description, category: handout.category,
              recipientUserId: handout.recipientUserId, isPublished: handout.isPublished, isFeatured: handout.isFeatured,
            }, file: null })}>Bearbeiten</button>
            <button type="button" onClick={() => void toggleFeatured(handout)}>{handout.isFeatured ? "Hervorhebung lösen" : "Oben hervorheben"}</button>
            <button type="button" className="danger" onClick={() => void remove(handout)}>Löschen</button>
          </div>
        </article>;
      })}
    </section> : <section className="dsa-panel handout-empty"><span>H</span><h2>Keine passenden Handouts</h2><p>Lege oben einen Brief, Hinweis, ein Porträt oder eine andere Illustration an.</p></section>}

    {editing && <div className="handout-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
      <form className="dsa-panel handout-edit-dialog" onSubmit={(event) => { event.preventDefault(); void updateMetadata(editing.handout, editing.input, editing.file); }}>
        <div className="panel-heading"><div><span>Handout bearbeiten</span><h2>{editing.handout.title}</h2></div><button type="button" aria-label="Schließen" onClick={() => setEditing(null)}>×</button></div>
        <div className="handout-edit-fields">
          <MetadataFields value={editing.input} recipients={recipients} onChange={(input) => setEditing({ ...editing, input })} prefix="edit-handout" />
          <label className="handout-file-field">Bild ersetzen (optional)
            <input type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" onChange={(event) => setEditing({ ...editing, file: event.target.files?.[0] ?? null })} />
            <span>{editing.file ? editing.file.name : editing.handout.originalFileName || "Neue Datei auswählen"}</span>
          </label>
        </div>
        <div className="dialog-actions"><button type="button" onClick={() => setEditing(null)}>Abbrechen</button><button className="handout-primary-action" type="submit" disabled={busy}>Änderungen speichern</button></div>
      </form>
    </div>}
    {preview && <HandoutViewer handouts={[preview]} selected={preview} onSelect={setPreview} onClose={() => setPreview(null)} master />}
  </>;
}

interface HandoutViewerProps {
  handouts: Handout[];
  selected: Handout;
  onSelect: (handout: Handout) => void;
  onClose: () => void;
  master?: boolean;
}

function HandoutViewer({ handouts, selected, onSelect, onClose, master = false }: HandoutViewerProps) {
  const index = handouts.findIndex((handout) => handout.id === selected.id);
  const previous = handouts[index - 1];
  const next = handouts[index + 1];

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && previous) onSelect(previous);
      if (event.key === "ArrowRight" && next) onSelect(next);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [next, onClose, onSelect, previous]);

  return <div className="handout-viewer" role="dialog" aria-modal="true" aria-label={selected.title}>
    <div className="handout-viewer-toolbar">
      <div><span>{categoryInfo(selected.category).label}{selected.isFeatured ? " · Hervorgehoben" : ""}</span><strong>{selected.title}</strong></div>
      <div><a href={imageUrl(selected, true)}>Bild herunterladen</a><button type="button" onClick={onClose}>Schließen</button></div>
    </div>
    <div className="handout-viewer-stage" onClick={onClose}>
      <img src={imageUrl(selected)} alt={selected.title} onClick={(event) => event.stopPropagation()} />
    </div>
    {(selected.description || master) && <div className="handout-viewer-caption">
      <p>{selected.description || "Keine Beschreibung hinterlegt."}</p>
      {master && <small>{selected.recipientUsername ? `Nur für ${selected.recipientUsername}` : "Für alle Spieler"} · {selected.isPublished ? "freigegeben" : "noch als Entwurf"}</small>}
    </div>}
    {previous && <button type="button" className="handout-viewer-nav previous" aria-label="Vorheriges Handout" onClick={() => onSelect(previous)}>‹</button>}
    {next && <button type="button" className="handout-viewer-nav next" aria-label="Nächstes Handout" onClick={() => onSelect(next)}>›</button>}
  </div>;
}

function PlayerHandouts() {
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [category, setCategory] = useState<HandoutCategory | "all">("all");
  const [selected, setSelected] = useState<Handout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentThreshold, setRecentThreshold] = useState(0);

  const load = useCallback(async () => {
    try {
      const next = await storage.getHandouts();
      setHandouts(next);
      setSelected((current) => current ? next.find((entry) => entry.id === current.id) ?? null : null);
      setRecentThreshold(Date.now() - 15 * 60 * 1000);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Die Handouts konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const interval = window.setInterval(() => { void load(); }, 4000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [load]);

  const visible = useMemo(() => handouts.filter((handout) => category === "all" || handout.category === category), [category, handouts]);

  return <>
    <section className="dsa-panel player-handout-intro">
      <div><span>Von der Spielleitung</span><h2>Entdeckungen der Gruppe</h2><p>Hier erscheinen Briefe, Hinweise, Porträts und andere Bilder, sobald der Meister sie freigibt.</p></div>
      <strong>{handouts.length}<small>{handouts.length === 1 ? "Handout" : "Handouts"}</small></strong>
    </section>
    <div className="player-handout-filters" aria-label="Handouts filtern">
      <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Alle</button>
      {categoryOptions.map((entry) => <button key={entry.value} type="button" className={category === entry.value ? "active" : ""} onClick={() => setCategory(entry.value)}>{entry.label}</button>)}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <section className="dsa-panel empty-state">Handouts werden geladen …</section> : visible.length ? <section className="player-handout-grid">
      {visible.map((handout) => {
        const info = categoryInfo(handout.category);
        const isNew = Boolean(handout.revealedAt && new Date(handout.revealedAt).getTime() > recentThreshold);
        return <button key={handout.id} type="button" className={`player-handout-card${handout.isFeatured ? " featured" : ""}`} onClick={() => setSelected(handout)}>
          <div className="player-handout-image">
            <img src={imageUrl(handout)} alt="" />
            <span>{info.short}</span>
            {isNew && <b>Neu</b>}
          </div>
          <div><small>{info.label}</small><h2>{handout.title}</h2><p>{handout.description || "Bild ansehen"}</p><em>{formattedDate(handout.revealedAt)}</em></div>
        </button>;
      })}
    </section> : <section className="dsa-panel handout-empty"><span>H</span><h2>Noch nichts enthüllt</h2><p>Sobald der Meister ein Handout freigibt, erscheint es automatisch hier.</p></section>}
    {selected && <HandoutViewer handouts={visible} selected={selected} onSelect={setSelected} onClose={() => setSelected(null)} />}
  </>;
}

export default function HandoutsPage({ masterMode = false }: { masterMode?: boolean }) {
  return <div className="app-shell">
    <Sidebar />
    <main className={`app-main handouts-page${masterMode ? " master-handouts-page" : ""}`}>
      <Header eyebrow={masterMode ? "Spielleitung" : "Spielmaterial"} title={masterMode ? "Handouts verwalten" : "Handouts"} subtitle={masterMode ? "Bereite Briefe, Hinweise und Illustrationen vor und enthülle sie im richtigen Moment." : "Briefe, Hinweise und Bilder aus eurem Abenteuer."} />
      {masterMode ? <MasterHandouts /> : <PlayerHandouts />}
    </main>
  </div>;
}
