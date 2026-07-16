import { useState } from "react";
import Badge from "react-bootstrap/Badge";
import ProgressBar from "react-bootstrap/ProgressBar";
import { Link, useParams } from "react-router";
import Sidebar from "../components/layout/Sidebar";
import { heroes } from "../data/heroes";

type HeroTab = "overview" | "attributes" | "talents" | "spells" | "equipment";

const tabs: { id: HeroTab; label: string }[] = [
  { id: "overview", label: "Übersicht" },
  { id: "attributes", label: "Eigenschaften" },
  { id: "talents", label: "Talente" },
  { id: "spells", label: "Zauber" },
  { id: "equipment", label: "Ausrüstung" },
];

function HeroPage() {
  const { heroId } = useParams();
  const [activeTab, setActiveTab] = useState<HeroTab>("overview");
  const hero = heroes.find((entry) => entry.id === Number(heroId));

  if (!hero) {
    return (
      <main className="not-found-page">
        <div className="not-found-rune">?</div>
        <p className="page-eyebrow">Fehlender Eintrag</p>
        <h1>Dieser Held wurde nicht gefunden.</h1>
        <p>Vielleicht wurde der Eintrag verschoben oder die Adresse ist nicht korrekt.</p>
        <Link to="/" className="dsa-link-button">Zurück zum Heldenarchiv</Link>
      </main>
    );
  }

  const freeAp = hero.adventurePoints - hero.spentAdventurePoints;

  return (
    <div className="app-shell">
      <Sidebar heroName={hero.name} />
      <main className="app-main hero-page">
        <Link className="back-link" to="/">← Zurück zum Heldenarchiv</Link>

        <section className={`hero-banner hero-banner-${hero.accent}`}>
          <div className="hero-banner-portrait">{hero.initials}</div>
          <div className="hero-banner-copy">
            <div className="hero-badges">
              <Badge bg="light" text="dark">{hero.experienceLevel}</Badge>
              <span>{hero.culture}</span>
            </div>
            <p className="page-eyebrow">{hero.profession}</p>
            <h1>{hero.name}</h1>
            {hero.title && <p className="hero-title">{hero.title}</p>}
          </div>
          <blockquote>„{hero.quote}“</blockquote>
        </section>

        <nav className="hero-tabs" aria-label="Bereiche des Heldenbogens">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "overview" && (
          <div className="hero-content-grid">
            <section className="content-column">
              <div className="resource-grid">
                <ResourceCard label="Lebensenergie" value={hero.lifePoints} max={hero.maxLifePoints} unit="LeP" />
                <ResourceCard label="Astralenergie" value={hero.astralPoints} max={hero.maxAstralPoints} unit="AsP" />
                <ResourceCard label="Schicksalspunkte" value={hero.fatePoints} max={hero.maxFatePoints} unit="Schip" />
              </div>

              <article className="dsa-panel">
                <div className="panel-heading"><span>Charakter</span><small>Hintergrund</small></div>
                <p className="hero-description">{hero.description}</p>
                <dl className="detail-list">
                  <div><dt>Spezies</dt><dd>{hero.species}</dd></div>
                  <div><dt>Kultur</dt><dd>{hero.culture}</dd></div>
                  <div><dt>Profession</dt><dd>{hero.profession}</dd></div>
                </dl>
              </article>
            </section>

            <aside className="content-column">
              <article className="dsa-panel ap-panel">
                <div className="panel-heading"><span>Abenteuerpunkte</span><small>Fortschritt</small></div>
                <div className="ap-number">{freeAp}<small>frei</small></div>
                <ProgressBar now={(hero.spentAdventurePoints / hero.adventurePoints) * 100} />
                <div className="ap-details"><span>{hero.spentAdventurePoints} ausgegeben</span><span>{hero.adventurePoints} gesamt</span></div>
              </article>

              <article className="dsa-panel">
                <div className="panel-heading"><span>Schnellzugriff</span><small>Höchste Werte</small></div>
                <div className="quick-list">
                  {[...hero.attributes].sort((a, b) => b.value - a.value).slice(0, 4).map((attribute) => (
                    <div key={attribute.short}><span><b>{attribute.short}</b>{attribute.name}</span><strong>{attribute.value}</strong></div>
                  ))}
                </div>
              </article>
            </aside>
          </div>
        )}

        {activeTab === "attributes" && (
          <section className="dsa-panel tab-panel">
            <div className="panel-heading"><span>Eigenschaften</span><small>Grundwerte</small></div>
            <div className="attribute-grid">
              {hero.attributes.map((attribute) => (
                <article key={attribute.short} className="attribute-card">
                  <span>{attribute.short}</span><strong>{attribute.value}</strong><small>{attribute.name}</small>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "talents" && (
          <section className="dsa-panel tab-panel">
            <div className="panel-heading"><span>Talente</span><small>Auswahl wichtiger Werte</small></div>
            <div className="table-list">
              {hero.talents.map((talent) => (
                <div key={talent.name}><span><strong>{talent.name}</strong><small>{talent.category}</small></span><b>{talent.value}</b></div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "spells" && (
          <section className="dsa-panel tab-panel">
            <div className="panel-heading"><span>Zauber</span><small>Magisches Repertoire</small></div>
            {hero.spells.length ? (
              <div className="spell-grid">
                {hero.spells.map((spell) => (
                  <article key={spell.name} className="spell-card">
                    <div><span>Zauber</span><strong>{spell.name}</strong></div>
                    <dl><div><dt>Probe</dt><dd>{spell.check}</dd></div><div><dt>FW</dt><dd>{spell.value}</dd></div><div><dt>Kosten</dt><dd>{spell.cost}</dd></div></dl>
                  </article>
                ))}
              </div>
            ) : <p className="empty-state">Dieser Held beherrscht keine Zauber.</p>}
          </section>
        )}

        {activeTab === "equipment" && (
          <section className="dsa-panel tab-panel">
            <div className="panel-heading"><span>Ausrüstung</span><small>Getragene Gegenstände</small></div>
            <div className="equipment-list">
              {hero.equipment.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>)}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

interface ResourceCardProps { label: string; value: number; max: number; unit: string }
function ResourceCard({ label, value, max, unit }: ResourceCardProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <article className="resource-card">
      <span>{label}</span>
      <strong>{value}<small> / {max}</small></strong>
      <ProgressBar now={percentage} />
      <small>{unit}</small>
    </article>
  );
}

export default HeroPage;
