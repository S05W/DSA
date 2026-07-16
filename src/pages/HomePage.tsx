import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import HeroCard from "../components/hero/HeroCard";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import { heroes } from "../data/heroes";

function HomePage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Header
          eyebrow="Das Schwarze Auge"
          title="Meine Helden"
          subtitle="Deine Gruppe, ihre Geschichten und alle wichtigen Werte an einem Ort."
          action={<Button className="dsa-primary-button" disabled>＋ Neuen Helden anlegen</Button>}
        />

        <section className="archive-intro">
          <div>
            <span className="archive-kicker">Heldenarchiv</span>
            <h2>{heroes.length} Charaktere bereit für das nächste Abenteuer</h2>
          </div>
          <p>Wähle einen Helden aus, um Eigenschaften, Talente, Zauber und Ausrüstung zu öffnen.</p>
        </section>

        <Row className="g-4 hero-grid">
          {heroes.map((hero) => (
            <Col key={hero.id} xs={12} md={6} xl={4}>
              <HeroCard hero={hero} />
            </Col>
          ))}
          <Col xs={12} md={6} xl={4}>
            <button type="button" className="new-hero-tile" disabled>
              <span className="new-hero-icon">＋</span>
              <strong>Neuen Helden erschaffen</strong>
              <span>Die Charaktererstellung folgt in einer späteren Version.</span>
            </button>
          </Col>
        </Row>
      </main>
    </div>
  );
}

export default HomePage;
