import { useState, type FormEvent } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { useNavigate } from "react-router";
import HeroCard from "../components/hero/HeroCard";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import { useApp } from "../context/app-context";
import { createDefaultHero } from "../data/heroes";

const emptyDraft = {
  name: "",
  species: "Mensch",
  culture: "",
  profession: "",
  experienceLevel: "Erfahren",
};

function HomePage() {
  const { createHero, heroes, user } = useApp();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!user || !draft.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const hero = await createHero(createDefaultHero(user.id, draft));
      setDraft(emptyDraft);
      setShowForm(false);
      navigate(`/helden/${hero.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Der Held konnte nicht angelegt werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Header
          eyebrow={`Spielerprofil · ${user?.username ?? ""}`}
          title="Meine Helden"
          subtitle="Lege mehrere Helden an und öffne jederzeit den gewünschten Heldenbogen."
          action={<Button className="dsa-primary-button" onClick={() => setShowForm((current) => !current)}>{showForm ? "Abbrechen" : "Neuen Helden erstellen"}</Button>}
        />

        {showForm && (
          <Form className="new-hero-form dsa-panel" onSubmit={handleCreate}>
            <div className="panel-heading"><span>Neuen Helden anlegen</span><small>Grunddaten</small></div>
            <div className="new-hero-form-grid">
              <Form.Group>
                <Form.Label>Name *</Form.Label>
                <Form.Control autoFocus maxLength={80} required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="z. B. Alrik vom Blautann" />
              </Form.Group>
              <Form.Group>
                <Form.Label>Spezies</Form.Label>
                <Form.Control value={draft.species} onChange={(event) => setDraft({ ...draft, species: event.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Kultur</Form.Label>
                <Form.Control value={draft.culture} onChange={(event) => setDraft({ ...draft, culture: event.target.value })} placeholder="z. B. Mittelreich" />
              </Form.Group>
              <Form.Group>
                <Form.Label>Profession</Form.Label>
                <Form.Control value={draft.profession} onChange={(event) => setDraft({ ...draft, profession: event.target.value })} placeholder="z. B. Krieger" />
              </Form.Group>
              <Form.Group>
                <Form.Label>Erfahrungsgrad</Form.Label>
                <Form.Select value={draft.experienceLevel} onChange={(event) => setDraft({ ...draft, experienceLevel: event.target.value })}>
                  <option>Unerfahren</option>
                  <option>Durchschnittlich</option>
                  <option>Erfahren</option>
                  <option>Kompetent</option>
                  <option>Meisterlich</option>
                  <option>Brillant</option>
                  <option>Legendär</option>
                </Form.Select>
              </Form.Group>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" disabled={saving || !draft.name.trim()} className="dsa-primary-button">{saving ? "Wird gespeichert …" : "Held anlegen"}</Button>
          </Form>
        )}

        {heroes.length > 0 ? (
          <section className="hero-archive" aria-label="Gespeicherte Helden">
            <div className="archive-intro">
              <div><span className="archive-kicker">Heldenarchiv</span><h2>{heroes.length === 1 ? "1 gespeicherter Held" : `${heroes.length} gespeicherte Helden`}</h2></div>
              <p>Alle Änderungen werden automatisch in der Datenbank auf deinem Raspberry Pi gespeichert.</p>
            </div>
            <div className="hero-card-grid">
              {heroes.map((hero) => <HeroCard key={hero.id} hero={hero} />)}
              <button type="button" className="new-hero-tile" onClick={() => setShowForm(true)}>
                <span className="new-hero-icon">+</span><strong>Weiteren Helden anlegen</strong><span>Erstelle einen zusätzlichen Heldenbogen für diesen Benutzer.</span>
              </button>
            </div>
          </section>
        ) : (
          <section className="empty-heroes dsa-panel">
            <span className="new-hero-icon">+</span>
            <h2>Noch keine Helden angelegt</h2>
            <p>Erstelle deinen ersten Helden. Er wird direkt auf dem Pi gespeichert.</p>
            {!showForm && <Button className="dsa-primary-button" onClick={() => setShowForm(true)}>Ersten Helden erstellen</Button>}
          </section>
        )}
      </main>
    </div>
  );
}

export default HomePage;
