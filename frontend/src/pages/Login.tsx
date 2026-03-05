// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { ENDPOINTS } from "../api/endpoints";
import { useAuthStore } from "../store/authStore";

type LoginResponse = {
  access: string;
  refresh: string;
};

function errorMessage(err: any): string {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail || err?.response?.data?.message;

  if (status === 401) return detail || "Identifiants invalides (401).";
  if (status === 400) return detail || "Requête invalide (400). Vérifie X-Copropriete-Id + champs.";
  if (status === 404) return "Endpoint introuvable (404). Vérifie ENDPOINTS.login.";
  if (status) return detail || `Erreur serveur (${status}).`;
  return "Impossible de joindre le backend (réseau/CORS/serveur arrêté).";
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [coproId, setCoproId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const setCopropriete = useAuthStore((s) => s.setCopropriete);

  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const cid = coproId.trim();
    if (!cid) return alert("Copropriété ID obligatoire.");
    if (!username.trim() || !password.trim()) return alert("Username et Password obligatoires.");

    setLoading(true);

    try {
      // ✅ Ton backend exige X-Copropriete-Id même pour login :
      // On fixe la copro avant + header explicite (double sécurité)
      setCopropriete(cid);

      const res = await api.post<LoginResponse>(
        ENDPOINTS.login,
        { username, password },
        { headers: { "X-Copropriete-Id": cid } }
      );

      setAuth({ access: res.data.access, refresh: res.data.refresh });

      navigate("/", { replace: true });
    } catch (err: any) {
      alert(`Échec login : ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: "60px auto" }}>
      <h2>Connexion</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <input
          placeholder="Copropriété ID (ex: 7)"
          value={coproId}
          onChange={(e) => setCoproId(e.target.value)}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
        Ce backend exige <strong>X-Copropriete-Id</strong> même pour le login.
      </p>
    </div>
  );
}