import { NavLink, useNavigate } from "react-router";
import { useApp } from "../../context/app-context";
import "./Sidebar.css";

interface SidebarProps { heroName?: string }

function Sidebar({ heroName }: SidebarProps) {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="app-sidebar">
      <div>
        <NavLink to="/" className="brand-mark" aria-label="Zum Heldenbogen">
          <span className="brand-rune">A</span>
          <span><strong>DSA</strong><small>Heldenarchiv</small></span>
        </NavLink>

        <nav className="sidebar-nav" aria-label="Hauptnavigation">
          <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span className="sidebar-icon">◆</span>Mein Held
          </NavLink>
          {heroName && <div className="sidebar-context"><span>Geöffneter Held</span><strong>{heroName}</strong></div>}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user"><span>Spieler</span><strong>{user?.username}</strong></div>
        <button type="button" className="sidebar-logout" onClick={handleLogout}>Abmelden</button>
        <small><span className="status-dot" />Automatisch gespeichert</small>
      </div>
    </aside>
  );
}

export default Sidebar;
