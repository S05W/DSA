import "./App.css";

type Hero = {
  id: number;
  name: string;
  profession: string;
  species: string;
  adventurePoints: number;
};

const heroes: Hero[] = [
  {
    id: 1,
    name: "Aurelius von Gareth",
    profession: "Gildenmagier",
    species: "Mensch",
    adventurePoints: 1200,
  },
];

function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div>
          <h1 className="logo">DSA</h1>

          <nav className="navigation">
            <button className="navButton active">Meine Helden</button>
            <button className="navButton">Helden erstellen</button>
            <button className="navButton">Einstellungen</button>
          </nav>
        </div>

        <p className="version">DSA Heldenbogen v0.1</p>
      </aside>

      <main className="mainContent">
        <header className="header">
          <div>
            <p className="eyebrow">Das Schwarze Auge</p>
            <h2>Meine Helden</h2>
            <p className="subtitle">
              Verwalte deine Charaktere und öffne ihre Heldenbögen.
            </p>
          </div>

          <button className="primaryButton">Neuen Helden erstellen</button>
        </header>

        <section className="heroGrid">
          {heroes.map((hero) => (
            <article className="heroCard" key={hero.id}>
              <div className="heroImage">
                <span>{hero.name.charAt(0)}</span>
              </div>

              <div className="heroInformation">
                <p className="heroProfession">{hero.profession}</p>
                <h3>{hero.name}</h3>

                <div className="heroDetails">
                  <span>{hero.species}</span>
                  <span>{hero.adventurePoints} AP</span>
                </div>

                <button className="secondaryButton">Heldenbogen öffnen</button>
              </div>
            </article>
          ))}

          <button className="newHeroCard">
            <span className="plus">+</span>
            <strong>Neuen Helden erstellen</strong>
            <span>Erstelle einen neuen DSA-Charakter.</span>
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;