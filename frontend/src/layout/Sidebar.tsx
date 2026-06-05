import type { CSSProperties, ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { SIDEBAR_SECTIONS } from "../config/productNavigation";
import { useAuthStore } from "../store/authStore";

const SIDEBAR_WIDTH = 276;

type SidebarLinkProps = {
  to: string;
  children: ReactNode;
  end?: boolean;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={sectionTitleStyle}>{children}</div>;
}

function ProductLabel({ children }: { children: ReactNode }) {
  return <div style={productLabelStyle}>{children}</div>;
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
        transition: "background 0.2s ease, transform 0.2s ease",
        transform: active ? "scale(1.12)" : "scale(1)",
      }}
    />
  );
}

function buildLinkStyle(isActive: boolean): CSSProperties {
  return {
    ...linkBase,
    background: isActive
      ? "linear-gradient(180deg, #eef2ff 0%, #e9edff 100%)"
      : "transparent",
    color: isActive ? "#111827" : "#374151",
    fontWeight: isActive ? 900 : 750,
    boxShadow: isActive ? "inset 0 0 0 1px rgba(99, 102, 241, 0.16)" : "none",
  };
}

function SidebarLink({ to, children, end = true }: SidebarLinkProps) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => buildLinkStyle(isActive)}>
      {({ isActive }) => (
        <>
          <Dot active={isActive} />
          <span style={linkTextStyle}>{children}</span>
        </>
      )}
    </NavLink>
  );
}

function shouldUseExactMatch(path: string): boolean {
  /**
   * On garde une activation exacte pour éviter que :
   * - /compta active aussi /compta/imports
   * - /ag/assemblees active aussi /ag/assemblees/:id
   *
   * Cela rend la sidebar plus propre et évite les doubles états actifs.
   */
  return path !== "/";
}

export default function Sidebar() {
  const navigate = useNavigate();

  const coproprieteId = useAuthStore((s) => s.coproprieteId);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const activeCoproLabel = coproprieteId ? `#${coproprieteId}` : "Aucune copropriété active";

  const doLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside style={sidebarStyle} translate="no" className="notranslate">
      <div style={brandSection}>
        <div style={brandRow}>
          <div style={brandIcon}>C</div>

          <div style={brandTextWrapStyle}>
            <div style={brandTitle}>Copropriété App</div>
            <div style={brandSubtitle}>Plateforme de gestion de copropriété</div>
          </div>
        </div>

        <div style={activeContextCard}>
          <ProductLabel>Copropriété active</ProductLabel>

          <div style={activeContextValue}>{activeCoproLabel}</div>

          <div style={activeContextHint}>
            Contexte de travail actuellement chargé dans l’interface.
          </div>
        </div>
      </div>

      <nav aria-label="Navigation principale" style={navStyle}>
        <SidebarLink to="/" end>
          Tableau de bord
        </SidebarLink>

        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.title} style={sectionBlockStyle}>
            <SectionTitle>{section.title}</SectionTitle>

            <div style={sectionItemsStyle}>
              {section.items.map((item) => (
                <SidebarLink
                  key={item.to}
                  to={item.to}
                  end={shouldUseExactMatch(item.to)}
                >
                  {item.label}
                </SidebarLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div style={footerStyle}>
        <div style={footerCard}>
          <div style={footerTitle}>Session utilisateur</div>

          <div style={footerText}>
            Vous êtes connecté à l’espace d’administration de la plateforme.
          </div>
        </div>

        {isAuthenticated ? (
          <button type="button" onClick={doLogout} style={logoutButton}>
            Déconnexion
          </button>
        ) : null}
      </div>
    </aside>
  );
}

const linkBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "11px 13px",
  borderRadius: 14,
  textDecoration: "none",
  color: "#374151",
  transition:
    "background 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
  boxSizing: "border-box",
};

const linkTextStyle: CSSProperties = {
  lineHeight: 1.25,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "normal",
};

const sidebarStyle: CSSProperties = {
  width: SIDEBAR_WIDTH,
  minWidth: SIDEBAR_WIDTH,
  height: "100vh",
  position: "sticky",
  top: 0,
  padding: 16,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  borderRight: "1px solid #e5e7eb",
  background: "rgba(255, 255, 255, 0.94)",
  backdropFilter: "blur(10px)",
  overflow: "hidden",
};

const brandSection: CSSProperties = {
  padding: "4px 4px 16px 4px",
  borderBottom: "1px solid #eef2f7",
  marginBottom: 14,
};

const brandRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const brandIcon: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(180deg, #eef2ff 0%, #e0e7ff 100%)",
  border: "1px solid #c7d2fe",
  color: "#3730a3",
  fontWeight: 900,
  fontSize: 15,
  flexShrink: 0,
  boxShadow: "0 6px 18px rgba(79, 70, 229, 0.08)",
};

const brandTextWrapStyle: CSSProperties = {
  minWidth: 0,
};

const brandTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.2,
  letterSpacing: -0.3,
};

const brandSubtitle: CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 700,
  lineHeight: 1.35,
};

const activeContextCard: CSSProperties = {
  marginTop: 14,
  padding: "12px 13px",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #eef2f7",
};

const activeContextValue: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.2,
};

const activeContextHint: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.45,
};

const navStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  alignContent: "start",
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  paddingRight: 2,
};

const sectionBlockStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const sectionItemsStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const footerStyle: CSSProperties = {
  marginTop: 16,
  paddingTop: 14,
  borderTop: "1px solid #eef2f7",
  display: "grid",
  gap: 10,
};

const footerCard: CSSProperties = {
  padding: "12px 13px",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #eef2f7",
};

const footerTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#111827",
  marginBottom: 4,
};

const footerText: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.45,
};

const logoutButton: CSSProperties = {
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
};

const sectionTitleStyle: CSSProperties = {
  marginTop: 18,
  marginBottom: 8,
  padding: "0 6px",
  fontSize: 11,
  fontWeight: 900,
  opacity: 0.62,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#475569",
};

const productLabelStyle: CSSProperties = {
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};