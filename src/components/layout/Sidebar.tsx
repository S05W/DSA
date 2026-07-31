import { NavLink, useNavigate } from "react-router";
import { useApp } from "../../context/app-context";
import "./Sidebar.css";

interface SidebarProps { heroName?: string }

function Sidebar({ heroName }: SidebarProps) {
  const { user, viewRole, setViewRole, logout } = useApp();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      window.alert("Abmelden fehlgeschlagen. Prüfe bitte kurz die Verbindung zum DSA-Server.");
    }
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
            <span className="sidebar-icon">◆</span><span className="sidebar-label">Meine Helden</span>
          </NavLink>
          <NavLink to="/wuerfel" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span className="sidebar-icon">W</span><span className="sidebar-label">Würfel</span>
          </NavLink>
          {viewRole !== "master" && <NavLink to="/handouts" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span className="sidebar-icon">H</span><span className="sidebar-label">Handouts</span>
          </NavLink>}
          {viewRole === "master" && <NavLink to="/meister" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span className="sidebar-icon">M</span><span className="sidebar-label">Meisteransicht</span>
          </NavLink>}
          {viewRole === "master" && <NavLink to="/meister/karte" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span className="sidebar-icon">K</span><span className="sidebar-label">Karteneditor</span>
          </NavLink>}
          {viewRole === "master" && <NavLink to="/meister/handouts" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span className="sidebar-icon">H</span><span className="sidebar-label">Handouts</span>
          </NavLink>}
          {viewRole === "master" && <NavLink to="/meister/server" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span className="sidebar-icon">P</span><span className="sidebar-label">Pi-Status</span>
          </NavLink>}
          <button type="button" className="sidebar-mobile-logout" onClick={() => void handleLogout()} aria-label="Abmelden" title="Abmelden">
            <span className="sidebar-icon">×</span>
          </button>
          {heroName && <div className="sidebar-context"><span>Geöffneter Held</span><strong>{heroName}</strong></div>}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user"><span>{viewRole === "master" ? "Meisteransicht" : "Spieleransicht"}</span><strong>{user?.username}</strong></div>
        {user?.role === "master" && <button type="button" className="sidebar-role-switch" onClick={() => {
          const nextRole = viewRole === "master" ? "player" : "master";
          setViewRole(nextRole);
          navigate(nextRole === "master" ? "/meister" : "/");
        }}>Zu {viewRole === "master" ? "Spieleransicht" : "Meisteransicht"} wechseln</button>}
        <button type="button" className="sidebar-logout" onClick={() => void handleLogout()}>Abmelden</button>
        <small><span className="status-dot" />Automatisch gespeichert</small>
      </div>
    </aside>
  );
}

export default Sidebar;
