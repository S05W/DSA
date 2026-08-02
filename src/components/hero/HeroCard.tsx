import Badge from "react-bootstrap/Badge";
import Card from "react-bootstrap/Card";
import { Link } from "react-router";
import type { Hero } from "../../models/Hero";
import "./HeroCard.css";

interface HeroCardProps {
  hero: Hero;
  onDelete: (hero: Hero) => void;
}

function HeroCard({ hero, onDelete }: HeroCardProps) {
  const freeAp = Math.max(0, hero.adventurePoints - hero.spentAdventurePoints);

  return (
    <Card className={`hero-card hero-card-${hero.accent}`}>
      <div className="hero-card-visual">
        <div className="hero-card-pattern" />
        <button type="button" className="hero-card-delete" title={`${hero.name} löschen`} aria-label={`${hero.name} löschen`} onClick={() => onDelete(hero)}>×</button>
        <span className="hero-card-initials">{hero.initials}</span>
        <Badge bg="dark" className="hero-card-level">
          {hero.experienceLevel}
        </Badge>
      </div>
      <Card.Body className="hero-card-body">
        <p className="hero-card-profession">{hero.profession}</p>
        <Card.Title as="h2">{hero.name}</Card.Title>
        <p className="hero-card-meta">{hero.species} · {hero.culture}</p>

        <div className="hero-card-stats">
          <div><span>LeP</span><strong>{hero.lifePoints}</strong></div>
          <div><span>AsP</span><strong>{hero.astralPoints || "–"}</strong></div>
          <div><span>Freie AP</span><strong>{freeAp}</strong></div>
        </div>

        <Link className="hero-card-link" to={`/helden/${hero.id}`}>
          Heldenbogen öffnen <span aria-hidden="true">→</span>
        </Link>
      </Card.Body>
    </Card>
  );
}

export default HeroCard;
