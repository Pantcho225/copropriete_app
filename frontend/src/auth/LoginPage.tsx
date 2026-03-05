import { useState } from "react";
import axios from "axios";
import { API_BASE_URL, ENDPOINTS } from "../api/endpoints";
import { authStore } from "./auth.store";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [coproId, setCoproId] = useState(authStore.getCoproId() ?? "");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const r = await axios.post(
        `${API_BASE_URL}${ENDPOINTS.token}`,
        { username, password },
        { timeout: 20000 }
      );

      const access = r.data?.access;
      const refresh = r.data?.refresh;
      if (!access || !refresh) {
        setError("Réponse JWT invalide.");
        return;
      }

      authStore.setTokens({ access, refresh });
      authStore.setCoproId(String(coproId));

      nav("/compta/import");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Login échoué.");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 16 }}>
      <h2>Connexion</h2>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input placeholder="X-Copropriete-Id (ex: 11)" value={coproId} onChange={(e) => setCoproId(e.target.value)} />

        {error ? <div style={{ color: "tomato" }}>{error}</div> : null}

        <button type="submit">Se connecter</button>
      </form>
    </div>
  );
}