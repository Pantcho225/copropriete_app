import { Link, Outlet, useNavigate } from "react-router-dom";
import { authStore } from "../auth/auth.store";

export default function AppLayout() {
  const nav = useNavigate();

  function logout() {
    authStore.clearTokens();
    authStore.clearCoproId();
    nav("/login");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
      <aside style={{ padding: 16, borderRight: "1px solid #333" }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Copropriété</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
          Copro: <b>{authStore.getCoproId()}</b>
        </div>

        <nav style={{ display: "grid", gap: 10 }}>
          <Link to="/compta/import">Import CSV</Link>
          <Link to="/compta/stats">Stats</Link>
        </nav>

        <div style={{ marginTop: 16 }}>
          <button onClick={logout}>Déconnexion</button>
        </div>
      </aside>

      <main style={{ padding: 16 }}>
        <Outlet />
      </main>
    </div>
  );
}