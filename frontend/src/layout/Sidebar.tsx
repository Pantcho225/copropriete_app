import type { CSSProperties, ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { SIDEBAR_SECTIONS } from "../config/productNavigation";

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
        opacity: 0.62,
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
      {({ isActive }) => (
        <>
          <Dot active={isActive} />
          <span>{props.children}</span>
        </>
      )}
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
        transition: "background 0.2s ease",
      }}
    />
  );
}

function ProductLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 6,
        fontSize: 11,
        fontWeight: 900,
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {children}
    </div>
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
          <ProductLabel>Copropriété active</ProductLabel>

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
        <SidebarLink to="/">Tableau de bord</SidebarLink>

        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.title}>
            <SectionTitle>{section.title}</SectionTitle>

            {section.items.map((item) => (
              <SidebarLink key={item.to} to={item.to}>
                {item.label}
              </SidebarLink>
            ))}
          </div>
        ))}
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