import { Link } from "react-router";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import { useApp } from "../context/app-context";

function HomePage() {
  const { hero, user } = useApp();
  if (!hero) return null;
  const freeAp = hero.adventurePoints - hero.spentAdventurePoints;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Header
          eyebrow={`Spielerprofil · ${user?.username ?? ""}`}
          title="Mein Held"
          subtitle="Ein persönlicher Heldenbogen mit automatisch gespeicherten Änderungen."
          action={<Link to="/held" className="dsa-primary-button btn btn-primary">Heldenbogen öffnen</Link>}
        />

        <section className={`single-hero-showcase hero-banner-${hero.accent}`}>
          <div className="single-hero-portrait">{hero.initials}</div>
          <div className="single-hero-copy">
            <span className="archive-kicker">{hero.profession}</span>
            <h2>{hero.name}</h2>
            <p>{hero.species} · {hero.culture} · {hero.experienceLevel}</p>
            <blockquote>„{hero.quote}“</blockquote>
          </div>
          <div className="single-hero-stats">
            <div><span>Lebensenergie</span><strong>{hero.lifePoints} / {hero.maxLifePoints}</strong></div>
            <div><span>Astralenergie</span><strong>{hero.astralPoints} / {hero.maxAstralPoints}</strong></div>
            <div><span>Freie AP</span><strong>{freeAp}</strong></div>
          </div>
          <Link className="single-hero-link" to="/held">Zum vollständigen Heldenbogen →</Link>
        </section>
      </main>
    </div>
  );
}

export default HomePage;
