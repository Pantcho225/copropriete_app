import type { CSSProperties, ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const SIDEBAR_WIDTH = 276;

const linkBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  textDecoration: "none",
  color: "#374151",
  transition:
    "background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
  boxSizing: "border-box",
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 18,
        marginBottom: 8,
        padding: "0 6px",
        fontSize: 11,
        fontWeight: 900,
        opacity: 0.55,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "#475569",
      }}
    >
      {children}
    </div>
  );
}

function SidebarLink(props: { to: string; children: ReactNode }) {
  return (
    <NavLink to={props.to} style={({ isActive }) => buildLinkStyle(isActive)}>
      {props.children}
    </NavLink>
  );
}

function buildLinkStyle(isActive: boolean): CSSProperties {
  return {
    ...linkBase,
    background: isActive
      ? "linear-gradient(180deg, #eef2ff 0%, #e9edff 100%)"
      : "transparent",
    color: isActive ? "#111827" : "#374151",
    fontWeight: isActive ? 800 : 700,
    boxShadow: isActive
      ? "inset 0 0 0 1px rgba(99, 102, 241, 0.14)"
      : "none",
  };
}

function Dot({ active = false }: { active?: boolean }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: active ? "#4f46e5" : "#cbd5e1",
        flexShrink: 0,
      }}
    />
  );
}

export default function Sidebar() {
  const navigate = useNavigate();

  const coproprieteId = useAuthStore((s) => s.coproprieteId);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const doLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        padding: 16,
        borderRight: "1px solid #e5e7eb",
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "4px 4px 16px 4px",
          borderBottom: "1px solid #eef2f7",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(180deg, #eef2ff 0%, #e0e7ff 100%)",
              border: "1px solid #c7d2fe",
              color: "#3730a3",
              fontWeight: 900,
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            C
          </div>

          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#111827",
                lineHeight: 1.2,
                letterSpacing: -0.3,
              }}
            >
              Copropriété App
            </div>

            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: "#6b7280",
                fontWeight: 700,
              }}
            >
              Plateforme de gestion de copropriété
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: "12px 13px",
            borderRadius: 14,
            background: "#f8fafc",
            border: "1px solid #eef2f7",
            fontSize: 12,
            color: "#475569",
          }}
        >
          <div
            style={{
              marginBottom: 5,
              fontWeight: 800,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontSize: 11,
            }}
          >
            Copropriété active
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: "#111827",
              lineHeight: 1.2,
            }}
          >
            {coproprieteId ? `#${coproprieteId}` : "Aucune sélection"}
          </div>
        </div>
      </div>

      <nav
        aria-label="Navigation principale"
        style={{
          display: "grid",
          gap: 4,
          alignContent: "start",
          flex: 1,
          overflowY: "auto",
          paddingRight: 2,
        }}
      >
        <SidebarLink to="/">
          <Dot active />
          <span>Tableau de bord</span>
        </SidebarLink>

        <SectionTitle>Comptabilité</SectionTitle>

        <SidebarLink to="/compta/import">
          <Dot />
          <span>Importer un relevé</span>
        </SidebarLink>

        <SidebarLink to="/compta/imports">
          <Dot />
          <span>Imports bancaires</span>
        </SidebarLink>

        <SidebarLink to="/compta/mouvements">
          <Dot />
          <span>Mouvements bancaires</span>
        </SidebarLink>

        <SidebarLink to="/compta/stats">
          <Dot />
          <span>Statistiques comptables</span>
        </SidebarLink>

        <SectionTitle>Ressources humaines</SectionTitle>

        <SidebarLink to="/rh/employes">
          <Dot />
          <span>Employés</span>
        </SidebarLink>

        <SidebarLink to="/rh/contrats">
          <Dot />
          <span>Contrats</span>
        </SidebarLink>

        <SectionTitle>Lots</SectionTitle>

        <SidebarLink to="/lots">
          <Dot />
          <span>Lots</span>
        </SidebarLink>

        <SidebarLink to="/lots/nouveau">
          <Dot />
          <span>Nouveau lot</span>
        </SidebarLink>

        <SectionTitle>Travaux</SectionTitle>

        <SidebarLink to="/travaux/dossiers">
          <Dot />
          <span>Dossiers travaux</span>
        </SidebarLink>

        <SidebarLink to="/travaux/dossiers/nouveau">
          <Dot />
          <span>Nouveau dossier</span>
        </SidebarLink>

        <SidebarLink to="/travaux/fournisseurs">
          <Dot />
          <span>Fournisseurs</span>
        </SidebarLink>

        <SidebarLink to="/travaux/fournisseurs/nouveau">
          <Dot />
          <span>Nouveau fournisseur</span>
        </SidebarLink>

        <SectionTitle>Assemblées générales</SectionTitle>

        <SidebarLink to="/ag">
          <Dot />
          <span>Assemblées générales</span>
        </SidebarLink>

        <SectionTitle>Facturation</SectionTitle>

        <SidebarLink to="/billing">
          <Dot />
          <span>Facturation</span>
        </SidebarLink>

        <SectionTitle>Administration plateforme</SectionTitle>

        <SidebarLink to="/platform-admin">
          <Dot />
          <span>Administration plateforme</span>
        </SidebarLink>
      </nav>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid #eef2f7",
        }}
      >
        {isAuthenticated ? (
          <button
            onClick={doLogout}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              color: "#111827",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 14,
              transition: "all 0.2s ease",
            }}
          >
            Se déconnecter
          </button>
        ) : null}
      </div>
    </aside>
  );
}