import type { ReactNode } from "react";
import "./Header.css";

interface HeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}

function Header({ eyebrow, title, subtitle, action }: HeaderProps) {
  return (
    <header className="page-header">
      <div>
        <p className="page-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  );
}

export default Header;
