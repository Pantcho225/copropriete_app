// src/pages/Login.tsx
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
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

  if (status === 401) return detail || "Identifiants invalides.";
  if (status === 400) {
    return detail || "Requête invalide. Vérifiez les informations saisies.";
  }
  if (status === 404) {
    return "Le service de connexion est introuvable. Vérifiez la configuration de l’API.";
  }
  if (status) return detail || `Une erreur serveur est survenue (${status}).`;
  return "Impossible de joindre le backend. Vérifiez le serveur, le réseau ou la configuration CORS.";
}

export default function Login() {
  const navigate = useNavigate();

  const setAuth = useAuthStore((s) => s.setAuth);
  const setCopropriete = useAuthStore((s) => s.setCopropriete);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [coproId, setCoproId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(
    "Ce backend exige l’en-tête X-Copropriete-Id dès l’authentification."
  );

  const isFormValid = useMemo(() => {
    return (
      username.trim().length > 0 &&
      password.trim().length > 0 &&
      coproId.trim().length > 0
    );
  }, [username, password, coproId]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    const cid = coproId.trim();
    const user = username.trim();
    const pass = password.trim();

    setError("");
    setInfo("Vérification des informations en cours...");

    if (!cid) {
      setInfo("");
      setError("L’identifiant de copropriété est obligatoire.");
      return;
    }

    if (!user || !pass) {
      setInfo("");
      setError("Le nom d’utilisateur et le mot de passe sont obligatoires.");
      return;
    }

    setLoading(true);

    try {
      setCopropriete(cid);

      const res = await api.post<LoginResponse>(
        ENDPOINTS.login,
        { username: user, password: pass },
        {
          headers: {
            "X-Copropriete-Id": cid,
          },
        }
      );

      setAuth({
        access: res.data.access,
        refresh: res.data.refresh,
      });

      setInfo("Connexion réussie. Redirection en cours...");
      navigate("/", { replace: true });
    } catch (err: any) {
      setInfo("");
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={page} className="login-page-responsive">
      <div style={backgroundGlowTop} />
      <div style={backgroundGlowBottom} />

      <div style={shell} className="login-shell-responsive">
        <section style={heroPanel} className="login-hero-responsive">
          <div style={heroTop}>
            <div style={heroBadge}>Plateforme de gestion</div>

            <h1 style={heroTitle} className="login-hero-title-responsive">
              Logiciel de gestion de copropriété
            </h1>

            <p style={heroText}>
              Centralisez la comptabilité, les relances, les travaux, les assemblées générales et
              les opérations de gestion dans une interface claire, structurée et sécurisée.
            </p>
          </div>

          <div style={heroMiddle}>
            <div style={heroFeatureList}>
              <div style={heroFeatureItem}>Comptabilité et rapprochement bancaire</div>
              <div style={heroFeatureItem}>Relances et avis de régularisation</div>
              <div style={heroFeatureItem}>Travaux, fournisseurs et suivi budgétaire</div>
              <div style={heroFeatureItem}>Assemblées générales et procès-verbaux</div>
            </div>
          </div>

          <div style={heroBottom}>
            <div style={heroStatGrid} className="login-hero-stats-responsive">
              <div style={heroStatCard}>
                <div style={heroStatLabel}>Modules</div>
                <div style={heroStatValue}>8+</div>
              </div>
              <div style={heroStatCard}>
                <div style={heroStatLabel}>Pilotage</div>
                <div style={heroStatValue}>Centralisé</div>
              </div>
              <div style={heroStatCard}>
                <div style={heroStatLabel}>Accès</div>
                <div style={heroStatValue}>Sécurisé</div>
              </div>
            </div>
          </div>
        </section>

        <section style={formPanel}>
          <div style={card} className="login-card-responsive">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={eyebrow}>Authentification</div>
              <h2 style={title} className="login-title-responsive">
                Connexion
              </h2>
              <p style={subtitle}>
                Connectez-vous à votre espace de gestion en renseignant vos identifiants et
                l’identifiant de la copropriété active.
              </p>
            </div>

            {error ? <div style={errorBox}>{error}</div> : null}
            {!error && info ? <div style={infoBox}>{info}</div> : null}

            <form onSubmit={onSubmit} style={form}>
              <div style={fieldGroup}>
                <label htmlFor="username" style={label}>
                  Nom d’utilisateur
                </label>
                <input
                  id="username"
                  style={input}
                  placeholder="Saisissez votre nom d’utilisateur"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={loading}
                />
              </div>

              <div style={fieldGroup}>
                <label htmlFor="password" style={label}>
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  style={input}
                  placeholder="Saisissez votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>

              <div style={fieldGroup}>
                <label htmlFor="coproprieteId" style={label}>
                  Identifiant de copropriété
                </label>
                <input
                  id="coproprieteId"
                  style={input}
                  placeholder="Exemple : 7"
                  value={coproId}
                  onChange={(e) => setCoproId(e.target.value)}
                  inputMode="numeric"
                  disabled={loading}
                />
                <div style={helperText}>
                  Cet identifiant est requis pour transmettre l’en-tête{" "}
                  <strong>X-Copropriete-Id</strong> dès la connexion.
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isFormValid}
                style={{
                  ...submitButton,
                  opacity: loading || !isFormValid ? 0.72 : 1,
                  cursor: loading || !isFormValid ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Connexion en cours..." : "Se connecter"}
              </button>
            </form>

            <div style={footerNote}>
              Accès réservé aux utilisateurs autorisés de la plateforme.
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .login-shell-responsive {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
            max-width: 760px !important;
          }

          .login-hero-responsive {
            min-height: auto !important;
            padding: 28px !important;
            gap: 20px !important;
          }

          .login-card-responsive {
            max-width: 100% !important;
          }
        }

        @media (max-width: 700px) {
          .login-page-responsive {
            padding: 16px !important;
          }

          .login-hero-responsive {
            padding: 22px !important;
            border-radius: 22px !important;
          }

          .login-card-responsive {
            padding: 22px !important;
            border-radius: 22px !important;
          }

          .login-title-responsive {
            font-size: 26px !important;
          }

          .login-hero-title-responsive {
            font-size: 30px !important;
          }

          .login-hero-stats-responsive {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%)",
  padding: 24,
  boxSizing: "border-box",
};

const backgroundGlowTop: CSSProperties = {
  position: "absolute",
  top: -120,
  left: -80,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "rgba(99, 102, 241, 0.10)",
  filter: "blur(40px)",
  pointerEvents: "none",
};

const backgroundGlowBottom: CSSProperties = {
  position: "absolute",
  right: -60,
  bottom: -100,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "rgba(30, 41, 59, 0.08)",
  filter: "blur(46px)",
  pointerEvents: "none",
};

const shell: CSSProperties = {
  width: "100%",
  maxWidth: 1200,
  display: "grid",
  gridTemplateColumns: "1.04fr 0.96fr",
  gap: 22,
  alignItems: "center",
  position: "relative",
  zIndex: 1,
};

const heroPanel: CSSProperties = {
  borderRadius: 30,
  padding: 34,
  background: "linear-gradient(135deg, #0b1736 0%, #13264f 55%, #1e293b 100%)",
  color: "#ffffff",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
  display: "grid",
  alignContent: "space-between",
  gap: 28,
  minHeight: 570,
};

const heroTop: CSSProperties = {
  display: "grid",
  gap: 18,
};

const heroMiddle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const heroBottom: CSSProperties = {
  display: "grid",
  gap: 14,
};

const heroBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  padding: "8px 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.12)",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.2,
};

const heroTitle: CSSProperties = {
  margin: 0,
  fontSize: 42,
  lineHeight: 1.06,
  fontWeight: 900,
  letterSpacing: -1,
};

const heroText: CSSProperties = {
  margin: 0,
  color: "rgba(255,255,255,0.88)",
  fontSize: 15,
  lineHeight: 1.8,
  maxWidth: 620,
};

const heroFeatureList: CSSProperties = {
  display: "grid",
  gap: 12,
};

const heroFeatureItem: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
};

const heroStatGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const heroStatCard: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
  display: "grid",
  gap: 6,
};

const heroStatLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.72)",
};

const heroStatValue: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#ffffff",
};

const formPanel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 580,
  borderRadius: 30,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 26px 60px rgba(15, 23, 42, 0.14)",
  padding: 36,
  display: "grid",
  gap: 22,
};

const eyebrow: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#4f46e5",
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

const title: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.08,
  fontWeight: 900,
  color: "#111827",
};

const subtitle: CSSProperties = {
  margin: 0,
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.7,
};

const form: CSSProperties = {
  display: "grid",
  gap: 18,
};

const fieldGroup: CSSProperties = {
  display: "grid",
  gap: 8,
};

const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#111827",
};

const input: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  padding: "15px 16px",
  fontSize: 14,
  color: "#111827",
  outline: "none",
  boxSizing: "border-box",
};

const helperText: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.55,
};

const submitButton: CSSProperties = {
  marginTop: 6,
  border: "none",
  borderRadius: 16,
  background: "#111827",
  color: "#ffffff",
  padding: "15px 18px",
  fontSize: 14,
  fontWeight: 800,
  boxShadow: "0 10px 22px rgba(17, 24, 39, 0.16)",
};

const errorBox: CSSProperties = {
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.5,
};

const infoBox: CSSProperties = {
  borderRadius: 16,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.5,
};

const footerNote: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.5,
  textAlign: "center",
};