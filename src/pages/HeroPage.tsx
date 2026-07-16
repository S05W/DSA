import { Link, useParams } from "react-router";
import { heroes } from "../data/heroes";

function HeroPage() {
  const { heroId } = useParams();

  const hero = heroes.find(
    (currentHero) => currentHero.id === Number(heroId),
  );

  if (!hero) {
    return (
      <main className="notFoundPage">
        <h1>Held nicht gefunden</h1>
        <p>Es existiert kein Held mit der ID {heroId}.</p>

        <Link className="primaryButton linkButton" to="/">
          Zurück zur Übersicht
        </Link>
      </main>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div>
          <Link className="logo logoLink" to="/">
            DSA
          </Link>

          <nav className="navigation">
            <Link className="navButton" to="/">
              Meine Helden
            </Link>

            <span className="navButton active">{hero.name}</span>
          </nav>
        </div>

        <p className="version">DSA Heldenbogen v0.1</p>
      </aside>

      <main className="mainContent">
        <Link className="backLink" to="/">
          ← Zurück zu meinen Helden
        </Link>

        <header className="characterHeader">
          <div className="characterAvatar">
            {hero.name.charAt(0)}
          </div>

          <div>
            <p className="eyebrow">{hero.profession}</p>
            <h1>{hero.name}</h1>

            <p className="subtitle">
              {hero.species} · {hero.adventurePoints} Abenteuerpunkte
            </p>
          </div>
        </header>

        <nav className="characterTabs">
          <button className="characterTab active">Übersicht</button>
          <button className="characterTab">Eigenschaften</button>
          <button className="characterTab">Talente</button>
          <button className="characterTab">Zauber</button>
          <button className="characterTab">Kampf</button>
          <button className="characterTab">Ausrüstung</button>
        </nav>

        <section className="characterContent">
          <div className="valueGrid">
            <article className="valueCard">
              <span>Lebensenergie</span>
              <strong>{hero.lifePoints}</strong>
              <small>LeP</small>
            </article>

            <article className="valueCard">
              <span>Astralenergie</span>
              <strong>{hero.astralPoints}</strong>
              <small>AsP</small>
            </article>

            <article className="valueCard">
              <span>Abenteuerpunkte</span>
              <strong>{hero.adventurePoints}</strong>
              <small>AP gesamt</small>
            </article>
          </div>

          <article className="informationPanel">
            <h2>Über den Helden</h2>
            <p>{hero.description}</p>
          </article>

          <article className="informationPanel">
            <h2>Grundinformationen</h2>

            <dl className="informationList">
              <div>
                <dt>Spezies</dt>
                <dd>{hero.species}</dd>
              </div>

              <div>
                <dt>Profession</dt>
                <dd>{hero.profession}</dd>
              </div>

              <div>
                <dt>Erfahrungsgrad</dt>
                <dd>Erfahren</dd>
              </div>
            </dl>
          </article>
        </section>
      </main>
    </div>
  );
}

export default HeroPage;