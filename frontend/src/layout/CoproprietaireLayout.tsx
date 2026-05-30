import type { CSSProperties } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../store/authStore";

type NavItem = {
  label: string;
  path: string;
  icon: string;
  description: string;
};

type PageMeta = {
  title: string;
  subtitle: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    path: "/coproprietaire",
    icon: "🏠",
    description: "Vue d’ensemble",
  },
  {
    label: "Mes lots",
    path: "/coproprietaire/mes-lots",
    icon: "🏢",
    description: "Biens rattachés",
  },
  {
    label: "Appels de charges",
    path: "/coproprietaire/appels",
    icon: "📄",
    description: "Échéances et frais",
  },
  {
    label: "Paiements",
    path: "/coproprietaire/paiements",
    icon: "💳",
    description: "Règlements suivis",
  },
  {
    label: "Relances",
    path: "/coproprietaire/relances",
    icon: "🔔",
    description: "Suivi des rappels",
  },
  {
    label: "Documents",
    path: "/coproprietaire/documents",
    icon: "📁",
    description: "PV et pièces utiles",
  },
  {
    label: "Assemblées générales",
    path: "/coproprietaire/ag",
    icon: "🗳️",
    description: "Votes, quorum et PV",
  },
];

const PAGE_META: Record<string, PageMeta> = {
  "/coproprietaire": {
    title: "Tableau de bord",
    subtitle: "Retrouvez vos lots, charges, paiements, documents et informations de copropriété.",
  },
  "/coproprietaire/tableau-de-bord": {
    title: "Tableau de bord",
    subtitle: "Retrouvez vos lots, charges, paiements, documents et informations de copropriété.",
  },
  "/coproprietaire/mes-lots": {
    title: "Mes lots",
    subtitle: "Consultez les lots rattachés à votre compte copropriétaire.",
  },
  "/coproprietaire/appels": {
    title: "Appels de charges",
    subtitle: "Suivez vos appels de fonds, échéances, montants dus et règlements.",
  },
  "/coproprietaire/paiements": {
    title: "Mes paiements",
    subtitle: "Consultez l’historique de vos règlements enregistrés.",
  },
  "/coproprietaire/relances": {
    title: "Mes relances",
    subtitle: "Suivez les relances et avis liés à votre situation de paiement.",
  },
  "/coproprietaire/documents": {
    title: "Mes documents",
    subtitle: "Accédez à vos documents utiles, procès-verbaux et pièces partagées.",
  },
  "/coproprietaire/ag": {
    title: "Assemblées générales",
    subtitle: "Consultez vos assemblées, présences, votes, résolutions et procès-verbaux.",
  },
};

function getPageMeta(pathname: string): PageMeta {
  return (
    PAGE_META[pathname] ?? {
      title: "Espace copropriétaire",
      subtitle: "Accédez à vos informations personnelles de copropriété.",
    }
  );
}

export default function CoproprietaireLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);

  const pageMeta = getPageMeta(location.pathname);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brandBlock}>
          <div style={styles.logoWrap}>
            <div style={styles.logo}>C</div>
            <span style={styles.logoPulse} />
          </div>

          <div style={styles.brandTexts}>
            <p style={styles.brandTitle}>Espace copropriétaire</p>
            <p style={styles.brandSub}>Portail personnel sécurisé</p>
          </div>
        </div>

        <div style={styles.profileCard}>
          <p style={styles.profileEyebrow}>Compte personnel</p>
          <p style={styles.profileTitle}>Accès copropriétaire</p>
          <p style={styles.profileText}>
            Vos données sont filtrées selon votre compte et vos lots rattachés.
          </p>
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/coproprietaire"}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    style={{
                      ...styles.navIcon,
                      ...(isActive ? styles.navIconActive : {}),
                    }}
                  >
                    {item.icon}
                  </span>

                  <span style={styles.navTextBlock}>
                    <span style={styles.navLabel}>{item.label}</span>
                    <span
                      style={{
                        ...styles.navDescription,
                        ...(isActive ? styles.navDescriptionActive : {}),
                      }}
                    >
                      {item.description}
                    </span>
                  </span>

                  {isActive ? <span style={styles.activeDot} /> : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.footerIcon}>🔐</div>
          <div>
            <p style={styles.footerTitle}>Accès sécurisé</p>
            <p style={styles.footerText}>
              L’espace copropriétaire est séparé de l’administration.
            </p>
          </div>
        </div>
      </aside>

      <main style={styles.main}>
        <header style={styles.topbar}>
          <div style={styles.topbarLeft}>
            <p style={styles.eyebrow}>Portail copropriétaire</p>
            <h1 style={styles.pageTitle}>{pageMeta.title}</h1>
            <p style={styles.pageSubtitle}>{pageMeta.subtitle}</p>
          </div>

          <div style={styles.topbarRight}>
            <div style={styles.securityPill}>
              <span style={styles.securityDot} />
              <span>Session sécurisée</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={styles.logoutButton}
            >
              Déconnexion
            </button>
          </div>
        </header>

        <section style={styles.content}>
          <Outlet />
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(99,102,241,0.16), transparent 30%), linear-gradient(135deg, #f8fafc 0%, #eef2ff 52%, #f8fafc 100%)",
    color: "#0f172a",
  },

  sidebar: {
    width: 310,
    minHeight: "100vh",
    padding: 22,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.95) 52%, rgba(30,41,59,0.98) 100%)",
    color: "white",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    boxShadow: "22px 0 70px rgba(15,23,42,0.22)",
    borderRight: "1px solid rgba(255,255,255,0.08)",
  },

  brandBlock: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    paddingBottom: 18,
    borderBottom: "1px solid rgba(255,255,255,0.12)",
  },

  logoWrap: {
    position: "relative",
    width: 48,
    height: 48,
    flexShrink: 0,
  },

  logo: {
    position: "relative",
    zIndex: 2,
    width: 48,
    height: 48,
    borderRadius: 18,
    background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
    fontSize: 22,
    boxShadow: "0 18px 38px rgba(59,130,246,0.35)",
  },

  logoPulse: {
    position: "absolute",
    inset: -4,
    borderRadius: 22,
    background: "rgba(96,165,250,0.18)",
    zIndex: 1,
  },

  brandTexts: {
    minWidth: 0,
  },

  brandTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: "-0.01em",
  },

  brandSub: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 1.4,
  },

  profileCard: {
    borderRadius: 24,
    padding: 16,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.22), rgba(99,102,241,0.16))",
    border: "1px solid rgba(147,197,253,0.24)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },

  profileEyebrow: {
    margin: 0,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#93c5fd",
  },

  profileTitle: {
    margin: "8px 0 0",
    fontSize: 15,
    fontWeight: 900,
    color: "#ffffff",
  },

  profileText: {
    margin: "6px 0 0",
    fontSize: 12,
    lineHeight: 1.55,
    color: "#dbeafe",
  },

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  navLink: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 13px",
    borderRadius: 18,
    color: "#cbd5e1",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
    transition: "all 160ms ease",
    border: "1px solid transparent",
  },

  navLinkActive: {
    color: "white",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.34), rgba(79,70,229,0.28))",
    boxShadow:
      "inset 0 0 0 1px rgba(147,197,253,0.30), 0 14px 34px rgba(15,23,42,0.18)",
    border: "1px solid rgba(147,197,253,0.18)",
  },

  navIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
  },

  navIconActive: {
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.20)",
  },

  navTextBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },

  navLabel: {
    fontSize: 13,
    lineHeight: 1.25,
    fontWeight: 900,
  },

  navDescription: {
    fontSize: 11,
    lineHeight: 1.25,
    color: "#94a3b8",
    fontWeight: 700,
  },

  navDescriptionActive: {
    color: "#dbeafe",
  },

  activeDot: {
    marginLeft: "auto",
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#60a5fa",
    boxShadow: "0 0 0 5px rgba(96,165,250,0.16)",
    flexShrink: 0,
  },

  sidebarFooter: {
    marginTop: "auto",
    borderRadius: 24,
    padding: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },

  footerIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.10)",
    flexShrink: 0,
  },

  footerTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 900,
  },

  footerText: {
    margin: "6px 0 0",
    fontSize: 12,
    lineHeight: 1.55,
    color: "#cbd5e1",
  },

  main: {
    flex: 1,
    minWidth: 0,
    padding: 26,
    overflowX: "hidden",
  },

  topbar: {
    minHeight: 92,
    borderRadius: 30,
    padding: "20px 24px",
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 22px 65px rgba(15,23,42,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    backdropFilter: "blur(14px)",
  },

  topbarLeft: {
    minWidth: 0,
  },

  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#2563eb",
  },

  pageTitle: {
    margin: "5px 0 0",
    fontSize: 25,
    lineHeight: 1.18,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },

  pageSubtitle: {
    margin: "7px 0 0",
    maxWidth: 820,
    fontSize: 13,
    lineHeight: 1.55,
    color: "#64748b",
    fontWeight: 650,
  },

  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },

  securityPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "9px 12px",
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#047857",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  securityDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#10b981",
    boxShadow: "0 0 0 4px rgba(16,185,129,0.14)",
  },

  logoutButton: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#be123c",
    borderRadius: 16,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 26px rgba(190,18,60,0.08)",
  },

  content: {
    paddingTop: 24,
    paddingBottom: 26,
  },
};