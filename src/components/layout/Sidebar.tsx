import { NavLink } from "react-router";
import "./Sidebar.css";

interface SidebarProps {
  heroName?: string;
}

function Sidebar({ heroName }: SidebarProps) {
  return (
    <aside className="app-sidebar">
      <div>
        <NavLink to="/" className="brand-mark" aria-label="Zur Heldenübersicht">
          <span className="brand-rune">A</span>
          <span>
            <strong>DSA</strong>
            <small>Heldenarchiv</small>
          </span>
        </NavLink>

        <nav className="sidebar-nav" aria-label="Hauptnavigation">
          <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span className="sidebar-icon">◆</span>
            Meine Helden
          </NavLink>
          <button type="button" className="sidebar-link sidebar-button" disabled>
            <span className="sidebar-icon">＋</span>
            Held erstellen
            <small>Bald</small>
          </button>
          {heroName && (
            <div className="sidebar-context">
              <span>Geöffneter Held</span>
              <strong>{heroName}</strong>
            </div>
          )}
        </nav>
      </div>

      <div className="sidebar-footer">
        <span className="status-dot" />
        Lokal gespeichert
        <small>Version 0.1</small>
      </div>
    </aside>
  );
}

export default Sidebar;
