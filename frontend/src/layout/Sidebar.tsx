import type { CSSProperties, ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { SIDEBAR_SECTIONS } from "../config/productNavigation";
import { useAuthStore } from "../store/authStore";

const SIDEBAR_WIDTH = 286;

type SidebarLinkProps = {
  to: string;
  children: ReactNode;
  end?: boolean;
};

function shouldUseExactMatch(path: string): boolean {
  return path !== "/";
}

function Dot({ active }: { active: boolean }) {
  return <span style={active ? dotActiveStyle : dotStyle} aria-hidden="true" />;
}

function buildLinkStyle(isActive: boolean): CSSProperties {
  return {
    ...linkStyle,
    color: isActive ? "#F3E9D6" : "#C7CBDA",
    background: isActive ? "rgba(182, 141, 64, 0.13)" : "transparent",
    borderLeftColor: isActive ? "#B68D40" : "transparent",
  };
}

function SidebarLink({ to, children, end = true }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => buildLinkStyle(isActive)}
    >
      {({ isActive }) => (
        <>
          <Dot active={isActive} />
          <span style={linkTextStyle}>{children}</span>
        </>
      )}
    </NavLink>
  );
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");

  return initials || "CP";
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={sectionTitleStyle}>{children}</div>;
}

export default function Sidebar() {
  const navigate = useNavigate();

  const coproprieteId = useAuthStore((s) => s.coproprieteId);
  const coproprieteName = useAuthStore((s) => s.coproprieteName);
  const coproprieteLogoUrl = useAuthStore((s) => s.coproprieteLogoUrl);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const activeCoproLabel = coproprieteName || (coproprieteId ? `#${coproprieteId}` : "Non sélectionnée");
  const activeCoproDetail = coproprieteName && coproprieteId ? `#${coproprieteId}` : "";

  const doLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside id="adminSidebar" style={sidebarStyle} translate="no" className="adminSidebar notranslate">
      <div style={brandStyle}>
        <div style={sealStyle} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="none"
            stroke="#B68D40"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 11l9-7 9 7" />
            <path d="M5 10v9h14v-9" />
            <path d="M10 19v-5h4v5" />
          </svg>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={brandNameStyle}>Copropriété App</div>
          <div style={brandSubStyle}>Gestion de copropriété</div>
        </div>
      </div>

      <div style={coproCardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              flex: "0 0 auto",
              borderRadius: 14,
              border: "1px solid #2A3650",
              background: "#0B1320",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
            aria-hidden="true"
          >
            {coproprieteLogoUrl ? (
              <img
                src={coproprieteLogoUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <span
                style={{
                  color: "#F3E9D6",
                  fontSize: 12,
                  fontWeight: 950,
                }}
              >
                {getInitials(activeCoproLabel)}
              </span>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={coproEyebrowStyle}>Copropriété active</div>
            <div style={coproIdStyle}>{activeCoproLabel}</div>
            {activeCoproDetail ? (
              <div
                style={{
                  color: "#C7CBDA",
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                {activeCoproDetail}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ ...coproNoteStyle, marginTop: 10 }}>
          Contexte de travail actuellement chargé dans l’interface.
        </div>
      </div>

      <nav aria-label="Navigation principale" style={navStyle}>
        <div style={sectionBlockStyle}>
          <SidebarLink to="/" end>
            Tableau de bord
          </SidebarLink>

          <SidebarLink to="/demo-officiel" end>
            Parcours démo officiel
          </SidebarLink>
        </div>

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
        <div style={footerLabelStyle}>Session utilisateur</div>

        <div style={footerValueStyle}>
          Connecté à l’espace d’administration de la plateforme.
        </div>

        {isAuthenticated ? (
          <button type="button" onClick={doLogout} style={logoutButtonStyle}>
            Déconnexion
          </button>
        ) : null}
      </div>
    </aside>
  );
}

const sidebarStyle: CSSProperties = {
  width: SIDEBAR_WIDTH,
  minWidth: SIDEBAR_WIDTH,
  height: "100vh",
  position: "sticky",
  top: 0,
  padding: "28px 20px 24px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  background: "#0B1320",
  color: "#EDEAE0",
  borderRight: "1px solid #2A3650",
  boxShadow: "12px 0 30px rgba(11, 19, 32, 0.16)",
  overflow: "hidden",
};

const brandStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 26,
  minWidth: 0,
};

const sealStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1.4px solid #B68D40",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const brandNameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 16,
  fontWeight: 600,
  color: "#F6F2E9",
  lineHeight: 1.15,
  letterSpacing: 0.2,
};

const brandSubStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 10.5,
  color: "#8C93A8",
  letterSpacing: 0.45,
  textTransform: "uppercase",
  fontWeight: 700,
};

const coproCardStyle: CSSProperties = {
  background: "#16213A",
  border: "1px solid #2A3650",
  borderRadius: 8,
  padding: "13px 14px",
  marginBottom: 22,
};

const coproEyebrowStyle: CSSProperties = {
  fontSize: 9.5,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "#B68D40",
  fontWeight: 800,
};

const coproIdStyle: CSSProperties = {
  marginTop: 3,
  marginBottom: 6,
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 19,
  fontWeight: 600,
  color: "#F6F2E9",
};

const coproNoteStyle: CSSProperties = {
  fontSize: 11,
  color: "#9099AE",
  lineHeight: 1.5,
};

const navStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 2,
};

const sectionBlockStyle: CSSProperties = {
  marginBottom: 18,
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 6px 8px",
  fontSize: 9.5,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "#6E7690",
  fontWeight: 800,
};

const sectionItemsStyle: CSSProperties = {
  display: "grid",
  gap: 3,
};

const linkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 10px",
  borderRadius: 6,
  borderLeft: "2px solid transparent",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  boxSizing: "border-box",
  transition:
    "background 0.16s ease, color 0.16s ease, border-color 0.16s ease",
};

const linkTextStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "normal",
  lineHeight: 1.25,
};

const dotStyle: CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: "50%",
  background: "#5A6480",
  flexShrink: 0,
};

const dotActiveStyle: CSSProperties = {
  ...dotStyle,
  background: "#B68D40",
};

const footerStyle: CSSProperties = {
  borderTop: "1px solid #2A3650",
  paddingTop: 14,
  marginTop: 8,
};

const footerLabelStyle: CSSProperties = {
  fontSize: 10,
  color: "#6E7690",
  marginBottom: 2,
  fontWeight: 700,
};

const footerValueStyle: CSSProperties = {
  fontSize: 12,
  color: "#C7CBDA",
  lineHeight: 1.5,
};

const logoutButtonStyle: CSSProperties = {
  marginTop: 12,
  width: "100%",
  background: "transparent",
  border: "1px solid #2A3650",
  color: "#C7CBDA",
  fontSize: 12.5,
  padding: 9,
  borderRadius: 6,
  fontFamily: "inherit",
  fontWeight: 700,
  cursor: "pointer",
};
