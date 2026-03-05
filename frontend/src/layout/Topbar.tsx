// src/layout/Topbar.tsx
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

function isValidCoproId(v: string) {
  const s = (v ?? "").trim();
  if (!s) return false;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n);
}

export default function Topbar() {
  const navigate = useNavigate();

  const coproprieteId = useAuthStore((s) => s.coproprieteId);
  const setCopropriete = useAuthStore((s) => s.setCopropriete);
  const logout = useAuthStore((s) => s.logout);

  const onChangeCopro = () => {
    const v = window.prompt("Nouvel ID copropriété ? (ex: 11)", coproprieteId ?? "");
    if (v === null) return; // user cancelled

    const s = v.trim();
    if (!s) {
      alert("ID copropriété obligatoire (ex: 11).");
      return;
    }
    if (!isValidCoproId(s)) {
      alert("ID copropriété invalide. Mets un entier > 0 (ex: 7 ou 11).");
      return;
    }

    setCopropriete(s);

    // Bonus UX : on te ramène sur Dashboard après un switch copro
    // (ça évite des pages qui semblent “vides” parce que la copro change)
    navigate("/", { replace: true });
  };

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
        borderBottom: "1px solid #eee",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>Copropriété App</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Copropriété: <strong>{coproprieteId ?? "—"}</strong>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onChangeCopro}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
          title="Change la copropriété active (header X-Copropriete-Id)"
        >
          Changer copro
        </button>

        <button
          onClick={onLogout}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Déconnexion
        </button>
      </div>
    </header>
  );
}