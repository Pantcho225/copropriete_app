// src/layout/Sidebar.tsx
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const linkBase: React.CSSProperties = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
};

function SectionTitle(props: { children: any }) {
  return (
    <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6, letterSpacing: 0.6 }}>
      {props.children}
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
        width: 260,
        padding: 16,
        borderRight: "1px solid #eee",
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "#fff",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Copropriété App</div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>Admin Panel</div>

        {/* ✅ Copro active (aide beaucoup quand on change 7 ↔ 11) */}
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Copro active : <b>{coproprieteId ?? "—"}</b>
        </div>
      </div>

      <nav style={{ display: "grid", gap: 6 }}>
        <NavLink
          to="/"
          end
          style={({ isActive }) => ({
            ...linkBase,
            background: isActive ? "#f3f4f6" : "transparent",
            fontWeight: isActive ? 800 : 600,
          })}
        >
          Dashboard
        </NavLink>

        <SectionTitle>COMPTA</SectionTitle>

        <NavLink
          to="/compta/import"
          style={({ isActive }) => ({
            ...linkBase,
            background: isActive ? "#f3f4f6" : "transparent",
            fontWeight: isActive ? 800 : 600,
          })}
        >
          Import CSV
        </NavLink>

        <NavLink
          to="/compta/imports"
          style={({ isActive }) => ({
            ...linkBase,
            background: isActive ? "#f3f4f6" : "transparent",
            fontWeight: isActive ? 800 : 600,
          })}
        >
          Imports
        </NavLink>

        {/* ✅ NEW */}
        <NavLink
          to="/compta/mouvements"
          style={({ isActive }) => ({
            ...linkBase,
            background: isActive ? "#f3f4f6" : "transparent",
            fontWeight: isActive ? 800 : 600,
          })}
        >
          Mouvements
        </NavLink>

        <NavLink
          to="/compta/stats"
          style={({ isActive }) => ({
            ...linkBase,
            background: isActive ? "#f3f4f6" : "transparent",
            fontWeight: isActive ? 800 : 600,
          })}
        >
          Stats
        </NavLink>

        {/* ✅ Footer actions */}
        <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 12 }}>
          {isAuthenticated ? (
            <button
              onClick={doLogout}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #eee",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              Se déconnecter
            </button>
          ) : null}
        </div>
      </nav>
    </aside>
  );
}