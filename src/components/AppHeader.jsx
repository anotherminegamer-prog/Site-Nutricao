import { BRAND } from "../lib/helpers";

export function BrandLogo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="rt-logo">
      <circle cx="16" cy="16" r="16" fill="var(--brand)" />
      <path
        d="M23 8.5c-8 0-12.5 4-12.5 9.5 0 1.4.4 2.7 1 3.8 1.7-4.4 5-7.2 9.2-8.8-3.5 2.7-5.9 5.5-7.2 9 1 .5 2.1.8 3.4.8 5.2 0 8.1-4.3 8.1-9.6 0-2.3-.8-3.7-2-4.7z"
        fill="var(--brand-ink)"
      />
    </svg>
  );
}

const NAV = [
  { id: "dashboard", label: "Painel" },
  { id: "diet", label: "Dietas" },
  { id: "news", label: "Notícias" },
  { id: "goals", label: "Metas" },
];

export default function AppHeader({ active, userName, pointsBalance, onNavigate, onLogout }) {
  const firstName = userName.split(" ")[0];
  return (
    <header className="rt-topbar">
      <div className="rt-topbar-inner">
        <button type="button" className="rt-brand rt-brand-btn rt-focus" onClick={() => onNavigate("dashboard")} aria-label={`${BRAND}, ir para o painel`}>
          <BrandLogo />
          <span className="rt-brand-name">{BRAND}</span>
        </button>

        <nav className="rt-nav" aria-label="Seções do site">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rt-nav-item rt-focus ${active === item.id ? "rt-nav-active" : ""}`}
              aria-current={active === item.id ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
              {item.id === "goals" && <span className="rt-points-pill">{pointsBalance} pts</span>}
            </button>
          ))}
        </nav>

        <div className="rt-topbar-user">
          <span className="rt-greeting">Olá, {firstName}</span>
          <button type="button" className="rt-link rt-focus" onClick={onLogout}>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
